import * as THREE from 'three';

/**
 * HG 1/144 Strike Freedom Gundam, silver plated coating, in a flight pose on a white Action Base
 * (photos 82/168, on the G9 stand plate). ~0.135 m head to foot, wings ~0.2 m across.
 *
 * Hard-surface build: every armour piece is a chamfered plate (an octagon-cornered rectangle,
 * extruded with a small bevel) so the edges catch light like the kit; pieces sit ~0.3 mm apart so
 * panel lines read. Plated silver everywhere, gold frame on the DRAGOON blades, V-fin and joints.
 *
 * Frame: origin on the base's foot centre, +y up, the figure faces +z.
 */

type Mats = { silver: THREE.Material; dark: THREE.Material; gold: THREE.Material; white: THREE.Material; clear: THREE.Material; eye: THREE.Material };

/** chamfered armour plate: w x h face (x/y), d deep (z), corner chamfer c, centred */
function armor(w: number, h: number, d: number, c = Math.min(w, h) * 0.22, bev = Math.min(0.0008, d * 0.2)) {
  const hw = w / 2 - bev, hh = h / 2 - bev, cc = Math.min(c, hw * 0.9, hh * 0.9);
  const s = new THREE.Shape();
  s.moveTo(-hw + cc, -hh); s.lineTo(hw - cc, -hh); s.lineTo(hw, -hh + cc); s.lineTo(hw, hh - cc);
  s.lineTo(hw - cc, hh); s.lineTo(-hw + cc, hh); s.lineTo(-hw, hh - cc); s.lineTo(-hw, -hh + cc);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.0002, d - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1 });
  g.translate(0, 0, -(d - 2 * bev) / 2);
  g.computeVertexNormals();
  return g;
}

/** tapered plate: bottom width w0, top width w1 (a trapezoid), for shins, skirts, chest */
function taper(w0: number, w1: number, h: number, d: number, bev = 0.0007) {
  const s = new THREE.Shape();
  s.moveTo(-w0 / 2, -h / 2); s.lineTo(w0 / 2, -h / 2); s.lineTo(w1 / 2, h / 2); s.lineTo(-w1 / 2, h / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1 });
  g.translate(0, 0, -(d - 2 * bev) / 2);
  g.computeVertexNormals();
  return g;
}

function part(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function joint(r: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  return part(new THREE.SphereGeometry(r, 16, 12), mat, x, y, z);
}

function pivot(name: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, ...kids: THREE.Object3D[]) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  g.rotation.set(rx, ry, rz);
  g.add(...kids);
  return g;
}

