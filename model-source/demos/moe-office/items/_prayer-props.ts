import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rng } from './_moe-kit';
import { beadStrand, extrudeShape, type P2, type P3, shapeFrom, smooth2, strands } from './_prayer-geo';
import type { PrayerMats } from './_prayer-mats';
import { CHEST } from './_prayer-chest';
import { stoneTex, bookCoverTex, bookSpineTex, burlTex, meshFabricTex, pageEdgeTex, pineTex } from './_prayer-tex';

/**
 * Things on the chest (stand-local frame, positions from rays intersected with the chest-top plane
 * in photos 66/199) and on the floor beside it (room frame, floor-plane intersections in photos
 * 60/199):
 * - oval burl tray (0.36 × 0.19, long axis front-to-back) with a single layer of pale turbah stones
 *   in its back half, a garnet tasbih, a tangle of silver/pearl strands in front and a red tassel;
 * - two standing hardbacks (navy Qur'an with gilt shamsa, dark green-black volume), spines out to
 *   the room, bases at lx 0.13 / 0.17 (rays in photo 66);
 * - the carved, scorched-pine calligraphy piece standing along its inlay-topped box, both running
 *   front-to-back at the chest's left (photos 64/65/66/67, triangulated) and a glass votive behind
 *   the tray; white/yellow tassels at the front corner;
 * - the cognac leather frame bag (0.40 long, its end at x −2.45) holding the grey mesh drawstring bag;
 * - the brass scroll floor register (0.30 × 0.146, rectified from photo 60) at x −2.79, z −0.11.
 */
const TOP = CHEST.top;

export function buildChestProps(m: PrayerMats): THREE.Group {
  const g = new THREE.Group();
  g.name = 'prayer-chest-props';
  g.add(buildTray(m), buildBooks(), buildCarving(m), buildVotive(m), cornerTassels());
  g.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
  });
  return g;
}

/**
 * Oval burl tray. Footprint measured on the chest-top plane in photo 66 (y 0.43, rays hit at
 * front tip lx −0.02 lz 0.40, sides lx −0.13 / +0.06): 0.36 × 0.19, long axis running FRONT TO
 * BACK (toward the room), nearly square to the chest. The pale turbah stones are heaped in the
 * back half (centre lx −0.05 lz 0.12), the pearl strands in the front half (lx −0.05 lz 0.32),
 * the garnet tasbih across the middle and the red tassel at the centre.
 * Group frame after the small yaw: +x ≈ +lx (right), +z ≈ +lz (front).
 */
