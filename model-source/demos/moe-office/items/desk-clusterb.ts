import * as THREE from 'three';
import type { PartContext } from '../parts/types';
import {
  DEG, PED_TOP, at, box, cyl, extrude, grp, instanced, lathe, mat4, mesh, phys, polarShape, rbox, rboxGeo, rng, rod,
  sphere, std, tube, v3,
} from './_desk-clusterb-kit';
import { clusterMaterials, type CM } from './_desk-clusterb-mats';

/**
 * The clutter standing on the white five-drawer pedestal beside the west desk's window end.
 * Photos 89, 90, 91, 92 and 200 (90/92 are the closest, 89 the side elevation, 200 the front).
 *
 * IDENTIFICATION, from those five views (left to right as the room is looked at from the south,
 * which in this room frame is east -> west):
 *   1. a green scalloped printed ornament, standing on edge against the brush, with a dark printed
 *      centre (3D-printed PLA — the printer is on the next table). Photos 90/91/92/200.
 *   2. a small orange-red card/packet leaning behind it (photos 90/91).
 *   3. a clear square lotion pump bottle, ~75 % full of cream, white ribbed pump, white neck label
 *      (photo 92 shows the bottle's square section and the dip tube).
 *   4. a black soft-touch pump dispenser with a clear lower quarter showing dark product, a wide
 *      black actuator and a side nozzle (photos 90/91/92/200 — the most detailed object here).
 *   5. a dark maroon bristle tower: a hairbrush standing on its handle, tapered elliptical head
 *      with ~11 helical rows of individual filaments and a black loop finial (photo 89 is the only
 *      view that shows the handle below the head).
 *   6. a black soft-touch pen pot with six pens (photo 200 shows the rim and the crease).
 *   7. a white "WHOSON" printed aerosol with a translucent orange dome and a clear spray cap
 *      (the brand is legible in photos 91/200: vertical heavy caps + a grey text block + barcode).
 *   8. a dark printed aerosol with a black overcap and a wine band under it (photos 90/91/200).
 *   9. a flat black slab ~72 x 30 mm lying on the front edge, pale metal edge: the black "remote"
 *      the brief lists. It is flat and slim in every view, so it is modelled as its silhouette.
 *
 * MEASUREMENTS (millimetres, from the photos at the cluster's own distance; the five-drawer unit's
 * front face is the scale bar — 0.42 m wide / 0.715 m tall as built by desk-west, and its top cap
 * reaches y = 0.732, which is the surface every object stands on):
 *   1. green ornament   dia 108, thickness 13, overall height 144, leans back ~6 deg
 *   2. orange card      50 x 68 x 2.5, leaning back
 *   3. clear bottle     body 50 x 50 x 128 + shoulder/neck 14, pump stack 26, total height 170
 *   4. black pump       body dia 70, clear base 49 tall, total height 178, head 70 x 30, nozzle 24
 *   5. bristle brush    head 74 wide x 118 tall (bristle field 100), handle 100, height 226
 *   6. pen pot          dia 71, height 105; six pens 128-160 long
 *   7. WHOSON can       body dia 60 x 150, orange dome 25, clear cap 32, total height 207
 *   8. dark can         body dia 55 x 128, overcap 30, total height 161
 *   9. black slab       72 x 30 x 10
 *
 * PLACEMENT: world coordinates on the five-drawer unit's top cap (y = 0.732, x -0.996..-0.564,
 * z 2.077..2.635) — except the two aerosols, which stand on the DESK's east end (y = 0.820) just
 * west of the pedestal: hitting photo 90's base pixels on the two candidate planes puts them at
 * x -1.06 / -1.11, i.e. past the pedestal's west edge and on the desk top, which also explains why
 * their bases sit higher in the photograph than the pump's.
 *
 * Positions started from ray hits on y = 0.732 (pump -0.847/2.217, green -0.782/2.421, pot
 * -0.958/2.452) and were nudged 30 mm east / 50 mm into the room after the first matched
 * comparison; the live values are the `at(...)` calls in build() (pump -0.819/2.173, green
 * -0.752/2.386, pot -0.930/2.408).
 *
 * Scale caveat: the cluster's absolute size rests on the built pedestal (0.42 x 0.55 x 0.732).
 * Photo pixel ratios agree to about 8 %; single-photo plane hits are uncertain at the 3-4 cm level,
 * so positions are good to a couple of centimetres and sizes to ~10 mm. Do NOT judge size from a
 * `photo=N` capture frame: the stored fov behaves like a diagonal there, so such a frame renders
 * about 1.6x small and makes a correctly sized cluster read undersized — settle size by plane hits
 * or by projecting known 3D lines, never by apparent size in one frame.
 */
