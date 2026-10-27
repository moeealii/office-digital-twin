import * as THREE from 'three';
import { at, canvasTex, cyl, mesh, rbox, rng, rod, v3 } from './_moe-kit';
import { boxCushion, clothSurface, lathe } from './_lounge-geo';
import type { LoungeMats } from './_lounge-mats';

/**
 * North-east corner of the room, from photos 137, 176, 177, 214, 215, 217 (+ the top ortho scan
 * for plan positions):
 *  - settee (RoomPlan object 5): back on wall 1 (z = -2.62), 1.62 m along x, 0.71 deep, ivory
 *    leather, smooth back with a rolled top and two rolled arms (NOT tufted), two red pillows +
 *    the grey printed throw (photo crop texture). Back top measured at 0.72 m on photo 217.
 *  - rolling double-sided whiteboard in front of it: 1.18 x .80 m, vertical at z≈-1.75,
 *    on an aluminium wheeled stand. The wide-baseline 177/217 measurement supersedes the previous
 *    guessed .945 m bottom: panel now .865…1.665 m, independent marker shelf at .605 m.
 *    The handwriting remains the existing rectified photo crop.
 *  - cardboard box on the floor beside it (photos 214/215/217).
 *  - round sunburst mirror on wall 1 above the settee (Ø 0.80, centre y 1.46).
 *  - woven four-panel room divider standing in the wall-3 doorway (shell: u 0.51…1.68): 12 mm field
 *    boxes (fold reads in the silhouette) with the weave crop tiled at ~20 mm cell pitch and a
 *    matching procedural plain-weave normal map (lounge-weave-nor.png).
 *  - clear acrylic chair and the green garden stool beside the sofa's north arm (photos 103/125/177).
 */

