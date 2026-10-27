import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import scan from '../../data/demos/moe-office.json';
import { type Palette } from '../../packages/room-runtime/materials';
import { buildWall, wallMatrix, wallPoint, type WallDef } from '../../packages/room-runtime/walls';
import { cylinder, mesh, sweep, tube, type V3 } from '../../packages/room-runtime/helpers';

/**
 * Shell of Moe's office from the 2026-10-26 01:39 UTC House Capture session (room 0).
 * Room frame: meters, +y up, floor y = 0, walls axis-aligned.
 *   wall 0  z = +2.712  three windows over the desks          (u = 2.976 − x)
 *   wall 1  z = −2.712  TV / fireplace wall                    (u = x + 2.976)
 *   wall 2  x = −2.976  three windows (bouclé corner / prayer)  (u = 2.712 − z)
 *   wall 3  x = +2.976  tufted-sofa wall + the uncased opening (u = z + 2.712)
 *
 * Provenance (tools under .agents/skills/scan-detail-pass/scripts and data/captures/moe-office/arch/):
 *   - camera check: RoomPlan window rectangles projected into photos 43/45/47/48/53/105/166/213 land on
 *     the casings within ~5–20 px (wp-*.jpg), so photo poses are trusted for plane hits.
 *   - windows: one sill/head per wall. Wall 0: stool top 0.865 (wp-47z: blinds' bottom rail 0.87, stool
 *     ledge 0.85–0.88), head 1.995 (headrail top 1.97–1.99, casing top 2.03). RoomPlan's 1.265 sill for
 *     the window over the ultra-wide monitor is the monitor's top edge: in photo 166 the slats run on
 *     behind the monitor down to ~0.9 (wp-166z). Wall 2: sill 0.635 (rect-53, wp-53: stool line at
 *     0.62–0.65 on w2.1 and w2.2), head 1.995. Widths are RoomPlan's (they match the casings).
 *   - window trim: picture-frame colonial casing 66 mm wide on all four sides (z53out: the bottom piece
 *     mitres into the legs, no projecting stool), white vinyl casement frames with a folding crank
 *     handle on the bottom rail (photos 45, 53).
 *   - blinds: 2½" (63.5 mm) white faux-wood slats on a 53 mm pitch (rect-47, rect-53: ~17 slats per
 *     0.9 m), half-open (~26°: a slat shows ~31 mm of face per 53 mm pitch, ~58 % of the pitch, in
 *     both rectified crops), two string
 *     ladders at ~1/5 and 4/5 of the width (the dashed lines in 166/213 are the rungs), a 2.5" routed
 *     valance over the headrail (1.93–1.99 in rect-47), a bottom rail, and a white tilt wand ~0.5 m long
 *     hanging near the u0 end of every window (213: ~7 % in for w0.2, 53: ~23 % for w2.1 — 0.075 m
 *     modelled; 166, rect-47, rect-53). Cordless (no lift cords seen).
 *     Window w2.1's blind is raised to 0.72 (rect-53, photo 43): the frame and crank show beneath it.
 *   - opening in wall 3 (photos 137, 177, 205, 146): u 0.45–1.53 (z −2.26…−1.18), head 2.33. Right
 *     jamb triangulated from 137 + 177 (ray gap 24 mm); left jamb from plane hits (z −2.25 / −2.10).
 *     It is a drywall-wrapped opening, no casing; the crown stops at it with returned ends (146).
 *   - beyond the opening: the hall's far wall at x 5.18 (scan: −x-facing points peak at 5.1–5.2) with
 *     its canvas art and chrome-ball pendant, rectified from raw photo 177 (textures/hall-far.jpg).
 *     Left of the art the hall's south wall carries a tall stair window (dark glass, white trim) and
 *     the staircase rising toward the far corner with its wood newel + rail (137, 177, z177top).
 *   - pots: 12 recessed cans on a 4 × 3 grid. `lights_from_photos.py` on the raw bundle (91 bright-spot
 *     hits) returns exactly these 12 clusters (spread ≤ 8 cm) plus the fan.
 *   - fan: white drum "fandelier" centred (0.07, −0.03): circle fits of the scan points give r ≈ 0.25–0.28
 *     for y 2.05–2.17 (drum band), the hub/downrod r 0.04 at y 2.28–2.37 and the canopy at 2.40+.
 *     Three curved arms to three posts on the drum rim, frosted LED ring around a rosette grille,
 *     translucent blades behind it (photos 204, 207–216).
 *   - crown: cove crown with a bottom bead and top fillet, ~114 mm tall, 89 mm projection (end grain of
 *     the return in photo 146; 213). Baseboard 146 mm with a rounded cap, groove and a quarter-round shoe
 *     (z53base; top hits y 0.148 in photo 53).
 *   - floor: 3¼" (83 mm) solid oak in a dark espresso stain, boards along z, random lengths, cathedral
 *     grain, high-gloss finish (rect-floor-48/57/126: seam spacing 80–90 mm; colour median 73,53,42).
 *   - ceiling: a flush round speaker grille Ø0.16 at (0.04, −0.78) (photo 204 plane hit) and a white
 *     ceiling supply register ~0.76 × 0.20 against wall 1 at x −0.6…0.2 (photos 6, 204, 184, 206).
 *   - switches: a white decora switch on wall 0 at x 0.55, y 1.33 (photos 47, 105, 114, 148, 213 agree
 *     within 3 cm) and a black smart switch on wall 3 at z −0.91, y 1.30 (137, 177). Wall-1 outlets and
 *     the mirror switch belong to the fireplace item.
 */
export const CEILING = scan.walls[0].height; // RoomPlan: flat 2.438 m
const X = scan.polygon.map(p => p[0]), Z = scan.polygon.map(p => p[1]);
export const BOUNDS = { x0: Math.min(...X), x1: Math.max(...X), z0: Math.min(...Z), z1: Math.max(...Z) };
export const insideRoom = (x: number, z: number, m = 0) =>
  x > BOUNDS.x0 + m && x < BOUNDS.x1 - m && z > BOUNDS.z0 + m && z < BOUNDS.z1 - m;

/**
 * Twelve recessed cans (x, z): four columns × three rows. Confirmed by lights_from_photos.py on the
 * raw bundle: (−2.17…−2.24, −0.65…−0.70, 0.76…0.78, 2.18…2.20) × (−1.81…−1.90, 0.02…0.04, 1.88…1.91).
 */
export const POTS: [number, number][] = [-1.83, 0.03, 1.9].flatMap(z =>
  [-2.21, -0.67, 0.78, 2.2].map(x => [x, z] as [number, number]),
);

