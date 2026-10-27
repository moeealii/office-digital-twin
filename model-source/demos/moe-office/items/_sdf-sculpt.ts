import * as THREE from 'three';

/**
 * SDF sculpting for hero props (vinyl figures, moulded toys).
 *
 * A figure is a list of signed-distance primitives combined with a smooth union (fillets where
 * parts meet, so a glove grows out of a forearm like moulded vinyl rather than intersecting it),
 * optional smooth subtraction, and a paint colour per primitive. `sculpt()` samples the field on a
 * grid and polygonises it with naive surface nets: one watertight, evenly-tessellated mesh, normals
 * from the field gradient, and vertex colours from whichever painted primitive is closest.
 * Watertight output is also what a 3D-printed diorama needs.
 *
 * Units are metres in the figure's own frame; keep grids to ~1.5-2.5 mm cells for desk toys.
 */

export type V3 = [number, number, number];
type Dist = (x: number, y: number, z: number) => number;

export interface Prim {
  d: Dist;
  /** paint colour; omit for a shape that only adds volume and inherits the nearest paint */
  color?: THREE.ColorRepresentation;
  /** fillet radius used when this primitive joins the shape so far (m) */
  k?: number;
  /** carve instead of add */
  sub?: boolean;
  /** paint priority: higher wins ties within `paintBias` metres (decals, gloves over arms) */
  paint?: number;
}

// ---- primitives -------------------------------------------------------------------------------

export const sphere = (c: V3, r: number): Dist => (x, y, z) => Math.hypot(x - c[0], y - c[1], z - c[2]) - r;

/** ellipsoid (IQ's bound-corrected approximation) */
export const ellipsoid = (c: V3, r: V3): Dist => (x, y, z) => {
  const px = (x - c[0]) / r[0], py = (y - c[1]) / r[1], pz = (z - c[2]) / r[2];
  const k0 = Math.hypot(px, py, pz);
  const k1 = Math.hypot(px / r[0], py / r[1], pz / r[2]);
  return k1 === 0 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1;
};

/** capsule / round cone between a (radius ra) and b (radius rb) */
export const capsule = (a: V3, b: V3, ra: number, rb = ra): Dist => {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  return (x, y, z) => {
    const pax = x - a[0], pay = y - a[1], paz = z - a[2];
    const h = Math.min(1, Math.max(0, (pax * bax + pay * bay + paz * baz) / l2));
    return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - (ra + (rb - ra) * h);
  };
};

/** a chain of round-cone segments through points with per-point radii (arms, tails, fingers) */
export const chain = (pts: V3[], radii: number[]): Dist => {
  const segs = pts.slice(1).map((p, i) => capsule(pts[i], p, radii[i], radii[i + 1]));
  return (x, y, z) => { let d = Infinity; for (const s of segs) d = Math.min(d, s(x, y, z)); return d; };
};

/** rounded box centred at c with half-size h, rotated by Euler (radians, XYZ) */
export const roundBox = (c: V3, h: V3, r: number, rot: V3 = [0, 0, 0]): Dist => {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)).invert();
  const e = m.elements;
  return (x, y, z) => {
    const px = x - c[0], py = y - c[1], pz = z - c[2];
    const lx = e[0] * px + e[4] * py + e[8] * pz, ly = e[1] * px + e[5] * py + e[9] * pz, lz = e[2] * px + e[6] * py + e[10] * pz;
    const qx = Math.abs(lx) - h[0] + r, qy = Math.abs(ly) - h[1] + r, qz = Math.abs(lz) - h[2] + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
  };
};

/** a cone with a rounded tip: apex at `tip`, base centre at `base`, base radius rb, tip radius rt */
export const spike = (base: V3, tip: V3, rb: number, rt = 0.002): Dist => capsule(base, tip, rb, rt);

/** torus of major radius R and tube radius r centred at c, its axis along local y, rotated by Euler */
export const torus = (c: V3, R: number, r: number, rot: V3 = [0, 0, 0]): Dist => {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)).invert();
  const e = m.elements;
  return (x, y, z) => {
    const px = x - c[0], py = y - c[1], pz = z - c[2];
    const lx = e[0] * px + e[4] * py + e[8] * pz, ly = e[1] * px + e[5] * py + e[9] * pz, lz = e[2] * px + e[6] * py + e[10] * pz;
    return Math.hypot(Math.hypot(lx, lz) - R, ly) - r;
  };
};

/** transform a distance function: evaluate in a frame rotated by Euler `rot` about pivot */
export const rotated = (d: Dist, pivot: V3, rot: V3): Dist => {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)).invert();
  const e = m.elements;
  return (x, y, z) => {
    const px = x - pivot[0], py = y - pivot[1], pz = z - pivot[2];
    return d(e[0] * px + e[4] * py + e[8] * pz + pivot[0], e[1] * px + e[5] * py + e[9] * pz + pivot[1], e[2] * px + e[6] * py + e[10] * pz + pivot[2]);
  };
};

