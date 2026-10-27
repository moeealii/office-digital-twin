import * as THREE from 'three';
import { at, canvasTex, cyl, mesh, rbox, rng, tube } from './_moe-kit';
import type { FireplaceMats } from './_fireplace-mats';
import { inst, lathe, logMesh } from './_fireplace-geo';

/**
 * The linear electric fireplace on wall 1 and its white marble hearth.
 *
 * Photos 12/13/14/16/17/18/21/28/29 all agree on the wall-plane rectangle once the stored camera
 * is checked against the baseboard line (projected y = 0.14 and 0.86 land on the trim and the top
 * edge): x −0.73 … +0.80, y 0.346 … 0.860 — a 60-inch class unit, 1.53 × 0.514 m. It is a
 * WALL-HANGING box, not a hearth-mounted firebox: photo 29, shot from 1.2 m, sees its horizontal
 * top with a perforated hot-air grille and the bilingual "DO NOT MOVE THE UNIT" sticker on it.
 * The unit is OFF at night: near-black glass with the room reflected in it, the crystal media bed
 * and three driftwood logs behind the glass, and no lamp at all (the old draft's orange glow strip
 * and its point light were wrong).
 *
 * Local frame (the wall's own): +x along the wall, +y up from the unit's underside, +z into the
 * room from the wall face.
 */
export const FIRE = {
  u0: 2.246, u1: 3.776,
  v0: 0.346, v1: 0.860,
  depth: 0.098,
  frame: 0.018,
  bedY: 0.130,
};
export const FIRE_W = FIRE.u1 - FIRE.u0;
export const FIRE_H = FIRE.v1 - FIRE.v0;
export const FIRE_U = (FIRE.u0 + FIRE.u1) / 2;

/** Hearth: a flush white-marble inlay on the floor, 0.60 m deep, wider than the unit. */
export const HEARTH = { w: 2.30, d: 0.61, t: 0.008 };

export function buildFireplace(m: FireplaceMats) {
  const g = new THREE.Group();
  g.name = 'electric-fireplace';
  const W = FIRE_W, H = FIRE_H, D = FIRE.depth;
  const f = FIRE.frame;

  // --- casing: four frame bars + a recessed interior --------------------------------------
  const topBar = rbox(W, f, D, 0.003, m.fireEdge, 2);
  at(topBar, 0, H - f / 2, D / 2);
  g.add(topBar);
  const bottomBar = rbox(W, f, D, 0.003, m.fireEdge, 2);
  at(bottomBar, 0, f / 2, D / 2);
  g.add(bottomBar);
  for (const sx of [-1, 1]) {
    const side = rbox(f, H - f * 2, D, 0.003, m.fireFrame, 2);
    at(side, sx * (W / 2 - f / 2), H / 2, D / 2);
    g.add(side);
  }
  // back + interior liners
  g.add(at(rbox(W - f * 2, H - f * 2, 0.012, 0.002, m.fireInterior, 2), 0, H / 2, 0.008));
  g.add(at(rbox(W - f * 2, 0.012, D - f - 0.012, 0.002, m.fireInterior, 2), 0, FIRE.bedY - 0.006, (D - f) / 2));
  for (const sy of [-1, 1]) {
    g.add(at(rbox(W - f * 2, 0.01, D - f, 0.002, m.fireInterior, 2), 0, sy > 0 ? H - f - 0.006 : FIRE.bedY + 0.005, (D - f) / 2 + 0.008));
  }

  // --- glass front ------------------------------------------------------------------------
  const gw = W - f * 2 - 0.004;
  const ventH = 0.032;
  const gh = H - f * 2 - 0.004 - ventH;
  const glass = mesh(new THREE.PlaneGeometry(gw, gh), m.fireGlass, 'firebox-glass');
  at(glass, 0, f + 0.002 + gh / 2, D - 0.004);
  glass.receiveShadow = false;
  glass.castShadow = false;
  g.add(glass);

  // perforated vent band across the top of the front, under the top rail
  const vent = mesh(new THREE.PlaneGeometry(gw, ventH), m.ventGrille, 'firebox-vent');
  at(vent, 0, H - f - ventH / 2 - 0.002, D - 0.0025);
  g.add(vent);

  // the factory warning sticker, right of centre on the vent band (photos 17/18/21/29)
  const label = mesh(new THREE.PlaneGeometry(0.088, 0.019), m.warningLabel, 'firebox-label');
  at(label, 0.30, H - f - ventH / 2 - 0.002, D - 0.0018);
  g.add(label);
  // the perforated grille also runs across the visible top face (photo 29)
  const topVent = mesh(new THREE.PlaneGeometry(W - f * 2, D - f - 0.01), m.ventGrille, 'firebox-top-vent');
  topVent.rotation.x = -Math.PI / 2;
  at(topVent, 0, H + 0.0008, D / 2 + 0.004);
  g.add(topVent);

  // --- media bed: crystal chips + three driftwood logs (photos 17/18/21) --------------------
  g.add(crystalBed(m, gw - 0.04, FIRE.bedY, D));
  g.add(logs(m, FIRE.bedY, D));

  // a hairline shadow gap between the unit and the wall, so the box reads as hung, not painted on
  const gap = mesh(new THREE.PlaneGeometry(W + 0.01, 0.012), new THREE.MeshBasicMaterial({ color: '#171716' }));
  gap.rotation.x = -Math.PI / 2;
  at(gap, 0, 0.001, 0.006);
  g.add(gap);
  return g;
}

