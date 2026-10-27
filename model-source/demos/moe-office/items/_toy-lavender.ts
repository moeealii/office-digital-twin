import * as THREE from 'three';
import { type Prim, type V3, capsule, chain, ellipsoid, sculpt, sphere, spike } from './_sdf-sculpt';

/**
 * Clear-lavender resin figure (owner: Frieren; mostly hidden, so a stand-in silhouette was kept
 * and NOT refined — do not mistake it for a character match). Photos 70/72, ~0.26 m tall.
 * Pose: standing, both arms raised overhead with the three bulb-tipped fingers splayed, the heavy
 * tail sweeping out behind and curling up. Anatomy: rounded cat-like head with two short horn
 * ears, the tube running from the back of the skull into the upper back, a broad chest plate,
 * slim waist, a big rounded abdomen, thick thighs into digitigrade shins and three-toed feet.
 * Frame: origin at the base centre, +y up, facing +z.
 */

let cached: THREE.BufferGeometry | null = null;

export function buildLavenderStandIn(): THREE.Group {
  if (!cached) cached = sculptStandIn();
  const g = new THREE.Group();
  g.name = 'lavender-figure';
  // translucent resin: thin-wall transmission is too costly per figure; a lit, slightly
  // transparent physical material with sheen reads as clear lavender vinyl
  const resin = new THREE.MeshPhysicalMaterial({
    color: '#c4b6e3', roughness: 0.2, sheen: 0.4, sheenColor: new THREE.Color('#efe8ff'), sheenRoughness: 0.4,
    clearcoat: 0.8, clearcoatRoughness: 0.15, name: 'lavender-resin',
  });
  const body = new THREE.Mesh(cached, resin);
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  // clear acrylic display base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.006, 48), new THREE.MeshPhysicalMaterial({
    color: '#eef2f6', roughness: 0.05, transmission: 0.8, thickness: 0.006, transparent: true, opacity: 0.6,
  }));
  base.position.y = 0.003;
  g.add(base);
  return g;
}

function sculptStandIn() {
  const B = 0.006; // base top
  const P: Prim[] = [];
  const add = (d: Prim['d'], k = 0.006) => P.push({ d, k, color: '#ffffff' });
  // feet: three stubby toes forward, a heel spur back
  for (const s of [-1, 1]) {
    const fx = s * 0.016;
    add(ellipsoid([fx, B + 0.006, 0.006], [0.009, 0.006, 0.013]), 0.004);
    for (const t of [-1, 0, 1]) add(capsule([fx + t * 0.004, B + 0.004, 0.012], [fx + t * 0.006, B + 0.003, 0.021], 0.003, 0.0025), 0.003);
    // digitigrade shin up and back to the knee, thick thigh forward to the hip
    add(chain([[fx, B + 0.01, 0.002], [s * 0.019, B + 0.04, -0.008], [s * 0.02, B + 0.058, 0.004]], [0.0055, 0.006, 0.009]), 0.006);
    add(chain([[s * 0.02, B + 0.058, 0.004], [s * 0.018, B + 0.075, 0.006]], [0.011, 0.014]), 0.008);
  }
  // abdomen: the big rounded belly bulb, then the slim waist, then the chest
  add(ellipsoid([0, B + 0.088, 0.002], [0.024, 0.022, 0.022]), 0.01);
  add(capsule([0, B + 0.105, 0.0], [0, B + 0.118, 0.002], 0.012, 0.013), 0.012);
  add(ellipsoid([0, B + 0.135, 0.004], [0.027, 0.021, 0.018]), 0.012);
  // shoulders and the neck
  for (const s of [-1, 1]) add(sphere([s * 0.022, B + 0.144, 0.002], 0.008), 0.008);
  add(capsule([0, B + 0.148, 0.002], [0, B + 0.16, 0.006], 0.0065, 0.006), 0.006);
  // head: rounded cranium, a short muzzle, the two horn ears, the tube from skull to upper back
  const hc: V3 = [0, B + 0.172, 0.008];
  add(ellipsoid(hc, [0.0165, 0.0148, 0.0165]), 0.004);
  add(ellipsoid([0, B + 0.167, 0.021], [0.009, 0.0078, 0.0075]), 0.004);
  for (const s of [-1, 1]) add(spike([s * 0.0085, B + 0.18, 0.004], [s * 0.014, B + 0.196, -0.002], 0.0045, 0.0012), 0.003);
  add(chain([[0, B + 0.176, -0.01], [0, B + 0.172, -0.024], [0, B + 0.152, -0.024], [0, B + 0.142, -0.014]], [0.0045, 0.0048, 0.0048, 0.0045]), 0.004);
  // arms raised overhead: upper arm up and out, forearm up, bulb-tipped three-finger hands
  for (const s of [-1, 1]) {
    const sh: V3 = [s * 0.024, B + 0.146, 0.002];
    const el: V3 = [s * 0.042, B + 0.178, 0.006];
    const wr: V3 = [s * 0.05, B + 0.218, 0.004];
    add(chain([sh, el, wr], [0.0068, 0.0058, 0.0075]), 0.004); // forearms thicken to the wrist
    // fingers fan up and out from the wrist, each ending in a little ball
    for (const f of [-1, 0, 1]) {
      const tip: V3 = [wr[0] + s * (0.006 + f * 0.006), wr[1] + 0.024 - Math.abs(f) * 0.004, wr[2] + f * 0.006];
      const mid: V3 = [(wr[0] + tip[0]) / 2 + s * 0.002, (wr[1] + tip[1]) / 2 + 0.002, (wr[2] + tip[2]) / 2];
      add(chain([wr, mid, tip], [0.0026, 0.0018, 0.0015]), 0.002);
      add(sphere(tip, 0.0026), 0.0015);
    }
  }
  // tail: from the base of the spine, thick, sweeping back and to the side, curling up at the end
  add(chain([
    [0, B + 0.082, -0.016], [-0.012, B + 0.05, -0.05], [-0.04, B + 0.035, -0.07],
    [-0.07, B + 0.055, -0.06], [-0.082, B + 0.09, -0.04], [-0.078, B + 0.115, -0.026],
  ], [0.015, 0.0135, 0.0115, 0.0098, 0.009, 0.0095]), 0.01);
  add(sphere([-0.078, B + 0.118, -0.025], 0.0105), 0.006);

  const geo = sculpt(P, {
    box: new THREE.Box3(new THREE.Vector3(-0.1, 0, -0.09), new THREE.Vector3(0.08, 0.26, 0.04)),
    cell: 0.0011,
  });
  geo.deleteAttribute('color');
  return geo;
}
