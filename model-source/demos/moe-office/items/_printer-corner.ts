import * as THREE from 'three';
import type { DwMats } from './_desk-west-mats';
import { at, box, canvasTex, cyl, grp, lathe, mesh, rbox, rboxGeo, tube, type V2, type V3 } from './_desk-west-kit';
import { type Prim, capsule, ellipsoid, roundBox, sculpt, torus } from './_sdf-sculpt';

/**
 * The 3D-printer corner between the loveseat's west arm and the ALEX drawers (photos 89/104/200/201).
 * Every builder returns a group whose FRONT faces -z (the room), origin on its own floor/base centre.
 *
 *   Bambu Lab X1 Carbon   389 x 389 x 457 (spec); front at z ≈ 2.27 (scan), x -0.66..-0.27
 *   AMS                   360 x 285 x 225 (spec) on the printer, smoked dome lid hinged OPEN (201)
 *   storage ottoman bin   grey padded vinyl, ~0.38 x 0.30 x 0.30, in front of the table (104/201)
 *   running shoes         black knit, black sole (ASICS-style), heel/toe from photo 200
 *   cat scratchers        gold box tray + oval floral sleeve, in front of the loveseat (104)
 */

// --------------------------------------------------------------------------------- X1 Carbon

export function buildX1Carbon(M: DwMats) {
  const g = grp('bambu-x1c');
  const W = 0.389, D = 0.389, H = 0.457;
  const silver = new THREE.MeshStandardMaterial({ color: '#c8c9ca', roughness: 0.38, metalness: 0.55, name: 'x1c-silver' });
  const bezel = new THREE.MeshStandardMaterial({ color: '#141516', roughness: 0.45, name: 'x1c-bezel' });
  const inside = new THREE.MeshStandardMaterial({ color: '#26282b', roughness: 0.75, emissive: '#0a0c0f', name: 'x1c-chamber' });
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#727f85', roughness: 0.06, transparent: true, opacity: 0.18, clearcoat: 1, depthWrite: false, name: 'x1c-door-glass',
  });
  const front = -D / 2;

  // shell: sides, back, floor and a top band; the front is open behind the door
  const t = 0.012;
  for (const sx of [-1, 1]) g.add(at(rbox(t, H - 0.02, D, 0.004, silver, 2), sx * (W / 2 - t / 2), (H - 0.02) / 2, 0));
  g.add(at(box(W - 2 * t, H - 0.02, t, silver), 0, (H - 0.02) / 2, D / 2 - t / 2));
  g.add(at(box(W - 2 * t, 0.03, D, silver), 0, 0.015, 0));
  // front frame: silver band above the door (label, screen bracket) and a narrow sill below it
  g.add(at(rbox(W, 0.085, 0.02, 0.005, silver, 2), 0, H - 0.02 - 0.0425, front + 0.01));
  g.add(at(rbox(W, 0.028, 0.02, 0.004, silver, 2), 0, 0.014, front + 0.01));
  // top: black glass lid in a thin black rim
  g.add(at(rbox(W - 0.004, 0.02, D - 0.004, 0.006, bezel, 2), 0, H - 0.01, 0));
  g.add(at(box(W - 0.05, 0.002, D - 0.05, M.glassBlack), 0, H + 0.0005, 0));

  // chamber: dark walls, LED bar under the top, the textured plate high up with a dark round print
  // on it, and the red print lower down (both visible through the door in 104/201)
  {
    // open-fronted chamber so the door shows the inside
    const cw = W - 2 * t - 0.002, ch = H - 0.13, cd = D - t - 0.03, cy = 0.03 + ch / 2, cz = 0.01;
    g.add(at(box(cw, ch, 0.004, inside), 0, cy, cz + cd / 2));
    for (const sx of [-1, 1]) g.add(at(box(0.004, ch, cd, inside), sx * cw / 2, cy, cz));
    g.add(at(box(cw, 0.004, cd, inside), 0, cy + ch / 2, cz));
    g.add(at(box(cw, 0.004, cd, inside), 0, cy - ch / 2, cz));
  }
  const led = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#dfe9f5', emissiveIntensity: 0.55, name: 'x1c-led' });
  g.add(at(box(0.2, 0.004, 0.01, led), -0.02, H - 0.107, front + 0.045));
  // The chamber LED is visibly ON in 89/200. Emissive trim alone did not illuminate the plate,
  // so the recovered comparisons showed an almost empty black box. One real fixture light.
  const chamberLight = new THREE.SpotLight('#dcecff', 0.65, 0.48, Math.PI / 2.8, 0.7, 2);
  chamberLight.name = 'x1c-chamber-led'; chamberLight.userData.keep = true;
  chamberLight.position.set(-0.02, H - 0.112, front + 0.055);
  chamberLight.target.position.set(-0.01, 0.20, 0.03);
  g.add(chamberLight, chamberLight.target);
  const plate = new THREE.MeshStandardMaterial({ color: '#7d8186', roughness: 0.55, metalness: 0.3, emissive: '#1a1d21', name: 'x1c-plate' });
  g.add(at(box(W - 0.07, 0.008, D - 0.08, plate), 0, 0.27, 0.01));
  g.add(at(cyl(0.08, 0.085, 0.012, M.darkPlastic, 40), -0.01, 0.28, 0.0));
  g.add(at(cyl(0.05, 0.055, 0.02, M.darkPlastic, 32), -0.01, 0.295, 0.0));
  const maroon = new THREE.MeshStandardMaterial({ color: '#6e1d18', roughness: 0.6, name: 'x1c-print' });
  g.add(at(cyl(0.052, 0.058, 0.04, maroon, 32), -0.03, 0.125, 0.0));
  g.add(at(cyl(0.075, 0.075, 0.006, M.darkPlastic, 32), -0.03, 0.102, 0.0));
  // toolhead on its carbon rod, parked back-left
  g.add(at(box(W - 0.05, 0.012, 0.012, M.black), 0, 0.37, D / 2 - 0.08));
  g.add(at(rbox(0.07, 0.065, 0.055, 0.01, bezel, 2), -0.11, 0.35, D / 2 - 0.09));

  // door: black frame round a smoked glass pane, chrome handle on the right
  const dw = W - 0.03, dh = H - 0.13, dy = 0.03 + dh / 2;
  const fz = front - 0.004;
  for (const sx of [-1, 1]) g.add(at(box(0.018, dh, 0.008, bezel), sx * (dw / 2 - 0.009), dy, fz));
  for (const sy of [-1, 1]) g.add(at(box(dw, 0.016, 0.008, bezel), 0, dy + sy * (dh / 2 - 0.008), fz));
  const pane = mesh(new THREE.PlaneGeometry(dw - 0.03, dh - 0.026), glass, 'x1c-door');
  pane.rotation.y = Math.PI; // faces -z
  pane.position.set(0, dy, fz - 0.002);
  g.add(pane);
  g.add(at(rbox(0.04, 0.012, 0.014, 0.005, M.chrome, 2), -dw / 2 + 0.05, dy + 0.02, fz - 0.01)); // handle on the viewer's right

  // label strip above the door, read from the front (small dark text on the silver band)
  const lab = canvasTex(512, 48, (c, w, h) => {
    c.fillStyle = '#c8c9ca'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#74777b'; c.font = '17px sans-serif'; c.fillText('Bambu Lab', 180, 30);
    c.fillStyle = '#63666a'; c.font = '600 19px sans-serif'; c.fillText('X1 Carbon', 285, 31);
  });
  const lm = mesh(new THREE.PlaneGeometry(0.26, 0.024), new THREE.MeshStandardMaterial({ map: lab, roughness: 0.4, metalness: 0.4 }), 'x1c-label');
  lm.rotation.y = Math.PI;
  lm.position.set(-0.04, H - 0.062, front - 0.0005);
  g.add(lm);

  // touchscreen: a glossy black slab on a short arm at the top-east front corner, tilted up and
  // resting its lower edge on the lid rim (photos 104/200/201 all show it at the east corner)
  const scr = canvasTex(256, 160, (c, w, h) => {
    c.fillStyle = '#05070a'; c.fillRect(0, 0, w, h);
    const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'rgba(120,130,150,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  });
  const screen = grp('x1c-screen');
  screen.add(at(rbox(0.106, 0.064, 0.011, 0.005, M.plastic, 2), 0, 0, 0));
  const sm = mesh(new THREE.PlaneGeometry(0.094, 0.053), new THREE.MeshPhysicalMaterial({ map: scr, roughness: 0.08, clearcoat: 1 }), 'x1c-screen-glass');
  sm.rotation.y = Math.PI;
  sm.position.z = -0.006;
  screen.add(sm);
  screen.rotation.x = 0.52;
  screen.position.set(W / 2 - 0.062, H - 0.006, front - 0.012); // viewer's left = local +x
  g.add(screen);
  g.add(at(box(0.026, 0.012, 0.026, M.plastic), W / 2 - 0.062, H - 0.016, front - 0.002));

  // Bambu stacked-slab logo on the right side near the front (201)
  const logo = canvasTex(64, 128, (c, w, h) => {
    c.fillStyle = '#c8c9ca'; c.fillRect(0, 0, w, h); c.fillStyle = '#5c5f63';
    c.fillRect(14, 10, 14, 50); c.fillRect(34, 10, 14, 30); c.fillRect(14, 66, 14, 30); c.fillRect(34, 46, 14, 50);
  });
  const lg = mesh(new THREE.PlaneGeometry(0.035, 0.07), new THREE.MeshStandardMaterial({ map: logo, roughness: 0.4, metalness: 0.4 }), 'x1c-logo');
  lg.rotation.y = -Math.PI / 2;
  lg.position.set(-W / 2 - 0.0005, 0.2, front + 0.06);
  g.add(lg);
  return g;
}

// --------------------------------------------------------------------------------- AMS, lid open

export function buildAMSOpen(M: DwMats) {
  const g = grp('bambu-ams');
  const W = 0.36, D = 0.285, H = 0.105;
  const shell = new THREE.MeshStandardMaterial({ color: '#54585b', roughness: 0.4, metalness: 0.08, name: 'ams-shell' });
  const inner = new THREE.MeshStandardMaterial({ color: '#17181a', roughness: 0.6, name: 'ams-inner' });
  const feeder = new THREE.MeshStandardMaterial({ color: '#b9bcc0', roughness: 0.45, name: 'ams-feeder' });
  // tub: floor, walls, and a front wall that leans back slightly
  g.add(at(rbox(W, 0.03, D, 0.01, shell, 2), 0, 0.015, 0));
  for (const sx of [-1, 1]) g.add(at(rbox(0.014, H, D, 0.005, shell, 2), sx * (W / 2 - 0.007), H / 2, 0));
  g.add(at(rbox(W, H, 0.014, 0.005, shell, 2), 0, H / 2, D / 2 - 0.007));
  g.add(at(rbox(W, H - 0.018, 0.016, 0.005, shell, 2), 0, (H - 0.018) / 2 + 0.009, -D / 2 + 0.008).rotateX(-0.08));
  g.add(at(box(W - 0.03, 0.004, D - 0.03, inner), 0, 0.032, 0));
  // four spool bays: paired light-grey feeder rollers sitting at the tub's top rim (201)
  for (let i = 0; i < 4; i++) {
    const x = -0.135 + i * 0.09;
    for (const z of [-0.06, 0.06]) {
      g.add(at(rbox(0.05, 0.012, 0.05, 0.005, inner, 2), x, H - 0.025, z).rotateX(z < 0 ? 0.5 : -0.5));
      g.add(at(cyl(0.008, 0.008, 0.07, feeder, 12), x, H - 0.01, z * 0.85).rotateZ(Math.PI / 2));
    }
    // Four pale front feeder assemblies are exposed above the tub in 89/200/201.
    g.add(at(rbox(0.048, 0.03, 0.033, 0.004, feeder, 2), x, H - 0.005, -D / 2 + 0.029));
    g.add(at(box(0.025, 0.006, 0.002, inner), x, H - 0.004, -D / 2 + 0.011));
  }
  // front lettering: "Bambu Lab" wordmark west of centre, "AMS" east (photos 200/201)
  const t = canvasTex(256, 32, (c, w, h) => {
    c.fillStyle = '#2b2c2f'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#c9cbce'; c.font = '13px sans-serif'; c.fillText('Bambu Lab', 52, 22);
    c.fillStyle = '#c9cbce'; c.font = 'bold 16px sans-serif'; c.fillText('AMS', 190, 23);
  });
  const tm = mesh(new THREE.PlaneGeometry(0.1, 0.0125), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }), 'ams-label');
  tm.rotation.y = Math.PI;
  tm.position.set(0.005, H - 0.018, -D / 2 - 0.002);
  g.add(tm);

  // smoked breadbox lid: a half-cylinder (axis along x) with end caps, hinged on the back top edge
  // and swung up and back ~25 deg (photo 200/201: translucent, front rim lifted off the tub)
  const lid = grp('ams-lid');
  const R = D / 2;
  const smoke = new THREE.MeshPhysicalMaterial({
    color: '#4b4f53', roughness: 0.14, transparent: true, opacity: 0.42, clearcoat: 1, side: THREE.DoubleSide,
    depthWrite: false, name: 'ams-lid-smoke',
  });
  const dome = new THREE.CylinderGeometry(R, R, W - 0.004, 48, 1, true, 0, Math.PI);
  dome.rotateZ(Math.PI / 2); // axis along x; the half spans +y
  const dm = mesh(dome, smoke, 'ams-dome');
  dm.scale.set(1, 0.78, 1);
  lid.add(dm);
  for (const s of [-1, 1]) {
    const cap = mesh(new THREE.CircleGeometry(R, 32, 0, Math.PI), smoke, 'ams-dome-cap');
    cap.rotation.y = s * Math.PI / 2;
    cap.scale.set(1, 0.78, 1);
    cap.position.x = s * (W / 2 - 0.002);
    lid.add(cap);
  }
  lid.add(at(rbox(W, 0.008, 0.02, 0.003, smoke, 2), 0, 0.004, -R + 0.01));
  // the lid's own frame is centred on the tub; move its pivot to the back edge, then open it
  const hinge = new THREE.Group();
  hinge.name = 'ams-hinge';
  hinge.position.set(0, H, D / 2);
  lid.position.set(0, 0, -R);
  hinge.add(lid);
  hinge.rotation.x = 0.3; // +x lifts the front edge; 200/201 show it tipped back ~25 deg
  g.add(hinge);
  return g;
}