function buildTray(m: PrayerMats) {
  void m;
  const g = new THREE.Group();
  g.name = 'prayer-tray';
  const L = 0.36, W = 0.19, rr = W / 2;
  const sh = new THREE.Shape();
  sh.absarc(0, L / 2 - rr, rr, 0, Math.PI, false);
  sh.absarc(0, -L / 2 + rr, rr, Math.PI, Math.PI * 2, false);
  const geo = extrudeShape(sh, 0.016, 0.005, 32);
  geo.rotateX(-Math.PI / 2);            // shape y -> -z (long axis along z); thickness up
  const tex = burlTex();
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.5, 4);
  // photo 66: a mid reddish-brown walnut burl, ~ (125,72,45) under the pot lights
  const wood = new THREE.MeshPhysicalMaterial({ map: tex, color: '#b49886', roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.32 });
  wood.name = 'prayer-burl';
  g.add(new THREE.Mesh(geo, wood));
  // a shallow dished floor: slightly darker inner oval just above the rim plane
  const floorShape = new THREE.Shape();
  floorShape.absarc(0, L / 2 - rr, rr - 0.012, 0, Math.PI, false);
  floorShape.absarc(0, -L / 2 + rr, rr - 0.012, Math.PI, Math.PI * 2, false);
  const floorGeo = new THREE.ShapeGeometry(floorShape, 24);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = wood.clone();
  floorMat.color.set('#a4887a');
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = 0.0165;
  g.add(floor);
  const surf = 0.016;

  // pale turbah stones (photo 66: grey-white, ~5 cm across, ~1.2 cm thick) spread in ONE layer over
  // the back half, two of them riding up on their neighbours
  const stone = new THREE.MeshStandardMaterial({ color: '#ebe7e1', roughness: 0.85, map: stoneTex() });
  const stoneDark = new THREE.MeshStandardMaterial({ color: '#c9c2b8', roughness: 0.88, map: stoneTex() });
  const r = rng(5);
  const discs: [number, number, number, number][] = [
    [-0.03, -0.142, 0.025, 0], [0.022, -0.138, 0.027, 0], [-0.056, -0.098, 0.024, 0],
    [-0.006, -0.098, 0.026, 0], [0.05, -0.092, 0.025, 0], [-0.05, -0.048, 0.025, 0],
    [0.004, -0.046, 0.024, 0], [0.054, -0.04, 0.023, 0], [-0.03, -0.005, 0.024, 0],
    [0.03, 0.0, 0.025, 0], [-0.025, -0.072, 0.023, 1], [0.03, -0.068, 0.024, 1],
  ];
  discs.forEach(([x, z, rad, stack], i) => {
    const t = 0.011 + r() * 0.004;
    const geoD = new THREE.CylinderGeometry(rad, rad * 1.03, t, 24);
    const d = new THREE.Mesh(geoD, i % 3 ? stone : stoneDark);
    d.position.set(x, surf + t / 2 + stack * 0.008, z);
    d.rotation.set((r() - 0.5) * 0.08 + stack * 0.22, r() * 3, (r() - 0.5) * 0.08 + stack * 0.18);
    g.add(d);
  });
  // garnet tasbih looping over the middle of the heap
  const garnet = new THREE.MeshPhysicalMaterial({ color: '#4a1414', roughness: 0.25, clearcoat: 0.8 });
  const loop: P3[] = [];
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    loop.push([0.028 + Math.cos(a) * 0.045, surf + 0.02 + 0.008 * Math.sin(a * 2 + 0.5), -0.03 + Math.sin(a) * 0.042]);
  }
  g.add(beadStrand(loop, 0.0048, garnet, { seed: 3 }));
  const amber = new THREE.MeshPhysicalMaterial({ color: '#a2481f', roughness: 0.3, clearcoat: 0.6 });
  const loop2: P3[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    loop2.push([0.045 + Math.cos(a) * 0.03, surf + 0.008 + 0.004 * Math.cos(a * 3), 0.045 + Math.sin(a) * 0.05]);
  }
  g.add(beadStrand(loop2, 0.0038, amber, { seed: 4 }));
  // the silver / pearl strands: a tangled mound over the front half (photos 61/64/66)
  // photo 66: mostly silver-grey metal bead chains with a few pearl strands, a low tangle
  const silver = new THREE.MeshPhysicalMaterial({ color: '#b9b6ae', metalness: 0.85, roughness: 0.28, clearcoat: 0.5 });
  const pearl = new THREE.MeshPhysicalMaterial({ color: '#d8d0c2', roughness: 0.3, clearcoat: 0.7, sheen: 0.4, sheenColor: new THREE.Color('#ffffff') });
  for (let k = 0; k < 15; k++) {
    const pts: P3[] = [];
    const cx = -0.05 + r() * 0.07, cz = 0.04 + r() * 0.1, rx = 0.014 + r() * 0.026, rz = 0.016 + r() * 0.032, ph = r() * 6;
    const dome = 1 - Math.min(1, Math.hypot((cx + 0.015) / 0.05, (cz - 0.09) / 0.07));
    const lift = (k % 3) * 0.004 * (0.4 + dome);
    for (let i = 0; i <= 22; i++) {
      const a = ph + (i / 22) * Math.PI * (2.1 + r() * 0.5);
      pts.push([cx + Math.cos(a) * rx, surf + 0.004 + lift + r() * 0.003, cz + Math.sin(a) * rz]);
    }
    g.add(beadStrand(pts, k % 2 ? 0.0034 : 0.0028, k % 4 === 0 ? pearl : silver, { seed: 50 + k, jitter: 0.06 }));
  }
  // strands spilling over the front-left rim (photo 66)
  for (const [sx, seed] of [[-0.05, 71], [-0.015, 72]] as const) {
    const spill: P3[] = [[sx + 0.01, surf + 0.006, 0.13], [sx, surf + 0.005, 0.16], [sx - 0.008, surf - 0.004, 0.182], [sx - 0.012, surf - 0.026, 0.188]];
    g.add(beadStrand(spill, 0.0034, pearl, { seed }));
  }
  // a thin chain draping over the front rim and hanging down its face (photo 61)
  {
    const chain: P3[] = [[0.02, surf + 0.002, 0.14], [0.025, surf + 0.005, 0.165], [0.03, surf + 0.002, 0.18],
      [0.032, -0.012, 0.185], [0.034, -0.045, 0.188], [0.033, -0.062, 0.189]];
    g.add(beadStrand(chain, 0.0018, silver, { seed: 88, spacing: 0.005 }));
  }
  // red felt tassel with a pale shell disc at the centre of the tray (photo 66)
  const felt = new THREE.MeshStandardMaterial({ color: '#b51f2c', roughness: 0.95 });
  const tasselLines: P3[][] = [];
  const tx = 0.0, tz = 0.015;
  for (let i = 0; i < 24; i++) {
    const a = r() * Math.PI * 2;
    tasselLines.push([[tx, surf + 0.05, tz], [tx + Math.cos(a) * 0.01, surf + 0.034, tz + Math.sin(a) * 0.01], [tx + Math.cos(a) * 0.022, surf + 0.018, tz + Math.sin(a) * 0.022]]);
  }
  g.add(new THREE.Mesh(strands(tasselLines, 0.0013, 3), felt));
  const capd = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), felt);
  capd.scale.y = 0.8;
  capd.position.set(tx, surf + 0.052, tz);
  g.add(capd);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.003, 18), pearl);
  disc.rotation.set(0.25, r(), 0.4);
  disc.position.set(tx + 0.01, surf + 0.016, tz + 0.02);
  g.add(disc);

  g.position.set(-0.03, TOP, 0.215);
  g.rotation.y = 0.05;
  return g;
}

