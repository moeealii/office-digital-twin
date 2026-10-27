import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { SceneEditorMutation, SceneEditorSession, SceneEditorTransform } from '@thealifamily/ui';
import type { RoomSceneEditor } from '../src/room/scene-editor-api';
import type { CameraPose } from '../src/room/engine-api';
import type { SceneEditorRuntime } from './scene-editor-three';
import { belongsToScene, captureScene, explicitVisibility, restoreScene, shellEditPolicy } from './scene-edit-state';
import { validateLocalGlb } from './local-glb';
import { createSceneNavigation } from './scene-editor-navigation';
import { createSceneAutosaveAdapter } from './scene-autosave';
import { createSceneSaveStore } from '../src/room/scene-save-store';
import { createObjectSelection } from './object-selection';
import type { SceneSaveStatus } from '../src/room/scene-editor-api';

export interface SceneViewportOptions {
  readonly three: SceneEditorRuntime;
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly orbit: OrbitControls;
  readonly request: () => void;
  readonly changed: (mutation: SceneEditorMutation) => void;
  readonly focus: (pose: CameraPose) => void;
  readonly firstPerson?: CameraPose;
  readonly sourceKey?: string;
}

function importedResources(root: THREE.Object3D): () => void {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const mesh = object as THREE.Mesh; geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value as THREE.Texture);
    }
  });
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true; geometries.forEach((value) => { value.dispose(); }); materials.forEach((value) => { value.dispose(); });
    const bitmaps = new Set<ImageBitmap>();
    textures.forEach((value) => { const image: unknown = value.source.data; if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) bitmaps.add(image); value.dispose(); });
    bitmaps.forEach((image) => { image.close(); });
  };
}

async function parseValidatedLocalModel(buffer: ArrayBuffer): Promise<{ root: THREE.Group; release: () => void }> {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => { if (!url.startsWith('blob:')) throw new Error('Local model: network resources are blocked.'); return url; });
  const root = (await new GLTFLoader(manager).parseAsync(buffer, '')).scene;
  const release = importedResources(root), checked = new Set<THREE.BufferGeometry>();
  root.traverse((object) => { if (!(object instanceof THREE.Mesh)) return; const geometry = (object as THREE.Mesh).geometry; if (!checked.has(geometry)) { checked.add(geometry); geometry.computeBoundingBox(); geometry.computeBoundingSphere(); } });
  const bounds = new THREE.Box3().setFromObject(root);
  if (bounds.isEmpty() || ![...bounds.min.toArray(), ...bounds.max.toArray()].every((value) => Number.isFinite(value) && Math.abs(value) <= 1000) || bounds.getSize(new THREE.Vector3()).length() > 100) {
    release(); throw new Error('Local model: unbounded dimensions or invalid geometry.');
  }
  return { root, release };
}

