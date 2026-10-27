import type { RoomEngineModule } from './engine-api';

/** URL of the prebuilt room engine (public/room/engine.js, see room-engine/). */
const ENGINE_URL = '/room/engine.js';

function isEngineModule(m: unknown): m is RoomEngineModule {
  return typeof m === 'object' && m !== null && 'mountRoom' in m && typeof m.mountRoom === 'function';
}

/** Loads the engine at runtime: three.js never enters the app bundle. */
export async function loadEngine(url: string = ENGINE_URL): Promise<RoomEngineModule> {
  performance.mark('office:import:start');
  const mod: unknown = await import(/* @vite-ignore */ url);
  performance.mark('office:import:end');
  if (!isEngineModule(mod)) throw new Error(`${url} is not a room engine`);
  return mod;
}

export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2') !== null;
  } catch {
    return false;
  }
}
