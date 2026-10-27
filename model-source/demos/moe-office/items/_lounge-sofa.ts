import * as THREE from 'three';
import { at, canvasTex, rbox, v3 } from './_moe-kit';
import { clothSurface, mulberry32 } from './_lounge-geo';
import { SET, buildTuftedCouch, type SetMats } from './_tufted-set';

/**
 * Wall-3 cream tufted three-seater (RoomPlan object 3; photos 103/123/124/125/149).
 *
 * Same set as the loveseat by the west desk: the whole build — tuxedo arms, rolled back, crystal
 * diamond tufting, piped cushions — comes from `_tufted-set.ts` so both pieces stay identical.
 * Footprint: back against wall 3 (x = 2.976), front x ≈ 2.076, z −0.68…1.46 (2.14 m, three
 * cushions). Scan: back/arm tops 0.79, cushion tops 0.47.
 */

export type SofaMats = {
  set: SetMats; card: THREE.Material; cardTape: THREE.Material;
  fleece: THREE.MeshStandardMaterial; hoodie: THREE.MeshStandardMaterial;
};

const WALL = 2.976;
const Z0 = -0.68, Z1 = 1.46;

export function buildSofa(m: SofaMats): THREE.Group {
  const g = new THREE.Group();
  g.name = 'tufted-sofa';
  const couch = buildTuftedCouch({ name: 'tufted-sofa-body', length: Z1 - Z0, seats: 3, seed: 3 }, m.set);
  // local front (-z) faces the room (-x); local +x runs toward -z
  couch.rotation.y = Math.PI / 2;
  couch.position.set(WALL - 0.002 - SET.depth / 2, 0, (Z0 + Z1) / 2);
  g.add(couch);

  // the cardboard box parked on the north arm (photos 103/108/124)
  const box = new THREE.Group();
  box.name = 'sofa-cardboard-box';
  box.add(at(rbox(0.19, 0.13, 0.16, 0.005, m.card, 2), 0, 0.065, 0));
  box.add(at(rbox(0.196, 0.011, 0.028, 0.003, m.cardTape, 1), 0, 0.10, 0));
  at(box, 2.865, SET.height, Z1 - SET.armW / 2 - 0.01, 0.1);
  box.userData.physics = { type: 'dynamic', mass: 0.4, shape: 'box', surface: 'cardboard' };
  g.add(box);

  g.add(buildSofaClutter(m));

  g.userData.physics = { type: 'static' };
  return g;
}

/**
 * What lives on the sofa (photos 103/123/124/125): a royal-blue fleece blanket bundled on the
 * middle cushion with a black hoodie half over it toward the back, and a grey-and-white striped
 * towel thrown across the north arm. Seat tops ≈ 0.495, arm top 0.79 (z 1.27…1.46).
 */
function buildSofaClutter(m: SofaMats) {
  const g = new THREE.Group();
  g.name = 'sofa-clutter';
  const fleece = m.fleece;
  const hoodie = m.hoodie;
  const seat = 0.495;

  // blue fleece blanket folded into a loaf on the middle cushion, black hoodie over its back half
  // (photo 124): one height field for the bundle, the hoodie draped by sampling it
  const bundle = fleeceBundle(fleece, hoodie);
  bundle.position.set(2.4, seat - 0.004, 0.42);
  bundle.rotation.y = Math.PI / 2 + 0.25; // its length runs along the cushion, folds toward the arm
  bundle.userData.physics = { type: 'dynamic', mass: 1.8, shape: 'box', surface: 'soft' };
  g.add(bundle);

  // striped towel draped across the north arm, near the back corner
  const stripes = canvasTex(64, 512, (c, w, h) => {
    c.fillStyle = '#f1f0ec'; c.fillRect(0, 0, w, h);
    const bands: [number, number, string][] = [[0.0, 0.08, '#8c8f93'], [0.2, 0.36, '#6f7276'], [0.5, 0.58, '#8c8f93'], [0.72, 0.9, '#6f7276']];
    for (const [a, b, col] of bands) { c.fillStyle = col; c.fillRect(0, a * h, w, (b - a) * h); }
    c.fillStyle = '#c94a4a'; c.fillRect(8, 0.42 * h, 30, 6); // the small red logo on the white band
  });
  const towelMat = new THREE.MeshStandardMaterial({ map: stripes, roughness: 1, side: THREE.DoubleSide, name: 'striped-towel' });
  // Photos 103/125: towel on the z-negative arm, opposite the box at z-positive.
  const outer = Z0 - 0.006, inner = Z0 + SET.armW + 0.05, top = 0.79 + 0.008;
  const towel = clothSurface(24, 40, (s, t) => {
    const x = 2.42 + s * 0.32; // stops short of the cardboard box at the back corner
    let y: number, z: number;
    if (t < 0.28) { const k = t / 0.28; z = outer - 0.012 * (1 - k); y = top - 0.2 * (1 - k); }
    else if (t < 0.62) { const k = (t - 0.28) / 0.34; z = outer + k * (inner - outer); y = top + 0.012 * Math.sin(Math.PI * k); }
    else { const k = (t - 0.62) / 0.38; z = inner + 0.02 * k; y = top - 0.24 * k; }
    // soft folds along the drape, a bunched corner toward the back
    const fold = 0.008 * Math.sin(s * 14 + t * 5) + 0.006 * Math.sin(s * 5 - t * 9);
    return v3(x + fold * 0.3, y + (t > 0.3 && t < 0.6 ? Math.abs(fold) : 0), z + (t < 0.28 ? -fold : t > 0.62 ? fold : 0));
  }, 0.003);
  const tm = new THREE.Mesh(towel, towelMat);
  tm.castShadow = tm.receiveShadow = true;
  tm.name = 'striped-towel';
  g.add(tm);
  return g;
}

