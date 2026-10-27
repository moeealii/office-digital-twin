import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mesh } from './_moe-kit';
import { boxCushion, pipingPath } from './_lounge-geo';

/**
 * The cream tufted leather set — the wall-3 three-seat sofa (lounge) and the wall-0 loveseat
 * (desk-east) came together, so both are built here from one spec, one tuft lattice and one set
 * of materials. Change the pattern here and both pieces follow.
 *
 * What the set looks like (photos 104/108/115 loveseat, 123/124/125 sofa):
 * - tuxedo build: square arms as tall as the back, flat tops, welt piping round the arm's front
 *   panel and along its top outer edge; outer arm faces plain;
 * - diamond tufting with clear crystal buttons in a chrome bezel on the back AND on the inner arm
 *   faces; three staggered rows (top and bottom rows aligned, middle offset half a pitch);
 *   vertical pleats run from the top-row buttons up into the rolled top and from the bottom-row
 *   buttons down behind the seat cushions;
 * - boxed seat cushions with welt piping top and bottom, sitting on a plain front rail with a welt
 *   along its top edge; short dark feet barely visible.
 *
 * Measured (scan scan_room.ply + photo 104 frontal ladder):
 * - top of back and arms 0.79 (scan 0.79 sofa, 0.81 loveseat); cushion tops 0.48 (scan 0.47/0.49);
 *   depth 0.90; arm width 0.19 (loveseat west arm -0.24..-0.05);
 * - tuft lattice: same-row pitch 0.104, row step 0.088 measured on the back (diamonds ~1.7x taller
 *   than wide); top row 0.105 below the top, bottom row just clear of the cushions (y ~0.52);
 * - the tufted back face sits 0.62 behind the cushion front at seat level and leans back ~10 deg.
 *
 * Local frame of a built couch: origin on the floor at the footprint centre, +x along the length,
 * front (seat side) toward -z, back toward +z. Place it with position + rotation.y.
 */

export const SET = {
  depth: 0.9,
  height: 0.79,
  armW: 0.19,
  footH: 0.035,
  deck: 0.3, // cushion bottom / top of the front rail
  cushionH: 0.18,
  backSeat: 0.62, // cushion front -> tufted back face at seat level
  lean: THREE.MathUtils.degToRad(10),
  roll: 0.06, // radius of the back's roll into the top rail
  armRoll: 0.035,
  pitch: 0.104, // same-row button spacing
  rowStep: 0.088, // vertical spacing between staggered rows
  rowYs: [0.695, 0.607, 0.519], // button row heights (top, middle, bottom), same on back and arms
};

export type SetMats = {
  leather: THREE.Material;
  piping: THREE.Material;
  foot: THREE.Material;
  crystal: THREE.Material;
  bezel: THREE.Material;
};

const loader = new THREE.TextureLoader();

async function cc0(file: string, repeat: number) {
  const t = await loader.loadAsync('/textures/' + file);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

/** Materials for the set; call inside build(). UVs on every part are metric (1 unit = 1 m). */
export async function tuftedSetMaterials(): Promise<SetMats> {
  const [nor, rough] = await Promise.all([cc0('leather_nor.jpg', 3.4), cc0('leather_rough.jpg', 3.4)]);
  const named = <M extends THREE.Material>(name: string, m: M) => ((m.name = name), m);
  // warm cream bonded leather: soft satin, a little sheen at grazing angles (photos 104/123)
  const leather = named('set-cream-leather', new THREE.MeshPhysicalMaterial({
    color: '#e7dbc6', roughness: 0.62, roughnessMap: rough,
    normalMap: nor, normalScale: new THREE.Vector2(0.16, 0.16),
    clearcoat: 0.16, clearcoatRoughness: 0.5,
    sheen: 0.3, sheenColor: new THREE.Color('#f3ebdd'), sheenRoughness: 0.55,
    specularIntensity: 0.4,
  }));
  const piping = named('set-welt', new THREE.MeshPhysicalMaterial({
    color: '#dcd0b9', roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.4,
    normalMap: nor, normalScale: new THREE.Vector2(0.1, 0.1),
  }));
  const foot = named('set-foot', new THREE.MeshStandardMaterial({ color: '#2a211b', roughness: 0.55 }));
  // rhinestone: bright facets, nearly white; reflections do the work (no transmission pass)
  const crystal = named('set-crystal', new THREE.MeshPhysicalMaterial({
    color: '#f4f7fb', metalness: 0.55, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02,
    iridescence: 0.35, iridescenceIOR: 1.6, flatShading: true, envMapIntensity: 1.6,
  }));
  const bezel = named('set-bezel', new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 1, roughness: 0.22 }));
  return { leather, piping, foot, crystal, bezel };
}

