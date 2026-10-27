import * as THREE from 'three';
import {
  at, cyl, extrude, grp, instanced, lathe, mat4, mesh, rbox, rboxGeo, rng, sphere, tube, v3,
  type V2, type V3,
} from './_desk-toys-kit';
import type { DT } from './_desk-toys-mats';

/**
 * Cluster A — the toys standing on the west desk's west return, in front of the wall-2 window at
 * the NW corner. Photos 83, 86, 87, 89, 91, 168, 200 (86/87 are the close views, 1.0–1.1 m).
 *
 * ALL SIZES IN MM, measured from the photos: `triangulate.py` for points off any plane,
 * `metric_grid.py`/plane hits for anything standing on the desk, and a vertical-line solve for
 * heights. Desk top plane y = 820 mm (desk-bench depth-frame fit: frame 1246, 838 points on one
 * plane at 0.83–0.84, floor 0.005; frame 377 at 0.81; RoomPlan box top 0.815). Cross-check from
 * this pass: the paper-towel roll's top triangulates to y = 1094 mm from photos 86+87 (ray gap
 * 0.042 m) → a 274 mm roll on that plane.
 *
 * Local frame: +x east, +z toward the room, y up from the desk top (y = 0.820 room metres).
 *
 * Measured plan positions (plane hits at y = 0.820; photos 87 and 86 agree within 50 mm):
 *   paper-towel roll   x −2.48  z 1.34   roll Ø135 × 274, saucer Ø128
 *   drum fan           x −2.67  z 1.79   drum Ø110 × 60, centre 58 above the top
 *   geometric ornament x −2.62  z 1.90   167 tall (plinth 25 + gem 58 + coil 87)
 *   red side table     x −2.66  z 1.64   113 to the top disc, discs Ø74/Ø80
 *   figure             x −2.90  z 1.75   crest tip y 1.124 (triangulated 87+86, gap 5 mm) → 300 tall
 *   kufic panel        x −2.93  z 1.92   105 × 140 × 10 leaning on the wall
 *   plant              x −2.74  z 1.99   ~150 tall in a Ø56 pot
 *   cola can           x −2.40  z 2.06   Ø53 × 135
 */

export const DESK_TOP = 0.82;

export interface APlace {
  ornament: V2;
  fan: V2;
  figurine: V2;
  table: V2;
  towel: V2;
  can: V2;
  plaque: V2;
  plant: V2;
}

export function buildClusterA(m: DT, place: APlace): THREE.Group {
  const g = grp('desk-toys-a');
  const put = (o: THREE.Object3D, p: V2, ry = 0) => {
    at(o, p[0], DESK_TOP, p[1], ry);
    g.add(o);
    return o;
  };
  put(buildOrnament(m), place.ornament, -0.62);
  put(buildFan(m), place.fan, 2.2);
  put(buildFigurine(m), place.figurine, 1.98);
  put(buildMiniTable(m), place.table, 0.3);
  put(buildTowel(m), place.towel, -0.4);
  put(buildCokeCan(m), place.can, 0.85);
  put(buildPlaque(m), place.plaque, 0);
  put(buildPlant(m), place.plant, 1.1);
  return g;
}

// ------------------------------------------------------------------ small helpers

/** disc with `n` scalloped bumps around the edge (the gilt saucer under the paper towel) */
function scallopShape(r: number, bumps: number, depth: number, n = 200) {
  const pts: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r + Math.sin(a * bumps) * depth;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return pts;
}

