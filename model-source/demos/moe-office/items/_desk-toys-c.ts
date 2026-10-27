import * as THREE from 'three';
import { at, cyl, grp, mesh, rbox, rboxGeo, sphere, lathe, tube, type V3 } from './_desk-toys-kit';

/**
 * The small gear lying on the west desk around the monitor foot (photos 166, 167, 78):
 *  - a glossy white AirPods-style charging case, 45 × 55 × 22 mm, lid seam a third down, LED dot;
 *  - a retro 8BitDo/SNES-style gamepad, 120 × 62 × 18 mm, D-pad left, four face buttons right,
 *    two shoulder bumps;
 *  - a black TV/monitor remote, 45 × 170 × 20 mm, button grid;
 *  - a blue marker pen and a small white dental-floss case.
 * Desk top y = 0.820 (see desk-toys.ts).
 */
export const DESK_TOP = 0.82;

export interface CPlace {
  airpods: [number, number];
  gamepad: [number, number];
  remote: [number, number];
  pen: [number, number];
  floss: [number, number];
}

export function buildDeskClutter(place: CPlace): THREE.Group {
  const g = grp('desk-toys-c');
  const put = (o: THREE.Object3D, p: [number, number], ry = 0) => {
    at(o, p[0], DESK_TOP, p[1], ry);
    g.add(o);
    return o;
  };
  put(buildAirpodsCase(), place.airpods, 0.5);
  put(buildGamepad(), place.gamepad, -0.3);
  put(buildRemote(), place.remote, 0.15);
  put(buildPen(), place.pen, 1.1);
  put(buildFloss(), place.floss, 0.4);
  return g;
}

function buildAirpodsCase() {
  const g = grp('toy-airpods');
  const white = new THREE.MeshPhysicalMaterial({
    color: '#f5f5f1', roughness: 0.2, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.1,
  });
  white.name = 'airpods-white';
  const seam = new THREE.MeshStandardMaterial({ color: '#d5d5d0', roughness: 0.6 });
  // 45 wide (x) x 55 tall (y) x 22 deep (z): lower body + lid with a 1.2 mm seam gap between them
  const body = rbox(0.045, 0.038, 0.022, 0.009, white, 4);
  at(body, 0, 0.019, 0);
  g.add(body);
  // the seam plate sits just inside the silhouette so it reads as a groove
  const gap = rbox(0.0402, 0.0013, 0.0182, 0.005, seam, 3);
  at(gap, 0, 0.0386, 0);
  g.add(gap);
  const lid = rbox(0.045, 0.0158, 0.022, 0.0078, white, 4);
  at(lid, 0, 0.0472, 0);
  g.add(lid);
  // hinge relief at the back, status LED at the front
  g.add(at(rbox(0.02, 0.0018, 0.0012, 0.0004, seam, 1), 0, 0.039, -0.0105));
  const led = cyl(0.0015, 0.0015, 0.0008, new THREE.MeshStandardMaterial({
    color: '#8ede7a', emissive: '#2f7a26', emissiveIntensity: 1.4, roughness: 0.4,
  }), 10);
  led.rotation.x = Math.PI / 2;
  at(led, 0, 0.026, 0.0112);
  g.add(led);
  return g;
}