// --------------------------------------------------------------------------------- floor pieces

/** grey padded-vinyl storage ottoman with a lift lid; a black round case and a cat wand on top */
export function buildStorageBin() {
  const g = grp('storage-bin');
  const W = 0.4, D = 0.31, H = 0.33;
  const vinyl = new THREE.MeshPhysicalMaterial({ color: '#999b9e', roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4, name: 'bin-vinyl' });
  const seam = new THREE.MeshStandardMaterial({ color: '#7e8084', roughness: 0.5, name: 'bin-seam' });
  // body: rounded, slightly puffed tub
  const body = rboxGeo(W, H - 0.07, D, 0.06, 6);
  const p = body.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.03 * (1 - (2 * y / (H - 0.07)) ** 2);
    p.setXYZ(i, x * k, y, z * k);
  }
  p.needsUpdate = true;
  body.computeVertexNormals();
  g.add(at(mesh(body, vinyl, 'bin-body'), 0, 0.012 + (H - 0.07) / 2, 0));
  // lid: a padded cushion top slightly wider than the tub, with a welt at the joint
  const lidG = rboxGeo(W + 0.012, 0.07, D + 0.012, 0.03, 5);
  const q = lidG.getAttribute('position');
  for (let i = 0; i < q.count; i++) {
    const x = q.getX(i), y = q.getY(i), z = q.getZ(i);
    if (y > 0) q.setY(i, y + 0.012 * (1 - (2 * x / W) ** 2) * (1 - (2 * z / D) ** 2));
  }
  q.needsUpdate = true;
  lidG.computeVertexNormals();
  g.add(at(mesh(lidG, vinyl, 'bin-lid'), 0, H - 0.035, 0));
  const welt: V3[] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    const ex = (W / 2 + 0.008) * Math.sign(c) * Math.abs(c) ** 0.25;
    const ez = (D / 2 + 0.008) * Math.sign(s) * Math.abs(s) ** 0.25;
    welt.push([ex, H - 0.07, ez]);
  }
  g.add(tube(welt, 0.004, seam, 128, 6, true));
  // small finger tab on the front of the lid
  g.add(at(rbox(0.05, 0.012, 0.01, 0.004, seam, 2), 0, H - 0.075, -D / 2 - 0.01));
  // feet
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(cyl(0.012, 0.012, 0.012, seam, 10), sx * (W / 2 - 0.05), 0.006, sz * (D / 2 - 0.05)));

  // black EVA round case on the lid (201: ~0.2 m across)
  const caseMat = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.75, name: 'round-case' });
  const shell: V2[] = [[0, 0], [0.085, 0], [0.098, 0.008], [0.102, 0.03], [0.1, 0.05], [0.09, 0.064], [0.06, 0.072], [0, 0.074]];
  const rc = lathe(shell, caseMat, 40);
  rc.position.set(0.06, H + 0.004, 0.0);
  g.add(rc);
  g.add(at(cyl(0.1025, 0.1025, 0.004, new THREE.MeshStandardMaterial({ color: '#2a2a2d', roughness: 0.5 }), 40, true), 0.06, H + 0.034, 0.0));

  // cat wand: white handle, pale-blue knob, a tuft of tinsel; a key ring beside it
  const white = new THREE.MeshPhysicalMaterial({ color: '#f1f1ef', roughness: 0.3, clearcoat: 0.5 });
  const wand = grp('cat-wand');
  wand.add(at(cyl(0.011, 0.012, 0.13, white, 16), 0, 0, 0).rotateZ(Math.PI / 2));
  wand.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.017, 16, 12), new THREE.MeshStandardMaterial({ color: '#a9d3e8', roughness: 0.4 })), -0.072, 0, 0));
  const tinsel = new THREE.MeshStandardMaterial({ color: '#d7d9de', metalness: 0.8, roughness: 0.3 });
  for (let i = 0; i < 7; i++) {
    const a = -0.6 + i * 0.2;
    wand.add(tube([[-0.085, 0, 0], [-0.11 - 0.01 * Math.sin(i), 0.004, Math.sin(a) * 0.03], [-0.135, 0.002, Math.sin(a) * 0.05]], 0.0012, tinsel, 8, 4));
  }
  wand.rotation.y = 1.1;
  wand.position.set(-0.1, H + 0.018, -0.04);
  g.add(wand);
  g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0018, 6, 18), new THREE.MeshStandardMaterial({ color: '#c9c3b0', metalness: 0.9, roughness: 0.3 })), -0.15, H + 0.004, 0.03).rotateX(Math.PI / 2));
  return g;
}