function buildBooks() {
  const g = new THREE.Group();
  g.name = 'prayer-books';
  const pages = new THREE.MeshStandardMaterial({ map: pageEdgeTex(), roughness: 0.9 });
  // photos 64/66/61, high and in front: the cream page-tops dominate and the gilt spine
  // is the near face. Covers face left/right (the medallion is only a side view).
  const specs: { base: string; h: number; w: number; t: number; x: number; z: number; lean: number; seed: number }[] = [
    { base: '#101828', h: 0.20, w: 0.145, t: 0.034, x: 0.13, z: 0.245, lean: 0.04, seed: 2 },
    { base: '#0d130e', h: 0.228, w: 0.158, t: 0.042, x: 0.176, z: 0.232, lean: 0.05, seed: 3 },
  ];
  for (const b of specs) {
    const cover = new THREE.MeshStandardMaterial({ map: bookCoverTex(b.base, '#8a7444', b.seed), roughness: 0.62, metalness: 0.05 });
    const spine = new THREE.MeshStandardMaterial({ map: bookSpineTex(b.base, '#8a7444'), roughness: 0.62 });
    const book = new THREE.Group();
    // boards (slightly larger than the block) + page block
    const block = new THREE.Mesh(new THREE.BoxGeometry(b.t - 0.006, b.h - 0.008, b.w - 0.006),
      [pages, pages, pages, pages, pages, pages]);
    block.position.z = -0.003;
    book.add(block);
    for (const s of [-1, 1]) {
      const board = new THREE.Mesh(new RoundedBoxGeometry(0.0035, b.h, b.w, 1, 0.0012), [cover, cover, cover, cover, cover, cover]);
      board.position.x = s * (b.t / 2 - 0.0018);
      if (s < 0) board.rotation.y = Math.PI;
      book.add(board);
    }
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(b.t / 2, b.t / 2, b.h, 16, 1, false, -Math.PI / 2, Math.PI), spine);
    sp.position.z = b.w / 2 - 0.004;
    sp.scale.z = 0.35;
    book.add(sp);
    book.rotation.y = 0.12;                   // spine → front (+lz), covers → ±lx
    // lean is applied outside so it tips toward +lx (against each other / the beads, photo 67)
    const wrap = new THREE.Group();
    wrap.rotation.z = -b.lean;
    wrap.add(book);
    wrap.position.set(b.x, TOP + b.h / 2 * Math.cos(b.lean), b.z);
    g.add(wrap);
  }
  return g;
}