export async function build(_ctx: PartContext): Promise<THREE.Object3D> {
  const m = clusterMaterials();
  const g = grp('desk-clusterb');
  /** the desk's top surface: the two aerosols at the west end of the cluster stand on it */
  const DESK_TOP = 0.820;

  // Each bottle / ornament is its own knoll piece (Wes desk-gear pattern).
  g.add(phys(at(buildGreenOrnament(m), -0.752, PED_TOP, 2.386, 0.34), 0.18));
  g.add(phys(at(buildOrangeCard(m), -0.714, PED_TOP, 2.418, 0.75, -0.10), 0.02, 'box'));
  g.add(phys(at(buildClearPump(m), -0.772, PED_TOP, 2.266, 0.18), 0.25, 'box'));
  g.add(phys(at(buildBlackPump(m), -0.819, PED_TOP, 2.173, 0.45), 0.35, 'cylinder'));
  g.add(phys(at(buildBristleBrush(m), -0.877, PED_TOP, 2.456, 0.55), 0.2));
  g.add(phys(at(buildPenPot(m), -0.930, PED_TOP, 2.408, 0.05), 0.3, 'cylinder'));
  g.add(phys(at(buildWhoCan(m), -1.070, DESK_TOP, 2.190, 0.16), 0.35, 'cylinder'));
  g.add(phys(at(buildDarkCan(m), -1.120, DESK_TOP, 2.292, -0.12), 0.3, 'cylinder'));
  g.add(phys(at(buildBlackSlab(m), -0.772, PED_TOP, 2.101, 0.52), 0.08, 'box'));
  g.add(phys(buildScraps(m), 0.01, 'box'));
  return g;
}

