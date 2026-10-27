import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rng } from './_moe-kit';

/**
 * Geometry kit for the bouclé corner.
 *
 * Plan convention: arrays are [x, z] in room metres, and every solid is built from a plan outline by
 * `slabFrom` — the shape is laid out with y = −z and the extrusion is rotated −90° about X, which
 * maps shape (x, y, extrude) → room (x, extrude, z) with no mirror. (Extruding a plan shape with
 * +z as the plan's second axis mirrors the result behind the camera.)
 */
export type P2 = [number, number];

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** closed or open Catmull-Rom through plan points */
export function spline(pts: P2[], samples: number, closed = true): P2[] {
  const n = pts.length;
  const out: P2[] = [];
  const get = (i: number) => pts[closed ? ((i % n) + n) % n : Math.min(n - 1, Math.max(0, i))];
  const segs = closed ? n : n - 1;
  for (let s = 0; s < samples; s++) {
    const u = (s / samples) * segs;
    const i = Math.floor(u);
    const t = u - i;
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const t2 = t * t, t3 = t2 * t;
    const f = (a: number, b: number, c: number, d: number) =>
      0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}

export function signedArea(pts: P2[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** offset a closed polygon inward (d > 0) along vertex normals */
export function offsetPoly(pts: P2[], d: number): P2[] {
  const ccw = signedArea(pts) > 0;
  const out: P2[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
    const t1: P2 = [b[0] - a[0], b[1] - a[1]];
    const t2: P2 = [c[0] - b[0], c[1] - b[1]];
    const l1 = Math.hypot(t1[0], t1[1]) || 1, l2 = Math.hypot(t2[0], t2[1]) || 1;
    const n1: P2 = [t1[1] / l1, -t1[0] / l1];
    const n2: P2 = [t2[1] / l2, -t2[0] / l2];
    let nx = n1[0] + n2[0], ny = n1[1] + n2[1];
    const ln = Math.hypot(nx, ny) || 1;
    nx /= ln;
    ny /= ln;
    const sign = ccw ? 1 : -1;
    out.push([b[0] + nx * d * sign, b[1] + ny * d * sign]);
  }
  return out;
}

/** keep the half plane  nx*x + nz*z <= c */
export function clipHalf(pts: P2[], nx: number, nz: number, c: number): P2[] {
  const out: P2[] = [];
  const f = (p: P2) => nx * p[0] + nz * p[1] - c;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const fa = f(a), fb = f(b);
    if (fa <= 0) out.push(a);
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

export function shapeFrom(pts: P2[]) {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], -pts[0][1]);
  for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], -pts[i][1]);
  sh.closePath();
  return sh;
}

export interface SlabOpts {
  bevel?: number;
  bevelThick?: number;
  bevelSeg?: number;
}