/** Drum ceiling fan centre (room x, z): circle fit of the scan's drum band at y 2.07–2.16. */
export const FAN: [number, number] = [0.05, -0.035];
/** Fan dimensions (scan + photos 207/214–216): 0.55 m drum, band 2.05–2.17, hub 2.28–2.32. */
export const FAN_SPEC = { drumR: 0.265, rimY: 2.05, drumH: 0.12, hubY: 2.285 };

/** The uncased opening in wall 3 (see header). */
export const DOORWAY = { wall: 3, u0: 0.48, u1: 1.53, head: 2.33 };

/** One sill/head per wall (matched sets; see header). */
const SILL: Record<number, number> = { 0: 0.865, 2: 0.635 };
const HEAD: Record<number, number> = { 0: 1.995, 2: 1.995 };
/** Blinds not let down to the sill, keyed `wall.index` (bottom-rail underside height). */
const BLIND_BOTTOM: Record<string, number> = { '2.1': 0.72 };

export interface WindowDef { wall: number; index: number; u0: number; u1: number; v0: number; v1: number; blindBottom: number }
export const WINDOWS: WindowDef[] = scan.walls.flatMap((w, wi) => w.openings.map((o, index) => {
  const v0 = SILL[wi] ?? o.v0, v1 = HEAD[wi] ?? o.v1;
  return { wall: wi, index, u0: o.u0, u1: o.u1, v0, v1, blindBottom: BLIND_BOTTOM[`${wi}.${index}`] ?? v0 };
}));

const WALL_T = 0.16;
export const WALLS: WallDef[] = scan.walls.map((w, i) => {
  const openings: WallDef['openings'] = WINDOWS.filter(o => o.wall === i).map(o => ({
    kind: 'rect' as const, u0: o.u0, u1: o.u1, v0: o.v0, v1: o.v1, casing: false,
  }));
  if (i === DOORWAY.wall) openings.push({ kind: 'rect', u0: DOORWAY.u0, u1: DOORWAY.u1, v0: 0, v1: DOORWAY.head, casing: false });
  return {
    name: String(w.index),
    origin: new THREE.Vector3(...(w.origin as V3)),
    u: new THREE.Vector3(...(w.u as V3)),
    n: new THREE.Vector3(...(w.n as V3)),
    length: w.length,
    thickness: WALL_T,
    height: CEILING,
    openings,
    panels: [],
    // crown, baseboard and casings are this house's own profiles, swept in trim()/windowUnit()
    crown: false,
    baseboardGaps: [[-1, w.length + 1]],
    ext: [0.16, 0.16],
  };
});

/** Orient obj on a wall: local +x along u, +y up, +z into the room, at wall coords (u, v, out) */
export function onWall(obj: THREE.Object3D, w: WallDef, u: number, v: number, out = 0) {
  const m = wallMatrix(w);
  obj.quaternion.setFromRotationMatrix(m);
  obj.position.copy(wallPoint(w, u, v, out));
  return obj;
}

// --- trim profiles -----------------------------------------------------------------------------

/** Cove crown, [s into the room, t from the ceiling (negative = down)], wall-bottom first (photo 146). */
const CROWN: [number, number][] = (() => {
  const p: [number, number][] = [[0, -0.100], [0.007, -0.100], [0.010, -0.098], [0.012, -0.094], [0.012, -0.090], [0.010, -0.087], [0.016, -0.084]];
  // the cove: concave, centre outside the moulding (room side, below)
  for (let k = 0; k <= 10; k++) {
    const a = (k / 10) * (Math.PI / 2);
    p.push([0.072 - 0.054 * Math.cos(a), -0.082 + 0.070 * Math.sin(a)]);
  }
  p.push([0.075, -0.012], [0.075, -0.006], [0.078, -0.005], [0.078, 0], [0, 0]);
  // 213/148 matched views read the band ~14 % larger than the first estimate from 146
  return p.map(([q, t]): [number, number] => [q * 1.14, t * 1.14]);
})();

/** 146 mm baseboard: rounded cap, groove, flat face, quarter-round shoe; [s out, t up], top first. */
const BASEBOARD: [number, number][] = [
  [0, 0.146], [0.005, 0.146], [0.009, 0.1445], [0.0115, 0.141], [0.0125, 0.137], [0.0115, 0.133],
  [0.0105, 0.130], [0.0125, 0.127], [0.0125, 0.124], [0.0135, 0.121], [0.0135, 0.020],
  // quarter-round shoe, r 16 mm
  ...Array.from({ length: 7 }, (_, k): [number, number] => {
    const a = (k / 6) * (Math.PI / 2);
    return [0.0135 + 0.016 * Math.sin(a), 0.016 * Math.cos(a) + (k === 0 ? 0.004 : 0)];
  }),
  [0, 0],
];

/** Colonial casing, 66 mm, [s outward from the opening edge, t proud of the wall]. */
const CASING: [number, number][] = [
  [-0.0035, 0], [-0.0035, 0.012], [0.0000, 0.0155], [0.0053, 0.0165], [0.0088, 0.0150], [0.0114, 0.0150],
  [0.0141, 0.0160], [0.0352, 0.0190], [0.0431, 0.0210], [0.0484, 0.0212], [0.0528, 0.0195], [0.0563, 0.0160],
  [0.0581, 0.0100], [0.0581, 0],
];
const CASING_W = 0.058;

const UP = new THREE.Vector3(0, 1, 0);
/** sweep a straight run, ordering the ends so the profile's s axis points along `sDir` */
function run(profile: [number, number][], a: THREE.Vector3, b: THREE.Vector3, sDir: THREE.Vector3, mat: THREE.Material, name: string, n = UP) {
  const d = b.clone().sub(a).normalize();
  const s = new THREE.Vector3().crossVectors(n, d);
  const [p, q] = s.dot(sDir) >= 0 ? [a, b] : [b, a];
  return mesh(sweep(profile, [p, q], n), mat, name);
}