function crystalBed(m: FireplaceMats, width: number, y: number, depth: number) {
  const g = new THREE.Group();
  g.name = 'firebox-crystals';
  const r = rng(17);
  const mats: THREE.Matrix4[] = [];
  const bright: THREE.Matrix4[] = [];
  const cols = 34, rows = 5;
  for (let i = 0; i < cols; i++) {
    const x = -width / 2 + (i + 0.5) * (width / cols) + (r() - 0.5) * 0.01;
    for (let j = 0; j < rows; j++) {
      const z = 0.026 + j * 0.013 + (r() - 0.5) * 0.008;
      const s = 0.85 + r() * 1.15;
      const mtx = new THREE.Matrix4().compose(
        new THREE.Vector3(x, y + 0.006 + r() * 0.012, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)),
        new THREE.Vector3(s, s * (0.6 + r() * 0.8), s),
      );
      (r() < 0.35 ? bright : mats).push(mtx);
    }
  }
  const shard = new THREE.TetrahedronGeometry(0.0125, 0);
  g.add(inst(shard, m.crystalClear, mats, 'crystals-clear'));
  g.add(inst(shard, m.crystalWhite, bright, 'crystals-bright'));
  // a fine glitter layer sits right behind the front glass, where the photo's highlights are
  const glitter: THREE.Matrix4[] = [];
  for (let i = 0; i < 150; i++) {
    const x = -width / 2 + r() * width;
    const z = depth - 0.022 - r() * 0.02;
    const s = 0.25 + r() * 0.4;
    glitter.push(new THREE.Matrix4().compose(
      new THREE.Vector3(x, y + 0.004 + r() * 0.02, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)),
      new THREE.Vector3(s, s, s),
    ));
  }
  g.add(inst(shard, m.crystalWhite, glitter, 'crystals-glitter'));
  // the bed's tray, with a pale reflector under the chips: the photo's bed glows cold even off
  const tray = rbox(width + 0.01, 0.012, depth - 0.03, 0.002, m.fireFrame, 2);
  at(tray, 0, y - 0.004, (depth - 0.03) / 2 + 0.016);
  g.add(tray);
  const mirrorBed = new THREE.Mesh(new THREE.PlaneGeometry(width, depth - 0.05), m.crystalWhite);
  mirrorBed.rotation.x = -Math.PI / 2;
  at(mirrorBed, 0, y + 0.001, (depth - 0.05) / 2 + 0.028);
  mirrorBed.receiveShadow = false;
  g.add(mirrorBed);
  return g;
}

function logs(m: FireplaceMats, y: number, depth: number) {
  const g = new THREE.Group();
  g.name = 'firebox-logs';
  const z = depth * 0.52;
  g.add(logMesh([[-0.42, y + 0.028, z - 0.012], [-0.14, y + 0.034, z + 0.006], [0.12, y + 0.030, z + 0.014], [0.40, y + 0.024, z + 0.004]], 0.030, 0.021, m.driftwood, 5, 24));
  g.add(logMesh([[-0.52, y + 0.022, z + 0.02], [-0.2, y + 0.026, z - 0.018], [0.06, y + 0.031, z + 0.004]], 0.021, 0.026, m.driftwood, 9, 20));
  g.add(logMesh([[0.02, y + 0.030, z + 0.026], [0.30, y + 0.026, z + 0.01], [0.55, y + 0.021, z - 0.012]], 0.026, 0.017, m.driftwood, 13, 20));
  // stubs: two short branches, as the photo's driftwood has
  g.add(tube([[-0.24, y + 0.05, z], [-0.20, y + 0.085, z + 0.012]], 0.009, m.driftwood, 8, 5));
  g.add(tube([[0.26, y + 0.045, z + 0.01], [0.31, y + 0.075, z - 0.004]], 0.008, m.driftwood, 8, 5));
  return g;
}

/** The flush marble hearth inlay (photos 12/13/16/18: front edge 0.60 m out, two slab joints). */
export function buildHearth(m: FireplaceMats) {
  const g = new THREE.Group();
  g.name = 'marble-hearth';
  const joints = [-0.62, 0.38];
  const spans: [number, number][] = [[-HEARTH.w / 2, joints[0]], [joints[0], joints[1]], [joints[1], HEARTH.w / 2]];
  for (const [x0, x1] of spans) {
    const w = x1 - x0 - 0.0022;
    const slab = rbox(w, HEARTH.t, HEARTH.d, 0.0015, m.hearth, 2);
    at(slab, (x0 + x1) / 2, HEARTH.t / 2, HEARTH.d / 2);
    g.add(slab);
  }
  return g;
}