export function buildSettee(m: LoungeMats, ctxU?: (o: THREE.Object3D) => void) {
  const g = new THREE.Group();
  g.name = 'settee';
  const x0 = 0.88, x1 = 2.44, xc = (x0 + x1) / 2;
  const zBack = -2.615, zFront = -1.92;
  const zc = (zBack + zFront) / 2;
  const ARM = 0.16, ARM_TOP = 0.625, BACK_TOP = 0.72, DECK = 0.33, SEAT = 0.455;
  const zSeatBack = -2.465; // where the bench cushion meets the back

  /** a closed (z, y) profile extruded along x from xa to xb, ends softly bevelled */
  const sweepX = (pts: [number, number][], xa: number, xb: number, bev: number, mat: THREE.Material) => {
    const sh = new THREE.Shape(pts.map(([zz, yy]) => new THREE.Vector2(zz, yy)));
    const geo = new THREE.ExtrudeGeometry(sh, {
      depth: xb - xa - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: 0.01, bevelSegments: 6, curveSegments: 24, // bevelSize grows the outline; keep it small
    });
    geo.rotateY(-Math.PI / 2); // shape x -> world z, extrusion -> world -x
    geo.translate(xb - bev, 0, 0);
    geo.computeVertexNormals();
    return mesh(geo, mat);
  };
  const curve = (a: [number, number], c: [number, number], b: [number, number], n = 10) => {
    const out: [number, number][] = [];
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t;
      out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
    }
    return out;
  };

  // plinth (dark shadow gap) + upholstered seat frame with a soft front edge
  g.add(at(rbox(x1 - x0 - 0.12, 0.07, zFront - zBack - 0.12, 0.012, m.leatherDark, 2), xc, 0.035, zc));
  g.add(sweepX([
    [zBack + 0.01, 0.06], [zFront - 0.04, 0.06], ...curve([zFront - 0.04, 0.06], [zFront + 0.004, 0.065], [zFront, 0.12]),
    [zFront, DECK - 0.05], ...curve([zFront, DECK - 0.05], [zFront, DECK], [zFront - 0.05, DECK]), [zBack + 0.01, DECK],
  ], x0 + 0.01, x1 - 0.01, 0.03, m.setteeLeather));

  // back: one leaning upholstered panel that rolls over into a rounded top (photos 176/217)
  g.add(sweepX([
    [zSeatBack, DECK],
    ...curve([zSeatBack, DECK], [zSeatBack - 0.035, 0.52], [zSeatBack - 0.06, BACK_TOP - 0.07]),
    ...curve([zSeatBack - 0.06, BACK_TOP - 0.07], [zSeatBack - 0.075, BACK_TOP + 0.004], [zSeatBack - 0.135, BACK_TOP]),
    ...curve([zSeatBack - 0.135, BACK_TOP], [zBack + 0.004, BACK_TOP - 0.004], [zBack + 0.004, BACK_TOP - 0.06]),
    [zBack + 0.004, DECK],
  ], x0 + 0.004, x1 - 0.004, 0.045, m.setteeLeather));
  // welt along the roll's front seam
  g.add(rod([x0 + ARM, BACK_TOP - 0.062, zSeatBack - 0.058], [x1 - ARM, BACK_TOP - 0.062, zSeatBack - 0.058], 0.0042, m.piping));

  // rolled arms: inner face up from the seat, a roll that flares just past the outer face,
  // outer face straight down; front ends bevelled round, welt following the front profile
  for (const sx of [-1, 1] as const) {
    const xo = sx > 0 ? x1 : x0;         // outer face
    const xi = xo - sx * ARM;            // inner face
    const prof: [number, number][] = [
      [xi, 0.06], [xi, ARM_TOP - 0.1],
      ...curve([xi, ARM_TOP - 0.1], [xi - sx * 0.005, ARM_TOP], [xi + sx * 0.07, ARM_TOP]),
      ...curve([xi + sx * 0.07, ARM_TOP], [xo + sx * 0.022, ARM_TOP + 0.002], [xo + sx * 0.012, ARM_TOP - 0.075]),
      ...curve([xo + sx * 0.012, ARM_TOP - 0.075], [xo, ARM_TOP - 0.12], [xo, ARM_TOP - 0.17]),
      [xo, 0.06],
    ];
    const sh = new THREE.Shape((sx > 0 ? prof : [...prof].reverse()).map(([xx, yy]) => new THREE.Vector2(xx, yy)));
    const len = zFront - zBack - 0.03;
    const bev = 0.035;
    const geo = new THREE.ExtrudeGeometry(sh, {
      depth: len - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: 0.008, bevelSegments: 6, curveSegments: 24,
    });
    geo.translate(0, 0, zBack + 0.015 + bev);
    geo.computeVertexNormals();
    g.add(mesh(geo, m.setteeLeather));
    // welt round the front cap's outline (the cap sits at the extrusion's front end)
    const welt = prof.map(([xx, yy]) => [xx, yy, zFront - 0.015 + 0.003] as [number, number, number]);
    g.add(new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(welt.map(p => v3(...p)), false, 'centripetal'), 60, 0.0042, 6),
      m.piping,
    ));
  }

  // one long bench cushion between the arms, piped top and bottom
  {
    const cw = x1 - x0 - 2 * ARM - 0.006, cd = zFront + 0.006 - zSeatBack;
    const czc = (zFront + 0.006 + zSeatBack) / 2;
    const c = boxCushion(cw, cd, SEAT - DECK, m.setteeLeather, { r: 0.05, dome: 0.012, sag: 0.006, flatten: 0.006, wrinkle: 0.001, seed: 23 });
    at(c, xc, (SEAT + DECK) / 2, czc);
    g.add(c);
    for (const yy of [DECK + 0.01, SEAT - 0.008]) g.add(at(roundedRing(cw - 0.012, cd - 0.012, 0.0045, m.piping, yy), xc, 0, czc));
  }

  // red pillows: square, plump in the middle and pinched to points at the corners, leaning on the
  // back at each end (photos 176/217)
  // Left pillow lies diagonally along the arm, showing its pale reverse in photo 11;
  // the right pillow stands flatter against the back. They are not two identical red squares.
  const pillowReverse = m.redPillow.clone();
  pillowReverse.color.set('#e8e3d8');
  for (const [px, rx, ry, rz] of [[x0 + ARM + 0.14, -0.68, 0.68, 0.30], [x1 - ARM - 0.24, -0.24, -0.2, -0.05]] as const) {
    const P = 0.44, T = 0.15;
    const geo = new THREE.BoxGeometry(P, P, T, 14, 14, 4);
    const pp = geo.getAttribute('position');
    for (let k = 0; k < pp.count; k++) {
      const u = pp.getX(k) / (P / 2), v = pp.getY(k) / (P / 2);
      const puff = Math.sqrt(Math.max(0, 1 - u * u)) * Math.sqrt(Math.max(0, 1 - v * v));
      // edges pull in a little (seam), corners stay pointed
      const pull = 1 - 0.07 * (u * u * (1 - v * v) + v * v * (1 - u * u));
      pp.setXYZ(k, pp.getX(k) * pull, pp.getY(k) * pull, pp.getZ(k) * (0.12 + 0.88 * puff));
    }
    pp.needsUpdate = true;
    geo.computeVertexNormals();
    const p = new THREE.Mesh(geo, [pillowReverse, pillowReverse, pillowReverse, pillowReverse, m.redPillow, pillowReverse]);
    p.castShadow = p.receiveShadow = true;
    p.rotation.order = 'YXZ';
    p.rotation.set(rx, ry, rz);
    p.position.set(px, SEAT + P / 2 - 0.02, zSeatBack + 0.085);
    g.add(p);
  }

  // grey printed throw: one sheet bunched lengthwise on the seat's right two-thirds, its front
  // spilling over the cushion edge and frame (photos 176/177/214)
  const throwGeo = clothSurface(48, 36, (s, t) => {
    const x = 1.3 + s * 1.0;
    const bunch = Math.max(0, Math.sin(t * 15 + 1.8 * Math.sin(s * 4.5))) ** 1.5;
    const lift = 0.006 + 0.028 * bunch * (1 - 0.6 * s);
    let y: number;
    let z: number;
    if (t < 0.62) {
      const k = t / 0.62;
      z = -2.33 + k * (zFront + 0.006 - 0.04 + 2.33);
      y = SEAT + 0.012 + lift;
    } else if (t < 0.74) {
      const k = (t - 0.62) / 0.12;
      const a = k * Math.PI / 2;
      z = zFront + 0.006 - 0.04 + Math.sin(a) * 0.05;
      y = SEAT - 0.03 + Math.cos(a) * 0.042 + lift * (1 - k);
    } else {
      const k = (t - 0.74) / 0.26;
      z = zFront + 0.016 + 0.012 * Math.abs(Math.sin(s * 9));
      y = SEAT - 0.03 - k * 0.2 * (0.75 + 0.25 * Math.sin(s * 3.1));
    }
    return v3(x + 0.008 * Math.sin(t * 9 + s * 3), y, z);
  }, 0.003);
  const tm = mesh(throwGeo, m.throwMat);
  tm.name = 'settee-throw';
  g.add(tm);

  g.userData.physics = { type: 'static' };
  void ctxU;
  return g;
}

