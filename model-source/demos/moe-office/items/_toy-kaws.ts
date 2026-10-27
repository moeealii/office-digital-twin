import * as THREE from 'three';
import {
  type Prim, type V3, capsule, chain, ellipsoid, roundBox, rotated, sculpt, sphere, spike, torus, vinylMaterial,
} from './_sdf-sculpt';

/**
 * KAWS x Astro Boy, grey colourway (photos 70/72/86/87/168), sculpted as one vinyl surface.
 *
 * Pose from photo 87: standing with knees soft, torso leaning forward a little, head tipped down
 * and turned toward the fan; the right glove pressed flat to the side of the face (the KAWS
 * "Passing Through" gesture), the left glove held open at the chest. Paint: pale-grey skin, mid-grey
 * limbs, glossy black Astro Boy hair with its two horn spikes, glossy slate-grey triple-bubble KAWS
 * ears, black briefs with a grey belt, white four-finger gloves with rolled cuffs, raised X eyes.
 *
 * Frame: origin at the base centre on the desk, +y up, the face toward +z. ~0.31 m to the spike tip
 * (desk-west scales it 1.1x to the measured 0.34 m).
 */

const C = {
  skin: '#c2c4c7',
  limb: '#9fa2a7',
  boot: '#8d9096',
  ear: '#66707f',
  black: '#141518',
  belt: '#a2a6ad',
  glove: '#f4f4f2',
};

/** a cartoon glove at `wrist`: palm, three sausage fingers, a thumb, a rolled cuff. Built with the
 * fingers along +y and the palm facing +z, then turned by `rot` about the wrist. `side` mirrors the
 * thumb. */
function glove(wrist: V3, rot: V3, side: number, curl = 0): Prim[] {
  const [wx, wy, wz] = wrist;
  const p = (x: number, y: number, z: number): V3 => [wx + x * side, wy + y, wz + z];
  const parts: Prim[] = [
    { d: ellipsoid(p(0, 0.022, 0), [0.019, 0.02, 0.012]), color: C.glove, k: 0.006, paint: 2 },
  ];
  for (let i = 0; i < 3; i++) {
    const x = -0.009 + i * 0.009;
    parts.push({
      d: chain([p(x, 0.032, 0), p(x * 1.1, 0.046, 0.003 + curl * 0.01), p(x * 1.1, 0.056, 0.008 + curl * 0.022)], [0.0066, 0.0064, 0.006]),
      color: C.glove, k: 0.004, paint: 2,
    });
  }
  parts.push({ d: chain([p(0.016, 0.014, 0.004), p(0.026, 0.026, 0.01), p(0.027, 0.036, 0.014)], [0.0066, 0.0062, 0.0058]), color: C.glove, k: 0.004, paint: 2 });
  // rolled cuff, and a solid wrist plug so the cuff never reads as an open ring
  parts.push({ d: torus(p(0, 0.004, 0), 0.0118, 0.0068), color: C.glove, k: 0.004, paint: 2 });
  parts.push({ d: ellipsoid(p(0, 0.006, 0), [0.014, 0.012, 0.0125]), color: C.glove, k: 0.006, paint: 2 });
  return parts.map(q => ({ ...q, d: rotated(q.d, wrist, rot) }));
}

let cached: THREE.BufferGeometry | null = null;

export function buildKawsAstro(): THREE.Mesh {
  if (!cached) cached = sculptKaws();
  const m = new THREE.Mesh(cached, vinylMaterial('kaws-vinyl', 0.4));
  m.name = 'kaws-astro-boy';
  m.castShadow = m.receiveShadow = true;
  return m;
}