/** flat ribbon following a curve — the ornament's coil and the table's perforated straps */
function ribbon(pts: V3[], width: number, thick: number, mat: THREE.Material, up: V3 = [0, 1, 0], segments = 140) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => v3(...p)));
  const N = segments;
  const frames = curve.computeFrenetFrames(N, false);
  const pos: number[] = [];
  const idx: number[] = [];
  const upv = v3(...up);
  for (let i = 0; i <= N; i++) {
    const p = curve.getPointAt(i / N);
    const t = frames.tangents[Math.min(i, N - 1)];
    const side = new THREE.Vector3().crossVectors(t, upv);
    if (side.lengthSq() < 1e-9) side.set(1, 0, 0);
    side.normalize();
    const nrm = new THREE.Vector3().crossVectors(side, t).normalize();
    for (const [s, u] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      const q = p.clone().addScaledVector(side, (s * width) / 2).addScaledVector(nrm, (u * thick) / 2);
      pos.push(q.x, q.y, q.z);
    }
    if (i < N) {
      const b = i * 4;
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      idx.push(b + 4, b + 6, b + 5, b + 4, b + 7, b + 6);
      idx.push(b, b + 4, b + 5, b, b + 5, b + 1);
      idx.push(b + 3, b + 2, b + 6, b + 3, b + 6, b + 7);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return mesh(geo, mat);
}

// ------------------------------------------------------------------ 1. geometric ornament (167 mm)

/**
 * White faceted hexagonal plinth (Ø132 foot → Ø92 top, 25 tall) carrying a glossy black faceted
 * gem (Ø78 × 58, flat-shaded icosahedron) and a white ribbon coil (Ø60, 87 tall, 2.6 turns).
 * Photo 87: plinth top at y 0.841, coil top at y 0.987.
 */
function buildOrnament(m: DT) {
  const g = grp('toy-ornament');
  const foot = cyl(0.066, 0.068, 0.004, m.porcelain, 6);
  foot.rotation.y = Math.PI / 6;
  at(foot, 0, 0.002, 0);
  g.add(foot);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.064, 0.021, 6, 1), m.porcelain);
  plinth.rotation.y = Math.PI / 6;
  plinth.castShadow = plinth.receiveShadow = true;
  at(plinth, 0, 0.0145, 0);
  g.add(plinth);
  const topPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.047, 0.004, 6, 1), m.porcelain);
  topPlate.rotation.y = Math.PI / 6;
  at(topPlate, 0, 0.027, 0);
  g.add(topPlate);

  const gemGeo = new THREE.IcosahedronGeometry(0.039, 0).toNonIndexed();
  gemGeo.computeVertexNormals();
  const gem = mesh(gemGeo, m.blackGloss, 'ornament-gem');
  gem.scale.set(1, 0.74, 1);
  at(gem, 0, 0.058, 0, 0.4, 0.2);
  g.add(gem);
  const groove = new THREE.Mesh(new THREE.TorusGeometry(0.0375, 0.0009, 4, 40), m.darkGrey);
  groove.rotation.x = Math.PI / 2;
  groove.position.y = 0.052;
  g.add(groove);

  const pts: V3[] = [];
  const turns = 2.6;
  const N = 110;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = -Math.PI * 0.15 + t * Math.PI * 2 * turns;
    const r = 0.03 - 0.007 * t;
    pts.push([Math.cos(a) * r, 0.088 + t * 0.076, Math.sin(a) * r * 0.94]);
  }
  g.add(ribbon(pts, 0.0125, 0.0038, m.whiteGloss));
  g.add(at(cyl(0.011, 0.013, 0.007, m.whiteGloss, 14), 0, 0.085, 0));
  return g;
}

// ------------------------------------------------------------------ 2. drum fan (Ø110 drum)

/**
 * White drum fan. Photo 87: drum top y 0.933, drum centre y 0.878 → Ø110 drum centred 58 mm above
 * the desk, 60 deep. Deep front lip, translucent 13-blade impeller behind concentric grille rings,
 * Ø30 hub with a 24-tick blue ring, orange rocker on the upper-left rim, square slotted base with a
 * front tray, cable out of the back, and the brass ferrule + red wire mount on the top right.
 */