/** flat piped ring (rounded rectangle) at height y in a group's local space */
function roundedRing(w: number, d: number, tube: number, mat: THREE.Material, y: number) {
  const pts: [number, number, number][] = [];
  const r = 0.05;
  const hw = Math.max(0.001, w / 2 - r), hd = Math.max(0.001, d / 2 - r);
  const corners: [number, number, number][] = [[hw, hd, 0], [-hw, hd, Math.PI / 2], [-hw, -hd, Math.PI], [hw, -hd, Math.PI * 1.5]];
  for (const [cx, cz, a0] of corners) {
    for (let k = 0; k <= 6; k++) {
      const a = a0 + (k / 6) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]);
    }
  }
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), true, 'centripetal');
  return mesh(new THREE.TubeGeometry(curve, 90, tube, 6, true), mat);
}

/**
 * Rolling reversible whiteboard. Wide-baseline photos 177/217 put the top-left at
 * (1.026,1.665,-1.756), 14 mm ray gap, and left pivot (.987,1.288,-1.749), 48 mm gap.
 * Photos 11/217 alone give a spurious ~14 cm forward tilt: their nearly parallel rays make
 * depth unstable despite small ray gaps. The edge-on photo 177 establishes a vertical panel.
 * The marker shelf is a separate stand cross-member at ~.60 m, NOT attached to the panel bottom.
 */
