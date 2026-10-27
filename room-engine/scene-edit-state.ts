import * as THREE from 'three';

interface NodeState {
  readonly object: THREE.Object3D;
  readonly parent: THREE.Object3D | null;
  readonly position: THREE.Vector3;
  readonly rotation: THREE.Euler;
  readonly scale: THREE.Vector3;
  readonly matrix: THREE.Matrix4;
  readonly matrixAutoUpdate: boolean;
  readonly visible: boolean;
  readonly name: string;
}
export interface SceneSnapshot { readonly root: THREE.Object3D; readonly nodes: readonly NodeState[] }

/** Capture object identity/order, not serialized scenes, resources or a second undo stack. */
export function captureScene(root: THREE.Object3D): SceneSnapshot {
  const nodes: NodeState[] = [];
  root.traverse((object) => {
    nodes.push({ object, parent: object.parent, position: object.position.clone(), rotation: object.rotation.clone(),
      scale: object.scale.clone(), matrix: object.matrix.clone(), matrixAutoUpdate: object.matrixAutoUpdate,
      visible: object.visible, name: object.name });
  });
  return { root, nodes };
}

/** Used ONLY inside an official History transaction, including its Undo/Redo callbacks. */
export function restoreScene(snapshot: SceneSnapshot): void {
  const all = new Set<THREE.Object3D>();
  snapshot.root.traverse((object) => { all.add(object); });
  snapshot.nodes.forEach(({ object }) => { all.add(object); });
  // Also detach children of a deleted original: it may not be in the active graph.
  for (const object of all) for (const child of [...object.children]) object.remove(child);
  for (const state of snapshot.nodes) {
    const { object } = state;
    object.position.copy(state.position); object.rotation.copy(state.rotation); object.scale.copy(state.scale);
    object.matrix.copy(state.matrix); object.matrixAutoUpdate = state.matrixAutoUpdate;
    object.visible = state.visible; object.name = state.name;
    if (object !== snapshot.root) state.parent?.add(object);
  }
  snapshot.root.updateMatrixWorld(true);
}

export function belongsToScene(object: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) if (node === root) return true;
  return false;
}

interface HistoryEntry {
  readonly type: string;
  readonly object?: unknown;
  readonly attributeName?: unknown;
  readonly newValue?: unknown;
  readonly cmdArray?: unknown;
}

/** Derive visibility intent from the ONE official History, including Undo and Reset. */
export function explicitVisibility(history: readonly unknown[], isReset: (command: object) => boolean, initial: ReadonlyMap<THREE.Object3D, boolean> = new Map()): Map<THREE.Object3D, boolean> {
  const values = new Map(initial);
  const visit = (value: unknown) => {
    if (typeof value !== 'object' || value === null || !('type' in value)) return;
    if (isReset(value)) { values.clear(); return; }
    const command = value as HistoryEntry;
    if (command.type === 'SetValueCommand' && command.attributeName === 'visible'
      && command.object instanceof THREE.Object3D && typeof command.newValue === 'boolean') values.set(command.object as THREE.Object3D, command.newValue);
    if (Array.isArray(command.cmdArray)) command.cmdArray.forEach(visit);
  };
  history.forEach(visit);
  return values;
}

/** Automatic shell cutaways must not overwrite intentional transforms or visibility. */
export function shellEditPolicy(baseline: SceneSnapshot) {
  const initial = new Map(baseline.nodes.map((state) => [state.object, state]));
  let visibility = new Map<THREE.Object3D, boolean>();
  const transformed = (object: THREE.Object3D) => {
    for (let node: THREE.Object3D | null = object; node; node = node.parent) {
      const state = initial.get(node);
      if (state && (!node.position.equals(state.position) || !node.rotation.equals(state.rotation) || !node.scale.equals(state.scale))) return true;
      if (node === baseline.root) break;
    }
    return false;
  };
  return {
    setVisibility(values: Map<THREE.Object3D, boolean>): void { visibility = values; },
    hidden(object: THREE.Object3D): boolean { return visibility.get(object) === false; },
    preserve(object: THREE.Object3D): boolean {
      const value = visibility.get(object);
      if (value !== undefined) { object.visible = value; return true; }
      if (transformed(object)) { object.visible = initial.get(object)?.visible ?? true; return true; }
      return false;
    },
  };
}
