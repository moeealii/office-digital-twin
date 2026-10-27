import * as THREE from 'three';
import { at, cyl, mesh, rbox, rod, tube, v3 } from './_moe-kit';
import type { FireplaceMats } from './_fireplace-mats';
import { ribbedTube } from './_fireplace-geo';

/**
 * Wall-1 appliances and the portable-AC kit (photos 0, 14, 22, 172, 193).
 *
 * Separate named builders (Wes pattern) — not one anonymous blob:
 *   buildAc            Cool-Living portable AC cabinet alone
 *   buildAcController  white IR remote (sits in the top cradle)
 *   buildAranet4       Aranet4 Home CO₂ monitor (upright on the AC top)
 *   buildHose          corrugated exhaust run
 *   buildExhaustVent   round exhaust fitting on wall 1
 *   (the Winix D480 purifier lives in _winix-d480.ts; the hose does NOT plug into it)
 *
 * Photo 1's front-right vertical edge (416,953 → 414,1242), with its foot at y=.018,
 * gives a .637 m top. Rays through the four top corners give a .31 × .28 m footprint
 * and yaw −.17, independently confirmed by the top-edge slopes in photos 0 and 172.
 * Photo 0 has the documented pose offset; use photo 1/172 for the footprint centre.
 */
export const AC = { pos: new THREE.Vector2(-0.675, -1.365), yaw: -0.17, w: 0.30, d: 0.29, h: 0.64 };

/**
 * Round exhaust port on wall 1, just west of the fireplace and east of the TV receptacle.
 * Photo 13's cuff centre (195,660) hits x=−1.066,y=.366 on the wall; photo 172
 * gives x=−1.047,y=.358. Photo 193 gives .413 m, a 4 cm pose/occlusion uncertainty.
 */
export const EXHAUST = {
  x: -1.06,
  y: 0.38,
  z: -2.695,
  u: -1.06 + 2.976,
  v: 0.38,
  portR: 0.068,
};

/** Local (AC frame) placement of the two top props — used by their own builders. */
export const AC_REMOTE = { local: new THREE.Vector3(0.015, AC.h + 0.010, -0.055), yaw: Math.PI / 2 };
export const AC_ARANET = { local: new THREE.Vector3(-0.055, AC.h + 0.036, 0.018), tilt: 0.12 };

function acWorld(local: THREE.Vector3) {
  const c = Math.cos(AC.yaw), s = Math.sin(AC.yaw);
  return new THREE.Vector3(
    AC.pos.x + local.x * c + local.z * s,
    local.y,
    AC.pos.y - local.x * s + local.z * c,
  );
}