/** Crown + baseboard runs for one wall, broken at the floor openings (with returns into the jambs). */
function trim(w: WallDef, s: ShellMaterials) {
  const g = new THREE.Group();
  g.name = `trim-${w.name}`;
  const at = (u: number, v: number, out = 0) => wallPoint(w, u, v, out);
  const into = w.n;
  const floorOpenings = w.openings.filter(o => o.kind === 'rect' && o.v0 === 0) as Extract<WallDef['openings'][number], { kind: 'rect' }>[];
  const spans = (len: number) => {
    const out: [number, number][] = [];
    let start = 0;
    for (const o of [...floorOpenings].sort((a, b) => a.u0 - b.u0)) { out.push([start, o.u0]); start = o.u1; }
    out.push([start, len]);
    return out.filter(([a, b]) => b - a > 0.02);
  };
  // crown: runs from corner to corner (overlapping into the corners reads as a mitre), stopped with
  // capped (returned) ends at the opening
  for (const [a, b] of spans(w.length)) {
    const a0 = floorOpenings.some(o => Math.abs(o.u1 - a) < 1e-6) ? a : a - 0.08;
    const b0 = floorOpenings.some(o => Math.abs(o.u0 - b) < 1e-6) ? b : b + 0.08;
    g.add(run(CROWN, at(a0, CEILING), at(b0, CEILING), into, s.trimWhite, 'crown'));
  }
  for (const [a, b] of spans(w.length)) {
    const a0 = floorOpenings.some(o => Math.abs(o.u1 - a) < 1e-6) ? a : a - 0.016;
    const b0 = floorOpenings.some(o => Math.abs(o.u0 - b) < 1e-6) ? b : b + 0.016;
    g.add(run(BASEBOARD, at(a0, 0), at(b0, 0), into, s.trimWhite, 'baseboard'));
  }
  // baseboard returns along the jamb faces of each floor opening
  for (const o of floorOpenings) {
    g.add(run(BASEBOARD, at(o.u0, 0, 0.014), at(o.u0, 0, -w.thickness), w.u, s.trimWhite, 'baseboard-return'));
    g.add(run(BASEBOARD, at(o.u1, 0, 0.014), at(o.u1, 0, -w.thickness), w.u.clone().negate(), s.trimWhite, 'baseboard-return'));
  }
  return g;
}

// --- materials -----------------------------------------------------------------------------------

