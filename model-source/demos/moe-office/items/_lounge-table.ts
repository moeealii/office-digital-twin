import * as THREE from 'three';
import { at, canvasTex, cyl, mesh, rbox, rod, v3 } from './_moe-kit';
import { lathe, slabGeo } from './_lounge-geo';
import type { LoungeMats } from './_lounge-mats';

/**
 * White marble + gold coffee table (RoomPlan object 7) and the copper tray with its covered dish.
 *
 * Evidence: photos 103, 124, 125 (closest), 130, 196.
 * Plan from the RoomPlan box cross-checked by rectifying the top surface (photo 125, plane
 * y = 0.488): slab 1.18 m along z x 0.655 m along x, centred (1.582, 0.391), top at 0.488,
 * slab 0.035 thick. Frame is thin round gold tube: legs at the slab corners inset 40 mm, with
 * X-braces on all four faces (photos 125 and 196) and no lower shelf.
 * The marble top uses the clean near end of photo 125 rectified at y=.488 at runtime in
 * _lounge-mats.ts. Its photographed veins replace the old faint procedural lines. The tray hides
 * the middle in every useful pose, so continuation there is reconstructed by mirror-repeating
 * the unobstructed strip, rather than baking the dish or the roller into the stone.
 * Resumed measurement: photo-125 top corners hit y=.488 at (1.208,-.196), (1.790,-.193),
 * (1.188,.933) in x/z. Use a .58 x 1.13 m slab centred (1.50,.370), with ~20 mm uncertainty
 * in the near corner. Frame and planar UVs derive from the slab dimensions, so all resize together.
 * The tray retains its separately measured world centre rather than inheriting the slab shift.
 *
 * Copper tray: rectified in plan from photo 125 (plane y = 0.528, 1400 px/m), RANSAC circle on the
 * dark beaded rim = 0.221 m centreline, 0.229 m to the outer edge -> Ø 0.46 m, centre world
 * (1.467, 0.392). The earlier 0.48 m/centre-of-table figure was 3 cm large and 13 cm east.
 * Covered dish: same plan gives the beaded lower rim at r = 0.155 (Ø 0.31 m); vertical ticks
 * projected on photos 103 and 125 put the finial at y = 0.63, so 0.138 m tall over the tray floor.
 * The photo shows a shallow stepped domed lid: a flared beaded lower rim, a wide repousse floral
 * skirt, a step and a shallow smooth dome, then a dark beaded crown with a copper cap and the
 * green cabochon. It is NOT a tall cone.
 */

const TZ = 0.370, TX = 1.500;
const TOP_Y = 0.488, SLAB_T = 0.035;
// Independently measured tray world centre (1.467,.392), not a compensating nudge.
const PX = 1.467 - TX, PZ = 0.392 - TZ;

/** pale repousse band with 20 rosettes, wrapped once around the dish's skirt (photos 103/125) */
function embossedBandTex() {
  return canvasTex(640, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#8b7360'); g.addColorStop(0.22, '#d7c7b3'); g.addColorStop(0.5, '#f2e8da');
    g.addColorStop(0.78, '#cbb69f'); g.addColorStop(1, '#7d6753');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // beaded borders
    for (const y of [7, h - 7]) {
      for (let x = 5; x < w; x += 9) {
        c.fillStyle = '#f6efe4';
        c.beginPath(); c.arc(x, y, 2.6, 0, 7); c.fill();
        c.strokeStyle = '#6b5440'; c.lineWidth = 0.7; c.stroke();
      }
    }
    // rosette band
    for (let i = 0; i < 20; i++) {
      const x = 16 + i * (w / 20);
      c.fillStyle = '#7c8a5f';
      for (const s of [-1, 1]) { c.beginPath(); c.ellipse(x + s * 17, h * 0.52, 13, 4.5, s * 0.5, 0, 7); c.fill(); }
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        c.fillStyle = k % 2 ? '#e3aca6' : '#f6ddd2';
        c.beginPath(); c.ellipse(x + Math.cos(a) * 9.5, h * 0.5 + Math.sin(a) * 8, 6.5, 4, a, 0, 7); c.fill();
      }
      c.fillStyle = '#d9b45e'; c.beginPath(); c.arc(x, h * 0.5, 4.2, 0, 7); c.fill();
      c.strokeStyle = '#6a4b35'; c.lineWidth = 1.3; c.beginPath(); c.arc(x, h * 0.5, 12.5, 0, 7); c.stroke();
    }
    // dark seams between the motifs
    c.globalAlpha = 0.3; c.strokeStyle = '#48331f'; c.lineWidth = 1;
    for (let i = 0; i < 20; i++) { const x = i * (w / 20); c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    c.globalAlpha = 1;
  }, 1);
}

