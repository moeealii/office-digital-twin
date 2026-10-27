import * as THREE from 'three';
import { Batch, M, boxUV, cyl, extrudeShape, rb, roundedRectShape, tube, v3 } from './_desk-east-geo';
import type { DEMats } from './_desk-east-mats';

/**
 * Black east sit-stand desk and white dual monitor arm, photos 108/112–114/160/161.
 * Front-east corner from 112/113: (2.608,.801,1.962), ray gap 4 mm (picked on the lower edge).
 * Slab surface .832 ±.02, 25 mm thick: this also agrees with the .848 tin base / west laptop
 * front in 114/160 and clears the padded loveseat arm. West edge from 114: x 1.32–1.34.
 * Final slab x 1.30..2.668, z 1.96..2.71. Lift-foot floor picks support columns x 1.42/2.52.
 * Pole top (2.501,1.123,2.647), elbow (2.770,1.063,2.659), empty VESA plate
 * (2.523,1.258,2.642), from 112/113, gaps 8–34 mm. The display is about .545 × .335;
 * 112/149 give its east top (2.211,1.303,2.458), gap 7 mm, bottom z≈2.512 (50 mm gap).
 * Frame internals/control-unit dimensions and exact cable paths remain photo-based approximations.
 */

// Front-east corner triangulated in photos 112/113: (2.608, .801, 1.962), gap 4 mm.
// Lower-edge pick plus 25 mm slab and 6 mm bevel; the west-end evidence permits ±2 cm.
export const DESK = { x0: 1.30, x1: 2.668, zF: 1.96, zB: 2.71, top: 0.832, th: 0.025 };