/**
 * Carved scorched-pine calligraphy piece on its mother-of-pearl box (photos 64/65/66/67).
 * Measured, not guessed:
 * - the word stands in a VERTICAL plane running front-to-back along the box. Plane rectified from
 *   photos 64/66/67 (all three agree): through stand-local (−0.225, 0.315), direction
 *   (0.262, −0.965); s runs from the front end (0) to the back (0.25), h = height above the chest;
 * - triangulated (ray gaps ≤ 6 mm, photos 64/66/67): cap top h 0.375 at s 0.08; loop's outer
 *   edge at the front h ~0.19; bowl tail at the back s 0.24, h 0.05–0.065;
 * - the box is thin and its inlay is on its TOP face (photo 65), 0.25 long, its far edge ~0.05 on
 *   the +lx side of the word plane (photo 66 rectified at y 0.444 → prayer-inlay.jpg).
 * Word outline read from the rectified plane: an upright stroke (s 0.06–0.105) with a slanted cap,
 * a slatted head block reaching forward at h 0.24–0.30, a big C loop at the front (h 0.10–0.27)
 * with two openwork strokes inside, and a long bowl sweeping back along the box (h 0.05–0.10)
 * whose tail lifts at the back end. Board 28 mm, honey faces, scorched edges.
 */
