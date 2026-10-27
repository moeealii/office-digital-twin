import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Eyebrow, ProgressBar, TextButton } from '@thealifamily/ui';
import type { Hotspot } from '../data';
import { formatAge, hotspotStatus, type HotspotId, type Status, type TwinSnapshot } from '../lib';
import type { RoomEngine, ScreenPoint } from '../room/engine-api';
import { StatusPill } from './widgets';

// ---------------------------------------------------------------------------
// data-mode badge: LIVE / STALE / DEMO (never ambiguous)
// ---------------------------------------------------------------------------

export function ModeBadge({ twin, offline }: { twin: TwinSnapshot | null; offline: boolean }) {
  if (!twin) return <span className="mode-badge" data-mode="connecting">connecting…</span>;
  const text =
    twin.mode === 'live'
      ? `Snapshot live · ${formatAge(twin.ageSeconds)}`
      : twin.mode === 'stale'
        ? `Snapshot stale · ${formatAge(twin.ageSeconds)}`
        : offline
          ? 'Demo data · offline preview'
          : 'Demo data · live feed unavailable';
  return (
    <span className="mode-badge" data-mode={twin.mode} role="status" title={twin.mode === 'demo' ? 'Values are a realistic fixture, not the real NAS' : `Snapshot ${twin.generatedAt}`}>
      <span className="mode-led" aria-hidden="true" />
      {text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// hotspot markers: real buttons, positioned imperatively from engine frames
// (no React render per frame)
// ---------------------------------------------------------------------------

export function HotspotLayer({
  engine,
  hotspots,
  twin,
  activeId,
  hidden,
  onSelect,
}: {
  engine: RoomEngine | null;
  hotspots: readonly Hotspot[];
  twin: TwinSnapshot | null;
  activeId: HotspotId | null;
  hidden: boolean;
  onSelect: (id: HotspotId) => void;
}) {
  const markerMapRef = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    if (!engine) return;
    return engine.onFrame((points: Readonly<Record<string, ScreenPoint>>) => {
      for (const [id, el] of markerMapRef.current) {
        const p = points[id];
        if (!p) continue;
        el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
        el.dataset['offscreen'] = String(!p.visible);
        el.style.zIndex = String(1000 - Math.round(p.distance * 10));
      }
    });
  }, [engine]);
  return (
    <div className="hotspots" data-hidden={hidden || !engine}>
      {hotspots.map((h, i) => {
        const status: Status = hotspotStatus(twin, h.id);
        return (
          <button
            key={h.id}
            type="button"
            className="hotspot"
            data-status={status}
            data-active={activeId === h.id}
            data-offscreen="true"
            style={{ '--i': i } as CSSProperties}
            aria-pressed={activeId === h.id}
            aria-label={h.id === 'picture-frame' ? `${h.title}: approach the interactive display` : `${h.title}: open telemetry`}
            ref={(el) => {
              if (el) markerMapRef.current.set(h.id, el);
              else markerMapRef.current.delete(h.id);
            }}
            onClick={() => {
              onSelect(h.id);
            }}
          >
            <span className="hotspot-core" aria-hidden="true" />
            <span className="hotspot-label">{h.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// slide-in telemetry panel (bottom sheet on phones)
// ---------------------------------------------------------------------------

export function TelemetryPanel({
  hotspot,
  channel,
  status,
  onClose,
  children,
}: {
  hotspot: Hotspot | null;
  channel: number;
  status: Status;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!hotspot) return;
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [hotspot, onClose]);
  return (
    <aside
      ref={ref}
      className="panel"
      data-open={hotspot !== null}
      aria-hidden={hotspot === null}
      aria-labelledby="panel-title"
      tabIndex={-1}
      inert={hotspot === null}
    >
      {hotspot ? (
        <>
          <header className="panel-head">
            <div className="panel-channel">
              <span>telemetry</span>
              <span>ch·{String(channel).padStart(2, '0')}</span>
              <StatusPill status={status} />
            </div>
            <Eyebrow className="panel-kicker">{hotspot.kicker}</Eyebrow>
            <h2 id="panel-title">{hotspot.title}</h2>
            <p className="panel-blurb">{hotspot.blurb}</p>
            <button type="button" className="panel-close" onClick={onClose} aria-label="Close telemetry">
              ×
            </button>
          </header>
          <div className="panel-body">{children}</div>
        </>
      ) : null}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// guided tour controls
// ---------------------------------------------------------------------------

export function TourBar({
  stops,
  index,
  seconds,
  onStep,
  onExit,
}: {
  stops: readonly Hotspot[];
  index: number;
  seconds: number;
  onStep: (delta: number) => void;
  onExit: () => void;
}) {
  const stop = stops[index];
  return (
    <div className="tour" role="region" aria-label="Guided tour">
      <div className="tour-progress" aria-hidden="true">
        {stops.map((s, i) => (
          <span key={s.id} data-state={i < index ? 'done' : i === index ? 'now' : 'next'} style={{ '--dur': `${String(seconds)}s` } as CSSProperties} />
        ))}
      </div>
      <p className="tour-step">
        Stop {index + 1} of {stops.length} · <strong>{stop?.title}</strong>
      </p>
      <div className="tour-actions">
        <button type="button" onClick={() => { onStep(-1); }} aria-label="Previous stop">
          ←
        </button>
        <button type="button" onClick={() => { onStep(1); }} aria-label="Next stop">
          →
        </button>
        <TextButton onClick={onExit}>end tour</TextButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// loading state
// ---------------------------------------------------------------------------

export function Loader({ progress, stage, failed }: { progress: number; stage: string; failed: boolean }) {
  return (
    <div className="loader" data-failed={failed} role="status" aria-live="polite">
      <p className="loader-mark" aria-hidden="true">
        ⌂
      </p>
      <p className="loader-title">The Office</p>
      <p className="loader-stage">{failed ? 'This device could not start the 3D view.' : stage}</p>
      {failed ? null : <ProgressBar value={Math.round(progress * 100)} max={100} label="Loading the room" />}
    </div>
  );
}
