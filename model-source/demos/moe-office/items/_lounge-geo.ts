import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mesh, type V3 } from './_moe-kit';

/**
 * Lounge geometry kit — rewrite.
 *
 * Chesterfield tufting follows the Wes Bos office-v2 pattern: an analytical height field
 * on a round-rect grid (soft rolled edge + Gaussian button wells + crease troughs between
 * neighbouring buttons). No displacement lattice on a swept shell, no photo-baked "holes
 * punched in plastic".
 */

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type P2 = [number, number];
export const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// round-rect grids (from office-v2/_lounge-geo.ts)

export function sdRoundRect(x: number, y: number, a: number, b: number, r: number) {
  const qx = Math.abs(x) - a + r, qy = Math.abs(y) - b + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

export function squareToRoundRect(sx: number, sy: number, a: number, b: number, r: number, warp = (p: number) => p): P2 {
  const rho0 = Math.max(Math.abs(sx), Math.abs(sy));
  if (rho0 < 1e-9) return [0, 0];
  const qx = (sx / rho0) * a, qy = (sy / rho0) * b;
  let px = qx, py = qy;
  const cx = a - r, cy = b - r;
  if (Math.abs(qx) > cx && Math.abs(qy) > cy) {
    const ox = Math.sign(qx) * cx, oy = Math.sign(qy) * cy;
    const dx = qx - ox, dy = qy - oy, l = Math.hypot(dx, dy) || 1;
    px = ox + (dx / l) * r;
    py = oy + (dy / l) * r;
  }
  const rho = warp(rho0);
  return [px * rho, py * rho];
}

export function squareLoop(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) out.push([i, 0]);
  for (let j = 0; j < n; j++) out.push([n, j]);
  for (let i = n; i > 0; i--) out.push([i, n]);
  for (let j = n; j > 0; j--) out.push([0, j]);
  return out;
}