// ---------------------------------------------------------------------------------------------
// tufted field on a swept profile

type Prof = { s: number; y: number; z: number; ny: number; nz: number }[];

/**
 * Profile in the (z, y) plane, swept along x. Starts at (z0, y0), runs up leaning back by `lean`
 * to `yRoll`, rolls over a quarter circle of radius `r` and runs back horizontally for `run`.
 * Returns samples with arc length s and the outward normal (toward -z on the upright part).
 */
function rolledProfile(z0: number, y0: number, yRoll: number, lean: number, r: number, run: number, n = 160): Prof {
  const up = (yRoll - y0) / Math.cos(lean);
  const arc = r * (Math.PI / 2 - lean);
  const total = up + arc + run;
  const out: Prof = [];
  const zr = z0 + (yRoll - y0) * Math.tan(lean);
  for (let i = 0; i <= n; i++) {
    const s = (total * i) / n;
    let y: number, z: number, ang: number; // ang = tangent angle from vertical toward +z
    if (s <= up) {
      ang = lean;
      y = y0 + s * Math.cos(lean);
      z = z0 + s * Math.sin(lean);
    } else if (s <= up + arc) {
      const a = lean + (s - up) / r;
      // circle centre sits r behind the surface normal at the roll start
      const cz = zr + r * Math.cos(lean), cy = yRoll - r * Math.sin(lean);
      ang = a;
      z = cz - r * Math.cos(a);
      y = cy + r * Math.sin(a);
    } else {
      ang = Math.PI / 2;
      const top = zr + r * Math.cos(lean) - r * Math.cos(Math.PI / 2);
      y = yRoll - r * Math.sin(lean) + r;
      z = top + (s - up - arc);
    }
    // tangent (tz, ty) = (sin ang, cos ang); outward normal = (-ty, tz) in (z, y)
    out.push({ s, y, z, nz: -Math.cos(ang), ny: Math.sin(ang) });
  }
  return out;
}

function sampleProf(p: Prof, s: number) {
  const total = p[p.length - 1].s;
  const t = Math.min(p.length - 1.000001, Math.max(0, (s / total) * (p.length - 1)));
  const i = Math.floor(t), f = t - i;
  const a = p[i], b = p[i + 1];
  const nz = a.nz + (b.nz - a.nz) * f, ny = a.ny + (b.ny - a.ny) * f;
  const l = Math.hypot(nz, ny) || 1;
  return { y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f, nz: nz / l, ny: ny / l };
}

type Seg = { ax: number; as: number; bx: number; bs: number; fade?: boolean };