function buildFan(m: DT) {
  const g = grp('toy-fan');
  const R = 0.055;
  const CY = 0.058;
  const D = 0.06;

  // base: slotted square plate + short angled column + front tray
  g.add(at(mesh(rboxGeo(0.072, 0.007, 0.072, 0.003, 2), m.white), 0, 0.0035, -0.004));
  g.add(at(mesh(rboxGeo(0.03, 0.004, 0.012, 0.0015, 1), m.darkGrey), 0, 0.0075, 0.014));
  const col = mesh(rboxGeo(0.026, 0.03, 0.024, 0.005, 2), m.white);
  at(col, 0, 0.021, -0.014, 0, -0.18);
  g.add(col);
  g.add(at(mesh(rboxGeo(0.05, 0.016, 0.034, 0.004, 2), m.white), 0, 0.012, 0.036));
  g.add(at(mesh(rboxGeo(0.044, 0.004, 0.028, 0.0015, 1), m.darkGrey), 0, 0.0195, 0.036));

  const drum = grp('fan-drum');
  at(drum, 0, CY, 0);
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(R, R, D, 56, 1, true), m.white);
  shell.rotation.x = Math.PI / 2;
  shell.castShadow = shell.receiveShadow = true;
  drum.add(shell);
  for (const [z, r, t] of [[D / 2, R, 0.0038], [D / 2 - 0.007, R - 0.004, 0.0028]] as const) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 56), m.whiteGloss);
    ring.position.z = z;
    drum.add(ring);
  }
  const backRing = new THREE.Mesh(new THREE.TorusGeometry(R, 0.0035, 8, 56), m.white);
  backRing.position.z = -D / 2;
  drum.add(backRing);
  const back = lathe([[0, 0.024], [0.018, 0.022], [0.034, 0.016], [0.046, 0.007], [R, 0]], m.white, 40);
  back.rotation.x = Math.PI / 2;
  back.position.z = -D / 2;
  drum.add(back);
  const vents: THREE.Matrix4[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    vents.push(mat4(Math.cos(a) * 0.032, Math.sin(a) * 0.032, -D / 2 - 0.012, 0, 0, a, 1));
  }
  drum.add(instanced(new THREE.BoxGeometry(0.012, 0.0035, 0.002), m.darkGrey, vents));

  // translucent impeller, set back behind the grille so the blades read
  const bladeMat = new THREE.MeshPhysicalMaterial({
    color: '#f2f6f8', roughness: 0.24, metalness: 0, transparent: true, opacity: 0.5,
    side: THREE.DoubleSide, depthWrite: false, clearcoat: 0.45,
  });
  bladeMat.name = 'fan-blades';
  const blades = grp('fan-blades');
  const bladeGeo = new THREE.BoxGeometry(0.0018, 0.042, 0.032);
  const bm: THREE.Matrix4[] = [];
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2;
    bm.push(mat4(Math.cos(a) * 0.03, Math.sin(a) * 0.03, -0.002, 0, 0, a + 0.55));
  }
  blades.add(instanced(bladeGeo, bladeMat, bm, 'fan-blade-set'));
  drum.add(blades);

  // grille: two rings + 13 radial ribs
  const ribs = grp('fan-grille');
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2;
    const rib = mesh(new THREE.BoxGeometry(0.0032, 0.05, 0.0018), m.whiteGloss);
    rib.position.set(Math.cos(a) * 0.026, Math.sin(a) * 0.026, 0.027);
    rib.rotation.z = a - Math.PI / 2;
    ribs.add(rib);
  }
  for (const r of [0.052, 0.04]) {
    const rr = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0021, 6, 52), m.whiteGloss);
    rr.position.z = 0.027;
    ribs.add(rr);
  }
  drum.add(ribs);

  // hub Ø24, ticked blue ring, orange arc
  const hub = cyl(0.0115, 0.0125, 0.008, m.porcelain, 30);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.03;
  drum.add(hub);
  const hubRing = new THREE.Mesh(new THREE.TorusGeometry(0.0162, 0.0026, 6, 44), m.white);
  hubRing.position.z = 0.0285;
  drum.add(hubRing);
  const ticks: THREE.Matrix4[] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ticks.push(mat4(Math.cos(a) * 0.0196, Math.sin(a) * 0.0196, 0.0295, 0, 0, a, 1));
  }
  drum.add(instanced(new THREE.BoxGeometry(0.0014, 0.0042, 0.0012), m.blueGrey, ticks, 'fan-hub-ticks'));
  const orangeArc = new THREE.Mesh(new THREE.TorusGeometry(0.0155, 0.0028, 6, 18, Math.PI * 0.4), m.orange);
  orangeArc.position.z = 0.0305;
  orangeArc.rotation.z = -2.25;
  drum.add(orangeArc);

  // orange rocker switch: a small flat block on the upper-left rim
  const rocker = mesh(rboxGeo(0.024, 0.009, 0.015, 0.003, 2), m.orange);
  at(rocker, -0.023, R - 0.003, 0.006, 0.06, -0.1, 0.16);
  drum.add(rocker);

  // cable out of the back
  drum.add(tube([[0.0, -0.012, -D / 2 - 0.015], [0.012, -0.04, -D / 2 - 0.05], [0.032, -0.062, -D / 2 - 0.072]], 0.0022, m.darkGrey, 12, 6));
  g.add(drum);

  // brass ferrule + white tube + red wire, mounted on the drum's top right
  const ferrule = cyl(0.0062, 0.0068, 0.017, m.brass, 16);
  ferrule.rotation.z = Math.PI / 2;
  at(ferrule, 0.034, CY + R - 0.012, 0.004, 0, 0.15, 0);
  g.add(ferrule);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0012, 6, 14), m.brass);
  collar.position.set(0.043, CY + R - 0.012, 0.004);
  collar.rotation.y = Math.PI / 2;
  g.add(collar);
  const ptube = cyl(0.0042, 0.0042, 0.022, m.porcelain, 12);
  ptube.rotation.z = Math.PI / 2;
  at(ptube, 0.05, CY + R - 0.012, 0.004);
  g.add(ptube);
  g.add(tube(
    [[0.02, CY + R + 0.003, 0.0], [0.03, CY + R + 0.03, 0.002], [0.048, CY + R + 0.036, 0.006], [0.058, CY + R + 0.026, 0.008]],
    0.0011, m.redPlain, 22, 6,
  ));
  return g;
}