// =====================================================================================
// 1. green scalloped printed ornament
// =====================================================================================
function buildGreenOrnament(m: CM) {
  const g = grp('cb-green-ornament');
  // the scalloped ring: 28 shallow lobes on the outside, a smooth 7-lobe swell, a round hole
  const ring = polarShape(
    a => 0.054 + 0.0018 * Math.cos(28 * a) + 0.0014 * Math.cos(7 * a + 0.6),
    200,
    () => 0.0325,
  );
  const ringMesh = extrude(ring, 0.011, m.green, 0.0022, 10);
  at(ringMesh, 0, 0.090, 0, 0, 0, 0);
  g.add(ringMesh);
  // a second, smaller scalloped bead on the ring's face (the print has two concentric rows)
  const bead = polarShape(a => 0.042 + 0.0012 * Math.cos(28 * a), 160, () => 0.0355);
  const beadMesh = extrude(bead, 0.005, m.green, 0.0010, 8);
  at(beadMesh, 0, 0.090, 0.0050, 0, 0, 0);
  g.add(beadMesh);

  // the dark olive dish behind the ring (it reads as a dark centre with a thick rim)
  const dish = lathe([[0, 0], [0.017, 0], [0.030, 0.004], [0.034, 0.010], [0.032, 0.016], [0, 0.016]], m.olive, 48);
  at(dish, 0, 0.090, -0.020, 0, Math.PI / 2, 0);
  g.add(dish);
  const dishRim = lathe([[0.030, 0], [0.0345, 0.001], [0.0345, 0.004], [0.030, 0.005], [0.030, 0]], m.greenDark, 48);
  at(dishRim, 0, 0.090, -0.010, 0, Math.PI / 2, 0);
  g.add(dishRim);

  // printed centre: a shallow disc with the mottled print on its face
  const print = cyl(0.0300, 0.0300, 0.004, [m.olive, m.ornPrint, m.ornPrint], 48);
  at(print, 0, 0.090, -0.0035, 0, Math.PI / 2, 0);
  g.add(print);

  // the black "eye" and the warm fleck that read through the ring's opening
  g.add(at(sphere(0.0062, m.blackMatte, 16, 12), 0.0125, 0.098, 0.0035));
  g.add(at(sphere(0.0042, m.orange, 14, 10), -0.011, 0.086, 0.0035));
  g.add(at(sphere(0.0026, m.labelWhite, 10, 8), 0.011, 0.1085, 0.004));

  // the scalloped green fronds that hang down the left and right of the ring
  const leaf = (sx: number, sy: number, rot: number, size: number) => {
    const pts: [number, number][] = [];
    const N = 26;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const w = 0.010 * Math.sin(Math.PI * Math.pow(t, 0.75)) * (1 + 0.34 * Math.cos(9 * Math.PI * t));
      pts.push([t * 0.062 * size, w]);
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N;
      const w = 0.010 * Math.sin(Math.PI * Math.pow(t, 0.75)) * (1 + 0.34 * Math.cos(9 * Math.PI * t));
      pts.push([t * 0.062 * size, -w]);
    }
    const s = extrude(pts, 0.008, m.green, 0.0016, 6);
    return at(s, sx, sy, -0.006, 0, 0, rot);
  };
  g.add(leaf(-0.040, 0.052, 1.15, 1.05));
  g.add(leaf(0.036, 0.046, -0.85, 0.95));
  g.add(leaf(0.010, 0.030, -0.25, 0.72));

  // a small foot so the ring stands rather than floats
  g.add(at(rbox(0.030, 0.010, 0.020, 0.003, m.green, 2), 0, 0.005, -0.004, 0.2));
  return g;
}

// =====================================================================================
// 2. orange card / packet behind the ornament
// =====================================================================================
function buildOrangeCard(m: CM) {
  const g = grp('cb-orange-card');
  g.add(at(rbox(0.050, 0.068, 0.0026, 0.0012, m.orangeCard, 2), 0, 0.034, 0));
  g.add(at(rbox(0.049, 0.010, 0.0028, 0.0012, m.darkGrey, 2), 0, 0.010, 0.0004));
  const spot = cyl(0.0055, 0.0055, 0.001, m.blackMatte, 16);
  at(spot, 0.008, 0.050, 0.0018, 0, Math.PI / 2, 0);
  g.add(spot);
  return g;
}

