import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Helpers, materials and printed textures for the west-desk pedestal cluster (desk-clusterb).
 *
 * Everything is created lazily from `clusterMaterials()` (called inside build) so the runtime's
 * texture preload has already run; there are no module-scope materials here.
 *
 * The five-drawer unit the cluster stands on is built by desk-west (`SIDE.drawer`: 0.42 x 0.55 x
 * 0.715 at x -0.78, z 2.36, rotated 180 deg) and its top cap reaches y = 0.732; PED_TOP is that
 * surface. Do not import from _desk-west-* (owned by another worker): the constant is duplicated.
 */
export const PED_TOP = 0.732;

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

/** position + euler (XYZ order: rx applied around x, then y, then z as three does) */
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

/** polar outline with a radius function, for scalloped / lobed shapes */
export function polarShape(rf: (a: number) => number, n = 180, inner?: (a: number) => number) {
  const pts: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = rf(a);
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const s = shapeOf(pts);
  if (inner) {
    const hp: V2[] = [];
    for (let i = 0; i < n; i++) {
      const a = -(i / n) * Math.PI * 2;
      const r = inner(a);
      hp.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    s.holes.push(new THREE.Path(hp.map(([x, y]) => new THREE.Vector2(x, y))));
  }
  return s;
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

export function std(name: string, color: THREE.ColorRepresentation, roughness = 0.6, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  m.name = name;
  return m;
}

export function physMat(name: string, color: THREE.ColorRepresentation, roughness = 0.5, extra: THREE.MeshPhysicalMaterialParameters = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness, ...extra });
  m.name = name;
  return m;
}

/** glossy vinyl / soft-touch resin */
export function vinyl(name: string, color: THREE.ColorRepresentation, roughness = 0.32) {
  return physMat(name, color, roughness, { clearcoat: 0.55, clearcoatRoughness: 0.22 });
}

// ------------------------------------------------------------------ printed artwork

/**
 * The white "WHOSON" spray can's sleeve: white stock, a grey block of small print with a barcode
 * low on the left, and the brand set vertically in heavy caps on the right (photos 90/91/200 —
 * the letterforms are legible, the small print is not).
 */
export function whoLabel() {
  return canvasTex(1024, 512, (c, w, h) => {
    c.fillStyle = '#f2f0ec';
    c.fillRect(0, 0, w, h);
    // faint printed texture: fine grey halftone + a very light vertical gradient
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.06)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    const r = rng(7);
    c.globalAlpha = 0.05;
    for (let i = 0; i < 4000; i++) {
      c.fillStyle = r() < 0.5 ? '#000' : '#fff';
      c.fillRect(r() * w, r() * h, 1, 1);
    }
    c.globalAlpha = 1;
    // the sleeve repeats its branding twice around the can, so one panel always faces the room
    for (const off of [0, 0.5]) {
      const X = (f: number) => w * (((f + off) % 1));
      // small print block, 6 ragged lines
      c.fillStyle = '#8b8b86';
      for (let i = 0; i < 6; i++) {
        c.fillRect(X(0.055), h * (0.30 + i * 0.075), w * (0.15 + (i % 3) * 0.025), h * 0.026);
      }
      // barcode block
      c.fillStyle = '#6f6f68';
      c.fillRect(X(0.085), h * 0.76, w * 0.085, h * 0.11);
      c.fillStyle = '#f2f0ec';
      for (let i = 0; i < 9; i++) c.fillRect(X(0.085) + i * w * 0.0085, h * 0.775, w * 0.004, h * 0.06);
      // a small dark rule and the volume
      c.fillStyle = '#3a3a3a';
      c.fillRect(X(0.045), h * 0.22, w * 0.28, 3);
      c.font = 'bold 18px Arial, sans-serif';
      c.fillText('400 ml', X(0.052), h * 0.20);
      // brand: heavy sans caps running up the can
      c.save();
      c.translate(X(0.62), h * 0.52);
      c.rotate(-Math.PI / 2);
      c.fillStyle = '#26262a';
      c.font = 'bold 92px Arial, Helvetica, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('WHOSON', 0, 0);
      c.restore();
    }
  });
}

