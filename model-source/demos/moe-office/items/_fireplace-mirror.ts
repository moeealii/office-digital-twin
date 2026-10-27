import * as THREE from 'three';
import { at, mesh, rbox, cyl } from './_moe-kit';
import type { FireplaceMats } from './_fireplace-mats';
import { inst } from './_fireplace-geo';

/**
 * Wall 1's east-end fittings: the pearl-and-gold scale (sunburst) mirror and the light switch
 * beside it. Photo 141 is the reference; that pose is not one of the trustworthy ones on this wall,
 * so it was used for SHAPE and the frame is sized from the photograph's own scale bar — the switch
 * plate at 75 px is a standard 0.115 m plate, which puts the wall plane at 661 px/m and the mirror's
 * vertical extent (480 px) at 0.73 m. The horizontal extent is 0.59 m, i.e. foreshortened by
 * cos 35°, which independently confirms the camera is 35° off the wall normal (atan(0.82/1.14)=36°).
 *
 * Construction follows the photo at 1:1: a dark bronze outer rim, a wide pearl-mosaic annulus, two
 * staggered rings of overlapping gold scale arcs (real geometry, not a texture — it is seen at an
 * angle from the room), a beaded gold ring around the glass, and a flat mirror disc.
 *
 * Local frame (after ctx.onWall): +x along the wall, +y up, +z into the room, origin at the disc's
 * centre on the wall face.
 */
export const MIRROR = { u: 5.006, v: 1.480, rOuter: 0.305, rMirror: 0.180 };
export const SWITCH = { u: 4.495, v: 1.480 };

export function buildSunburstMirror(m: FireplaceMats) {
  const g = new THREE.Group();
  g.name = 'sunburst-mirror';
  const R = MIRROR.rOuter;

  // backing disc: its front face is the pearl mosaic annulus
  const back = cyl(R, R, 0.022, m.pearlFrame, 64);
  back.rotation.x = Math.PI / 2;
  at(back, 0, 0, -0.006);
  g.add(back);
  // the mirror itself, in a shallow recess
  const glass = new THREE.Mesh(new THREE.CircleGeometry(MIRROR.rMirror, 64), m.mirrorGlass);
  at(glass, 0, 0, 0.006);
  glass.receiveShadow = false;
  g.add(glass);
  // dark reveal between the glass and the bead ring
  const reveal = new THREE.Mesh(new THREE.RingGeometry(MIRROR.rMirror, MIRROR.rMirror + 0.012, 64), m.bronzeRim);
  at(reveal, 0, 0, 0.005);
  g.add(reveal);

  // beaded gold cord around the glass
  const beadRing = mesh(new THREE.TorusGeometry(MIRROR.rMirror + 0.016, 0.0075, 8, 72), m.scaleGold);
  at(beadRing, 0, 0, 0.010);
  g.add(beadRing);
  {
    const n = 54;
    const beadGeo = new THREE.SphereGeometry(0.0055, 6, 5);
    const mats: THREE.Matrix4[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = MIRROR.rMirror + 0.016;
      mats.push(new THREE.Matrix4().compose(
        new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, 0.014),
        new THREE.Quaternion(),
        new THREE.Vector3(1, 1, 1),
      ));
    }
    g.add(inst(beadGeo, m.scaleGold, mats, 'mirror-beads'));
  }

  // two staggered rings of overlapping scales: gold arc over a darker arc, real geometry
  const goldGeo = new THREE.TorusGeometry(0.045, 0.005, 5, 12, Math.PI * 1.0);
  const darkGeo = new THREE.TorusGeometry(0.045, 0.0086, 5, 12, Math.PI * 1.0);
  const goldMats: THREE.Matrix4[] = [];
  const darkMats: THREE.Matrix4[] = [];
  const rings: [number, number, number][] = [
    [0.303, 24, 0],       // outer ring: radius, count, phase
    [0.258, 22, Math.PI / 22],
  ];
  for (const [rr, count, phase] of rings) {
    for (let i = 0; i < count; i++) {
      const a = phase + (i / count) * Math.PI * 2;
      // the arc opens toward the centre, so each scale reads as a fan scallop
      const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, a + Math.PI / 2 + 0.35));
      const pos = new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, 0.011);
      goldMats.push(new THREE.Matrix4().compose(pos, rot, new THREE.Vector3(1, 1, 1)));
      darkMats.push(new THREE.Matrix4().compose(
        pos.clone().setZ(0.008), rot, new THREE.Vector3(1.02, 1.02, 1),
      ));
    }
  }
  g.add(inst(darkGeo, m.scaleDark, darkMats, 'mirror-scales-dark'));
  g.add(inst(goldGeo, m.scaleGold, goldMats, 'mirror-scales-gold'));

  // outer bronze rim
  const rim = mesh(new THREE.TorusGeometry(R - 0.004, 0.0085, 8, 72), m.bronzeRim);
  at(rim, 0, 0, 0.002);
  g.add(rim);
  // pearl face ring between the rim and the outer scale ring
  const face = new THREE.Mesh(new THREE.RingGeometry(R - 0.030, R - 0.006, 72), m.pearlFrame);
  at(face, 0, 0, 0.007);
  g.add(face);

  // the frame is built for a 0.365 m radius; scale it to the measured 0.305 m
  g.scale.setScalar(MIRROR.rOuter / 0.365);
  // a wall fixture must not throw pot-light shadows across itself
  g.traverse(o => {
    const mm = o as THREE.Mesh;
    if (mm.isMesh) { mm.castShadow = false; mm.receiveShadow = false; }
  });
  return g;
}

/** The rocker switch on wall 1 beside the mirror (photo 141). */
export function buildSwitch(m: FireplaceMats) {
  const g = new THREE.Group();
  g.name = 'wall-switch';
  const plate = rbox(0.078, 0.115, 0.008, 0.004, m.switchPlate, 2);
  at(plate, 0, 0, 0.004);
  g.add(plate);
  const rocker = rbox(0.029, 0.057, 0.009, 0.003, m.switchPlate, 2);
  at(rocker, 0, 0, 0.0105);
  rocker.rotation.x = 0.06;
  g.add(rocker);
  g.add(at(cyl(0.0035, 0.0035, 0.004, m.applianceDark, 8).rotateX(Math.PI / 2), 0, -0.042, 0.0105));
  g.traverse(o => {
    const mm = o as THREE.Mesh;
    if (mm.isMesh) { mm.castShadow = false; mm.receiveShadow = true; }
  });
  return g;
}
