import * as THREE from 'three';
import { at, cyl, mesh, rbox, tube } from './_moe-kit';
import type { FireplaceMats } from './_fireplace-mats';

/**
 * The television on its rolling floor stand (RoomPlan object 6, photos 0–5, 172, 192, 193).
 *
 * Retains the preceding pass's matched-photo panel fit: 1.16 × .655 m, centre y=1.28,
 * yaw .12. Photo 172 confirms its four outer corners without another size/yaw adjustment.
 * Photos 0/192 show a round black column and an adjustment collar ~.15 m BELOW the screen,
 * separate from the VESA hardware behind the panel. The low rolling base is mostly occluded;
 * its dimensions remain the preceding pass's approximation.
 *
 * Local frame: +x across the panel, +y up, +z out of the screen, origin at the panel's centre.
 */
export const TV = {
  centre: new THREE.Vector3(-1.47, 1.28, -2.44),
  yaw: 0.12,
  panel: { w: 1.16, h: 0.655, d: 0.038 },
  bezel: 0.008,
  column: 0.042,
  base: { w: 0.44, d: 0.27, t: 0.026 },
  castorY: 0.028,
};

export function buildTv(m: FireplaceMats) {
  const g = new THREE.Group();
  g.name = 'tv-on-floor-stand';
  g.position.copy(TV.centre);
  g.rotation.y = TV.yaw;

  const { w, h, d } = TV.panel;
  const panel = new THREE.Group();
  panel.name = 'tv-panel';

  // body: a thin slab, matte black on the back, glossy at the front
  panel.add(at(rbox(w, h, d, 0.010, m.tvBody, 3), 0, 0, -d / 2));
  // 8 mm bezel: four bars so the glass sits 1 mm proud of them
  const b = TV.bezel;
  const bar = (bw: number, bh: number, x: number, y: number) =>
    panel.add(at(rbox(bw, bh, 0.007, 0.0022, m.tvBezel, 2), x, y, -0.0015));
  bar(w, b, 0, h / 2 - b / 2);
  bar(w, b, 0, -h / 2 + b / 2);
  bar(b, h - b * 2, -w / 2 + b / 2, 0);
  bar(b, h - b * 2, w / 2 - b / 2, 0);
  // dark glass + the painted pot-light reflection (0.5 mm in front so it never z-fights)
  const glass = mesh(new THREE.PlaneGeometry(w - b * 2, h - b * 2), m.tvGlass, 'tv-screen');
  at(glass, 0, 0, 0.0012);
  glass.receiveShadow = false;
  glass.castShadow = false;
  panel.add(glass);
  const refl = mesh(new THREE.PlaneGeometry(w - b * 2, h - b * 2), m.tvReflection, 'tv-reflection');
  at(refl, 0, 0, 0.0024);
  refl.receiveShadow = false;
  refl.castShadow = false;
  panel.add(refl);
  panel.traverse(o => {
    const mm = o as THREE.Mesh;
    if (mm.isMesh) { mm.receiveShadow = false; }
  });
  g.add(panel);

  // --- VESA mount behind the panel; separate height-adjustment collar below (0/192). ---
  const clampY = -0.48;
  panel.add(at(rbox(0.28, 0.11, 0.014, 0.003, m.standBlack, 2), 0, -0.10, -0.052));
  for (const s of [-1, 1]) {
    panel.add(at(rbox(0.028, 0.28, 0.010, 0.003, m.standBlack, 2), s * 0.12, -0.10, -0.048));
    const screw = cyl(0.004, 0.004, 0.008, m.chrome, 8);
    screw.rotation.x = Math.PI / 2;
    at(screw, s * 0.045, clampY, -0.077);
    panel.add(screw);
  }
  g.add(at(rbox(0.11, 0.075, 0.048, 0.004, m.standBlack, 2), 0, clampY, -0.115));

  // --- column + base ------------------------------------------------------------------------
  const colZ = -0.115;
  const colTop = -0.02;
  const colBottom = TV.castorY + TV.base.t - TV.centre.y;
  const colH = colTop - colBottom;
  const column = cyl(TV.column / 2, TV.column / 2, colH, m.standBlack, 24);
  at(column, 0, (colTop + colBottom) / 2, colZ);
  g.add(column);
  // a satin sleeve where the column meets the clamp, and a foot collar
  g.add(at(rbox(TV.column + 0.012, 0.03, TV.column + 0.012, 0.004, m.standBlack, 2), 0, clampY + 0.02, colZ));
  g.add(at(rbox(TV.column + 0.014, 0.022, TV.column + 0.014, 0.004, m.standBlack, 2), 0, colBottom + 0.05, colZ));

  const plateY = TV.castorY + TV.base.t / 2 - TV.centre.y;
  const plate = rbox(TV.base.w, TV.base.t, TV.base.d, 0.008, m.standBlack, 2);
  at(plate, 0, plateY, colZ - 0.012);
  g.add(plate);
  // four castors tucked under the plate: dark wheels in dark yokes
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cx = sx * (TV.base.w / 2 - 0.055);
      const cz = colZ - 0.012 + sz * (TV.base.d / 2 - 0.05);
      const yoke = rbox(0.03, 0.03, 0.03, 0.004, m.standBlack, 2);
      at(yoke, cx, TV.castorY + 0.026 - TV.centre.y, cz);
      g.add(yoke);
      const wheel = cyl(0.026, 0.026, 0.018, m.rubber, 16);
      wheel.rotation.z = Math.PI / 2;
      at(wheel, cx, TV.castorY - TV.centre.y, cz);
      g.add(wheel);
    }
  }
  return g;
}

/** The panel's power lead: off the bottom edge, down the column and into the wall receptacle. */
export function buildTvCable(m: FireplaceMats) {
  const c = Math.cos(TV.yaw), s = Math.sin(TV.yaw);
  const toWorld = (x: number, y: number, z: number) => [
    TV.centre.x + x * c + z * s,
    TV.centre.y + y,
    TV.centre.z - x * s + z * c,
  ] as [number, number, number];
  const pts: [number, number, number][] = [
    toWorld(0.14, -TV.panel.h / 2 + 0.01, -0.04),
    toWorld(0.10, -0.55, -0.07),
    toWorld(0.06, -0.80, -0.10),
    [-1.34, 0.62, -2.52],
    [-1.37, 0.44, -2.66],
    [-1.385, 0.335, -2.702],
  ];
  const g = new THREE.Group();
  g.name = 'tv-cable';
  g.add(tube(pts, 0.0046, m.cableBlack, 40, 6));
  return g;
}

/** Tie-off used by the wall module for the receptacle the TV lead plugs into. */
export const TV_OUTLET = { u: -1.386 + 2.9761, v: 0.312 };