function buildCarving(m: PrayerMats) {
  const g = new THREE.Group();
  g.name = 'prayer-carved-stand';
  const inlayTex = m.textures.inlay;
  inlayTex.wrapT = THREE.RepeatWrapping;
  inlayTex.repeat.set(1, -1);           // image top (t = +0.05) on the +z side of the box
  inlayTex.offset.set(0, 1);
  const inlay = new THREE.MeshStandardMaterial({ map: inlayTex, roughness: 0.3, metalness: 0.05 });
  inlay.name = 'prayer-shell-inlay';
  const pineMap = pineTex();
  pineMap.wrapS = pineMap.wrapT = THREE.RepeatWrapping;
  pineMap.repeat.set(9, 9);
  const pine = new THREE.MeshStandardMaterial({ map: pineMap, roughness: 0.64 });
  pine.name = 'prayer-pine';
  const burnt = new THREE.MeshStandardMaterial({ map: pineMap, color: '#6e4626', roughness: 0.78 });
  burnt.name = 'prayer-pine-scorched';
  const boxWood = new THREE.MeshStandardMaterial({ map: pineMap, color: '#d8b48a', roughness: 0.55 });

  // the box: two stacked thin boards, inlay panel on top (x = s along the box, z = across, +z → +lx)
  const L = 0.25;
  const base = new THREE.Mesh(new RoundedBoxGeometry(L + 0.012, 0.011, 0.08, 1, 0.002), boxWood);
  base.position.set(L / 2, 0.0055, 0.014);
  const top = new THREE.Mesh(new RoundedBoxGeometry(L + 0.004, 0.012, 0.072, 1, 0.002), boxWood);
  top.position.set(L / 2, 0.017, 0.014);
  const panelGeo = new THREE.PlaneGeometry(L - 0.002, 0.062);
  panelGeo.rotateX(-Math.PI / 2);
  const panel = new THREE.Mesh(panelGeo, inlay);
  panel.position.set(L / 2, 0.0232, 0.019);
  g.add(base, top, panel);

  // the word, in the local xy plane (x = s, y = h above the chest top), centred at z = −0.005
  const T = 0.028;
  const addPart = (pts: P2[], holes: P2[][] = [], depth = T, z = -0.005) => {
    const geo = extrudeShape(shapeFrom(pts, holes), depth, 0.0025, 16);
    geo.translate(0, 0, z - depth / 2);
    g.add(new THREE.Mesh(geo, [pine, burnt]));
  };
  // upright stroke, faintly leaning forward at its head: an open frame of two rails with a long
  // slot between them (photo 64/65 close-ups), not a solid board
  addPart([[0.064, 0.03], [0.1, 0.03], [0.104, 0.352], [0.07, 0.352]],
    [[[0.075, 0.115], [0.089, 0.115], [0.092, 0.33], [0.079, 0.33]]]);
  // slanted cap block
  addPart([[0.05, 0.346], [0.11, 0.34], [0.11, 0.366], [0.054, 0.388]], [], 0.032, -0.004);
  // slatted head block reaching forward, three slots cut through
  {
    const yb = (x: number) => 0.236 + (x + 0.012) * 0.28;
    const yt = (x: number) => 0.282 + (x + 0.008) * 0.3;
    const slots: P2[][] = [0.003, 0.022, 0.041].map(x0 => [
      [x0, yb(x0) + 0.007], [x0 + 0.012, yb(x0 + 0.012) + 0.007], [x0 + 0.012, yt(x0 + 0.012) - 0.007], [x0, yt(x0) - 0.007],
    ] as P2[]);
    addPart([[-0.012, yb(-0.012)], [0.072, yb(0.072)], [0.072, yt(0.072)], [-0.008, yt(-0.008)]], slots, 0.03, -0.004);
  }
  // the big C loop at the front, open toward the upright
  {
    // a thin band (~15 mm): the loop is mostly air, its counter crossed by openwork strokes
    const cx = 0.012, cy = 0.18, rxo = 0.043, ryo = 0.088, rxi = 0.028, ryi = 0.072;
    const a0 = THREE.MathUtils.degToRad(68), a1 = THREE.MathUtils.degToRad(300), n = 28;
    const pts: P2[] = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + Math.cos(a) * rxo, cy + Math.sin(a) * ryo]); }
    for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + Math.cos(a) * rxi, cy + Math.sin(a) * ryi]); }
    addPart(pts);
  }
  // two openwork strokes inside the loop and a tie to the upright
  addPart([[-0.004, 0.118], [0.006, 0.114], [0.046, 0.238], [0.036, 0.242]], [], 0.02, -0.004);
  addPart([[0.02, 0.108], [0.03, 0.106], [0.064, 0.21], [0.055, 0.213]], [], 0.02, -0.004);
  addPart([[-0.024, 0.196], [-0.014, 0.19], [0.006, 0.236], [-0.004, 0.24]], [], 0.018, -0.004);
  addPart([[-0.018, 0.146], [0.064, 0.16], [0.064, 0.17], [-0.018, 0.156]], [], 0.018, -0.004);
  addPart([[-0.02, 0.212], [0.064, 0.222], [0.064, 0.231], [-0.02, 0.221]], [], 0.016, -0.004);
  // long bowl: a broad board ramping DOWN from the loop's foot to the back of the box (triangulated
  // tail top only h 0.065; its upper edge projected onto photo 66 sits at h ~0.12 near the upright),
  // its tip lifting a little at the back; we mostly see its top edge
  addPart(smooth2([
    [0.0, 0.08], [0.05, 0.062], [0.12, 0.044], [0.18, 0.034], [0.225, 0.034], [0.252, 0.05], [0.266, 0.082],
    [0.25, 0.088], [0.236, 0.066], [0.208, 0.062], [0.16, 0.07], [0.11, 0.088], [0.06, 0.108], [0.02, 0.118],
  ], 64, true), [], 0.034, -0.004);
  // foot under the loop and upright
  addPart([[-0.002, 0.0232], [0.102, 0.0232], [0.102, 0.072], [-0.002, 0.08]], [], 0.024, -0.005);

  // origin at the plane's front point; local +x along the box toward the back board
  g.position.set(-0.225, TOP, 0.315);
  g.rotation.y = Math.atan2(0.965, 0.262);
  return g;
}

function buildVotive(m: PrayerMats) {
  const g = new THREE.Group();
  g.name = 'prayer-votive';
  const glass = new THREE.MeshPhysicalMaterial({ color: '#e8eef0', roughness: 0.05, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.024, 0.045, 24, 1, true), glass);
  cup.position.y = 0.0225;
  g.add(cup);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.006, 24), glass);
  base.position.y = 0.003;
  g.add(base);
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.016, 20), m.ivory);
  candle.position.y = 0.014;
  g.add(candle);
  const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.0195, 0.0195, 0.012, 20, 1, true), new THREE.MeshStandardMaterial({ color: '#c8c8c4', metalness: 0.9, roughness: 0.3 }));
  tin.position.y = 0.012;
  g.add(tin);
  g.position.set(-0.07, TOP, 0.03);
  return g;
}

