import * as THREE from 'three';
import type { DwMats } from './_desk-west-mats';
import { at, box, cable, cyl, grp, mesh, planSlab, quadPts, rbox, rboxGeo, type V2 } from './_desk-west-kit';

/**
 * The white corner sit-stand desk in the NW corner (RoomPlan object 2) and the IKEA ALEX pedestal.
 *
 * The desk is ONE corner top: a north wing along the window wall (wall 0) and a west wing along
 * wall 2, joined by a deep concave curve where the chair sits. All points are ray hits on the
 * top plane y = 0.820 (triangulated: the front-west corner from photos 197/71/86 lands at
 * y 0.821, miss <= 1.5 cm, so the plane is confirmed):
 *
 *   front-east corner     (-1.07, 1.93)   photos 89/200
 *   front edge            (-1.29,1.95) (-1.45,1.87) (-1.90,1.64) (-2.12,1.41) (-2.27,1.32)
 *                         (-2.31,1.29) (-2.32,1.22)                       photos 197/87/71/86
 *   front-west corner     (-2.375, 1.166)  triangulated 197+71+86
 *   west-end edge         (-2.47,1.18) (-2.57,1.19)  photo 86 -> meets x -2.82 at z ~1.21
 *   west edge             x = -2.82: the Govee lamp pole stands in the gap behind the desk at
 *                         (-2.85, 1.34) (head triangulated, 3 photos, miss <= 1.4 cm) and drops
 *                         behind the desktop in photo 72, so the top cannot run to the wall.
 *   back edge             z = 2.69 (runs under the window stools at 0.88)
 *   east end              x = -1.06 (just over the ALEX pedestal's west side)
 *
 * Frame: grey two-stage columns, east leg at (-1.15, 2.40) with its foot along z (front tip at
 * z 2.12, photo 89), west leg at (-2.47, 1.32) with its foot along x (tip (-2.43,1.29) floor hit,
 * photo 197); grey beams under each wing, a black touch controller under the west front edge
 * (photos 86/87/197: black bar with up/down arrows).
 */
export const DESK = {
  top: 0.82,
  thickness: 0.025,
  east: -1.06,
  west: -2.82,
  back: 2.69,
  frontEastZ: 1.935,
  cornerX: -2.375,
  cornerZ: 1.166,
  westEndZ: 1.212,
};

/** the measured front curve, east to west */
const FRONT: V2[] = [
  [-1.11, 1.937], [-1.22, 1.942], [-1.31, 1.934], [-1.45, 1.876], [-1.62, 1.79], [-1.78, 1.712],
  [-1.92, 1.622], [-2.05, 1.51], [-2.15, 1.41], [-2.24, 1.33], [-2.30, 1.27], [-2.34, 1.215],
];

export function deskOutline(): V2[] {
  const pts: V2[] = [];
  const push = (x: number, z: number) => {
    const l = pts[pts.length - 1];
    if (l && Math.hypot(l[0] - x, l[1] - z) < 0.003) return;
    pts.push([x, z]);
  };
  const r = 0.012;
  push(DESK.west + r, DESK.back);
  push(DESK.east - r, DESK.back);
  push(DESK.east, DESK.back - r);
  push(DESK.east, DESK.frontEastZ + 0.03);
  // rounded front-east corner (r 30 mm)
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    push(DESK.east - 0.03 + Math.cos(a) * 0.03, DESK.frontEastZ + 0.03 - Math.sin(a) * 0.03);
  }
  const curve = new THREE.SplineCurve(FRONT.map(([x, z]) => new THREE.Vector2(x, z)));
  for (const p of curve.getSpacedPoints(48)) push(p.x, p.y);
  // rounded front-west corner (r 25 mm) then the west-end edge back to the wall-side edge
  for (const [x, z] of quadPts([-2.34, 1.215], [DESK.cornerX, DESK.cornerZ - 0.004], [-2.43, 1.17], 8)) push(x, z);
  push(DESK.west + r, DESK.westEndZ);
  push(DESK.west, DESK.westEndZ + r);
  push(DESK.west, DESK.back - r);
  return pts;
}