// =====================================================================================
// 3. clear lotion pump bottle, cream filled
// =====================================================================================
function buildClearPump(m: CM) {
  const g = grp('cb-clear-pump');
  // square body with soft corners (a rounded box reads as the moulded PET bottle in photo 92)
  g.add(at(rbox(0.050, 0.125, 0.050, 0.009, m.clearPET, 4), 0, 0.0625, 0));
  // the cream fill, with a flat meniscus at ~72 %
  g.add(at(rbox(0.0435, 0.089, 0.0435, 0.007, m.cream, 3), 0, 0.048, 0));
  // the fill line: a bright meniscus ring where the cream meets the clear wall
  g.add(at(rbox(0.0442, 0.0022, 0.0442, 0.006, m.labelWhite, 3), 0, 0.0925, 0));
  // shoulder: a round taper into the neck (photo 92 shows a moulded rounded shoulder)
  g.add(lathe([[0.0255, 0.124], [0.0252, 0.128], [0.0225, 0.1335], [0.0175, 0.1385], [0.0142, 0.1415], [0, 0.1415]], m.clearPET, 28));
  g.add(at(cyl(0.0140, 0.0150, 0.012, m.clearPET, 24), 0, 0.147, 0));
  // white neck label band, with its two printed rules
  g.add(at(rbox(0.0503, 0.017, 0.0503, 0.0090, m.labelWhite, 3), 0, 0.1145, 0));
  g.add(at(box(0.047, 0.0014, 0.0012, m.greyPlastic), 0, 0.1185, 0.0252));
  g.add(at(box(0.034, 0.0011, 0.0012, m.darkGrey), 0, 0.1155, 0.0252));
  g.add(at(rbox(0.0508, 0.004, 0.0508, 0.0095, m.greyPlastic, 3), 0, 0.093, 0));
  // ribbed white collar
  g.add(at(cyl(0.0142, 0.0142, 0.017, m.ribCollar, 24), 0, 0.158, 0));
  g.add(at(cyl(0.0148, 0.0148, 0.0035, m.whiteGloss, 24), 0, 0.1505, 0));
  // actuator: a small block head with a spout to the west
  const head = grp('cb-clear-pump-head');
  head.add(at(rbox(0.021, 0.013, 0.017, 0.0045, m.whiteGloss, 3), 0, 0.1735, 0));
  head.add(at(rbox(0.010, 0.009, 0.013, 0.003, m.whiteGloss, 2), -0.014, 0.1715, 0));
  head.add(at(cyl(0.0034, 0.0034, 0.012, m.whiteGloss, 12), -0.022, 0.1705, 0, 0, 0, Math.PI / 2));
  head.add(at(cyl(0.0016, 0.0016, 0.004, m.darkGrey, 8), -0.0285, 0.1705, 0, 0, 0, Math.PI / 2));
  g.add(head);
  // dip tube down the middle
  g.add(at(cyl(0.0019, 0.0019, 0.118, m.clearPET, 10), 0, 0.088, 0));
  return g;
}

// =====================================================================================
// 4. black pump dispenser (soft-touch body, clear product base)
// =====================================================================================
function buildBlackPump(m: CM) {
  const g = grp('cb-black-pump');
  // clear base: a straight-walled translucent cylinder with a moulded foot, a hair proud of the sleeve
  g.add(lathe([
    [0, 0.0015], [0.0285, 0.0015], [0.0342, 0.005], [0.0356, 0.013], [0.0356, 0.030],
    [0.0356, 0.046], [0.0346, 0.0492], [0, 0.0492],
  ], m.clearThick, 40));
  // the product inside: dark for the upper two thirds, thinning to clear at the foot
  g.add(lathe([[0, 0.003], [0.0305, 0.003], [0.0324, 0.008], [0.0324, 0.036], [0.0302, 0.0440], [0, 0.0440]], m.productFade, 32));
  g.add(lathe([[0, 0.011], [0.0318, 0.011], [0.0324, 0.018], [0.0318, 0.038], [0.0282, 0.0440], [0, 0.0440]], m.productDark, 32));
  // shiny moulded ring where the clear resin meets the black sleeve
  g.add(at(cyl(0.0362, 0.0362, 0.0085, m.blackGloss, 40), 0, 0.0525, 0));
  // soft-touch body with a gentle shoulder
  g.add(lathe([
    [0.0348, 0.0565], [0.0350, 0.064], [0.0350, 0.130], [0.0346, 0.148],
    [0.0322, 0.158], [0.0272, 0.165], [0.0205, 0.1695], [0, 0.1695],
  ], m.blackSoft, 44));
  // seam ring where the sleeve was moulded, and the thread collar
  g.add(at(cyl(0.0352, 0.0352, 0.0016, m.blackGloss, 40), 0, 0.0995, 0));
  g.add(at(cyl(0.0182, 0.0182, 0.0075, m.blackGloss, 24), 0, 0.1725, 0));
  g.add(at(cyl(0.0198, 0.0198, 0.0022, m.blackGloss, 24), 0, 0.1697, 0));
  // a compact actuator: a short skirt with a domed shoulder and a flat top, as in photos 90/92
  const head = lathe([
    [0, 0.1755], [0.0180, 0.1755], [0.0255, 0.1770], [0.0278, 0.1800],
    [0.0280, 0.1875], [0.0268, 0.1915], [0.0225, 0.1955], [0.0140, 0.1982], [0, 0.1990],
  ], m.blackGloss, 40);
  head.scale.set(1, 1, 0.80);
  g.add(head);
  // the nozzle spout, angled down and toward -x
  const spout = grp('cb-black-pump-spout');
  spout.add(at(cyl(0.0040, 0.0062, 0.016, m.blackGloss, 14), 0.0080, 0.0012, 0, 0, 0, Math.PI / 2));
  spout.add(at(cyl(0.0034, 0.0040, 0.006, m.blackGloss, 14), 0.0180, 0.0004, 0, 0, 0, Math.PI / 2));
  at(spout, 0.0215, 0.1875, 0, 0, 0, -0.22);
  g.add(spout);
  // air hole on the actuator's top face
  g.add(at(cyl(0.0020, 0.0020, 0.0016, m.blackMatte, 12), -0.007, 0.1988, 0));
  // dip tube, visible through the clear foot
  g.add(at(cyl(0.0021, 0.0021, 0.155, m.clearPET, 10), 0.0015, 0.095, 0));
  return g;
}