/**
 * Running shoes (~US 10), sculpted as one watertight surface: a cushioned midsole with toe spring
 * and a heel bevel, a knit upper rising to a padded collar, the collar opening carved out, a firm
 * heel counter, a tongue and lace rows. Local frame: heel at +z, toe at -z, sole on y = 0.
 * Two colourways from photos 89/200: grey=true is the grey-knit ASICS-style trainer (black sole,
 * pale side stripes, white logo); grey=false is the all-black trainer with a white round heel patch.
 */
const shoeCache = new Map<string, THREE.BufferGeometry>();
export function buildRunningShoe(left: boolean, grey = false) {
  const g = grp('running-shoe');
  const key = (left ? 'L' : 'R') + (grey ? 'g' : 'b');
  let geo = shoeCache.get(key);
  if (!geo) { geo = sculptShoe(grey); shoeCache.set(key, geo); }
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, name: 'shoe' }));
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return g;
}

function sculptShoe(grey: boolean) {
  const L = 0.29;
  const black = '#16171a', mid = grey ? '#33363a' : '#26282b', stripe = grey ? '#c4c8cd' : '#232529';
  const upperC = grey ? '#575b61' : '#17181b', laceC = grey ? '#43474d' : '#101114';
  const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // u: 0 at the heel (+z), 1 at the toe (-z)
  const U = (z: number) => (L / 2 - z) / L;
  /** half-width of the foot outline: narrow heel, widest at the ball, round toe */
  const W = (u: number) => {
    if (u < 0 || u > 1) return 0;
    let w = 0.036 + 0.016 * sm(0.1, 0.68, u) - 0.003 * Math.exp(-(((u - 0.45) / 0.1) ** 2));
    if (u > 0.72) w *= Math.sqrt(Math.max(0, 1 - ((u - 0.72) / 0.28) ** 2.6));
    if (u < 0.09) w *= Math.sqrt(Math.max(0, 1 - ((0.09 - u) / 0.09) ** 2)) * 0.6 + 0.4;
    return w;
  };
  const lift = (u: number) => 0.017 * Math.max(0, (u - 0.72) / 0.28) ** 2 + 0.006 * Math.max(0, (0.06 - u) / 0.06);
  const soleH = (u: number) => 0.037 - 0.011 * u;
  /** height of the upper above the sole top: tall collar at the heel, sloping instep, low toe */
  const T = (u: number) => (0.078 - 0.012 * sm(0.0, 0.25, u) - 0.030 * sm(0.3, 0.85, u) + 0.005 * Math.exp(-(((u - 0.05) / 0.05) ** 2))
    + 0.013 * Math.exp(-(((u - 0.14) / 0.07) ** 2))   // padded collar rim, part of the upper
    - 0.022 * Math.exp(-(((u - 0.2) / 0.05) ** 2)))   // dip where the opening is
    * (u > 0.8 ? Math.sqrt(Math.max(0, 1 - ((u - 0.8) / 0.2) ** 3)) : 1);
  const sole: (x: number, y: number, z: number) => number = (x, y, z) => {
    const u = U(z), w = W(u) * 1.035 + 0.0015, l = lift(u), h = soleH(u), r = 0.008;
    const qx = Math.abs(x) - w + r, qy = Math.abs(y - l - h / 2) - h / 2 + r;
    const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
    // close the ends of the outline properly (w -> 0 there)
    const qz = Math.max(-U(z), U(z) - 1) * L;
    return Math.max(out, qz);
  };
  const upper: (x: number, y: number, z: number) => number = (x, y, z) => {
    const u = U(z), w = W(u) * 0.97, base = lift(u) + soleH(u) - 0.006, t = T(u);
    if (w <= 0.0005) return 0.02;
    const yy = y - base;
    if (yy < 0) return Math.max(Math.abs(x) - w, -yy) * 0.8;
    const e = Math.hypot(x / w, yy / t);
    return (e - 1) * Math.min(w, t) * 0.75;
  };
  const collar = (x: number, y: number, z: number) => {
    // the opening: an ellipsoid sunk into the top of the heel section
    const u0 = 0.2, zc = L / 2 - u0 * L, yc = lift(u0) + soleH(u0) + T(u0) + 0.01;
    return Math.hypot(x / 0.026, (y - yc) / 0.03, (z - zc) / 0.045) - 1;
  };
  const P: Prim[] = [
    { d: sole, color: mid, k: 0 },
    { d: upper, color: upperC, k: 0.01, paint: 1 },
    { d: (x, y, z) => collar(x, y, z) * 0.02, sub: true, k: 0.008 },
  ];
  // black outsole skin under the midsole
  P.push({ d: (x, y, z) => Math.max(sole(x, y, z), y - lift(U(z)) - 0.004), color: black, k: 0, paint: 2 });
  // laces across the instep, heel pull tab, side stripes
  const topAt = (u: number) => lift(u) + soleH(u) - 0.006 + T(u);
  for (let k = 0; k < 5; k++) {
    const u = 0.36 + k * 0.065, z = L / 2 - u * L, y = topAt(u) + 0.001;
    const hw = W(u) * 0.7;
    P.push({ d: capsule([-hw, y - 0.006, z], [hw, y - 0.006, z - 0.005], 0.002), color: laceC, k: 0.003, paint: 1 });
  }
  P.push({ d: roundBox([0, topAt(0.02) + 0.002, L / 2 - 0.003], [0.007, 0.01, 0.0025], 0.002, [0.3, 0, 0]), color: stripe, k: 0.003, paint: 2 });
  for (const side of [-1, 1]) {
    const z0 = L / 2 - 0.3 * L;
    // ASICS-style stripes: thin diagonals rising from the forefoot midsole to the heel collar
    P.push({ d: capsule([side * 0.037, 0.04, z0 - 0.085], [side * 0.041, 0.062, z0 + 0.012], 0.0022), color: stripe, k: 0.006, paint: 2 });
    P.push({ d: capsule([side * 0.039, 0.036, z0 - 0.055], [side * 0.042, 0.052, z0 + 0.028], 0.002), color: stripe, k: 0.006, paint: 2 });
    if (!grey) {
      // the black trainer's small white round patch on the heel side panel (photo 200)
      P.push({ d: ellipsoid([side * 0.0375, 0.058, L / 2 - 0.05], [0.0018, 0.0075, 0.0075]), color: '#c9c9c7', k: 0.001, paint: 3 });
    }
  }
  return sculpt(P, { box: new THREE.Box3(new THREE.Vector3(-0.065, 0, -0.16), new THREE.Vector3(0.065, 0.12, 0.16)), cell: 0.0016, paintBias: 0.0012 });
}