// ------------------------------------------------------------------ 3. the figure (300 mm)

/**
 * Minnie-Mouse-style vinyl figure with a punk mohawk. 300 mm sole → crest tip (the tip
 * triangulates to y 1.124 from photos 87+86, ray gap 5 mm). Vertical proportions read off the
 * native crop: legs 133, shorts 37, torso 20, head 67, crest above the head 43.
 * 20 separately built parts: plate, 2 feet, 2 ankles, 2 shins, 2 knees, shorts, hem, 2 belt
 * straps, buckle, torso, 2 arms, 2 gloves (palm + 4 fingers + thumb + cuff), head, muzzle, nose,
 * mouth, 2 eyes + 2 lids, brow, 2 ears + 2 inner rings, mohawk (3 spikes), tail.
 */
function buildFigurine(m: DT) {
  const g = grp('toy-figurine');
  const body = grp('fig-body');

  // thin display plate the figure stands on
  body.add(lathe([[0, 0], [0.036, 0], [0.038, 0.0025], [0.036, 0.005], [0, 0.005]], m.darkGrey, 40));

  // ---- legs
  for (const s of [-1, 1]) {
    const leg = lathe([[0.019, 0], [0.021, 0.04], [0.022, 0.085], [0.019, 0.115], [0.013, 0.128]], m.furGrey, 22);
    at(leg, s * 0.026, 0.014, s < 0 ? 0.014 : 0.02, 0, s < 0 ? 0.3 : 0.07, 0);
    body.add(leg);
    const knee = sphere(0.02, m.furGrey, 18, 14);
    knee.scale.set(1, 1.1, 1.05);
    at(knee, s * 0.026, 0.078, s < 0 ? 0.05 : 0.026);
    body.add(knee);
    const foot = sphere(0.017, m.furGrey, 20, 14);
    foot.scale.set(1.0, 0.55, 1.85);
    at(foot, s * 0.026, 0.014, s < 0 ? 0.036 : 0.05);
    body.add(foot);
    body.add(at(sphere(0.013, m.furGrey, 14, 10), s * 0.026, 0.028, s < 0 ? 0.03 : 0.045));
    // mould parting seam down the outside of each shin (the figure is a cast vinyl)
    const seam: V3[] = [
      [s * 0.044, 0.03, 0.012], [s * 0.046, 0.06, 0.016], [s * 0.045, 0.09, 0.022], [s * 0.04, 0.118, 0.026],
    ];
    body.add(tube(seam, 0.0006, m.furMid, 12, 4));
  }

  // ---- shorts: 37 mm tall, black satin, hem + two white belt straps + buckle
  const shorts = lathe([[0.031, 0], [0.036, 0.004], [0.038, 0.02], [0.036, 0.032], [0.032, 0.037]], m.shorts, 30);
  at(shorts, 0, 0.133, 0.006);
  body.add(shorts);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.0345, 0.0024, 6, 30), m.shorts);
  hem.rotation.x = Math.PI / 2;
  hem.position.set(0, 0.135, 0.006);
  body.add(hem);
  for (const dy of [0, 0.009]) {
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.0362, 0.0016, 6, 30), m.belt);
    belt.rotation.x = Math.PI / 2;
    belt.position.set(0, 0.161 + dy, 0.006);
    body.add(belt);
  }
  body.add(at(mesh(rboxGeo(0.013, 0.009, 0.003, 0.0012, 1), m.glove), 0, 0.164, 0.043));

  // ---- torso, short and hunched forward
  const chest = lathe([[0.026, -0.018], [0.032, -0.012], [0.036, 0], [0.036, 0.012], [0.031, 0.022], [0.022, 0.03], [0, 0.033]], m.furGrey, 30);
  chest.scale.set(1.12, 1, 0.9);
  const torso = grp('fig-torso');
  torso.add(chest);
  at(torso, 0, 0.168, 0.012, 0, 0.3);
  body.add(torso);

  // ---- arms
  body.add(tube([[-0.038, 0.19, 0.03], [-0.052, 0.212, 0.048], [-0.052, 0.222, 0.062]], 0.0115, m.furGrey, 18, 10));
  body.add(tube([[0.036, 0.188, 0.028], [0.05, 0.168, 0.046], [0.04, 0.148, 0.062]], 0.0115, m.furGrey, 18, 10));

  // ---- raised glove: facepalm with four fingers, thumb and cuff
  const gloveHi = grp('fig-glove-hi');
  const palm = sphere(0.017, m.glove, 20, 16);
  palm.scale.set(0.85, 1.2, 0.72);
  gloveHi.add(palm);
  const fingers: [number, number, number, number][] = [
    [-0.0105, 0.022, -0.001, -0.16], [-0.0035, 0.026, 0, -0.05], [0.0035, 0.025, 0, 0.05], [0.0102, 0.021, -0.001, 0.17],
  ];
  for (const [dx, dy, dz, rz] of fingers) {
    const f = lathe([[0.005, 0], [0.0053, 0.011], [0.005, 0.022], [0.004, 0.029], [0, 0.033]], m.glove, 12);
    at(f, dx, dy, dz, 0, 0.1, rz);
    gloveHi.add(f);
  }
  const thumb = lathe([[0.0054, 0], [0.0057, 0.009], [0.0044, 0.018], [0, 0.022]], m.glove, 12);
  at(thumb, 0.014, 0.007, 0.004, 0, 0, -0.95);
  gloveHi.add(thumb);
  gloveHi.add(at(cyl(0.0135, 0.0145, 0.008, m.glove, 20), 0, -0.013, 0));
  at(gloveHi, -0.05, 0.226, 0.066, 0.25, -0.35, 0.3);
  body.add(gloveHi);

  // ---- the lower glove resting on the belt
  const gloveLo = grp('fig-glove-lo');
  const palm2 = sphere(0.016, m.glove, 20, 16);
  palm2.scale.set(1.2, 0.8, 0.95);
  gloveLo.add(palm2);
  for (let i = 0; i < 4; i++) {
    const f = lathe([[0.0048, 0], [0.005, 0.008], [0.004, 0.017], [0, 0.021]], m.glove, 10);
    at(f, 0.002 + (i - 1.5) * 0.0062, -0.001, 0.006 - i * 0.0075, 0, 1.25, 0);
    gloveLo.add(f);
  }
  const cuff2 = cyl(0.013, 0.014, 0.007, m.glove, 18);
  at(cuff2, -0.012, 0.001, 0, 0, 0, Math.PI / 2);
  gloveLo.add(cuff2);
  at(gloveLo, 0.038, 0.156, 0.062, -0.2, 0.55, -0.35);
  body.add(gloveLo);

  // ---- head Ø58, tipped down; face in three-quarter profile
  const head = grp('fig-head');
  const skull = sphere(0.029, m.furGrey, 30, 22);
  skull.scale.set(1.0, 1.05, 1.0);
  head.add(skull);
  const muzzle = sphere(0.018, m.furGrey, 22, 16);
  muzzle.scale.set(0.92, 0.72, 1.35);
  at(muzzle, 0, -0.016, 0.024);
  head.add(muzzle);
  const nose = sphere(0.0046, m.furDark, 14, 10);
  nose.scale.set(1.25, 0.8, 0.85);
  at(nose, 0, -0.012, 0.042);
  head.add(nose);
  const mouthPts: V3[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    mouthPts.push([-0.0065 + t * 0.013, -0.026 - Math.sin(t * Math.PI) * 0.0028, 0.037]);
  }
  head.add(tube(mouthPts, 0.0009, m.eyeInk, 10, 5));
  const brow = sphere(0.010, m.furGrey, 14, 10);
  brow.scale.set(1.5, 0.36, 0.6);
  at(brow, 0, 0.015, 0.025);
  head.add(brow);
  for (const s of [-1, 1]) {
    const ear = sphere(0.019, m.furDark, 24, 18);
    ear.scale.set(1, 1, 0.5);
    at(ear, s * 0.031, 0.021, -0.008, s * 0.36, s * 0.08, s * 0.2);
    head.add(ear);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0105, 0.0011, 5, 22), m.furMid);
    ring.scale.set(1, 1, 0.4);
    at(ring, s * 0.0315, 0.0195, 0.0035, s * 0.36, 0, s * 0.2);
    head.add(ring);
    // the mottled darker patches the ears carry
    for (const [dx, dy, dz, rr] of [[0.004, 0.006, 0.008, 0.0042], [-0.005, -0.002, 0.0085, 0.0034]] as const) {
      const spot = sphere(rr, m.furDark, 10, 8);
      spot.scale.set(1, 1, 0.25);
      at(spot, s * 0.031 + dx, 0.021 + dy, dz, s * 0.36, 0, s * 0.2);
      head.add(spot);
    }
  }
  // the black hair mass over the back and top of the skull, ending in a point at the nape
  const hair = sphere(0.03, m.blackGloss, 26, 20);
  hair.scale.set(1.02, 1.0, 0.95);
  at(hair, 0, 0.006, -0.016);
  head.add(hair);
  const nape = mesh(new THREE.ConeGeometry(0.016, 0.03, 10, 2), m.blackGloss);
  nape.scale.set(1, 1, 0.7);
  at(nape, 0, -0.019, -0.026, 0.4, 0, Math.PI);
  head.add(nape);
  // the eye: an angular black slash across the face (the reference shows one heavy painted eye)
  const eyeWedge = mesh(rboxGeo(0.019, 0.0055, 0.003, 0.0012, 1), m.eyeInk);
  at(eyeWedge, -0.0125, 0.004, 0.0265, 0.15, -0.35, 0.42);
  head.add(eyeWedge);
  const lashTail = mesh(rboxGeo(0.009, 0.003, 0.0025, 0.0008, 1), m.eyeInk);
  at(lashTail, -0.0215, 0.0095, 0.0225, 0.2, -0.4, 1.1);
  head.add(lashTail);
  const crest = mesh(new THREE.ConeGeometry(0.0095, 0.062, 14, 4), m.blackGloss, 'fig-crest');
  crest.scale.set(1, 1, 0.55);
  at(crest, 0.001, 0.038, -0.012, 0.1, 0.1, -0.08);
  head.add(crest);
  for (const [dx, dy, dz, h, r] of [[-0.009, 0.026, -0.02, 0.03, 0.006], [0.009, 0.025, -0.021, 0.026, 0.0055]] as const) {
    const sp = mesh(new THREE.ConeGeometry(r, h, 10, 2), m.blackGloss);
    sp.scale.set(1, 1, 0.6);
    at(sp, dx, dy, dz, 0, 0.2, dx < 0 ? 0.22 : -0.22);
    head.add(sp);
  }
  at(head, -0.002, 0.203, 0.032, 0.12, 0.5, 0.08);
  body.add(head);

  // ---- tail: tapered, curving down behind and trailing onto the desk
  const tp: V3[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    tp.push([0.03 + Math.sin(t * 2.2) * 0.05, 0.13 - t * 0.125 + Math.sin(t * 3) * 0.008, -0.02 - t * 0.05]);
  }
  const tailCurve = new THREE.CatmullRomCurve3(tp.map(p => v3(...p)));
  const tailGeo = new THREE.TubeGeometry(tailCurve, 26, 0.008, 8, false);
  const pos = tailGeo.getAttribute('position');
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    tmp.fromBufferAttribute(pos, i);
    const u = i / Math.max(1, pos.count - 1);
    const c = tailCurve.getPointAt(Math.min(1, u));
    const k = 1 - 0.5 * u;
    pos.setXYZ(i, c.x + (tmp.x - c.x) * k, c.y + (tmp.y - c.y) * k, c.z + (tmp.z - c.z) * k);
  }
  tailGeo.computeVertexNormals();
  body.add(mesh(tailGeo, m.furGrey));

  g.add(body);
  return g;
}

