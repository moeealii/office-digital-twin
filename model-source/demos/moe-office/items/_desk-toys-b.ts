import * as THREE from 'three';
import {
  at, box, cyl, extrude, grp, instanced, lathe, mat4, mesh, rbox, rboxGeo, rng, rod, sphere, tube, v3, vinyl,
  type V2, type V3,
} from './_desk-toys-kit';
import type { DT } from './_desk-toys-mats';

/**
 * Cluster B — the clutter on the white drawer unit beside the west desk's window end: a black
 * pump bottle, a clear pump bottle with white lotion, a white "WHOSON" aerosol, a black aerosol,
 * a pen cup, a dark-brown spiral bristle tower, a green spiky printed ornament and a black remote.
 * Photos 89, 90, 91, 166, 78 (90 and 91 are the sharpest).
 *
 * Local frame: +x east, +z toward the room, y up from the unit's top.
 */
export const DRAWER_TOP = 0.7;

export interface BPlace {
  blackPump: V2;
  clearPump: V2;
  whoosh: V2;
  blackCan: V2;
  bristle: V2;
  greenSpiky: V2;
  penCup: V2;
  remote: V2;
}

export function buildClusterB(m: DT, place: BPlace): THREE.Group {
  const g = grp('desk-toys-b');
  const put = (o: THREE.Object3D, p: V2, ry = 0) => {
    at(o, p[0], DRAWER_TOP, p[1], ry);
    g.add(o);
    return o;
  };
  put(buildPumpBottle(m, 'black'), place.blackPump, 0.4);
  put(buildPumpBottle(m, 'clear'), place.clearPump, 0.15);
  put(buildAerosol(m, 'whoosh'), place.whoosh, -0.3);
  put(buildAerosol(m, 'black'), place.blackCan, 0.2);
  put(buildBristleTower(m), place.bristle, 0.7);
  put(buildGreenSpiky(m), place.greenSpiky, -0.5);
  put(buildPenCup(m), place.penCup, 0.3);
  put(buildRemote(m), place.remote, 1.2);
  return g;
}

// ---------------------------------------------------------------- pump bottles

/** black resin pump dispenser / clear hand-sanitiser pump (photos 89/90/91) */
function buildPumpBottle(m: DT, kind: 'black' | 'clear') {
  const g = grp('toy-pump-' + kind);
  const black = kind === 'black';
  const bodyMat = black ? m.blackGloss : m.clear;
  const H = black ? 0.15 : 0.135;
  const R = black ? 0.029 : 0.026;
  // the bottle: a straight cylinder, with a clear reservoir at the bottom on the black one
  if (black) {
    const reservoir = cyl(R * 0.94, R, 0.05, m.clear, 26);
    at(reservoir, 0, 0.026, 0);
    g.add(reservoir);
    const liquid = cyl(R * 0.86, R * 0.9, 0.03, m.liquidWhite, 24);
    at(liquid, 0, 0.02, 0);
    g.add(liquid);
    const upper = lathe([[R, 0.05], [R, H - 0.02], [R * 0.9, H - 0.008], [R * 0.7, H], [0, H]], bodyMat, 28);
    g.add(upper);
    const collar = cyl(R * 0.72, R * 0.72, 0.012, m.blackMatte, 22);
    at(collar, 0, H + 0.005, 0);
    g.add(collar);
  } else {
    const body = lathe([[0, 0], [R * 0.9, 0], [R, 0.006], [R, H - 0.012], [R * 0.92, H], [0, H]], bodyMat, 28);
    g.add(body);
    const liquid = cyl(R * 0.82, R * 0.86, H * 0.62, m.liquidWhite, 24);
    at(liquid, 0, H * 0.34, 0);
    g.add(liquid);
    const collar = cyl(R * 0.55, R * 0.55, 0.016, m.whiteGloss, 20);
    at(collar, 0, H + 0.006, 0);
    g.add(collar);
  }
  // the pump: neck, head and a curved nozzle
  const neck = cyl(0.0075, 0.0075, 0.016, black ? m.blackMatte : m.whiteGloss, 16);
  at(neck, 0, H + 0.016, 0);
  g.add(neck);
  const head = rbox(0.026, 0.012, 0.016, 0.005, black ? m.blackGloss : m.whiteGloss, 2);
  at(head, 0.004, H + 0.028, 0);
  g.add(head);
  const spout = tube([[0.014, H + 0.028, 0], [0.024, H + 0.026, 0.002], [0.03, H + 0.019, 0.004]], 0.0038, black ? m.blackGloss : m.whiteGloss, 10, 8);
  g.add(spout);
  // a paper label band
  const label = cyl(R * 1.005, R * 1.005, black ? 0.05 : 0.045, black ? m.blackMatte : m.paperLabel, 26, true);
  at(label, 0, black ? 0.085 : 0.07, 0);
  g.add(label);
  return g;
}

// ---------------------------------------------------------------- aerosol cans

/** white "WHOSON" cleaner can and a black aerosol canister (photos 90/91) */
function buildAerosol(m: DT, kind: 'whoosh' | 'black') {
  const g = grp('toy-can-' + kind);
  const whoosh = kind === 'whoosh';
  const R = whoosh ? 0.0265 : 0.024;
  const H = whoosh ? 0.15 : 0.135;
  const bodyMat = whoosh ? m.whoosh : m.blackMatte;
  const body = cyl(R, R, H, whoosh ? [bodyMat, bodyMat, m.whoosh] : bodyMat, 30);
  at(body, 0, H / 2, 0);
  g.add(body);
  // shoulder + valve cup
  const shoulder = lathe([[R, H], [R * 0.82, H + 0.008], [R * 0.45, H + 0.013], [R * 0.42, H + 0.02], [0, H + 0.02]], whoosh ? m.whoosh : m.blackGloss, 24);
  g.add(shoulder);
  // cap
  const cap = cyl(R * 0.86, R * 0.9, 0.026, whoosh ? m.paperLabel : m.blackGloss, 24);
  at(cap, 0, H + 0.024, 0);
  g.add(cap);
  // the red collar the WHOSON can has under its cap
  if (whoosh) {
    const collar = cyl(R * 0.995, R * 0.995, 0.02, m.orange, 26);
    at(collar, 0, H - 0.008, 0);
    g.add(collar);
  }
  return g;
}

