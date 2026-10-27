import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Geometry/texture helpers for the west desk (own copy, so the other workers' kits can change
 * freely). All world measurements live in desk-west.ts (header) and the _desk-west-* modules.
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

/** throw on any non-finite dimension: a NaN radius/height blacks out the whole frame */
export function fin(what: string, ...v: number[]) {
  for (const x of v) if (!Number.isFinite(x)) throw new Error();
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], name?: string) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (name) m.name = name;
  return m;
}

/** position + yaw (+ optional pitch/roll applied in XYZ order) */
export function at<T extends THREE.Object3D>(obj: T, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) {
  obj.position.set(x, y, z);
  obj.rotation.set(rx, ry, rz);
  return obj;
}

export function grp(name: string, ...children: THREE.Object3D[]) {
  const g = new THREE.Group();
  g.name = name;
  if (children.length) g.add(...children);
  return g;
}

export function rboxGeo(w: number, h: number, d: number, r: number, seg = 3) {
  fin('rbox', w, h, d, r);
  const rr = Math.max(0.0005, Math.min(r, w / 2 - 0.0005, h / 2 - 0.0005, d / 2 - 0.0005));
  return new RoundedBoxGeometry(w, h, d, seg, rr);
}

export function rbox(w: number, h: number, d: number, r: number, mat: THREE.Material | THREE.Material[], seg = 3) {
  return mesh(rboxGeo(w, h, d, r, seg), mat);
}

export function box(w: number, h: number, d: number, mat: THREE.Material | THREE.Material[]) {
  fin('box', w, h, d);
  return mesh(new THREE.BoxGeometry(w, h, d), mat);
}

export function cyl(rt: number, rb: number, h: number, mat: THREE.Material | THREE.Material[], seg = 24, open = false) {
  fin('cyl', rt, rb, h, seg);
  return mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat);
}

export function sphere(r: number, mat: THREE.Material, ws = 20, hs = 14) {
  fin('sphere', r);
  return mesh(new THREE.SphereGeometry(r, ws, hs), mat);
}

export function rod(a: V3, b: V3, r: number, mat: THREE.Material, seg = 12) {
  const A = v3(...a), B = v3(...b);
  const m = mesh(new THREE.CylinderGeometry(r, r, A.distanceTo(B), seg), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(v3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}

export function tube(pts: V3[], r: number, mat: THREE.Material, seg = 48, radial = 8, closed = false) {
  fin('tube', r, ...pts.flat());
  const curve = new THREE.CatmullRomCurve3(pts.map(p => v3(...p)), closed, 'centripetal');
  return mesh(new THREE.TubeGeometry(curve, seg, r, radial, closed), mat);
}

/** lathe from [radius, y] pairs */
export function lathe(pts: V2[], mat: THREE.Material, seg = 32) {
  fin('lathe', ...pts.flat());
  return mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat);
}

export function shapeOf(pts: V2[]) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

/** rounded-rectangle outline points (centre origin) */
export function rrectPts(w: number, h: number, r: number, seg = 6): V2[] {
  const out: V2[] = [];
  const c: V2[] = [[w / 2 - r, h / 2 - r], [-w / 2 + r, h / 2 - r], [-w / 2 + r, -h / 2 + r], [w / 2 - r, -h / 2 + r]];
  c.forEach(([cx, cy], k) => {
    for (let i = 0; i <= seg; i++) {
      const a = (k * Math.PI) / 2 + (i / seg) * (Math.PI / 2);
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  });
  return out;
}

/** extrude a 2D outline (x right, y up) by depth along +z, centred on z, with a small bevel */
export function extrude(pts: V2[] | THREE.Shape, depth: number, mat: THREE.Material | THREE.Material[], bevel = 0, curveSeg = 24, holes: V2[][] = []) {
  const s = Array.isArray(pts) ? shapeOf(pts) : pts;
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.0001, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 3, curveSegments: curveSeg,
  });
  g.translate(0, 0, -(depth - 2 * bevel) / 2);
  return mesh(g, mat);
}

/**
 * Horizontal slab from a plan outline in WORLD x/z, top face at `top`, thickness `t`, with a
 * rounded edge of radius `bevel`. Keeps the outline in x/z so measurements stay in room axes.
 * ExtrudeGeometry builds the shape in its own x/y plane and extrudes along +z; rotating that by
 * -90° about x maps shape-y to world-z with a SIGN FLIP, so the plan's z is negated here.
 */