// ------------------------------------------------------------------ 4. red side table (113 mm)

/**
 * Small red table: base disc Ø80 × 8 with a white starburst lattice print, top disc Ø74 at 113,
 * two white perforated strap legs (13 wide, 9 holes), a tiny glossy black figure (26 tall) on top.
 * Photo 86: top surface y 0.941, base disc top y 0.833.
 */
function buildMiniTable(m: DT) {
  const g = grp('toy-minitable');
  const R = 0.04;
  const TOPY = 0.113;
  const base = cyl(R, R * 0.97, 0.008, [m.red, m.redPlain, m.red], 44);
  at(base, 0, 0.004, 0);
  g.add(base);
  const top = cyl(R * 0.92, R * 0.92, 0.007, [m.red, m.redPlain, m.red], 44);
  at(top, 0, TOPY, 0);
  g.add(top);
  const lip = cyl(R * 0.88, R * 0.88, 0.004, m.redPlain, 36);
  at(lip, 0, TOPY - 0.005, 0);
  g.add(lip);

  for (const s of [-1, 1]) {
    const pts: V3[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const ang = s * (0.55 + t * 0.42);
      const rad = R * (0.8 + Math.sin(t * Math.PI) * 0.16);
      pts.push([Math.cos(ang) * rad * 0.5, 0.008 + t * (TOPY - 0.018), Math.sin(ang) * rad]);
    }
    g.add(ribbon(pts, 0.012, 0.003, m.whiteGloss, [1, 0, 0]));
    const holes: THREE.Matrix4[] = [];
    for (let i = 0; i < 9; i++) {
      const t = (i + 0.5) / 9;
      const ang = s * (0.55 + t * 0.42);
      const rad = R * (0.8 + Math.sin(t * Math.PI) * 0.16);
      holes.push(mat4(Math.cos(ang) * rad * 0.5 + s * 0.0017, 0.008 + t * (TOPY - 0.018), Math.sin(ang) * rad, 0, s * 1.3, 0, 1));
    }
    g.add(instanced(new THREE.CircleGeometry(0.0016, 8), m.darkGrey, holes, 'minitable-holes'));
  }

  const fig = grp('minitable-figure');
  fig.add(lathe([[0, 0], [0.0055, 0.001], [0.007, 0.008], [0.0055, 0.014], [0.0038, 0.018], [0, 0.019]], m.blackGloss, 18));
  const headF = sphere(0.005, m.blackGloss, 16, 12);
  headF.scale.set(1, 0.95, 1.25);
  at(headF, 0, 0.022, 0.001);
  fig.add(headF);
  const horn = mesh(new THREE.ConeGeometry(0.0022, 0.01, 8), m.blackGloss);
  at(horn, 0.001, 0.029, -0.001, 0, 0, 0.22);
  fig.add(horn);
  fig.add(tube([[-0.0045, 0.015, 0], [-0.009, 0.018, 0.004], [-0.011, 0.013, 0.009]], 0.0016, m.blackGloss, 10, 6));
  fig.add(tube([[0.0045, 0.015, 0], [0.009, 0.019, 0.004], [0.01, 0.023, 0.006]], 0.0016, m.blackGloss, 10, 6));
  at(fig, 0.005, TOPY + 0.0035, 0.004, -0.7);
  g.add(fig);
  return g;
}