export function shellMaterials(m: Palette) {
  const tint = (base: THREE.MeshStandardMaterial, color: string) => { const t = base.clone(); t.color.set(color); return t; };
  const { map: floorMap, bump: floorBump } = floorTextures();
  const basic = (color: string) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
  return {
    paint: tint(m.wall, '#ecebe6'),
    // the photos' ceiling is a neutral mid grey lit by wall bounce (148, 213: ~150,148,145); the pots
    // light it only at grazing angles, so it carries a little neutral bounce of its own
    ceilingPaint: Object.assign(tint(m.ceiling, '#f1f0ec'), { emissive: new THREE.Color('#eef0f2'), emissiveIntensity: 0.09 }),
    trimWhite: new THREE.MeshStandardMaterial({ color: '#f4f3ef', roughness: 0.42, side: THREE.DoubleSide }),
    // satin white faux-wood (PVC composite) slats: a touch warmer and glossier than the trim
    slatWhite: new THREE.MeshStandardMaterial({ color: '#f1f0ea', roughness: 0.36, metalness: 0, emissive: '#fffaf2', emissiveIntensity: 0.1, side: THREE.DoubleSide }),
    tapeWhite: new THREE.MeshStandardMaterial({ color: '#e2e0d8', roughness: 0.85, side: THREE.DoubleSide }),
    vinyl: new THREE.MeshStandardMaterial({ color: '#f3f2ee', roughness: 0.3 }),
    wand: new THREE.MeshPhysicalMaterial({ color: '#eef0ee', roughness: 0.15, transmission: 0.4, thickness: 0.01, transparent: true, opacity: 0.85 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#d4d6d8', roughness: 0.16, metalness: 1 }),
    darkGrille: new THREE.MeshStandardMaterial({ color: '#2a2b2c', roughness: 0.55, metalness: 0.4 }),
    // white painted can trim: lit by the room bounce, not by its own lamp; a little emissive so it
    // does not read as a black hole next to the lens
    potTrimWhite: new THREE.MeshStandardMaterial({
      color: '#f6f4f0', roughness: 0.5, emissive: '#fff2df', emissiveIntensity: 0.22,
    }),
    // fan: gloss white ABS drum, frosted LED diffuser ring (off in the photos), white grille, clear blades
    fanWhite: new THREE.MeshPhysicalMaterial({ color: '#f5f5f2', roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.15, emissive: '#fffaf2', emissiveIntensity: 0.12, side: THREE.DoubleSide }),
    diffuser: new THREE.MeshStandardMaterial({ color: '#b6b8b6', roughness: 0.55, emissive: '#fff6ea', emissiveIntensity: 0.08, side: THREE.DoubleSide }),
    bladeClear: new THREE.MeshPhysicalMaterial({ color: '#f2f4f4', roughness: 0.3, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    cageWire: new THREE.MeshStandardMaterial({ color: '#f2f3f1', roughness: 0.4, metalness: 0.05 }),
    fanInterior: new THREE.MeshStandardMaterial({ color: '#c4c7c7', roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide }),
    plateWhite: new THREE.MeshStandardMaterial({ color: '#f3f2ec', roughness: 0.4 }),
    plateBlack: new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.25 }),
    speakerGrille: new THREE.MeshStandardMaterial({ map: dotTexture(), color: '#e4e6e3', roughness: 0.7 }),
    // dark espresso oak, high-gloss site finish (sharp pot-light streaks in 47/57/126/196)
    floor: new THREE.MeshPhysicalMaterial({
      map: floorMap, bumpMap: floorBump, bumpScale: 1.5, roughness: 0.45, metalness: 0,
      clearcoat: 0.85, clearcoatRoughness: 0.16,
    }),
    // the hall beyond the opening is lit by its own fixtures and seen only through the opening: flat
    // MeshBasic values sampled from photo 177 (no light budget, never goes black)
    hallWall: basic('#c7cbe0'),
    hallSide: basic('#b9bed4'),
    hallFloor: basic('#4a3a30'),
    hallCeil: basic('#d0d4e6'),
    hallCurtain: basic('#efede6'),
    hallWood: basic('#7d5f47'),
    hallMural: new THREE.MeshBasicMaterial({ map: hallTexture(), toneMapped: false, side: THREE.DoubleSide }),
    hallMuralGround: basic('#e6e1d6'),
    revealLit: new THREE.MeshStandardMaterial({
      color: '#f2efe9', roughness: 0.6, emissive: '#e8ebff', emissiveIntensity: 0.12, side: THREE.DoubleSide,
    }),
    night: new THREE.MeshBasicMaterial({ color: '#0d1217' }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#9fb0b8', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
  };
}
export type ShellMaterials = ReturnType<typeof shellMaterials>;

/**
 * The hall's far wall, rectified from raw photo 177 (textures/hall-far.jpg, made by
 * data/captures/moe-office/arch/make_hall_tex.py), shipped as raw RGB so it exists synchronously:
 * the capture tool renders once, before an async image load could finish.
 */
function hallTexture() {
  // Public-only analytic wall pattern: no raw capture pixels or base64 payload.
  const w = 32, h = 32;
  const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const border = x === 8 || x === 23 || y === 5 || y === 26;
    rgba[i] = border ? 184 : 218;
    rgba[i + 1] = border ? 180 : 215;
    rgba[i + 2] = border ? 165 : 204;
    rgba[i + 3] = 255;
  }
  const t = new THREE.DataTexture(rgba, w, h, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** perforated speaker-grille dots */
function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = '#f2f2ef';
  x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#9ea19f';
  for (let i = 0; i < 128; i += 8) for (let j = 0; j < 128; j += 8) {
    x.beginPath(); x.arc(i + 4 + ((j / 8) % 2) * 4, j + 4, 1.6, 0, Math.PI * 2); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 5);
  return t;
}

/**
 * Dark espresso 3¼" solid oak, drawn to the measured facts: 83 mm boards running along z (canvas y),
 * random lengths 0.25–1.9 m with staggered butt joints, per-board tone, flat-sawn cathedral grain or
 * straight rift grain, open-pore flecks, and a micro-bevel seam. Base colour = photo median (73,53,42).
 * One tile = 2 m; floor UVs are metres, so repeat 0.5. The bump map carries only seams and joints.
 */
function floorTextures() {
  const px = 1024, size = 2048, plank = 0.12 * px;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d')!;
  const bv = document.createElement('canvas');
  bv.width = bv.height = size / 2;
  const b = bv.getContext('2d')!;
  b.fillStyle = '#808080';
  b.fillRect(0, 0, size / 2, size / 2);
  let seed = 20261026;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  c.fillStyle = 'rgb(49,34,29)';
  c.fillRect(0, 0, size, size);
  const nBoards = Math.round(size / plank);
  const pw = size / nBoards; // exact tiling
  for (let i = 0; i < nBoards; i++) {
    const x0 = i * pw;
    let y = -rnd() * 1.6 * px;
    while (y < size) {
      const len = (0.25 + rnd() * 1.65) * px;
      const tone = 0.78 + rnd() * 0.5, warm = rnd() * 6 - 2;
      c.save();
      c.beginPath(); c.rect(x0, y, pw, len); c.clip();
      c.fillStyle = `rgb(${Math.round(49 * tone + warm)},${Math.round(34 * tone)},${Math.round(29 * tone - warm * 0.4)})`;
      c.fillRect(x0, y, pw, len);
      const cx = x0 + pw * (0.25 + rnd() * 0.5);
      if (rnd() < 0.55) {
        // cathedral: nested arches opening along the board (prominent in 48's close view)
        const apex = y + rnd() * len * 0.7, dirn = rnd() < 0.5 ? 1 : -1;
        for (let k = 1; k <= 9; k++) {
          const a = 3.0 + k * 4.6 + rnd() * 2.5;
          c.beginPath();
          for (let s = -1; s <= 1; s += 2) {
            for (let t = 0; t <= 1.0001; t += 0.05) {
              const dy = t * t * len * 0.9;
              const xx = cx + s * a * t * 2.6 + Math.sin(dy * 0.02 + k) * 1.2;
              const yy = apex + dirn * (dy - a * 0.6);
              if (t === 0) c.moveTo(xx, yy); else c.lineTo(xx, yy);
            }
          }
          c.strokeStyle = k % 2 ? 'rgba(118,80,56,0.42)' : 'rgba(14,8,5,0.44)';
          c.lineWidth = 1.2 + rnd() * 2.4;
          c.stroke();
        }
      }
      // straight grain lines along the board
      for (let k = 0; k < 16; k++) {
        const gx = x0 + rnd() * pw;
        c.beginPath();
        c.moveTo(gx, y);
        for (let yy = y; yy <= y + len; yy += 40) c.lineTo(gx + Math.sin(yy * 0.006 + k) * 2.5, yy);
        c.strokeStyle = rnd() < 0.5 ? 'rgba(18,10,6,0.22)' : 'rgba(96,66,48,0.14)';
        c.lineWidth = 0.6 + rnd() * 1.6;
        c.stroke();
      }
      // open-pore flecks
      c.fillStyle = 'rgba(18,10,6,0.35)';
      for (let k = 0; k < 120; k++) c.fillRect(x0 + rnd() * pw, y + rnd() * len, 0.8, 3 + rnd() * 8);
      c.restore();
      // butt joint + seams (colour and bump)
      c.fillStyle = 'rgba(14,8,5,0.75)';
      c.fillRect(x0, y, pw, 2);
      b.fillStyle = '#202020';
      b.fillRect(x0 / 2, y / 2, pw / 2, 1.2);
      y += len;
    }
    c.fillStyle = 'rgba(14,8,5,0.7)';
    c.fillRect(x0, 0, 2, size);
    b.fillStyle = '#202020';
    b.fillRect(x0 / 2, 0, 1.2, size / 2);
  }
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.CanvasTexture(bv);
  for (const t of [map, bump]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.repeat.set(0.5, 0.5);
  }
  return { map, bump };
}

// --- windows -------------------------------------------------------------------------------------

/**
 * One window: picture-frame casing, the white vinyl casement frame + sash with its crank, glass and
 * the night outside, and the inside-mount 2" faux-wood blind. Built in wall-local coordinates
 * (x along u from the window centre, y = height, z = out of the wall face) and placed with onWall.
 */
function windowUnit(w: WallDef, o: WindowDef, s: ShellMaterials) {
  const g = new THREE.Group();
  g.name = `window-${o.wall}.${o.index}`;
  const W = o.u1 - o.u0, uc = (o.u0 + o.u1) / 2;
  const { v0, v1 } = o;
  const H = v1 - v0;
  const loc = new THREE.Group();
  onWall(loc, w, uc, 0, 0);
  g.add(loc);
  const bx = (sx: number, sy: number, sz: number, x: number, y: number, z: number) =>
    new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z);

  // picture-frame casing, all four sides (world-space sweep like the runtime's own casing)
  const at = (u: number, v: number) => wallPoint(w, u, v, 0);
  g.add(mesh(sweep(CASING, [at(o.u0, v0), at(o.u0, v1), at(o.u1, v1), at(o.u1, v0)], w.n, { closed: true }), s.trimWhite, 'casing'));

  // night + glass + vinyl casement frame, set back in the reveal
  loc.add(mesh(bx(W, H, 0.004, 0, v0 + H / 2, -WALL_T + 0.004), s.night, 'night'));
  const frame: THREE.BufferGeometry[] = [];
  const fz = -0.125, fd = 0.05, fw = 0.05, sw = 0.045;
  frame.push(bx(W, fw, fd, 0, v0 + fw / 2, fz), bx(W, fw, fd, 0, v1 - fw / 2, fz));
  frame.push(bx(fw, H, fd, -W / 2 + fw / 2, v0 + H / 2, fz), bx(fw, H, fd, W / 2 - fw / 2, v0 + H / 2, fz));
  // sash, a step proud of the frame
  const iw = W - 2 * fw, ih = H - 2 * fw, sz = fz + fd / 2 + 0.01;
  frame.push(bx(iw, sw, 0.02, 0, v0 + fw + sw / 2, sz), bx(iw, sw, 0.02, 0, v1 - fw - sw / 2, sz));
  frame.push(bx(sw, ih, 0.02, -iw / 2 + sw / 2, v0 + fw + ih / 2, sz), bx(sw, ih, 0.02, iw / 2 - sw / 2, v0 + fw + ih / 2, sz));
  // the flat jamb-extension sill in front of the frame
  frame.push(bx(W, 0.004, -fz - fd / 2, 0, v0 + 0.002, (fz + fd / 2) / 2));
  loc.add(mesh(mergeGeometries(frame), s.vinyl, 'casement-frame'));
  loc.add(mesh(bx(iw - 2 * sw, ih - 2 * sw, 0.004, 0, v0 + fw + ih / 2, sz - 0.004), s.glass, 'glass'));
  // folding crank handle (casement operator) on the frame's bottom rail, folded flat (photos 45, 53)
  const crank = new THREE.Group();
  crank.name = 'casement-crank';
  crank.add(mesh(bx(0.075, 0.024, 0.026, 0, 0.012, 0.013), s.vinyl, 'crank-cover'));
  const arm = mesh(bx(0.095, 0.011, 0.013, 0.045, 0, 0), s.vinyl, 'crank-arm');
  arm.rotation.z = 0.18;
  arm.position.set(0.005, 0.03, 0.02);
  crank.add(arm);
  crank.add(mesh(new THREE.CylinderGeometry(0.0075, 0.0085, 0.04, 10).rotateX(Math.PI / 2).translate(0.092, 0.047, 0.036), s.vinyl, 'crank-knob'));
  crank.position.set(-W / 2 + W * 0.42, v0 + 0.004, fz + fd / 2);
  loc.add(crank);

  // --- the blind ---
  const bw = W - 0.008;                  // inside mount, 4 mm clearance
  const cz = -0.05;                      // slat centre line, under the headrail
  const head = v1 - 0.004;
  const blind: THREE.BufferGeometry[] = [];
  // headrail (steel channel, mostly hidden) and the routed valance in front of it
  blind.push(bx(bw - 0.01, 0.038, 0.052, 0, head - 0.019, cz));
  const VAL: [number, number][] = [
    [0, 0.064], [0.006, 0.064], [0.0095, 0.0615], [0.011, 0.056], [0.0095, 0.047], [0.011, 0.040],
    [0.011, 0.007], [0.009, 0.002], [0.006, 0], [0, 0],
  ];
  const valance = sweep(VAL, [new THREE.Vector3(bw / 2, head - 0.064, -0.024), new THREE.Vector3(-bw / 2, head - 0.064, -0.024)], UP);
  blind.push(valance);
  // slats
  // slats: 2.5" (63.5 mm) on a 53 mm pitch, ~26° open — ~31 mm of face per pitch (rect-47, rect-53)
  const pitch = 0.053, slatW = 0.0635, slatT = 0.0032, tilt = 0.46;
  const railH = 0.02;
  const top = head - 0.064 - 0.018;
  const bottom = o.blindBottom + railH + 0.012;
  const nSlats = Math.max(3, Math.floor((top - bottom) / pitch) + 1);
  const slatGeo = new THREE.BoxGeometry(bw - 0.012, slatT, slatW).rotateX(tilt);
  for (let i = 0; i < nSlats; i++) blind.push(slatGeo.clone().translate(0, top - i * pitch, cz));
  // bottom rail
  blind.push(bx(bw - 0.012, railH, 0.052, 0, o.blindBottom + railH / 2, cz));
  loc.add(mesh(mergeGeometries(blind), s.slatWhite, 'blind'));

  // string ladders: front + back strings at ~1/5 and 4/5 of the width, a rung under every slat
  const cords: THREE.BufferGeometry[] = [];
  const hz = (slatW / 2) * Math.cos(tilt);
  const lenL = top - o.blindBottom - railH / 2;
  for (const f of [-0.31, 0.31]) {
    const x = bw * f;
    cords.push(bx(0.0014, lenL, 0.0014, x, o.blindBottom + railH / 2 + lenL / 2, cz + hz + 0.0012));
    cords.push(bx(0.0014, lenL, 0.0014, x, o.blindBottom + railH / 2 + lenL / 2, cz - hz - 0.0012));
    for (let i = 0; i < nSlats; i++) {
      cords.push(new THREE.BoxGeometry(0.0012, 0.0012, slatW + 0.003).rotateX(tilt).translate(x, top - i * pitch - 0.0025, cz));
    }
    // lift-cord route through the slats (centre of the ladder)
    cords.push(bx(0.0012, lenL, 0.0012, x + 0.004, o.blindBottom + railH / 2 + lenL / 2, cz));
  }
  const ladders = mesh(mergeGeometries(cords), s.tapeWhite, 'ladders');
  ladders.castShadow = false; // sub-mm strings only make dotted shadow-map noise on the wall
  loc.add(ladders);

  // tilt wand at the u0 end: hook + a clear hexagonal rod ~0.5 m
  const wandLen = Math.min(0.5, H * 0.45);
  const wx = -bw / 2 + 0.075, wz = -0.006;
  const wand = mesh(new THREE.CylinderGeometry(0.0048, 0.0048, wandLen, 6).translate(wx, head - 0.05 - wandLen / 2, wz), s.wand, 'tilt-wand');
  wand.castShadow = false;
  loc.add(wand);
  loc.add(mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.018, 8).translate(wx, head - 0.05 - wandLen, wz), s.slatWhite, 'wand-tip'));
  loc.add(mesh(new THREE.TorusGeometry(0.006, 0.0014, 6, 12).translate(wx, head - 0.044, wz - 0.004), s.chrome, 'wand-hook'));
  return g;
}

