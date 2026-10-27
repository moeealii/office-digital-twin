import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './_moe-kit';

/** Geometry helpers for the prayer station (all sizes in metres). */

export type P2 = [number, number];
export type P3 = [number, number, number];

export const vec = (p: P3) => new THREE.Vector3(p[0], p[1], p[2]);

/** cubic S-step ("cyma") from a to b with vertical tangents at both ends, appended to pts (a excluded) */
export function ogee(pts: P2[], a: P2, b: P2, n = 10, k = 0.55) {
  const dy = b[1] - a[1];
  const c1: P2 = [a[0], a[1] + dy * k];
  const c2: P2 = [b[0], b[1] - dy * k];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([
      u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0],
      u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1],
    ]);
  }
  return pts;
}

/** smooth closed or open 2D Catmull-Rom resample */
export function smooth2(pts: P2[], n: number, closed = false): P2[] {
  const c = new THREE.SplineCurve(pts.map(p => new THREE.Vector2(p[0], p[1])));
  if (closed) c.points.push(c.points[0].clone());
  const out = c.getSpacedPoints(n).map(v => [v.x, v.y] as P2);
  if (closed) out.pop();                 // last point repeats the first
  return out;
}

export function shapeFrom(pts: P2[], holes: P2[][] = []) {
  const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1]))));
  return s;
}

/** extrude a shape `depth` along +z with a small rounded bevel, keeping the faces at z = 0 and z = depth */
export function extrudeShape(shape: THREE.Shape, depth: number, bevel = 0.002, curveSegments = 24) {
  const b = Math.min(bevel, depth / 3);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * b, bevelEnabled: b > 0, bevelSize: b, bevelThickness: b, bevelSegments: 2, curveSegments,
  });
  g.translate(0, 0, b);
  return g;
}

/** offset a closed CCW polygon outward by d (miter, clamped) */
export function offsetPoly(pts: P2[], d: number): P2[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const e1 = new THREE.Vector2(p[0] - a[0], p[1] - a[1]).normalize();
    const e2 = new THREE.Vector2(b[0] - p[0], b[1] - p[1]).normalize();
    const n1 = new THREE.Vector2(e1.y, -e1.x), n2 = new THREE.Vector2(e2.y, -e2.x);
    const m = n1.add(n2);
    if (m.lengthSq() < 1e-9) return [p[0], p[1]] as P2;
    m.normalize();
    const s = Math.min(3, 1 / Math.max(0.3, m.dot(new THREE.Vector2(e2.y, -e2.x))));
    return [p[0] + m.x * d * s, p[1] + m.y * d * s] as P2;
  });
}

/**
 * Ribbon on the edge of an extruded board: for an open polyline in shape space, a strip lying on the
 * board's edge (offset `out` along the outward normal), spanning z0..z1 of the extrusion.
 * `outwardSign` = +1 when the outline runs CCW (outward normal = right of travel).
 */
