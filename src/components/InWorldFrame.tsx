import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@thealifamily/ui';
import { frameScreenTransform, type FrameScreenProjection } from '../room/frame-screen-projection';
import './InWorldFrame.css';

interface FrameScreenSource {
  onFrameScreen(listener: (projection: FrameScreenProjection | null) => void): () => void;
}

interface InWorldFrameProps {
  engine: FrameScreenSource;
  onExit: () => void;
}

/** Mounted only after approaching the real display; never a modal or a startup dependency. */
export default function InWorldFrame({ engine, onExit }: InWorldFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const previousTransformRef = useRef('');
  const readyRef = useRef(false);
  const focusedRef = useRef(false);
  const projectedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const present = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const visible = readyRef.current && projectedRef.current;
    frame.style.opacity = visible ? '1' : '0';
    frame.style.pointerEvents = visible ? 'auto' : 'none';
    frame.tabIndex = visible ? 0 : -1;
    frame.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (visible && !focusedRef.current) { focusedRef.current = true; frame.focus({ preventScroll: true }); }
  }, []);

  useEffect(() => engine.onFrameScreen((projection) => {
    const frame = frameRef.current;
    if (!frame) return;
    const transform = projection ? frameScreenTransform(projection) : null;
    projectedRef.current = transform !== null;
    frame.style.visibility = transform ? 'visible' : 'hidden';
    present();
    if (transform && previousTransformRef.current !== transform) {
      frame.style.transform = transform;
      previousTransformRef.current = transform;
    }
  }), [engine, present]);

  useLayoutEffect(() => { // listen before a cached child can send its once-only ready message
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onExit();
    };
    const message = (event: MessageEvent<unknown>) => {
      const source = frameRef.current?.contentWindow;
      if (!source || event.source !== source || typeof event.data !== 'object' || event.data === null) return;
      if ('type' in event.data && event.data.type === 'home-hq-demo:exit') onExit();
      if ('type' in event.data && event.data.type === 'home-hq-demo:ready' && !readyRef.current) {
        readyRef.current = true; setReady(true); present();
      }
    };
    window.addEventListener('keydown', keyboard);
    window.addEventListener('message', message);
    return () => {
      window.removeEventListener('keydown', keyboard);
      window.removeEventListener('message', message);
    };
  }, [onExit, present]);

  return (
    <div className="world-frame-layer" data-testid="in-world-frame">
      <iframe
        ref={frameRef}
        className="world-frame-screen"
        src="/picture-frame/?mode=demo"
        title="Interactive Home HQ demo on the picture frame"
        width={1280}
        height={800}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'"
        tabIndex={-1}
      />
      {!ready ? <p className="world-frame-loading" role="status">Loading the public-safe demo…</p> : null}
      <Button className="world-frame-exit" onClick={onExit}>
        <span aria-hidden="true">←</span> Back to room <kbd>Esc</kbd>
      </Button>
    </div>
  );
}
