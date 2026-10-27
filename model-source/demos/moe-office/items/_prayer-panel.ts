import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './_moe-kit';
import { beadStrand, crescent, edgeRibbon, extrudeShape, hangingLoop, ogee, offsetPoly, type P2, type P3, shapeFrom, smooth2, strands } from './_prayer-geo';
import type { PrayerMats } from './_prayer-mats';

/**
 * The carved stand that sits on the chest (stand-local frame, see prayer-station.ts: lx across the
 * front, +y up, +lz toward the room, lz = 0 at the back board's front face, chest top at y 0.42):
 *
 * - back board with the mihrab crest: pointed onion arch, tip 1.755 m, widest ±0.293 at 1.45, neck
 *   ±0.25 at 1.335 (traced on the rectified photo 45 and the frontal photo 183); its face is the
 *   rectified photo (calligraphy in green/white/red, arabesque cartouches, two bone crescents, a gilt
 *   inner arch and a ring of drilled dots) with modelled crescents, a carved tooth border and the
 *   gilt-framed plaque under the arch;
 * - two side boards (0.27 deep) with three ogee steps descending to the front (traced in photo 44
 *   by intersecting rays with the board plane), gilt edge strips, a pointed-arch window with brass
 *   cames and a brass votive cup;
 * - three dark dowel rails following the steps (y 1.32 / 1.21 / 1.10), ends proud of the left board;
 * - tasbih: three long bone strands hung on the right board's outer face, and a brass hook bar on
 *   its inner front edge carrying the jade / crystal / carnelian strands that spill onto the chest.
 */
export const STAND = {
  cx: -0.007, sx: 0.29, t: 0.022, top: 0.42,
  depthBack: -0.035, front: 0.235,
  rails: [[0.08, 1.32], [0.13, 1.21], [0.18, 1.10]] as P2[],
  railR: 0.011,
  win: { z0: 0.073, z1: 0.177, y0: 0.535, spring: 0.765, apex: 0.845 },
};

/** side-board outline in (lz, y), CCW */
export function sideProfile(): P2[] {
  const p: P2[] = [[STAND.depthBack, STAND.top], [STAND.front, STAND.top], [STAND.front, 1.095]];
  ogee(p, [STAND.front, 1.095], [0.198, 1.140], 8);
  p.push([0.198, 1.185]);
  ogee(p, [0.198, 1.185], [0.150, 1.238], 8);
  p.push([0.150, 1.285]);
  ogee(p, [0.150, 1.285], [0.084, 1.348], 8);
  // pointed cap at the back
  p.push([0.06, 1.362], [0.042, 1.376], [0.029, 1.39], [0.02, 1.408], [0.008, 1.394], [-0.012, 1.379], [STAND.depthBack, 1.37]);
  return p;
}

function windowOutline(): P2[] {
  const { z0, z1, y0, spring, apex } = STAND.win;
  const c = (z0 + z1) / 2, hw = (z1 - z0) / 2;
  const pts: P2[] = [[z0, y0], [z1, y0], [z1, spring]];
  // pointed arch: two arcs meeting at the apex
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    pts.push([z1 - hw * (1 - Math.cos(t * Math.PI / 2)) * 1.0, spring + (apex - spring) * Math.sin(t * Math.PI / 2)]);
  }
  for (let i = 9; i >= 0; i--) {
    const t = i / 10;
    pts.push([z0 + hw * (1 - Math.cos(t * Math.PI / 2)), spring + (apex - spring) * Math.sin(t * Math.PI / 2)]);
  }
  void c;
  return pts;
}

/** crest + neck outline in (lx, y), CCW, starting bottom-right at y = 1.30 */
export function crestOutline(): P2[] {
  const half: P2[] = [[0.268, 1.30], [0.252, 1.333], [0.262, 1.36], [0.282, 1.40], [0.293, 1.45], [0.29, 1.51],
    [0.275, 1.57], [0.245, 1.625], [0.19, 1.675], [0.13, 1.71], [0.07, 1.735], [0.0, 1.755]];
  const right = smooth2(half, 60);
  const left = right.slice(0, -1).reverse().map(([x, y]) => [-x, y] as P2);
  return [...right, ...left];
}