/** The white cord that hangs from w2.1's lower-left corner to the floor (photos 45, 53). */
function cordW21(w: WallDef, s: ShellMaterials) {
  const o = WINDOWS.find(x => x.wall === 2 && x.index === 1)!;
  const p = (u: number, v: number, out: number) => wallPoint(w, u, v, out).toArray() as V3;
  return tube([p(o.u0 + 0.02, o.v0 + 0.01, -0.03), p(o.u0 - 0.01, o.v0 - 0.01, 0.03), p(o.u0 - 0.03, o.v0 - 0.2, 0.02),
    p(o.u0 - 0.06, 0.25, 0.015), p(o.u0 - 0.09, 0.02, 0.03)], 0.0022, s.tapeWhite, 40);
}

// --- the hall beyond the wall-3 opening ----------------------------------------------------------

function beyond(w: WallDef, s: ShellMaterials) {
  const g = new THREE.Group();
  g.name = 'beyond-doorway';
  const x0 = w.origin.x + w.thickness;
  const xBack = 5.18, yTop = 3.0;
  const zS = -3.6, zN = -0.6;
  const quad = (pts: V3[], mat: THREE.Material, uv?: [number, number][]) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
    if (uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv.flat(), 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    g.add(m);
    return m;
  };
  quad([[x0, 0.002, zS], [x0, 0.002, zN], [xBack, 0.002, zN], [xBack, 0.002, zS]], s.hallFloor);
  quad([[x0, yTop, zS], [xBack, yTop, zS], [xBack, yTop, zN], [x0, yTop, zN]], s.hallCeil);
  quad([[x0, 0, zS], [xBack, 0, zS], [xBack, yTop, zS], [x0, yTop, zS]], s.hallSide);
  quad([[x0, 0, zN], [x0, yTop, zN], [xBack, yTop, zN], [xBack, 0, zN]], s.hallSide);
  // far wall: the rectified photo (z −2.35…−0.80, y 1.0…3.0) framed by plain wall
  const t0 = -2.35, t1 = -0.80, ty0 = 1.0, ty1 = 3.0;
  const xb = xBack - 0.001;
  quad([[xb, ty0, t1], [xb, ty0, t0], [xb, ty1, t0], [xb, ty1, t1]], s.hallMural, [[1, 0], [0, 0], [0, 1], [1, 1]]);
  quad([[xBack, 0, zN], [xBack, 0, zS], [xBack, ty0, zS], [xBack, ty0, zN]], s.hallWall);
  quad([[xBack, ty0, t0], [xBack, ty0, zS], [xBack, yTop, zS], [xBack, yTop, t0]], s.hallWall);
  quad([[xBack, ty0, zN], [xBack, ty0, t1], [xBack, yTop, t1], [xBack, yTop, zN]], s.hallWall);
  // the hall's tall stair window (dark glass, white trim): on the hall's SOUTH wall, left of the
  // art through the opening, above the staircase (photos 137, 177; z177top)
  const win = new THREE.Group();
  win.add(mesh(new THREE.BoxGeometry(0.62, 1.02, 0.014), s.hallCurtain, 'hall-window-frame'));
  win.add(mesh(new THREE.BoxGeometry(0.52, 0.92, 0.02), s.night, 'hall-window-glass'));
  win.position.set(4.35, 2.42, zS + 0.007);
  g.add(win);
  // staircase rising along the south wall toward the far corner, with newel + rail (photo 177)
  const riser = 0.185, tread = 0.28;
  for (let k = 0; k < 6; k++) {
    const xk = 3.45 + k * tread;
    g.add(mesh(new THREE.BoxGeometry(tread, riser * (k + 1), 0.48).translate(xk + tread / 2, riser * (k + 1) / 2, zS + 0.24), s.hallWall, 'stair-mass'));
    g.add(mesh(new THREE.BoxGeometry(tread, 0.014, 0.5).translate(xk + tread / 2, riser * (k + 1) - 0.007, zS + 0.25), s.hallWood, 'stair-tread'));
  }
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.042, 0.95, 12).translate(3.45, 0.475, zS + 0.52), s.hallWood, 'stair-newel'));
  g.add(tube([[3.45, 0.95, zS + 0.52], [4.15, 1.28, zS + 0.52], [4.85, 1.66, zS + 0.52]], 0.024, s.hallWood, 8));
  for (let k = 1; k <= 3; k++) {
    const xk = 3.8 + (k - 1) * 0.35;
    const treadY = riser * (k + 1), railY = 0.95 + (xk - 3.45) * (0.71 / 1.4);
    g.add(mesh(new THREE.BoxGeometry(0.018, railY - treadY, 0.018).translate(xk, (treadY + railY) / 2, zS + 0.52), s.hallWood, 'stair-baluster'));
  }
  // lit liner on the opening's own reveal (it faces the bright hall, not the dim room)
  const mid = w.origin.x + w.thickness / 2;
  const z0 = w.origin.z + DOORWAY.u0, z1 = w.origin.z + DOORWAY.u1;
  g.add(mesh(new THREE.BoxGeometry(w.thickness, 0.012, z1 - z0).translate(mid, 0.006, (z0 + z1) / 2), s.hallFloor, 'threshold'));
  g.add(mesh(new THREE.BoxGeometry(w.thickness, DOORWAY.head, 0.004).translate(mid, DOORWAY.head / 2, z0 + 0.003), s.revealLit, 'jamb-liner'));
  g.add(mesh(new THREE.BoxGeometry(w.thickness, DOORWAY.head, 0.004).translate(mid, DOORWAY.head / 2, z1 - 0.003), s.revealLit, 'jamb-liner'));
  g.add(mesh(new THREE.BoxGeometry(w.thickness, 0.004, z1 - z0).translate(mid, DOORWAY.head - 0.003, (z0 + z1) / 2), s.revealLit, 'head-liner'));
  return g;
}