// =====================================================================================
// 5. bristle tower (hairbrush on its handle)
// =====================================================================================
function buildBristleBrush(m: CM) {
  const g = grp('cb-bristle-brush');
  // handle: a flat tapered blade, rounded at the foot
  const blade: [number, number][] = [
    [0.0, 0.0], [0.0085, 0.0], [0.0115, 0.010], [0.0125, 0.030], [0.0115, 0.055],
    [0.0100, 0.080], [0.0092, 0.100], [-0.0092, 0.100], [-0.0100, 0.080],
    [-0.0115, 0.055], [-0.0125, 0.030], [-0.0115, 0.010], [-0.0085, 0.0],
  ];
  const handle = extrude(blade, 0.0115, m.blackGloss, 0.0018, 8);
  at(handle, 0, 0, 0);
  g.add(handle);
  // collar between handle and head
  g.add(at(rbox(0.020, 0.016, 0.0135, 0.003, m.brushCore, 2), 0, 0.104, 0));
  // tapered elliptical head core
  const core = lathe([
    [0.0100, 0.108], [0.0158, 0.120], [0.0210, 0.140], [0.0228, 0.162],
    [0.0218, 0.182], [0.0180, 0.198], [0.0126, 0.210], [0.0066, 0.2195], [0, 0.2225],
  ], m.brushCore, 28);
  core.scale.set(1, 1, 0.62);
  g.add(core);
  // bristles: 13 helical rows of individual filaments
  const fila = new THREE.ConeGeometry(0.00105, 0.0170, 5, 1, true);
  fila.translate(0, 0.0085, 0);
  const tipGeo = new THREE.SphereGeometry(0.00105, 6, 4);
  const rows = 13;
  const per = 20;
  const filMats: THREE.Matrix4[] = [];
  const tipMats: THREE.Matrix4[] = [];
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    const y = 0.116 + t * 0.096;
    // core radius at this height: a parabola through the lathe profile's stations
    const cr = Math.max(0.006, 0.0228 - 4.4 * Math.pow(0.096 * t - 0.046, 2));
    const len = 0.0165 * (1 - 0.42 * Math.pow(t, 2.2));
    const spin = r * 0.40;
    for (let k = 0; k < per; k++) {
      const a = (k / per) * Math.PI * 2 + spin;
      // elliptical section: the head is flattened front-to-back
      const x = Math.cos(a), z = Math.sin(a) * 0.62;
      const nx = x / Math.hypot(x, z), nz = z / Math.hypot(x, z);
      const rr = cr * 0.80;
      const px = nx * rr, pz = nz * rr * 0.62;
      // point the filament radially outward, with a slight upward tilt
      const dir = v3(nx, 0.26, nz).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), dir);
      const scl = len / 0.017;
      filMats.push(new THREE.Matrix4().compose(v3(px, y, pz), q, v3(1, scl, 1)));
      tipMats.push(new THREE.Matrix4().compose(
        v3(px + dir.x * len * 0.97, y + dir.y * len * 0.97, pz + dir.z * len * 0.97), q, v3(1, 1, 1),
      ));
    }
  }
  g.add(instanced(fila, m.bristle, filMats, 'cb-bristles'));
  g.add(instanced(tipGeo, m.bristleTip, tipMats, 'cb-bristle-tips'));
  // black loop finial: a small pad with a standing eye, as in photos 89/200
  g.add(at(lathe([[0, 0.2195], [0.0075, 0.2205], [0.0085, 0.2265], [0.0050, 0.2300], [0, 0.2305]], m.brushCore, 20), 0, 0, 0));
  const loop = mesh(new THREE.TorusGeometry(0.0058, 0.0021, 8, 18), m.brushCore);
  at(loop, 0, 0.237, 0, 0, 0, 0);
  g.add(loop);
  // the loose grey flake that leans against the bristles (unidentified; modelled as its silhouette)
  const flake = extrude([[0, 0], [0.024, 0.002], [0.026, 0.005], [0.020, 0.0075], [0, 0.0055]], 0.0022, m.darkGrey, 0.0006, 4);
  at(flake, -0.020, 0.150, 0.014, -0.7, 0, 0.25);
  g.add(flake);
  return g;
}

