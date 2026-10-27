import type { Camera, Euler, Object3D, Scene, Vector3 } from 'three';
import type {
  SceneEditorCommand,
  SceneEditorConfig,
  SceneEditorCore,
  SceneEditorThree,
} from '../../src/scene-editor/contracts';

interface NativePanel {
  readonly dom: HTMLElement;
  add(...children: NativePanel[]): NativePanel;
  setId(id: string): NativePanel;
  setClass(name: string): NativePanel;
  setTextContent(text: string): NativePanel;
}

type Listen = (target: EventTarget, type: string, listener: EventListener) => void;

interface NativeModules {
  readonly Editor: new (
    scene: Scene, camera: Camera, config: SceneEditorConfig, storage: { clear(): void },
  ) => SceneEditorCore;
  readonly SidebarScene: (editor: SceneEditorCore) => NativePanel;
  readonly SidebarObject: (editor: SceneEditorCore) => NativePanel;
  readonly Toolbar: (editor: SceneEditorCore) => NativePanel;
  readonly MenubarEdit: (editor: SceneEditorCore) => NativePanel;
  readonly UIPanel: new () => NativePanel;
  readonly UIRow: new () => NativePanel;
  readonly UIButton: new (label?: string) => NativePanel;
  readonly SetPositionCommand: new (
    editor: SceneEditorCore, object: Object3D, value: Vector3, previous?: Vector3,
  ) => SceneEditorCommand;
  readonly SetRotationCommand: new (
    editor: SceneEditorCore, object: Object3D, value: Euler, previous?: Euler,
  ) => SceneEditorCommand;
  readonly SetScaleCommand: new (
    editor: SceneEditorCore, object: Object3D, value: Vector3, previous?: Vector3,
  ) => SceneEditorCommand;
  readonly AddObjectCommand: new (
    editor: SceneEditorCore, object: Object3D, parent: Object3D, index: number,
  ) => SceneEditorCommand;
  readonly RemoveObjectCommand: new (editor: SceneEditorCore, object: Object3D) => SceneEditorCommand;
  readonly HostTransactionCommand: new (
    editor: SceneEditorCore, name: string, operation: { execute(): void; undo(): void },
  ) => SceneEditorCommand;
  readonly MultiCmdsCommand: new (
    editor: SceneEditorCore, commands: SceneEditorCommand[],
  ) => SceneEditorCommand;
}

export const editorCss: string;
export function createNativeEditor(
  three: SceneEditorThree,
  listen: Listen,
  unlisten: Listen,
  cloneObject: (object: Object3D) => Object3D,
  releaseTree: (node: Node) => void,
): NativeModules;
