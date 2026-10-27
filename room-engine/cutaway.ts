import * as THREE from 'three';
interface RoomView {
  group: THREE.Group;
  walls: { def: { origin: THREE.Vector3; u: THREE.Vector3; n: THREE.Vector3; length: number }; group: THREE.Object3D }[];
  ceiling: THREE.Object3D[];
  wallTop: number;
}

/** Keep normal/static and editable graphs under the identical visibility policy.
 * `beyond-doorway` is REAL modeled hall geometry, seen only through the opening
 * from inside. Its 3m ceiling must not become a blue box in a dollhouse view.
 * Preserve that visibility boundary before static batching, never delete it. */
export function createRoomCutaway(room: RoomView) {
  const hall = room.group.getObjectByName('beyond-doorway');
  if (hall) hall.userData['noMerge'] = true;
  const floor = room.group.getObjectByName('floor');
  const footprint = floor ? new THREE.Box3().setFromObject(floor) : null;
  const mid = new THREE.Vector3(), toCamera = new THREE.Vector3();
  return (camera: THREE.Vector3, hidden: (node: THREE.Object3D) => boolean, preserve: (node: THREE.Object3D) => boolean = () => false) => {
    for (const { def, group } of room.walls) {
      if (preserve(group)) continue;
      mid.copy(def.origin).addScaledVector(def.u, def.length / 2);
      group.visible = !hidden(group) && toCamera.copy(camera).sub(mid).dot(def.n) > 0;
    }
    for (const ceiling of room.ceiling) if (!preserve(ceiling)) ceiling.visible = !hidden(ceiling) && camera.y < room.wallTop;
    if (hall && !preserve(hall)) {
      const inside = camera.y >= 0 && camera.y < room.wallTop && footprint !== null
        && camera.x >= footprint.min.x && camera.x <= footprint.max.x
        && camera.z >= footprint.min.z && camera.z <= footprint.max.z;
      hall.visible = inside && !hidden(hall);
    }
  };
}