// --- ceiling fixtures ----------------------------------------------------------------------------

/** Soft scatter around a lit can, the way the photos burn out the ceiling next to each pot. */
let haloMat: THREE.MeshBasicMaterial | undefined;
function halo() {
  if (!haloMat) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,242,220,0.34)');
    grad.addColorStop(0.3, 'rgba(255,238,212,0.10)');
    grad.addColorStop(1, 'rgba(255,238,212,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    haloMat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5).rotateX(Math.PI / 2), haloMat);
  m.name = 'pot-halo';
  m.renderOrder = 2;
  return m;
}

/** slim LED wafer can: a flat flange at the ceiling and the lens just inside it (photos 148, 213). */
function potTrimGeometry() {
  const pts: [number, number][] = [
    [0.046, -0.003], [0.050, -0.006], [0.056, -0.0075], [0.061, -0.006], [0.0635, -0.0025], [0.0635, 0],
  ];
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 32);
}

/**
 * White drum "fandelier" (photos 204, 207–216; scan circle fits): bell canopy, collar, short downrod,
 * a hub with a dark reveal band, three curved arms to three posts on the drum rim, an open wire top,
 * a 0.12 m gloss-white drum with a chrome bottom bead, the frosted LED ring with four slots, the
 * rosette grille, and five translucent blades on a motor can behind it.
 */
