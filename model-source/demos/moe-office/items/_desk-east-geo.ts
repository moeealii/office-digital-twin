import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Geometry/texture helpers for the desk-east item (east desk, Think chair, tufted loveseat). */

export type V3 = [number, number, number];
export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const ease = (t: number) => t * t * (3 - 2 * t);
export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
export const smooth = (a: number, b: number, t: number) => ease(clamp01((t - a) / (b - a)));

export function M(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s: V3 = [1, 1, 1]) {
  return new THREE.Matrix4().compose(v3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), v3(...s));
}

/** collects geometries per material (with a transform stack) and merges them into one mesh per material */
export class Batch {
  lists = new Map<THREE.Material, THREE.BufferGeometry[]>();
  stack: THREE.Matrix4[] = [new THREE.Matrix4()];
  push(m: THREE.Matrix4) {
    this.stack.push(this.stack[this.stack.length - 1].clone().multiply(m));
  }
  pop() {
    this.stack.pop();
  }
  add(g: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4) {
    let geo = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    if (!geo.getAttribute('uv')) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.getAttribute('position').count * 2), 2));
    geo.clearGroups();
    const top = this.stack[this.stack.length - 1];
    geo = geo.applyMatrix4(m ? top.clone().multiply(m) : top);
    let list = this.lists.get(mat);
    if (!list) this.lists.set(mat, (list = []));
    list.push(geo);
  }
  build(group: THREE.Object3D, name: string, shadows = true) {
    for (const [mat, list] of this.lists) {
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = mesh.receiveShadow = shadows;
      mesh.name = `${name}:${mat.name || 'mat'}`;
      group.add(mesh);
    }
    this.lists.clear();
    return group;
  }
}

/** box-project UVs in meters (so texture repeat = tiles per meter) */
export function boxUV(g: THREE.BufferGeometry, scale = 1) {
  const geo = g.index ? g.toNonIndexed() : g;
  geo.computeVertexNormals();
  const p = geo.getAttribute('position'), n = geo.getAttribute('normal');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u: number, v: number;
    if (ax >= ay && ax >= az) [u, v] = [p.getZ(i), p.getY(i)];
    else if (ay >= az) [u, v] = [p.getX(i), p.getZ(i)];
    else [u, v] = [p.getX(i), p.getY(i)];
    uv[i * 2] = u * scale;
    uv[i * 2 + 1] = v * scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

export const rb = (w: number, h: number, d: number, r: number, seg = 3) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.max(0.0002, Math.min(r, w / 2 - 0.0002, h / 2 - 0.0002, d / 2 - 0.0002)));
export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt: number, rbot: number, h: number, seg = 24, open = false) => new THREE.CylinderGeometry(rt, rbot, h, seg, 1, open);

/** cylinder between two points */
export function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 12, r2 = r) {
  const g = cyl(r2, r, a.distanceTo(b), seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), b.clone().sub(a).normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
/** rounded box spanning a→b (long axis), width w, height h */
export function beam(a: THREE.Vector3, b: THREE.Vector3, w: number, h: number, r: number, up = v3(0, 1, 0)) {
  const g = rb(w, h, a.distanceTo(b), r, 2);
  const m = new THREE.Matrix4().lookAt(b, a, up);
  m.setPosition(a.clone().add(b).multiplyScalar(0.5));
  g.applyMatrix4(m);
  return g;
}
/** tube along a smooth curve through points */
export function tube(pts: THREE.Vector3[], r: number, seg = 32, radial = 8, closed = false, tension = 0.5) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', tension), seg, r, radial, closed);
}
export function lathe(pts: [number, number][], seg = 32) {
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

export function roundedRectShape(w: number, h: number, r: number, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4);
  s.moveTo(cx - w / 2 + r, cy - h / 2);
  s.lineTo(cx + w / 2 - r, cy - h / 2);
  s.quadraticCurveTo(cx + w / 2, cy - h / 2, cx + w / 2, cy - h / 2 + r);
  s.lineTo(cx + w / 2, cy + h / 2 - r);
  s.quadraticCurveTo(cx + w / 2, cy + h / 2, cx + w / 2 - r, cy + h / 2);
  s.lineTo(cx - w / 2 + r, cy + h / 2);
  s.quadraticCurveTo(cx - w / 2, cy + h / 2, cx - w / 2, cy + h / 2 - r);
  s.lineTo(cx - w / 2, cy - h / 2 + r);
  s.quadraticCurveTo(cx - w / 2, cy - h / 2, cx - w / 2 + r, cy - h / 2);
  return s;
}
/** rounded-rect loop points (closed, CCW) in the XY plane */
export function rrectLoop(w: number, h: number, r: number, seg = 4): THREE.Vector2[] {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4);
  const out: THREE.Vector2[] = [];
  const cs: [number, number, number][] = [
    [w / 2 - r, -h / 2 + r, -Math.PI / 2],
    [w / 2 - r, h / 2 - r, 0],
    [-w / 2 + r, h / 2 - r, Math.PI / 2],
    [-w / 2 + r, -h / 2 + r, Math.PI],
  ];
  for (const [cx, cy, a0] of cs) for (let i = 0; i <= seg; i++) {
    const a = a0 + (i / seg) * (Math.PI / 2);
    out.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return out;
}
/** extrude a shape by depth along +z, centred on z */
export function extrudeShape(s: THREE.Shape, depth: number, bevel = 0.002, curveSegments = 6) {
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(1e-4, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments });
  g.translate(0, 0, -(depth - 2 * bevel) / 2);
  return g;
}
export function extrude(pts: [number, number][], depth: number, bevel = 0.002) {
  return extrudeShape(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), depth, bevel);
}