/** the dark printed sleeve of the second aerosol: black field, wine-red band, a pale blue wave */
export function darkCanLabel() {
  return canvasTex(1024, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#171417');
    g.addColorStop(0.55, '#221a1e');
    g.addColorStop(1, '#141215');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // wine band under the cap (the can shows a maroon ring at the top of the print)
    c.fillStyle = '#5d1226';
    c.fillRect(0, 0, w, h * 0.10);
    // pale blue/steel wave graphic across the middle, two crests
    c.strokeStyle = 'rgba(190,205,220,0.85)';
    c.lineWidth = h * 0.028;
    c.beginPath();
    c.moveTo(w * 0.02, h * 0.52);
    c.bezierCurveTo(w * 0.12, h * 0.30, w * 0.22, h * 0.74, w * 0.33, h * 0.52);
    c.bezierCurveTo(w * 0.42, h * 0.34, w * 0.50, h * 0.70, w * 0.60, h * 0.55);
    c.stroke();
    c.strokeStyle = 'rgba(150,170,190,0.5)';
    c.lineWidth = h * 0.012;
    c.beginPath();
    c.moveTo(w * 0.02, h * 0.62);
    c.bezierCurveTo(w * 0.12, h * 0.42, w * 0.22, h * 0.84, w * 0.33, h * 0.62);
    c.stroke();
    // brand block in the pale area, small caps
    c.fillStyle = '#e8e6e2';
    c.font = 'bold 40px Arial, sans-serif';
    c.textAlign = 'center';
    c.fillText('PRO', w * 0.30, h * 0.30);
    c.font = 'bold 22px Arial, sans-serif';
    c.fillText('STYLING', w * 0.30, h * 0.38);
    // small print lines low on the sleeve
    c.fillStyle = 'rgba(230,230,230,0.55)';
    for (let i = 0; i < 4; i++) c.fillRect(w * 0.62, h * (0.62 + i * 0.06), w * (0.16 - i * 0.02), h * 0.02);
    // dark base band
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(0, h * 0.93, w, h * 0.07);
  });
}

/**
 * The green ornament's printed centre: a mottled cream ground with olive-green patches, a dark
 * blotch and a warm orange fleck — an abstract print, read off photos 90/91/92 at ~45 px, so it is
 * a reproduction of its colour field rather than of any legible artwork.
 */
export function ornamentPrint() {
  return canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#e6ddc6';
    c.fillRect(0, 0, w, h);
    const r = rng(23);
    // olive blotches
    for (let i = 0; i < 26; i++) {
      const x = r() * w, y = r() * h, rad = 20 + r() * 80;
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(48,74,52,0.85)');
      g.addColorStop(1, 'rgba(48,74,52,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, rad, 0, Math.PI * 2);
      c.fill();
    }
    // dark navy core blotch (the dark centre of the ring)
    const cx = w * 0.55, cy = h * 0.46;
    const gg = c.createRadialGradient(cx, cy, 0, cx, cy, w * 0.36);
    gg.addColorStop(0, 'rgba(20,26,24,0.95)');
    gg.addColorStop(0.7, 'rgba(26,32,28,0.75)');
    gg.addColorStop(1, 'rgba(26,32,28,0)');
    c.fillStyle = gg;
    c.beginPath();
    c.arc(cx, cy, w * 0.36, 0, Math.PI * 2);
    c.fill();
    // warm orange fleck
    c.fillStyle = 'rgba(232,106,52,0.92)';
    c.beginPath();
    c.ellipse(w * 0.34, h * 0.52, w * 0.055, h * 0.038, 0.4, 0, Math.PI * 2);
    c.fill();
    // pale highlight patch
    c.fillStyle = 'rgba(246,242,230,0.9)';
    c.beginPath();
    c.ellipse(w * 0.62, h * 0.34, w * 0.10, h * 0.07, -0.3, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(16,18,18,0.85)';
    c.beginPath();
    c.ellipse(w * 0.68, h * 0.40, w * 0.035, h * 0.045, 0.2, 0, Math.PI * 2);
    c.fill();
  });
}

/** vertical rib bump for a lotion-pump collar */
export function ribBump() {
  return bumpTex(128, 32, (c, w, h) => {
    c.fillStyle = '#808080';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 24; i++) {
      c.fillStyle = i % 2 ? '#ffffff' : '#404040';
      c.fillRect((i / 24) * w, 0, w / 48, h);
    }
  });
}