// ------------------------------------------------------------------ 5. paper towel roll (Ø135 × 274)

/**
 * Kitchen roll on a gilt scalloped saucer: saucer Ø128 with 12 petals and a beaded rim, roll
 * Ø135 × 274 with a Ø48 cardboard core showing at the top, quilt emboss, lifted free end.
 */
function buildTowel(m: DT) {
  const g = grp('toy-towel');
  const plateR = 0.064;
  const saucer = extrude(scallopShape(plateR, 12, 0.0045), 0.004, m.gold, 0.001, 8);
  saucer.rotation.x = -Math.PI / 2;
  at(saucer, 0, 0.002, 0);
  g.add(saucer);
  g.add(lathe([[0.05, 0.004], [0.056, 0.006], [0.058, 0.011], [0.056, 0.013]], m.gold, 44));
  const rimPts: V3[] = [];
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const rr = plateR * 0.99;
    rimPts.push([Math.cos(a) * rr, 0.004 + Math.sin(a * 12) * 0.0016, Math.sin(a) * rr]);
  }
  g.add(tube(rimPts, 0.0016, m.gold, 140, 5));

  const y0 = 0.013;
  const R = 0.0675;
  const H = 0.274;
  g.add(lathe([
    [R * 0.97, y0], [R, y0 + 0.004], [R, y0 + H - 0.006], [R * 0.985, y0 + H - 0.001], [R * 0.9, y0 + H + 0.001],
    [0.026, y0 + H + 0.001], [0.026, y0 + H - 0.014], [0.023, y0 + H - 0.024], [0.022, y0 + 0.02], [0.022, y0],
  ], m.towelPaper, 60));
  const core = cyl(0.0245, 0.0245, 0.26, m.core, 30, true);
  at(core, 0, y0 + 0.13, 0);
  core.castShadow = false;
  g.add(core);
  const flap = mesh(new THREE.CylinderGeometry(R + 0.0015, R + 0.0015, 0.11, 18, 1, true, -0.5, 1.0), m.towelPaper);
  at(flap, 0, y0 + 0.06, 0);
  flap.rotation.y = 0.35;
  g.add(flap);
  return g;
}

