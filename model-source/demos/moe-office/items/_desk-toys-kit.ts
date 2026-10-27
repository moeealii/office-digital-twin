import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Geometry, texture and material helpers for the west-desk toys (own copy so the other workers'
 * kits can change freely). Nothing here is created at module scope: every texture and material is
 * built inside a function called from build(), after the runtime's texture preload.
 */
export type V3 = [number, number, number];
export type V2 = [number, number];

export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const DEG = THREE.MathUtils.degToRad;

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], name?: string) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (name) m.name = name;
  return m;
}

export function grp(name: string, ...kids: THREE.Object3D[]) {
  const g = new THREE.Group();
  g.name = name;
  if (kids.length) g.add(...kids);
  return g;
}

/** position + euler (XYZ order) */
export function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) {
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  return o;
}

export function rboxGeo(w: number, h: number, d: number, r: number, seg = 3) {
  const rr = Math.max(0.0004, Math.min(r, w / 2 - 0.0004, h / 2 - 0.0004, d / 2 - 0.0004));
  return new RoundedBoxGeometry(w, h, d, seg, rr);
}

export function rbox(w: number, h: number, d: number, r: number, mat: THREE.Material | THREE.Material[], seg = 3) {
  return mesh(rboxGeo(w, h, d, r, seg), mat);
}

export function box(w: number, h: number, d: number, mat: THREE.Material | THREE.Material[]) {
  return mesh(new THREE.BoxGeometry(w, h, d), mat);
}

export function cyl(rt: number, rb: number, h: number, mat: THREE.Material | THREE.Material[], seg = 28, open = false, thetaLen = Math.PI * 2) {
  return mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, 0, thetaLen), mat);
}

export function sphere(r: number, mat: THREE.Material | THREE.Material[], ws = 22, hs = 16) {
  return mesh(new THREE.SphereGeometry(r, ws, hs), mat);
}

export function lathe(pts: V2[], mat: THREE.Material | THREE.Material[], seg = 40) {
  return mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat);
}

export function rod(a: V3, b: V3, r: number, mat: THREE.Material, seg = 12) {
  const A = v3(...a);
  const B = v3(...b);
  const m = mesh(new THREE.CylinderGeometry(r, r, A.distanceTo(B), seg), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(v3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}

export function tube(pts: V3[], r: number, mat: THREE.Material, seg = 40, radial = 8, closed = false) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => v3(...p)), closed, 'centripetal');
  const m = mesh(new THREE.TubeGeometry(curve, seg, r, radial, closed), mat);
  m.castShadow = false;
  m.userData.physics = { type: 'none' };
  return m;
}

export function shapeOf(pts: V2[]) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

/** extrude a 2D outline by `depth` along +z, centred, with a bevel */
export function extrude(pts: V2[] | THREE.Shape, depth: number, mat: THREE.Material | THREE.Material[], bevel = 0, curveSeg = 20, holes: V2[][] = []) {
  const s = Array.isArray(pts) ? shapeOf(pts) : pts;
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.0001, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 3, curveSegments: curveSeg,
  });
  g.translate(0, 0, -(depth - 2 * bevel) / 2);
  return mesh(g, mat);
}

export function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, repeat = 0) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d')!;
  draw(c, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  return t;
}

/** greyscale canvas texture used as a bump/roughness map (linear colour space) */
export function bumpTex(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, repeat = 1) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d')!;
  draw(c, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

const loader = new THREE.TextureLoader();
/** rectified photo crop from data/web-assets/textures/moe-office */
export async function photoTex(file: string, srgb = true) {
  const t = await loader.loadAsync('/textures/moe-office/' + file);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

export function mat4(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(v3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), v3(sx, sy, sz));
}

export function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[], name?: string) {
  const im = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((m, i) => im.setMatrixAt(i, m));
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = true;
  im.receiveShadow = true;
  if (name) im.name = name;
  return im;
}

/** standard material with a name, so a render can be debugged by object */
export function std(name: string, color: THREE.ColorRepresentation, roughness = 0.6, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  m.name = name;
  return m;
}

export function phys(name: string, color: THREE.ColorRepresentation, roughness = 0.5, extra: THREE.MeshPhysicalMaterialParameters = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness, ...extra });
  m.name = name;
  return m;
}

/** glossy vinyl / resin: the figurine and the 3d-printed toys */
export function vinyl(name: string, color: THREE.ColorRepresentation, roughness = 0.32) {
  return phys(name, color, roughness, { clearcoat: 0.55, clearcoatRoughness: 0.22 });
}