export function buildWhiteboard(m: LoungeMats) {
  const g = new THREE.Group();
  g.name = 'rolling-whiteboard';
  const boardW = 1.18, boardH = 0.80, pivotY = 1.265;
  const panel = new THREE.Group();
  panel.name = 'reversible-whiteboard-panel';
  panel.position.y = pivotY;
  // Vertical, as directly established by the edge-on photo 177.
  panel.add(at(mesh(new THREE.PlaneGeometry(boardW, boardH), m.board), 0, 0, 0.016));
  panel.add(at(rbox(boardW + 0.01, boardH + 0.01, 0.028, 0.004, m.boardBack, 1), 0, 0, -0.006));
  for (const s of [-1, 1]) {
    panel.add(at(rbox(boardW + 0.024, 0.018, 0.032, 0.004, m.alu, 2), 0, s * (boardH / 2 + 0.009), 0));
    panel.add(at(rbox(0.018, boardH + 0.036, 0.032, 0.004, m.alu, 2), s * (boardW / 2 + 0.013), 0, 0));
    for (const sy of [-1, 1]) panel.add(at(rbox(0.025, 0.025, 0.034, 0.004, m.markerBlack, 2), s * (boardW / 2 + 0.008), sy * (boardH / 2 + 0.005), 0));
  }
  // White marker parked vertically in its white clip at the upper left (photos 11/177/217).
  panel.add(at(cyl(0.008, 0.008, 0.16, m.ceilingWhite, 12), -boardW / 2 + 0.018, boardH / 2 - 0.04, 0.035));
  panel.add(at(cyl(0.009, 0.009, 0.035, m.markerBlack, 12), -boardW / 2 + 0.018, boardH / 2 + 0.03, 0.035));
  panel.add(at(rbox(0.055, 0.013, 0.028, 0.003, m.ceilingWhite, 2), -boardW / 2 + 0.019, boardH / 2 - 0.01, 0.035));
  g.add(panel);

  const postX = [-boardW / 2 - 0.045, boardW / 2 + 0.045];
  const shelfY = 0.605;
  g.add(at(rbox(postX[1] - postX[0], 0.025, 0.075, 0.003, m.alu, 2), 0, shelfY, 0.045));
  g.add(at(rbox(boardW + 0.045, 0.012, 0.012, 0.002, m.steel, 2), 0, shelfY + 0.015, 0.080));
  [m.markerGreen, m.markerBlack, m.markerBlue, m.markerGreen, m.markerOrange].forEach((cap, i) => {
    const x = -0.46 + i * 0.19;
    g.add(rod([x, shelfY + 0.021, 0.048], [x + 0.12, shelfY + 0.021, 0.048], 0.007, m.ceilingWhite));
    g.add(rod([x, shelfY + 0.021, 0.048], [x + 0.026, shelfY + 0.021, 0.048], 0.008, cap));
  });
  for (const px of postX) {
    g.add(at(rbox(0.032, 1.60, 0.032, 0.003, m.alu, 2), px, 0.88, 0));
    g.add(at(rbox(0.040, 0.032, 0.66, 0.004, m.alu, 2), px, 0.063, 0.01));
    for (const dz of [-0.30, 0.32]) {
      const caster = new THREE.Group();
      const wheel = cyl(0.021, 0.021, 0.018, m.rubber, 14);
      wheel.rotation.z = Math.PI / 2;
      caster.add(wheel);
      caster.add(at(rbox(0.027, 0.012, 0.035, 0.002, m.alu, 1), 0, 0.022, 0));
      g.add(at(caster, px, 0.023, dz));
    }
    // Side-axis pivot discs and the downward locking lever, not a vertical height-clamp.
    g.add(rod([px - 0.027, pivotY, 0], [px + 0.027, pivotY, 0], 0.033, m.markerBlack));
    const outward = Math.sign(px);
    g.add(rod([px + outward * 0.035, pivotY, 0.010], [px + outward * 0.095, pivotY - 0.008, 0.025], 0.012, m.markerBlack));
    g.add(rod([px + outward * 0.095, pivotY - 0.008, 0.025], [px + outward * 0.095, pivotY - 0.105, 0.040], 0.011, m.markerBlack));
    // The small adjustment holes visible down the front of each aluminium upright.
    for (const y of [0.15, 0.18, 0.21, 0.24, 0.52, 0.55]) {
      const hole = mesh(new THREE.CircleGeometry(0.0025, 8), m.blackMetal);
      g.add(at(hole, px, y, 0.0165));
    }
  }
  g.add(at(rbox(postX[1] - postX[0], 0.025, 0.030, 0.003, m.alu, 2), 0, 0.14, 0));
  g.position.set(1.62, 0, -1.765);
  g.rotation.y = 0.02;
  g.userData.physics = { type: 'static' };
  return g;
}