// =====================================================================================
// 6. pen pot
// =====================================================================================
function buildPenPot(m: CM) {
  const g = grp('cb-pen-pot');
  g.add(lathe([
    [0, 0], [0.0300, 0], [0.0340, 0.004], [0.0355, 0.012], [0.0366, 0.055],
    [0.0372, 0.090], [0.0362, 0.0955], [0.0344, 0.0975], [0.0318, 0.0975], [0.0312, 0.090], [0, 0.090],
  ], m.blackSoftPot, 40));
  // rolled rim, a touch lighter so the pot's opening reads
  const rim = mesh(new THREE.TorusGeometry(0.0355, 0.0034, 8, 36), m.potRim);
  at(rim, 0, 0.0965, 0, 0, Math.PI / 2, 0);
  g.add(rim);
  // a crease down the front, as the soft pot shows in photo 200
  g.add(at(rbox(0.0035, 0.080, 0.0035, 0.0015, m.blackMatte, 2), 0.032, 0.050, 0.015, 0.35));
  g.add(at(cyl(0.0312, 0.0312, 0.002, m.blackMatte, 24), 0, 0.088, 0));

  // six pens standing in it, leaning apart
  const pen = (kind: 'blue' | 'white' | 'pencil' | 'thin' | 'pale' | 'marker', len: number, ax: number, az: number, tilt: number, spin: number) => {
    const p = grp('cb-pen');
    const barrelMat = kind === 'blue' ? m.blueBarrel : kind === 'pale' ? m.bluePale
      : kind === 'white' ? m.whiteBarrel : kind === 'pencil' ? m.greyPencil
        : kind === 'marker' ? m.darkGrey : m.blackMatte;
    const r = kind === 'thin' ? 0.0028 : kind === 'marker' ? 0.0062 : 0.0048;
    p.add(at(cyl(r, r, len * 0.72, barrelMat, 12), 0, len * 0.36, 0));
    // nose cone + writing tip
    p.add(at(cyl(r * 0.35, r, len * 0.16, kind === 'pencil' ? m.greyPencil : m.whiteGloss, 12), 0, len * 0.72 + len * 0.08, 0));
    p.add(at(cyl(0.0006, r * 0.4, 0.004, kind === 'pencil' ? m.graphite : m.nib, 8), 0, len * 0.72 + len * 0.16 + 0.002, 0));
    // clip near the top
    if (kind !== 'pencil') {
      p.add(at(rbox(0.0016, len * 0.16, 0.0032, 0.0008, m.nib, 1), r + 0.0012, len * 0.88, 0));
    } else {
      // a pencil's ferrule + eraser
      p.add(at(cyl(r * 1.02, r * 1.02, 0.008, m.nib, 10), 0, len * 1.0 - 0.004, 0));
    }
    at(p, ax, 0.070, az, spin, tilt, tilt * 0.4);
    return p;
  };
  g.add(pen('blue', 0.152, 0.008, -0.004, 0.14, 2.1));
  g.add(pen('white', 0.140, -0.011, 0.006, -0.11, 1.1));
  g.add(pen('pencil', 0.158, 0.003, 0.013, 0.18, 0.4));
  g.add(pen('thin', 0.128, -0.004, -0.014, 0.22, 2.9));
  g.add(pen('pale', 0.146, 0.014, 0.010, -0.17, 1.7));
  g.add(pen('marker', 0.118, -0.015, -0.010, 0.09, 0.8));
  return g;
}

