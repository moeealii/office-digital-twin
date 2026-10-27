import * as THREE from 'three';
import type { DwMats } from './_desk-west-mats';
import { at, box, cable, canvasTex, cyl, grp, lathe, mat4, instanced, mesh, rbox, rod, taperTube, tube, v3, type V2, type V3 } from './_desk-west-kit';
import { buildGlassTable } from './_desk-west-desk';

/**
 * The floor and the east end around the desk: Bambu Lab X1 Carbon + AMS on the chrome glass table
 * (the "X1 Carbon" and "AMS" lettering is legible in photos 89/91/200), Tide jug, PC tower, waste
 * bin, sneakers, the Govee floor lamp ("Govee" on its head, photo 72) and the walking pad.
 *
 *   X1C front-bottom corners   y 0.64 plane hits x -0.70 / -0.34, z ~2.06 (photo 200)
 *   Tide jug                   front-bottom (-0.533, 2.245) floor hit (photo 200)
 *   PC tower                   front-bottom corners (-1.53, 2.30) (-1.88, 2.37) (photo 200)
 *   bin                        front-bottom (-1.335, 2.22) (photo 89)
 *   sneakers                   heel/toe (-0.587,2.043)->(-0.869,2.100); (-0.742,1.781)->(-0.944,1.940)
 *   Govee lamp                 head bottom (-2.854, 1.253, 1.338) triangulated 72/197/168
 *   walking pad deck corners   (-2.414,1.393) (-2.847,1.366) (-2.579,2.435) at y 0.11 (photo 197)
 */
// 0.44 wide: it fills the 0.45 m gap between the loveseat's west arm (x -0.236) and the ALEX (-0.69)
export const TABLE = { x: -0.465, z: 2.415, w: 0.44, d: 0.52, h: 0.64 };

