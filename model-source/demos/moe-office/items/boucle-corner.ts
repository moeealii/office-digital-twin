import * as THREE from 'three';
import type { PartContext } from '../parts/types';
import { at, cyl, mesh, phys, rbox, staticBody } from './_moe-kit';
import { boucleMaterials } from './_boucle-mats';
import {
  P2, SpinePt, clipHalf, mergeGeos, offsetPoly,
  slabFrom, spline, sweepBack,
} from './_boucle-geo';

/**
 * Bouclé corner — RESTORED to continuous soft-roll baseline (wes1/wes2).
 *
 * Owner: wes4 modular flatTopBlock cubes were a clear regression. Restores the
 * analytic-normal sweepBack bolster + nested spine that matched the continuous
 * crest silhouette better. Soft props still omitted.
 */

const SEAT_Y = 0.455;

const PLAN: P2[] = [
  [-2.8900, -2.4700],
  [-2.8960, -2.1000],
  [-2.8960, -1.6000],
  [-2.8920, -1.1500],
  [-2.8800, -0.8800],
  [-2.8250, -0.7600],
  [-2.7100, -0.7000],
  [-2.5600, -0.5900],
  [-2.4000, -0.4500],
  [-2.2300, -0.2900],
  [-2.0700, -0.1300],
  [-1.9300, 0.0300],
  [-1.8200, 0.1750],
  [-1.7400, 0.3100],
  [-1.6500, 0.4300],
  [-1.5200, 0.5000],
  [-1.4000, 0.4800],
  [-1.3000, 0.3700],
  [-1.2800, 0.2200],
  [-1.3400, 0.0500],
  [-1.4500, -0.1400],
  [-1.5800, -0.3400],
  [-1.7200, -0.5800],
  [-1.8400, -0.8200],
  [-1.9000, -1.0800],
  [-1.9200, -1.4200],
  [-1.9380, -1.8200],
  [-1.9600, -2.1800],
  [-2.0500, -2.4000],
  [-2.2600, -2.4900],
  [-2.5800, -2.4800],
];

/** Nested into seat so roll reads upholstered (wes2 nesting). */
const BACK_SPINE: SpinePt[] = [
  // flatter padded crest; soft waists at module seams (not separate cubes)
  { x: -2.760, z: -2.300, top: 0.695, bot: 0.205, hw: 0.235 },
  { x: -2.770, z: -1.900, top: 0.725, bot: 0.195, hw: 0.255 },
  { x: -2.770, z: -1.620, top: 0.715, bot: 0.200, hw: 0.220 },
  { x: -2.772, z: -1.400, top: 0.735, bot: 0.190, hw: 0.270 },
  { x: -2.765, z: -0.940, top: 0.730, bot: 0.190, hw: 0.275 },
  { x: -2.700, z: -0.720, top: 0.710, bot: 0.205, hw: 0.225 },
  { x: -2.560, z: -0.580, top: 0.700, bot: 0.205, hw: 0.260 },
  { x: -2.310, z: -0.400, top: 0.680, bot: 0.215, hw: 0.245 },
  { x: -2.130, z: -0.220, top: 0.660, bot: 0.225, hw: 0.220 },
  { x: -1.980, z: -0.040, top: 0.640, bot: 0.240, hw: 0.195 },
  { x: -1.860, z: 0.090, top: 0.615, bot: 0.255, hw: 0.160 },
  { x: -1.790, z: 0.170, top: 0.585, bot: 0.275, hw: 0.125 },
];

const TABLE = { x: -1.44, z: -1.15, r: 0.345, top: 0.40, thick: 0.036 };
const SEAM_Z = [-1.6200, -0.7200];