export function gridFromPoints(nu: number, nv: number, pts: THREE.Vector3[], o: { uv?: 'param' | 'metric'; flip?: boolean; uvScale?: number } = {}) {
  const pos = new Float32Array(pts.length * 3);
  pts.forEach((p, k) => p.toArray(pos, k * 3));
  const uv = new Float32Array(pts.length * 2);
  const at = (i: number, j: number) => pts[j * (nu + 1) + i];
  const s = o.uvScale ?? 1;
  for (let j = 0; j <= nv; j++) {
    let acc = 0;
    for (let i = 0; i <= nu; i++) {
      if (i > 0) acc += at(i, j).distanceTo(at(i - 1, j));
      uv[(j * (nu + 1) + i) * 2] = o.uv === 'metric' ? acc * s : i / nu;
    }
  }
  for (let i = 0; i <= nu; i++) {
    let acc = 0;
    for (let j = 0; j <= nv; j++) {
      if (j > 0) acc += at(i, j).distanceTo(at(i, j - 1));
      uv[(j * (nu + 1) + i) * 2 + 1] = o.uv === 'metric' ? acc * s : j / nv;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      if (o.flip) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function loopStrip(A: THREE.Vector3[], B: THREE.Vector3[], flip = false, uvAcross = 1) {
  const n = A.length;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) pts.push(A[i % n].clone());
  for (let i = 0; i <= n; i++) pts.push(B[i % n].clone());
  const g = gridFromPoints(n, 1, pts, { uv: 'metric', flip });
  const uv = g.getAttribute('uv');
  for (let i = 0; i <= n; i++) {
    uv.setY(i, 0);
    uv.setY(n + 1 + i, uvAcross);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Wes-Bos-style tufted cushion (local XY, crown +Z, back at z=0)

export interface CushionOpts {
  a: number;
  b: number;
  r: number;
  t: number;
  seam?: number;
  roll?: number;
  n?: number;
  buttons?: P2[];
  buttonDepth?: number;
  creases?: { from: P2; to: P2; depth: number; width?: number }[];
  wrinkle?: number;
  seed?: number;
  bulge?: (x: number, y: number) => number;
  deform?: (p: THREE.Vector3) => void;
  pipingRadius?: number;
}

export interface CushionGeo {
  top: THREE.BufferGeometry;
  shell: THREE.BufferGeometry;
  piping: THREE.BufferGeometry;
  buttons: THREE.BufferGeometry[];
  seamLoop: THREE.Vector3[];
}

/** Diamond button lattice + crease troughs between neighbours. */
export function diamondTuftLayout(w: number, h: number, p = 0.133, q = 0.100, edge = 0.055) {
  const buttons: P2[] = [];
  const jmax = Math.ceil((h / 2) / q) + 1;
  for (let j = -jmax; j <= jmax; j++) {
    const off = (((j % 2) + 2) % 2) * 0.5 * p;
    const v = j * q;
    if (Math.abs(v) > h / 2 - edge) continue;
    for (let i = -Math.ceil(w / p) - 1; i <= Math.ceil(w / p) + 1; i++) {
      const u = i * p + off;
      if (Math.abs(u) > w / 2 - edge) continue;
      buttons.push([u, v]);
    }
  }
  const creases: { from: P2; to: P2; depth: number; width?: number }[] = [];
  const key = (a: P2, b: P2) => {
    const A = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? a : b;
    const B = A === a ? b : a;
    return `${A[0].toFixed(4)},${A[1].toFixed(4)}>${B[0].toFixed(4)},${B[1].toFixed(4)}`;
  };
  const seen = new Set<string>();
  const dirs: P2[] = [[p / 2, q], [-p / 2, q], [p / 2, -q], [-p / 2, -q]];
  for (const bt of buttons) {
    for (const [dx, dy] of dirs) {
      const to: P2 = [bt[0] + dx, bt[1] + dy];
      if (Math.abs(to[0]) > w / 2 - edge * 0.5 || Math.abs(to[1]) > h / 2 - edge * 0.5) continue;
      // only keep if a button (approx) sits at the far end
      const hit = buttons.some((b) => Math.hypot(b[0] - to[0], b[1] - to[1]) < 0.012);
      if (!hit) continue;
      const k = key(bt, to);
      if (seen.has(k)) continue;
      seen.add(k);
      creases.push({ from: bt, to, depth: 0.014, width: 0.020 });
    }
  }
  return { buttons, creases };
}

/** Cushion lying in local XY, crown toward +z, back plane at z = 0. */
export function tuftedCushion(o: CushionOpts): CushionGeo {
  const n = o.n ?? 80;
  const seam = o.seam ?? o.t * 0.28;
  const roll = o.roll ?? Math.min(o.t * 1.15, Math.min(o.a, o.b) * 0.45);
  const rnd = mulberry32(o.seed ?? 7);
  const waves = Array.from({ length: 8 }, () => {
    const ang = rnd() * Math.PI;
    const k = 55 + rnd() * 140;
    return { dx: Math.cos(ang) * k, dy: Math.sin(ang) * k, ph: rnd() * 6.28, amp: (0.3 + rnd() * 0.5) * (o.wrinkle ?? 0.0014) * 0.18 };
  });
  const warp = (p: number) => 1 - Math.pow(1 - p, 1.55);
  const height = (x: number, y: number) => {
    const d = Math.max(0, -sdRoundRect(x, y, o.a, o.b, o.r));
    const k = Math.min(d / roll, 1);
    const rollF = Math.sqrt(Math.max(0, 1 - (1 - k) * (1 - k)));
    let z = seam + (o.t - seam) * rollF * (o.bulge ? o.bulge(x, y) : 1);
    const inner = Math.min(1, d / (roll * 1.4));
    for (const bt of o.buttons ?? []) {
      const dd = Math.hypot(x - bt[0], y - bt[1]);
      // wide soft wells — narrow deep Gaussians facet the crater walls in comps
      z -= (o.buttonDepth ?? o.t * 0.42) * (
        0.70 * Math.exp(-((dd / 0.055) ** 2)) +
        0.30 * Math.exp(-((dd / 0.022) ** 2))
      );
    }
    for (const c of o.creases ?? []) {
      const ax = c.to[0] - c.from[0], ay = c.to[1] - c.from[1];
      const L2 = ax * ax + ay * ay || 1;
      const s = Math.min(1, Math.max(0, ((x - c.from[0]) * ax + (y - c.from[1]) * ay) / L2));
      const dd = Math.hypot(x - c.from[0] - ax * s, y - c.from[1] - ay * s);
      const w = c.width ?? 0.012;
      z -= c.depth * Math.exp(-((dd / w) ** 2)) * (1 - 0.55 * s) * (0.25 + 0.75 * inner);
    }
    let wr = 0;
    for (const w of waves) wr += Math.sin(x * w.dx + y * w.dy + w.ph) * w.amp;
    z += wr * (0.2 + 0.8 * inner);
    return Math.max(0.002, z);
  };
  const top: THREE.Vector3[] = [];
  const back: THREE.Vector3[] = [];
  for (let j = 0; j <= n; j++)
    for (let i = 0; i <= n; i++) {
      const [x, y] = squareToRoundRect(-1 + (2 * i) / n, -1 + (2 * j) / n, o.a, o.b, o.r, warp);
      top.push(vec(x, y, height(x, y)));
      back.push(vec(x * 0.988, y * 0.988, 0));
    }
  const loop = squareLoop(n);
  const seamLoop = loop.map(([i, j]) => top[j * (n + 1) + i].clone());
  const backLoop = loop.map(([i, j]) => back[j * (n + 1) + i].clone());
  const all = [...top, ...back, ...seamLoop, ...backLoop];
  if (o.deform) all.forEach((p) => o.deform!(p));
  const topG = gridFromPoints(n, n, top, { uv: 'metric' });
  const backG = gridFromPoints(n, n, back, { uv: 'metric', flip: true });
  const side = loopStrip(backLoop, seamLoop, false, 0.04);
  const shell = mergeGeometries([topG, backG, side], false)!;
  const pr = o.pipingRadius ?? 0.004;
  const piping = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(seamLoop, true, 'catmullrom', 0.2),
    loop.length, pr, 6, true,
  );
  const btns: THREE.BufferGeometry[] = [];
  for (const bt of o.buttons ?? []) {
    const z = height(bt[0], bt[1]);
    const g = new THREE.SphereGeometry(0.009, 12, 8);
    g.scale(1, 1, 0.55);
    const p = vec(bt[0], bt[1], z + 0.0015);
    const p2 = vec(bt[0], bt[1], z + 0.012);
    o.deform?.(p);
    o.deform?.(p2);
    g.lookAt(p2.clone().sub(p));
    g.translate(p.x, p.y, p.z);
    btns.push(g);
  }
  return { top: topG, shell, piping, buttons: btns, seamLoop };
}

// ---------------------------------------------------------------------------
// retained helpers used by other lounge modules

export function pipingPath(pts: V3[], tubeR: number, mat: THREE.Material, closed = true, seg?: number) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed, 'centripetal');
  const len = curve.getLength();
  return mesh(new THREE.TubeGeometry(curve, seg ?? Math.max(16, Math.round(len * 22)), tubeR, 7, closed), mat);
}

export function pipingRect(w: number, h: number, r: number, tubeR: number, mat: THREE.Material) {
  const pts = roundedRectPts(w, h, r, 8).map((p) => new THREE.Vector3(p.x, p.y, 0));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  return mesh(new THREE.TubeGeometry(curve, Math.max(48, Math.round((w + h) * 26)), tubeR, 7, true), mat);
}

export function roundedRectPts(w: number, h: number, r: number, n = 5) {
  const pts: THREE.Vector2[] = [];
  const hw = w / 2 - r, hh = h / 2 - r;
  const corners: [number, number, number][] = [
    [hw, hh, 0], [-hw, hh, Math.PI / 2], [-hw, -hh, Math.PI], [hw, -hh, Math.PI * 1.5],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let k = 0; k <= n; k++) {
      const a = a0 + (k / n) * (Math.PI / 2);
      pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  }
  return pts;
}

export function boxCushion(w: number, d: number, h: number, mat: THREE.Material, o: {
  r?: number; dome?: number; sag?: number; seed?: number; wrinkle?: number; flatten?: number;
  segs?: number;
} = {}) {
  const r = o.r ?? 0.045;
  const g = new RoundedBoxGeometry(w, h, d, o.segs ?? 14, Math.min(r, h / 2 - 0.004, d / 2 - 0.004, w / 2 - 0.004));
  const pos = g.getAttribute('position');
  const rnd = mulberry32(o.seed ?? 3);
  const phase = rnd() * 6;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const tx = x / (w / 2), ty = y / (h / 2), tz = z / (d / 2);
    const topW = smoothstep(0.15, 1, ty);
    const front = smoothstep(-0.1, 1, tz);
    const dome = (o.dome ?? 0.012) * topW * (1 - 0.35 * tx * tx) * (1 - 0.8 * front);
    let yy = y + dome;
    const sag = o.sag ?? 0;
    if (sag) yy -= sag * front * front * (1 - Math.abs(tx) * 0.35);
    const flat = o.flatten ?? 0;
    if (flat) yy -= flat * front * front * topW;
    const wr = o.wrinkle ?? 0;
    if (wr && ty > 0.2) {
      yy += wr * Math.sin(x * 9.5 + phase) * Math.cos(z * 7.3 + phase * 1.7) * (ty - 0.2) / 0.8;
    }
    pos.setY(i, yy);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return mesh(g, mat);
}

export function clothSurface(ns: number, nt: number, fn: (s: number, t: number) => THREE.Vector3, thick = 0.004) {
  const g = new THREE.PlaneGeometry(1, 1, ns, nt);
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const s = uv.getX(i), t = uv.getY(i);
    v.copy(fn(s, t));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  void thick;
  return g;
}

export function lathe(profile: [number, number][], mat: THREE.Material, seg = 32) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y));
  return mesh(new THREE.LatheGeometry(pts, seg), mat);
}