/** plan outline → rounded slab from y0 to y1 (bevel rounds the top and bottom edges) */
export function slabFrom(pts: P2[], y0: number, y1: number, o: SlabOpts = {}) {
  const bevel = o.bevel ?? 0.04;
  const bt = o.bevelThick ?? Math.min(bevel, (y1 - y0) * 0.45);
  const depth = Math.max(0.002, y1 - y0 - 2 * bt);
  const g = new THREE.ExtrudeGeometry(shapeFrom(pts), {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bt,
    bevelSize: bevel,
    // high bevel segments kill the "low-poly crap" silhouette on seat/base edges
    bevelSegments: o.bevelSeg ?? 12,
    curveSegments: 1,
    steps: 1,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0 + bt, 0);
  g.computeVertexNormals();
  return g;
}

export interface SpinePt {
  x: number;
  z: number;
  /** section top */
  top: number;
  /** section bottom */
  bot: number;
  /** half width */
  hw: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Soft back/arm roll with analytic section normals.
 *
 * Prior dense loft + computeVertexNormals left polygon rings in close-ups no matter
 * how high radial/rows went. Each vertex normal here comes from the elliptical
 * section (∂r/∂θ) in the Frenet frame, so shading stays smooth at modest tessellation.
 * Mild low-frequency radius noise keeps it from reading as a CAD tube.
 */
export function sweepBack(spine: SpinePt[], radial = 48, p = 1.0, capRad = 0.11, rows = 160, capRows = 12) {
  const dense = spline(spine.map(s => [s.x, s.z] as P2), Math.max(48, rows), false);
  const N = dense.length - 1;
  const param = (t: number) => {
    const su = Math.min(1, Math.max(0, t)) * (spine.length - 1);
    const si = Math.min(spine.length - 2, Math.floor(su));
    const st = su - si;
    return {
      top: lerp(spine[si].top, spine[si + 1].top, st),
      bot: lerp(spine[si].bot, spine[si + 1].bot, st),
      hw: lerp(spine[si].hw, spine[si + 1].hw, st),
    };
  };
  let total = 0;
  const arcs: number[] = [0];
  for (let i = 1; i <= N; i++) {
    total += Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
    arcs.push(total);
  }
  const tanAt = (i: number): [number, number] => {
    const a = dense[Math.max(0, i - 1)], b = dense[Math.min(N, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    return [tx / l, tz / l];
  };
  type Row = {
    x: number; z: number; y: number; hw: number; hh: number;
    tx: number; tz: number; nx: number; nz: number; u: number;
  };
  const rowsOut: Row[] = [];
  for (let i = 0; i <= N; i++) {
    const pr = param(i / N);
    const [tx, tz] = tanAt(i);
    const hh = Math.max(0.001, (pr.top - pr.bot) / 2);
    rowsOut.push({
      x: dense[i][0], z: dense[i][1], y: (pr.top + pr.bot) / 2,
      hw: Math.max(0.001, pr.hw), hh,
      tx, tz, nx: -tz, nz: tx, u: arcs[i],
    });
  }
  const prepend: Row[] = [];
  const append: Row[] = [];
  for (let k = 1; k <= capRows; k++) {
    const phi = (k / capRows) * (Math.PI / 2);
    const s = Math.cos(phi);
    const off = Math.sin(phi) * capRad;
    const a = rowsOut[0], b = rowsOut[rowsOut.length - 1];
    prepend.unshift({
      ...a, x: a.x - a.tx * off, z: a.z - a.tz * off,
      hw: a.hw * s, hh: a.hh * (0.55 + 0.45 * s), u: a.u - off,
    });
    append.push({
      ...b, x: b.x + b.tx * off, z: b.z + b.tz * off,
      hw: b.hw * s, hh: b.hh * (0.55 + 0.45 * s), u: b.u + off,
    });
  }
  const all = [...prepend, ...rowsOut, ...append];
  const sgn = (v: number) => (v < 0 ? -1 : 1);
  const pos: number[] = [], nor: number[] = [], uv: number[] = [];
  const pExp = p;
  for (const r of all) {
    const wob = 1 + 0.018 * Math.sin(r.u * 7.3) * Math.cos(r.u * 3.1);
    const hw = r.hw * wob;
    const hh = r.hh * (1 + 0.012 * Math.sin(r.u * 5.1 + 1.2));
    const perim = 2 * Math.PI * Math.sqrt((hw * hw + hh * hh) / 2);
    for (let j = 0; j <= radial; j++) {
      const ang = (j / radial) * Math.PI * 2;
      const co = Math.cos(ang), si = Math.sin(ang);
      const lat = hw * sgn(co) * Math.abs(co) ** pExp;
      const up = hh * sgn(si) * Math.abs(si) ** pExp;
      pos.push(r.x + r.nx * lat, r.y + up, r.z + r.nz * lat);
      const nxL = (Math.abs(co) ** (2 - pExp) * sgn(co)) / hw;
      const nyL = (Math.abs(si) ** (2 - pExp) * sgn(si)) / hh;
      let nx = r.nx * nxL, ny = nyL, nz = r.nz * nxL;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nor.push(nx / nl, ny / nl, nz / nl);
      uv.push(r.u, (j / radial) * perim);
    }
  }
  const idx: number[] = [];
  const cols = radial + 1;
  for (let i = 0; i < all.length - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export function pebbleCushion(R = 0.192, H = 0.372, seed = 5) {
  const nu = 96, nv = 56;
  const rnd = rng(seed);
  const ph = [rnd() * 6.28, rnd() * 6.28];
  const pos: number[] = [], uv: number[] = [];
  const cy = H - R;                       // sphere centre so the bottom pole sits at y = 0
  const prof = (v: number) => {
    // v: 0 = crown, 1 = gathered base
    const phi = 0.02 + v * (Math.PI - 0.02);
    const y = cy + R * Math.cos(phi);
    const pinch = Math.min(1, 0.30 + 0.70 * Math.min(1, (y + 0.02) / 0.13));
    return { rad: Math.max(0, R * Math.sin(phi)) * pinch, y };
  };
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    const p = prof(v);
    for (let i = 0; i <= nu; i++) {
      const u = (i / nu) * Math.PI * 2;
      const gather = 1 + 0.16 * Math.sin(u * 11 + ph[0]) * Math.pow(Math.max(0, 1 - v * 3), 2);
      const wrinkle = 1 + 0.010 * Math.sin(u * 7 + ph[1] + v * 6) + 0.006 * Math.sin(u * 3 - ph[1]);
      const rad = p.rad * gather * wrinkle;
      pos.push(Math.cos(u) * rad, p.y + 0.004 * Math.sin(u * 4 + v * 8), Math.sin(u) * rad);
      uv.push((u / (Math.PI * 2)) * 6.28 * R, v * H * 1.5);
    }
  }
  // close the base and the crown
  const idx: number[] = [];
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Soft square throw pillow: high-subdivision closed shell with rounded corners, rolled rim,
 * soft crown and centre sag. Lying in the XY plane, thickness along Z, centre at the origin.
 */
export function puffyPillow(w: number, h: number, t: number, seed = 3) {
  const n = 96;
  const a = w / 2, b = h / 2, cornerR = Math.min(w, h) * 0.22;
  const rnd = rng(seed);
  const wv = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  /** unit square → rounded-rect plan + radial weight (0 centre → 1 rim) */
  const map = (sx: number, sy: number) => {
    const ax = Math.abs(sx), ay = Math.abs(sy);
    const rho = Math.max(ax, ay);
    if (rho < 1e-6) return { x: 0, y: 0, rho: 0 };
    // smooth rounded-rect SDF scale so corners are soft, not faceted
    const qx = ax * a, qy = ay * b;
    const cx = a - cornerR, cy = b - cornerR;
    let px = Math.sign(sx) * qx, py = Math.sign(sy) * qy;
    if (qx > cx && qy > cy) {
      const dx = qx - cx, dy = qy - cy;
      const l = Math.hypot(dx, dy) || 1;
      const rr = cornerR * (0.92 + 0.08 * Math.min(1, rho));
      px = Math.sign(sx) * (cx + (dx / l) * rr);
      py = Math.sign(sy) * (cy + (dy / l) * rr);
    }
    // pull corners in slightly so the silhouette is pillowy
    const soft = 1 - 0.04 * Math.pow(rho, 2.2);
    return { x: px * soft, y: py * soft, rho };
  };
  const halfT = t / 2;
  const dz = (rho: number, x: number, y: number) => {
    // smooth crown: fat near centre, rolls off at the rim
    const rim = Math.min(1, Math.max(0, (1 - rho) / 0.22));
    const roll = Math.sqrt(Math.max(0, 1 - Math.pow(1 - rim, 2)));
    const sag = 1 - 0.10 * (1 - rho * rho);
    const wrinkle =
      1 +
      0.012 * Math.sin(x * 28 + wv[0]) * Math.cos(y * 24 + wv[1]) +
      0.007 * Math.sin(x * 52 + y * 40 + wv[2]);
    return halfT * (0.28 + 0.72 * roll) * sag * wrinkle;
  };
  const front: number[] = [], back: number[] = [], uv: number[] = [];
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const m = map(-1 + (2 * i) / n, -1 + (2 * j) / n);
      const z = dz(m.rho, m.x, m.y);
      front.push(m.x, m.y, z);
      back.push(m.x, m.y, -z * 0.88);
      uv.push(m.x, m.y);
    }
  }
  const idx: number[] = [];
  const stride = n + 1;
  const off = stride * stride;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const p = j * stride + i, q = p + 1, s = p + stride, u2 = s + 1;
      idx.push(p, q, s, q, u2, s);
      idx.push(off + p, off + s, off + q, off + q, off + s, off + u2);
    }
  }
  // rim strip
  const loop: number[] = [];
  for (let i = 0; i < n; i++) loop.push(i);
  for (let j = 0; j < n; j++) loop.push(j * stride + n);
  for (let i = n; i > 0; i--) loop.push(n * stride + i);
  for (let j = n; j > 0; j--) loop.push(j * stride);
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i], q = loop[(i + 1) % loop.length];
    idx.push(p, off + q, q, p, off + p, off + q);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...front, ...back], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv.concat(uv), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Crumpled cloth heap — a squashed, lumpy closed blob with pinched ends, used for the white Adidas
 * drawstring bag and the folded navy shorts. Origin at its base centre.
 */
export function clothLump(w: number, h: number, d: number, seed = 11, lumps = 6, pinch = 0.55) {
  const rnd = rng(seed);
  const nu = 56, nv = 36;
  const waves = Array.from({ length: lumps }, () => ({
    a: rnd() * 6.28, f: 1.4 + rnd() * 2.4, g: 1.0 + rnd() * 2.0, ph: rnd() * 6.28, amp: 0.12 + rnd() * 0.16,
  }));
  const pos: number[] = [], uv: number[] = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    const phi = v * Math.PI;
    for (let i = 0; i <= nu; i++) {
      const th = (i / nu) * Math.PI * 2;
      const sx = Math.sin(phi) * Math.cos(th), sz = Math.sin(phi) * Math.sin(th);
      const sy = Math.cos(phi);
      let lump = 0;
      for (const wv of waves) lump += wv.amp * Math.sin(sx * wv.f + wv.ph) * Math.cos(sz * wv.g + wv.a);
      const k = 1 + lump * 0.14;
      // pinched at both ends along X, fuller at the base
      const pinchK = 1 - pinch * Math.pow(Math.abs(sx), 3);
      const flat = 0.42 + 0.58 * (1 - Math.abs(sy));
      pos.push(
        (sx * k * w) / 2,
        (sy * 0.5 + 0.5) * h * 0.86 + h * 0.07 + lump * h * 0.06,
        (sz * k * pinchK * d) / 2 * (0.8 + 0.2 * flat),
      );
      uv.push((sx * w) / 2, (sz * d) / 2);
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const p = j * (nu + 1) + i, q = p + 1, s = p + nu + 1, u2 = s + 1;
      idx.push(p, q, s, q, u2, s);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** merge a list of geometries (position/uv/normal/index) into one */
export function mergeGeos(list: THREE.BufferGeometry[]) {
  const pos: number[] = [], uv: number[] = [], nor: number[] = [];
  const idx: number[] = [];
  let base = 0;
  for (const g of list) {
    const p = g.getAttribute('position'), u = g.getAttribute('uv'), n = g.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
      if (n) nor.push(n.getX(i), n.getY(i), n.getZ(i));
    }
    const ix = g.getIndex();
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(base + ix.getX(i));
    base += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (nor.length === pos.length) g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  if (!nor.length) g.computeVertexNormals();
  return g;
}

/**
 * Soft throw pillow: high-seg sphere scaled to a plump rounded-square (no faceted box edges).
 * Origin at centre; thickness along Y — lean with rotation.x at the call site.
 */
/** @deprecated SoftBox/sphere stand-ins banned for draped props (loop12+). Prefer drapedThrow / clothLump. */
export function softPillow(w: number, h: number, d: number, seed = 3) {
  // sphere → soft square via mild L^p (p≈2.2 keeps it round, not octahedron)
  const rnd = rng(seed);
  const g = new THREE.SphereGeometry(1, 128, 96);
  const p = g.getAttribute('position');
  const ph = [rnd() * 6.28, rnd() * 6.28];
  const hw = w / 2, hh = h / 2, hd = d / 2;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const lp = 2.2;
    const q = Math.pow(Math.abs(x), lp) + Math.pow(Math.abs(y), lp) + Math.pow(Math.abs(z), lp);
    const s = q > 0 ? 1 / Math.pow(q, 1 / lp) : 1;
    x *= s * hw; y *= s * hh; z *= s * hd;
    const wr = 1 + 0.015 * Math.sin(x * 16 + ph[0]) * Math.cos(z * 14 + ph[1]);
    p.setXYZ(i, x * wr, y * (0.97 + 0.03 * wr), z * wr);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/**
 * Soft draped throw shell: plan silhouette → thick cloth pillow with sagging crown and rolled rim.
 * Origin at base centre; thickness along Y. Used for grey throws (no SoftBox / sphere).
 */
export function drapedThrow(w: number, d: number, h: number, seed = 3) {
  const rnd = rng(seed);
  const nu = 72, nv = 56;
  const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  const pos: number[] = [], uv: number[] = [];
  const hw = w / 2, hd = d / 2;
  for (let j = 0; j <= nv; j++) {
    const v = j / nv; // 0 = bottom, 1 = top
    for (let i = 0; i <= nu; i++) {
      const u = (i / nu) * Math.PI * 2;
      // rounded-rect plan that softens at the rim
      const cx = Math.cos(u), cz = Math.sin(u);
      const lp = 2.6;
      const q = Math.pow(Math.abs(cx), lp) + Math.pow(Math.abs(cz), lp);
      const s = q > 0 ? 1 / Math.pow(q, 1 / lp) : 1;
      const rim = Math.sin(v * Math.PI);
      const crown = Math.sin(v * Math.PI) * (0.72 + 0.28 * Math.sin(v * Math.PI));
      const wr =
        1 +
        0.04 * Math.sin(u * 3 + ph[0]) * rim +
        0.025 * Math.sin(u * 5 + v * 4 + ph[1]) +
        0.018 * Math.sin(u * 2 - ph[2] + v * 6);
      const rad = s * wr * (0.55 + 0.45 * rim);
      const x = cx * rad * hw;
      const z = cz * rad * hd;
      const y = v * h * (0.85 + 0.15 * crown) + 0.012 * Math.sin(u * 4 + v * 5) * rim;
      pos.push(x, y, z);
      uv.push(x, z);
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Collapsed soft backpack body: multi-lobe cloth shell with strap attach points.
 * Origin at base centre on the seat; length along +Z, width along X, height Y.
 */
export function drapedPackBody(w: number, h: number, d: number, seed = 9) {
  const rnd = rng(seed);
  const nu = 64, nv = 40;
  const waves = Array.from({ length: 7 }, () => ({
    a: rnd() * 6.28, f: 1.2 + rnd() * 2.8, g: 1.0 + rnd() * 2.2, ph: rnd() * 6.28, amp: 0.10 + rnd() * 0.18,
  }));
  const pos: number[] = [], uv: number[] = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    const phi = v * Math.PI;
    for (let i = 0; i <= nu; i++) {
      const th = (i / nu) * Math.PI * 2;
      let sx = Math.sin(phi) * Math.cos(th);
      let sy = Math.cos(phi);
      let sz = Math.sin(phi) * Math.sin(th);
      let lump = 0;
      for (const wv of waves) lump += wv.amp * Math.sin(sx * wv.f + wv.ph) * Math.cos(sz * wv.g + wv.a);
      // flattened onto the seat: squash Y, elongate Z, pinch ends
      const flat = 0.55 + 0.45 * (1 - Math.abs(sy));
      const pinch = 1 - 0.35 * Math.pow(Math.abs(sz), 2.4);
      const k = 1 + lump * 0.16;
      pos.push(
        (sx * k * pinch * w) / 2,
        (sy * 0.5 + 0.5) * h * 0.78 + h * 0.08 + lump * h * 0.05,
        (sz * k * d) / 2 * flat,
      );
      uv.push((sx * w) / 2, (sz * d) / 2);
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const p = j * (nu + 1) + i, q = p + 1, s = p + nu + 1, u2 = s + 1;
      idx.push(p, q, s, q, u2, s);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** soft rounded box: a superellipsoid-ish body with a gentle bulge on its ±z faces */
export function softBox(w: number, h: number, d: number, r: number, bulge = 0.12, seed = 7) {
  const rnd = rng(seed);
  const g = new THREE.BoxGeometry(w, h, d, 28, 22, 18);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const q = Math.pow(Math.abs(x) / (w / 2), 3.4) + Math.pow(Math.abs(y) / (h / 2), 3.4) + Math.pow(Math.abs(z) / (d / 2), 3.4);
    if (q > 0) {
      const k = 1 / Math.pow(q, 1 / 3.4);
      x *= k; y *= k; z *= k;
    }
    const bulgeAmt = bulge * (1 - Math.pow(Math.abs(y) / (h / 2), 2)) * (1 - Math.pow(Math.abs(x) / (w / 2), 2));
    z += Math.sign(z) * bulgeAmt * 0.1;
    x += (rnd() - 0.5) * 0.0012;
    y += (rnd() - 0.5) * 0.0012;
    p.setXYZ(i, x, y, z);
  }
  p.needsUpdate = true;
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  g.computeVertexNormals();
  void r;
  return g;
}