/** Cool-Living portable AC — cabinet only; remote and Aranet4 are separate builders. */
export function buildAc(m: FireplaceMats) {
  const g = new THREE.Group();
  g.name = 'portable-ac';
  g.position.set(AC.pos.x, 0, AC.pos.y);
  g.rotation.y = AC.yaw;
  const W = AC.w, D = AC.d, H = AC.h;
  const fz = D / 2;

  // --- shell: main body + slightly proud top cap with a lip -------------------------------
  const body = rbox(W, H - 0.078, D, 0.028, m.applianceWhite, 5);
  at(body, 0, 0.055 + (H - 0.078) / 2, 0);
  g.add(body);
  const topCap = rbox(W - 0.006, 0.028, D - 0.006, 0.014, m.applianceWhite, 4);
  at(topCap, 0, H - 0.014, 0);
  g.add(topCap);
  // thin top lip / bevel reading as the molded edge in photo 172
  g.add(at(rbox(W - 0.018, 0.006, D - 0.018, 0.003, m.applianceWhiteMatte, 2), 0, H - 0.001, 0));

  // --- plinth + castors -------------------------------------------------------------------
  const plinth = rbox(W - 0.04, 0.048, D - 0.045, 0.010, m.applianceWhiteMatte, 2);
  at(plinth, 0, 0.046, 0);
  g.add(plinth);
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      const x = sx * (W / 2 - 0.048), z = sz * (D / 2 - 0.048);
      g.add(at(rbox(0.028, 0.018, 0.018, 0.004, m.applianceDark, 2), x, 0.028, z));
      const fork = rbox(0.008, 0.022, 0.026, 0.002, m.applianceDark, 1);
      at(fork, x, 0.018, z);
      g.add(fork);
      const wheel = cyl(0.018, 0.018, 0.011, m.rubber, 16);
      wheel.rotation.z = Math.PI / 2;
      at(wheel, x, 0.016, z);
      g.add(wheel);
      const hub = cyl(0.005, 0.005, 0.014, m.applianceDark, 8);
      hub.rotation.z = Math.PI / 2;
      at(hub, x, 0.016, z);
      g.add(hub);
    }
  }

  // --- front: four broad white louvres immediately below the TOP console (0/1/172). ---
  const bay = rbox(W - 0.036, 0.205, 0.012, 0.009, m.applianceGrille, 3);
  at(bay, 0, H - 0.132, fz + 0.001);
  g.add(bay);
  for (let i = 0; i < 4; i++) {
    const y = H - 0.218 + i * 0.048;
    // Recessed grey opening and a rounded projecting blade, rather than low cabinet stripes.
    g.add(at(rbox(W - 0.048, 0.030, 0.006, 0.005, m.applianceWhiteMatte, 2), 0, y, fz + 0.007));
    const slat = rbox(W - 0.046, 0.024, 0.026, 0.008, m.applianceWhite, 3);
    at(slat, 0, y + 0.013, fz + 0.011);
    slat.rotation.x = -0.18;
    g.add(slat);
  }

  // Fine intake slots low on the front (photo 1) and rear (193), shared/instanced.
  const intakeGeo = new THREE.BoxGeometry(0.0011, 0.23, 0.0015);
  const intake = new THREE.InstancedMesh(intakeGeo, m.applianceWhiteMatte, 156);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 78; i++) {
    const x = -(W - 0.05) / 2 + i * (W - 0.05) / 77;
    intake.setMatrixAt(i, matrix.makeTranslation(x, 0.19, fz + 0.0008));
    intake.setMatrixAt(i + 78, matrix.makeTranslation(x, 0.19, -fz - 0.0008));
  }
  intake.instanceMatrix.needsUpdate = true;
  g.add(intake);

  // --- black control deck on the TOP, toward the front (photos 0, 1, 172) ----------------
  {
    // The white cap lip reaches H+.002: all console faces must sit ABOVE that lip.
    const deck = rbox(W - 0.014, 0.008, 0.080, 0.004, m.applianceDark, 3);
    at(deck, 0, H + 0.002, 0.096);
    g.add(deck);
    const panel = mesh(new THREE.PlaneGeometry(W - 0.026, 0.070), m.appliancePanel, 'ac-panel');
    panel.rotation.x = -Math.PI / 2;
    at(panel, 0, H + 0.0068, 0.096);
    g.add(panel);
    const brand = mesh(new THREE.PlaneGeometry(0.085, 0.014), m.logoCoolLiving, 'ac-brand');
    brand.rotation.x = -Math.PI / 2;
    at(brand, 0.025, H + 0.0028, 0.018);
    g.add(brand);
  }

  // shallow cradle behind the black deck (remote itself is buildAcController)
  g.add(at(rbox(0.12, 0.006, 0.05, 0.004, m.applianceWhiteMatte, 2), -0.04, H - 0.002, -0.09));
  // recessed carry handle behind the cradle
  g.add(at(rbox(0.16, 0.010, 0.032, 0.006, m.applianceWhiteMatte, 2), 0.02, H - 0.006, -0.085));
  g.add(at(rbox(0.14, 0.016, 0.018, 0.004, m.applianceDark, 1), 0.02, H - 0.010, -0.085));

  // --- side handle + rating plate ---------------------------------------------------------
  for (const sx of [-1, 1]) {
    g.add(at(rbox(0.010, 0.042, 0.093, 0.008, m.applianceWhiteMatte, 3), sx * (W / 2 - 0.001), H - 0.11, 0.01));
    g.add(at(rbox(0.011, 0.012, 0.070, 0.004, m.applianceWhite, 2), sx * (W / 2 + 0.001), H - 0.102, 0.01));
  }
  {
    const plate = mesh(new THREE.PlaneGeometry(0.064, 0.095), m.rating);
    at(plate, -0.085, 0.37, -fz - 0.0015, Math.PI);
    g.add(plate);
  }
  // --- rear hose adapter; the broad side with the carry handle has no round hole (0/193). --
  {
    g.add(at(rbox(0.16, 0.16, 0.016, 0.006, m.hosePlastic, 3), 0, 0.40, -fz - 0.006));
    const collar = cyl(0.074, 0.074, 0.046, m.hosePlastic, 28);
    collar.rotation.x = Math.PI / 2;
    at(collar, 0, 0.40, -fz - 0.025);
    g.add(collar);
    const ring = cyl(0.078, 0.078, 0.010, m.hoseGrey, 28);
    ring.rotation.x = Math.PI / 2;
    at(ring, 0, 0.40, -fz - 0.043);
    g.add(ring);
  }
  return g;
}

