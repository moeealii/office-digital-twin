import { applyPreparedSculptures, type SculptTransfer } from './sculpt-cache';

/** No exact geometry fetch or CPU decoder runs on the critical startup path. */
export async function refineSculpts(value: unknown, expectedHash: string, baseUrl: string, checkpoint: () => Promise<boolean>, signal?: AbortSignal, changed: () => void = () => undefined): Promise<boolean> {
  if (signal?.aborted) return false;
  const data = await new Promise<SculptTransfer[] | null>((resolve) => {
    const worker = new Worker(new URL('./sculpt-worker.ts', import.meta.url), { type: 'module' });
    const finish = (result: SculptTransfer[] | null) => { worker.terminate(); signal?.removeEventListener('abort', abort); resolve(result); };
    const abort = () => { finish(null); };
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<SculptTransfer[] | null>) => { finish(event.data); };
    worker.onerror = () => { finish(null); };
    worker.postMessage({ value, expectedHash, baseUrl });
  });
  return data ? applyPreparedSculptures(data, checkpoint, changed) : false;
}