export function build(_ctx: PartContext): THREE.Object3D {
  const M = boucleMaterials();
  const g = new THREE.Group();
  g.name = 'boucle-corner';

  const outline = spline(PLAN, 220, true);
  const sofa = new THREE.Group();
  sofa.name = 'boucle-sectional';

  const plinth = mesh(slabFrom(offsetPoly(outline, 0.018), 0.0, 0.044, { bevel: 0.006, bevelSeg: 4 }), M.plinth);
  plinth.name = 'sofa-plinth';
  sofa.add(plinth);

  const base = mesh(slabFrom(outline, 0.048, 0.375, { bevel: 0.055, bevelSeg: 32 }), M.boucle);
  base.name = 'sofa-base';
  sofa.add(base);

  const SEAM_GAP = 0.006;
  const pieces: P2[][] = [
    clipHalf(outline, 0, 1, SEAM_Z[0] - SEAM_GAP),
    clipHalf(clipHalf(outline, 0, 1, SEAM_Z[1] - SEAM_GAP), 0, -1, -(SEAM_Z[0] + SEAM_GAP)),
    clipHalf(outline, 0, -1, -(SEAM_Z[1] + SEAM_GAP)),
  ];
  const cushionGeos: THREE.BufferGeometry[] = [];
  pieces.forEach((piece, i) => {
    if (piece.length < 3) return;
    const geo = slabFrom(offsetPoly(piece, 0.010), 0.325, SEAT_Y, {
      bevel: 0.068, bevelThick: 0.058, bevelSeg: 32,
    });
    const pos = geo.getAttribute('position');
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k);
      if (y > SEAT_Y - 0.04) {
        const x = pos.getX(k), z = pos.getZ(k);
        const lift = 0.012 * Math.sin((x + 2.4) * 3.2) * Math.cos((z + 1.2) * 2.6);
        pos.setY(k, y + Math.max(0, lift));
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.name = 'seat-cushion-' + i;
    cushionGeos.push(geo);
  });
  const seat = mesh(mergeGeos(cushionGeos), M.boucle);
  seat.name = 'sofa-seat';
  sofa.add(seat);

  // continuous soft roll — analytic normals (wes1/wes2), NOT modular cubes
  {
    const back = mesh(sweepBack(BACK_SPINE, 64, 1.35, 0.12, 200, 16), M.boucle);
    back.name = 'sofa-back';
    sofa.add(back);
  }
  g.add(staticBody(sofa));

  const table = new THREE.Group();
  table.name = 'round-marble-table';
  {
    const R = TABLE.r, T = TABLE.thick;
    const prof: THREE.Vector2[] = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(R - 0.030, 0.0),
      new THREE.Vector2(R - 0.009, 0.004),
      new THREE.Vector2(R, 0.013),
      new THREE.Vector2(R, T - 0.013),
      new THREE.Vector2(R - 0.009, T - 0.004),
      new THREE.Vector2(R - 0.030, T),
      new THREE.Vector2(0.0, T),
    ];
    const topGeo = new THREE.LatheGeometry(prof, 72);
    const p = topGeo.getAttribute('position');
    const uv = new Float32Array(p.count * 2);
    const span = R * 2.2;
    for (let i = 0; i < p.count; i++) {
      uv[i * 2] = (p.getX(i) + span / 2) / span;
      uv[i * 2 + 1] = (p.getZ(i) + span / 2) / span;
    }
    topGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    topGeo.computeVertexNormals();
    const top = mesh(topGeo, M.marble);
    top.position.y = TABLE.top - TABLE.thick;
    table.add(top);
  }
  const plate = cyl(0.125, 0.112, 0.018, M.gold, 40);
  at(plate, 0, TABLE.top - TABLE.thick - 0.007, 0);
  table.add(plate);
  const column = cyl(0.058, 0.042, 0.265, M.gold, 32);
  at(column, 0, 0.195, 0);
  table.add(column);
  const flare = cyl(0.045, 0.155, 0.085, M.gold, 40);
  at(flare, 0, 0.048, 0);
  table.add(flare);
  const foot = cyl(0.158, 0.158, 0.014, M.gold, 40);
  at(foot, 0, 0.008, 0);
  table.add(foot);
  at(table, TABLE.x, 0, TABLE.z, 0);
  g.add(staticBody(table));

  const caseG = new THREE.Group();
  caseG.name = 'lilac-case';
  caseG.add(rbox(0.222, 0.021, 0.163, 0.020, M.lilac, 4));
  const notch = rbox(0.055, 0.020, 0.020, 0.008, M.lilac, 2);
  at(notch, 0, 0.001, -0.082);
  caseG.add(notch);
  at(caseG, TABLE.x - 0.070, TABLE.top + 0.011, TABLE.z - 0.030, 0.42);
  g.add(phys(caseG, 0.35, 'box'));

  const fruit = new THREE.Group();
  fruit.name = 'glass-fruit';
  const ball = mesh(new THREE.SphereGeometry(0.047, 26, 20), M.fruit);
  ball.scale.set(1.0, 1.16, 1.0);
  ball.position.y = 0.052;
  fruit.add(ball);
  const stem = mesh(new THREE.CylinderGeometry(0.0055, 0.0075, 0.022, 6), M.stem);
  at(stem, 0, 0.108, 0);
  fruit.add(stem);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    const leaf = mesh(new THREE.SphereGeometry(0.016, 8, 6), M.stem);
    leaf.scale.set(1, 0.3, 0.6);
    leaf.position.set(Math.cos(a) * 0.02, 0.097, Math.sin(a) * 0.02);
    leaf.rotation.set(0.5, -a, 0);
    fruit.add(leaf);
  }
  at(fruit, TABLE.x + 0.128, TABLE.top, TABLE.z + 0.088, 0.7);
  g.add(phys(fruit, 0.25));

  g.add(buildSofaProps(M));
  return g;
}