/** Open cardboard shipping box with rigid teal packaging inside (photos 11/217). */
export function buildCardboardBox(m: LoungeMats) {
  const g = new THREE.Group();
  g.name = 'lounge-cardboard-box';
  const W = 0.46, D = 0.34, H = 0.50, t = 0.006;
  const box = new THREE.Group();
  // sides
  for (const [w, h, d, x, y, z] of [
    [W, H, t, 0, H / 2, -D / 2 + t / 2],
    [W, H, t, 0, H / 2, D / 2 - t / 2],
    [t, H, D, -W / 2 + t / 2, H / 2, 0],
    [t, H, D, W / 2 - t / 2, H / 2, 0],
    [W, t, D, 0, t / 2, 0],
  ] as const) {
    box.add(at(rbox(w, h, d, 0.002, m.card, 1), x, y, z));
  }
  // open flaps
  for (const [w, d, x, z, rx] of [[W, 0.15, 0, -D / 2 - 0.02, -1.15], [W, 0.15, 0, D / 2 + 0.02, 1.15]] as const) {
    const flap = at(rbox(w, 0.004, d, 0.002, m.card, 1), x, H + 0.06, z);
    flap.rotation.x = rx;
    box.add(flap);
  }
  for (const [sx] of [[-1], [1]] as const) {
    const flap = at(rbox(0.15, 0.004, D, 0.002, m.card, 1), sx * (W / 2 + 0.02), H + 0.05, 0);
    flap.rotation.z = sx * 1.1;
    box.add(flap);
  }
  // Photo 11 resolves straight folded carton edges and a dark slot, not teal cloth.
  const teal = new THREE.MeshStandardMaterial({ color: '#126575', roughness: 0.86 });
  box.add(at(rbox(0.28, 0.40, 0.24, 0.003, teal, 2), 0.035, 0.265, -0.005));
  box.add(at(rbox(0.10, 0.012, 0.003, 0.002, m.blackMetal, 1), 0.035, 0.43, 0.116));
  box.add(at(rbox(0.003, 0.38, 0.242, 0.001, m.cardTape, 1), -0.015, 0.265, -0.005));
  at(box, 0.6, 0, -2.2, 0.18); // its east edge stays clear of the settee's west arm (x 0.88)
  g.add(box);
  g.userData.physics = { type: 'static' };
  return g;
}

