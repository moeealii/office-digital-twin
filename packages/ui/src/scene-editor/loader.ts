import type { SceneEditorModule } from './contracts';

/** Call only on explicit intent, after the engine's presented/fullQuality gates. No prefetch. */
export function loadSceneEditor(): Promise<SceneEditorModule> {
  return import('./native');
}
