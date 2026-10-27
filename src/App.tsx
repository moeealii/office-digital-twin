import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button, PillButton, ProgressBar, Tag, TextButton, VisitorBadge } from '@thealifamily/ui';
import { HotspotLayer, Loader, ModeBadge, TelemetryPanel, TourBar } from './components/chrome';
import { EnvironmentPanel, PrayerPanel, RackPanel, ScanPanel } from './components/panels';
import { HOTSPOTS, INTRO_POSE, TOUR_STOP_SECONDS, type Hotspot } from './data';
import { chooseQuality, focusPose, hotspotStatus, stepTour, type HotspotId, type TwinSnapshot } from './lib';
import type { RoomEngine, RoomEngineModule, RoomQuality, RoomStats } from './room/engine-api';
import { loadEngine as defaultLoadEngine, webglAvailable as defaultWebgl } from './room/loadEngine';
import { useMinuteClock } from './useMinuteClock';
import { useTwin } from './useTwin';
import { EMPTY_TIDY } from './room/tidy-state';
import type { RoomSceneEditor } from './room/scene-editor-api';
const SceneEditor = lazy(() => import('./components/SceneEditor'));
const TidyTools = lazy(() => import('./components/TidyTools'));
const InWorldFrame = lazy(() => import('./components/InWorldFrame'));

type Phase = 'loading' | 'intro' | 'explore' | 'failed';
const QUALITY_LABELS: Record<RoomQuality['stage'], string> = {
  sharpening: 'Sharpening textures', materials: 'Refining lighting', detail: 'Finishing fine detail',
  ready: 'Full room detail ready', limited: 'Preview quality · some detail unavailable',
};

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const readTourViewport = () => ({ compact: window.innerWidth < 900 || window.matchMedia('(pointer: coarse)').matches, height: window.visualViewport?.height ?? window.innerHeight });

function deviceHints() {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    width: window.innerWidth,
    cores: nav.hardwareConcurrency,
    memoryGb: nav.deviceMemory,
    saveData: nav.connection?.saveData === true,
    override: new URLSearchParams(window.location.search).get('quality'),
  };
}

function PanelContent({ id, twin, stats, now }: { id: HotspotId; twin: TwinSnapshot; stats: RoomStats | null; now: Date }) {
  switch (id) {
    case 'rack':
      return <RackPanel twin={twin} />;
    case 'aranet4':
      return <EnvironmentPanel twin={twin} />;
    case 'prayer':
      return <PrayerPanel now={now} />;
    case 'picture-frame':
      return null; // the real display has an in-world document, never a telemetry panel
    case 'lounge':
      return <ScanPanel stats={stats} />;
  }
}

export interface AppProps {
  loadEngine?: () => Promise<RoomEngineModule>;
  webglAvailable?: () => boolean;
  fetcher?: typeof fetch;
}