/** round sunburst mirror on wall 1 (photos 176, 177, 214, 215) */
export function buildMirror(m: LoungeMats) {
  const g = new THREE.Group();
  g.name = 'round-mirror';
  const R = 0.40;
  const rim = mesh(new THREE.TorusGeometry(R - 0.006, 0.011, 8, 64), m.mirrorFrame);
  g.add(rim);
  // mosaic plate behind the ring of circles
  const plate = cyl(R - 0.012, R - 0.012, 0.012, m.mirrorMosaic, 64);
  plate.rotation.x = Math.PI / 2;
  at(plate, 0, 0, 0.004);
  g.add(plate);
  // two concentric rings of overlapping circles (the scalloped mosaic frame in photos 176/214)
  const ringN = 16;
  for (let i = 0; i < ringN; i++) {
    const a = (i / ringN) * Math.PI * 2;
    const t = mesh(new THREE.TorusGeometry(0.058, 0.0115, 7, 22), m.mirrorFrame);
    t.position.set(Math.cos(a) * (R - 0.072), Math.sin(a) * (R - 0.072), 0.017);
    g.add(t);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26;
    const t = mesh(new THREE.TorusGeometry(0.044, 0.009, 7, 20), m.mirrorMosaic);
    t.position.set(Math.cos(a) * (R - 0.175), Math.sin(a) * (R - 0.175), 0.019);
    g.add(t);
  }
  // inner mirror glass + a thin inner ring
  const glass = cyl(R - 0.15, R - 0.15, 0.006, m.mirrorGlass, 56);
  glass.rotation.x = Math.PI / 2;
  at(glass, 0, 0, 0.012);
  g.add(glass);
  const inner = mesh(new THREE.TorusGeometry(R - 0.145, 0.014, 7, 56), m.mirrorFrame);
  inner.position.z = 0.016;
  g.add(inner);
  g.userData.physics = { type: 'static' };
  return g;
}

/** four-panel woven room divider in front of the wall-3 doorway (photos 137, 177, 10) */
export function buildDivider(m: LoungeMats) {
  const g = new THREE.Group();
  g.name = 'woven-divider';
  const PW = 0.45, PH = 1.80;
  const frame = 0.022;
  const fieldT = 0.012;   // real thickness: the fold has to read in the silhouette
  const panel = () => {
    const p = new THREE.Group();
    // woven field, three sections separated by pale woven straps
    const bandH = 0.05;
    const sectH = (PH - frame * 2 - bandH * 2) / 3;
    for (let i = 0; i < 3; i++) {
      const y = frame + sectH * (i + 0.5) + bandH * i;
      // thin box rather than a plane: the weave has a front and a back, and the folded
      // edges catch the light instead of reading as a flat brown card
      const field = mesh(new THREE.BoxGeometry(PW - frame * 2, sectH, fieldT), m.wicker);
      at(field, 0, y, 0);
      p.add(field);
    }
    for (let i = 0; i < 2; i++) {
      const y = frame + sectH * (i + 1) + bandH * (i + 0.5);
      p.add(at(rbox(PW - frame * 2, bandH, 0.009, 0.001, m.wickerPale, 1), 0, y, 0));
      // pale strap is a doubled woven band: a fine seam line above and below
      for (const dy of [-bandH / 2 + 0.004, bandH / 2 - 0.004]) {
        p.add(at(rbox(PW - frame * 2, 0.006, 0.011, 0.001, m.wickerFrame, 1), 0, y + dy, 0));
      }
    }
    // frame
    p.add(at(rbox(PW, frame, 0.034, 0.004, m.wickerFrame, 2), 0, PH - frame / 2, 0));
    p.add(at(rbox(PW, frame, 0.034, 0.004, m.wickerFrame, 2), 0, frame / 2, 0));
    for (const sx of [-1, 1]) p.add(at(rbox(frame, PH, 0.034, 0.004, m.wickerFrame, 2), sx * (PW / 2 - frame / 2), PH / 2, 0));
    // small foot
    p.add(at(rbox(0.05, 0.03, 0.06, 0.006, m.wickerFrame, 2), 0, 0.015, 0));
    // hinge knuckles on the right edge
    for (const y of [0.5, 1.35]) p.add(at(cyl(0.008, 0.008, 0.05, m.wickerFrame, 8), PW / 2, y, 0));
    return p;
  };
  // hinge 4 panels alternately so the screen folds in front of the doorway
  let z = -2.28, x = 2.60;
  let a = 0.80;  // 46 degrees off the wall plane: the measured fold, z -2.28…-1.04
  for (let i = 0; i < 4; i++) {
    const p = panel();
    p.rotation.y = -Math.PI / 2 + a * (i % 2 === 0 ? 1 : -1);
    // panel local x runs along the wall; place its left edge at (x,z)
    const dirx = Math.cos(p.rotation.y), dirz = -Math.sin(p.rotation.y);
    p.position.set(x + dirx * PW / 2, 0, z + dirz * PW / 2);
    g.add(p);
    x += dirx * PW;
    z += dirz * PW;
  }
  g.userData.physics = { type: 'static' };
  return g;
}