export function buildStrikeFreedom(): THREE.Group {
  const M: Mats = {
    silver: new THREE.MeshPhysicalMaterial({ color: '#d3d7dd', metalness: 0.55, roughness: 0.24, clearcoat: 0.7, clearcoatRoughness: 0.12, name: 'sf-plated' }),
    dark: new THREE.MeshStandardMaterial({ color: '#7a7f88', metalness: 0.5, roughness: 0.35, name: 'sf-frame' }),
    gold: new THREE.MeshStandardMaterial({ color: '#d4a83f', metalness: 1, roughness: 0.22, name: 'sf-gold' }),
    white: new THREE.MeshStandardMaterial({ color: '#f2f2ef', roughness: 0.4, name: 'sf-base' }),
    clear: new THREE.MeshPhysicalMaterial({ color: '#e9eef2', roughness: 0.05, transparent: true, opacity: 0.45, name: 'sf-clear' }),
    eye: new THREE.MeshStandardMaterial({ color: '#2fd36a', emissive: '#0b5a26', roughness: 0.3, name: 'sf-eye' }),
  };
  const root = new THREE.Group();
  root.name = 'silver-gundam';

  // ---- Action Base: clear hex-ish foot, white swing arm curving up and back into the hips
  const base = new THREE.Group();
  base.name = 'action-base';
  base.add(part(new THREE.CylinderGeometry(0.03, 0.032, 0.006, 6), M.clear, 0, 0.003, 0));
  base.add(part(new THREE.CylinderGeometry(0.009, 0.011, 0.008, 20), M.white, 0, 0.009, 0));
  const arm = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.012, 0), new THREE.Vector3(0.004, 0.035, -0.008), new THREE.Vector3(0.002, 0.058, -0.022), new THREE.Vector3(0, 0.072, -0.03),
  ]);
  base.add(part(new THREE.TubeGeometry(arm, 24, 0.0022, 8), M.white));
  root.add(base);

  // ---- figure, built about the pelvis, posed in flight
  const fig = new THREE.Group();
  fig.name = 'gundam-body';
  fig.position.set(0, 0.078, -0.012);
  fig.rotation.set(0.22, 0, 0.04); // leaning into the flight
  root.add(fig);

  // pelvis + skirts
  const pelvis = new THREE.Group();
  pelvis.name = 'pelvis';
  pelvis.add(part(armor(0.016, 0.01, 0.012, 0.003), M.dark));
  pelvis.add(part(taper(0.008, 0.012, 0.009, 0.002), M.silver, 0, -0.006, 0.0065)); // codpiece
  for (const s of [-1, 1]) {
    pelvis.add(part(taper(0.006, 0.009, 0.014, 0.0018), M.silver, s * 0.0068, -0.007, 0.007, 0.15, 0, s * 0.12)); // front skirts
    // side skirt carrying the folded rail cannon: barrel runs along the hip
    const side = new THREE.Group();
    side.add(part(armor(0.003, 0.016, 0.014, 0.003), M.silver));
    side.add(part(new THREE.CylinderGeometry(0.0022, 0.0026, 0.05, 10), M.silver, s * 0.003, -0.004, -0.004, 0, 0, 0));
    side.add(part(new THREE.CylinderGeometry(0.0016, 0.0016, 0.006, 10), M.dark, s * 0.003, -0.031, -0.004));
    side.add(part(armor(0.004, 0.012, 0.008, 0.002), M.gold, s * 0.004, 0.012, -0.004));
    side.position.set(s * 0.011, -0.004, -0.001);
    side.rotation.set(-0.35, 0, s * 0.18);
    pelvis.add(side);
    pelvis.add(part(taper(0.01, 0.012, 0.009, 0.002), M.silver, 0, -0.006, -0.0075, -0.2, 0, 0)); // rear skirt
  }
  fig.add(pelvis);

  // waist, chest, collar
  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.add(part(armor(0.012, 0.01, 0.01, 0.002), M.dark, 0, 0.009, 0));
  torso.add(part(taper(0.022, 0.034, 0.02, 0.018), M.silver, 0, 0.024, 0.001));
  for (const s of [-1, 1]) {
    // chest vents: three gold slats under each collar point
    for (let k = 0; k < 3; k++) torso.add(part(armor(0.007, 0.0012, 0.002, 0.0002), M.gold, s * 0.008, 0.026 + k * 0.0026, 0.0105));
    torso.add(part(taper(0.006, 0.012, 0.006, 0.006), M.silver, s * 0.009, 0.036, 0.004, 0, 0, s * 0.4)); // collar flares
  }
  torso.add(part(armor(0.005, 0.005, 0.003, 0.001), M.gold, 0, 0.018, 0.0105)); // solar-plexus gem
  fig.add(torso);

  // head: helmet, faceplate, eyes, chin, gold V-fin with a central crest
  const head = new THREE.Group();
  head.name = 'head';
  head.add(part(armor(0.011, 0.011, 0.012, 0.003), M.silver));
  head.add(part(armor(0.007, 0.006, 0.002, 0.0015), M.white, 0, -0.0015, 0.0065));
  for (const s of [-1, 1]) head.add(part(armor(0.0028, 0.0011, 0.001, 0.0004), M.eye, s * 0.0018, 0.0008, 0.0075, 0, 0, s * -0.2));
  head.add(part(taper(0.003, 0.005, 0.0022, 0.002), M.silver, 0, -0.0048, 0.0062));
  const fin = (s: number) => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(s * 0.016, 0.011); sh.lineTo(s * 0.0175, 0.0128); sh.lineTo(s * 0.0035, 0.0028); sh.lineTo(0, 0.003);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.0008, bevelEnabled: false });
    return part(g, M.gold, 0, 0.0035, 0.0062);
  };
  head.add(fin(-1), fin(1));
  head.add(part(armor(0.0026, 0.004, 0.0012, 0.0008), M.gold, 0, 0.0045, 0.0066)); // crest
  for (const s of [-1, 1]) head.add(part(new THREE.CylinderGeometry(0.0012, 0.0012, 0.004, 8), M.silver, s * 0.0062, 0.001, 0, 0, 0, Math.PI / 2)); // vulcans
  head.position.set(0, 0.043, 0.004);
  head.rotation.set(-0.15, 0.2, 0);
  fig.add(head);

  // arms: shoulder block, upper arm, gold elbow, armoured forearm, fist
  const armBuild = (s: number, rifle: boolean) => {
    const hand = new THREE.Group();
    hand.add(part(armor(0.006, 0.007, 0.006, 0.0015), M.dark));
    if (rifle) {
      // MA-M21KF beam rifle held forward along the forearm
      const r = new THREE.Group();
      r.name = 'beam-rifle';
      r.add(part(armor(0.004, 0.006, 0.03, 0.001), M.silver, 0, -0.002, 0.008));
      r.add(part(new THREE.CylinderGeometry(0.0013, 0.0013, 0.026, 10), M.silver, 0, -0.0005, 0.035, Math.PI / 2));
      r.add(part(armor(0.003, 0.003, 0.008, 0.0007), M.dark, 0, 0.004, 0.006));
      hand.add(r);
    }
    const fore = new THREE.Group();
    fore.add(part(taper(0.0085, 0.01, 0.024, 0.009), M.silver, 0, -0.012, 0));
    fore.add(part(armor(0.004, 0.012, 0.0018, 0.001), M.gold, s * 0.0052, -0.012, 0, 0, Math.PI / 2, 0));
    hand.position.set(0, -0.028, 0.001);
    fore.add(hand);
    const elbow = pivot('elbow', 0, -0.02, 0, s > 0 ? -0.9 : -0.35, 0, 0, joint(0.0034, M.gold), fore);
    const upper = new THREE.Group();
    upper.add(part(armor(0.007, 0.018, 0.007, 0.0015), M.silver, 0, -0.009, 0));
    upper.add(elbow);
    const shoulder = new THREE.Group();
    shoulder.add(part(armor(0.014, 0.012, 0.013, 0.004), M.silver, s * 0.003, 0.002, 0));
    shoulder.add(part(armor(0.002, 0.008, 0.009, 0.002), M.gold, s * 0.0105, 0.002, 0));
    shoulder.add(pivot('upper-arm', 0, -0.004, 0, s > 0 ? -0.5 : 0.25, 0, s * 0.45, upper));
    return pivot(s > 0 ? 'arm-r' : 'arm-l', s * 0.021, 0.032, 0, 0, 0, 0, shoulder);
  };
  fig.add(armBuild(1, true), armBuild(-1, false));

  // legs: thigh, gold knee, flared shin with knee armour, wedge foot
  const legBuild = (s: number, bend: number, splay: number) => {
    const foot = new THREE.Group();
    foot.add(part(taper(0.012, 0.009, 0.007, 0.024, 0.0009), M.silver, 0, -0.003, 0.004, Math.PI / 2, 0, 0));
    foot.add(part(armor(0.008, 0.003, 0.01, 0.001), M.dark, 0, -0.006, 0.0));
    const shin = new THREE.Group();
    shin.add(part(taper(0.017, 0.011, 0.038, 0.014), M.silver, 0, -0.02, 0));
    shin.add(part(armor(0.012, 0.012, 0.004, 0.003), M.silver, 0, -0.002, 0.008, -0.2, 0, 0)); // knee armour
    shin.add(part(armor(0.003, 0.02, 0.002, 0.001), M.gold, s * 0.0075, -0.02, 0, 0, Math.PI / 2, 0)); // side vents
    shin.add(pivot('ankle', 0, -0.04, 0, -bend * 0.4, 0, 0, foot));
    const thigh = new THREE.Group();
    thigh.add(part(armor(0.011, 0.026, 0.011, 0.003), M.silver, 0, -0.013, 0));
    thigh.add(pivot('knee', 0, -0.027, 0, bend, 0, 0, joint(0.0045, M.gold), shin));
    return pivot(s > 0 ? 'leg-r' : 'leg-l', s * 0.008, -0.008, 0, -bend * 0.55, 0, s * splay, joint(0.005, M.dark), thigh);
  };
  fig.add(legBuild(1, 0.35, 0.1), legBuild(-1, 0.9, 0.18));

  // backpack + 8 DRAGOON blades (4 per side) fanned up and out, plus the two folded wing roots
  const pack = new THREE.Group();
  pack.name = 'backpack';
  pack.add(part(armor(0.02, 0.022, 0.012, 0.004), M.silver, 0, 0.03, -0.012));
  pack.add(part(armor(0.008, 0.012, 0.004, 0.002), M.gold, 0, 0.032, -0.019));
  const blade = (len: number) => {
    const g = new THREE.Group();
    // outer silver shell, narrow and slightly tapering, with the gold frame showing along its inner
    // edge and a dark thruster cap at the tip
    g.add(part(taper(0.0062, 0.0046, len, 0.0026, 0.0005), M.silver, 0, len / 2, 0));
    g.add(part(taper(0.0024, 0.0018, len * 0.86, 0.0018, 0.0003), M.gold, -0.0034, len / 2, 0.0004));
    g.add(part(new THREE.CylinderGeometry(0.0018, 0.0022, 0.004, 8), M.dark, 0, len + 0.0015, 0));
    return g;
  };
  for (const s of [-1, 1]) {
    const root2 = new THREE.Group();
    root2.position.set(s * 0.008, 0.034, -0.017);
    root2.add(part(armor(0.012, 0.008, 0.006, 0.002), M.silver, s * 0.004, 0, 0));
    for (let k = 0; k < 4; k++) {
      const b = blade(0.07 - k * 0.006);
      // fan: each blade swings further out from vertical and steps back a little
      b.rotation.set(-0.25 - k * 0.06, s * 0.15, s * -(0.55 + k * 0.28));
      b.position.set(s * (0.006 + k * 0.0015), 0, -0.003 - k * 0.0028);
      root2.add(b);
    }
    pack.add(root2);
  }
  fig.add(pack);

  root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = m.receiveShadow = true; });
  return root;
}