/**
 * Cool-Living IR remote — own placeable (photos 0/172). White wand with a button grid,
 * nested in the AC top cradle, slightly yawed.
 */
export function buildAcController(m: FireplaceMats) {
  const g = new THREE.Group();
  g.name = 'ac-controller';
  const p = acWorld(AC_REMOTE.local);
  g.position.copy(p);
  g.rotation.y = AC.yaw + AC_REMOTE.yaw;
  const body = rbox(0.048, 0.013, 0.155, 0.006, m.applianceWhite, 3);
  g.add(body);
  // face with button grid + blue brand mark
  const face = mesh(new THREE.PlaneGeometry(0.042, 0.140), m.acRemoteFace);
  face.rotation.x = -Math.PI / 2;
  at(face, 0, 0.0072, 0);
  g.add(face);
  // slight bevel rim
  g.add(at(rbox(0.050, 0.003, 0.158, 0.002, m.applianceWhiteMatte, 1), 0, 0.005, 0));
  return g;
}

/**
 * Aranet4 Home CO₂ monitor — own placeable (photos 0/172). 70×70×24 mm frosted square
 * standing upright on the AC top, just behind the black control strip, left of COOL-LIVING.
 */
export function buildAranet4(m: FireplaceMats) {
  const g = new THREE.Group();
  g.name = 'aranet4';
  const p = acWorld(AC_ARANET.local);
  g.position.copy(p);
  g.rotation.y = AC.yaw;
  g.rotation.x = -AC_ARANET.tilt;
  // case: frosted translucent shell
  const shell = rbox(0.070, 0.070, 0.024, 0.008, m.aranetShell, 4);
  g.add(shell);
  // e-ink face on the front
  const screen = mesh(new THREE.PlaneGeometry(0.056, 0.056), m.aranetScreen);
  at(screen, 0, 0, 0.0128);
  g.add(screen);
  // thin dark bezel around the display
  g.add(at(rbox(0.060, 0.060, 0.002, 0.003, m.applianceDark, 1), 0, 0, 0.0115));
  // tiny sensor holes along the top edge
  for (let i = 0; i < 5; i++) {
    const hole = cyl(0.0018, 0.0018, 0.004, m.applianceDark, 6);
    hole.rotation.x = Math.PI / 2;
    at(hole, -0.016 + i * 0.008, 0.032, 0.002);
    g.add(hole);
  }
  return g;
}

/** Round wall fitting the hose cuffs onto (photo 193). Local +z into the room. */
export function buildExhaustVent(m: FireplaceMats) {
  const g = new THREE.Group();
  g.name = 'ac-exhaust-vent';
  const R = EXHAUST.portR;
  const flange = cyl(R + 0.018, R + 0.018, 0.008, m.applianceWhite, 28);
  flange.rotation.x = Math.PI / 2;
  at(flange, 0, 0, 0.004);
  g.add(flange);
  const rim = cyl(R + 0.006, R + 0.010, 0.022, m.hoseGrey, 28);
  rim.rotation.x = Math.PI / 2;
  at(rim, 0, 0, 0.014);
  g.add(rim);
  const mouth = cyl(R - 0.008, R - 0.008, 0.006, m.applianceDark, 24);
  mouth.rotation.x = Math.PI / 2;
  at(mouth, 0, 0, 0.010);
  g.add(mouth);
  return g;
}