/** button lattice + the folds between them, in (x, s) panel coordinates */
function lattice(width: number, prof: Prof, edge: number) {
  const rowS = SET.rowYs.map((y) => {
    let best = 0, bd = 1e9;
    for (const p of prof) if (Math.abs(p.y - y) < bd && p.ny < 0.5) { bd = Math.abs(p.y - y); best = p.s; }
    return best;
  });
  const half = width / 2 - edge;
  const rows: number[][] = rowS.map((_, r) => {
    const off = r === 1 ? SET.pitch / 2 : 0;
    const xs: number[] = [];
    for (let i = -40; i <= 40; i++) {
      const x = i * SET.pitch + off;
      if (Math.abs(x) <= half) xs.push(x);
    }
    return xs;
  });
  const buttons: [number, number][] = [];
  rows.forEach((xs, r) => xs.forEach((x) => buttons.push([x, rowS[r]])));
  const segs: Seg[] = [];
  // diagonals between neighbouring rows
  for (let r = 0; r < 2; r++) {
    for (const xa of rows[r]) for (const xb of rows[r + 1]) {
      if (Math.abs(Math.abs(xa - xb) - SET.pitch / 2) < 1e-4) segs.push({ ax: xa, as: rowS[r], bx: xb, bs: rowS[r + 1] });
    }
  }
  const sTop = prof[prof.length - 1].s;
  // half-diamonds at the field's side edges: a button-less row end still folds toward the edge
  for (let r = 0; r < 3; r++) {
    const xs = rows[r];
    if (!xs.length) continue;
    for (const [xe, dir] of [[xs[0], -1], [xs[xs.length - 1], 1]] as const) {
      for (const rr of [r - 1, r + 1]) {
        if (rr < 0 || rr > 2) continue;
        const nx = xe + dir * SET.pitch / 2;
        if (!rows[rr].some((x) => Math.abs(x - nx) < 1e-4)) {
          segs.push({ ax: xe, as: rowS[r], bx: nx, bs: (rowS[r] + rowS[rr]) / 2, fade: true });
        }
      }
    }
  }
  // pleats: top row up into the roll, bottom row down behind the cushions
  const rollStart = prof.find((p) => p.ny > 0.25)?.s ?? sTop;
  for (const x of rows[0]) segs.push({ ax: x, as: rowS[0], bx: x, bs: Math.min(sTop, rollStart + 0.07), fade: true });
  for (const x of rows[2]) segs.push({ ax: x, as: rowS[2], bx: x, bs: 0, fade: true });
  return { buttons, segs, rowS };
}

/**
 * A tufted leather field swept along a rolled profile. Returns the leather mesh plus the button
 * transforms (in the panel's frame) so the caller can instance crystals across the whole couch.
 */