// =====================================================================================
// 7. WHOSON white aerosol
// =====================================================================================
function buildWhoCan(m: CM) {
  const g = grp('cb-who-can');
  const labelMats: THREE.Material[] = [m.who, m.alu, m.alu];
  g.add(at(cyl(0.0300, 0.0300, 0.150, labelMats, 48), 0, 0.075, 0));
  // base bead + the rim seam
  g.add(at(cyl(0.0303, 0.0290, 0.006, m.alu, 40), 0, 0.0030, 0));
  g.add(at(cyl(0.0301, 0.0301, 0.0022, m.alu, 40), 0, 0.1475, 0));
  // valve cup
  g.add(lathe([
    [0.0298, 0.1495], [0.0292, 0.1520], [0.0225, 0.1560], [0.0170, 0.1590],
    [0.0155, 0.1610], [0.0060, 0.1620], [0, 0.1620],
  ], m.alu, 36));
  // translucent orange dome over the can's shoulder
  g.add(lathe([
    [0.0302, 0.1500], [0.0308, 0.1550], [0.0302, 0.1625], [0.0286, 0.1685],
    [0.0242, 0.1725], [0.0180, 0.1748], [0.0168, 0.1752], [0, 0.1752],
  ], m.orangeClear, 40));
  // the serrated skirt of the dome: a ring of small wedges
  const wedge = new THREE.BoxGeometry(0.0022, 0.0070, 0.0034);
  const mats: THREE.Matrix4[] = [];
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2;
    mats.push(mat4(Math.cos(a) * 0.0300, 0.1530, Math.sin(a) * 0.0300, 0, -a, 0.12));
  }
  g.add(instanced(wedge, m.whoCapOrange, mats, 'cb-who-serrations'));
  // valve stem + clear spray-through cap with an angled nozzle
  g.add(at(cyl(0.0036, 0.0036, 0.009, m.alu, 12), 0, 0.1780, 0));
  const cap = lathe([
    [0.0165, 0.1752], [0.0172, 0.1830], [0.0150, 0.1940], [0.0112, 0.2020],
    [0.0098, 0.2045], [0.0050, 0.2070], [0, 0.2075],
  ], m.clearPET, 32);
  g.add(cap);
  const noz = grp('cb-who-nozzle');
  noz.add(at(cyl(0.0028, 0.0034, 0.012, m.whiteGloss, 12), 0, 0.0, 0));
  noz.add(at(rbox(0.0058, 0.0042, 0.0100, 0.0018, m.whiteGloss, 2), -0.003, 0.0095, 0));
  noz.add(at(cyl(0.0011, 0.0011, 0.0035, m.darkGrey, 8), -0.006, 0.0095, 0.0, 0, 0, Math.PI / 2));
  at(noz, 0.0, 0.1885, 0, 0.35, -0.12, 0);
  g.add(noz);
  return g;
}

