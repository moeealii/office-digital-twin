import type { Camera, Euler, Object3D, Scene, Vector3 } from 'three';

/** Type-only: importing the shared UI host must never load Three or the Editor. */
export type SceneEditorThree = Pick<typeof import('three'),
  'REVISION' | 'Scene' | 'Camera' | 'Object3D' | 'SkinnedMesh' | 'Vector3' | 'Euler' | 'MathUtils'>;
export type SceneEditorMode = 'translate' | 'rotate' | 'scale';

export interface SceneEditorSignal<Args extends unknown[]> {
  active: boolean;
  add(listener: (...args: Args) => void): void;
  remove(listener: (...args: Args) => void): void;
  dispatch(...args: Args): void;
  removeAll(): void;
  getNumListeners(): number;
}

export interface SceneEditorCommand {
  readonly type: string;
  readonly name: string;
  readonly id: number;
  readonly object?: Object3D | null;
  readonly attributeName?: string;
  readonly newValue?: unknown;
  readonly cmdArray?: readonly SceneEditorCommand[];
  execute(): void;
  undo(): void;
}

/** The single, actual upstream History instance, never a parallel React undo stack. */
export interface SceneEditorHistory {
  readonly undos: readonly SceneEditorCommand[];
  readonly redos: readonly SceneEditorCommand[];
  execute(command: SceneEditorCommand, name?: string): void;
  undo(): SceneEditorCommand | undefined;
  redo(): SceneEditorCommand | undefined;
  clear(): void;
}

export interface SceneEditorConfig {
  getKey(key: 'language'): 'en';
  getKey(key: 'selected'): string | null;
  setKey(key: 'selected', value: string | null): void;
  clear(): void;
}

export interface SceneEditorSignals {
  readonly objectSelected: SceneEditorSignal<[Object3D | null]>;
  readonly objectChanged: SceneEditorSignal<[Object3D]>;
  readonly objectAdded: SceneEditorSignal<[Object3D]>;
  readonly objectRemoved: SceneEditorSignal<[Object3D]>;
  readonly objectFocused: SceneEditorSignal<[Object3D]>;
  readonly sceneGraphChanged: SceneEditorSignal<[]>;
  readonly refreshSidebarObject3D: SceneEditorSignal<[Object3D]>;
  readonly transformModeChanged: SceneEditorSignal<[SceneEditorMode]>;
  readonly historyChanged: SceneEditorSignal<[SceneEditorCommand?]>;
}

/** Limited surface of the vendored Editor; no Loader, scripts, JSON or renderer API. */
export interface SceneEditorCore {
  readonly scene: Scene;
  readonly camera: Camera;
  readonly history: SceneEditorHistory;
  readonly signals: SceneEditorSignals;
  readonly config: SceneEditorConfig;
  readonly storage: { clear(): void };
  readonly selected: Object3D | null;
  select(object: Object3D | null): void;
  execute(command: SceneEditorCommand): void;
  undo(): void;
  redo(): void;
}

export type SceneEditorMutation =
  | { readonly kind: 'object'; readonly object: Object3D }
  | { readonly kind: 'structure'; readonly action: 'add' | 'remove' | 'transaction'; readonly object: Object3D };

export interface SceneEditorBridge {
  /** Must be the engine's actual namespace, not a second import of the same version. */
  readonly three: SceneEditorThree;
  /** Adopted by identity. The UI never reparents the scene or owns its GPU resources. */
  readonly scene: Scene;
  readonly camera: Camera;
  /** Invalidate frame caches/anchors and request a render for every edit AND undo/redo. */
  readonly onMutation: (mutation: SceneEditorMutation) => void;
  readonly onSelectionChange?: (object: Object3D | null) => void;
  readonly onHistoryChange?: (history: SceneEditorHistory) => void;
  readonly capabilities?: {
    /** Engine-owned native TransformControls. Toolbar is absent without this hook. */
    readonly setTransformMode?: (mode: SceneEditorMode) => void;
    readonly focusObject?: (object: Object3D) => void;
    /** Engine builds a reset transaction with session.executeTransaction; never history.clear. */
    readonly resetScene?: () => Promise<void>;
    /** Engine must validate local GLB bytes/resources before modifying the scene. No stock Loader. */
    readonly importGlb?: (request: {
      readonly file: File;
      readonly replace: Object3D | null;
      readonly signal: AbortSignal;
    }) => Promise<void>;
    /** Optional engine SkeletonUtils.clone adapter. Skinned duplication is disabled without it. */
    readonly cloneObject?: (object: Object3D) => Object3D;
  };
}

export interface SceneEditorTransform {
  readonly position: Vector3;
  readonly rotation: Euler;
  readonly scale: Vector3;
}

export interface SceneEditorSession {
  readonly core: SceneEditorCore;
  readonly history: SceneEditorHistory;
  readonly element: HTMLElement;
  /** Engine picking feeds the same native Selector/outliner/inspector. */
  select(object: Object3D | null): void;
  /** Before a live engine-owned TransformControls drag. Values are detached clones. */
  captureTransform(object: Object3D): SceneEditorTransform;
  /** Record a completed drag as one official compound command in the same History. */
  commitTransform(object: Object3D, before: SceneEditorTransform): void;
  /** Live drag updates, not a second history system. */
  notifyObjectChanged(object: Object3D): void;
  /** Engine preflight/parser hands a local object here; replacement keeps target parent/index. */
  addObject(object: Object3D, options?: { readonly replace?: Object3D }): void;
  /** Engine-owned reversible reset/structural changes use ONE official Command/History. */
  executeTransaction(name: string, operation: { execute(): void; undo(): void }): SceneEditorCommand;
  /** External non-undoable scene reload ONLY: discard stale references. Not the Reset action. */
  synchronizeScene(): void;
  /** UI listeners only; never dispose scene/renderer/geometry/material/texture. Idempotent. */
  unmount(): void;
}

export interface SceneEditorModule {
  readonly mountSceneEditor: (container: HTMLElement, bridge: SceneEditorBridge) => SceneEditorSession;
}