/** one two-stage grey lifting column with its foot; foot runs along local z */
function leg(M: DwMats, footLen: number, footTip: number) {
  const g = grp('desk-leg');
  const H = DESK.top - DESK.thickness;
  // foot: a tapered steel bar, 70 wide, 45 tall at the column, 25 at the tips, plastic end caps
  const fg = new THREE.BoxGeometry(0.068, 0.045, footLen, 1, 1, 12);
  const p = fg.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i), y = p.getY(i);
    const t = Math.min(1, Math.abs(z - footTip) / (footLen / 2));
    if (y > 0) p.setY(i, y - 0.016 * t * t);
  }
  p.needsUpdate = true;
  fg.computeVertexNormals();
  g.add(at(mesh(fg, M.frameGrey), 0, 0.0225, 0));
  for (const s of [-1, 1]) g.add(at(rbox(0.07, 0.026, 0.024, 0.008, M.darkPlastic, 2), 0, 0.013, s * (footLen / 2 - 0.006)));
  // levelling glides
  for (const s of [-1, 1]) g.add(at(cyl(0.012, 0.014, 0.008, M.black, 10), 0, 0.004, s * (footLen / 2 - 0.04)));
  // lower (inner) stage and upper (outer) stage
  g.add(at(rbox(0.066, 0.36, 0.05, 0.004, M.frameGrey, 2), 0, 0.045 + 0.18, 0));
  g.add(at(rbox(0.076, H - 0.4, 0.06, 0.005, M.frameGrey, 2), 0, 0.4 + (H - 0.4) / 2, 0));
  g.add(at(rbox(0.08, 0.012, 0.064, 0.003, M.darkPlastic, 1), 0, 0.402, 0));
  // top mounting plate
  g.add(at(rbox(0.1, 0.008, 0.16, 0.002, M.frameGrey, 1), 0, H - 0.004, 0));
  return g;
}

export function buildDesk(M: DwMats): THREE.Group {
  const g = grp('corner-desk');
  const H = DESK.top, T = DESK.thickness;
  const top = planSlab(deskOutline(), H, T, 0.006, M.laminate, 32);
  top.name = 'desk-top';
  g.add(top);
  // the underside reads a little greyer (particle-board backer): a thin inset slab
  const under = planSlab(deskOutline().map(([x, z]) => [x + (x < -1.9 ? 0.004 : -0.004), z - 0.004]) as V2[], H - T + 0.0015, 0.002, 0, M.laminateGrey, 24);
  g.add(under);

  // ---- legs
  const east = leg(M, 0.6, 0);
  east.position.set(-1.15, 0, 2.40);
  g.add(east);
  const west = leg(M, 0.6, 0);
  west.position.set(-2.47, 0, 1.33);
  west.rotation.y = Math.PI / 2;
  g.add(west);

  // ---- frame beams under each wing (grey, 50 x 30), meeting in a corner bracket
  const yb = H - T - 0.02;
  g.add(at(box(1.15, 0.03, 0.05, M.frameGrey), (-1.15 + -2.3) / 2, yb, 2.40));
  g.add(at(box(0.05, 0.03, 1.07, M.frameGrey), -2.47, yb, (1.33 + 2.40) / 2));
  g.add(at(rbox(0.16, 0.035, 0.16, 0.004, M.frameGrey, 1), -2.40, yb, 2.40));
  // side brackets out to each wing's front
  for (const [x, z, w, d] of [[-1.15, 2.2, 0.05, 0.5], [-2.2, 2.40, 0.5, 0.05], [-2.5, 1.62, 0.45, 0.05], [-1.7, 2.40, 0.05, 0.45]] as number[][]) {
    g.add(at(box(w, 0.022, d, M.frameGrey), x, H - T - 0.011, z));
  }
  // motor housings at the column tops
  for (const [x, z, ry] of [[-1.15, 2.40, 0], [-2.47, 1.33, Math.PI / 2]] as number[][]) {
    g.add(at(rbox(0.12, 0.05, 0.08, 0.01, M.frameGrey, 2), x, H - T - 0.05, z, ry));
  }
  // control box (black) under the north wing
  g.add(at(rbox(0.2, 0.04, 0.11, 0.008, M.black, 2), -1.95, H - T - 0.022, 2.55, 0.46));

  // ---- touch controller under the west front edge (black bar, two arrow keys + display)
  const ctrl = grp('desk-controller');
  ctrl.add(at(rbox(0.16, 0.022, 0.05, 0.007, M.black, 2), 0, -0.011, 0));
  ctrl.add(at(rbox(0.04, 0.006, 0.014, 0.003, M.led, 1), -0.03, -0.006, -0.026));
  for (const s of [0.02, 0.05]) ctrl.add(at(rbox(0.016, 0.004, 0.012, 0.002, M.darkPlastic, 1), s, -0.007, -0.026));
  ctrl.position.set(-2.29, H - T, 1.31);
  ctrl.rotation.y = 0.92;
  g.add(ctrl);

  // ---- black cable tray under the north wing's back edge, power strip in it
  g.add(at(box(1.0, 0.06, 0.12, M.blackMetal), -1.75, H - T - 0.06, 2.6));
  g.add(at(rbox(0.33, 0.04, 0.055, 0.006, M.plastic, 2), -1.72, H - T - 0.07, 2.6));

  // ---- under-desk cable spill (photos 80/197: a few leads hanging below the front)
  g.add(cable([[-2.05, H - T - 0.06, 2.55], [-2.0, H - 0.3, 2.45], [-1.92, H - 0.22, 2.32], [-1.85, H - T - 0.03, 2.25]], M.black, 0.003));
  g.add(cable([[-1.6, H - T - 0.06, 2.6], [-1.55, 0.45, 2.55], [-1.6, 0.1, 2.5], [-1.62, 0.01, 2.4]], M.black, 0.0035));
  g.add(cable([[-1.4, H - T - 0.06, 2.6], [-1.38, 0.5, 2.62], [-1.35, 0.05, 2.6], [-1.1, 0.01, 2.68]], M.black, 0.0032));
  return g;
}