/**
 * Corrugated exhaust hose. Photos 1, 15, 22 and 193 agree: it leaves the AC rear,
 * arches through the cart's west side above the lower shelf, and cuffs onto the wall at
 * (−1.06, .38). The visible centreline was measured at y=.37 in photos 1 and 193.
 * The hidden rear connection is approximate; it never plugs into the purifier.
 */
export function buildHose(m: FireplaceMats) {
  const g = new THREE.Group();
  g.name = 'ac-exhaust-hose';
  const collar = acWorld(new THREE.Vector3(0, 0.40, -AC.d / 2 - 0.045));
  const start: [number, number, number] = [collar.x, collar.y, collar.z];
  const end: [number, number, number] = [EXHAUST.x, EXHAUST.y, EXHAUST.z + 0.02];
  const pts: [number, number, number][] = [
    start,
    [-0.56, 0.39, -1.65],
    [-0.49, 0.37, -1.84],
    [-0.58, 0.37, -2.08],
    [-0.75, 0.38, -2.32],
    [-0.97, 0.38, -2.57],
    end,
  ];
  // Photo 193's rib period is 6–7 image pixels (FFT over the straight run), ~11 mm
  // at its measured depth. Eight longitudinal samples per rib avoid close-up aliasing.
  g.add(ribbedTube(pts, 0.072, 90, m.hosePlastic, 1100, 32, 0.035));
  const cuff = cyl(0.078, 0.078, 0.020, m.hosePlastic, 24);
  cuff.rotation.x = Math.PI / 2;
  at(cuff, end[0], end[1], end[2] + 0.003);
  g.add(cuff);
  return g;
}

export function buildOutlet(m: FireplaceMats) {
  const g = new THREE.Group();
  g.name = 'wall-outlet';
  const plate = rbox(0.078, 0.118, 0.008, 0.004, m.outletPlate, 2);
  at(plate, 0, 0, 0.004);
  g.add(plate);
  for (const dy of [0.026, -0.026]) {
    const well = mesh(new THREE.BoxGeometry(0.032, 0.035, 0.004), m.applianceWhiteMatte);
    at(well, 0, dy, 0.0085);
    g.add(well);
    for (const dx of [-0.007, 0.007]) {
      const slot = mesh(new THREE.BoxGeometry(0.004, 0.014, 0.002), m.applianceDark);
      at(slot, dx, dy, 0.0105);
      g.add(slot);
    }
  }
  const plug = rbox(0.036, 0.042, 0.026, 0.006, m.plugWhite, 2);
  at(plug, 0, 0.026, 0.022);
  g.add(plug);
  const cord = tube([[0, 0.026, 0.036], [0.005, -0.06, 0.05], [0.02, -0.16, 0.06], [0.05, -0.235, 0.055]], 0.0036, m.cableWhite, 20, 6);
  g.add(cord);
  return g;
}

export function buildFloorCords(m: FireplaceMats) {
  const g = new THREE.Group();
  g.name = 'floor-cords';
  // Visible white lead measured on y=.012 in photo 193, disappearing under the two cabinets.
  // Its hidden electrical routing is not resolved by the photos; do not invent a visible return.
  g.add(tube([
    [-1.25, 0.035, -2.15], [-1.197, 0.012, -2.048], [-1.107, 0.012, -1.880],
    [-0.856, 0.012, -1.774], [-0.747, 0.012, -1.657], [-0.778, 0.012, -1.512],
    [-0.790, 0.065, -1.480],
  ], 0.0034, m.cableWhite, 65, 6));
  const acLead = acWorld(new THREE.Vector3(0.06, 0.07, -AC.d / 2 - 0.006));
  g.add(tube([
    [acLead.x, acLead.y, acLead.z], [-0.55, 0.012, -1.60], [-0.61, 0.012, -1.85],
    [-1.22, 0.012, -2.50], [-1.386, 0.31, -2.69],
  ], 0.0032, m.cableBlack, 50, 6));
  void rod; void v3;
  return g;
}