// ---------------------------------------------------------------- bristle tower

/**
 * The dark-brown spiral "bristle tower" (photos 89/90/91): a stack of comb-like curved plates on
 * a slim shaft, tapering to a point. Probably a 3d-printed part or a bottle brush.
 */
function buildBristleTower(m: DT) {
  const g = grp('toy-bristle');
  const shaft = cyl(0.0035, 0.0045, 0.115, m.brownBristle, 10);
  at(shaft, 0, 0.058, 0);
  g.add(shaft);
  const base = cyl(0.016, 0.019, 0.008, m.brownBristle, 16);
  at(base, 0, 0.004, 0);
  g.add(base);
  const plateGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.0026, 14, 1, false, 0.4, Math.PI * 1.25);
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const s = 1 - t * 0.62;
    const p = mesh(plateGeo, m.brownBristle);
    p.scale.set(s, 1, s * 0.8);
    at(p, 0, 0.014 + t * 0.088, 0, (i % 2 ? 0.35 : -0.35) + i * 0.5, 0.08, 0);
    g.add(p);
    // the spikes on each plate
    if (i % 2 === 0) {
      const spikes: THREE.Matrix4[] = [];
      for (let k = 0; k < 5; k++) {
        const a = 0.6 + (k / 5) * Math.PI * 1.1;
        spikes.push(mat4(Math.cos(a) * 0.021 * s, 0.014 + t * 0.088, Math.sin(a) * 0.021 * s, 0.2, -a, 0.3, 1));
      }
      g.add(instanced(new THREE.ConeGeometry(0.0016, 0.006, 5), m.brownBristle, spikes));
    }
  }
  return g;
}

// ---------------------------------------------------------------- green printed ornament

/** the scalloped green printed ornament with a dark centre (photos 89/90/91) */
function buildGreenSpiky(m: DT) {
  const g = grp('toy-green-spiky');
  // a wavy green ring standing on edge
  const sh = new THREE.Shape();
  const N = 120;
  const R0 = 0.045;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = R0 + Math.sin(a * 9) * 0.006 + Math.sin(a * 3) * 0.004;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) sh.moveTo(x, y);
    else sh.lineTo(x, y);
  }
  sh.closePath();
  const hole = new THREE.Path();
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = R0 * 0.6;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  }
  sh.holes.push(hole);
  const ring = extrude(sh, 0.012, m.green, 0.002, 8);
  at(ring, 0, 0.046, 0);
  g.add(ring);
  // dark grey organic centre (a printed "creature" body)
  const centre = lathe([[0, 0], [0.022, 0.002], [0.03, 0.012], [0.026, 0.026], [0.014, 0.034], [0, 0.036]], m.darkGrey, 20);
  at(centre, 0, 0.012, 0.002);
  g.add(centre);
  // little orange knobs tucked in the ring
  for (const [dx, dy, dz] of [[-0.012, 0.03, 0.008], [0.006, 0.042, 0.006], [0.016, 0.026, 0.004]] as const) {
    g.add(at(sphere(0.006, m.orange, 12, 10), dx, dy, dz));
  }
  // a tan card behind
  const card = rbox(0.03, 0.036, 0.002, 0.001, m.paperLabel, 1);
  at(card, 0.014, 0.03, -0.008, -0.2, 0.12);
  g.add(card);
  return g;
}

// ---------------------------------------------------------------- pen cup

function buildPenCup(m: DT) {
  const g = grp('toy-pen-cup');
  const cup = cyl(0.022, 0.02, 0.075, m.blackMatte, 20, true);
  at(cup, 0, 0.0375, 0);
  g.add(cup);
  const bottom = cyl(0.02, 0.02, 0.004, m.blackMatte, 20);
  at(bottom, 0, 0.002, 0);
  g.add(bottom);
  const penMats = [m.blueGrey, m.blackGloss, m.redPlain, m.whiteGloss, m.blueGrey, m.blackGloss];
  const r = rng(5);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const lean = 0.12 + r() * 0.16;
    const len = 0.1 + r() * 0.03;
    const p = cyl(0.0024, 0.0024, len, penMats[i], 8);
    at(p, Math.cos(a) * 0.009, 0.045 + len / 2 - 0.01, Math.sin(a) * 0.009, a, lean * Math.cos(a), lean * Math.sin(a));
    g.add(p);
  }
  return g;
}

// ---------------------------------------------------------------- black remote

function buildRemote(m: DT) {
  const g = grp('toy-remote');
  const body = rbox(0.045, 0.014, 0.17, 0.006, m.blackMatte, 3);
  at(body, 0, 0.007, 0);
  g.add(body);
  const btn = rboxGeo(0.007, 0.002, 0.006, 0.0015, 1);
  const mats: THREE.Matrix4[] = [];
  for (let i = 0; i < 16; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    mats.push(mat4(-0.011 + col * 0.011, 0.0145, -0.062 + row * 0.013));
  }
  g.add(instanced(btn, m.darkGrey, mats));
  return g;
}