/**
 * IKEA ALEX drawer unit (5 drawers), 360 x 580 x 700 nominal; standing east of the desk, drawers
 * facing south. Front cap corners hit at x -1.116 / -0.744, z ~2.04 (photo 200 at y=.732);
 * east corner triangulated from 89+200 at y=.738 (7 mm ray gap). Contents stand on y=.732.
 */
// Front-east cap corner: 200:269,693 + 89:183,716 -> (-0.742,0.738,2.036), 7 mm ray gap.
// y=.732 plane puts the other corner at x=-1.116; front z=2.04, not the earlier 2.13 estimate.
export const ALEX = { x: -0.93, z: 2.33, w: 0.37, d: 0.58, h: 0.732 };

export function buildAlex(M: DwMats) {
  const g = grp('alex-drawers');
  const { w, d, h } = ALEX;
  const t = 0.016;
  // carcass: sides, top, back, plinth (the drawers sit between the sides)
  g.add(at(box(t, h - 0.01, d, M.laminate), -w / 2 + t / 2, (h - 0.01) / 2, 0));
  g.add(at(box(t, h - 0.01, d, M.laminate), w / 2 - t / 2, (h - 0.01) / 2, 0));
  g.add(at(rbox(w, 0.018, d, 0.002, M.laminate, 1), 0, h - 0.009, 0));
  g.add(at(box(w - 2 * t, h - 0.03, 0.006, M.laminateGrey), 0, h / 2, -d / 2 + 0.003));
  g.add(at(box(w - 2 * t, 0.03, d - 0.02, M.laminateGrey), 0, 0.015, -0.01));
  // Photo 200: TWO shallow drawers above three deep drawers; total front stack is unchanged.
  // Each has the ALEX's arched finger cut-out in its top edge.
  const fronts = [0.104, 0.104, 0.148, 0.148, 0.148];
  let y = h - 0.02;
  const fw = w - 0.008, fd = 0.018;
  for (const fh of fronts) {
    const s = new THREE.Shape();
    const hw = fw / 2;
    s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, fh);
    // arched cut-out, 0.16 wide, 14 mm deep, centred
    s.lineTo(0.09, fh);
    s.quadraticCurveTo(0.075, fh - 0.016, 0.055, fh - 0.017);
    s.lineTo(-0.055, fh - 0.017);
    s.quadraticCurveTo(-0.075, fh - 0.016, -0.09, fh);
    s.lineTo(-hw, fh); s.lineTo(-hw, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: fd, bevelEnabled: true, bevelSize: 0.0015, bevelThickness: 0.0015, bevelSegments: 1, curveSegments: 12 });
    const m = mesh(geo, M.laminate);
    m.position.set(0, y - fh + 0.003, d / 2 - fd + 0.002);
    g.add(m);
    // Deep shadow inside the finger opening (200), not a pale strip along the drawer seam.
    g.add(at(box(0.186, 0.072, 0.001, M.black), 0, y - 0.025, d / 2 - 0.004));
    g.add(at(box(fw - 0.03, 0.01, 0.02, M.laminateGrey), 0, y - 0.025, d / 2 - fd - 0.012));
    y -= fh + 0.003;
  }
  return g;
}

/** chrome X-frame glass side table carrying the printer (photos 89/90/91/200) */
export function buildGlassTable(M: DwMats, w: number, d: number, h: number) {
  const g = grp('glass-table');
  const glass = new THREE.MeshPhysicalMaterial({ color: '#cfe0dc', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.32, clearcoat: 1, depthWrite: false });
  glass.name = 'dw-glass';
  g.add(at(box(w, 0.01, d, glass), 0, h - 0.005, 0));
  // chrome perimeter frame under the glass
  for (const s of [-1, 1]) {
    g.add(at(box(w, 0.018, 0.018, M.chrome), 0, h - 0.019, s * (d / 2 - 0.009)));
    g.add(at(box(0.018, 0.018, d, M.chrome), s * (w / 2 - 0.009), h - 0.019, 0));
  }
  // X legs on the two short sides, a low stretcher between them
  const L = Math.hypot(d, h - 0.03);
  for (const s of [-1, 1]) {
    for (const k of [-1, 1]) {
      const bar = box(0.016, L, 0.016, M.chrome);
      bar.position.set(s * (w / 2 - 0.009), (h - 0.03) / 2, 0);
      bar.rotation.x = k * Math.atan2(d - 0.02, h - 0.03);
      g.add(bar);
    }
    g.add(at(box(0.018, 0.012, d, M.chrome), s * (w / 2 - 0.009), 0.006, 0));
  }
  g.add(at(box(w, 0.016, 0.016, M.chrome), 0, (h - 0.03) / 2, 0));
  return g;
}

export { rboxGeo };