export function buildStand(m: PrayerMats): THREE.Group {
  const g = new THREE.Group();
  g.name = 'prayer-stand';
  const { cx, sx, t } = STAND;

  // ---------------------------------------------------------------- side boards
  const prof = sideProfile();
  const win = windowOutline();
  const sideGeo = extrudeShape(shapeFrom(prof, [win]), t, 0.0025, 16);
  const frameShape = shapeFrom(offsetPoly(win, 0.011), [win]);
  const frameGeo = extrudeShape(frameShape, 0.004, 0.0012, 12);
  // gilt strip along the front edge and the stepped top (index 1 = bottom-front corner ... apex)
  const apexIdx = prof.findIndex(p => p[1] > 1.405);
  const ribbonLine = prof.slice(1, apexIdx + 1);
  const ribbon = edgeRibbon(ribbonLine, t * 0.2, t * 0.8, 0.0007);
  // a fine gilt line inset on the outer face, following the steps (photo 44)
  const inset = offsetPoly(prof, -0.012).slice(2, apexIdx);
  const insetLine = strands([inset.map(([z, y]) => [z, y, 0] as P3)], 0.0011, 4);

  for (const side of [-1, 1]) {
    const board = new THREE.Group();
    board.name = side < 0 ? 'side-board-left' : 'side-board-right';
    board.rotation.y = -Math.PI / 2;               // shape x -> lz, extrusion -> -lx
    const outer = cx + side * sx;
    board.position.x = side < 0 ? outer + t : outer;
    const b = new THREE.Mesh(sideGeo, [m.wood, m.woodEdge]);
    board.add(b);
    board.add(new THREE.Mesh(ribbon, m.gold));
    // inset gilt line on the outer face only
    const line = new THREE.Mesh(insetLine, m.gold);
    line.position.z = side < 0 ? t + 0.0004 : -0.0004;
    board.add(line);
    // window frames on both faces
    for (const [z, flip] of [[t, false], [0, true]] as const) {
      const f = new THREE.Mesh(frameGeo, m.wood);
      f.position.z = flip ? -0.004 : z;
      board.add(f);
    }
    // glass + brass cames in the window
    const glass = new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(win)), m.glass);
    glass.position.z = t / 2;
    board.add(glass);
    const { z0, z1, y0, spring, apex } = STAND.win;
    const c = (z0 + z1) / 2;
    const came: P3[][] = [
      [...offsetPoly(win, -0.004), offsetPoly(win, -0.004)[0]].map(([z, y]) => [z, y, t / 2] as P3),
      [[c, y0 + 0.004, t / 2], [c, apex - 0.006, t / 2]],
      // vesica: two arcs from near the sill to near the apex
      ...[-1, 1].map(s => Array.from({ length: 9 }, (_, i) => {
        const a = i / 8;
        return [c + s * 0.036 * Math.sin(a * Math.PI), y0 + 0.035 + (apex - y0 - 0.06) * a, t / 2] as P3;
      })),
      [[z0 + 0.004, spring, t / 2], [z1 - 0.004, spring, t / 2]],
      [[z0 + 0.004, y0 + 0.11, t / 2], [z1 - 0.004, y0 + 0.11, t / 2]],
    ];
    board.add(new THREE.Mesh(strands(came, 0.0016, 5), m.brass));
    // brass mushroom knob below the window on the outer face (photos 60, 63, 198)
    const knobZ = side < 0 ? t : 0, out = side < 0 ? 1 : -1;
    const knobPts = [[0.0, 0], [0.007, 0], [0.006, 0.012], [0.01, 0.018], [0.021, 0.022], [0.023, 0.026], [0.02, 0.03], [0.0, 0.032]].map(([x, y]) => new THREE.Vector2(x, y));
    const knob = new THREE.Mesh(new THREE.LatheGeometry(knobPts, 28), m.brass);
    knob.rotation.x = out * Math.PI / 2;
    knob.position.set(c, y0 + 0.012, knobZ);
    board.add(knob);
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.003, 20), m.brass);
    rose.rotation.x = Math.PI / 2;
    rose.position.set(c, y0 + 0.012, knobZ + out * 0.0015);
    board.add(rose);
    g.add(board);
  }

  // ---------------------------------------------------------------- rails (dowels)
  const leftOuter = cx - sx, rightInner = cx + sx - t;
  const ironMat = new THREE.MeshStandardMaterial({ color: '#141210', metalness: 0.6, roughness: 0.5 });
  for (const [z, y] of STAND.rails) {
    const len = rightInner + 0.008 - (leftOuter - 0.014);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(STAND.railR, STAND.railR, len, 20), m.darkWood);
    rail.rotation.z = Math.PI / 2;
    rail.position.set((rightInner + 0.008 + leftOuter - 0.014) / 2, y, z);
    g.add(rail);
    // carved dark rosette over each rail end on the left board (photo 67)
    const roseGeo = new THREE.SphereGeometry(0.022, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const rp = roseGeo.getAttribute('position');
    for (let i = 0; i < rp.count; i++) {
      const x = rp.getX(i), zz = rp.getZ(i), yy = rp.getY(i);
      const a = Math.atan2(zz, x);
      const k = 1 + 0.16 * Math.cos(a * 6);
      rp.setXYZ(i, x * k, yy * 0.45, zz * k);
    }
    roseGeo.computeVertexNormals();
    const rosette = new THREE.Mesh(roseGeo, m.darkWood);
    rosette.rotation.z = Math.PI / 2;
    rosette.position.set(leftOuter - 0.001, y, z);
    g.add(rosette);
    // and a carved collar where the rail enters each board's inner face (photo 67)
    for (const [xi, dir] of [[leftOuter + t, -1], [rightInner, 1]] as const) {
      const collar = new THREE.Mesh(roseGeo, m.darkWood);
      collar.rotation.z = dir * Math.PI / 2;
      collar.scale.set(0.8, 1.3, 0.8);
      collar.position.set(xi + 0.0005 * dir, y, z);
      g.add(collar);
    }
    // black wrought scroll under each rail on the left board's inner face (photo 67)
    const sx0 = leftOuter + t + 0.005;
    const scroll: P3[] = [];
    for (let i = 0; i <= 28; i++) {
      const u = i / 28;
      const a = u * Math.PI * 3.2;
      const rr = 0.018 * (1 - u * 0.55);
      scroll.push([sx0, y - 0.016 - u * 0.075 + Math.sin(a) * rr * 0.6, z + Math.cos(a) * rr]);
    }
    g.add(new THREE.Mesh(strands([scroll], 0.004, 6), ironMat));
  }

  // ---------------------------------------------------------------- back board + crest
  const bodyW = 2 * (sx - t) - 0.002;
  const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, 1.30 - STAND.top, t), [m.woodEdge, m.woodEdge, m.woodEdge, m.woodEdge, m.wood, m.wood]);
  body.position.set(cx, (1.30 + STAND.top) / 2, -t / 2);
  g.add(body);

  const outline = crestOutline();
  const crestGeo = extrudeShape(shapeFrom(outline), t, 0.003, 4);
  const crest = new THREE.Mesh(crestGeo, [m.crestFace, m.woodEdge]);
  crest.position.z = -t;
  crest.name = 'mihrab-crest';
  g.add(crest);

  // carved teeth along the crest edge (photo 44 close-up: a notched rim on the board's edge)
  const toothPts: { p: P2; a: number }[] = [];
  let acc = 0;
  for (let i = 1; i < outline.length; i++) {
    const a = outline[i - 1], b = outline[i];
    acc += Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (b[1] < 1.37 || acc < 0.016) continue;
    acc = 0;
    toothPts.push({ p: b, a: Math.atan2(b[1] - a[1], b[0] - a[0]) });
  }
  const tooth = new THREE.BoxGeometry(0.0065, 0.004, t * 0.7);
  const teeth = new THREE.InstancedMesh(tooth, m.darkWood, toothPts.length);
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1);
  toothPts.forEach(({ p, a }, i) => {
    const nx = Math.sin(a), ny = -Math.cos(a);
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
    mm.compose(new THREE.Vector3(p[0] + nx * 0.0012, p[1] + ny * 0.0012, -t / 2), q, s1);
    teeth.setMatrixAt(i, mm);
  });
  teeth.instanceMatrix.needsUpdate = true;
  g.add(teeth);

  // raised bone crescents with dark wooden bosses (centres from the rectified crest)
  for (const side of [-1, 1]) {
    const c = new THREE.Vector2(side * 0.233, 1.485);
    const sh = shapeFrom(crescent([c.x, c.y], 0.031, 0.024, 0.011, [-side, 0]));
    const cres = new THREE.Mesh(extrudeShape(sh, 0.003, 0.001, 32), m.ivory);
    g.add(cres);
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.0155, 20, 12), m.darkWood);
    boss.scale.z = 0.35;
    boss.position.set(c.x - side * 0.004, c.y, 0.001);
    g.add(boss);
    const pip = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 10, 8), m.ivory);
    pip.position.set(c.x - side * 0.032, c.y, 0.002);
    g.add(pip);
  }

  // gilt-framed plaque under the arch
  const px0 = -0.19, px1 = 0.18, py0 = 1.25, py1 = 1.326;
  const field = new THREE.Mesh(new THREE.PlaneGeometry(px1 - px0, py1 - py0), new THREE.MeshStandardMaterial({ color: '#2b1a0f', roughness: 0.7 }));
  field.position.set((px0 + px1) / 2, (py0 + py1) / 2, 0.0008);
  g.add(field);
  const bars: [number, number, number, number][] = [[px0, py0, px1, py0], [px1, py0, px1, py1], [px1, py1, px0, py1], [px0, py1, px0, py0]];
  for (const [ax, ay, bx, by] of bars) {
    const len = Math.hypot(bx - ax, by - ay) + 0.006;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.0055, 0.006), m.gold);
    bar.position.set((ax + bx) / 2, (ay + by) / 2, 0.003);
    bar.rotation.z = Math.atan2(by - ay, bx - ax);
    g.add(bar);
  }

  // ---------------------------------------------------------------- tasbih on the right board
  buildTasbih(g, m);

  g.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) { mesh.castShadow = mesh.material !== m.glass; mesh.receiveShadow = true; }
  });
  return g;
}