/** gold cardboard tray with a corrugated-cardboard scratch pad (photo 104) */
export function buildScratcherBox() {
  const g = grp('cat-scratcher-box');
  const W = 0.47, D = 0.3, H = 0.075, t = 0.006;
  const gold = new THREE.MeshStandardMaterial({ color: '#cfae54', roughness: 0.55, metalness: 0.25, name: 'scratcher-gold' });
  const pad = corrugated(W - 2 * t, D - 2 * t);
  g.add(at(box(W - 2 * t, H - 0.012, D - 2 * t, pad), 0, (H - 0.012) / 2, 0));
  for (const sx of [-1, 1]) g.add(at(box(t, H, D, gold), sx * (W / 2 - t / 2), H / 2, 0));
  for (const sz of [-1, 1]) g.add(at(box(W, H, t, gold), 0, H / 2, sz * (D / 2 - t / 2)));
  return g;
}

/** oval scratcher: corrugated core in a printed sleeve (cream with green leaf panels, photo 104) */
export function buildScratcherOval() {
  const g = grp('cat-scratcher-oval');
  const A = 0.21, B = 0.14, H = 0.085;
  const sleeveTex = canvasTex(1024, 128, (c, w, h) => {
    c.fillStyle = '#f2ece2'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) {
      c.fillStyle = i % 2 ? '#2f5a3c' : '#e7c7c0';
      c.beginPath();
      const x = i * (w / 6);
      c.ellipse(x + w / 12, h * 0.95, w / 13, h * 0.75, 0, Math.PI, 0);
      c.fill();
    }
  });
  sleeveTex.wrapS = THREE.RepeatWrapping;
  const sleeve = new THREE.CylinderGeometry(1, 1, H, 64, 1, true);
  sleeve.scale(A, 1, B);
  const sm = mesh(sleeve, new THREE.MeshStandardMaterial({ map: sleeveTex, roughness: 0.7, side: THREE.DoubleSide, name: 'scratcher-sleeve' }), 'scratcher-sleeve');
  sm.position.y = H / 2;
  g.add(sm);
  const top = new THREE.CircleGeometry(1, 48);
  top.scale(A - 0.008, B - 0.008, 1);
  const tm = mesh(top, corrugated(2 * A, 2 * B), 'scratcher-pad');
  tm.rotation.x = -Math.PI / 2;
  tm.position.y = H - 0.01;
  g.add(tm);
  return g;
}

function corrugated(w: number, d: number) {
  const tex = canvasTex(512, 256, (c, cw, ch) => {
    c.fillStyle = '#a98a5c'; c.fillRect(0, 0, cw, ch);
    for (let x = 0; x < cw; x += 3) {
      c.fillStyle = x % 6 ? '#8e7247' : '#b99b6c';
      c.fillRect(x, 0, 1.5, ch);
    }
    for (let i = 0; i < 400; i++) {
      c.fillStyle = `rgba(70,50,30,${Math.random() * 0.15})`;
      c.fillRect(Math.random() * cw, Math.random() * ch, 2 + Math.random() * 10, 1);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(w / 0.25, d / 0.12);
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, name: 'corrugated' });
}