/** Bambu Lab X1 Carbon: 389 x 389 x 457 mm; glass door, smoked lid, touchscreen top-left */
export function buildX1C(M: DwMats) {
  const g = grp('bambu-x1c');
  const W = 0.389, D = 0.389, Hh = 0.457;
  const grey = new THREE.MeshStandardMaterial({ color: '#c3c4c4', roughness: 0.45, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2b2d', roughness: 0.5 });
  // frame: grey shell with a black inner bezel around the door
  g.add(at(rbox(W, Hh - 0.03, D, 0.012, grey, 3), 0, (Hh - 0.03) / 2, 0));
  g.add(at(box(W - 0.05, Hh - 0.13, 0.004, dark), 0, 0.2, D / 2 + 0.001));
  // smoked glass door with a small chrome handle on the right
  g.add(at(rbox(W - 0.06, Hh - 0.14, 0.006, 0.006, M.smoked, 2), -0.004, 0.2, D / 2 + 0.006));
  g.add(at(rbox(0.012, 0.03, 0.012, 0.004, M.chrome, 2), W / 2 - 0.045, 0.22, D / 2 + 0.012));
  // inside: build plate (textured PEI disc look), a red print, toolhead on the gantry
  g.add(at(box(W - 0.08, 0.008, D - 0.08, dark), 0, 0.09, 0));
  g.add(at(cyl(0.06, 0.07, 0.06, M.red, 24), -0.02, 0.124, -0.01));
  g.add(at(box(W - 0.06, 0.02, 0.02, dark), 0, 0.33, 0.0));
  g.add(at(rbox(0.06, 0.07, 0.06, 0.01, dark, 2), 0.04, 0.31, 0.02));
  // top glass lid (smoked) and the touchscreen bezel at the front-left
  g.add(at(rbox(W - 0.02, 0.012, D - 0.02, 0.004, M.smoked, 2), 0, Hh - 0.024, 0));
  const scr = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#0d1117'; c.fillRect(0, 0, w, h); c.fillStyle = '#2b3240'; c.fillRect(10, 10, w - 20, h - 20); c.fillStyle = '#7fd36a'; c.fillRect(20, h - 30, 120, 8); });
  g.add(at(rbox(0.1, 0.06, 0.012, 0.006, M.plastic, 2), -W / 2 + 0.065, Hh - 0.07, D / 2 + 0.006).rotateX(-0.25));
  const sm = mesh(new THREE.PlaneGeometry(0.085, 0.048), new THREE.MeshStandardMaterial({ map: scr, emissive: '#ffffff', emissiveMap: scr, emissiveIntensity: 0.4 }), 'x1c-screen');
  sm.position.set(-W / 2 + 0.065, Hh - 0.069, D / 2 + 0.0135); sm.rotation.x = -0.25;
  g.add(sm);
  const lab = canvasTex(256, 32, (c, w, h) => { c.fillStyle = '#c3c4c4'; c.fillRect(0, 0, w, h); c.fillStyle = '#4a4c50'; c.font = '20px sans-serif'; c.fillText('Bambu Lab   X1 Carbon', 8, 23); });
  const lm = mesh(new THREE.PlaneGeometry(0.14, 0.0175), new THREE.MeshStandardMaterial({ map: lab, roughness: 0.5 }), 'x1c-label');
  lm.position.set(0.06, Hh - 0.055, D / 2 + 0.0005); g.add(lm);
  // side Bambu logo panel (photo 89 shows the stacked-slab logo on the right side)
  const logo = canvasTex(64, 128, (c, w, h) => { c.fillStyle = '#c3c4c4'; c.fillRect(0, 0, w, h); c.fillStyle = '#55585d'; c.fillRect(14, 10, 14, 50); c.fillRect(34, 10, 14, 30); c.fillRect(14, 66, 14, 30); c.fillRect(34, 46, 14, 50); });
  const lg = mesh(new THREE.PlaneGeometry(0.04, 0.08), new THREE.MeshStandardMaterial({ map: logo, roughness: 0.5 }), 'x1c-logo');
  lg.position.set(-W / 2 - 0.0005, 0.25, 0.05); lg.rotation.y = -Math.PI / 2; g.add(lg);
  return g;
}

/** Bambu AMS: 360 x 285 x 225 mm, dark shell with a smoked hinged dome lid and four spools */
export function buildAMS(M: DwMats) {
  const g = grp('bambu-ams');
  const W = 0.36, D = 0.285;
  const shell = new THREE.MeshStandardMaterial({ color: '#3a3b3e', roughness: 0.45, metalness: 0.2 });
  g.add(at(rbox(W, 0.11, D, 0.01, shell, 2), 0, 0.055, 0));
  // front: the four feeder slots and the black "AMS" lettering strip
  for (let i = 0; i < 4; i++) g.add(at(box(0.06, 0.03, 0.004, M.black), -0.12 + i * 0.08, 0.05, D / 2 + 0.002));
  const t = canvasTex(128, 32, (c, w, h) => { c.fillStyle = '#3a3b3e'; c.fillRect(0, 0, w, h); c.fillStyle = '#c9cbce'; c.font = 'bold 22px sans-serif'; c.fillText('AMS', 40, 24); });
  const tm = mesh(new THREE.PlaneGeometry(0.05, 0.0125), new THREE.MeshStandardMaterial({ map: t }), 'ams-label');
  tm.position.set(0.12, 0.09, D / 2 + 0.002); g.add(tm);
  // four spools visible through the lid
  for (let i = 0; i < 4; i++) {
    const sp = grp('spool');
    sp.add(at(cyl(0.09, 0.09, 0.006, M.black, 32), 0, 0, 0.026).rotateX(Math.PI / 2));
    sp.add(at(cyl(0.09, 0.09, 0.006, M.black, 32), 0, 0, -0.026).rotateX(Math.PI / 2));
    sp.add(at(cyl(0.075, 0.075, 0.046, new THREE.MeshStandardMaterial({ color: ['#d8d8d4', '#2c2d30', '#b8262a', '#d9d6cc'][i], roughness: 0.6 }), 32), 0, 0, 0).rotateX(Math.PI / 2));
    sp.rotation.y = Math.PI / 2;
    sp.position.set(-0.13 + i * 0.087, 0.12, 0);
    g.add(sp);
  }
  // smoked dome lid: a half-cylinder shell over the spools
  const lid = new THREE.CylinderGeometry(D / 2, D / 2, W - 0.01, 40, 1, true, -Math.PI / 2, Math.PI);
  lid.rotateZ(Math.PI / 2);
  const lidMat = M.smoked.clone(); lidMat.opacity = 0.93; lidMat.color.set('#3d4044');
  const lm = mesh(lid, lidMat, 'ams-lid');
  lm.scale.set(1, 0.85, 1); lm.position.y = 0.11;
  g.add(lm);
  for (const s of [-1, 1]) {
    const cap = mesh(new THREE.CircleGeometry(D / 2, 32, 0, Math.PI), M.smoked);
    cap.rotation.y = s * Math.PI / 2; cap.scale.set(1, 0.85, 1); cap.position.set(s * (W / 2 - 0.005), 0.11, 0);
    g.add(cap);
  }
  return g;
}

/** white HDPE jug with an inset grip handle (photos 89/200: sits on the table's NW corner) */
export function buildWhiteBottle(M: DwMats) {
  const g = grp('white-bottle');
  g.add(lathe([[0, 0], [0.032, 0], [0.034, 0.006], [0.034, 0.115], [0.026, 0.142], [0.013, 0.155], [0.013, 0.172], [0, 0.172]] as V2[], M.frostedWhite, 24));
  g.add(at(cyl(0.015, 0.015, 0.018, M.plastic, 16), 0, 0.181, 0));
  // moulded grip handle on the side: a hollow loop from the shoulder to the body
  const handle = tube([[-0.03, 0.13, 0], [-0.052, 0.115, 0], [-0.054, 0.075, 0], [-0.038, 0.052, 0]], 0.0075, M.frostedWhite, 16, 8);
  g.add(handle);
  return g;
}

/** @deprecated prefer placing buildGlassTable / buildX1C / buildAMS / buildWhiteBottle separately */
export function buildPrinterStack(M: DwMats) {
  const g = grp('printer-stack');
  const t = buildGlassTable(M, TABLE.w, TABLE.d, TABLE.h);
  t.position.set(TABLE.x, 0, TABLE.z);
  g.add(t);
  const x1 = buildX1C(M);
  x1.position.set(-0.49, TABLE.h, 2.40);
  g.add(x1);
  const ams = buildAMS(M);
  ams.position.set(-0.49, TABLE.h + 0.457, 2.39);
  g.add(ams);
  g.add(at(buildWhiteBottle(M), -0.26, TABLE.h, 2.19));
  g.add(cable([[-0.3, TABLE.h + 0.1, 2.52], [-0.2, TABLE.h - 0.1, 2.62], [-0.15, 0.2, 2.66], [-0.1, 0.01, 2.68], [0.1, 0.01, 2.7]], M.black, 0.004));
  return g;
}

/** Tide 2.72 L jug: orange body, handle, white cap with the bullseye label (photos 89/200) */
export function buildTide(M: DwMats) {
  const g = grp('tide-jug');
  const orange = new THREE.MeshPhysicalMaterial({ color: '#e8541a', roughness: 0.35, clearcoat: 0.6 });
  const body = rbox(0.16, 0.24, 0.12, 0.04, orange, 4);
  body.position.y = 0.12; g.add(body);
  g.add(at(cyl(0.035, 0.04, 0.03, orange, 20), 0.03, 0.255, 0));
  g.add(at(cyl(0.038, 0.038, 0.035, M.plastic, 20), 0.03, 0.285, 0));
  g.add(tube([[-0.07, 0.15, 0], [-0.085, 0.22, 0], [-0.05, 0.26, 0], [-0.0, 0.255, 0]], 0.011, orange, 16, 8));
  const lab = canvasTex(128, 128, (c, w) => { c.fillStyle = '#e8541a'; c.fillRect(0, 0, w, w); c.fillStyle = '#f6c21c'; c.beginPath(); c.arc(64, 64, 50, 0, 7); c.fill(); c.fillStyle = '#e8541a'; c.beginPath(); c.arc(64, 64, 36, 0, 7); c.fill(); c.fillStyle = '#1b3e94'; c.beginPath(); c.arc(64, 64, 26, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText('Tide', 64, 72); });
  const l = mesh(new THREE.CircleGeometry(0.045, 32), new THREE.MeshStandardMaterial({ map: lab, roughness: 0.5 }), 'tide-label');
  l.position.set(0.01, 0.12, 0.0605); g.add(l);
  return g;
}

/** plain black mid-tower PC: 220 x 470 x 450 */
export function buildPC(M: DwMats) {
  const g = grp('pc-tower');
  const W = 0.22, Hh = 0.47, D = 0.45;
  g.add(at(rbox(W, Hh, D, 0.008, M.black, 2), 0, Hh / 2 + 0.012, 0));
  // front: mesh intake panel and the power button / IO strip on top front
  g.add(at(box(W - 0.03, Hh - 0.06, 0.004, M.mesh), 0, Hh / 2 + 0.012, D / 2 + 0.001));
  g.add(at(cyl(0.007, 0.007, 0.004, M.led, 12), -0.06, Hh + 0.014, D / 2 - 0.03));
  for (let i = 0; i < 2; i++) g.add(at(box(0.012, 0.002, 0.005, M.darkPlastic), 0.0 + i * 0.02, Hh + 0.013, D / 2 - 0.03));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(cyl(0.014, 0.016, 0.012, M.rubber, 10), sx * (W / 2 - 0.03), 0.006, sz * (D / 2 - 0.04)));
  // faint blue status glow at the back (visible under the desk in photo 200)
  g.add(at(box(0.004, 0.06, 0.004, M.led), W / 2 - 0.02, 0.06, -D / 2 - 0.002));
  return g;
}

/** small white bin with a translucent liner bag, pink and blue rubbish showing through */
export function buildBagBin(M: DwMats) {
  const g = grp('bag-bin');
  // In 89/200 the nested pink/blue liners show through the white bag; an opaque white tub
  // hid both colours in the recovered renders.
  const binShell = new THREE.MeshStandardMaterial({ color: '#647583', roughness: 0.8 });
  g.add(lathe([[0, 0], [0.11, 0], [0.115, 0.01], [0.13, 0.28], [0.125, 0.28], [0.108, 0.012], [0, 0.012]] as V2[], binShell, 28));
  const bagGeo = new THREE.CylinderGeometry(0.145, 0.11, 0.3, 28, 6, true);
  const bp = bagGeo.getAttribute('position');
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
    const a = Math.atan2(z, x);
    const top = Math.max(0, (y - 0.08) / 0.07);
    const fold = 1 + 0.07 * Math.sin(a * 6 + y * 20) + top * 0.09 * Math.sin(a * 3 + 1);
    bp.setXYZ(i, x * fold, y + top * 0.02 * Math.sin(a * 4), z * fold);
  }
  bp.needsUpdate = true; bagGeo.computeVertexNormals();
  const bag = mesh(bagGeo, M.bag, 'bin-bag'); bag.position.y = 0.17; g.add(bag);
  for (const [y, h, rt, rb, color] of [[0.065, 0.12, 0.13, 0.115, '#6b7e91'], [0.15, 0.065, 0.139, 0.13, '#c8adb0']] as [number, number, number, number, string][]) {
    const geo = new THREE.CylinderGeometry(rt, rb, h, 32, 4, true);
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const k = 1 + 0.035 * Math.sin(a * 7 + p.getY(i) * 15);
      p.setXYZ(i, p.getX(i) * k, p.getY(i) + 0.006 * Math.sin(a * 4), p.getZ(i) * k);
    }
    geo.computeVertexNormals();
    g.add(at(mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.65, side: THREE.DoubleSide }), 'nested-liner'), 0, y, 0));
  }
  const tissue = new THREE.MeshStandardMaterial({ color: '#e4e7e5', roughness: 0.95, side: THREE.DoubleSide });
  for (let k = 0; k < 4; k++) {
    const geo = new THREE.PlaneGeometry(0.105, 0.085, 6, 5);
    geo.rotateX(-Math.PI / 2);
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) p.setY(i, 0.014 * Math.sin(p.getX(i) * 80 + k) + 0.01 * Math.cos(p.getZ(i) * 95 - k));
    geo.computeVertexNormals();
    const m = mesh(geo, tissue, 'crumpled-paper');
    m.position.set(Math.cos(k * 2.4) * 0.045, 0.25 + k * 0.009, Math.sin(k * 2.4) * 0.05);
    m.rotation.set(k * 0.14, k * 1.3, k % 2 ? 0.3 : -0.2);
    g.add(m);
  }
  g.add(at(cyl(0.1, 0.09, 0.14, new THREE.MeshStandardMaterial({ color: '#e4a1a6', roughness: 0.85 }), 18), 0, 0.08, 0.01));
  g.add(at(cyl(0.06, 0.06, 0.06, new THREE.MeshStandardMaterial({ color: '#3b5fb0', roughness: 0.8 }), 14), -0.03, 0.04, -0.03));
  return g;
}

