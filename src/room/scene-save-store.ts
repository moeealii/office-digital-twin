/** Plain data only: checking for a local save must not import the editor or Three. */
export const SCENE_SAVE_VERSION = 1;
export const sceneSaveLimits = { nodes: 20_000, depth: 128, assets: 64, assetBytes: 20 * 1024 * 1024,
  totalBytes: 40 * 1024 * 1024, triangles: 1_000_000, texturePixels: 8_000_000, graphBytes: 8 * 1024 * 1024 } as const;

export type SceneNodeOrigin = { readonly kind: 'original'; readonly path: readonly number[] }
  | { readonly kind: 'asset'; readonly assetId: string; readonly path: readonly number[] };
export interface SceneSaveNode {
  readonly id: string;
  readonly origin: SceneNodeOrigin;
  readonly type: string;
  readonly parent: string | null;
  readonly index: number;
  readonly name: string;
  readonly position: readonly number[];
  readonly rotation: readonly number[];
  readonly rotationOrder: 'XYZ' | 'YXZ' | 'ZXY' | 'ZYX' | 'YZX' | 'XZY';
  readonly scale: readonly number[];
  readonly matrix: readonly number[];
  readonly matrixAutoUpdate: boolean;
  readonly visible: boolean;
}
export interface SceneSaveRecord {
  readonly version: typeof SCENE_SAVE_VERSION;
  readonly sourceKey: string;
  readonly baselineSignature: string;
  readonly savedAt: number;
  readonly nodes: readonly SceneSaveNode[];
  readonly assets: readonly { readonly id: string; readonly bytes: ArrayBuffer }[];
  readonly visibility: readonly { readonly id: string; readonly visible: boolean }[];
}
export type SceneSaveResult<T> = { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: 'unavailable' | 'denied' | 'quota' | 'aborted' | 'error'; readonly message: string };

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const validKey = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256;
/** The graph adapter does the exhaustive schema/origin check before restoration. */
export function isSceneSaveEnvelope(value: unknown): value is SceneSaveRecord {
  if (!object(value) || value['version'] !== SCENE_SAVE_VERSION || !validKey(value['sourceKey'])
    || typeof value['baselineSignature'] !== 'string' || value['baselineSignature'].length > 128
    || typeof value['savedAt'] !== 'number' || !Number.isSafeInteger(value['savedAt']) || value['savedAt'] < 0
    || !Array.isArray(value['nodes']) || !value['nodes'].length || value['nodes'].length > sceneSaveLimits.nodes
    || !Array.isArray(value['visibility']) || value['visibility'].length > sceneSaveLimits.nodes
    || !Array.isArray(value['assets']) || value['assets'].length > sceneSaveLimits.assets) return false;
  let bytes = 0;
  for (const asset of value['assets'] as unknown[]) {
    if (!object(asset) || !validKey(asset['id']) || !(asset['bytes'] instanceof ArrayBuffer)
      || asset['bytes'].byteLength > sceneSaveLimits.assetBytes || asset['bytes'].byteLength < 20) return false;
    bytes += asset['bytes'].byteLength;
    if (bytes > sceneSaveLimits.totalBytes) return false;
  }
  try {
    return JSON.stringify({ nodes: value['nodes'], visibility: value['visibility'] }).length <= sceneSaveLimits.graphBytes;
  } catch { return false; }
}

function failure<T>(error: unknown): SceneSaveResult<T> {
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  const reason = name === 'QuotaExceededError' ? 'quota' : name === 'SecurityError' || name === 'NotAllowedError' ? 'denied'
    : name === 'AbortError' ? 'aborted' : name === 'NotSupportedError' ? 'unavailable' : 'error';
  return { ok: false, reason, message: reason === 'quota' ? 'Browser storage is full. Changes are not saved.'
    : reason === 'denied' ? 'Browser storage access was denied. Changes are not saved.'
      : reason === 'unavailable' ? 'Browser storage is unavailable. Changes are not saved.'
        : reason === 'aborted' ? 'Local save operation cancelled.' : 'Local save operation failed. Changes may not be saved.' };
}
const cancelled = () => new DOMException('Local save operation cancelled.', 'AbortError');
const asError = (error: unknown): Error => error instanceof Error ? error : new Error('Local storage operation failed.');
function whileActive<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const abort = () => { reject(cancelled()); };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    void promise.then((value) => { signal.removeEventListener('abort', abort); resolve(value); },
      (error: unknown) => { signal.removeEventListener('abort', abort); reject(asError(error)); });
  });
}