/** clear acrylic chair against wall 3 (photos 137, 177) */
export function buildAcrylicChair(m: LoungeMats) {
  const g = new THREE.Group();
  g.name = 'acrylic-chair';
  const seatY = 0.445;
  // molded clear seat pan
  const seat = rbox(0.46, 0.032, 0.44, 0.045, m.acrylic, 3);
  at(seat, 0, seatY, 0);
  g.add(seat);
  // bowed clear back with rounded shoulders
  const backShape = new THREE.Shape();
  backShape.moveTo(-0.225, 0);
  backShape.lineTo(0.225, 0);
  backShape.quadraticCurveTo(0.238, 0.02, 0.232, 0.06);
  backShape.lineTo(0.222, 0.33);
  backShape.quadraticCurveTo(0.216, 0.40, 0.15, 0.405);
  backShape.lineTo(-0.15, 0.405);
  backShape.quadraticCurveTo(-0.216, 0.40, -0.222, 0.33);
  backShape.lineTo(-0.232, 0.06);
  backShape.quadraticCurveTo(-0.238, 0.02, -0.225, 0);
  const backG = new THREE.ExtrudeGeometry(backShape, {
    depth: 0.014, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.005, bevelSegments: 2, curveSegments: 8,
  });
  const back = mesh(backG, m.acrylic);
  at(back, 0, seatY + 0.02, -0.225);
  back.rotation.x = -0.13;
  g.add(back);
  // chrome under-seat frame + four splayed legs
  for (const sz of [-1, 1]) g.add(rod([-0.19, seatY - 0.032, sz * 0.17], [0.19, seatY - 0.032, sz * 0.17], 0.007, m.chrome));
  for (const sx of [-1, 1]) g.add(rod([sx * 0.19, seatY - 0.032, -0.17], [sx * 0.19, seatY - 0.032, 0.17], 0.007, m.chrome));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const top = v3(sx * 0.185, seatY - 0.03, sz * 0.165);
    const bot = v3(sx * 0.21, 0.008, sz * 0.20);
    g.add(rod([top.x, top.y, top.z], [bot.x, bot.y, bot.z], 0.0105, m.chrome));
    g.add(at(cyl(0.013, 0.013, 0.011, m.rubber, 8), bot.x, 0.0055, bot.z));
  }
  at(g, 2.50, 0, -0.92, -Math.PI / 2 + 0.12);
  g.userData.physics = { type: 'static' };
  return g;
}

/**
 * Glazed green ceramic garden stool with a wooden top, beside the sofa's north arm
 * (photos 103/123/125/177): waisted drum, black brush-stroke cut-outs all round, oak lid.
 */