function tuftPanel(width: number, prof: Prof, mats: SetMats, o: { edge: number; seed: number }) {
  const { buttons, segs, rowS } = lattice(width, prof, o.edge);
  const sTop = prof[prof.length - 1].s;
  const rnd = mulberry(o.seed);
  const waves = Array.from({ length: 6 }, () => ({ k: 40 + rnd() * 90, a: rnd() * Math.PI, ph: rnd() * 6.28 }));
  // Analytic diamond field. u counts half-pitches across, v rows up from the bottom row, so
  // buttons sit where u + v is even. puff(a)·puff(b) on the diagonals a = (u+v)/2, b = (u-v)/2
  // is zero along the fold lines and swells to a pillow in each diamond; the 0.6 power gives the
  // folds a crisp cusp. Above the top row and below the bottom row the same profile runs on in
  // u only — the vertical pleats — and eases off into the roll / behind the cushions.
  const s0 = rowS[2];
  const rollAt = prof.find((p) => p.ny > 0.25)?.s ?? sTop;
  const sq = (rowS[0] - rowS[2]) / 2;
  const half = (width / 2 - o.edge);
  const uOff = 0; // bottom row has a button at x = 0
  const puff = (t: number) => Math.pow(0.5 - 0.5 * Math.cos(2 * Math.PI * t), 0.6);
  const DIAMOND = 0.042;
  const height = (x: number, s: number) => {
    const ex = smooth(0, 0.045, width / 2 - Math.abs(x));
    // puff dies out over the roll so the top edge reads as one smooth bolster (photos 104/123)
    const es = smooth(0, 0.03, s) * (1 - smooth(rollAt - 0.02, rollAt + 0.07, s));
    const u = (x - uOff) / (SET.pitch / 2);
    const v = (s - s0) / sq;
    let f: number;
    if (v >= 0 && v <= 2) f = puff((u + v) / 2) * puff((u - v) / 2);
    else {
      const d = v < 0 ? -v : v - 2;
      // pleats: full at the row, flattening out over ~1.5 rows into a smooth roll / cushion tuck
      const k = smooth(0, 1.5, d);
      f = Math.pow(0.5 - 0.5 * Math.cos(Math.PI * u), 1.2) * (1 - 0.8 * k) + 0.55 * k;
    }
    // the lattice stops a little inside the side edges: plain puffed leather beyond the last fold
    const inField = 1 - smooth(half, half + 0.04, Math.abs(x));
    f = f * inField + 0.75 * (1 - inField);
    let h = (0.01 + DIAMOND * f) * ex * es + 0.004 * ex;
    for (const [bx, bs] of buttons) {
      const dx = x - bx, ds = s - bs;
      if (Math.abs(dx) > 0.04 || Math.abs(ds) > 0.04) continue;
      const d = Math.hypot(dx, ds);
      h -= 0.008 * Math.exp(-((d / 0.011) ** 2));
      const ang = Math.atan2(ds, dx);
      h += 0.0009 * Math.sin(ang * 7 + bx * 40) * Math.exp(-d / 0.018) * smooth(0.005, 0.015, d);
    }
    let wr = 0;
    for (const w of waves) wr += Math.sin((x * Math.cos(w.a) + s * Math.sin(w.a)) * w.k + w.ph);
    h += wr * 0.00015;
    return Math.max(0.001, h);
  };
  void segs;

  const step = 0.0045;
  const nx = Math.max(24, Math.ceil(width / step));
  const ns = Math.max(24, Math.ceil(sTop / step));
  const pos = new Float32Array((nx + 1) * (ns + 1) * 3);
  const uv = new Float32Array((nx + 1) * (ns + 1) * 2);
  let k = 0, q = 0;
  for (let j = 0; j <= ns; j++) {
    const s = (sTop * j) / ns;
    const P = sampleProf(prof, s);
    for (let i = 0; i <= nx; i++) {
      const x = -width / 2 + (width * i) / nx;
      const h = height(x, s);
      pos[k++] = x;
      pos[k++] = P.y + P.ny * h;
      pos[k++] = P.z + P.nz * h;
      uv[q++] = x;
      uv[q++] = s;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < ns; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    idx.push(a, c, b, b, c, d); // face winds toward the profile normal (-z side)
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = mesh(geo, mats.leather, 'tufted-field');

  const btn: THREE.Matrix4[] = [];
  for (const [bx, bs] of buttons) {
    const P = sampleProf(prof, bs);
    const h = height(bx, bs);
    const p = new THREE.Vector3(bx, P.y + P.ny * h, P.z + P.nz * h);
    const n = new THREE.Vector3(0, P.ny, P.nz);
    btn.push(new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), n), new THREE.Vector3(1, 1, 1)));
  }
  return { mesh: m, buttons: btn };
}

// ---------------------------------------------------------------------------------------------

export type CouchSpec = {
  name: string;
  length: number; // outside, arm to arm
  seats: number;
  seed?: number;
};