export function edgeRibbon(line: P2[], z0: number, z1: number, out = 0.0006, outwardSign = 1) {
  const pos: number[] = [];
  const idx: number[] = [];
  const uv: number[] = [];
  let acc = 0;
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
    const t = new THREE.Vector2(b[0] - a[0], b[1] - a[1]).normalize();
    const nx = t.y * outwardSign, ny = -t.x * outwardSign;
    if (i > 0) acc += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    const x = line[i][0] + nx * out, y = line[i][1] + ny * out;
    pos.push(x, y, z0, x, y, z1);
    uv.push(acc, 0, acc, 1);
    if (i > 0) {
      const k = (i - 1) * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** beads along a curve, one InstancedMesh; spacing defaults to touching beads */
export function beadStrand(
  pts: P3[], radius: number, mat: THREE.Material, opts: { spacing?: number; geo?: THREE.BufferGeometry; seed?: number; jitter?: number; tension?: number } = {},
) {
  const curve = new THREE.CatmullRomCurve3(pts.map(vec), false, 'centripetal', opts.tension ?? 0.5);
  const len = curve.getLength();
  const step = opts.spacing ?? radius * 2.08;
  const n = Math.max(2, Math.floor(len / step));
  const geo = opts.geo ?? new THREE.IcosahedronGeometry(radius, 1);
  const inst = new THREE.InstancedMesh(geo, mat, n);
  const r = rng(opts.seed ?? 3);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    q.setFromUnitVectors(up, tan);
    const j = 1 + (r() - 0.5) * (opts.jitter ?? 0.08);
    s.set(j, j * 0.92, j);
    m.compose(p, q, s);
    inst.setMatrixAt(i, m);
  }
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = true;
  inst.receiveShadow = true;
  return inst;
}

/** a tasbih hung by its middle: a narrow U loop of beads with a separator bead + tassel at the bottom */
export function hangingLoop(top: P3, drop: number, spread: number, sway: P3 = [0, 0, 0], seed = 1): P3[][] {
  const r = rng(seed);
  const legs: P3[][] = [];
  for (const side of [-1, 1]) {
    const pts: P3[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const w = spread * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * (t > 0.85 ? (1 - (t - 0.85) / 0.15 * 0.85) : 1);
      pts.push([
        top[0] + sway[0] * t * t + (r() - 0.5) * 0.002,
        top[1] - drop * t,
        top[2] + side * w + sway[2] * t * t,
      ]);
    }
    legs.push(pts);
  }
  return legs;
}

/** thin fringe/tassel strands as one merged geometry of tapered cylinders along given polylines */
export function strands(lines: P3[][], radius: number, radial = 4) {
  const geos: THREE.BufferGeometry[] = [];
  for (const line of lines) {
    const c = new THREE.CatmullRomCurve3(line.map(vec));
    geos.push(new THREE.TubeGeometry(c, Math.max(2, line.length * 2), radius, radial, false));
  }
  return mergeGeometries(geos, false)!;
}

/**
 * Cloth hung over a horizontal rail. The sheet runs along `x` (x0..x1) and along its own length:
 * back drop → over the rail (radius r around (zr, yr)) → front drop. Returns a grid geometry whose
 * uv.x runs across x and uv.y runs from the front hem (0) up to the rail and down the back (1).
 * `foldAmp`/`folds` add vertical folds that grow away from the rail.
 */
export function railDrape(o: {
  x0: number; x1: number; zr: number; yr: number; r: number;
  yFront: number; yBack: number; tiltFront?: number; tiltBack?: number;
  folds?: number; foldAmp?: number; seed?: number; segX?: number; segS?: number; flare?: number;
}) {
  const segX = o.segX ?? 36, segS = o.segS ?? 60;
  const r = o.r;
  const front = o.yr - o.yFront, back = o.yr - o.yBack;
  const arc = Math.PI * r;
  const total = front + arc + back;
  const rnd = rng(o.seed ?? 1);
  const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j <= segS; j++) {
    // s measured from the front hem
    const s = (j / segS) * total;
    let y: number, z: number, nz: number, dist: number;
    if (s < front) {
      const t = 1 - s / front;
      y = o.yr - (front - s);
      z = o.zr + r + (o.tiltFront ?? 0) * t;
      nz = 1; dist = front - s;
    } else if (s < front + arc) {
      const a = (s - front) / r;                 // 0 at front, π at back
      y = o.yr + Math.sin(a) * r;
      z = o.zr + Math.cos(a) * r;
      nz = Math.cos(a); dist = 0;
    } else {
      const d = s - front - arc;
      const t = d / back;
      y = o.yr - d;
      z = o.zr - r - (o.tiltBack ?? 0) * t;
      nz = -1; dist = d;
    }
    for (let i = 0; i <= segX; i++) {
      const u = i / segX;
      const span = o.x1 - o.x0;
      const flare = (o.flare ?? 0) * Math.min(1, dist / 0.3);
      let x = o.x0 + u * span + (u - 0.5) * flare;
      const g = Math.min(1, dist / 0.25);
      const f = (o.foldAmp ?? 0) * g * (
        Math.sin(u * (o.folds ?? 3) * Math.PI * 2 + ph[0]) * 0.7
        + Math.sin(u * (o.folds ?? 3) * 1.7 * Math.PI * 2 + ph[1]) * 0.3 * Math.sin(dist * 9 + ph[2]));
      x += f * 0.15;
      pos.push(x, y, z + f * nz);
      uv.push(u, s / total);
    }
  }
  for (let j = 0; j < segS; j++) {
    for (let i = 0; i < segX; i++) {
      const a = j * (segX + 1) + i, b = a + 1, c = a + segX + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return { geo, total, front, arc, back, segX, segS };
}

/** read back a point of a railDrape grid (u across 0..1, s from the front hem 0..1) */
export function drapePoint(geo: THREE.BufferGeometry, segX: number, segS: number, u: number, s: number): P3 {
  const i = Math.round(u * segX), j = Math.round(s * segS);
  const p = geo.getAttribute('position');
  const k = j * (segX + 1) + i;
  return [p.getX(k), p.getY(k), p.getZ(k)];
}

/**
 * Crescent outline (CCW): the outer disc (centre c, radius R) minus a disc of radius r whose centre is
 * shifted by d along `dir` (a unit 2D vector). The horns point along `dir`.
 */
export function crescent(c: P2, R: number, r: number, d: number, dir: P2, n = 72): P2[] {
  const ic: P2 = [c[0] + dir[0] * d, c[1] + dir[1] * d];
  const inside = (p: P2, q: P2, rad: number) => Math.hypot(p[0] - q[0], p[1] - q[1]) < rad;
  const base = Math.atan2(dir[1], dir[0]);
  const outer: P2[] = [];
  // outer arc: walk from the horn on one side, round the back, to the other horn
  for (let i = 0; i <= n; i++) {
    const a = base + (i / n) * Math.PI * 2;
    const p: P2 = [c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R];
    if (!inside(p, ic, r)) outer.push(p);
  }
  const inner: P2[] = [];
  for (let i = n; i >= 0; i--) {
    const a = base + (i / n) * Math.PI * 2;
    const p: P2 = [ic[0] + Math.cos(a) * r, ic[1] + Math.sin(a) * r];
    if (inside(p, c, R)) inner.push(p);
  }
  // inner arc must run from the end of the outer arc back to its start
  const e = outer[outer.length - 1];
  if (inner.length && Math.hypot(inner[0][0] - e[0], inner[0][1] - e[1]) > Math.hypot(inner[inner.length - 1][0] - e[0], inner[inner.length - 1][1] - e[1])) inner.reverse();
  return [...outer, ...inner];
}