export function buildGardenStool(m: LoungeMats, x: number, z: number, withTop = true) {
  const g = new THREE.Group();
  g.name = 'garden-stool';
  const strokes = canvasTex(1024, 256, (c, w, h) => {
    c.fillStyle = '#5f9a6a'; c.fillRect(0, 0, w, h);
    const r = rng(17);
    // irregular vertical leaf strokes, two staggered bands, tapering at both ends
    for (let band = 0; band < 2; band++) {
      for (let i = 0; i < 22; i++) {
        const cx = (i + band * 0.5 + (r() - 0.5) * 0.3) * (w / 22);
        const cy = h * (band ? 0.66 : 0.3) + (r() - 0.5) * h * 0.06;
        const len = h * (0.18 + r() * 0.1), wid = 5 + r() * 6;
        c.save(); c.translate(cx, cy); c.rotate((r() - 0.5) * 0.5);
        c.fillStyle = '#121513';
        c.beginPath(); c.ellipse(0, 0, wid, len / 2, 0, 0, Math.PI * 2); c.fill();
        c.restore();
      }
    }
    // glaze pooling: lighter crown near the shoulders
    const gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  });
  const glaze = new THREE.MeshPhysicalMaterial({ map: strokes, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2, name: 'garden-stool-glaze' });
  // waisted barrel body
  const body = lathe([
    [0.145, 0.0], [0.16, 0.012], [0.176, 0.06], [0.183, 0.14], [0.186, 0.23],
    [0.183, 0.32], [0.176, 0.375], [0.182, 0.405], [0.188, 0.42], [0.175, 0.425],
    [0.162, 0.42], [0.156, 0.41],
  ], glaze, 48);
  g.add(body);
  // top rim
  g.add(at(cyl(0.165, 0.165, 0.014, m.gardenGreen, 40), 0, 0.418, 0));
  if (withTop) {
    const top = lathe([[0, 0], [0.185, 0.0], [0.2, 0.008], [0.202, 0.03], [0.196, 0.042], [0.188, 0.03], [0.182, 0.012], [0, 0.01]], m.oak, 48);
    top.position.y = 0.418;
    g.add(top);
  }
  at(g, x, 0, z);
  g.userData.physics = { type: 'static' };
  return g;
}

/**
 * Openwork woven pouf in front of the sofa's north arm (photos 103/125): a tan barrel pierced all
 * over with staggered round holes, a dark hollow showing through them, and a woven top.
 */
export function buildRattanPouf(m: LoungeMats, x: number, z: number) {
  const g = new THREE.Group();
  g.name = 'rattan-pouf';
  const holes = (cols: number, rows: number) => {
    const t = canvasTex(1024, 512, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#000000';
      const cw = w / cols, ch = h / rows;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        c.beginPath();
        c.arc((i + 0.5 + (j % 2) * 0.5) * cw, (j + 0.5) * ch, Math.min(cw, ch) * 0.3, 0, Math.PI * 2);
        c.fill();
      }
    });
    t.colorSpace = THREE.NoColorSpace;
    return t;
  };
  const weave = new THREE.MeshStandardMaterial({
    color: '#c8ad7f', roughness: 0.85, alphaMap: holes(46, 14), alphaTest: 0.5, side: THREE.DoubleSide,
    normalMap: m.textures.weaveNor, normalScale: new THREE.Vector2(0.5, 0.5), name: 'pouf-weave',
  });
  const profile: [number, number][] = [
    [0.13, 0.0], [0.155, 0.02], [0.178, 0.07], [0.19, 0.13], [0.192, 0.19],
    [0.185, 0.245], [0.172, 0.285], [0.158, 0.30], [0.14, 0.298],
  ];
  g.add(lathe(profile, weave, 64));
  // the hollow behind the holes: a darker shell just inside
  const inner = lathe(profile.map(([r, y]) => [r * 0.93, y] as [number, number]), new THREE.MeshStandardMaterial({ color: '#4a3a26', roughness: 1, side: THREE.DoubleSide }), 32);
  g.add(inner);
  // woven top: same openwork on a disc, over the dark interior
  const topHoles = holes(18, 18);
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.142, 48), new THREE.MeshStandardMaterial({
    color: '#c8ad7f', roughness: 0.85, alphaMap: topHoles, alphaTest: 0.5, side: THREE.DoubleSide,
  }));
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.299;
  g.add(top);
  g.add(at(cyl(0.13, 0.13, 0.004, new THREE.MeshStandardMaterial({ color: '#4a3a26', roughness: 1 }), 32), 0, 0.29, 0));
  g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.142, 0.007, 8, 64), m.rattanSolid), 0, 0.299, 0).rotateX(Math.PI / 2));
  at(g, x, 0, z);
  g.userData.physics = { type: 'static' };
  return g;
}