/** pale and yellow tassels hanging down over the chest's front-right corner (photos 58/60/61) */
function cornerTassels() {
  const r = rng(61);
  const white = new THREE.MeshStandardMaterial({ color: '#eee9dc', roughness: 0.9 });
  const yellow = new THREE.MeshStandardMaterial({ color: '#d9bd4a', roughness: 0.85 });
  const g = new THREE.Group();
  g.name = 'prayer-tassels';
  for (const [x, z, mat, len] of [[0.205, 0.352, white, 0.075], [0.218, 0.338, yellow, 0.06], [0.192, 0.362, white, 0.085]] as const) {
    const lines: P3[][] = [];
    for (let i = 0; i < 26; i++) {
      const dx = (r() - 0.5) * 0.012, dz = (r() - 0.5) * 0.012;
      const l = len * (0.7 + r() * 0.4);
      lines.push([[x, TOP + 0.006, z], [x + dx * 0.6, TOP - l * 0.35, z + dz * 0.6], [x + dx * 2.2, TOP - l, z + dz * 2.2]]);
    }
    g.add(new THREE.Mesh(strands(lines, 0.0007, 3), mat));
  }
  return g;
}

// ------------------------------------------------------------------ floor (room frame)

export function buildFloorProps(m: PrayerMats): THREE.Group {
  const g = new THREE.Group();
  g.name = 'prayer-floor-props';
  g.add(buildBags(m), buildRegister(m));
  g.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
  });
  return g;
}

/** cognac leather frame bag (doctor's-bag style), open, with the grey mesh drawstring bag in it.
 *  Photos 58/60/63: the bag is low and long (top ~0.30, long axis along the wall), deep oxblood
 *  leather with the pale lining showing at its open mouth; the grey sack slumps out of the mouth
 *  toward the chest, cinched low with the cord hanging down its flank. */