export function slabGeo(w: number, d: number, t: number, bevel = 0.006, r = 0.03) {
  const s = new THREE.Shape();
  const hw = w / 2, hd = d / 2;
  s.moveTo(-hw + r, -hd);
  s.lineTo(hw - r, -hd); s.quadraticCurveTo(hw, -hd, hw, -hd + r);
  s.lineTo(hw, hd - r); s.quadraticCurveTo(hw, hd, hw - r, hd);
  s.lineTo(-hw + r, hd); s.quadraticCurveTo(-hw, hd, -hw, hd - r);
  s.lineTo(-hw, -hd + r); s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: t - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return g;
}

export function piecedArm(w: number, y0: number, y1: number, r = 0.02, len = 0.78, bevel = 0.016, rt = 0.055) {
  const s = new THREE.Shape();
  const hw = w / 2;
  const top = y1 - rt;
  s.moveTo(-hw + r, y0);
  s.lineTo(hw - r, y0);
  s.quadraticCurveTo(hw, y0, hw, y0 + r);
  s.lineTo(hw, top);
  s.quadraticCurveTo(hw, y1, hw - rt, y1);
  s.lineTo(-hw + rt, y1);
  s.quadraticCurveTo(-hw, y1, -hw, top);
  s.lineTo(-hw, y0 + r);
  s.quadraticCurveTo(-hw, y0, -hw + r, y0);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: len - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 16, curveSegments: 48, steps: 4,
  });
  g.translate(0, 0, bevel);
  g.computeVertexNormals();
  return g;
}