function sculptKaws() {
  const P: Prim[] = [];
  // ---- boots: big rounded KAWS shoes, flat soles
  for (const s of [-1, 1]) {
    P.push({ d: ellipsoid([s * 0.033, 0.024, 0.012], [0.03, 0.026, 0.046]), color: C.boot, k: 0.004 });
    // ---- legs: knees slightly bent, the shins lean forward
    P.push({ d: chain([[s * 0.031, 0.036, 0.004], [s * 0.028, 0.08, 0.012], [s * 0.024, 0.118, 0.0]], [0.0185, 0.0172, 0.018]), color: C.limb, k: 0.012 });
  }
  // flat soles: carve everything below the desk
  P.push({ d: roundBox([0, -0.05, 0], [0.2, 0.05, 0.2], 0), sub: true, k: 0.004 });

  // ---- hips: black briefs and the grey belt
  P.push({ d: ellipsoid([0, 0.13, -0.002], [0.042, 0.03, 0.032]), color: C.black, k: 0.012 });
  // belt: a band flush with the waist, painted (it only stands 1 mm proud)
  P.push({ d: ellipsoid([0, 0.152, -0.001], [0.0405, 0.0075, 0.0305]), color: C.belt, k: 0.006, paint: 1 });

  // ---- torso, leaning forward a touch
  // torso: a pear that is as wide as the hips at the waist, narrowing to the shoulders
  P.push({ d: rotated(chain([[0, 0.158, 0.0], [0, 0.19, 0.002], [0, 0.222, 0.006]], [0.039, 0.035, 0.03]), [0, 0.15, 0], [0.12, 0, 0]), color: C.limb, k: 0.02 });
  P.push({ d: capsule([0, 0.225, 0.008], [0, 0.245, 0.016], 0.016), color: C.skin, k: 0.01 });

  // ---- head: built upright with the face toward +z, then tipped and turned (photo 87)
  const hc: V3 = [0, 0.272, 0.012];
  const head: Prim[] = [
    { d: ellipsoid(hc, [0.047, 0.044, 0.042]), color: C.skin, k: 0.01 },
    { d: ellipsoid([0, 0.258, 0.044], [0.027, 0.018, 0.016]), color: C.skin, k: 0.012 },
    // hair cap over the crown and the back of the head
    { d: ellipsoid([0, 0.284, 0.0], [0.05, 0.039, 0.044]), color: C.black, k: 0.004, paint: 1 },
    // Astro Boy horn spikes: a tall one up front, one sweeping back
    { d: spike([0.006, 0.3, 0.004], [0.012, 0.37, -0.01], 0.024, 0.002), color: C.black, k: 0.01, paint: 1 },
    { d: spike([-0.02, 0.29, -0.024], [-0.04, 0.33, -0.074], 0.022, 0.002), color: C.black, k: 0.01, paint: 1 },
  ];
  // raised X eyes
  for (const s of [-1, 1]) for (const a of [0.75, -0.75]) {
    head.push({ d: roundBox([s * 0.017, 0.276, 0.051], [0.0085, 0.0016, 0.0025], 0.0012, [0, s * 0.35, a]), color: C.black, k: 0.0008, paint: 1 });
  }
  // KAWS ears: three glossy bubbles stepping out and down each side
  for (const s of [-1, 1]) {
    const pts: [V3, number][] = [[[s * 0.05, 0.302, 0.006], 0.021], [[s * 0.066, 0.282, 0.008], 0.02], [[s * 0.076, 0.258, 0.01], 0.018]];
    for (const [c, r] of pts) head.push({ d: sphere(c, r), color: C.ear, k: 0.005, paint: 1 });
  }
  // KAWS proportions: the head is oversized against the body; scale the whole head about its
  // neck point rather than re-entering every coordinate
  const neck: V3 = [0, 0.236, 0.012];
  const HS = 1.14;
  const grow = (d: (x: number, y: number, z: number) => number) => (x: number, y: number, z: number) =>
    d(neck[0] + (x - neck[0]) / HS, neck[1] + (y - neck[1]) / HS, neck[2] + (z - neck[2]) / HS) * HS;
  for (const h of head) P.push({ ...h, d: grow(rotated(h.d, hc, [0.3, -0.25, 0.1])) });

  // ---- right arm up, glove pressed to the side of the face
  P.push({ d: chain([[0.034, 0.218, 0.002], [0.054, 0.192, 0.03], [0.038, 0.229, 0.053]], [0.0125, 0.011, 0.0105]), color: C.limb, k: 0.01 });
  P.push(...glove([0.036, 0.232, 0.054], [-0.25, -0.5, 0.35], 1, 0.1));
  // ---- left arm folded across, glove open at the chest
  P.push({ d: chain([[-0.034, 0.218, 0.002], [-0.054, 0.186, 0.022], [-0.028, 0.171, 0.049]], [0.0125, 0.011, 0.0105]), color: C.limb, k: 0.01 });
  P.push(...glove([-0.026, 0.172, 0.05], [1.25, 0.25, -1.1], -1, 0.6));

  const geo = sculpt(P, {
    box: new THREE.Box3(new THREE.Vector3(-0.125, 0, -0.11), new THREE.Vector3(0.125, 0.405, 0.12)),
    cell: 0.0016,
    paintBias: 0.0006,
  });
  geo.computeBoundingSphere();
  return geo;
}