function planarUV(geo: THREE.BufferGeometry, w: number, d: number) {
  // marble texture covers the slab: u along z (world), v along x, both 0..1 edge to edge
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getZ(i) + d / 2) / d, (pos.getX(i) + w / 2) / w);
  }
  uv.needsUpdate = true;
}

export function buildTable(m: LoungeMats) {
  const g = new THREE.Group();
  g.name = 'marble-coffee-table';
  const W = 0.580, D = 1.130;   // x, z; photo-plane measurement, not RoomPlan bounds
  const legInset = 0.042;
  const frameTop = TOP_Y - SLAB_T;

  // ---- marble slab
  const geo = slabGeo(W, D, SLAB_T, 0.004, 0.018);
  planarUV(geo, W, D);
  const slab = mesh(geo, m.marble);
  slab.position.y = TOP_Y - SLAB_T;
  g.add(slab);

  // ---- gold frame: legs + top rails + X braces on every face
  const tube = 0.0075;
  const lx = W / 2 - legInset, lz = D / 2 - legInset;
  const legTop = frameTop + 0.002, legBot = 0.018;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(rod([sx * lx, legBot, sz * lz], [sx * lx, legTop, sz * lz], tube, m.gold));
    // small glide
    g.add(at(cyl(0.012, 0.012, 0.012, m.rubber, 10), sx * lx, 0.012, sz * lz));
  }
  // top rails just under the slab
  const railY = frameTop + 0.004;
  g.add(rod([-lx, railY, -lz], [lx, railY, -lz], tube * 0.9, m.gold));
  g.add(rod([-lx, railY, lz], [lx, railY, lz], tube * 0.9, m.gold));
  g.add(rod([-lx, railY, -lz], [-lx, railY, lz], tube * 0.9, m.gold));
  g.add(rod([lx, railY, -lz], [lx, railY, lz], tube * 0.9, m.gold));
  // X braces, long faces (z = +-lz)
  for (const sz of [-1, 1]) {
    g.add(rod([-lx, legBot + 0.01, sz * lz], [lx, railY - 0.004, sz * lz], tube * 0.85, m.gold));
    g.add(rod([lx, legBot + 0.01, sz * lz], [-lx, railY - 0.01, sz * lz], tube * 0.85, m.gold));
  }
  // X braces, short faces (x = +-lx) — visible in photo 125
  for (const sx of [-1, 1]) {
    g.add(rod([sx * lx, legBot + 0.01, -lz], [sx * lx, railY - 0.01, lz], tube * 0.8, m.gold));
    g.add(rod([sx * lx, legBot + 0.01, lz], [sx * lx, railY - 0.01, -lz], tube * 0.8, m.gold));
  }
  g.position.set(TX, 0, TZ);

  // ---- copper tray + covered dish on the top, local coordinates of the table group
  // Each surface prop is physics-tagged so knolling separates it from the table (Wes pattern).
  const props = new THREE.Group();
  props.name = 'coffee-table-props';
  const trayR = 0.229;
  const trayProfile: [number, number][] = [
    [0.002, 0.002], [0.170, 0.002], [0.200, 0.006], [0.215, 0.012],
    [0.224, 0.020], [trayR, 0.028], [trayR, 0.034], [0.2255, 0.036],
    [0.2225, 0.034], [0.2215, 0.028],
  ];
  const trayG = new THREE.Group();
  trayG.name = 'copper-tray';
  const tray = lathe(trayProfile, m.copper, 72);
  tray.position.set(PX, TOP_Y, PZ);
  trayG.add(tray);
  // ornate dark rim band with a fine beaded line (photo 125): a band, not a sawtooth of spheres
  const rimRing = mesh(new THREE.TorusGeometry(0.2268, 0.0046, 8, 120), m.copperDark);
  rimRing.rotation.x = Math.PI / 2;
  rimRing.position.set(PX, TOP_Y + 0.0315, PZ);
  trayG.add(rimRing);
  const beadG = new THREE.SphereGeometry(0.0019, 6, 5);
  const beadN = 150;
  const beads = new THREE.InstancedMesh(beadG, m.copper, beadN);
  const bm = new THREE.Matrix4();
  for (let i = 0; i < beadN; i++) {
    const a = (i / beadN) * Math.PI * 2;
    bm.makeTranslation(PX + Math.cos(a) * 0.2272, TOP_Y + 0.0336, PZ + Math.sin(a) * 0.2272);
    beads.setMatrixAt(i, bm);
  }
  trayG.add(beads);
  // ring handles on the tray's long sides (photo 125: brass rings lying at the rim)
  for (const sz of [-1, 1]) {
    const outline = Array.from({ length: 48 }, (_, i) => {
      const a = i / 48 * Math.PI * 2;
      const r = 0.027 + 0.0025 * Math.cos(6 * a);
      return v3(Math.cos(a) * r * 1.18, Math.sin(a) * r, 0);
    });
    const ring = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline, true), 72, 0.0035, 6, true), m.gold);
    ring.position.set(PX, TOP_Y + 0.010, PZ + sz * (trayR + 0.017));
    ring.rotation.x = Math.PI / 2;
    trayG.add(ring);
    trayG.add(rod([PX, TOP_Y + 0.012, PZ + sz * trayR * 0.985], [PX, TOP_Y + 0.012, PZ + sz * (trayR + 0.004)], 0.0055, m.copperDark));
  }
  trayG.userData.physics = { type: 'dynamic', mass: 1.2, shape: 'cylinder', surface: 'metal' };
  props.add(trayG);

  // ---- covered serving dish (photos 103/125): Ø 0.31 m x 0.138 m high
  const dish = new THREE.Group();
  dish.name = 'covered-dish';
  const R = 0.155;
  const profile: [number, number][] = [
    [0.002, 0.000], [0.055, 0.000], [0.100, 0.001], [0.125, 0.004],
    [0.143, 0.008], [0.152, 0.013], [R, 0.017], [R, 0.025],
    [0.151, 0.028], [0.149, 0.040], [0.147, 0.051], [0.144, 0.059],
    // crisp shoulder: the lid steps in 14 mm before the dome springs (photo 125)
    [0.1435, 0.0625], [0.1295, 0.0635], [0.128, 0.071],
  ];
  // shallow smooth dome — one sixth of the height, not a tent
  for (let k = 0; k <= 10; k++) {
    const th = (k / 10) * 1.24;
    profile.push([0.126 * Math.cos(th), 0.071 + 0.036 * Math.sin(th)]);
  }
  profile.push([0.050, 0.109], [0.047, 0.112], [0.045, 0.115]);
  const body = lathe(profile, m.copper, 64);
  dish.add(body);

  // repousse floral skirt: a pale embossed metal band, 4 mm proud of the copper skirt.
  // (photo 103/125: the band reads silver-pink against the copper, with a row of rosettes)
  const bandTex = embossedBandTex();
  const bandMat = new THREE.MeshPhysicalMaterial({
    map: bandTex, bumpMap: bandTex, bumpScale: 0.0015, color: '#f2e8db',
    metalness: 0.40, roughness: 0.4, envMapIntensity: 1.15,
    clearcoat: 0.25, clearcoatRoughness: 0.3, side: THREE.DoubleSide,
  });
  const band = lathe([
    [0.1554, 0.027], [0.1538, 0.033], [0.1528, 0.040], [0.1512, 0.046],
    [0.1500, 0.052], [0.1486, 0.057], [0.1466, 0.061],
    [0.1435, 0.0645], [0.130, 0.0655], [0.1285, 0.072],
    [0.122, 0.082], [0.107, 0.0915], [0.085, 0.0995],
  ], bandMat, 64);
  // LatheGeometry's V follows profile vertex number, which put all flowers on the narrow
  // vertical rim and left the photographed broad sloping skirt blank. Map that band radially.
  const bandPos = band.geometry.getAttribute('position');
  const bandUV = band.geometry.getAttribute('uv');
  bandTex.wrapT = THREE.ClampToEdgeWrapping;
  for (let k = 0; k < bandPos.count; k++) {
    const r = Math.hypot(bandPos.getX(k), bandPos.getZ(k));
    bandUV.setY(k, THREE.MathUtils.clamp((r - 0.104) / 0.052, 0, 1));
  }
  bandUV.needsUpdate = true;
  dish.add(band);
  // cord lines top and bottom of the band
  for (const [r, y] of [[0.1550, 0.0275], [0.1462, 0.0605]] as const) {
    const cord = mesh(new THREE.TorusGeometry(r, 0.0022, 6, 80), m.copperDark);
    cord.rotation.x = Math.PI / 2;
    cord.position.y = y;
    dish.add(cord);
  }
  // 20 raised rosette bosses around the band catch the light as real relief
  const bossM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0050, 8, 6), bandMat, 20);
  const bmx = new THREE.Matrix4();
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    bmx.makeScale(1, 0.85, 1);
    bmx.setPosition(Math.cos(a) * 0.1518, 0.0435, Math.sin(a) * 0.1518);
    bossM.setMatrixAt(i, bmx);
  }
  dish.add(bossM);
  // dark beaded rings: lower rim, skirt top, crown
  const beadRing = (n: number, r: number, y: number, rad: number, mat: THREE.Material = m.copperDark) => {
    const b = new THREE.InstancedMesh(new THREE.SphereGeometry(rad, 8, 6), mat, n);
    const mm = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      mm.makeTranslation(Math.cos(a) * r, y, Math.sin(a) * r);
      b.setMatrixAt(i, mm);
    }
    return b;
  };
  dish.add(beadRing(80, 0.1553, 0.0210, 0.0025, m.copper));
  dish.add(beadRing(64, 0.1530, 0.0285, 0.0019));
  // thin dark step lines at the skirt top and at the dome springing
  for (const [r, y] of [[0.1298, 0.0637], [0.1278, 0.0705]] as const) {
    const line = mesh(new THREE.TorusGeometry(r, 0.0016, 6, 72), m.copperDark);
    line.rotation.x = Math.PI / 2;
    line.position.y = y;
    dish.add(line);
  }
  dish.add(beadRing(28, 0.0480, 0.1140, 0.0026));
  // dark beaded crown + copper cap + green cabochon (photos 103/125)
  const crownMat = new THREE.MeshStandardMaterial({ color: '#5c3a26', metalness: 0.85, roughness: 0.45, side: THREE.DoubleSide });
  dish.add(lathe([
    [0.048, 0.108], [0.052, 0.113], [0.051, 0.120], [0.047, 0.125],
    [0.039, 0.129], [0.031, 0.131], [0.026, 0.132],
  ], crownMat, 32));
  dish.add(lathe([[0.025, 0.131], [0.023, 0.133], [0.015, 0.135], [0.001, 0.136]], m.copper, 28));
  const gem = mesh(new THREE.SphereGeometry(0.0095, 14, 10), new THREE.MeshPhysicalMaterial({
    color: '#1d5c3a', roughness: 0.12, clearcoat: 1, metalness: 0.15,
  }));
  gem.scale.set(1, 0.62, 1);
  gem.position.set(0, 0.134, 0);
  dish.add(gem);
  dish.position.set(PX, TOP_Y + 0.005, PZ);
  dish.userData.physics = { type: 'dynamic', mass: 1.8, shape: 'cylinder', surface: 'metal' };
  props.add(dish);

  // ---- lint roller and utility knife on the marble (photos 103/124/125)
  // Lint roller: a white sticky-sheet roll on an in-line glossy green handle that flares where it
  // meets the roll, waists, and ends in a rounded bulb (photo 124 zoom).
  const roller = new THREE.Group();
  roller.name = 'lint-roller';
  const rollR = 0.029, rollL = 0.105;
  const sheet = canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#f1eee6'; c.fillRect(0, 0, w, h);
    // the tear edge of the outer sheet and a few lint fibres caught on it
    c.strokeStyle = 'rgba(150,140,120,0.55)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(w * 0.62, 0); c.lineTo(w * 0.6, h); c.stroke();
    for (let k = 0; k < 40; k++) {
      c.strokeStyle = `rgba(${90 + (k % 3) * 40},${80 + (k % 5) * 20},70,0.35)`; c.lineWidth = 1;
      const x = (k * 53) % w, y = (k * 31) % h;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 6 - (k % 12), y + 3 + (k % 5)); c.stroke();
    }
  });
  const roll = mesh(new THREE.CylinderGeometry(rollR, rollR, rollL, 32, 1, false), new THREE.MeshStandardMaterial({ map: sheet, roughness: 0.75 }));
  roll.rotation.z = Math.PI / 2;
  roller.add(roll);
  // paper core visible in the roll ends
  for (const sx of [-1, 1]) {
    const core = mesh(new THREE.RingGeometry(0.012, rollR - 0.002, 28), new THREE.MeshStandardMaterial({ color: '#d9d2c2', roughness: 0.9, side: THREE.DoubleSide }));
    core.rotation.y = sx * Math.PI / 2;
    core.position.x = sx * (rollL / 2 + 0.0005);
    roller.add(core);
  }
  const green = new THREE.MeshPhysicalMaterial({ color: '#3fae4c', roughness: 0.18, clearcoat: 0.9, clearcoatRoughness: 0.1 });
  // handle profile (radius, distance from the roll end)
  const handle = new THREE.LatheGeometry([
    [0.004, 0], [0.024, 0.002], [0.025, 0.008], [0.016, 0.022], [0.0115, 0.04], [0.0125, 0.07],
    [0.016, 0.1], [0.0165, 0.118], [0.012, 0.132], [0.001, 0.137],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 28);
  handle.rotateZ(-Math.PI / 2); // lathe axis y -> +x
  const hm = mesh(handle, green);
  hm.position.x = rollL / 2 + 0.002;
  roller.add(hm);
  // Photo-125 rays at y=.517: roll centre (1.587,.082), handle tip (1.740,.154).
  at(roller, 1.587 - TX, TOP_Y + rollR, 0.082 - TZ, 0);
  roller.rotation.y = -0.44;
  roller.userData.physics = { type: 'dynamic', mass: 0.15, shape: 'box' };
  props.add(roller);

  // utility knife lying flat beside it: slim dark body, grey thumb slider, the silver blade tip
  const knife = new THREE.Group();
  knife.name = 'utility-knife';
  const knifeBody = new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: 0.5 });
  knife.add(rbox(0.026, 0.012, 0.15, 0.005, knifeBody, 3));
  knife.add(at(rbox(0.012, 0.004, 0.045, 0.0015, new THREE.MeshStandardMaterial({ color: '#7d828a', roughness: 0.45 }), 1), 0, 0.007, -0.02));
  knife.add(at(rbox(0.018, 0.0016, 0.02, 0.0004, new THREE.MeshStandardMaterial({ color: '#d4d7db', metalness: 0.9, roughness: 0.2 }), 1), 0, 0, -0.084));
  knife.position.set(1.58 - TX, TOP_Y + 0.006, 0.17 - TZ);
  knife.rotation.y = 1.13;
  knife.userData.physics = { type: 'dynamic', mass: 0.1, shape: 'box' };
  props.add(knife);
  g.add(props);
  g.userData.physics = { type: 'static' };
  return g;
}
