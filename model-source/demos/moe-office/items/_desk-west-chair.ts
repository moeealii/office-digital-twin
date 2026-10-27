import * as THREE from 'three';
import type { DwMats } from './_desk-west-mats';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { at, canvasTex, cyl, grp, mesh, rbox, rboxGeo, type V3 } from './_desk-west-kit';

/**
 * Steelcase Leap V2, black fabric (RoomPlan object 4; photos 78-83, 166/167, 197).
 * Identification: upholstered LiveBack whose black rear shell carries horizontal flex slots
 * (photo 197 from behind), height-adjustable 4D arms on tall black posts with long flat pads,
 * the large round back/seat pivot beside the mechanism, twin-wheel castors on a black
 * five-star base.
 * Steelcase dimensions: seat 0.49 W x 0.43-0.48 D, back 0.46 W, base Ø 0.69, castors 65 mm.
 * Placement: top shoulder triangulated from 197+166 (9 mm ray gap), top-edge bearing from
 * photo 166 on y=1.053. The chair is turned almost west, not square to the keyboard; its back
 * reclines toward local -z. RoomPlan (−1.79, 1.81) was only the initial footprint.
 * Seat top 0.50, back top 1.06 (RoomPlan box height 1.063).
 */
// Back's near shoulder: 197:168,564 + 166:569,872 -> (-1.545,1.053,1.776), ray gap 9 mm.
// The top edge in 166 runs almost along world z, not the keyboard's diagonal bearing.
// Four caster centres on y=.0325 in 197 fit centre (-1.805,1.561), radii .319-.328 m.
// Their five-star phase is -1.99 degrees (residuals <=5.6 degrees, including caster swivel).
export const CHAIR = { x: -1.805, z: 1.561, yaw: -1.57 };

function fabricMat(M: DwMats) {
  const tex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#48525a'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { c.fillStyle = y % 4 ? '#4f5961' : '#414b52'; c.fillRect(0, y, w, 1); }
    for (let i = 0; i < 1800; i++) { c.fillStyle = i % 2 ? 'rgba(60,62,68,0.35)' : 'rgba(0,0,0,0.35)'; c.fillRect((i * 97) % w, (i * 57) % h, 2, 1); }
  }, 6);
  // The map already contains the black albedo: another dark tint crushed every cloth detail.
  return new THREE.MeshStandardMaterial({ color: '#ffffff', map: tex, roughness: 0.93, normalMap: M.weaveNormal, normalScale: new THREE.Vector2(0.55, 0.55) });
}

/** an upholstered pad: rounded box with soft crown and a waterfall front edge */
function cushion(w: number, h: number, d: number, r: number, mat: THREE.Material, crown: number, waterfall: number) {
  const geo = rboxGeo(w, h, d, r, 5);
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const nx = x / (w / 2), nz = z / (d / 2);
    let dy = 0;
    if (y > 0) dy += crown * (1 - nx * nx) * (1 - nz * nz) - crown * 0.6 * Math.exp(-((nz + 0.2) ** 2) * 6) * (1 - nx * nx);
    if (nz > 0.55) dy -= waterfall * ((nz - 0.55) / 0.45) ** 2;
    p.setY(i, y + dy);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return mesh(geo, mat);
}

/** Leap back outline (local x/y, centred at the bottom), widest across the shoulders */
function backOutline(scale = 1): THREE.Shape {
  const pts: [number, number][] = [];
  const H = 0.52 * scale; // r15 top was ~30 mm above the triangulated 1.053 m shoulder
  const half = (t: number) => (0.215 + 0.018 * Math.sin(t * Math.PI * 0.9) - 0.03 * Math.exp(-((t - 0.3) ** 2) * 40)) * scale;
  const N = 24;
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push([half(t), t * H]); }
  for (let i = N; i >= 0; i--) { const t = i / N; pts.push([-half(t), t * H]); }
  // round the four corners
  const s = new THREE.Shape();
  const r = 0.05 * scale;
  s.moveTo(-half(0) + r, 0);
  s.lineTo(half(0) - r, 0);
  s.quadraticCurveTo(half(0), 0, half(r / H), r);
  for (let i = 1; i < N; i++) { const t = i / N; if (t * H > r && t * H < H - r) s.lineTo(half(t), t * H); }
  s.quadraticCurveTo(half(1), H, half(1) - r, H);
  s.lineTo(-half(1) + r, H);
  s.quadraticCurveTo(-half(1), H, -half(1 - r / H), H - r);
  for (let i = N - 1; i > 0; i--) { const t = i / N; if (t * H > r && t * H < H - r) s.lineTo(-half(t), t * H); }
  s.quadraticCurveTo(-half(0), 0, -half(0) + r, 0);
  return s;
}