/** A complete couch of the set, in the local frame described in the header. */
export function buildTuftedCouch(spec: CouchSpec, mats: SetMats): THREE.Group {
  const g = new THREE.Group();
  g.name = spec.name;
  const L = spec.length, D = SET.depth, H = SET.height, AW = SET.armW;
  const inner = L - 2 * AW;
  const front = -D / 2;
  const seed = spec.seed ?? 1;
  const crystals: THREE.Matrix4[] = [];
  const addButtons = (panel: THREE.Object3D, list: THREE.Matrix4[]) => {
    panel.updateMatrix();
    for (const m of list) crystals.push(panel.matrix.clone().multiply(m));
  };

  // ---- feet
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const f = mesh(new RoundedBoxGeometry(0.05, SET.footH + 0.004, 0.05, 2, 0.006), mats.foot);
    f.position.set(sx * (L / 2 - 0.06), (SET.footH + 0.004) / 2, sz * (D / 2 - 0.07));
    g.add(f);
  }

  // ---- arms: square tuxedo blocks, piping round the front panel and along the top outer edge
  const armH = H - SET.footH;
  for (const side of [-1, 1] as const) {
    const ax = side * (L / 2 - AW / 2);
    const arm = mesh(metricUV(new RoundedBoxGeometry(AW, armH, D, 5, 0.03)), mats.leather, 'arm');
    arm.position.set(ax, SET.footH + armH / 2, 0);
    g.add(arm);
    const inset = 0.014;
    const fz = front - 0.003;
    const loop: [number, number, number][] = [];
    const hw = AW / 2 - inset, y0 = SET.footH + 0.02, y1 = H - inset, r = 0.022;
    for (const [cx, cy, a0] of [[hw - r, y1 - r, 0], [-hw + r, y1 - r, Math.PI / 2], [-hw + r, y0 + r, Math.PI], [hw - r, y0 + r, Math.PI * 1.5]] as const) {
      for (let k = 0; k <= 5; k++) {
        const a = a0 + (k / 5) * (Math.PI / 2);
        loop.push([ax + cx + Math.cos(a) * r, cy + Math.sin(a) * r, fz]);
      }
    }
    g.add(pipingPath(loop, 0.0034, mats.piping, true, 120));
    const ox = ax + side * (AW / 2 - 0.006);
    g.add(pipingPath([[ox, H - 0.008, front + 0.02], [ox, H - 0.008, 0], [ox, H - 0.008, D / 2 - 0.02]], 0.0032, mats.piping, false, 30));
  }

  // ---- base: front rail between the arms with a welt along its top edge
  const backZ0 = front + SET.backSeat; // tufted face at seat level
  {
    const h = SET.deck - SET.footH;
    const base = mesh(metricUV(new RoundedBoxGeometry(inner + 0.01, h, D - 0.02, 3, 0.012)), mats.leather, 'base');
    base.position.set(0, SET.footH + h / 2, 0);
    g.add(base);
    g.add(pipingPath([[-inner / 2, SET.deck - 0.004, front + 0.012], [inner / 2, SET.deck - 0.004, front + 0.012]], 0.0032, mats.piping, false, 40));
  }

  // ---- back: rolled tufted field over a plain carcass
  {
    const yRoll = H - SET.roll * (1 - Math.sin(SET.lean)) - 0.002;
    const zRoll = backZ0 + (yRoll - SET.deck + 0.02) * Math.tan(SET.lean); // top of the leaning face
    const zFlat = zRoll + SET.roll * Math.cos(SET.lean); // where the roll turns flat
    // carcass sits wholly behind the leaning face; a rail block under the flat top run
    const cH = yRoll - 0.03 - SET.deck;
    const carcass = mesh(metricUV(new RoundedBoxGeometry(inner + 0.01, cH, D / 2 - zRoll - 0.01, 3, 0.012)), mats.leather, 'back-carcass');
    carcass.position.set(0, SET.deck + cH / 2, (zRoll + 0.01 + D / 2) / 2);
    g.add(carcass);
    const rH = H - 0.004 - SET.deck - cH;
    const rail = mesh(metricUV(new RoundedBoxGeometry(inner + 0.01, rH, D / 2 - zFlat, 3, 0.016)), mats.leather, 'back-rail');
    rail.position.set(0, SET.deck + cH + rH / 2, (zFlat + D / 2) / 2);
    g.add(rail);
    const prof = rolledProfile(backZ0, SET.deck - 0.02, yRoll, SET.lean, SET.roll, D / 2 - zFlat - 0.012);
    const p = tuftPanel(inner + 0.012, prof, mats, { edge: 0.045, seed: seed * 7 + 1 });
    g.add(p.mesh);
    addButtons(p.mesh, p.buttons);
  }

  // ---- inner arm faces: same lattice, rows at the same heights
  for (const side of [-1, 1] as const) {
    const xFace = side * (inner / 2);
    const len = backZ0 - front + 0.08; // from the arm's front to behind the back field
    const prof = rolledProfile(0, SET.deck - 0.02, H - SET.armRoll, 0, SET.armRoll, AW - SET.armRoll - 0.05);
    const p = tuftPanel(len - 0.01, prof, mats, { edge: 0.035, seed: seed * 7 + 3 + side });
    const holder = new THREE.Group();
    holder.add(p.mesh);
    // panel local -z (its face) must point into the seat: +x for the west arm, -x for the east
    holder.rotation.y = side < 0 ? -Math.PI / 2 : Math.PI / 2;
    holder.position.set(xFace, 0, front + len / 2 + 0.005);
    holder.updateMatrixWorld(true);
    g.add(holder);
    p.mesh.updateMatrix();
    holder.updateMatrix();
    for (const m of p.buttons) crystals.push(holder.matrix.clone().multiply(p.mesh.matrix).multiply(m));
  }

  // ---- seat cushions: boxed, welted top and bottom
  const cw = inner / spec.seats;
  const cFront = front + 0.012;
  const cBack = backZ0 + 0.012;
  const cd = cBack - cFront;
  for (let i = 0; i < spec.seats; i++) {
    const cx = -inner / 2 + cw * (i + 0.5);
    const c = boxCushion(cw - 0.004, cd, SET.cushionH, mats.leather, {
      r: 0.05, dome: 0.016, sag: 0.008, flatten: 0.006, wrinkle: 0.0008, seed: seed * 11 + i * 5, segs: 14,
    });
    metricUV(c.geometry);
    c.position.set(cx, SET.deck + SET.cushionH / 2, (cFront + cBack) / 2);
    c.name = `seat-cushion-${i}`;
    g.add(c);
    for (const [yy, tube] of [[SET.deck + SET.cushionH - 0.008, 0.0042], [SET.deck + 0.01, 0.0038]] as const) {
      g.add(cushionWelt(cx, yy, (cFront + cBack) / 2, cw - 0.012, cd - 0.012, tube, mats.piping));
    }
  }

  // ---- crystal buttons: one instanced rhinestone + one instanced bezel for the whole couch
  const gem = new THREE.CylinderGeometry(0.0035, 0.0085, 0.0065, 8, 1);
  gem.rotateX(-Math.PI / 2); // axis along -z (outward)
  gem.translate(0, 0, -0.004);
  const ring = new THREE.TorusGeometry(0.0092, 0.0018, 6, 16);
  ring.translate(0, 0, -0.0012);
  const gems = new THREE.InstancedMesh(gem, mats.crystal, crystals.length);
  const rings = new THREE.InstancedMesh(ring, mats.bezel, crystals.length);
  crystals.forEach((m, i) => { gems.setMatrixAt(i, m); rings.setMatrixAt(i, m); });
  gems.name = 'crystal-buttons';
  rings.name = 'button-bezels';
  g.add(gems, rings);

  g.userData.physics = { type: 'static' };
  return g;
}

function cushionWelt(cx: number, y: number, cz: number, w: number, d: number, tube: number, mat: THREE.Material) {
  const pts: [number, number, number][] = [];
  const r = 0.045;
  const hw = w / 2 - r, hd = d / 2 - r;
  for (const [ox, oz, a0] of [[hw, hd, 0], [-hw, hd, Math.PI / 2], [-hw, -hd, Math.PI], [hw, -hd, Math.PI * 1.5]] as const) {
    for (let k = 0; k <= 6; k++) {
      const a = a0 + (k / 6) * (Math.PI / 2);
      pts.push([cx + ox + Math.cos(a) * r, y, cz + oz + Math.sin(a) * r]);
    }
  }
  return pipingPath(pts, tube, mat, true, Math.round((w + d) * 40));
}

/** box-projected metric UVs so the leather grain has the same scale on every part */
function metricUV(geo: THREE.BufferGeometry) {
  const p = geo.getAttribute('position');
  geo.computeVertexNormals();
  const n = geo.getAttribute('normal');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [u, v] = ax >= ay && ax >= az ? [p.getZ(i), p.getY(i)] : ay >= az ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)];
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function mulberry(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