export default function App({ loadEngine = defaultLoadEngine, webglAvailable = defaultWebgl, fetcher }: AppProps) {
  const { twin, offline } = useTwin(fetcher);
  const now = useMinuteClock();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const introCancelledRef = useRef(false);
  const frameRequestRef = useRef(0);
  const framePointersRef = useRef(new Set<number>());
  const frameMultiTouchRef = useRef(false);
  const framePressRef = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const [frameMode, setFrameMode] = useState<'idle' | 'approaching' | 'interactive' | 'unavailable'>('idle');
  const invalidateFrameRequest = useCallback(() => { frameRequestRef.current++; }, []);
  const [engine, setEngine] = useState<RoomEngine | null>(null);
  const [quality, setQuality] = useState<RoomQuality>({ stage: 'sharpening', completed: 0, total: 0 });
  useEffect(() => engine?.onQuality(setQuality), [engine]);
  const [editorWanted, setEditorWanted] = useState(false);
  const [sceneEditor, setSceneEditor] = useState<RoomSceneEditor | null>(null);
  const [editorPreparing, setEditorPreparing] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [restoringSaved, setRestoringSaved] = useState(false);
  useEffect(() => {
    if (!engine?.restoreSavedScene) return;
    let live = true;
    const isLive = () => live;
    void engine.restoreSavedScene((restoring) => { if (live) setRestoringSaved(restoring); }).then(async (restored) => {
      if (!live || !restored) return;
      setSceneEditor((current) => current ?? restored);
      const applied = await restored.restoreSaved();
      if (!applied && isLive()) setEditorError('Saved edits could not be restored. The current room remains usable.');
    }).catch(() => { if (live) setEditorError('Saved edits could not be restored. The current room remains usable.'); });
    return () => { live = false; };
  }, [engine]);
  const editorIntentRef = useRef(false);
  useEffect(() => { sceneEditor?.setEnabled(editorWanted); }, [sceneEditor, editorWanted]);
  const closeEditor = useCallback(() => { editorIntentRef.current = false; setEditorWanted(false); }, []);
  const editorFailed = useCallback((error: unknown) => { console.error('Scene editor unavailable', error); setEditorPreparing(false); setEditorError('Editor tools could not load. Your room remains usable. Close the editor and try again.'); }, []);
  const [tidyState, setTidyState] = useState(EMPTY_TIDY);
  useEffect(() => engine?.onTidy(setTidyState), [engine]);
  const [webgl] = useState(webglAvailable);
  const [stage, setStage] = useState<Exclude<Phase, 'failed'> | 'error'>('loading');
  const phase: Phase = !webgl || stage === 'error' ? 'failed' : stage;
  const [progress, setProgress] = useState({ p: 0, stage: 'Loading the room' });
  const [selectedId, setSelectedId] = useState<HotspotId | null>(null);
  const [tourIndex, setTourIndex] = useState<number | null>(null);
  const [tourExpanded, setTourExpanded] = useState(false);
  const [tourPaused, setTourPaused] = useState(false);
  const [tourViewport, setTourViewport] = useState(readTourViewport);
  useEffect(() => {
    const update = () => { setTourViewport(readTourViewport()); };
    window.addEventListener('resize', update); window.visualViewport?.addEventListener('resize', update);
    return () => { window.removeEventListener('resize', update); window.visualViewport?.removeEventListener('resize', update); };
  }, []);
  const compactTour = tourIndex !== null && tourViewport.compact;
  const collapseTour = useCallback(() => { setTourExpanded(false); }, []);
  // During the tour the current stop IS the selection.
  const activeId: HotspotId | null = tourIndex !== null ? (HOTSPOTS[tourIndex]?.id ?? null) : selectedId;

  // ---- mount the 3D room ------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !webgl) return;
    let cancelled = false;
    const isCancelled = () => cancelled;
    let mounted: RoomEngine | null = null;
    loadEngine()
      .then((mod) =>
        cancelled ? null : mod.mountRoom(canvas, {
          quality: chooseQuality(deviceHints()),
          anchors: HOTSPOTS.map((h) => h.anchor),
          beamAnchor: 'rack',
          onProgress: (p, stage) => {
            if (!cancelled) setProgress({ p, stage });
          },
        }),
      )
      .then(async (e) => {
        if (!e) return;
        mounted = e;
        if (cancelled) {
          e.dispose();
          return;
        }
        const calm = prefersReducedMotion();
        await e.flyTo(calm ? e.home : INTRO_POSE, 0);
        await e.presented; // never unlock controls over an unrendered/placeholder room
        if (isCancelled()) return;
        e.setInteractive(true);
        performance.mark('office:first-usable');
        setEngine(e);
        void e.fullQuality.then((complete) => { if (!isCancelled()) setQuality({ stage: complete ? 'ready' : 'limited', completed: 0, total: 0 }); });
        setStage(calm ? 'explore' : 'intro'); // reduced motion: no cinematic
      })
      .catch((err: unknown) => {
        console.error('room failed to load', err);
        if (!cancelled) setStage('error');
      });
    return () => {
      cancelled = true; invalidateFrameRequest();
      mounted?.dispose();
    };
  }, [loadEngine, webgl, invalidateFrameRequest]);

  // ---- cinematic intro --------------------------------------------------------
  const finishIntro = useCallback(
    (fast: boolean) => {
      if (!engine) return;
      introCancelledRef.current = true;
      engine.setInteractive(true);
      setStage('explore');
      if (fast) void engine.flyTo(engine.home, prefersReducedMotion() ? 0 : 700);
    },
    [engine],
  );
  useEffect(() => {
    if (phase !== 'intro' || !engine || introCancelledRef.current) return;
    engine.setInteractive(true); // cinematic is optional: input can interrupt it immediately
    let live = true;
    performance.mark('office:intro:start');
    void engine.flyTo(engine.home, 5600).then(() => {
      performance.mark('office:intro:end');
      if (live) finishIntro(false);
    });
    return () => {
      live = false;
    };
  }, [phase, engine, finishIntro]);

  // ---- focus a hotspot --------------------------------------------------------
  const anchors = engine?.anchors;
  const focus = useCallback(
    (h: Hotspot) => {
      if (!engine) return;
      if (h.id === 'picture-frame') { void engine.focusPictureFrame(prefersReducedMotion() ? 0 : 1200); return; }
      const at = anchors?.[h.id];
      // Keep the small physical sensor above the bottom telemetry sheet on narrow viewports.
      const framing = h.id === 'aranet4' && window.innerWidth < 900 ? { ...h.focus, drop: 0.4 } : h.focus;
      if (at) void engine.flyTo(focusPose(at, framing), prefersReducedMotion() ? 0 : 1500);
    },
    [engine, anchors],
  );
  const openFrame = useCallback(() => {
    const token = ++frameRequestRef.current;
    finishIntro(false); setTourIndex(null); setSelectedId('picture-frame');
    if (!engine) { setFrameMode('unavailable'); return; }
    setFrameMode('approaching');
    void (async () => {
      await engine.setTidy(false);
      if (token !== frameRequestRef.current) return;
      const available = await engine.focusPictureFrame(prefersReducedMotion() ? 0 : 1200);
      if (token !== frameRequestRef.current) return;
      setFrameMode(available ? 'interactive' : 'unavailable');
      if (!available) await engine.leavePictureFrame(prefersReducedMotion() ? 0 : 700);
    })().catch(() => { if (token === frameRequestRef.current) { setFrameMode('unavailable'); void engine.leavePictureFrame(0); } });
  }, [engine, finishIntro]);
  const select = useCallback(
    (id: HotspotId) => {
      if (id === 'picture-frame') { openFrame(); return; }
      frameRequestRef.current++; setFrameMode('idle');
      finishIntro(false);
      if (engine) void engine.setTidy(false);
      setTourIndex(null);
      setSelectedId(id);
      const h = HOTSPOTS.find((x) => x.id === id);
      if (h) focus(h);
    },
    [focus, finishIntro, engine, openFrame],
  );
  const close = useCallback(() => {
    frameRequestRef.current++; setFrameMode('idle');
    setSelectedId(null); setTourIndex(null); setTourExpanded(false); setTourPaused(false);
  }, []);
  const closeFrame = useCallback(() => {
    close();
    if (engine) void engine.leavePictureFrame(prefersReducedMotion() ? 0 : 700);
  }, [close, engine]);
  const overview = useCallback(() => {
    finishIntro(false);
    close();
    if (engine) { void engine.setTidy(false); void engine.flyTo(engine.home, prefersReducedMotion() ? 0 : 1400); }
  }, [close, engine, finishIntro]);
  const toggleTidy = useCallback(() => {
    if (!engine || tidyState.preparing) return;
    finishIntro(false); close();
    void engine.setTidy(!tidyState.enabled);
  }, [engine, tidyState.preparing, tidyState.enabled, finishIntro, close]);

  const openEditor = useCallback(() => {
    if (!engine?.prepareSceneEditor) return;
    finishIntro(false); close(); void engine.leavePictureFrame(0, false);
    editorIntentRef.current = true; setEditorWanted(true); setEditorError(null);
    if (sceneEditor) return;
    setEditorPreparing(true);
    void engine.prepareSceneEditor().then((viewport) => {
      setSceneEditor(viewport); setEditorPreparing(false); viewport.setEnabled(editorIntentRef.current);
    }).catch(editorFailed);
  }, [engine, sceneEditor, finishIntro, close, editorFailed]);

  // ---- guided tour ------------------------------------------------------------
  useEffect(() => {
    if (tourIndex === null) return;
    const h = HOTSPOTS[tourIndex];
    if (!h) return;
    focus(h);
  }, [tourIndex, focus]);
  useEffect(() => {
    if (tourIndex === null || tourPaused || tourExpanded || prefersReducedMotion()) return;
    const timer = window.setTimeout(() => { setTourExpanded(false); setTourIndex((index) => index === null ? null : stepTour(index, 1, HOTSPOTS.length)); }, TOUR_STOP_SECONDS * 1000);
    return () => { window.clearTimeout(timer); };
  }, [tourIndex, tourPaused, tourExpanded]);

  // grabbing the camera ends the tour (the visitor wants control)
  useEffect(() => {
    if (!engine) return;
    return engine.onUserInput(() => {
      finishIntro(false); frameRequestRef.current++;
      if (compactTour && frameMode !== 'interactive') { setTourPaused(true); setTourExpanded(false); return; }
      if (frameMode === 'interactive') setSelectedId('picture-frame'); // the document stays attached while orbiting outside its screen
      else if (frameMode !== 'idle' || activeId === 'picture-frame') {
        setFrameMode('idle'); setSelectedId(null); void engine.leavePictureFrame(0, false);
      } else setSelectedId(activeId); // keep an ordinary telemetry panel open
      setTourIndex(null);
    });
  }, [engine, activeId, finishIntro, frameMode, compactTour]);

  const canvasDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || editorWanted || tidyState.enabled || tidyState.preparing || frameMode === 'interactive' || frameMode === 'approaching') return;
    framePointersRef.current.add(event.pointerId);
    if (framePointersRef.current.size > 1) { frameMultiTouchRef.current = true; framePressRef.current = null; return; }
    if (!frameMultiTouchRef.current) framePressRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  };
  const canvasMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const press = framePressRef.current;
    if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) press.moved = true;
  };
  const canvasUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    framePointersRef.current.delete(event.pointerId);
    const press = framePressRef.current; framePressRef.current = null;
    if (frameMultiTouchRef.current) { if (!framePointersRef.current.size) frameMultiTouchRef.current = false; return; }
    if (!press) return;
    if (!engine || editorWanted || tidyState.enabled || tidyState.preparing || press.id !== event.pointerId || press.moved
      || Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (engine.hitPictureFrame({ x: event.clientX - rect.left, y: event.clientY - rect.top })) openFrame();
  };
  const cancelCanvasPress = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    framePointersRef.current.delete(event.pointerId); framePressRef.current = null;
    if (!framePointersRef.current.size) frameMultiTouchRef.current = false;
  };
  const active = useMemo(() => HOTSPOTS.find((h) => h.id === activeId) ?? null, [activeId]);
  const panelHotspot = active?.id === 'picture-frame' || (compactTour && !tourExpanded) ? null : active;
  const ready = phase === 'intro' || phase === 'explore';
  const failed = phase === 'failed';
  useEffect(() => {
    performance.mark(`office:phase:${phase}`);
  }, [phase]);

  return (
    <div className="twin" data-phase={phase} data-panel={panelHotspot !== null} data-frame={frameMode === 'interactive'} data-quality={quality.stage} data-tour-peek={compactTour} data-editor={editorWanted}>
      <div className="stage">
        <canvas ref={canvasRef} className="scene" aria-label="3D model of the office. Drag to orbit, scroll or pinch to zoom." tabIndex={0}
          onPointerDown={canvasDown} onPointerMove={canvasMove} onPointerUp={canvasUp} onPointerCancel={cancelCanvasPress} />
        {failed ? <div className="poster" aria-hidden="true" /> : null}
        <div className="vignette" aria-hidden="true" />
        <HotspotLayer engine={engine} hotspots={HOTSPOTS} twin={twin} activeId={activeId} hidden={!ready || editorWanted || frameMode === 'interactive' || frameMode === 'approaching'} onSelect={select} />
        {engine && frameMode === 'interactive' ? <Suspense fallback={<p className="frame-message" role="status">Opening the display…</p>}><InWorldFrame engine={engine} onExit={closeFrame} /></Suspense> : null}
      </div>

      {!ready ? <Loader progress={progress.p} stage={progress.stage} failed={failed} /> : null}
      {restoringSaved && !editorWanted ? <p className="frame-message saved-room-message" role="status">Restoring your saved room…</p> : null}
      {editorError && !editorWanted ? <div className="frame-message saved-room-message" role="status">{editorError} <Button onClick={openEditor}>Open editor</Button></div> : null}
      {frameMode === 'approaching' ? <div className="frame-message" role="status">Approaching the real display… <Button onClick={closeFrame}>Cancel</Button></div> : null}
      {frameMode === 'unavailable' ? <div className="frame-message" role="status">
        <p>{engine ? 'The modeled display is hidden or cannot be approached. Restore tidied items and try again.' : 'The in-world display needs the 3D view.'}</p>
        <a href="/picture-frame/?mode=demo" target="_blank" rel="noopener noreferrer">Open the public-safe demo</a>
        <Button onClick={closeFrame}>Dismiss</Button>
      </div> : null}

      <header className="masthead" data-intro={phase === 'intro'}>
        <p className="masthead-kicker">thealifamily.ca · home office</p>
        <h1>
          The <em>Office</em>
        </h1>
        <p className="masthead-sub">An interactive office model with synthetic demo telemetry. Private images are replaced with procedural surfaces.</p>
      </header>

      <div className="topbar">
        <ModeBadge twin={twin} offline={offline} />
        {ready ? <section className="quality-state" role="status" aria-live="polite" aria-label="Room visual quality" data-stage={quality.stage}>
          <Tag label={QUALITY_LABELS[quality.stage]} />
          {quality.stage === 'sharpening' ? <>
            <p>Initial view — surfaces sharpen as you explore.</p>
            {quality.total > 0 ? <><ProgressBar value={quality.completed} max={quality.total} label="Visible room maps sharpened" /><p>{quality.completed} of {quality.total} visible maps sharpened</p></> : null}
          </> : quality.stage === 'materials' ? <p>Lighting and public-safe procedural materials follow in the background. Keep exploring.</p>
            : quality.stage === 'detail' ? <p>Finishing exact small objects. Keep exploring.</p>
              : quality.stage === 'limited' ? <p>The real preview remains usable; some detail could not load.</p> : null}
        </section> : null}
      </div>

      {phase === 'intro' ? (
        <button
          type="button"
          className="skip"
          onClick={() => {
            finishIntro(true);
          }}
        >
          Skip intro
        </button>
      ) : null}

      {ready || failed ? (
        <nav className="dock" aria-label="Areas of the office">
          <button
            type="button"
            className="dock-tour"
            aria-pressed={tourIndex !== null}
            onClick={() => {
              finishIntro(false); close();
              if (engine) void engine.setTidy(false);
              setTourIndex(tourIndex === null ? 0 : null);
            }}
          >
            {tourIndex === null ? '▶ Guided tour' : '■ Stop tour'}
          </button>
          {failed ? null : (
            <button type="button" className="dock-chip" onClick={overview}>
              Overview
            </button>
          )}
          {engine?.prepareSceneEditor ? <button type="button" className="dock-chip" aria-pressed={editorWanted} disabled={editorPreparing} onClick={openEditor}>{editorPreparing ? 'Preparing editor…' : 'Scene editor'}</button>
            : engine ? <button type="button" className="dock-chip" aria-pressed={tidyState.enabled} disabled={tidyState.preparing} onClick={toggleTidy}>{tidyState.preparing ? 'Preparing Tidy…' : tidyState.enabled ? 'Tidy on' : 'Tidy mode'}</button> : null}
          {HOTSPOTS.map((h) => (
            <button
              key={h.id}
              type="button"
              className="dock-chip"
              data-status={hotspotStatus(twin, h.id)}
              aria-pressed={activeId === h.id}
              onClick={() => {
                select(h.id);
              }}
            >
              <span className="dock-led" aria-hidden="true" />
              {h.label}
            </button>
          ))}
        </nav>
      ) : null}

      {engine && (tidyState.enabled || tidyState.preparing || tidyState.hiddenCount > 0 || tidyState.error) ? (
        <Suspense fallback={<div className="tidy-tools" role="status">Preparing Tidy tools…</div>}>
          <TidyTools state={tidyState} engine={engine} toggle={toggleTidy} />
        </Suspense>
      ) : null}

      {editorWanted || sceneEditor ? <Suspense fallback={editorWanted ? <div className="scene-editor-panel" role="status">Opening editor tools… <Button onClick={closeEditor}>Close editor</Button></div> : null}>
        <SceneEditor active={editorWanted} editor={sceneEditor} preparing={editorPreparing} error={editorError} close={closeEditor} failed={editorFailed} />
      </Suspense> : null}

      {compactTour && active ? <section className="tour-peek" role="region" aria-label="Guided tour" data-expanded={tourExpanded} style={{ maxHeight: Math.floor(tourViewport.height * 0.25) }}>
        <div className="tour-peek-head"><h2>{active.title}</h2><span>Stop {tourIndex + 1} of {HOTSPOTS.length}{tourPaused ? ' · paused' : ''}</span></div>
        <p className="tour-peek-caption">{active.blurb}</p>
        <div className="tour-peek-actions">
          <TextButton onClick={() => { close(); if (active.id === 'picture-frame' && engine) void engine.leavePictureFrame(0, false); }}><span className="sr-only">end tour</span><span aria-hidden="true">Stop</span></TextButton>
          <TextButton onClick={() => { setTourExpanded(false); setTourPaused(false); setTourIndex(stepTour(tourIndex, -1, HOTSPOTS.length)); }}><span className="sr-only">Previous stop</span><span aria-hidden="true">Prev</span></TextButton>
          {tourPaused ? <TextButton onClick={() => { setTourPaused(false); }}>Resume</TextButton> : null}
          <TextButton onClick={() => { setTourExpanded(false); setTourPaused(false); setTourIndex(stepTour(tourIndex, 1, HOTSPOTS.length)); }}><span className="sr-only">Next stop</span><span aria-hidden="true">Next</span></TextButton>
          {active.id === 'picture-frame' ? <PillButton className="tour-peek-more" onClick={openFrame}>Try frame</PillButton>
            : <PillButton className="tour-peek-more" open={tourExpanded} onClick={() => { setTourExpanded((value) => !value); }}>{tourExpanded ? 'Collapse' : 'Expand'}</PillButton>}
        </div>
      </section> : null}

      {tourIndex !== null && !compactTour ? (
        <TourBar
          stops={HOTSPOTS}
          index={tourIndex}
          seconds={TOUR_STOP_SECONDS}
          onStep={(d) => {
            setTourIndex((i) => stepTour(i ?? 0, d, HOTSPOTS.length));
          }}
          onExit={() => {
            setTourIndex(null);
          }}
        />
      ) : null}

      {activeId !== 'picture-frame' ? <TelemetryPanel
        hotspot={panelHotspot}
        channel={panelHotspot ? HOTSPOTS.indexOf(panelHotspot) + 1 : 0}
        status={panelHotspot ? hotspotStatus(twin, panelHotspot.id) : 'unknown'}
        onClose={compactTour ? collapseTour : close}
      >
        {panelHotspot && twin ? <PanelContent id={panelHotspot.id} twin={twin} stats={engine?.stats ?? null} now={now} /> : null}
      </TelemetryPanel> : null}

      <footer className="credits">
        <span>Rebuilt from a LiDAR scan in three.js</span>
        <VisitorBadge fetcher={fetcher} />
      </footer>
    </div>
  );
}