/** a black knit running shoe (ASICS-like): sole, knit upper, heel counter, laces */
export function buildShoe(M: DwMats, left: boolean) {
  const g = grp('sneaker');
  const s = left ? 1 : -1;
  // sole: an outline extruded and rocker-shaped
  const pts: V2[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, a = t * Math.PI * 2;
    const z = 0.145 * Math.cos(a);
    const wFore = 0.052, wHeel = 0.04;
    const w = (z > 0 ? wFore : wHeel) * (0.9 + 0.1 * Math.cos(z * 20)) * Math.abs(Math.sin(a)) ** 0.8;
    pts.push([Math.sign(Math.sin(a)) * w + s * 0.006 * (z / 0.145), z]);
  }
  const sole = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z))), { depth: 0.03, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2 });
  sole.rotateX(Math.PI / 2);
  sole.translate(0, 0.034, 0);
  const sp = sole.getAttribute('position');
  for (let i = 0; i < sp.count; i++) { const z = sp.getZ(i); sp.setY(i, sp.getY(i) + Math.max(0, z - 0.09) ** 2 * 1.4 + Math.max(0, -z - 0.11) ** 2 * 1.2); }
  sole.computeVertexNormals();
  const soleMat = new THREE.MeshStandardMaterial({ color: '#202124', roughness: 0.8 });
  g.add(mesh(sole, soleMat, 'sole'));
  // upper: a stretched ellipsoid cut by the sole, toe box lower than the collar
  const up = new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  up.scale(0.048, 0.07, 0.13);
  const upm = mesh(up, new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.9, normalMap: M.weaveNormal, normalScale: new THREE.Vector2(0.6, 0.6) }), 'upper');
  upm.position.set(0, 0.034, -0.01);
  const upp = up.getAttribute('position');
  for (let i = 0; i < upp.count; i++) { const z = upp.getZ(i); if (z > 0) upp.setY(i, upp.getY(i) * (1 - z / 0.13 * 0.55)); }
  up.computeVertexNormals();
  g.add(upm);
  // collar opening and heel tab
  const collar = mesh(new THREE.TorusGeometry(0.03, 0.007, 8, 20), soleMat); collar.rotation.x = Math.PI / 2 - 0.2; collar.position.set(0, 0.098, -0.06); collar.scale.set(1, 1.4, 1);
  g.add(collar);
  g.add(at(rbox(0.03, 0.03, 0.008, 0.004, soleMat, 2), 0, 0.1, -0.13));
  // laces: five bars over the instep
  for (let i = 0; i < 5; i++) g.add(at(box(0.036, 0.003, 0.004, M.black), 0, 0.093 - i * 0.008, -0.025 + i * 0.019).rotateX(0.5));
  // reflective logo stripe on the side
  g.add(tube([[s * 0.047, 0.06, -0.06], [s * 0.05, 0.055, -0.0], [s * 0.046, 0.05, 0.05]], 0.002, new THREE.MeshStandardMaterial({ color: '#5b5d61', roughness: 0.4, metalness: 0.5 }), 12, 5));
  return g;
}