export function planSlab(plan: V2[], top: number, t: number, bevel: number, mat: THREE.Material | THREE.Material[], curveSeg = 28) {
  let pts = plan;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    area += a[0] * -b[1] - b[0] * -a[1];
  }
  if (area < 0) pts = [...pts].reverse();
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const b = Math.min(bevel, t / 2 - 0.0004);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0005, t - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: curveSeg,
  });
  // shape lives in x/y(=z); rotate so the extrusion runs +y, then shift so the top face is at `top`
  g.rotateX(-Math.PI / 2);
  g.translate(0, top - t + b, 0);
  return mesh(g, mat);
}

/** arc points (plan) from angle a0 to a1 around (cx, cz) */
export function arcPts(cx: number, cz: number, r: number, a0: number, a1: number, seg = 10): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = a0 + ((a1 - a0) * i) / seg;
    out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return out;
}

/** quadratic bezier in plan */
export function quadPts(a: V2, c: V2, b: V2, seg = 12): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}

/** box-projected UVs in metres (so a repeat of N means N tiles per metre) */
export function boxUV(g: THREE.BufferGeometry, scale = 1) {
  const p = g.getAttribute('position'), n = g.getAttribute('normal');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u: number, v: number;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
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

const loader = new THREE.TextureLoader();
/** photo-derived texture from data/web-assets/moe-office/textures */
export async function photoTex(file: string, srgb = true) {
  const t = await loader.loadAsync('/moe-office/textures/' + file);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}
/** shared CC0 map from /textures */
export async function sharedTex(file: string, repeat: number, srgb = false) {
  const t = await loader.loadAsync('/textures/' + file);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

/** instanced copies of one mesh at a list of matrices */
export function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[], name?: string) {
  const im = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((m, i) => im.setMatrixAt(i, m));
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = true;
  im.receiveShadow = true;
  if (name) im.name = name;
  return im;
}

export function mat4(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(v3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), v3(sx, sy, sz));
}

/** Physics / knolling tags — each named placeable root becomes its own knoll piece (Wes pattern). */
export function tag<T extends THREE.Object3D>(o: T, physics: Record<string, unknown>): T {
  o.userData.physics = physics;
  return o;
}
export function phys<T extends THREE.Object3D>(obj: T, mass: number, shape?: 'box' | 'sphere' | 'cylinder' | 'hull'): T {
  obj.userData.physics = shape ? { type: 'dynamic', mass, shape } : { type: 'dynamic', mass };
  return obj;
}
export function noPhys<T extends THREE.Object3D>(obj: T): T {
  obj.userData.physics = { type: 'none' };
  return obj;
}
export function staticBody<T extends THREE.Object3D>(obj: T): T {
  return tag(obj, { type: 'static' });
}

/** a sagging cable through points (room or local coords) */
export function cable(pts: V3[], mat: THREE.Material, r = 0.0025) {
  const m = tube(pts, r, mat, Math.max(16, pts.length * 10), 6);
  m.castShadow = false;
  m.userData.physics = { type: 'none' };
  return m;
}

/** low-poly “faceted” geometry: non-indexed so every face is flat-shaded */
export function faceted(g: THREE.BufferGeometry) {
  const n = g.index ? g.toNonIndexed() : g;
  n.computeVertexNormals();
  return n;
}

/** a curved (cylindrically bent) panel in the x/y plane, +z out of the face; width x height, radius R */
export function curvedPanel(w: number, h: number, R: number, segX = 48, segY = 1) {
  const g = new THREE.PlaneGeometry(w, h, segX, segY);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const a = x / R;
    p.setXYZ(i, Math.sin(a) * R, p.getY(i), (Math.cos(a) - 1) * R);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** tapering tube through points with per-point radius */
export function taperTube(pts: V3[], radii: number[], mat: THREE.Material, seg = 40, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => v3(...p)), false, 'centripetal');
  const frames = curve.computeFrenetFrames(seg, false);
  const pos: number[] = [], idx: number[] = [], uvs: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const P = curve.getPointAt(t);
    const N = frames.normals[i], B = frames.binormals[i];
    const r = radii[Math.min(radii.length - 1, Math.round(t * (radii.length - 1)))];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const nx = Math.cos(a) * N.x + Math.sin(a) * B.x;
      const ny = Math.cos(a) * N.y + Math.sin(a) * B.y;
      const nz = Math.cos(a) * N.z + Math.sin(a) * B.z;
      pos.push(P.x + nx * r, P.y + ny * r, P.z + nz * r);
      uvs.push(j / radial, t);
      if (i < seg && j < radial) {
        const k = i * (radial + 1) + j;
        idx.push(k, k + 1, k + radial + 1, k + 1, k + radial + 2, k + radial + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return mesh(g, mat);
}