function tassel(at: P3, len: number, color: THREE.Material, seed: number) {
  const r = rng(seed);
  const lines: P3[][] = [];
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, rr = 0.002 + r() * 0.004;
    lines.push([at, [at[0] + Math.cos(a) * rr * 0.6, at[1] - 0.012, at[2] + Math.sin(a) * rr * 0.6],
      [at[0] + Math.cos(a) * rr, at[1] - len * (0.85 + r() * 0.15), at[2] + Math.sin(a) * rr]]);
  }
  const mesh = new THREE.Mesh(strands(lines, 0.0007, 3), color);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 10, 8), color);
  knot.position.set(at[0], at[1] - 0.006, at[2]);
  knot.scale.y = 1.6;
  const gg = new THREE.Group();
  gg.add(mesh, knot);
  return gg;
}

function buildTasbih(g: THREE.Group, m: PrayerMats) {
  const { cx, sx } = STAND;
  const pearl = new THREE.MeshPhysicalMaterial({ color: '#efe8da', roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: new THREE.Color('#ffffff') });
  const crystal = new THREE.MeshPhysicalMaterial({ color: '#dfe9ea', roughness: 0.05, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.72, specularIntensity: 1 });
  // photos 64/66: a muted, grey-green mottled jade and peachy carnelian, not saturated greens
  const jade = new THREE.MeshPhysicalMaterial({ color: '#7a9070', roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const jadePale = new THREE.MeshPhysicalMaterial({ color: '#a9b59c', roughness: 0.28, clearcoat: 0.6 });
  const carnelian = new THREE.MeshPhysicalMaterial({ color: '#b5755c', roughness: 0.25, clearcoat: 0.6 });
  const teal = new THREE.MeshPhysicalMaterial({ color: '#56736f', roughness: 0.3, clearcoat: 0.5 });
  const thread = new THREE.MeshStandardMaterial({ color: '#efe6c8', roughness: 0.9 });
  const yellow = new THREE.MeshStandardMaterial({ color: '#d8bb4c', roughness: 0.85 });
  const outerX = cx + sx;               // right board's outer face

  // three long bone/pearl strands on the outer face, hung by their middles from small brass pins
  const pins: [number, number, number][] = [[0.045, 1.325, 0.25], [0.118, 1.225, 0.27], [0.178, 1.13, 0.24]];
  pins.forEach(([z, y, drop], k) => {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.012, 8), m.brass);
    pin.rotation.z = Math.PI / 2;
    pin.position.set(outerX + 0.005, y, z);
    g.add(pin);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.003, 8, 6), m.brass);
    head.position.set(outerX + 0.011, y, z);
    g.add(head);
    const legs = hangingLoop([outerX + 0.007, y - 0.004, z], drop, 0.0042, [0.004, 0, 0], 40 + k);
    for (const leg of legs) g.add(beadStrand(leg, 0.0033, k === 1 ? crystal : pearl, { seed: 7 + k }));
    const bottom: P3 = [outerX + 0.011, y - 0.004 - drop, z];
    const imam = new THREE.Mesh(new THREE.IcosahedronGeometry(0.0055, 1), k === 1 ? crystal : pearl);
    imam.position.set(bottom[0], bottom[1] - 0.004, bottom[2]);
    g.add(imam);
    g.add(tassel([bottom[0], bottom[1] - 0.01, bottom[2]], 0.04, thread, 70 + k));
  });

  // brass pegs screwed into the right board's front edge, pointing into the room (photos 61, 64, 66);
  // the strands hang in front of the edge and pile up on the chest's front-right corner
  const edgeX = cx + sx - STAND.t / 2;
  const hooks: P3[] = [];
  for (let i = 0; i < 7; i++) {
    const y = [0.585, 0.61, 0.655, 0.67, 0.715, 0.75, 0.78][i];
    const x = edgeX - (i % 2 ? 0.004 : -0.002);
    const fan = [-0.004, -0.045, -0.016, -0.06, -0.026, -0.008, -0.04][i];
    const tip: P3 = [x + fan, y + 0.014, STAND.front + 0.03 + (i % 3) * 0.006];
    hooks.push(tip);
    const hook = new THREE.Mesh(strands([[[x, y, STAND.front - 0.004], [x + fan * 0.4, y + 0.003, STAND.front + 0.016], tip]], 0.0021, 6), m.brass);
    g.add(hook);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.004, 10, 8), m.brass);
    ball.position.set(...tip);
    g.add(ball);
  }
  const mats = [jade, crystal, jadePale, carnelian, jade, teal, crystal, pearl, jade, jadePale, carnelian, jade];
  const sizes = [0.0048, 0.0032, 0.004, 0.0027, 0.005, 0.003, 0.003, 0.0028, 0.0046, 0.004, 0.0027, 0.0045];
  const r = rng(99);
  let k = 0;
  hooks.forEach((tip, hi) => {
    const n = hi < 5 ? 3 : 2;
    for (let j = 0; j < n; j++, k++) {
      const mat = mats[k % mats.length];
      const rad = sizes[k % sizes.length];
      const top: P3 = [tip[0] + (j - 1) * 0.006, tip[1] - 0.005, tip[2] - 0.004];
      // the two lowest pegs' strands spill over the chest's front edge and hang down its face
      // (photos 64/66); the rest pile on the chest top at the front-right corner
      const hang = hi >= 5;
      const pool: P3 = hang
        ? [0.2 + r() * 0.045, 0.235 + r() * 0.09, 0.404 + r() * 0.012]
        : [0.2 + r() * 0.05, STAND.top + rad + 0.001, 0.28 + r() * 0.07];
      const mid: P3 = [top[0] - 0.008 - r() * 0.02, top[1] - (hang ? 0.13 : 0.1) - r() * 0.06, top[2] + 0.012 + r() * 0.025];
      const front: P3[] = [top, [top[0] - 0.003, top[1] - 0.05, top[2] + 0.006], mid,
        [pool[0] + 0.008, pool[1] + (hang ? 0.06 : 0.03), pool[2] - 0.015], pool,
        [pool[0] - 0.015, pool[1] - (hang ? 0.012 : 0.0), pool[2] + 0.008]];
      g.add(beadStrand(front, rad, mat, { seed: 200 + k }));
      const back: P3[] = [top, [top[0] + 0.004, top[1] - 0.06, top[2] - 0.004],
        [mid[0] + 0.012, mid[1] + 0.02, mid[2] - 0.012],
        hang ? [pool[0] + 0.02, pool[1] + 0.1, pool[2] - 0.03] : [pool[0] + 0.02, pool[1] + 0.012, pool[2] - 0.035],
        [pool[0] + 0.004, pool[1] + (hang ? 0.05 : 0.0), pool[2] - 0.04]];
      g.add(beadStrand(back, rad, mat, { seed: 300 + k }));
      if (k % 2 === 0) {
        const end = back[back.length - 1];
        // tassels hang straight down from the strand ends (photos 60/61), with a little sway only
        const tl = tassel([0, 0, 0], hang ? 0.06 : 0.045, k % 4 ? thread : yellow, 400 + k);
        tl.rotation.set(0.08 + (r() - 0.5) * 0.15, (r() - 0.5) * 0.8, (r() - 0.5) * 0.15);
        tl.position.set(end[0], end[1] - 0.004, end[2]);
        g.add(tl);
      }
    }
  });
}

export function mergedOrNull(geos: THREE.BufferGeometry[]) {
  return geos.length ? mergeGeometries(geos, false) : null;
}