/** Govee floor lamp: round white base, slim white pole, white head with a tan slider window */
export function buildGoveeLamp(M: DwMats) {
  const g = grp('govee-lamp');
  g.add(lathe([[0, 0], [0.125, 0], [0.128, 0.006], [0.12, 0.022], [0.03, 0.028], [0, 0.028]] as V2[], M.plastic, 40));
  g.add(at(cyl(0.013, 0.013, 1.23, M.plastic, 16), 0, 0.028 + 0.615, 0));
  // the head: a taller oval capsule with the control slider window
  g.add(at(rbox(0.048, 0.17, 0.042, 0.02, M.plastic, 4), 0, 1.34, 0));
  g.add(at(rbox(0.012, 0.08, 0.004, 0.005, new THREE.MeshStandardMaterial({ color: '#bfa98a', roughness: 0.5 }), 2), 0, 1.36, 0.0215));
  const t = canvasTex(128, 32, (c, w, h) => { c.fillStyle = '#efefec'; c.fillRect(0, 0, w, h); c.fillStyle = '#9a9a96'; c.font = '20px sans-serif'; c.fillText('Govee', 30, 23); });
  const lab = mesh(new THREE.PlaneGeometry(0.03, 0.0075), new THREE.MeshStandardMaterial({ map: t }), 'govee-logo');
  lab.position.set(0, 1.29, 0.0215); g.add(lab);
  // light bar continuing above the head (diffuser) up to the top cap
  g.add(at(cyl(0.017, 0.017, 0.35, new THREE.MeshStandardMaterial({ color: '#f4f4f1', roughness: 0.35, emissive: '#fff4e6', emissiveIntensity: 0.05 }), 20), 0, 1.6, 0));
  g.add(at(cyl(0.018, 0.017, 0.02, M.plastic, 20), 0, 1.785, 0));
  // power lead out of the base
  g.add(cable([[0.12, 0.004, 0.0], [0.25, 0.004, 0.05], [0.4, 0.004, 0.05]], M.plastic, 0.0025));
  return g;
}