const smin = (a: number, b: number, k: number) => {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

// ---- polygonise ----------------------------------------------------------------------------------

export interface SculptOpts {
  /** cell size (m) */
  cell?: number;
  /** padding around the primitive bounds (m) */
  pad?: number;
  /** explicit bounds; otherwise taken from `box` */
  box: THREE.Box3;
  /** paint priority tie window (m) */
  paintBias?: number;
}

export function sculpt(prims: Prim[], o: SculptOpts): THREE.BufferGeometry {
  const cell = o.cell ?? 0.002;
  const pad = o.pad ?? 0.004;
  const bias = o.paintBias ?? 0.0015;
  const min = o.box.min.clone().subScalar(pad);
  const size = o.box.getSize(new THREE.Vector3()).addScalar(2 * pad);
  const nx = Math.ceil(size.x / cell) + 1, ny = Math.ceil(size.y / cell) + 1, nz = Math.ceil(size.z / cell) + 1;

  const field = (x: number, y: number, z: number) => {
    let d = Infinity;
    for (const p of prims) {
      const v = p.d(x, y, z);
      d = p.sub ? smax(d, -v, p.k ?? 0) : smin(d, v, p.k ?? 0);
    }
    return d;
  };

  // sample
  const F = new Float32Array(nx * ny * nz);
  const id = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    F[id(i, j, k)] = field(min.x + i * cell, min.y + j * cell, min.z + k * cell);
  }

  // one vertex per sign-changing cell, at the mean of its edge crossings
  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cid = (i: number, j: number, k: number) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos: number[] = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let inside = 0;
    for (let c = 0; c < 8; c++) {
      v[c] = F[id(i + corner[c][0], j + corner[c][1], k + corner[c][2])];
      if (v[c] < 0) inside++;
    }
    if (inside === 0 || inside === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      sx += corner[a][0] + (corner[b][0] - corner[a][0]) * t;
      sy += corner[a][1] + (corner[b][1] - corner[a][1]) * t;
      sz += corner[a][2] + (corner[b][2] - corner[a][2]) * t;
      n++;
    }
    cellVert[cid(i, j, k)] = pos.length / 3;
    pos.push(min.x + (i + sx / n) * cell, min.y + (j + sy / n) * cell, min.z + (k + sz / n) * cell);
  }

  // one quad per sign-changing grid edge, joining the four cells around it
  const idx: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    // wind so the faces look out of the solid (checked: back views must not show the far side)
    if (flip) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = F[id(i, j, k)], b = F[id(i + 1, j, k)];
    if ((a < 0) === (b < 0)) continue;
    quad(cellVert[cid(i, j - 1, k - 1)], cellVert[cid(i, j, k - 1)], cellVert[cid(i, j, k)], cellVert[cid(i, j - 1, k)], a < 0);
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = F[id(i, j, k)], b = F[id(i, j + 1, k)];
    if ((a < 0) === (b < 0)) continue;
    quad(cellVert[cid(i - 1, j, k - 1)], cellVert[cid(i - 1, j, k)], cellVert[cid(i, j, k)], cellVert[cid(i, j, k - 1)], a < 0);
  }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = F[id(i, j, k)], b = F[id(i, j, k + 1)];
    if ((a < 0) === (b < 0)) continue;
    quad(cellVert[cid(i - 1, j - 1, k)], cellVert[cid(i, j - 1, k)], cellVert[cid(i, j, k)], cellVert[cid(i - 1, j, k)], a < 0);
  }

  // gradient normals and paint
  const nrm = new Float32Array(pos.length);
  const col = new Float32Array(pos.length);
  const h = cell * 0.5;
  const painted = prims.filter(p => p.color !== undefined && !p.sub);
  const cols = painted.map(p => new THREE.Color(p.color!));
  for (let q = 0; q < pos.length; q += 3) {
    const x = pos[q], y = pos[q + 1], z = pos[q + 2];
    let gx = field(x + h, y, z) - field(x - h, y, z);
    let gy = field(x, y + h, z) - field(x, y - h, z);
    let gz = field(x, y, z + h) - field(x, y, z - h);
    const l = Math.hypot(gx, gy, gz) || 1;
    gx /= l; gy /= l; gz /= l;
    nrm[q] = gx; nrm[q + 1] = gy; nrm[q + 2] = gz;
    // paint: soft-min blend of the painted primitives by distance (a crisp but anti-aliased line
    // where two paints meet); `paint` priority shifts a primitive's distance by `bias` per level
    const ds = painted.map((p, i) => p.d(x, y, z) - (p.paint ?? 0) * bias);
    let dmin = Infinity;
    for (const dd of ds) dmin = Math.min(dmin, dd);
    let r = 0, gg = 0, b = 0, wsum = 0;
    ds.forEach((dd, i) => {
      const w = Math.exp(-(dd - dmin) / (cell * 0.35));
      if (w < 1e-4) return;
      r += cols[i].r * w; gg += cols[i].g * w; b += cols[i].b * w; wsum += w;
    });
    col[q] = r / wsum; col[q + 1] = gg / wsum; col[q + 2] = b / wsum;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}

/** soft vinyl: satin, a little clearcoat, vertex-painted */
export function vinylMaterial(name: string, roughness = 0.42) {
  return new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.15, sheenRoughness: 0.6, name,
  });
}
