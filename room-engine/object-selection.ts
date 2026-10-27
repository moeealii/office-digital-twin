import * as THREE from 'three';
import { belongsToScene } from './scene-edit-state';

const ROOT_TAG = 'officeEditorObjectRoot';
const COLLECTIONS = new Set(['moe-office', 'desk-west', 'desk-east', 'desk-clusterb', 'lounge', 'fireplace-wall',
  'prayer-station', 'boucle-corner', 'desk-gear', 'desk-toys-west', 'desk-side', 'sofa-clutter']);
const OBJECTS = new Set(['steelcase-leap-v2', 'mesh-chair', 'corner-desk', 'east-desk', 'alex-drawers',
  'odyssey-oled-g9', 'dell-curved', 'macbook-dock', 'photo-frame', 'east-photo-frame', 'prayer-unit',
  'tufted-sofa-body', 'tufted-loveseat', 'boucle-sectional']);
const architecture = /^(?:wall-\d+$|ceiling$|floor$|(?:window|blind|baseboard|crown|doorway|door|pot-light|outlet)(?:-|$))/;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function physical(node: THREE.Object3D): boolean {
  if (COLLECTIONS.has(node.name) || architecture.test(node.name)) return false;
  const tag: unknown = node.userData['physics'];
  if (OBJECTS.has(node.name) || (record(tag) && (tag['type'] === 'dynamic' || tag['type'] === 'static'))) return true;
  // The east display is an authored, unnamed five-mesh Group inside the desk.
  // It is a distinct object even though its assembly predates physics tagging.
  return node instanceof THREE.Group && node.name === '' && node.parent?.name === 'east-desk'
    && node.children.length === 5 && node.children.every(child => child instanceof THREE.Mesh)
    && node.children.some(child => child instanceof THREE.Mesh && (child as THREE.Mesh).geometry.type === 'PlaneGeometry');
}

/** Roles are captured before saved renames. Plain metadata survives native clones
 * and the autosave adapter's template-based restoration without changing topology. */
export function createObjectSelection(scene: THREE.Scene) {
  scene.traverse(node => {
    Reflect.deleteProperty(node.userData, ROOT_TAG);
    if (node !== scene && physical(node)) node.userData[ROOT_TAG] = true;
  });
  return {
    imported(root: THREE.Object3D): void {
      // Ignore imported extras that pretend to define the editor's own roles.
      root.traverse(node => { Reflect.deleteProperty(node.userData, ROOT_TAG); });
      root.userData[ROOT_TAG] = true;
    },
    pick(hit: THREE.Object3D | null, parts = false): THREE.Object3D | null {
      if (!hit || hit === scene || !belongsToScene(hit, scene)) return null;
      if (parts) return hit;
      for (let node: THREE.Object3D | null = hit; node && node !== scene; node = node.parent) {
        if (node.userData[ROOT_TAG] === true) return node;
      }
      // Unresolved/architectural meshes stay honest individual selections, never
      // an invented whole room or a collection of unrelated objects.
      return hit;
    },
  };
}
