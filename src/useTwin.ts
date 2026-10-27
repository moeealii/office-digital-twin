import { useEffect, useState } from 'react';
import { demoTwin } from './fixture';
import type { TwinSnapshot } from './lib';
export interface TwinState { twin: TwinSnapshot | null; offline: boolean }
/** Public snapshot is deliberately offline: no production API is contacted. */
export function useTwin(_fetcher?: typeof fetch): TwinState {
  const [twin, setTwin] = useState<TwinSnapshot>(() => demoTwin(Date.now()));
  useEffect(() => {
    const timer = window.setInterval(() => { setTwin(demoTwin(Date.now())); }, 20000);
    return () => { window.clearInterval(timer); };
  }, []);
  return { twin, offline: true };
}