/** walking pad (black deck, grey belt rails, motor hood with the logo at the north end) */
export function buildTreadmill(M: DwMats) {
  const g = grp('walking-pad');
  const L = 1.36, W = 0.52;
  // frame: long tray with rounded ends, low at the rear
  g.add(at(rbox(W, 0.07, L, 0.02, M.black, 3), 0, 0.035, 0));
  // belt
  const belt = new THREE.MeshStandardMaterial({ color: '#1c1d1f', roughness: 0.9, normalMap: M.weaveNormal, normalScale: new THREE.Vector2(0.3, 0.3) });
  g.add(at(rbox(W * 0.8, 0.02, L * 0.83, 0.008, belt, 2), 0, 0.075, -0.06));
  // side rails (grey) with yellow-white warning stickers (photo 197)
  for (const s of [-1, 1]) g.add(at(rbox(0.05, 0.018, L * 0.86, 0.006, M.darkPlastic, 2), s * (W / 2 - 0.03), 0.08, -0.04));
  const sticker = new THREE.MeshStandardMaterial({ color: '#e8e2c4', roughness: 0.6 });
  g.add(at(box(0.04, 0.002, 0.06, sticker), -(W / 2 - 0.03), 0.09, -0.55));
  g.add(at(box(0.07, 0.002, 0.03, sticker), 0.05, 0.086, -0.0).rotateY(0.3));
  // motor hood at the north end, with the white lettering on its top
  g.add(at(rbox(W, 0.11, 0.2, 0.03, M.black, 3), 0, 0.055, L / 2 - 0.1));
  const t = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#121214'; c.fillRect(0, 0, w, h); c.fillStyle = '#e9e9e6'; c.font = 'bold 44px sans-serif'; c.textAlign = 'center'; c.fillText('TODO', w / 2, 48); });
  const lm = mesh(new THREE.PlaneGeometry(0.15, 0.0375), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), 'pad-logo');
  lm.rotation.set(-Math.PI / 2, 0, Math.PI); lm.position.set(0, 0.1105, L / 2 - 0.1);
  g.add(lm);
  // rear roller cap and feet
  g.add(at(cyl(0.03, 0.03, W * 0.98, M.darkPlastic, 16), 0, 0.035, -L / 2 + 0.03).rotateZ(Math.PI / 2));
  return g;
}