/** bend a back panel: concave toward +z horizontally, with a lumbar bulge at ~30 % height */
function shapeBack(geo: THREE.BufferGeometry) {
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const curl = (x * x) / (2 * 0.55);
    const lumbar = 0.025 * Math.exp(-((y - 0.17) ** 2) / 0.012);
    const topLean = -0.03 * Math.max(0, (y - 0.3) / 0.25) ** 2;
    p.setZ(i, z + curl + lumbar + topLean);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Moulded side member: a broad, bevelled strip in the Y/Z plane, not a round pipe. */
function sideMember(x: number, points: V3[], widths: number[], thickness: number, material: THREE.Material, name: string, bevel = 0.0025) {
  const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(-p[2], p[1], 0)), false, 'centripetal');
  const left: THREE.Vector2[] = [], right: THREE.Vector2[] = [];
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const t = i / N, c = path.getPoint(t), tangent = path.getTangent(t).normalize();
    const k = t * (widths.length - 1), lo = Math.min(widths.length - 2, Math.floor(k));
    const width = THREE.MathUtils.lerp(widths[lo], widths[lo + 1], k - lo);
    const nx = -tangent.y * width / 2, ny = tangent.x * width / 2;
    left.push(new THREE.Vector2(c.x + nx, c.y + ny));
    right.push(new THREE.Vector2(c.x - nx, c.y - ny));
  }
  const shape = new THREE.Shape([...left, ...right.reverse()]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 4, curveSegments: 6 });
  geo.translate(0, 0, -thickness / 2);
  geo.rotateY(Math.PI / 2);
  return at(mesh(geo, material, name), x, 0, 0);
}