/** Every write resolves only on transaction completion, never merely on request success. */
export function createSceneSaveStore(options: { readonly factory?: () => IDBFactory | undefined } = {}) {
  let opening: Promise<IDBDatabase> | undefined;
  const open = (): Promise<IDBDatabase> => {
    opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      const factory = (options.factory ?? (() => globalThis.indexedDB))();
      if (!factory) { reject(new DOMException('IndexedDB unavailable.', 'NotSupportedError')); return; }
      const request = factory.open('office-scene-edits', 1);
      let rejected = false;
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('saves')) request.result.createObjectStore('saves', { keyPath: 'sourceKey' });
      };
      request.onerror = () => { rejected = true; reject(request.error ?? new Error('Cannot open local storage.')); };
      request.onblocked = () => { rejected = true; reject(new Error('Local storage upgrade is blocked.')); };
      request.onsuccess = () => {
        const database = request.result;
        if (rejected) { database.close(); return; }
        database.onversionchange = () => { database.close(); opening = undefined; };
        resolve(database);
      };
    }).catch((error: unknown) => { opening = undefined; throw error; });
    return opening;
  };
  async function run<T>(key: string, mode: IDBTransactionMode, requestValue: (store: IDBObjectStore) => IDBRequest,
    result: (value: unknown) => T, signal?: AbortSignal): Promise<SceneSaveResult<T>> {
    try {
      if (!validKey(key)) throw new Error('Invalid scene source key.');
      if (signal?.aborted) throw cancelled();
      const database = await whileActive(open(), signal);
      if (signal?.aborted) throw cancelled();
      const value = await new Promise<T>((resolve, reject) => {
        const transaction = database.transaction('saves', mode);
        let request: IDBRequest, requestError: DOMException | null = null;
        const abort = () => { try { transaction.abort(); } catch { /* A completed transaction is already settled. */ } };
        const cleanup = () => { signal?.removeEventListener('abort', abort); };
        transaction.onabort = () => { cleanup(); reject(signal?.aborted ? cancelled() : requestError ?? transaction.error ?? new Error('Local storage transaction aborted.')); };
        transaction.onerror = () => { requestError = transaction.error; };
        transaction.oncomplete = () => {
          cleanup();
          try { resolve(result(request.result)); } catch (error: unknown) { reject(asError(error)); }
        };
        signal?.addEventListener('abort', abort, { once: true });
        try {
          request = requestValue(transaction.objectStore('saves'));
          request.onerror = () => { requestError = request.error; };
          if (signal?.aborted) abort();
        } catch (error: unknown) { cleanup(); abort(); reject(asError(error)); }
      });
      return { ok: true, value };
    } catch (error: unknown) { return failure(error); }
  }
  return {
    has: (sourceKey: string, signal?: AbortSignal) => run(sourceKey, 'readonly', (store) => store.getKey(sourceKey), (value) => value !== undefined, signal),
    read: (sourceKey: string, signal?: AbortSignal) => run(sourceKey, 'readonly', (store) => store.get(sourceKey), (value): SceneSaveRecord | null => {
      if (value === undefined) return null;
      if (!isSceneSaveEnvelope(value) || value.sourceKey !== sourceKey) throw new Error('Invalid local scene save.');
      return value;
    }, signal),
    write: async (record: SceneSaveRecord, signal?: AbortSignal): Promise<SceneSaveResult<void>> => {
      try {
        if (!isSceneSaveEnvelope(record)) return failure(new Error('Invalid local scene save.'));
        // Freeze the small graph at invocation time without recopying up to
        // 40 MiB of immutable retained GLBs on every transform autosave.
        const retained = { ...structuredClone({ ...record, assets: [] }), assets: record.assets.map((asset) => ({ id: asset.id, bytes: asset.bytes })) };
        return await run(retained.sourceKey, 'readwrite', (store) => store.put(retained), () => undefined, signal);
      } catch (error: unknown) { return failure(error); }
    },
    clear: (sourceKey: string, signal?: AbortSignal) => run(sourceKey, 'readwrite', (store) => store.delete(sourceKey), () => undefined, signal),
  };
}