/**
 * What sits on the sectional (photos 1/2/4): along the back of the wall-2 run, a round bouclé ball
 * pillow and two dark-grey satin pillows leaning on the back. (The backpack and clothes on the
 * chaise end, photos 46/51/55, are left out for now at the owner's request.)
 * Back face of the roll ≈ x -2.51 along the wall-2 run; seat top SEAT_Y.
 */
function buildSofaProps(M: ReturnType<typeof boucleMaterials>) {
  const g = new THREE.Group();
  g.name = 'sectional-props';

  // ball pillow tucked into the corner
  const ball = mesh(new THREE.SphereGeometry(0.16, 40, 28), M.boucleSoft);
  ball.scale.set(1, 0.9, 1);
  ball.position.set(-2.3, SEAT_Y + 0.13, -0.98); // in front of the left pillow (photo 2)
  g.add(phys(ball, 0.6, 'sphere'));

  // satin pillows: face the room (+x), lean back on the roll
  for (const [z, yaw, seed] of [[-1.05, 0.12, 5], [-1.35, -0.08, 8]] as const) {
    const holder = new THREE.Group();
    const pm = mesh(plumpPillow(0.44, 0.4, 0.16, seed), M.greige);
    pm.rotation.y = Math.PI / 2 + yaw;
    holder.add(pm);
    holder.rotation.z = 0.32; // top tips toward the back (-x)
    holder.position.set(-2.46, SEAT_Y + 0.18, z);
    holder.name = 'satin-pillow';
    g.add(phys(holder, 0.4, 'box'));
  }

  return g;
}

export const BOUCLE_TABLE = { x: TABLE.x, z: TABLE.z, r: TABLE.r, top: TABLE.top };
export const BOUCLE_SOFA_PLAN = PLAN;

/** square cushion, plump in the middle, pinched to points at the corners; faces ±z */
function plumpPillow(w: number, h: number, t: number, seed: number) {
  const geo = new THREE.BoxGeometry(w, h, t, 16, 16, 4);
  const p = geo.getAttribute('position');
  for (let k = 0; k < p.count; k++) {
    const u = p.getX(k) / (w / 2), v = p.getY(k) / (h / 2);
    const puff = Math.sqrt(Math.max(0, 1 - u * u)) * Math.sqrt(Math.max(0, 1 - v * v));
    const pull = 1 - 0.07 * (u * u * (1 - v * v) + v * v * (1 - u * u));
    const wob = 1 + 0.03 * Math.sin(u * 3 + seed) * Math.cos(v * 2.5 + seed);
    p.setXYZ(k, p.getX(k) * pull, p.getY(k) * pull, p.getZ(k) * (0.12 + 0.88 * puff) * wob);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}