// =====================================================================================
// 8. dark printed aerosol with a black overcap
// =====================================================================================
function buildDarkCan(m: CM) {
  const g = grp('cb-dark-can');
  const labelMats: THREE.Material[] = [m.darkCan, m.blackGloss, m.blackGloss];
  g.add(at(cyl(0.0275, 0.0275, 0.128, labelMats, 40), 0, 0.064, 0));
  g.add(at(cyl(0.0278, 0.0268, 0.0055, m.blackGloss, 36), 0, 0.0028, 0));
  // wine ring under the cap
  g.add(at(cyl(0.0276, 0.0276, 0.0075, m.maroon, 36), 0, 0.1315, 0));
  // valve cup
  g.add(lathe([
    [0.0272, 0.1330], [0.0266, 0.1350], [0.0195, 0.1380], [0.0140, 0.1395],
    [0.0060, 0.1400], [0, 0.1400],
  ], m.blackGloss, 32));
  // tall black overcap with a chamfered top and a small step
  g.add(lathe([
    [0.0268, 0.1400], [0.0274, 0.1440], [0.0274, 0.1580], [0.0262, 0.1600],
    [0.0240, 0.1612], [0.0225, 0.1618], [0.0220, 0.1595], [0, 0.1595],
  ], m.blackSoft, 36));
  g.add(at(mesh(new THREE.TorusGeometry(0.0270, 0.0016, 6, 32), m.blackGloss), 0, 0.1440, 0, 0, Math.PI / 2, 0));
  // rolled base bead + the valve stem under the cap
  g.add(at(mesh(new THREE.TorusGeometry(0.0272, 0.0014, 6, 32), m.blackGloss), 0, 0.0012, 0, 0, Math.PI / 2, 0));
  g.add(at(cyl(0.0032, 0.0032, 0.007, m.steel, 12), 0, 0.1405, 0));
  return g;
}

// =====================================================================================
// 10. paper scraps lying between the objects
// =====================================================================================
function buildScraps(m: CM) {
  const g = grp('cb-scraps');
  const sliver = (x: number, z: number, w: number, d: number, ry: number, tilt: number, mat: THREE.Material) => {
    const s = rbox(w, 0.0012, d, 0.0005, mat, 1);
    at(s, x, PED_TOP + 0.0008, z, ry, 0, 0);
    s.rotation.x = tilt;
    return s;
  };
  g.add(sliver(-0.800, 2.286, 0.040, 0.022, 0.42, 0.02, m.labelWhite));
  g.add(sliver(-0.892, 2.398, 0.052, 0.013, -0.88, -0.03, m.labelWhite));
  g.add(sliver(-0.766, 2.240, 0.024, 0.017, 1.15, 0.04, m.paperGrey));
  // a crumpled foil-ish scrap under the ornament's foot
  const foil = [[0, 0], [0.018, 0.003], [0.024, 0.011], [0.014, 0.016], [0.003, 0.012]] as [number, number][];
  const f = extrude(foil, 0.0016, m.foil, 0.0004, 4);
  at(f, -0.796, PED_TOP + 0.0035, 2.316, 0.7, -1.35, 0);
  g.add(f);
  return g;
}

// =====================================================================================
// 9. flat black slab (the "remote")
// =====================================================================================
function buildBlackSlab(m: CM) {
  const g = grp('cb-black-slab');
  g.add(at(rbox(0.072, 0.0105, 0.030, 0.004, m.blackSoft, 3), 0, 0.0053, 0));
  // pale metal edge at one end
  g.add(at(rbox(0.0065, 0.0110, 0.0305, 0.0028, m.steel, 2), -0.0335, 0.0054, 0));
  // mould parting seam down the long sides, and the battery hatch line at the far end
  g.add(at(box(0.002, 0.0008, 0.0302, m.blackMatte), 0.020, 0.0105, 0));
  g.add(at(box(0.070, 0.0008, 0.0012, m.blackGloss), 0.001, 0.0104, 0.0145));
  g.add(at(box(0.070, 0.0008, 0.0012, m.blackGloss), 0.001, 0.0104, -0.0145));
  // shallow button field
  const btn = rboxGeo(0.0075, 0.0016, 0.0055, 0.0006, 1);
  const mats: THREE.Matrix4[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) mats.push(mat4(0.004 + c * 0.0105, 0.0100, -0.0065 + r * 0.0065));
  }
  g.add(instanced(btn, m.darkGrey, mats, 'cb-slab-buttons'));
  g.add(at(cyl(0.0016, 0.0016, 0.0012, m.red, 10), 0.026, 0.0108, 0.008));
  return g;
}