function drumFan(s: ShellMaterials) {
  const fan = new THREE.Group();
  fan.name = 'drum-ceiling-fan';
  const [fx, fz] = FAN;
  const { drumR: R, rimY, drumH, hubY } = FAN_SPEC;
  const topY = rimY + drumH;
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string) => {
    const m = mesh(geo.translate(fx, 0, fz), mat, name);
    fan.add(m);
    return m;
  };
  const latheGeo = (pts: [number, number][], seg = 40) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

  // canopy: flared bell, 0.16 m at the ceiling
  add(latheGeo([[0.001, CEILING], [0.079, CEILING], [0.080, CEILING - 0.006], [0.074, CEILING - 0.016], [0.058, CEILING - 0.03],
    [0.044, CEILING - 0.042], [0.038, CEILING - 0.05], [0.036, CEILING - 0.054], [0.001, CEILING - 0.054]]), s.fanWhite, 'fan-canopy');
  // collar, downrod, hub with its dark band, bottom finial
  add(new THREE.CylinderGeometry(0.046, 0.042, 0.024, 28).translate(0, CEILING - 0.066, 0), s.fanWhite, 'fan-collar');
  add(new THREE.CylinderGeometry(0.013, 0.013, CEILING - 0.078 - (hubY + 0.014), 16).translate(0, (CEILING - 0.078 + hubY + 0.014) / 2, 0), s.fanWhite, 'fan-downrod');
  add(new THREE.CylinderGeometry(0.036, 0.036, 0.028, 24).translate(0, hubY, 0), s.fanWhite, 'fan-hub');
  add(new THREE.CylinderGeometry(0.0345, 0.0345, 0.007, 24).translate(0, hubY - 0.018, 0), s.darkGrille, 'fan-hub-band');
  add(latheGeo([[0.001, hubY - 0.021], [0.036, hubY - 0.021], [0.031, hubY - 0.039], [0.019, hubY - 0.056], [0.001, hubY - 0.061]], 24), s.fanWhite, 'fan-hub-cap');

  // arms + posts at 120°: the posts stand on the top cage at ~0.64 R (photo 214: post offsets
  // −32/+83 px about a 137 px half-width); the arms are thick steep S-curves (214, 216)
  const postR = 0.17;
  const cageDome = 0.05; // the wire cage rises this far above the drum rim at the centre
  const postBase = topY + cageDome * (1 - (postR / R) ** 2);
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / 3 + 0.87; // one post toward (−x, +z): photos 214/216
    const ca = Math.cos(a), sa = Math.sin(a);
    const P = (r: number, y: number): V3 => [fx + ca * r, y, fz + sa * r];
    fan.add(tube([P(0.028, hubY + 0.006), P(0.08, hubY + 0.003), P(0.14, hubY - 0.028), P(postR - 0.004, postBase + 0.085), P(postR, postBase + 0.055)], 0.011, s.fanWhite, 24));
    fan.add(cylinder(0.0135, 0.055, P(postR, postBase + 0.027), s.fanWhite, 16));
    fan.add(cylinder(0.0165, 0.008, P(postR, postBase + 0.055), s.fanWhite, 16));
    fan.add(cylinder(0.0105, 0.012, P(postR, postBase + 0.063), s.fanWhite, 16));
  }

  // drum band (outer gloss white, inner grey), top rim, chrome bottom bead
  add(new THREE.CylinderGeometry(R, R, drumH, 96, 1, true).translate(0, rimY + drumH / 2, 0), s.fanWhite, 'fan-drum');
  add(new THREE.CylinderGeometry(R - 0.006, R - 0.006, drumH, 64, 1, true).translate(0, rimY + drumH / 2, 0), s.fanInterior, 'fan-drum-inner');
  add(new THREE.TorusGeometry(R - 0.003, 0.004, 8, 96).rotateX(Math.PI / 2).translate(0, topY, 0), s.fanWhite, 'fan-top-rim');
  add(new THREE.TorusGeometry(R - 0.001, 0.0035, 8, 96).rotateX(Math.PI / 2).translate(0, rimY + 0.002, 0), s.chrome, 'fan-chrome-bead');

  // open wire top: a short vertical lattice band above the band rim (photo 214), then rings +
  // radial spokes doming up to the motor cap
  const top: THREE.BufferGeometry[] = [];
  for (const y of [0.014, 0.028, 0.042]) {
    top.push(new THREE.TorusGeometry(R - 0.013, 0.002, 6, 72).rotateX(Math.PI / 2).translate(0, topY + y, 0));
  }
  for (const r of [0.08, 0.13, 0.18, 0.225]) {
    top.push(new THREE.TorusGeometry(r, 0.0022, 6, 64).rotateX(Math.PI / 2).translate(0, topY + cageDome * (1 - (r / R) ** 2), 0));
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const pts = [R - 0.013, 0.15, 0.07].map(r => new THREE.Vector3(Math.cos(a) * r, topY + cageDome * (1 - (r / R) ** 2), Math.sin(a) * r));
    top.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, 0.0018, 4));
  }
  add(mergeGeometries(top), s.cageWire, 'fan-top-wire');
  // motor can under the hub
  add(new THREE.CylinderGeometry(0.075, 0.08, 0.06, 32).translate(0, topY + 0.01, 0), s.fanWhite, 'fan-motor');

  // blades: five translucent paddles, pitched
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const shape = new THREE.Shape();
    shape.moveTo(0.06, -0.02);
    shape.bezierCurveTo(0.12, -0.04, 0.2, -0.05, 0.235, -0.01);
    shape.bezierCurveTo(0.245, 0.03, 0.2, 0.05, 0.13, 0.045);
    shape.bezierCurveTo(0.09, 0.04, 0.065, 0.02, 0.06, -0.02);
    const geo = new THREE.ShapeGeometry(shape, 10).rotateX(Math.PI / 2);
    geo.rotateX(0.25).rotateY(-a);
    add(geo.translate(0, rimY + 0.055, 0), s.bladeClear, 'fan-blade');
  }

  // bottom: frosted LED ring (R → 0.205) with four darker slots, then the rosette grille
  add(new THREE.RingGeometry(0.205, R - 0.002, 96).rotateX(Math.PI / 2).translate(0, rimY + 0.004, 0), s.diffuser, 'fan-led-ring');
  for (let i = 0; i < 4; i++) {
    const a0 = (i / 4) * Math.PI * 2 + Math.PI / 4 - 0.22;
    add(new THREE.RingGeometry(0.218, 0.240, 24, 1, a0, 0.44).rotateX(Math.PI / 2).translate(0, rimY + 0.0025, 0), s.fanWhite, 'fan-led-slot');
  }
  const grille: THREE.BufferGeometry[] = [];
  const gy = rimY + 0.008;
  const ring = (r: number, w = 0.0028, cx = 0, cz = 0) =>
    grille.push(new THREE.TorusGeometry(r, w, 5, 72).rotateX(Math.PI / 2).scale(1, 0.6, 1).translate(cx, gy, cz));
  ring(0.205, 0.005);
  ring(0.165);
  ring(0.035, 0.004);
  // rosette: eight circles through the centre, clipped by the outer ring visually
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ring(0.085, 0.0024, Math.cos(a) * 0.085, Math.sin(a) * 0.085);
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    grille.push(new THREE.BoxGeometry(0.04, 0.003, 0.003).translate(0.185, 0, 0).rotateY(-a).translate(0, gy, 0));
  }
  add(mergeGeometries(grille), s.cageWire, 'fan-grille');
  add(new THREE.CircleGeometry(0.033, 32).rotateX(Math.PI / 2).translate(0, gy - 0.001, 0), s.fanWhite, 'fan-grille-cap');
  fan.traverse(o => { o.castShadow = o.receiveShadow = true; });
  return fan;
}