/** An oval-section curved cross-member, with enough rings to keep the centre off the back pad. */
function crossMember(points: V3[], height: number, depth: number, material: THREE.Material, name: string) {
  const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const N = 64, R = 12;
  const geo = new THREE.TubeGeometry(path, N, 1, R, false);
  const p = geo.getAttribute('position');
  for (let i = 0; i <= N; i++) {
    const t = i / N, c = path.getPointAt(t), tangent = path.getTangentAt(t).normalize();
    const up = new THREE.Vector3(0, 1, 0).addScaledVector(tangent, -tangent.y).normalize();
    const side = new THREE.Vector3().crossVectors(tangent, up).normalize();
    for (let j = 0; j <= R; j++) {
      const a = j / R * Math.PI * 2;
      const v = c.clone().addScaledVector(up, -Math.cos(a) * height / 2).addScaledVector(side, Math.sin(a) * depth / 2);
      p.setXYZ(i * (R + 1) + j, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return mesh(geo, material, name);
}

/** The thin flex panel lives INSIDE an independent back frame; its slots are actual openings. */
function flexPanel(material: THREE.Material) {
  const s = new THREE.Shape();
  s.moveTo(-0.151, 0.555); s.lineTo(0.151, 0.555);
  s.quadraticCurveTo(0.181, 0.555, 0.19, 0.582);
  s.quadraticCurveTo(0.205, 0.70, 0.201, 0.820);
  s.quadraticCurveTo(0.2, 0.846, 0.175, 0.846);
  s.lineTo(-0.175, 0.846); s.quadraticCurveTo(-0.2, 0.846, -0.201, 0.820);
  s.quadraticCurveTo(-0.205, 0.70, -0.19, 0.582); s.quadraticCurveTo(-0.181, 0.555, -0.151, 0.555);
  for (let i = 0; i < 9; i++) {
    const y = 0.689 + i * 0.0165, w = 0.346 - i * 0.0008, h = 0.0048, r = 0.002;
    const hole = new THREE.Path();
    hole.moveTo(-w / 2, y - h / 2 + r); hole.lineTo(-w / 2, y + h / 2 - r);
    hole.quadraticCurveTo(-w / 2, y + h / 2, -w / 2 + r, y + h / 2);
    hole.lineTo(w / 2 - r, y + h / 2); hole.quadraticCurveTo(w / 2, y + h / 2, w / 2, y + h / 2 - r);
    hole.lineTo(w / 2, y - h / 2 + r); hole.quadraticCurveTo(w / 2, y - h / 2, w / 2 - r, y - h / 2);
    hole.lineTo(-w / 2 + r, y - h / 2); hole.quadraticCurveTo(-w / 2, y - h / 2, -w / 2, y - h / 2 + r);
    s.holes.push(hole);
  }
  const extruded = new THREE.ExtrudeGeometry(s, { depth: 0.007, bevelEnabled: true, bevelSize: 0.0007, bevelThickness: 0.0007, bevelSegments: 2, curveSegments: 8 });
  const geo = tessellate(extruded, 0.018), p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = (p.getY(i) - 0.555) / 0.291;
    p.setZ(i, -0.255 - 0.060 * y + 0.075 * (x / 0.20) ** 2 + p.getZ(i) - 0.0035);
  }
  geo.computeVertexNormals();
  return mesh(geo, material, 'slotted-flex-panel');
}

export function buildChair(M: DwMats): THREE.Group {
  const chair = grp('steelcase-leap-v2');
  const fabric = fabricMat(M);
  const plastic = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.5, metalness: 0.05 });

  // ---------------- five-star base: tapered arched nylon legs
  const base = grp('chair-base');
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - 0.348; // measured five-star phase after the chair yaw
    const leg = new THREE.BoxGeometry(0.29, 0.04, 0.052, 16, 1, 1);
    const p = leg.getAttribute('position');
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k) + 0.145, t = x / 0.29;
      p.setZ(k, p.getZ(k) * (1 - 0.35 * t));
      p.setY(k, p.getY(k) * (1 - 0.35 * t) - 0.035 * t * t);
      p.setX(k, x + 0.04);
    }
    leg.computeVertexNormals();
    const lm = mesh(leg, plastic, 'base-leg');
    lm.position.y = 0.105;
    lm.rotation.y = -a;
    base.add(lm);
    // twin-wheel castor
    const tip = new THREE.Vector3(Math.cos(a) * 0.325, 0, Math.sin(a) * 0.325);
    const cast = grp('castor');
    cast.add(at(cyl(0.008, 0.008, 0.03, M.steel, 8), 0, 0.075, 0));
    cast.add(at(rbox(0.05, 0.03, 0.04, 0.012, plastic, 2), 0, 0.055, -0.012));
    for (const s of [-1, 1]) {
      const wh = cyl(0.0325, 0.0325, 0.018, M.rubber, 18);
      wh.rotation.z = Math.PI / 2; wh.position.set(s * 0.016, 0.0325, -0.02);
      cast.add(wh);
      const hub = cyl(0.012, 0.012, 0.02, M.darkPlastic, 10);
      hub.rotation.z = Math.PI / 2; hub.position.set(s * 0.016, 0.0325, -0.02);
      cast.add(hub);
    }
    cast.position.copy(tip);
    cast.rotation.y = -a + Math.PI / 2 + 0.6 * (i % 2 ? 1 : -1);
    base.add(cast);
  }
  base.add(at(cyl(0.05, 0.07, 0.06, plastic, 24), 0, 0.11, 0));
  chair.add(base);

  // ---------------- gas lift: telescoping black shroud + chrome rod
  chair.add(at(cyl(0.028, 0.03, 0.14, plastic, 20), 0, 0.2, 0));
  chair.add(at(cyl(0.024, 0.026, 0.1, plastic, 20), 0, 0.3, 0));
  chair.add(at(cyl(0.014, 0.014, 0.05, M.chrome, 14), 0, 0.37, 0));

  // ---------------- under-seat carriage: compact casting, separate slide rails and side links
  // 197/49/132 put the large back/seat pivot at (-1.745,.527,1.320), misses .4-1.0 cm.
  // It is OUTSIDE the seat at chair x=-.241, not a small knob buried below its centre.
  const mech = grp('mechanism');
  const castMetal = new THREE.MeshStandardMaterial({ color: '#23292d', roughness: 0.5, metalness: 0.12 });
  const pivotMat = new THREE.MeshStandardMaterial({ color: '#353b3e', roughness: 0.5, metalness: 0.04 });
  const housing = rboxGeo(0.214, 0.061, 0.23, 0.018, 4);
  const hp = housing.getAttribute('position');
  for (let i = 0; i < hp.count; i++) {
    const z = hp.getZ(i), t = (z + 0.115) / 0.23;
    hp.setX(i, hp.getX(i) * (0.78 + 0.22 * Math.sin(t * Math.PI)));
    if (hp.getY(i) < 0) hp.setY(i, hp.getY(i) + 0.012 * Math.abs(t - 0.5));
  }
  housing.computeVertexNormals();
  mech.add(at(mesh(housing, castMetal, 'tilt-casting'), 0, 0.397, 0.025));
  mech.add(at(rbox(0.235, 0.013, 0.253, 0.008, plastic, 3), 0, 0.43, 0.025));
  // Independent seat-slide tracks; daylight remains between them and the two recline links.
  for (const side of [-1, 1]) {
    mech.add(at(rbox(0.032, 0.022, 0.27, 0.005, castMetal, 2), side * 0.125, 0.429, 0.025));
    mech.add(at(rbox(0.021, 0.008, 0.24, 0.002, M.darkPlastic, 2), side * 0.125, 0.444, 0.038));
    mech.add(sideMember(side * 0.225, [[0, 0.43, 0.085], [0, 0.438, 0.015], [0, 0.475, -0.042], [0, 0.527, -0.06]], [0.031, 0.038, 0.044, 0.065], 0.026, castMetal, 'recline-link'));
    // Concentric, dished outer pivot cap on the yoke/arm junction (clearly visible in 197).
    const profile = [[0, 0], [0.028, 0], [0.043, 0.006], [0.046, 0.013], [0.045, 0.023], [0.037, 0.031], [0, 0.031]].map(([r, y]) => new THREE.Vector2(r, y));
    const cap = mesh(new THREE.LatheGeometry(profile, 48), pivotMat, 'back-pivot-boss');
    cap.rotation.z = -side * Math.PI / 2; cap.position.set(side * 0.217, 0.527, -0.06); mech.add(cap);
    const seam = mesh(new THREE.TorusGeometry(0.039, 0.0011, 6, 48), plastic, 'pivot-cap-seam');
    seam.rotation.y = Math.PI / 2; seam.position.set(side * 0.243, 0.527, -0.06); mech.add(seam);
    const gripGeo = new THREE.SphereGeometry(0.024, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    gripGeo.scale(1, 0.35, 1);
    const grip = mesh(gripGeo, pivotMat, 'domed-pivot-grip');
    grip.rotation.z = -side * Math.PI / 2; grip.position.set(side * 0.245, 0.527, -0.06); mech.add(grip);
    mech.add(at(cyl(0.005, 0.005, 0.0055, castMetal, 6), side * 0.255, 0.527, -0.06).rotateZ(Math.PI / 2));
    // Seat-depth/height paddles and their short separate stems.
    mech.add(at(rbox(0.052, 0.01, 0.023, 0.005, plastic, 2), side * 0.18, 0.427, 0.155));
    mech.add(at(rbox(0.035, 0.008, 0.011, 0.002, castMetal, 1), side * 0.157, 0.418, 0.14));
    for (const z of [-0.055, 0.105]) mech.add(at(cyl(0.005, 0.005, 0.003, M.darkPlastic, 6), side * 0.125, 0.447, z));
  }
  // Small knurled tilt-tension adjuster below the front-side carriage; not the large back pivot.
  const tension = grp('tilt-tension-control');
  tension.add(cyl(0.022, 0.022, 0.031, plastic, 28));
  tension.add(at(cyl(0.014, 0.014, 0.034, castMetal, 20), 0, 0, 0));
  for (let i = 0; i < 14; i++) {
    const a = i * Math.PI * 2 / 14;
    tension.add(at(rbox(0.003, 0.028, 0.003, 0.001, plastic, 1), Math.cos(a) * 0.022, 0, Math.sin(a) * 0.022));
  }
  // A real axle into the front casting, rather than a detached floating adjuster.
  mech.add(at(cyl(0.008, 0.008, 0.125, castMetal, 16), -0.1375, 0.397, 0.138).rotateZ(Math.PI / 2));
  tension.rotation.z = Math.PI / 2; tension.position.set(-0.19, 0.397, 0.138); mech.add(tension);
  chair.add(mech);

  // ---------------- seat: black plastic pan + upholstered cushion with a waterfall front
  chair.add(at(rbox(0.45, 0.025, 0.43, 0.02, plastic, 2), 0, 0.445, 0.02));
  const seat = cushion(0.49, 0.07, 0.465, 0.03, fabric, 0.006, 0.03);
  seat.position.set(0, 0.49, 0.03);
  seat.name = 'seat-cushion';
  chair.add(seat);

  // ---------------- upholstered back (the independent open support is built below)
  const back = grp('back');
  const ext = (shape: THREE.Shape, depth: number, bevel: number) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 6, steps: 1 });
    // subdivide the face for the bend: re-mesh via a tessellation-friendly ShapeGeometry would lose the
    // sides, so add resolution with a uniform modifier instead
    return geo;
  };
  const front = ext(backOutline(1), 0.03, 0.018);
  front.translate(0, 0, 0.0);
  const frontMesh = mesh(shapeBack(tessellate(front, 0.04)), fabric, 'back-upholstery');
  back.add(frontMesh);
  back.position.set(0, 0.525, -0.21);
  back.rotation.x = -0.14; // y-axis vectors rotate toward local -z: recline behind the sitter
  chair.add(back);

  // ---------------- independent open back frame, NOT a solid spine down to the gas lift
  // 197+167 triangulate the end/junction region at x/z=(-1.647,1.361)/(-1.589,1.793),
  // width .436 m. The top contour is y~.85 after matching the full-resolution 197/167 crops. The long members curl FORWARD to the side pivots at y=.527. The photos
  // show open side windows and a separate floating/slotted panel between those members.
  const support = grp('rear-support-frame');
  const backPlastic = new THREE.MeshStandardMaterial({ color: '#41474b', roughness: 0.65 });
  const framePlastic = new THREE.MeshStandardMaterial({ color: '#242a2e', roughness: 0.52 });
  support.add(flexPanel(backPlastic));
  for (const side of [-1, 1]) {
    support.add(sideMember(side * 0.225,
      [[0, 0.855, -0.235], [0, 0.80, -0.25], [0, 0.70, -0.25], [0, 0.61, -0.21], [0, 0.559, -0.149], [0, 0.527, -0.06]],
      [0.029, 0.030, 0.032, 0.040, 0.059, 0.071], 0.031, framePlastic, 'curved-back-yoke', 0.005));
    // Rounded moulded elbow closes the crossbar/upright junction; no exposed sawn-off rail end.
    const corner = mesh(new THREE.SphereGeometry(1, 20, 12), framePlastic, 'back-frame-corner');
    corner.scale.set(0.021, 0.017, 0.020); corner.position.set(side * 0.225, 0.855, -0.235); support.add(corner);
    // Panel tabs stop at the side frame; they do not fill the side windows.
    for (const y of [0.589, 0.813]) {
      const z = y > 0.7 ? -0.237 : -0.181;
      support.add(at(rbox(0.024, 0.012, 0.026, 0.003, framePlastic, 2), side * 0.207, y, z));
    }
    // Two visible stand-off fasteners above the top crossbar, into the upholstered back.
    const x = side * 0.11, z = -0.31 + 0.075 * (0.11 / 0.225) ** 2;
    support.add(at(rbox(0.021, 0.023, 0.031, 0.005, framePlastic, 3), x, 0.879, z + 0.014));
    support.add(at(cyl(0.009, 0.0105, 0.006, pivotMat, 18), x, 0.880, z - 0.003).rotateX(Math.PI / 2));
  }
  const bar: V3[] = [], bottom: V3[] = [];
  for (let i = 0; i <= 16; i++) {
    const x = -0.225 + i / 16 * 0.45, t = x / 0.225;
    bar.push([x, 0.866 - 0.014 * t * t, -0.31 + 0.075 * t * t]);
    bottom.push([x, 0.542 + 0.010 * t * t, -0.255 + 0.12 * t * t]);
  }
  support.add(crossMember(bar, 0.023, 0.025, framePlastic, 'upper-back-crossbar'));
  support.add(crossMember(bottom, 0.030, 0.033, framePlastic, 'lower-back-crossbar'));
  chair.add(support);

  // ---------------- adjustable arms: separate under-pan brackets, broad boots and sliding stems
  // Pad centre 197/49/132=(-1.874,.650,1.314), misses .4-1.3 cm -> chair x=-.247,z=.069.
  // The lower boot sits farther OUT (x~-.30) and leans inward to the pad, unlike the old rods.
  const padMaterial = new THREE.MeshStandardMaterial({ color: '#24282b', roughness: 0.53 });
  for (const side of [-1, 1]) {
    const arm = grp('adjustable-arm');
    arm.add(at(rbox(0.15, 0.032, 0.085, 0.007, castMetal, 3), side * 0.212, 0.444, 0.025));
    arm.add(at(rbox(0.082, 0.008, 0.057, 0.003, M.darkPlastic, 2), side * 0.235, 0.464, 0.03));
    // The 197 crop shows a rounded, closed moulded boot, not an extruded flat blade. Taper its
    // oval section, lean it forward, and move the upper end inward to meet the sliding stem.
    const bootGeo = tessellate(rboxGeo(0.060, 0.145, 0.075, 0.026, 6), 0.012);
    const bp = bootGeo.getAttribute('position');
    for (let i = 0; i < bp.count; i++) {
      const t = THREE.MathUtils.clamp(bp.getY(i) / 0.145 + 0.5, 0, 1);
      bp.setX(i, bp.getX(i) * (1 - 0.20 * t) - side * 0.017 * t);
      bp.setZ(i, bp.getZ(i) * (1 - 0.22 * t) + 0.040 * t);
    }
    bootGeo.computeVertexNormals();
    arm.add(at(mesh(bootGeo, framePlastic, 'arm-lower-boot'), side * 0.282, 0.510, 0.014));
    // Telescoping upper section: the step and seam below the pad are visible in 197.
    arm.add(at(rbox(0.043, 0.091, 0.049, 0.011, castMetal, 3), side * 0.267, 0.594, 0.058));
    arm.add(at(rbox(0.048, 0.009, 0.055, 0.004, plastic, 2), side * 0.272, 0.558, 0.058));
    arm.add(at(rbox(0.012, 0.024, 0.019, 0.004, M.darkPlastic, 2), side * 0.295, 0.58, 0.058));
    arm.add(at(rbox(0.067, 0.013, 0.13, 0.006, castMetal, 3), side * 0.255, 0.633, 0.069));
    const padGeo = tessellate(rboxGeo(0.101, 0.028, 0.245, 0.013, 4), 0.018);
    const p = padGeo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = x / 0.0505, nz = z / 0.1225;
      p.setX(i, x * (0.88 + 0.12 * nz * nz));
      p.setY(i, y + (y > 0 ? 0.005 * (1 - nx * nx) * (1 - nz * nz) : 0) - 0.004 * nz);
    }
    padGeo.computeVertexNormals();
    const pad = mesh(padGeo, padMaterial, 'arm-pad');
    pad.position.set(side * 0.255, 0.650, 0.069); pad.rotation.y = side * -0.07; arm.add(pad);
    // Small underside mounting screws, not decorative studs on the top cushion.
    for (const z of [0.02, 0.115]) arm.add(at(cyl(0.004, 0.004, 0.003, plastic, 6), side * 0.255, 0.624, z));
    chair.add(arm);
  }

  chair.position.set(CHAIR.x, 0, CHAIR.z);
  chair.rotation.y = CHAIR.yaw;
  return chair;
}

/** split long triangles of an extrusion so later vertex bends stay smooth */
function tessellate(geo: THREE.BufferGeometry, maxEdge: number) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (let pass = 0; pass < 9; pass++) {
    const p = g.getAttribute('position');
    const out: number[] = [];
    let split = false;
    for (let i = 0; i < p.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, i), b = new THREE.Vector3().fromBufferAttribute(p, i + 1), c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
      const ab = a.distanceTo(b), bc = b.distanceTo(c), ca = c.distanceTo(a);
      const m = Math.max(ab, bc, ca);
      if (m > maxEdge) {
        split = true;
        let [A, B, C] = ab === m ? [a, b, c] : bc === m ? [b, c, a] : [c, a, b];
        const M = A.clone().add(B).multiplyScalar(0.5);
        out.push(...A.toArray(), ...M.toArray(), ...C.toArray(), ...M.toArray(), ...B.toArray(), ...C.toArray());
      } else out.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    }
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
    if (!split) break;
  }
  g = mergeVertices(g, 1e-5);
  g.computeVertexNormals();
  return g;
}

export type { V3 };
