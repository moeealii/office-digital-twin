import { createNativeEditor, editorCss } from '../../scene-editor/vendor/native-editor.js';
import type { Object3D } from 'three';
import type {
  SceneEditorBridge, SceneEditorCommand, SceneEditorSession, SceneEditorTransform,
} from './contracts';
import { createSessionConfig, EditorDomScope } from './session';

const activeScenes = new WeakSet<Object3D>();

/** Heavy, intent-only entry. Never import this module from the initial React application graph. */
export function mountSceneEditor(container: HTMLElement, bridge: SceneEditorBridge): SceneEditorSession {
  const { three, scene, camera, capabilities } = bridge;
  if (three.REVISION !== '186' || !(scene instanceof three.Scene) || !(camera instanceof three.Camera)) {
    throw new Error('Scene Editor requires the engine-owned Three r186 namespace and its actual Scene/Camera');
  }
  if (activeScenes.has(scene)) throw new Error('This scene already has a native Editor session');

  const scope = new EditorDomScope();
  const abort = new AbortController();
  const config = createSessionConfig();
  const native = createNativeEditor(three, scope.listen, scope.unlisten, object => {
    const result = capabilities?.cloneObject ? capabilities.cloneObject(object) : object.clone();
    if (!(result instanceof three.Object3D) || result === object || result.parent !== null) {
      throw new Error('cloneObject must return a detached object from the shared Three runtime');
    }
    return result;
  }, scope.releaseTree);
  const core = new native.Editor(scene, camera, config, { clear: () => { config.clear(); } });
  const element = document.createElement('div');
  element.className = 'ui-scene-editor';
  element.dataset['selection'] = 'false';
  element.dataset['objectsOpen'] = 'false';
  element.setAttribute('aria-label', 'Three.js Scene Editor');
  const shadow = element.attachShadow({ mode: 'open' });
  let alive = true;
  let importing = false;

  function assertAlive(): void {
    if (!alive) throw new Error('Scene Editor session is unmounted');
  }
  function belongs(object: Object3D): boolean {
    return object instanceof three.Object3D && scene.getObjectById(object.id) === object;
  }
  function editable(object: Object3D | null): object is Object3D {
    return object !== null && object !== scene && object !== camera && belongs(object) && object.parent !== null;
  }
  function assertEditable(object: Object3D): void {
    assertAlive();
    if (!editable(object)) throw new Error('Object is not an editable member of the engine scene');
  }
  function canClone(object: Object3D | null): boolean {
    if (!editable(object)) return false;
    const skinned: Object3D[] = [];
    object.traverse(child => { if (child instanceof three.SkinnedMesh) skinned.push(child); });
    return skinned.length === 0 || capabilities?.cloneObject !== undefined;
  }
  function button(action: string): HTMLButtonElement {
    const result = shadow.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
    if (!result) throw new Error(`Native Editor action missing: ${action}`);
    return result;
  }
  function updateActions(): void {
    element.dataset['selection'] = String(editable(core.selected));
    button('undo').disabled = core.history.undos.length === 0;
    button('redo').disabled = core.history.redos.length === 0;
    button('clone').disabled = !canClone(core.selected);
    button('delete').disabled = !editable(core.selected);
    const replace = shadow.querySelector<HTMLButtonElement>('[data-action="replace"]');
    if (replace) replace.disabled = importing || !editable(core.selected);
    const add = shadow.querySelector<HTMLButtonElement>('[data-action="import"]');
    if (add) add.disabled = importing;
  }
  function synchronizeScene(): void {
    assertAlive();
    core.history.clear();
    if (core.selected !== null && !belongs(core.selected)) core.select(null);
    core.signals.sceneGraphChanged.dispatch();
    if (core.selected) core.signals.refreshSidebarObject3D.dispatch(core.selected);
    updateActions();
  }
  function unmount(): void {
    if (!alive) return;
    alive = false;
    abort.abort();
    scope.dispose();
    for (const signal of Object.values({ ...core.signals })) signal.removeAll();
    core.history.clear();
    core.select(null);
    core.storage.clear();
    element.remove();
    activeScenes.delete(scene);
  }

  try {
    const style = document.createElement('style');
    style.textContent = editorCss;
    shadow.append(style);
    const menubar = new native.UIPanel().setId('menubar');
    const edit = native.MenubarEdit(core);
    menubar.add(edit);
    const title = edit.dom.querySelector<HTMLButtonElement>('.title');
    if (!title) throw new Error('Native Edit menu title missing');
    title.setAttribute('aria-expanded', 'false');
    scope.listen(title, 'click', () => {
      const open = edit.dom.dataset['open'] !== 'true';
      edit.dom.dataset['open'] = String(open);
      title.setAttribute('aria-expanded', String(open));
    });
    scope.listen(edit.dom, 'click', event => {
      if (event.target instanceof Element && event.target.closest('.options button')) {
        edit.dom.dataset['open'] = 'false';
        title.setAttribute('aria-expanded', 'false');
      }
    });
    shadow.append(menubar.dom);
    if (capabilities?.setTransformMode) {
      const toolbar = native.Toolbar(core);
      toolbar.dom.setAttribute('aria-label', 'Transform tools');
      menubar.add(toolbar);
      core.signals.transformModeChanged.add(capabilities.setTransformMode);
    }
    const sidebar = new native.UIPanel().setId('sidebar');
    const objects = native.SidebarScene(core).setId('object-tree');
    objects.dom.hidden = true;
    objects.dom.setAttribute('aria-label', 'Objects');
    const objectsToggle = new native.UIButton('Objects');
    objectsToggle.dom.dataset['action'] = 'objects';
    objectsToggle.dom.setAttribute('aria-controls', 'object-tree');
    objectsToggle.dom.setAttribute('aria-expanded', 'false');
    scope.listen(objectsToggle.dom, 'click', () => {
      objects.dom.hidden = !objects.dom.hidden;
      element.dataset['objectsOpen'] = String(!objects.dom.hidden);
      objectsToggle.dom.setAttribute('aria-expanded', String(!objects.dom.hidden));
    });
    menubar.add(objectsToggle);
    const inspector = native.SidebarObject(core).setId('inspector');
    inspector.dom.setAttribute('aria-label', 'Selected object');
    const deselect = new native.UIButton('×').setClass('editor-dismiss');
    deselect.dom.setAttribute('aria-label', 'Deselect object');
    scope.listen(deselect.dom, 'click', () => { core.select(null); });
    inspector.dom.prepend(deselect.dom);
    sidebar.add(objects, inspector);
    shadow.append(sidebar.dom);
    const menuOptions = edit.dom.querySelector('.options');
    if (!menuOptions) throw new Error('Native Edit menu options missing');
    if (capabilities?.focusObject) {
      scope.listen(sidebar.dom, 'dblclick', () => {
        if (editable(core.selected)) capabilities.focusObject?.(core.selected);
      });
    }

    if (capabilities?.resetScene) {
      const resetScene = capabilities.resetScene;
      const reset = new native.UIButton('Reset scene');
      const status = document.createElement('output');
      status.setAttribute('role', 'status');
      scope.listen(reset.dom, 'click', () => {
        reset.dom.setAttribute('disabled', '');
        void Promise.resolve().then(() => alive ? resetScene() : undefined).catch((error: unknown) => {
          if (alive) status.textContent = error instanceof Error ? error.message : 'Scene reset failed.';
        }).finally(() => { if (alive) reset.dom.removeAttribute('disabled'); });
      });
      reset.setClass('option');
      menuOptions.append(reset.dom);
      shadow.append(status);
    }

    if (capabilities?.importGlb) {
      const importGlb = capabilities.importGlb;
      const file = document.createElement('input');
      file.type = 'file';
      file.accept = '.glb,model/gltf-binary';
      file.hidden = true;
      const status = document.createElement('output');
      status.setAttribute('role', 'status');
      const add = new native.UIButton('Import local GLB');
      add.dom.dataset['action'] = 'import';
      const replace = new native.UIButton('Replace selected with local GLB');
      replace.dom.dataset['action'] = 'replace';
      let replacement: Object3D | null = null;
      scope.listen(add.dom, 'click', () => { replacement = null; file.value = ''; file.click(); });
      scope.listen(replace.dom, 'click', () => { replacement = core.selected; file.value = ''; file.click(); });
      scope.listen(file, 'change', () => {
        const selectedFile = file.files?.[0];
        if (!selectedFile || importing) return;
        if (!selectedFile.name.toLowerCase().endsWith('.glb')) {
          status.textContent = 'Choose a local .glb file. The engine validates it before import.';
          return;
        }
        if (replacement !== null && !editable(replacement)) {
          status.textContent = 'The replacement target is no longer in the scene.';
          return;
        }
        importing = true;
        status.textContent = 'Validating local GLB…';
        updateActions();
        // No reading, object URL, stock Loader, remote URI, upload or auto-import here.
        void Promise.resolve().then(() => {
          if (!abort.signal.aborted) return importGlb({ file: selectedFile, replace: replacement, signal: abort.signal });
          return undefined;
        }).then(() => {
          if (alive) status.textContent = 'Local GLB import complete.';
        }).catch((error: unknown) => {
          if (alive) status.textContent = error instanceof Error ? error.message : 'Local GLB import failed.';
        }).finally(() => {
          importing = false;
          if (alive) updateActions();
        });
      });
      add.setClass('option');
      replace.setClass('option');
      menuOptions.append(add.dom, replace.dom);
      shadow.append(file, status);
    }

    core.signals.objectSelected.add(object => {
      updateActions();
      bridge.onSelectionChange?.(object);
    });
    core.signals.objectChanged.add(object => {
      object.updateWorldMatrix(true, true);
      bridge.onMutation({ kind: 'object', object });
    });
    core.signals.objectAdded.add(object => {
      object.updateWorldMatrix(true, true);
      bridge.onMutation({ kind: 'structure', action: 'add', object });
    });
    core.signals.objectRemoved.add(object => {
      bridge.onMutation({ kind: 'structure', action: 'remove', object });
    });
    core.signals.historyChanged.add(() => {
      updateActions();
      bridge.onHistoryChange?.(core.history);
    });
    scope.listen(shadow, 'keydown', event => {
      if (!(event instanceof KeyboardEvent)) return;
      if (event.key === 'Escape') {
        edit.dom.dataset['open'] = 'false';
        title.setAttribute('aria-expanded', 'false');
        objects.dom.hidden = true;
        element.dataset['objectsOpen'] = 'false';
        objectsToggle.dom.setAttribute('aria-expanded', 'false');
      }
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) core.redo(); else core.undo();
      } else if (event.key === 'Delete' && editable(core.selected)) {
        event.preventDefault();
        event.stopPropagation();
        button('delete').click();
      }
    });
    updateActions();
    activeScenes.add(scene);
    container.append(element);
    capabilities?.setTransformMode?.('translate');
  } catch (error: unknown) {
    unmount();
    throw error;
  }

  return {
    core,
    history: core.history,
    element,
    select(object) {
      assertAlive();
      if (object !== null && !belongs(object)) throw new Error('Selection is outside the engine scene');
      core.select(object);
    },
    captureTransform(object) {
      assertEditable(object);
      return { position: object.position.clone(), rotation: object.rotation.clone(), scale: object.scale.clone() };
    },
    commitTransform(object: Object3D, before: SceneEditorTransform) {
      assertEditable(object);
      const commands: SceneEditorCommand[] = [];
      if (!object.position.equals(before.position)) commands.push(new native.SetPositionCommand(core, object, object.position, before.position));
      if (!object.rotation.equals(before.rotation)) commands.push(new native.SetRotationCommand(core, object, object.rotation, before.rotation));
      if (!object.scale.equals(before.scale)) commands.push(new native.SetScaleCommand(core, object, object.scale, before.scale));
      if (commands.length > 0) core.execute(new native.MultiCmdsCommand(core, commands));
    },
    notifyObjectChanged(object) {
      assertEditable(object);
      core.signals.objectChanged.dispatch(object);
    },
    addObject(object, options) {
      assertAlive();
      if (!(object instanceof three.Object3D) || object === scene || object === camera || object.parent !== null || object.getObjectById(scene.id)) {
        throw new Error('Imported object must be detached and from the shared Three runtime');
      }
      const replacement = options?.replace;
      if (replacement !== undefined) assertEditable(replacement);
      const parent = replacement?.parent ?? scene;
      const index = replacement ? parent.children.indexOf(replacement) : parent.children.length;
      const add = new native.AddObjectCommand(core, object, parent, index);
      core.execute(replacement
        ? new native.MultiCmdsCommand(core, [new native.RemoveObjectCommand(core, replacement), add])
        : add);
    },
    executeTransaction(name, operation) {
      assertAlive();
      function publish(action: () => void): void {
        action();
        if (core.selected !== null && !belongs(core.selected)) core.select(null);
        bridge.onMutation({ kind: 'structure', action: 'transaction', object: scene });
      }
      const command = new native.HostTransactionCommand(core, name, {
        execute() { publish(() => { operation.execute(); }); },
        undo() { publish(() => { operation.undo(); }); },
      });
      core.execute(command);
      return command;
    },
    synchronizeScene,
    unmount,
  };
}
