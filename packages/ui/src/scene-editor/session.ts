import type { SceneEditorConfig } from './contracts';

/** Never reads browser storage or upstream autosaved projects. */
export function createSessionConfig(): SceneEditorConfig {
  let selected: string | null = null;
  function getKey(key: 'language'): 'en';
  function getKey(key: 'selected'): string | null;
  function getKey(key: 'language' | 'selected'): string | null {
    return key === 'language' ? 'en' : selected;
  }
  return {
    getKey,
    setKey(_key, value) { selected = value; },
    clear() { selected = null; },
  };
}

/** Official widgets use only element-local listeners, including temporary pointer drags. */
export class EditorDomScope {
  private readonly listeners = new Map<EventTarget, Map<string, Set<EventListener>>>();

  readonly listen = (target: EventTarget, type: string, listener: EventListener): void => {
    let types = this.listeners.get(target);
    if (!types) { types = new Map(); this.listeners.set(target, types); }
    let callbacks = types.get(type);
    if (!callbacks) { callbacks = new Set(); types.set(type, callbacks); }
    callbacks.add(listener);
    target.addEventListener(type, listener);
  };

  readonly unlisten = (target: EventTarget, type: string, listener: EventListener): void => {
    target.removeEventListener(type, listener);
    const types = this.listeners.get(target);
    const callbacks = types?.get(type);
    callbacks?.delete(listener);
    if (callbacks?.size === 0) types?.delete(type);
    if (types?.size === 0) this.listeners.delete(target);
  };

  /** Outliner rebuilds must release detached rows immediately, not retain them until unmount. */
  readonly releaseTree = (node: Node): void => {
    for (const [target, types] of this.listeners) {
      if (target instanceof Node && node.contains(target)) {
        for (const [type, callbacks] of types) {
          for (const callback of callbacks) target.removeEventListener(type, callback);
        }
        this.listeners.delete(target);
      }
    }
  };

  dispose(): void {
    for (const [target, types] of this.listeners) {
      for (const [type, callbacks] of types) {
        for (const callback of callbacks) target.removeEventListener(type, callback);
      }
    }
    this.listeners.clear();
  }
}