/** parametric grid surface: f(u, v) → point, u,v in [0,1]; uv = metric if requested */
export function gridGeo(nu: number, nv: number, f: (u: number, v: number) => THREE.Vector3, flip = false, uvScale = 1) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const pts: THREE.Vector3[] = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pts.push(f(i / nu, j / nv));
  // metric UVs: arc length along u and v
  const U = new Float32Array(pts.length), V = new Float32Array(pts.length);
  for (let j = 0; j <= nv; j++) for (let i = 1; i <= nu; i++) {
    const k = j * (nu + 1) + i;
    U[k] = U[k - 1] + pts[k].distanceTo(pts[k - 1]);
  }
  for (let i = 0; i <= nu; i++) for (let j = 1; j <= nv; j++) {
    const k = j * (nu + 1) + i;
    V[k] = V[k - (nu + 1)] + pts[k].distanceTo(pts[k - (nu + 1)]);
  }
  pts.forEach((p, k) => {
    pos.push(p.x, p.y, p.z);
    uv.push(U[k] * uvScale, V[k] * uvScale);
  });
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 2, d = a + nu + 1;
    if (flip) idx.push(a, c, b, a, d, c);
    else idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** deform a geometry's positions in place */
export function deform(g: THREE.BufferGeometry, f: (p: THREE.Vector3) => void) {
  const p = g.getAttribute('position');
  const t = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    t.fromBufferAttribute(p, i);
    f(t);
    p.setXYZ(i, t.x, t.y, t.z);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------------------------
// textures

export function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true, repeat = false) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function hash(i: number, j: number) {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** tileable fine noise normal map (powder coat, plastic grain, fabric) */
export function noiseNormal(size: number, scale: number, strength: number, seed: number) {
  return canvasTex(size, size, (c, w, h) => {
    const hgt = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = 0, amp = 1, f = scale;
      for (let o = 0; o < 3; o++) {
        const p = Math.max(1, Math.round(w / f));
        const X = (x / w) * p, Y = (y / h) * p;
        const i = Math.floor(X), j = Math.floor(Y), fx = X - i, fy = Y - j;
        const hh = (a: number, b: number) => hash((((a % p) + p) % p) + seed * 17, (((b % p) + p) % p) + seed * 31);
        const u = ease(fx), vv = ease(fy);
        v += amp * ((hh(i, j) * (1 - u) + hh(i + 1, j) * u) * (1 - vv) + (hh(i, j + 1) * (1 - u) + hh(i + 1, j + 1) * u) * vv);
        amp *= 0.5;
        f *= 2.3;
      }
      hgt[y * w + x] = v;
    }
    heightToNormal(c, hgt, w, h, strength);
  }, false, true);
}

export function heightToNormal(c: CanvasRenderingContext2D, hgt: Float32Array, w: number, h: number, strength: number) {
  const img = c.createImageData(w, h);
  const H = (x: number, y: number) => hgt[((y + h) % h) * w + ((x + w) % w)];
  const n = new THREE.Vector3();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    n.set(-dx, dy, 1).normalize();
    const i = (y * w + x) * 4;
    img.data[i] = (n.x * 0.5 + 0.5) * 255;
    img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
    img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
}

const loader = new THREE.TextureLoader();
export async function loadTex(url: string, srgb = true) {
  const t = await loader.loadAsync(url);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** a sheet of paper: thin grid that drapes (sag/curl function returns y offset) */
export function sheet(w: number, d: number, lift: (x: number, z: number) => number = () => 0, nu = 8, nv = 10) {
  return gridGeo(nu, nv, (u, v) => {
    const x = (u - 0.5) * w, z = (v - 0.5) * d;
    return v3(x, lift(x, z), z);
  }, true);
}
/** planar UV 0..1 over a geometry's bounding box on axes a,b */
export function planarUV(g: THREE.BufferGeometry, a: 'x' | 'y' | 'z', b: 'x' | 'y' | 'z', flipU = false, flipV = false) {
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const p = g.getAttribute('position');
  const uv = new Float32Array(p.count * 2);
  const get = (i: number, ax: 'x' | 'y' | 'z') => (ax === 'x' ? p.getX(i) : ax === 'y' ? p.getY(i) : p.getZ(i));
  for (let i = 0; i < p.count; i++) {
    let u = (get(i, a) - bb.min[a]) / (bb.max[a] - bb.min[a] || 1);
    let v = (get(i, b) - bb.min[b]) / (bb.max[b] - bb.min[b] || 1);
    if (flipU) u = 1 - u;
    if (flipV) v = 1 - v;
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