export function lumpyBlob(w: number, h: number, d: number, mat: THREE.Material, seed = 5, amp = 0.02) {
  const g = new RoundedBoxGeometry(w, h, d, 22, Math.min(w, h, d) * 0.42);
  const pos = g.getAttribute('position');
  const rnd = mulberry32(seed);
  const waves = Array.from({ length: 5 }, () => ({ f: 6 + rnd() * 16, p: rnd() * 7, a: 0.5 + rnd() }));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let n = 0;
    for (const wv of waves) n += Math.sin(x * wv.f + wv.p) * Math.cos(z * wv.f * 0.8 + wv.p * 1.3) * Math.sin(y * wv.f * 0.6 + wv.p);
    n = n / waves.length;
    pos.setXYZ(i, x + n * amp * 0.8, y + n * amp, z + n * amp * 0.8);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return mesh(g, mat);
}

/** Remap shell UVs to a rectified wall-plane photo: U = z along sofa, V = y up. */
export function applyRectifyUV(
  geo: THREE.BufferGeometry,
  o: { z0: number; z1: number; y0: number; y1: number; zOff?: number; yOff?: number; flipU?: boolean },
) {
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  const zOff = o.zOff ?? 0;
  const yOff = o.yOff ?? 0;
  const dz = o.z1 - o.z0 || 1;
  const dy = o.y1 - o.y0 || 1;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getX(i) + zOff;
    const y = pos.getY(i) + yOff;
    let u = (z - o.z0) / dz;
    if (o.flipU) u = 1 - u;
    uv.setXY(i, u, (y - o.y0) / dy);
  }
  uv.needsUpdate = true;
}