function buildGamepad() {
  const g = grp('toy-gamepad');
  const black = new THREE.MeshStandardMaterial({ color: '#1b1c1f', roughness: 0.55 });
  black.name = 'gamepad-black';
  const grey = new THREE.MeshStandardMaterial({ color: '#8e8f92', roughness: 0.45 });
  const red = new THREE.MeshStandardMaterial({ color: '#b3252c', roughness: 0.45 });
  // slab body 120 × 62 × 18, rounded
  const body = rbox(0.062, 0.018, 0.12, 0.012, black, 4);
  at(body, 0, 0.009, 0);
  g.add(body);
  // shoulder bumps
  for (const s of [-1, 1]) {
    g.add(at(rbox(0.018, 0.008, 0.014, 0.004, black, 2), s * 0.019, 0.016, -0.056, 0, 0.1, 0));
  }
  // D-pad: a cross of two bars
  g.add(at(rbox(0.012, 0.003, 0.0035, 0.001, grey, 1), -0.014, 0.019, 0.012));
  g.add(at(rbox(0.0035, 0.003, 0.012, 0.001, grey, 1), -0.014, 0.019, 0.012));
  // four face buttons
  for (const [dx, dz] of [[0.012, 0.02], [0.02, 0.012], [0.012, 0.004], [0.004, 0.012]] as const) {
    const b = cyl(0.0032, 0.0032, 0.0022, red, 12);
    at(b, dx, 0.019, dz);
    g.add(b);
  }
  // start/select pair and a centre LED
  g.add(at(rbox(0.0045, 0.0018, 0.0025, 0.0008, grey, 1), -0.004, 0.019, -0.004));
  g.add(at(rbox(0.0045, 0.0018, 0.0025, 0.0008, grey, 1), 0.004, 0.019, -0.004));
  g.add(at(cyl(0.0016, 0.0016, 0.0008, red, 8), 0, 0.019, 0.03));
  return g;
}

function buildRemote() {
  const g = grp('toy-remote2');
  const black = new THREE.MeshStandardMaterial({ color: '#17181a', roughness: 0.68 });
  const grey = new THREE.MeshStandardMaterial({ color: '#4a4c4f', roughness: 0.6 });
  const body = rbox(0.02, 0.045, 0.17, 0.008, black, 4);
  at(body, 0, 0.0225, 0);
  g.add(body);
  // button grid: 3 × 4 plus a round pad
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      g.add(at(rbox(0.004, 0.0022, 0.0055, 0.0012, grey, 1), -0.0055 + col * 0.0055, 0.0455, -0.055 + row * 0.011));
    }
  }
  const pad = cyl(0.008, 0.008, 0.0025, grey, 16);
  at(pad, 0, 0.046, 0.045);
  g.add(pad);
  // an IR window at the top
  g.add(at(rbox(0.008, 0.003, 0.002, 0.0008, new THREE.MeshPhysicalMaterial({ color: '#3a1010', roughness: 0.15, clearcoat: 1 }), 1), 0, 0.045, 0.083));
  return g;
}

function buildPen() {
  const g = grp('toy-pen');
  const blue = new THREE.MeshStandardMaterial({ color: '#1f4fa8', roughness: 0.32 });
  const body = cyl(0.0042, 0.0042, 0.135, blue, 14);
  at(body, 0, 0.0042, 0, 0, 0, Math.PI / 2);
  g.add(body);
  const tip = cyl(0.0042, 0.0016, 0.014, new THREE.MeshStandardMaterial({ color: '#c8c9c6', roughness: 0.35, metalness: 0.6 }), 12);
  at(tip, 0.073, 0.0042, 0, 0, 0, -Math.PI / 2);
  g.add(tip);
  const clip = rboxGeo(0.03, 0.0022, 0.0035, 0.0008, 1);
  g.add(at(mesh(clip, blue), -0.045, 0.0075, 0));
  return g;
}

function buildFloss() {
  const g = grp('toy-floss');
  const white = new THREE.MeshPhysicalMaterial({ color: '#f0f0ec', roughness: 0.35, clearcoat: 0.4 });
  const body = rbox(0.026, 0.016, 0.018, 0.004, white, 3);
  at(body, 0, 0.008, 0);
  g.add(body);
  const lid = rbox(0.0265, 0.006, 0.0185, 0.003, white, 3);
  at(lid, 0, 0.018, 0);
  g.add(lid);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.008), new THREE.MeshStandardMaterial({ color: '#2f6fa8', roughness: 0.6 }));
  at(label, 0, 0.009, 0.0092);
  g.add(label);
  void sphere;
  void lathe;
  void tube;
  return g;
}