// ------------------------------------------------------------------ 6. slim cola can (Ø53 × 135)

function buildCokeCan(m: DT) {
  const g = grp('toy-can');
  const R = 0.0265;
  const H = 0.135;
  g.add(lathe([
    [0, 0.002], [R * 0.8, 0.002], [R * 0.95, 0.007], [R, 0.013], [R, H - 0.03], [R * 0.92, H - 0.018],
    [R * 0.74, H - 0.006], [R * 0.68, H - 0.002], [0, H - 0.002],
  ], m.coke, 44));
  g.add(at(cyl(R * 0.67, R * 0.67, 0.0025, m.cokeTop, 30), 0, H - 0.001, 0));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R * 0.68, 0.0018, 6, 34), m.cokeTop);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = H - 0.001;
  g.add(rim);
  const tab = new THREE.Mesh(new THREE.TorusGeometry(0.0072, 0.0014, 6, 14, Math.PI * 1.5), m.cokeTop);
  tab.rotation.x = -Math.PI / 2;
  at(tab, 0.007, H + 0.0016, 0);
  g.add(tab);
  return g;
}

// ------------------------------------------------------------------ 7. kufic panel + green hand fan

/**
 * Black/gilt square-kufic panel 105 × 140 × 10 leaning on the west wall, facing east (+x), with a
 * dark-green pleated hand fan (Ø125, 110° open, 9 ribs, gilt pivot rivet) leaning against it.
 */