export function buildDesk(m: DEMats) {
  const g = new THREE.Group();
  g.name = 'east-desk';
  const b = new Batch();
  const { x0, x1, zF, zB, top, th } = DESK;
  const cx = (x0 + x1) / 2;
  const cz = (zF + zB) / 2;

  // ---- top: rounded-corner laminate slab with a beveled edge
  const topGeo = extrudeShape(roundedRectShape(x1 - x0, zB - zF, 0.05), th, 0.006, 10);
  topGeo.rotateX(-Math.PI / 2);
  boxUV(topGeo, 1);
  b.add(topGeo, m.deskTop, M(cx, top - th / 2, cz));

  // ---- frame: two lift columns, foot bars, crossbar, brackets
  const colX = [1.42, 2.52]; // floor feet in 160/161: west 1.40±.03, east 2.54±.03 // west column clear of the loveseat arm (x ≤ 1.36)
  const colZ = zB - 0.36; // foot bars (±0.32) stay in front of the wall
  for (const x of colX) {
    // lower (outer) tube
    b.add(boxUV(rb(0.105, 0.40, 0.072, 0.008, 2)), m.frameSteel, M(x, 0.245, colZ));
    // upper (inner) tube
    b.add(boxUV(rb(0.085, 0.35, 0.056, 0.007, 2)), m.frameSteel, M(x, 0.615, colZ));
    // mounting plate under the top
    b.add(boxUV(rb(0.13, 0.026, 0.17, 0.006, 2)), m.frameSteel, M(x, top - th - 0.012, colZ));
    // foot bar along z with levelling pads
    b.add(boxUV(rb(0.062, 0.03, 0.62, 0.012, 3)), m.frameSteel, M(x, 0.032, colZ));
    for (const dz of [-0.265, 0.265]) {
      b.add(cyl(0.024, 0.026, 0.018, 14), m.rubber, M(x, 0.011, colZ + dz));
    }
    // anti-collision end caps
    for (const dz of [-1, 1]) b.add(rb(0.066, 0.036, 0.02, 0.008, 2), m.frameSteel, M(x, 0.032, colZ + dz * 0.32));
  }
  // crossbar between the columns
  b.add(boxUV(rb(colX[1] - colX[0], 0.055, 0.05, 0.008, 2)), m.frameSteel, M((colX[0] + colX[1]) / 2, top - th - 0.05, colZ));
  // control pad under the front edge and its cable
  b.add(boxUV(rb(0.135, 0.02, 0.05, 0.008, 2)), m.frameSteel, M(x1 - 0.28, top - th - 0.014, zF + 0.10));
  b.add(boxUV(rb(0.11, 0.016, 0.036, 0.006, 2)), m.deskBlack, M(x1 - 0.28, top - th - 0.03, zF + 0.10));
  // black power brick slung under the top near the east end (photo 112)
  b.add(boxUV(rb(0.19, 0.055, 0.10, 0.012, 2)), m.frameSteel, M(x1 - 0.24, top - th - 0.055, zB - 0.22));
  // cable tray lip along the back edge
  b.add(boxUV(rb(x1 - x0 - 0.9, 0.02, 0.06, 0.008, 2)), m.frameSteel, M(cx, top - th - 0.03, zB - 0.10));

  // ---- monitor arm (photos 112/113): white gas-spring arm, black pole, empty VESA high on the wall
  // Triangulated 112/113: pole top (2.501,1.123,2.647), elbow
  // (2.770,1.063,2.659), empty plate (2.523,1.258,2.642); gaps 8–34 mm.
  const clampX = 2.501;
  const clampZ = 2.647;
  b.add(boxUV(rb(0.08, 0.045, 0.12, 0.008, 2)), m.armGrey, M(clampX, top + 0.022, clampZ));
  b.add(boxUV(rb(0.08, 0.09, 0.026, 0.006, 2)), m.deskBlack, M(clampX, top - 0.04, clampZ + 0.04));
  b.add(cyl(0.014, 0.014, 1.123 - top, 16), m.deskBlack, M(clampX, (1.123 + top) / 2, clampZ));
  const elbow = v3(2.770, 1.063, 2.659);
  const plateAt = v3(2.523, 1.258, 2.642);
  const monAt = v3(1.98, 1.14, 2.55);
  const armSeg = (a: THREE.Vector3, c: THREE.Vector3, w: number, t: number, mat: THREE.Material) => {
    const dir = c.clone().sub(a);
    const len = Math.max(0.04, dir.length());
    const geo = rb(w, t, len, Math.min(0.012, t * 0.4), 2);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
    b.add(geo, mat, new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  };
  const shoulder = v3(clampX, 0.969, clampZ);
  // Curved lower castings follow the shallow bow visible above the pump bottles.
  const lowerArm = (a: THREE.Vector3, c: THREE.Vector3) => {
    const pts = [a, a.clone().lerp(c, 0.35).add(v3(0, 0.025, 0)), c];
    b.add(tube(pts, 0.024, 28, 10), m.armWhite);
    b.add(tube(pts.map(p => p.clone().add(v3(0, -0.018, 0.014))), 0.006, 28, 6), m.armGrey);
  };
  lowerArm(shoulder, elbow);
  armSeg(elbow, plateAt, 0.055, 0.027, m.armWhite);
  lowerArm(shoulder.clone().add(v3(0, -0.015, 0)), monAt);
  // Recessed black gas-spring strip on the room-facing face of the upper arm.
  armSeg(elbow.clone().lerp(plateAt, 0.22).add(v3(0, 0, -0.018)),
    elbow.clone().lerp(plateAt, 0.83).add(v3(0, 0, -0.018)), 0.022, 0.009, m.deskBlack);
  for (const p of [elbow, shoulder, monAt]) {
    b.add(cyl(0.025, 0.025, 0.036, 16), m.deskBlack, M(p.x, p.y, p.z));
  }
  b.add(cyl(0.012, 0.012, 0.025, 10), m.deskBlack, M(plateAt.x, plateAt.y - 0.035, plateAt.z));
  // empty VESA plate, facing the room, above and east of the monitor
  const pm = new THREE.Matrix4().compose(
    plateAt,
    new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, 0.15, 0.2, 'YXZ')),
    new THREE.Vector3(1, 1, 1),
  );
  const vesa = new THREE.Shape();
  vesa.moveTo(-0.055, -0.055);
  vesa.quadraticCurveTo(-0.039, 0, -0.055, 0.055);
  vesa.quadraticCurveTo(-0.055, 0.064, -0.044, 0.06);
  vesa.quadraticCurveTo(0, 0.04, 0.044, 0.06);
  vesa.quadraticCurveTo(0.055, 0.064, 0.055, 0.055);
  vesa.quadraticCurveTo(0.039, 0, 0.055, -0.055);
  vesa.quadraticCurveTo(0.055, -0.064, 0.044, -0.06);
  vesa.quadraticCurveTo(0, -0.04, -0.044, -0.06);
  vesa.closePath();
  for (const x of [-0.044, 0.044]) for (const y of [-0.049, 0.049]) {
    const hole = new THREE.Path(); hole.absarc(x, y, 0.0035, 0, Math.PI * 2, false); vesa.holes.push(hole);
  }
  b.add(extrudeShape(vesa, 0.005, 0.001, 12), m.deskBlack, pm);
  for (const [dx, dy] of [[-0.042, -0.042], [0.042, -0.042], [-0.042, 0.042], [0.042, 0.042]]) {
    b.add(cyl(0.007, 0.007, 0.018, 8).rotateX(Math.PI / 2), m.chrome, pm.clone().multiply(M(dx, dy, 0.006)));
  }
  // ---- the display
  const mon = new THREE.Group();
  const MW = 0.545;
  const MH = 0.335;
  const body = rb(MW, MH, 0.016, 0.007, 3);
  const bm = new THREE.Mesh(body, m.monitorShell);
  mon.add(bm);
  // back shell with the VESA boss
  const backShell = rb(MW - 0.06, MH - 0.05, 0.03, 0.014, 4);
  const bs = new THREE.Mesh(backShell, m.monitorShell);
  bs.position.z = -0.018;
  mon.add(bs);
  // the panel's glass: one plane, 1.5 mm proud of the body so it never z-fights with it
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(MW - 0.024, MH - 0.026), m.screenOff);
  screen.position.z = 0.0095;
  mon.add(screen);
  // stand mount block on the back
  const boss = new THREE.Mesh(rb(0.09, 0.09, 0.03, 0.01, 2), m.deskBlack);
  boss.position.z = -0.036;
  mon.add(boss);
  // brand strip
  const brand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.008, 0.002), m.alu);
  brand.position.set(0, -MH / 2 + 0.013, 0.0108);
  mon.add(brand);
  mon.traverse(o => {
    const mm = o as THREE.Mesh;
    if (mm.isMesh) mm.castShadow = mm.receiveShadow = true;
  });
  mon.position.set(1.94, 1.14, 2.495);
  mon.rotation.order = 'YXZ'; // keep the measured top/bottom z tilt after the 180° yaw
  mon.rotation.y = Math.PI + 0.04;
  mon.rotation.x = 0.17; // top leans wallward; east edge triangulates z 2.458..2.512
  g.add(mon);
  // monitor-end arm plate
  b.add(rb(0.11, 0.11, 0.014, 0.008, 3), m.deskBlack, M(1.955, 1.14, 2.55));

  // ---- cables: a loop from the monitor down the arm and under the desk
  const loop = [
    v3(1.98, 1.14, 2.56),
    v3(2.05, 1.16, 2.60),
    v3(2.12, 1.06, 2.61),
    v3(2.17, 0.88, 2.63),
    v3(2.10, 0.78, 2.55),
    v3(2.26, 0.72, 2.58),
    v3(2.42, 0.66, 2.60),
  ];
  b.add(tube(loop, 0.005, 64, 6), m.cable);
  const under = [
    v3(2.42, 0.66, 2.60),
    v3(2.5, 0.52, 2.56),
    v3(2.36, 0.40, 2.5),
    v3(2.18, 0.30, 2.44),
    v3(2.05, 0.22, 2.38),
  ];
  b.add(tube(under, 0.005, 48, 6), m.cable);
  // slack loop under the desk (photo 161)
  const slack = [
    v3(2.05, 0.22, 2.38),
    v3(1.88, 0.14, 2.30),
    v3(1.74, 0.10, 2.16),
    v3(1.62, 0.14, 2.04),
    v3(1.55, 0.26, 1.99),
  ];
  b.add(tube(slack, 0.005, 48, 6), m.cable);

  // West-side hanging control unit and slack wiring seen under the laptop in photo 160.
  // Photo-160 pixel (503,475) on x=1.49 gives (.718,2.075) in y/z.
  b.add(rb(.055,.15,.085,.012,3),m.frameSteel,M(1.49,.718,2.075));
  b.add(tube([v3(1.48,top-.02,2.33),v3(1.47,.60,2.28),v3(1.47,.53,2.21),v3(1.54,.57,2.17)],.0035,40,6),m.cable);
  for(let i=0;i<4;i++) {
    const pts=[];
    for(let j=0;j<=44;j++){const a=j/44*Math.PI*2;pts.push(v3(1.53+.024*Math.cos(a),.57+i*.037+.04*Math.sin(a),2.29+.028*Math.sin(a)));}
    b.add(tube(pts,.0025,48,5),m.cable);
  }
  // Loose grey lead in front of the west foot (160), including its small rectangular plug.
  const lead=[];
  for(let j=0;j<=100;j++){const a=j/100*Math.PI*4.2;const r=.085+.012*Math.sin(a*.7);lead.push(v3(1.64+r*Math.cos(a),.025+.008*Math.sin(a*1.3),2.27+.12*Math.sin(a)));}
  b.add(tube(lead,.0024,150,6),m.cableGrey);
  b.add(rb(.012,.009,.027,.002,2),m.alu,M(1.60,.025,2.14,.4));
  b.build(g, 'desk');
  g.userData.physics = { type: 'static' };
  return g;
}