/** black over-ear headphones (Sony WH-1000XM4-like) hanging from an under-desk clamp hook */
export function buildHeadphoneHook(M: DwMats) {
  const g = grp('headphone-hook');
  // clamp: a black C with a thumb screw under the desktop, a hook arm down and forward
  g.add(at(rbox(0.03, 0.006, 0.06, 0.002, M.black, 1), 0, 0.003, 0));
  g.add(at(rbox(0.03, 0.04, 0.006, 0.002, M.black, 1), 0, -0.02, -0.03));
  g.add(at(rbox(0.03, 0.006, 0.06, 0.002, M.black, 1), 0, -0.04, 0));
  g.add(at(rbox(0.03, 0.09, 0.008, 0.003, M.black, 1), 0, -0.085, 0.034));
  g.add(at(rbox(0.04, 0.008, 0.05, 0.003, M.black, 1), 0, -0.13, 0.055));
  // the headphones: band over the hook, cups hanging either side
  const hp = grp('headphones');
  const band: V3[] = [[-0.085, -0.07, 0], [-0.08, 0.0, 0], [-0.045, 0.045, 0], [0, 0.058, 0], [0.045, 0.045, 0], [0.08, 0.0, 0], [0.085, -0.07, 0]];
  hp.add(taperTube(band, [0.011, 0.013, 0.014, 0.015, 0.014, 0.013, 0.011], M.black, 30, 10));
  for (const s of [-1, 1]) {
    const cup = new THREE.SphereGeometry(1, 24, 16);
    cup.scale(0.024, 0.05, 0.04);
    const cm = mesh(cup, new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.55 }), 'cup');
    cm.position.set(s * 0.09, -0.115, 0);
    hp.add(cm);
    const pad = new THREE.TorusGeometry(0.033, 0.012, 10, 28);
    pad.scale(0.75, 1.25, 1);
    const pm = mesh(pad, new THREE.MeshStandardMaterial({ color: '#111113', roughness: 0.75 }), 'pad');
    pm.rotation.y = Math.PI / 2; pm.position.set(s * 0.075, -0.115, 0);
    hp.add(pm);
    hp.add(at(rbox(0.008, 0.05, 0.016, 0.003, M.darkPlastic, 1), s * 0.088, -0.07, 0));
  }
  hp.position.set(0, -0.135, 0.07);
  hp.rotation.y = 0.2; // 89/200 look along -z and see the whole band, not its edge
  g.add(hp);
  return g;
}
