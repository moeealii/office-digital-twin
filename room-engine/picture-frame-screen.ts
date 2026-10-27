import * as THREE from 'three';
import type { CameraPose } from '../src/room/engine-api';
import type { FrameScreenProjection } from '../src/room/frame-screen-projection';

/** Retain the real digital display and its transform boundary through static batching. */
export function preservePictureFrameScreen(root: THREE.Object3D): void {
  const frame = root.getObjectByName('photo-frame');
  const screen = frame?.getObjectByName('frame-screen');
  if (frame && screen) {
    frame.userData['noMerge'] = true;
    screen.userData['noMerge'] = true;
  }
}

interface Display {
  frame: THREE.Object3D;
  screen: THREE.Mesh;
  bounds: THREE.Box3;
  geometry: THREE.BufferGeometry;
}
interface Options {
  root: () => THREE.Object3D;
  camera: THREE.PerspectiveCamera;
  viewport: () => { w: number; h: number };
  hidden?: (node: THREE.Object3D) => boolean;
}
const mesh = (node: THREE.Object3D): node is THREE.Mesh => 'isMesh' in node && node.isMesh === true;

/** Uses the actual west digital-frame plane, never the east wooden photograph or an anchor box. */
export function createPictureFrameScreen(options: Options) {
  const cache = new WeakMap<THREE.Object3D, Display | null>();
  const ray = new THREE.Raycaster();
  const cameraPosition = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const visible = (node: THREE.Object3D) => {
    for (let current: THREE.Object3D | null = node; current; current = current.parent) {
      if (!current.visible || options.hidden?.(current)) return false;
    }
    return true;
  };
  const belongsTo = (node: THREE.Object3D, root: THREE.Object3D) => {
    for (let current: THREE.Object3D | null = node; current; current = current.parent) if (current === root) return true;
    return false;
  };
  // Bind before editing: a duplicate with the same names must never inherit the
  // canonical display's document when its original is removed/replaced.
  const bindRoot = (root: THREE.Object3D) => {
    if (cache.has(root)) return;
    const frame = root.getObjectByName('photo-frame');
    const screen = frame?.getObjectByName('frame-screen');
    if (!frame || !screen || !mesh(screen)) { cache.set(root, null); return; }
    screen.geometry.computeBoundingBox();
    const bounds = screen.geometry.boundingBox;
    cache.set(root, bounds && !bounds.isEmpty() ? { frame, screen, geometry: screen.geometry, bounds: bounds.clone() } : null);
  };
  const display = () => {
    const root = options.root();
    bindRoot(root);
    const found = cache.get(root);
    if (!found || !belongsTo(found.frame, root) || !belongsTo(found.screen, found.frame)) return null;
    if (found.geometry !== found.screen.geometry) {
      found.screen.geometry.computeBoundingBox();
      const bounds = found.screen.geometry.boundingBox;
      if (!bounds || bounds.isEmpty()) return null;
      found.geometry = found.screen.geometry;
      found.bounds.copy(bounds);
    }
    return found;
  };
  const surface = () => {
    const found = display();
    if (!found || !visible(found.screen)) return null;
    found.screen.updateWorldMatrix(true, false);
    const { min, max } = found.bounds;
    const z = (min.z + max.z) / 2;
    const corners = [
      new THREE.Vector3(min.x, max.y, z), new THREE.Vector3(max.x, max.y, z),
      new THREE.Vector3(max.x, min.y, z), new THREE.Vector3(min.x, min.y, z),
    ] as const;
    for (const corner of corners) corner.applyMatrix4(found.screen.matrixWorld);
    const [tl, tr, br, bl] = corners;
    const center = tl.clone().add(br).multiplyScalar(0.5);
    const right = tr.clone().sub(tl), up = tl.clone().sub(bl);
    const normal = right.clone().cross(up).normalize();
    return { ...found, corners, center, normal, width: right.length(), height: up.length() };
  };
  const project = (): FrameScreenProjection | null => {
    const current = surface();
    const { camera } = options;
    const { w, h } = options.viewport();
    if (!current || w <= 0 || h <= 0) return null;
    camera.updateMatrixWorld();
    camera.getWorldPosition(cameraPosition);
    if (current.normal.dot(forward.copy(cameraPosition).sub(current.center)) <= 0) return null;
    const distance = cameraPosition.distanceTo(current.center);
    ray.set(cameraPosition, forward.copy(current.center).sub(cameraPosition).normalize());
    ray.near = camera.near;
    ray.far = Math.max(camera.near, distance - 0.0001);
    if (ray.intersectObject(options.root(), true).some((hit) => {
      if (hit.object === current.screen || !visible(hit.object)) return false;
      if (mesh(hit.object)) {
        const materials = Array.isArray(hit.object.material) ? hit.object.material : [hit.object.material];
        if (materials.every((material) => !material.visible || (material.transparent && material.opacity <= 0.02))) return false;
      }
      return hit.distance < distance - 0.0001;
    })) return null;
    for (const corner of current.corners) corner.project(camera);
    if (current.corners.some((corner) => !Number.isFinite(corner.x) || !Number.isFinite(corner.y) || corner.z < -1 || corner.z > 1)) return null;
    const toCss = (corner: THREE.Vector3) => ({ x: (corner.x * 0.5 + 0.5) * w, y: (-corner.y * 0.5 + 0.5) * h });
    const [a, b, c, d] = current.corners;
    const corners = [toCss(a), toCss(b), toCss(c), toCss(d)] as const;
    if (Math.max(...corners.map((p) => p.x)) <= 0 || Math.min(...corners.map((p) => p.x)) >= w || Math.max(...corners.map((p) => p.y)) <= 0 || Math.min(...corners.map((p) => p.y)) >= h) return null;
    return { corners, visible: true };
  };
  return {
    bindRoot,
    project,
    /** The caller must temporarily permit an orbit minDistance smaller than this pose's radius. */
    focusPose(fill = 0.82, yaw = 0): CameraPose | null {
      const current = surface();
      if (!current || fill <= 0 || fill >= 1 || !Number.isFinite(yaw) || Math.abs(yaw) > Math.PI / 4) return null;
      const tangent = Math.tan(THREE.MathUtils.degToRad(options.camera.getEffectiveFOV()) / 2);
      const distance = Math.max(current.height / (2 * tangent), current.width / (2 * tangent * options.camera.aspect)) / fill;
      const right = current.corners[1].clone().sub(current.corners[0]).normalize();
      const direction = current.normal.clone().multiplyScalar(Math.cos(yaw)).addScaledVector(right, Math.sin(yaw));
      const at = current.center.clone().addScaledVector(direction, distance);
      return { position: [at.x, at.y, at.z], target: [current.center.x, current.center.y, current.center.z] };
    },
    hit(point: { x: number; y: number }): boolean {
      const projection = project();
      if (!projection) return false;
      let sign = 0;
      for (let i = 0; i < 4; i++) {
        const a = projection.corners[i], b = projection.corners[(i + 1) % 4];
        if (!a || !b) return false;
        const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
        if (Math.abs(cross) <= 0.0001) continue;
        if (sign && Math.sign(cross) !== sign) return false;
        sign = Math.sign(cross);
      }
      return true;
    },
  };
}