/**
 * Folded fleece blanket with a hoodie over it (photo 124). Local frame: u along the loaf (x),
 * v across it (z, +v toward the sofa back), y up from the cushion. The loaf's top is a height field:
 * a soft superelliptic mound, three rolled fold layers stacked at the -u end, a long crease and
 * low fleece wrinkles. The fleece carries a white logo patch near the +u end. The hoodie is a
 * sheet over the back half (+v), riding the loaf and falling to the cushion past its edge.
 */
function fleeceBundle(fleece: THREE.MeshStandardMaterial, hoodieMat: THREE.MeshStandardMaterial) {
  const g = new THREE.Group();
  g.name = 'fleece-bundle';
  const L = 0.58, Wd = 0.36, Hh = 0.15;
  const r = mulberry32(21);
  const wr = Array.from({ length: 6 }, () => ({ a: r() * Math.PI, k: 18 + r() * 30, ph: r() * 6.28 }));
  const loaf = (u: number, v: number) => {
    const su = Math.abs(u) / (L / 2), sv = Math.abs(v) / (Wd / 2);
    if (su >= 1 || sv >= 1) return 0;
    let h = Hh * Math.pow(1 - sv ** 2.6, 0.45) * Math.pow(1 - su ** 3.2, 0.35);
    // rolled fold layers at the -u end: three stacked ridges with a dip between each
    const t = (u + L / 2) / 0.2;
    if (t < 1.3) h += 0.03 * Math.max(0, Math.sin(t * Math.PI * 2.5)) * (1 - sv ** 2) * (1.3 - t);
    // The bundled fabric has broad tucked folds, not a smooth blue solid (photos 103/125).
    h -= 0.028 * Math.exp(-(((v + 0.05 + 0.018 * Math.sin(u * 17)) / 0.016) ** 2)) * (u > -0.1 ? 1 : 0.3);
    for (const [cu, tilt] of [[-0.16, 0.30], [-0.04, -0.35], [0.13, 0.18]]) {
      h -= 0.023 * Math.exp(-(((u - cu + v * tilt) / 0.015) ** 2)) * Math.max(0, 1 - sv * sv);
    }
    let w = 0;
    for (const q of wr) w += Math.sin((u * Math.cos(q.a) + v * Math.sin(q.a)) * q.k + q.ph);
    return Math.max(0, h + w * 0.005);
  };
  // the loaf mesh: top grid + closed sides down to the cushion
  const NU = 80, NV = 48;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const a = (i / NU) * 2 - 1, b = (j / NV) * 2 - 1;
    // Sample the same metric domain as the hoodie. The former squircle contracted its edge
    // into the height field, leaving a high, open cut edge that looked like a blue polygon.
    const u = a * (L / 2), v = b * (Wd / 2);
    pos.push(u, loaf(u, v) + 0.002, v);
    uv.push(i / NU, j / NV);
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const print = canvasTex(512, 320, (c, w, h) => {
    c.fillStyle = '#1f4fc2'; c.fillRect(0, 0, w, h);
    for (let k = 0; k < 900; k++) { c.fillStyle = `rgba(10,30,90,${0.05 + (k % 7) * 0.012})`; c.fillRect((k * 97) % w, (k * 61) % h, 3, 2); }
    // white logo patch spilling round the +u end (the Leafs-style crest in the photo)
    c.fillStyle = '#eef1f8'; c.beginPath(); c.ellipse(w * 0.92, h * 0.4, w * 0.09, h * 0.2, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#1f4fc2'; c.lineWidth = 7; c.beginPath(); c.moveTo(w * 0.91, h * 0.3); c.lineTo(w * 0.92, h * 0.5); c.lineTo(w * 0.95, h * 0.46); c.stroke();
  });
  const fleeceMat = fleece.clone();
  fleeceMat.map = print;
  fleeceMat.color.set('#ffffff');
  g.add(new THREE.Mesh(geo, fleeceMat));

  // hoodie: a sheet over the +v half that follows the loaf, then sags to the cushion past its edge
  const hoodie = clothSurface(40, 30, (s, t) => {
    const u = -0.24 + s * 0.52;
    const v = -0.06 + t * 0.34;
    const top = loaf(u, Math.min(v, Wd / 2 - 0.002));
    const past = Math.max(0, v - Wd / 2);
    const y = Math.max(top, 0) + 0.008 - (past > 0 ? Math.min(top, 0.08) : 0) + 0.01 * Math.sin(s * 9 + t * 4) * (0.5 + t);
    return v3(u + 0.01 * Math.sin(t * 7), Math.max(0.006, y - past * 0.4), v);
  }, 0.003);
  const hoodSurface = hoodieMat.clone();
  hoodSurface.side = THREE.DoubleSide;
  const hm = new THREE.Mesh(hoodie, hoodSurface);
  hm.castShadow = hm.receiveShadow = true;
  g.add(hm);
  g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = m.receiveShadow = true; } });
  return g;
}