function buildPlaque(m: DT) {
  const g = grp('toy-plaque');
  const w = 0.105, h = 0.14, t = 0.01;
  const lean = grp('plaque-lean');
  lean.rotation.x = -0.17;
  // gilt frame + the print on its own double-sided plate, 4 mm proud of the frame face
  const frame = rbox(w, h, t, 0.003, m.gold, 2);
  at(frame, 0, h / 2, 0);
  lean.add(frame);
  const printMat = m.kufic.clone();
  printMat.side = THREE.DoubleSide;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.012, h - 0.012), printMat);
  at(face, 0, h / 2, t / 2 + 0.004);
  lean.add(face);
  for (const [dx, dy, ww, hh] of [
    [0, h - 0.004, w - 0.008, 0.004], [0, 0.004, w - 0.008, 0.004],
    [-w / 2 + 0.004, h / 2, 0.004, h - 0.008], [w / 2 - 0.004, h / 2, 0.004, h - 0.008],
  ] as const) {
    lean.add(at(rbox(ww, hh, 0.003, 0.001, m.gold, 1), dx, dy, t / 2 + 0.001));
  }
  g.add(lean);

  const fan = grp('toy-green-fan');
  const span = (Math.PI * 110) / 180;
  const fr = 0.0625;
  const blade = new THREE.Shape();
  blade.moveTo(0, 0);
  blade.absarc(0, 0, fr, -Math.PI / 2 - span / 2, -Math.PI / 2 + span / 2, false);
  blade.lineTo(0, 0);
  fan.add(extrude(blade, 0.004, m.greenDeep, 0.0008, 28));
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 - span / 2 + (i / 8) * span;
    const len = fr * (i % 2 === 0 ? 0.94 : 0.86);
    const geo = new THREE.BoxGeometry(0.0032, len, 0.0018);
    geo.translate(0, len / 2, 0);
    const rib = new THREE.Mesh(geo, m.green);
    rib.position.z = 0.0035;
    rib.rotation.z = a + Math.PI / 2;
    fan.add(rib);
  }
  const rivet = cyl(0.0055, 0.0055, 0.009, m.gold, 14);
  rivet.rotation.x = Math.PI / 2;
  at(rivet, 0, 0, 0.002);
  fan.add(rivet);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(fr, 0.0016, 5, 30, span), m.gold);
  edge.rotation.z = -Math.PI / 2 - span / 2;
  edge.position.z = 0.0015;
  fan.add(edge);
  at(fan, 0.052, 0.06, 0.02, -0.5, -0.22, 0.18);
  g.add(fan);
  // the small teal plastic fragment wedged behind the panel (photo 86/87)
  const teal = new THREE.MeshStandardMaterial({ color: '#2f8f96', roughness: 0.45 });
  teal.name = 'teal-fragment';
  const frag = mesh(rboxGeo(0.036, 0.012, 0.022, 0.004, 2), teal);
  at(frag, -0.03, 0.006, -0.02, 0.3, 0.15, 0.1);
  g.add(frag);
  // turn the whole assembly to face east, and set it back against the wall
  g.rotation.y = Math.PI / 2;
  return g;
}

// ------------------------------------------------------------------ 8. dark-green strap plant

/** small strap-leaved plant, 150 mm tall in a Ø56 porcelain pot */
function buildPlant(m: DT) {
  const g = grp('toy-plant');
  g.add(lathe([[0, 0], [0.026, 0], [0.029, 0.008], [0.03, 0.042], [0.027, 0.044], [0.025, 0.04], [0.023, 0.01], [0, 0.01]], m.porcelain, 28));
  g.add(at(cyl(0.026, 0.026, 0.004, m.darkGrey, 22), 0, 0.042, 0));
  const r = rng(12);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + r() * 0.35;
    const len = 0.055 + r() * 0.035;
    const pts: V3[] = [];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const spread = Math.sin(t * 1.35) * len * 0.62;
      pts.push([Math.cos(a) * (0.008 + spread), 0.044 + t * len * (0.95 - 0.3 * t), Math.sin(a) * (0.008 + spread)]);
    }
    const curve = new THREE.CatmullRomCurve3(pts.map(p => v3(...p)));
    // a flat strap: tube with 3 radial segments, squashed across
    const leaf = mesh(new THREE.TubeGeometry(curve, 14, 0.0026, 3, false), m.greenLeaf);
    leaf.scale.set(1, 1, 1);
    g.add(leaf);
  }
  return g;
}