/** Runs only in the separate factory bundle after explicit editor intent. */
export function createSceneEditorViewport(options: SceneViewportOptions): RoomSceneEditor {
  const { scene, renderer, camera, orbit, request } = options;
  if (!(scene instanceof THREE.Scene) || !(camera instanceof THREE.Camera) || options.three.Object3D !== THREE.Object3D) throw new Error('Editor runtime identity mismatch.');
  const canvas = renderer.domElement, baseline = captureScene(scene), policy = shellEditPolicy(baseline);
  const selection = createObjectSelection(scene);
  const helpers = new THREE.Scene(), transform = new TransformControls(camera, canvas);
  helpers.add(transform.getHelper()); transform.enabled = false;
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const resets = new WeakSet<object>();
  const sourceKey = options.sourceKey ?? 'test-room-v1';
  const autosave = createSceneAutosaveAdapter({ root: scene, sourceKey });
  const store = createSceneSaveStore(), lifetime = new AbortController();
  const isLifetimeAborted = () => lifetime.signal.aborted;
  const saveListeners = new Set<(value: SceneSaveStatus) => void>();
  let saveStatus: SceneSaveStatus = { state: 'unsaved', message: 'Edits autosave in this browser.' };
  let initialVisibility = new Map<THREE.Object3D, boolean>(), visibility = new Map<THREE.Object3D, boolean>();
  let saveTimer = 0, revision = 0, savedRevision = 0;
  let saving: Promise<void> | null = null, restoring: Promise<boolean> | null = null;
  const reportSave = (value: SceneSaveStatus) => { saveStatus = value; for (const listener of saveListeners) listener(value); };
  const save = async (): Promise<void> => {
    if (disposed) return;
    if (saveTimer) { window.clearTimeout(saveTimer); saveTimer = 0; }
    if (saving) { await saving; if (revision > savedRevision) await save(); return; }
    const at = revision;
    saving = (async () => {
      try {
        const record = autosave.capture(visibility); reportSave({ state: 'saving', message: 'Saving edits in this browser…' });
        const latest = session?.history.undos.at(-1);
        const result = latest && resets.has(latest) ? await store.clear(sourceKey, lifetime.signal) : await store.write(record, lifetime.signal);
        if (isLifetimeAborted()) return;
        if (!result.ok) { reportSave({ state: 'error', message: result.message }); return; }
        savedRevision = at;
        reportSave(revision === at ? { state: 'saved', message: 'Saved in this browser.' } : { state: 'unsaved', message: 'More changes waiting to save…' });
      } catch { if (!isLifetimeAborted()) reportSave({ state: 'error', message: 'Changes could not be saved. Your current view is unchanged.' }); }
    })();
    try { await saving; } finally { saving = null; }
  };
  const scheduleSave = () => {
    revision++; reportSave({ state: 'unsaved', message: 'Changes waiting to autosave…' });
    if (saveTimer) window.clearTimeout(saveTimer);
    const attempt = () => { if (dragging) { saveTimer = window.setTimeout(attempt, 200); return; } saveTimer = 0; void save(); };
    saveTimer = window.setTimeout(attempt, 600);
  };
  let session: SceneEditorSession | null = null, enabled = false, disposed = false;
  // r186 typings declare object nonoptional although detach() assigns undefined.
  const selectedObject = (): THREE.Object3D | undefined => transform.object;
  const currentAxis = (): typeof transform.axis | null => transform.axis;
  const isDisposed = () => disposed;
  let dragging: { object: THREE.Object3D; before: SceneEditorTransform } | null = null;
  let orbitBeforeDrag = true;
  // Deleted/replaced imports remain in official Undo history, so budget retained
  // resources across the whole session rather than only the visible graph.
  let importedBytes = 0, importedTriangles = 0, importedPixels = 0;
  const releaseImports = new Set<() => void>();
  let mutationGeneration = 0;
  let press: { id: number; x: number; y: number; gizmo: boolean; moved: boolean; parts: boolean } | null = null;
  const pointers = new Set<number>();
  const selectable = (object: THREE.Object3D | null): object is THREE.Object3D => object !== null && object !== scene && object !== camera && belongsToScene(object, scene);
  const refreshHistory = () => {
    visibility = explicitVisibility(session?.history.undos ?? [], (command) => resets.has(command), initialVisibility);
    policy.setVisibility(visibility);
    options.changed({ kind: 'structure', action: 'transaction', object: scene }); request();
  };
  const select = (object: THREE.Object3D | null) => {
    if (enabled && selectable(object)) transform.attach(object); else transform.detach();
    request();
  };
  const changed = (mutation: SceneEditorMutation) => {
    if (mutation.kind === 'object' && !mutation.object.matrixAutoUpdate) mutation.object.updateMatrix();
    scene.updateMatrixWorld(true);
    const object = selectedObject();
    if (object && !selectable(object)) transform.detach();
    options.changed(mutation); request();
  };
  const onChange = () => { request(); };
  const onObjectChange = () => { if (dragging) session?.notifyObjectChanged(dragging.object); };
  const onDragStart = () => {
    const object = selectedObject();
    if (!enabled || !session || !object || !selectable(object)) return;
    orbit.enabled = false;
    dragging = { object, before: session.captureTransform(object) };
  };
  const onDragEnd = () => {
    if (dragging) { session?.commitTransform(dragging.object, dragging.before); dragging = null; }
    orbit.enabled = orbitBeforeDrag; request();
  };
  transform.addEventListener('change', onChange); transform.addEventListener('objectChange', onObjectChange);
  transform.addEventListener('mouseDown', onDragStart); transform.addEventListener('mouseUp', onDragEnd);
  const navigation = createSceneNavigation({ camera, canvas, orbit, request,
    enterFirstPerson: () => { if (options.firstPerson) options.focus(options.firstPerson); },
    navigating: (locked) => { if (locked) { transform.pointerUp(null); transform.detach(); } else select(session?.core.selected ?? null); transform.enabled = enabled && !locked; request(); },
  });
  const onDown = (event: PointerEvent) => {
    if (!enabled || navigation.state().locked) return;
    pointers.add(event.pointerId);
    if (pointers.size !== 1) { press = null; transform.pointerUp(null); transform.enabled = false; return; }
    const bounds = canvas.getBoundingClientRect();
    // r186 pointerHover consumes normalized x/y data (including touch), before
    // Orbit's bubble listener can start a competing camera gesture.
    transform.pointerHover(new PointerEvent('pointermove', { clientX: (event.clientX - bounds.left) / bounds.width * 2 - 1, clientY: -(event.clientY - bounds.top) / bounds.height * 2 + 1, button: event.button }));
    const parts = event.altKey;
    if (parts) transform.enabled = false;
    const gizmo = !parts && selectedObject() !== undefined && currentAxis() !== null && event.button === 0;
    orbitBeforeDrag = orbit.enabled;
    if (gizmo) orbit.enabled = false;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, gizmo, moved: false, parts };
  };
  const onMove = (event: PointerEvent) => {
    if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) press.moved = true;
  };
  const onUp = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    if (pointers.size === 0 && enabled && !navigation.state().locked) transform.enabled = true;
    const click = press; if (click?.id !== event.pointerId) return;
    press = null;
    if (click.gizmo) { if (!dragging) orbit.enabled = orbitBeforeDrag; return; }
    if (!enabled || navigation.state().locked || click.moved || event.type === 'pointercancel' || event.button !== 0 || Math.hypot(event.clientX - click.x, event.clientY - click.y) > 6) return;
    const bounds = canvas.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    ray.setFromCamera(pointer, camera);
    const targets: THREE.Object3D[] = []; scene.traverseVisible((object) => { if (object instanceof THREE.Mesh) targets.push(object); });
    const hit = ray.intersectObjects(targets, false)[0];
    session?.select(selection.pick(hit?.object ?? null, click.parts || event.altKey));
  };
  const onKey = (event: KeyboardEvent) => {
    if (!enabled || navigation.state().locked || event.altKey || event.composedPath().some((target) => target instanceof Element && target.matches('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))) return;
    if (event.ctrlKey || event.metaKey) {
      if (event.code === 'KeyZ') { event.preventDefault(); if (event.shiftKey) session?.core.redo(); else session?.core.undo(); }
      return;
    }
    const mode = event.code === 'KeyW' ? 'translate' : event.code === 'KeyE' ? 'rotate' : event.code === 'KeyR' ? 'scale' : null;
    if (mode) { event.preventDefault(); session?.core.signals.transformModeChanged.dispatch(mode); }
  };
  canvas.addEventListener('pointerdown', onDown, true); canvas.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp); window.addEventListener('keydown', onKey);

  const restoreSaved = (): Promise<boolean> => {
    restoring ??= (async () => {
      const found = await store.read(sourceKey, lifetime.signal);
      if (isLifetimeAborted()) return false;
      if (!found.ok) { reportSave({ state: 'error', message: found.message }); return false; }
      if (!found.value) return false;
      reportSave({ state: 'restoring', message: 'Restoring saved edits from this browser…' });
      const parsed: (() => void)[] = [];
      try {
        const result = await autosave.restore(found.value, { signal: lifetime.signal, parseAsset: async (bytes) => {
          const model = await parseValidatedLocalModel(bytes); selection.imported(model.root);
          parsed.push(model.release); return model.root;
        } });
        if (isLifetimeAborted()) { parsed.forEach((release) => { release(); }); return false; }
        parsed.forEach((release) => { releaseImports.add(release); });
        initialVisibility = result.visibility; visibility = new Map(initialVisibility); policy.setVisibility(visibility);
        importedBytes = result.assets.bytes; importedTriangles = result.assets.triangles; importedPixels = result.assets.texturePixels;
        options.changed({ kind: 'structure', action: 'transaction', object: scene });
        reportSave({ state: 'saved', message: 'Saved edits restored in this browser.' }); request(); return true;
      } catch {
        parsed.forEach((release) => { release(); });
        if (!isLifetimeAborted()) reportSave({ state: 'error', message: 'Saved edits could not be restored. The original room is unchanged.' });
        return false;
      }
    })();
    return restoring;
  };
  const beforeUnload = (event: BeforeUnloadEvent) => { if (dragging || revision > savedRevision) { event.preventDefault(); } };
  window.addEventListener('beforeunload', beforeUnload);

  const bridge: RoomSceneEditor['bridge'] = {
    three: options.three, scene, camera, onMutation: changed,
    onSelectionChange: select, onHistoryChange: () => { refreshHistory(); if (session) scheduleSave(); },
    capabilities: {
      setTransformMode: (mode) => { transform.setMode(mode); request(); },
      cloneObject: (object) => { const copy = clone(object); autosave.registerClone(object, copy); return copy; },
      focusObject: (object) => {
        if (!selectable(object)) return;
        const bounds = new THREE.Box3().setFromObject(object), center = bounds.isEmpty() ? object.getWorldPosition(new THREE.Vector3()) : bounds.getCenter(new THREE.Vector3());
        const radius = Math.max(0.08, bounds.isEmpty() ? 0.2 : bounds.getSize(new THREE.Vector3()).length() / 2);
        const direction = camera.position.clone().sub(orbit.target).normalize();
        const at = center.clone().addScaledVector(direction, radius / Math.sin(THREE.MathUtils.degToRad(camera.getEffectiveFOV()) / 2) * 1.4);
        options.focus({ position: [at.x, at.y, at.z], target: [center.x, center.y, center.z] });
      },
      resetScene: () => {
        if (!session) return Promise.reject(new Error('Editor is not connected.'));
        mutationGeneration++;
        transform.pointerUp(null); transform.detach(); session.select(null);
        const before = captureScene(scene);
        const command = session.executeTransaction('Reset room', { execute: () => { restoreScene(baseline); }, undo: () => { restoreScene(before); } });
        resets.add(command); refreshHistory();
        return Promise.resolve();
      },
      importGlb: async ({ file, replace, signal }) => {
        const generation = mutationGeneration;
        const aborted = () => signal.aborted;
        if (!session || isDisposed() || aborted()) throw new DOMException('Import cancelled.', 'AbortError');
        if (file.size > 20 * 1024 * 1024) throw new Error('Local model: use a GLB no larger than 20 MiB.');
        const buffer = await file.arrayBuffer(), info = validateLocalGlb(buffer);
        if (importedBytes + buffer.byteLength > 40 * 1024 * 1024 || importedTriangles + info.triangles > 1_000_000 || importedPixels + info.texturePixels > 8_000_000) throw new Error('Local model: session resource budget reached. Reload to start a fresh editing session.');
        if (aborted()) throw new DOMException('Import cancelled.', 'AbortError');
        const { root: imported, release } = await parseValidatedLocalModel(buffer);
        if (isDisposed() || aborted() || generation !== mutationGeneration || (replace && !selectable(replace))) { release(); throw new DOMException('Import cancelled.', 'AbortError'); }
        selection.imported(imported);
        imported.name = file.name.replace(/\.glb$/i, '').slice(0, 100) || 'Local model';
        if (replace) { imported.position.copy(replace.position); imported.rotation.copy(replace.rotation); imported.scale.copy(replace.scale); imported.visible = replace.visible; imported.updateMatrix(); }
        autosave.registerImportedAsset({ id: `asset-${THREE.MathUtils.generateUUID()}`, bytes: buffer, root: imported });
        try { session.addObject(imported, replace ? { replace } : {}); }
        catch (error: unknown) { release(); throw error; }
        releaseImports.add(release);
        importedBytes += buffer.byteLength; importedTriangles += info.triangles; importedPixels += info.texturePixels;
      },
    },
  };
  return {
    bridge,
    connect(value) {
      if (session && session !== value) throw new Error('The local editor History must survive panel toggles.');
      if (value.core.scene !== scene || value.core.camera !== camera) throw new Error('Editor scene/camera identity mismatch.');
      session = value; refreshHistory(); select(value.core.selected);
    },
    setEnabled(value) {
      if (disposed) return;
      if (!value) transform.pointerUp(null);
      enabled = value; transform.enabled = value;
      navigation.setEnabled(value);
      if (value) { orbit.enableDamping = true; select(session?.core.selected ?? null); }
      else { transform.detach(); press = null; pointers.clear(); }
      request();
    },
    renderHelpers() {
      if (!enabled || disposed || !selectedObject()) return;
      const clear = renderer.autoClear;
      try { renderer.autoClear = false; renderer.clearDepth(); renderer.render(helpers, camera); }
      finally { renderer.autoClear = clear; }
    },
    navigation: () => navigation.state(), onNavigation: (listener) => navigation.subscribe(listener), setNavigationMode: (mode) => { navigation.setMode(mode); },
    startNavigation: () => { navigation.startLook(); }, usesFirstPerson: () => navigation.firstPerson(), updateNavigation: (time) => navigation.update(time),
    save,
    onSave(listener) { saveListeners.add(listener); listener(saveStatus); return () => { saveListeners.delete(listener); }; },
    restoreSaved,
    hidden: (object) => policy.hidden(object), preserveShell: (object) => policy.preserve(object),
    dispose() {
      if (disposed) return;
      transform.pointerUp(null); disposed = true; enabled = false;
      lifetime.abort(); navigation.dispose();
      if (saveTimer) window.clearTimeout(saveTimer);
      window.removeEventListener('beforeunload', beforeUnload); saveListeners.clear();
      canvas.removeEventListener('pointerdown', onDown, true); canvas.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); window.removeEventListener('keydown', onKey);
      transform.removeEventListener('change', onChange); transform.removeEventListener('objectChange', onObjectChange);
      transform.removeEventListener('mouseDown', onDragStart); transform.removeEventListener('mouseUp', onDragEnd);
      transform.dispose(); helpers.clear(); releaseImports.forEach((release) => { release(); }); releaseImports.clear();
    },
  };
}