function buildBags(m: PrayerMats) {
  const g = new THREE.Group();
  g.name = 'prayer-bags';
  const leather = new THREE.MeshPhysicalMaterial({
    color: '#3a120a', roughness: 0.48, roughnessMap: m.textures.leatherRough, normalMap: m.textures.leatherNor,
    normalScale: new THREE.Vector2(0.4, 0.4), clearcoat: 0.5, clearcoatRoughness: 0.3,
  });
  leather.name = 'prayer-cognac-leather';
  const lining = new THREE.MeshStandardMaterial({ color: '#3e2a1c', roughness: 0.85, side: THREE.DoubleSide });

  // body: tapered profile (across z, height y) extruded along the bag's length (x)
  const L = 0.42, Wb = 0.17, Wt = 0.135, H = 0.30;
  const prof = new THREE.Shape();
  prof.moveTo(-Wb / 2 + 0.02, 0);
  prof.lineTo(Wb / 2 - 0.02, 0);
  prof.quadraticCurveTo(Wb / 2, 0, Wb / 2, 0.02);
  prof.lineTo(Wt / 2, H);
  prof.lineTo(Wt / 2 - 0.008, H);
  prof.lineTo(Wb / 2 - 0.008, 0.02);
  prof.lineTo(-Wb / 2 + 0.008, 0.02);
  prof.lineTo(-Wt / 2 + 0.008, H);
  prof.lineTo(-Wt / 2, H);
  prof.lineTo(-Wb / 2, 0.02);
  prof.quadraticCurveTo(-Wb / 2, 0, -Wb / 2 + 0.02, 0);
  const shell = extrudeShape(prof, L - 0.016, 0.006, 8);
  shell.translate(0, 0, -(L - 0.016) / 2);
  const bag = new THREE.Group();
  const body = new THREE.Mesh(shell, leather);
  body.rotation.y = Math.PI / 2;            // extrusion along x
  bag.add(body);
  // end gussets (rounded) with a slight inward pleat
  for (const s of [-1, 1]) {
    const end = new THREE.Shape();
    end.moveTo(-Wb / 2, 0.01);
    end.quadraticCurveTo(-Wb / 2, 0, -Wb / 2 + 0.02, 0);
    end.lineTo(Wb / 2 - 0.02, 0);
    end.quadraticCurveTo(Wb / 2, 0, Wb / 2, 0.01);
    end.lineTo(Wt / 2, H);
    end.quadraticCurveTo(0, H - 0.03, -Wt / 2, H);
    const eg = extrudeShape(end, 0.008, 0.003, 8);
    const e = new THREE.Mesh(eg, leather);
    e.rotation.y = Math.PI / 2;
    e.position.x = s * (L / 2) - (s > 0 ? 0.008 : 0);
    bag.add(e);
  }
  // frame mouth: two rolled lips along the top
  for (const s of [-1, 1]) {
    const lip = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, L - 0.03, 4, 10), leather);
    lip.rotation.z = Math.PI / 2;
    lip.position.set(0, H + 0.004, s * (Wt / 2 - 0.002));
    bag.add(lip);
  }
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.03, Wt - 0.02), lining);
  inside.rotation.x = -Math.PI / 2;
  inside.position.y = H - 0.07;
  bag.add(inside);
  // pale lining visible in the mouth's right end (photo 60)
  const endLining = new THREE.Mesh(new THREE.PlaneGeometry(Wt - 0.02, 0.09), lining);
  endLining.rotation.y = -Math.PI / 2;
  endLining.position.set(L / 2 - 0.035, H - 0.045, 0);
  bag.add(endLining);
  // brass D-rings, clasp and base studs
  for (const s of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0022, 8, 16, Math.PI * 1.2), m.brass);
    ring.position.set(s * (L / 2 - 0.035), H - 0.012, Wt / 2 + 0.006);
    ring.rotation.z = -Math.PI * 0.1;
    bag.add(ring);
    const tab = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.025, 0.004, 2, 0.0015), leather);
    tab.position.set(s * (L / 2 - 0.035), H - 0.03, Wt / 2 + 0.004);
    bag.add(tab);
  }
  const clasp = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.022, 0.006, 2, 0.002), m.brass);
  clasp.position.set(0, H - 0.02, -Wt / 2 - 0.004);
  bag.add(clasp);
  // doctor's-bag silhouette: the ends lean in toward the frame mouth (bake, then taper along x by height)
  bag.updateMatrixWorld(true);
  for (const child of [...bag.children]) {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) continue;
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrix);
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const y = Math.max(0, Math.min(H + 0.02, p.getY(i)));
      const k = 1 - 0.13 * (y / H) ** 1.4;
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * (1 + 0.05 * Math.sin((y / H) * Math.PI)));
    }
    geo.computeVertexNormals();
    mesh.geometry = geo;
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
  }
  bag.position.set(-2.635, 0, 0.35);
  bag.rotation.y = 0.06;
  g.add(bag);

  // grey mesh drawstring bag slumping out of the mouth toward the chest (photo 63)
  const fabric = meshFabricTex();
  fabric.repeat.set(4, 3);              // ~5 mm knit cells (photo 199)
  const grey = new THREE.MeshStandardMaterial({ map: fabric, color: '#c6c8c8', roughness: 0.92, normalMap: m.textures.linenNor, normalScale: new THREE.Vector2(0.6, 0.6) });
  grey.name = 'prayer-grey-mesh';
  const lathePts: THREE.Vector2[] = [];
  const prof2: [number, number][] = [[0.0, 0.0], [0.05, 0.004], [0.07, 0.05], [0.082, 0.12], [0.095, 0.2], [0.102, 0.27], [0.092, 0.315], [0.058, 0.34], [0.02, 0.352], [0.006, 0.355]];
  for (const [rr, y] of prof2) lathePts.push(new THREE.Vector2(rr, y));
  const sack = new THREE.LatheGeometry(new THREE.SplineCurve(lathePts).getPoints(30), 48);
  // gathers: radial pleats strongest toward the drawstring
  const p = sack.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const rad = Math.hypot(x, z);
    const tY = y / 0.355;
    const pleat = 1 + Math.sin(a * 11 + Math.sin(a * 3) * 1.6 + y * 10) * (0.012 + 0.12 * Math.pow(tY, 4)) + Math.sin(a * 2 + y * 14) * 0.055 + Math.sin(a * 3 - y * 9) * 0.04;
    p.setX(i, Math.cos(a) * rad * pleat);
    p.setZ(i, Math.sin(a) * rad * pleat * 0.85);
  }
  sack.computeVertexNormals();
  const sackMesh = new THREE.Mesh(sack, grey);
  const pucker = new THREE.Mesh(new THREE.CircleGeometry(0.007, 16), new THREE.MeshStandardMaterial({ color: '#141616', roughness: 0.9 }));
  pucker.rotation.x = -Math.PI / 2;
  pucker.position.y = 0.3545;
  sackMesh.add(pucker);
  // photos 58/199: it stands tall in the bag's room end (top ~0.47), leaning a little to the chest
  const SX = -2.585, SY = 0.12, SZ = 0.36, TILT = 0.14;
  sackMesh.position.set(SX, SY, SZ);
  sackMesh.rotation.set(TILT, 0.25, -0.05);
  sackMesh.scale.set(1.05, 1, 0.85);
  g.add(sackMesh);
  // drawstring wrapped at the neck with its tail hanging down the chest-side flank (photo 63)
  const cord = new THREE.MeshStandardMaterial({ color: '#17181a', roughness: 0.6 });
  const neckY = SY + 0.315 * Math.cos(TILT), neckZ = SZ + 0.315 * Math.sin(TILT), neckX = SX;
  const tie: P3[] = [[neckX - 0.005, neckY + 0.01, neckZ - 0.02], [neckX, neckY, neckZ], [neckX + 0.01, neckY - 0.03, neckZ + 0.03],
    [neckX + 0.012, neckY - 0.09, neckZ + 0.055], [neckX + 0.008, neckY - 0.14, neckZ + 0.05]];
  g.add(new THREE.Mesh(strands([tie], 0.0022, 6), cord));
  const toggle = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.016, 10), cord);
  toggle.position.set(neckX + 0.011, neckY - 0.115, neckZ + 0.053);
  toggle.rotation.set(0.4, 0, 0.2);
  g.add(toggle);
  const label = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.024, 0.012), new THREE.MeshStandardMaterial({ color: '#e7e1dd', roughness: 0.7 }));
  label.position.set(SX + 0.098, 0.33, SZ + 0.02);
  g.add(label);
  return g;
}