/** Flush round in-ceiling speaker grille, Ø 0.16 (photo 204). */
function speaker(s: ShellMaterials) {
  const g = new THREE.Group();
  g.name = 'ceiling-speaker';
  g.add(mesh(new THREE.TorusGeometry(0.078, 0.004, 6, 48).rotateX(Math.PI / 2).scale(1, 0.5, 1).translate(0, CEILING - 0.002, 0), s.plateWhite, 'speaker-rim'));
  g.add(mesh(new THREE.CircleGeometry(0.076, 48).rotateX(Math.PI / 2).translate(0, CEILING - 0.0015, 0), s.speakerGrille, 'speaker-grille'));
  g.position.set(0.04, 0, -0.78);
  return g;
}

/** White stamped ceiling supply register against wall 1 (photos 6, 184, 204, 206): frame + louvers. */
function ceilingRegister(s: ShellMaterials) {
  const g = new THREE.Group();
  g.name = 'ceiling-register';
  const L = 0.76, D = 0.2, y = CEILING;
  const parts: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(L, 0.006, 0.02).translate(0, y - 0.003, -D / 2 + 0.01),
    new THREE.BoxGeometry(L, 0.006, 0.02).translate(0, y - 0.003, D / 2 - 0.01),
    new THREE.BoxGeometry(0.02, 0.006, D).translate(-L / 2 + 0.01, y - 0.003, 0),
    new THREE.BoxGeometry(0.02, 0.006, D).translate(L / 2 - 0.01, y - 0.003, 0),
  ];
  for (let i = 0; i < 9; i++) {
    parts.push(new THREE.BoxGeometry(L - 0.04, 0.012, 0.0015).rotateX(0.5).translate(0, y - 0.008, -D / 2 + 0.028 + i * 0.018));
  }
  g.add(mesh(mergeGeometries(parts), s.plateWhite, 'register'));
  g.add(mesh(new THREE.PlaneGeometry(L - 0.04, D - 0.04).rotateX(Math.PI / 2).translate(0, y - 0.0005, 0), s.darkGrille, 'register-duct'));
  g.position.set(-0.22, 0, -2.53);
  return g;
}

/** Decora switch plate (2.75" × 4.5") with one rocker, wall-local (+z out). */
function switchPlate(plate: THREE.Material, rocker: THREE.Material) {
  const g = new THREE.Group();
  g.name = 'switch';
  const shape = new THREE.Shape();
  const w = 0.0705, h = 0.1143, r = 0.004;
  shape.moveTo(-w / 2 + r, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2); shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  shape.lineTo(w / 2, h / 2 - r); shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(-w / 2 + r, h / 2); shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  shape.lineTo(-w / 2, -h / 2 + r); shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  g.add(mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2 }), plate, 'plate'));
  const rk = mesh(new THREE.BoxGeometry(0.033, 0.066, 0.006), rocker, 'rocker');
  rk.position.z = 0.006;
  rk.rotation.x = 0.04;
  g.add(rk);
  return g;
}

export function buildShell(m: Palette) {
  const s = shellMaterials(m);
  const { x0, x1, z0, z1 } = BOUNDS;
  const floor = mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), s.floor, 'floor');
  floor.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
  floor.castShadow = false;
  floor.receiveShadow = true;
  const uv = floor.geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0), uv.getY(i) * (z1 - z0));

  const ceiling = new THREE.Group();
  ceiling.name = 'ceiling';
  const slab = mesh(new THREE.PlaneGeometry(x1 - x0 + 0.4, z1 - z0 + 0.4).rotateX(Math.PI / 2), s.ceilingPaint, 'ceiling-slab');
  slab.position.set((x0 + x1) / 2, CEILING, (z0 + z1) / 2);
  ceiling.add(slab);
  ceiling.add(drumFan(s), speaker(s), ceilingRegister(s));

  // twelve cans: flange + lens merged into two draw calls, plus a soft halo on the ceiling
  const trimGeo = potTrimGeometry();
  const lensGeo = new THREE.CircleGeometry(0.047, 32).rotateX(Math.PI / 2);
  const trims: THREE.BufferGeometry[] = [], lenses: THREE.BufferGeometry[] = [];
  for (const [x, z] of POTS) {
    trims.push(trimGeo.clone().translate(x, CEILING, z));
    lenses.push(lensGeo.clone().translate(x, CEILING - 0.0055, z));
    const h = halo();
    h.position.set(x, CEILING - 0.0015, z);
    ceiling.add(h);
  }
  const potTrim = mesh(mergeGeometries(trims), s.potTrimWhite, 'pot-trims');
  potTrim.castShadow = false;
  const potLens = mesh(mergeGeometries(lenses), m.bulbGlow, 'pot-lenses');
  potLens.castShadow = false;
  ceiling.add(potTrim, potLens);

  const walls = WALLS.map((def, i) => {
    def.material = s.paint;
    def.trimMaterial = s.trimWhite;
    const group = buildWall(def, m, WALL_T);
    for (const o of WINDOWS.filter(x => x.wall === i)) group.add(windowUnit(def, o, s));
    group.add(trim(def, s));
    if (i === DOORWAY.wall) group.add(beyond(def, s));
    if (i === 2) group.add(cordW21(def, s));
    if (i === 0) group.add(onWall(switchPlate(s.plateWhite, s.plateWhite), def, 2.976 - 0.55, 1.33, 0.001));
    if (i === 3) group.add(onWall(switchPlate(s.plateBlack, s.plateBlack), def, -0.91 + 2.712, 1.30, 0.001));
    return { def, group };
  });
  return { floor, ceiling, walls, materials: s };
}
