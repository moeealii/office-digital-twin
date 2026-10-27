import { useEffect, useEffectEvent, useRef } from 'react';
import type { SceneEditorBridge, SceneEditorModule, SceneEditorSession } from './contracts';
import { loadSceneEditor } from './loader';

export interface SceneEditorHostProps {
  /** Explicit intent AND the app's core-quality readiness. False performs no import/mount. */
  readonly active: boolean;
  /** Keep this identity stable for the lifetime of an editing session. */
  readonly bridge: SceneEditorBridge | null;
  readonly className?: string;
  readonly onReady?: (session: SceneEditorSession) => void;
  readonly onError?: (error: unknown) => void;
  /** Optional prebuilt-ESM loader for engines with a separate public-asset build. */
  readonly loadModule?: () => Promise<SceneEditorModule>;
}

/** React owns only this empty mount point; the real upstream Editor owns its native DOM. */
export function SceneEditorHost({ active, bridge, className, onReady, onError, loadModule = loadSceneEditor }: SceneEditorHostProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<SceneEditorSession | undefined>(undefined);
  const reportReady = useEffectEvent((session: SceneEditorSession) => { onReady?.(session); });
  const reportError = useEffectEvent((error: unknown) => { onError?.(error); });
  // Closing only hides the native panel; the one official History survives reopening.
  useEffect(() => () => {
    sessionRef.current?.unmount();
    sessionRef.current = undefined;
  }, [bridge, loadModule]);
  useEffect(() => {
    const target = containerRef.current;
    if (!active || !bridge || !target || sessionRef.current) return undefined;
    let cancelled = false;
    let session: SceneEditorSession | undefined;
    void loadModule().then(module => {
      if (cancelled) return;
      session = module.mountSceneEditor(target, bridge);
      sessionRef.current = session;
      reportReady(session);
    }).catch((error: unknown) => {
      session?.unmount();
      if (sessionRef.current === session) sessionRef.current = undefined;
      if (!cancelled) reportError(error);
    });
    return () => { cancelled = true; };
  }, [active, bridge, loadModule]);
  return <div ref={containerRef} className={className} hidden={!active} data-scene-editor-host="" />;
}