function buildRegister(m: PrayerMats) {
  const g = new THREE.Group();
  g.name = 'prayer-floor-register';
  const L = 0.298, W = 0.146;
  const face = new THREE.MeshStandardMaterial({ map: m.textures.register, alphaTest: 0.5, metalness: 0.75, roughness: 0.32, color: '#f4e7c4' });
  face.name = 'prayer-register-brass';
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(L, W), face);
  plate.rotation.set(-Math.PI / 2, 0, 0);
  plate.position.y = 0.0032;
  // texture u runs +z -> -z, v runs wall (top) -> room (bottom)
  plate.rotation.z = Math.PI / 2;
  g.add(plate);
  const rim = new THREE.MeshStandardMaterial({ color: '#c8ac6a', metalness: 0.8, roughness: 0.3 });
  for (const [dx, dz, w, l] of [[-W / 2 + 0.004, 0, 0.008, L], [W / 2 - 0.004, 0, 0.008, L], [0, L / 2 - 0.004, W, 0.008], [0, -L / 2 + 0.004, W, 0.008]] as const) {
    const e = new THREE.Mesh(new RoundedBoxGeometry(w, 0.004, l, 1, 0.0015), rim);
    e.position.set(dx, 0.0018, dz);
    g.add(e);
  }
  const duct = new THREE.Mesh(new THREE.BoxGeometry(W - 0.03, 0.002, L - 0.03), new THREE.MeshBasicMaterial({ color: '#070707' }));
  duct.position.y = 0.0012;
  g.add(duct);
  g.position.set(-2.79, 0, -0.112);
  return g;
}
