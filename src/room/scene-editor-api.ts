import type { SceneEditorBridge, SceneEditorSession } from '@thealifamily/ui';

export interface SceneNavigation { readonly mode: 'first-person' | 'orbit'; readonly locked: boolean; readonly canLook: boolean; readonly message: string | null }
export interface SceneSaveStatus { readonly state: 'unsaved' | 'saving' | 'saved' | 'restoring' | 'error'; readonly message: string }

/** Intent-only editor capability. UI visibility never discards its local scene/history. */
export interface RoomSceneEditor {
  readonly bridge: SceneEditorBridge;
  connect(session: SceneEditorSession): void;
  setEnabled(enabled: boolean): void;
  renderHelpers(): void;
  navigation(): SceneNavigation;
  onNavigation(listener: (value: SceneNavigation) => void): () => void;
  setNavigationMode(mode: SceneNavigation['mode']): void;
  startNavigation(): void;
  usesFirstPerson(): boolean;
  updateNavigation(time: number): boolean;
  save(): Promise<void>;
  onSave(listener: (value: SceneSaveStatus) => void): () => void;
  restoreSaved(): Promise<boolean>;
  hidden(object: import('three').Object3D): boolean;
  preserveShell(object: import('three').Object3D): boolean;
  dispose(): void;
}
