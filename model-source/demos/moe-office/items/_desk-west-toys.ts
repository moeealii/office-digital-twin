import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildKawsAstro } from './_toy-kaws';
import { buildStrikeFreedom } from './_toy-gundam';
import { buildLavenderStandIn } from './_toy-lavender';
import { type Prim, capsule, ellipsoid, roundBox, rotated, sculpt, sphere as sdSphere, spike } from './_sdf-sculpt';
import {
  at, box, canvasTex, cyl, extrude, grp, instanced, lathe, mat4, mesh, rbox, rod, sphere, taperTube, tube, v3,
  type V2, type V3,
} from './_desk-west-kit';

/**
 * The desk toys on the west wing of the corner desk (owner priority). Every object was identified
 * from full-resolution crops of photos 70/72/83/86/87/168/197 (inventory sheet:
 * data/captures/moe-office/desk-west/inv/inventory.jpg) and placed by ray hits on the desk plane
 * y = 0.820 or by multi-photo triangulation (tools/tri.py, misses in cm):
 *
 *   KAWS x Astro Boy (grey)     stands (-2.60, 1.56); hair-spike tip (-2.577, 1.162, 1.550) 87/168/197 1.6/0.6/1.0
 *   red acrylic stand + bird    (-2.47, 1.51)  168+83 triangulated 0.0, 87 plane hit agrees
 *   white turbine fan/clock     foot (-2.51, 1.65)  168+83 0.0, 87 plane hit (-2.510, 1.646)
 *   spring on polyhedron, hex   (-2.60, 1.87)  168/83/197 0.6
 *   blue crystal shards         top (-2.587, 1.076, 1.708)  87+168 0.7
 *   gold medallion on a wire    (-2.597, 1.020, 1.637)  72+87 1.8
 *   lavender crystal figure     claw tip (-2.682, 1.081, 1.545)  70+72 0.5
 *   Qur'an, upright             top corners (-2.663,1.045,1.507) (-2.725,1.032,1.405)  72+87
 *   teal coin box               (-2.78, 1.46)  (72/87/70: 7 cm miss — position approximate)
 *   white bud vase + enamel leaves  (-2.63, 1.43)  87 plane hit
 *   black panel with gold inlay (-2.76, 1.31)  72
 *   paper towel on gilt plate   (-2.45, 1.33); roll top (-2.456, 1.124, 1.337) 87/168/197 0.6/0.2/0.6
 *   silver Gundam on action base, on the G9 stand plate (-2.11, 2.37)
 *
 * Each builder returns a group standing on y = 0 with its "front" (the side the photos show)
 * toward local +z.
 */
export interface ToyMats {
  kawsGrey: THREE.MeshPhysicalMaterial;
  kawsDark: THREE.MeshPhysicalMaterial;
  vinylBlack: THREE.MeshPhysicalMaterial;
  vinylWhite: THREE.MeshPhysicalMaterial;
  silver: THREE.MeshStandardMaterial;
  white: THREE.MeshPhysicalMaterial;
  orange: THREE.MeshStandardMaterial;
  blueInk: THREE.MeshStandardMaterial;
  redAcrylic: THREE.MeshPhysicalMaterial;
  gold: THREE.MeshStandardMaterial;
  crystalBlue: THREE.MeshPhysicalMaterial;
  lavender: THREE.MeshPhysicalMaterial;
  blackFacet: THREE.MeshPhysicalMaterial;
  enamelGreen: THREE.MeshPhysicalMaterial;
  teal: THREE.MeshStandardMaterial;
  paperTowel: THREE.MeshStandardMaterial;
  pageEdge: THREE.MeshStandardMaterial;
  leather: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  red: THREE.MeshStandardMaterial;
  clear: THREE.MeshPhysicalMaterial;
}

export function toyMaterials(): ToyMats {
  const vinyl = (c: string, r = 0.32) => new THREE.MeshPhysicalMaterial({ color: c, roughness: r, clearcoat: 0.55, clearcoatRoughness: 0.25 });
  // red acrylic discs with the white scratched-line pattern (photos 87/72)
  const scratch = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#8e1424'; c.fillRect(0, 0, w, h);
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    c.strokeStyle = 'rgba(245,215,215,0.75)'; c.lineWidth = 1.6;
    for (let i = 0; i < 46; i++) {
      const a = r() * Math.PI * 2, b = a + 1 + r() * 2.2;
      c.beginPath(); c.moveTo(w / 2 + Math.cos(a) * w / 2, h / 2 + Math.sin(a) * h / 2); c.lineTo(w / 2 + Math.cos(b) * w / 2, h / 2 + Math.sin(b) * h / 2); c.stroke();
    }
  });
  // paper towel: diamond-quilted emboss as a bump map, tiled around the roll
  const quilt = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#d0d0d0'; c.lineWidth = 3;
    for (let i = -h; i < w + h; i += 32) {
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke();
      c.beginPath(); c.moveTo(i + h, 0); c.lineTo(i, h); c.stroke();
    }
    c.fillStyle = '#5a5a5a';
    for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < w; x += 8) c.fillRect(x, y, 2, 2);
  });
  quilt.colorSpace = THREE.NoColorSpace;
  quilt.wrapS = quilt.wrapT = THREE.RepeatWrapping;
  quilt.repeat.set(7, 5);
  return {
    kawsGrey: vinyl('#8d9096'),
    kawsDark: vinyl('#5f6269', 0.28),
    vinylBlack: vinyl('#16171a', 0.22),
    vinylWhite: vinyl('#f1f0ec', 0.3),
    silver: new THREE.MeshStandardMaterial({ color: '#c5c8cc', roughness: 0.22, metalness: 0.95 }),
    white: new THREE.MeshPhysicalMaterial({ color: '#f2f1ed', roughness: 0.42, clearcoat: 0.2 }),
    orange: new THREE.MeshStandardMaterial({ color: '#e5481c', roughness: 0.45 }),
    blueInk: new THREE.MeshStandardMaterial({ color: '#2a52a8', roughness: 0.5 }),
    redAcrylic: new THREE.MeshPhysicalMaterial({ map: scratch, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
    gold: new THREE.MeshStandardMaterial({ color: '#d4a640', roughness: 0.22, metalness: 1 }),
    crystalBlue: new THREE.MeshPhysicalMaterial({ color: '#d7eef8', roughness: 0.05, transparent: true, opacity: 0.42, clearcoat: 1, clearcoatRoughness: 0.04, depthWrite: false, side: THREE.DoubleSide }),
    lavender: new THREE.MeshPhysicalMaterial({ color: '#cfc4e6', roughness: 0.2, transparent: true, opacity: 0.78, clearcoat: 1 }),
    blackFacet: new THREE.MeshPhysicalMaterial({ color: '#141416', roughness: 0.2, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, flatShading: true }),
    enamelGreen: new THREE.MeshPhysicalMaterial({ color: '#1f3a30', roughness: 0.3, clearcoat: 0.8, side: THREE.DoubleSide }),
    teal: new THREE.MeshStandardMaterial({ color: '#2ec4d6', roughness: 0.48 }),
    paperTowel: new THREE.MeshStandardMaterial({ color: '#f6f5f1', roughness: 0.96, bumpMap: quilt, bumpScale: 0.5 }),
    pageEdge: new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.85 }),
    leather: new THREE.MeshStandardMaterial({ color: '#2a1c14', roughness: 0.6 }),
    brass: new THREE.MeshStandardMaterial({ color: '#b98d3c', roughness: 0.3, metalness: 1 }),
    red: new THREE.MeshStandardMaterial({ color: '#c41d1d', roughness: 0.4 }),
    clear: new THREE.MeshPhysicalMaterial({ color: '#e8eef0', roughness: 0.1, transparent: true, opacity: 0.45, depthWrite: false }),
  };
}

// --------------------------------------------------------------------------------------------
// KAWS x Astro Boy, grey colourway, ~340 mm to the hair spike (photos 87, 72, 70, 168)
// --------------------------------------------------------------------------------------------
function ell(rx: number, ry: number, rz: number, m: THREE.Material, seg = 24) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  g.scale(rx, ry, rz);
  return mesh(g, m);
}

/** a cartoon glove: palm, four sausage fingers, a thumb and a rolled cuff */
function glove(m: ToyMats, side: number) {
  const g = grp('glove');
  g.add(ell(0.017, 0.02, 0.012, m.vinylWhite));
  for (let i = 0; i < 3; i++) {
    const f = taperTube([[side * (-0.008 + i * 0.008), 0.016, 0.0], [side * (-0.009 + i * 0.009), 0.03, 0.004], [side * (-0.008 + i * 0.009), 0.038, 0.009]], [0.0062, 0.006, 0.0055], m.vinylWhite, 8, 10);
    g.add(f);
  }
  g.add(taperTube([[side * 0.014, 0.0, 0.004], [side * 0.022, 0.012, 0.01], [side * 0.022, 0.022, 0.012]], [0.0062, 0.006, 0.0055], m.vinylWhite, 8, 10));
  const cuff = new THREE.TorusGeometry(0.0125, 0.0055, 10, 20);
  const c = mesh(cuff, m.vinylWhite); c.rotation.x = Math.PI / 2; c.position.y = -0.018;
  g.add(c);
  return g;
}

/** the sculpted vinyl figure lives in _toy-kaws.ts (one watertight SDF surface) */
export function buildKaws(_m: ToyMats) {
  const g = grp('kaws-astro-boy');
  g.add(buildKawsAstro());
  return g;
}

let birdCache: THREE.BufferGeometry | null = null;
/** 45 mm hematite crow: SDF-sculpted so wings and tail grow out of the body */
function birdGeo() {
  if (birdCache) return birdCache;
  const P: Prim[] = [
    { d: rotated(ellipsoid([0, 0.014, 0], [0.011, 0.01, 0.019]), [0, 0.014, 0], [0.25, 0, 0]), k: 0.004 },
    { d: sdSphere([0, 0.026, 0.015], 0.0078), k: 0.006 },
    { d: spike([0, 0.025, 0.021], [0, 0.023, 0.031], 0.0032, 0.0006), k: 0.002 },
    // folded wings: flattened ellipsoids along the flanks, tips crossing over the tail
    { d: rotated(ellipsoid([0.008, 0.017, -0.004], [0.004, 0.008, 0.017]), [0.008, 0.017, -0.004], [0.35, 0.15, 0]), k: 0.002 },
    { d: rotated(ellipsoid([-0.008, 0.017, -0.004], [0.004, 0.008, 0.017]), [-0.008, 0.017, -0.004], [0.35, -0.15, 0]), k: 0.002 },
    // fanned tail, raised
    { d: roundBox([0, 0.016, -0.026], [0.007, 0.0012, 0.011], 0.001, [-0.45, 0, 0]), k: 0.003 },
    // legs and feet
    { d: capsule([0.004, 0.006, 0.002], [0.004, 0.0, 0.003], 0.0013), k: 0.002 },
    { d: capsule([-0.004, 0.006, 0.002], [-0.004, 0.0, 0.003], 0.0013), k: 0.002 },
    { d: capsule([0.004, 0.0008, -0.002], [0.004, 0.0008, 0.008], 0.0011), k: 0.001 },
    { d: capsule([-0.004, 0.0008, -0.002], [-0.004, 0.0008, 0.008], 0.0011), k: 0.001 },
  ];
  for (const q of P) q.color = '#ffffff';
  birdCache = sculpt(P, { box: new THREE.Box3(new THREE.Vector3(-0.02, 0, -0.045), new THREE.Vector3(0.02, 0.04, 0.035)), cell: 0.0006 });
  birdCache.deleteAttribute('color');
  return birdCache;
}

// --------------------------------------------------------------------------------------------
// red acrylic two-tier display stand with perforated white S-legs and a small dark bird on top
// --------------------------------------------------------------------------------------------
export function buildRedStand(m: ToyMats) {
  const g = grp('red-stand');
  const disc = (r: number, y: number) => {
    const d = cyl(r, r, 0.006, [m.redAcrylic, m.redAcrylic, m.redAcrylic], 40);
    d.position.y = y;
    return d;
  };
  g.add(disc(0.043, 0.003));
  g.add(disc(0.039, 0.106));
  // two laser-cut white acrylic legs: flat S-curved strips, 3 mm thick, with a row of round
  // holes down their centre line (photos 86/87), cut as real holes so they print/read through
  for (const s of [-1, 1]) {
    const H = 0.097, W = 0.011;
    const cx = (t: number) => s * (0.004 + 0.016 * Math.sin(t * Math.PI * 1.15 + 0.3));
    const left: THREE.Vector2[] = [], right: THREE.Vector2[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, y = t * H;
      // the strip flares a little at each foot where it is slotted into the disc
      const w = W * (1 + 0.35 * (Math.exp(-((t / 0.08) ** 2)) + Math.exp(-(((1 - t) / 0.08) ** 2))));
      left.push(new THREE.Vector2(cx(t) - w / 2, y));
      right.push(new THREE.Vector2(cx(t) + w / 2, y));
    }
    const sh = new THREE.Shape([...left, ...right.reverse()]);
    for (let k = 1; k < 9; k++) {
      const t = k / 9;
      const hole = new THREE.Path();
      hole.absarc(cx(t), t * H, 0.0024, 0, Math.PI * 2, true);
      sh.holes.push(hole);
    }
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0004, bevelSize: 0.0004, bevelSegments: 1, curveSegments: 16 });
    geo.translate(0, 0.006, -0.0015);
    const leg = mesh(geo, m.white, 'stand-leg');
    leg.rotation.y = s > 0 ? 0.35 : -0.35 + Math.PI;
    g.add(leg);
  }
  // the bird: a dark hematite crow, sculpted (body, head, beak, folded wings, fanned tail, legs)
  const bird = new THREE.Mesh(birdGeo(), new THREE.MeshPhysicalMaterial({ color: '#6a6e76', roughness: 0.25, metalness: 0.9, clearcoat: 0.4 }));
  bird.name = 'bird';
  bird.castShadow = bird.receiveShadow = true;
  bird.position.set(0.006, 0.109, 0.0); bird.rotation.y = 0.8;
  g.add(bird);
  return g;
}

// --------------------------------------------------------------------------------------------
// white radial "turbine" desk fan/clock: drum with 24 vanes, blue dial ring, orange markers,
// a U-bracket onto a flat foot with a little tray in front (photos 87, 168, 72)
// --------------------------------------------------------------------------------------------
export function buildTurbineFan(m: ToyMats) {
  const g = grp('turbine-fan');
  const R = 0.07, D = 0.06, cy = 0.1;
  const drum = grp('drum');
  // drum shell: one lathed profile (axis = local z) — outer wall, a rolled front lip that turns
  // inward, a thin inner wall, a back wall closing the duct. Smooth, printable, no gaps.
  const prof: [number, number][] = [
    [0.0, -D / 2], [R - 0.012, -D / 2], [R - 0.004, -D / 2 + 0.002], [R, -D / 2 + 0.008],
    [R + 0.0005, D / 2 - 0.01], [R, D / 2 - 0.004], [R - 0.003, D / 2], [R - 0.007, D / 2 + 0.0005],
    [R - 0.0095, D / 2 - 0.002], [R - 0.0095, -D / 2 + 0.008], [0.0, -D / 2 + 0.008],
  ];
  const shellGeo = new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(r, z)), 72);
  shellGeo.rotateX(Math.PI / 2); // lathe y -> z
  drum.add(mesh(shellGeo, m.white, 'fan-shell'));
  // vanes: 22 swept blades between the hub and the inner wall, each a thin curved sheet
  // (an arc in the face plane, slightly twisted along the duct depth)
  const vaneGeo = (() => {
    const n = 10, rIn = 0.031, rOut = R - 0.0095, t = 0.0016;
    const pos: number[] = [], idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const r = rIn + (rOut - rIn) * u;
      const a = 0.32 * u * u; // backward-swept curve (photo 87: nearly radial)
      for (const zf of [-1, 1]) for (const side of [-1, 1]) {
        const z = zf * (D / 2 - 0.006);
        const tw = zf * 0.08 * u; // twist along depth
        const aa = a + tw + (side * t) / (2 * r);
        pos.push(Math.cos(aa) * r, Math.sin(aa) * r, z);
      }
    }
    // 4 verts per station: (zb,-),(zb,+),(zf,-),(zf,+)
    for (let i = 0; i < n; i++) {
      const b = i * 4, c = b + 4;
      const quad = (p: number, q: number) => idx.push(b + p, c + p, b + q, b + q, c + p, c + q);
      quad(0, 2); quad(3, 1); quad(1, 0); quad(2, 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  })();
  const vm: THREE.Matrix4[] = [];
  for (let i = 0; i < 22; i++) vm.push(new THREE.Matrix4().makeRotationZ((i / 22) * Math.PI * 2));
  const vaneMat = (m.white as THREE.MeshStandardMaterial).clone();
  vaneMat.side = THREE.DoubleSide;
  drum.add(instanced(vaneGeo, vaneMat, vm, 'fan-vanes'));
  // hub: a domed drum with the printed dial face (blue ring of minute marks, numbers, an
  // orange index wedge at 6 o'clock), slightly proud of the vane faces
  const hub = new THREE.LatheGeometry([[0, D / 2 - 0.002], [0.026, D / 2 - 0.002], [0.031, D / 2 - 0.006], [0.031, -D / 2 + 0.01], [0, -D / 2 + 0.01]]
    .map(([r, z]) => new THREE.Vector2(r, z)), 48);
  hub.rotateX(Math.PI / 2);
  drum.add(mesh(hub, m.white, 'fan-hub'));
  const dial = canvasTex(512, 512, (c, w) => {
    const k = w / 256;
    c.fillStyle = '#f5f4f0'; c.fillRect(0, 0, w, w);
    c.save(); c.scale(k, k);
    c.strokeStyle = '#2a52a8'; c.lineWidth = 3.5; c.beginPath(); c.arc(128, 128, 112, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
      const L = i % 5 ? 6 : 13;
      c.lineWidth = i % 5 ? 2 : 4;
      c.beginPath(); c.moveTo(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110); c.lineTo(128 + Math.cos(a) * (110 - L), 128 + Math.sin(a) * (110 - L)); c.stroke();
    }
    c.fillStyle = '#2a52a8'; c.font = 'bold 17px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      c.fillText(String(i * 5), 128 + Math.cos(a) * 78, 128 + Math.sin(a) * 78);
    }
    c.restore();
  });
  const dm = mesh(new THREE.CircleGeometry(0.026, 48), new THREE.MeshStandardMaterial({ map: dial, roughness: 0.35 }), 'fan-dial');
  dm.position.z = D / 2 - 0.0015; drum.add(dm);
  // orange index wedge on the vane ring below the hub (photo 87)
  const wedge = new THREE.Shape([new THREE.Vector2(-0.006, 0), new THREE.Vector2(0.006, 0), new THREE.Vector2(0.008, 0.02), new THREE.Vector2(-0.008, 0.02)]);
  const wg = new THREE.ExtrudeGeometry(wedge, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0008, bevelSegments: 2 });
  const wm = mesh(wg, m.orange, 'fan-index');
  wm.rotation.z = Math.PI;
  wm.position.set(0, -0.032, D / 2 - 0.004);
  drum.add(wm);
  // orange cap block across the top of the rim, wrapping over toward the back (photo 87)
  {
    const cap = rbox(0.03, 0.014, 0.034, 0.004, m.orange, 3);
    cap.position.set(0, R + 0.004, -0.006);
    drum.add(cap);
  }
  // brass air fitting + red lead out of the back top
  drum.add(at(cyl(0.0045, 0.0045, 0.02, m.brass, 16), 0.03, R - 0.014, -D / 2 - 0.009).rotateX(Math.PI / 2));
  drum.add(tube([[0.03, R - 0.014, -D / 2 - 0.019], [0.045, R + 0.004, -0.05], [0.055, R - 0.02, -0.075]], 0.0016, m.red, 20, 6));
  drum.position.set(0, cy, 0);
  g.add(drum);
  // stand: a single flat post up the back centre into a round boss on the drum's back wall,
  // standing in a flat foot plate; an open tray-box sits on the foot in front (photo 87)
  g.add(at(rbox(0.024, cy - 0.006, 0.01, 0.004, m.white, 3), 0, (cy - 0.006) / 2 + 0.004, -D / 2 - 0.01));
  g.add(at(cyl(0.017, 0.017, 0.012, m.white, 32), 0, cy, -D / 2 - 0.004).rotateX(Math.PI / 2));
  g.add(at(rbox(0.11, 0.007, 0.11, 0.004, m.white, 3), 0, 0.0035, 0.01));
  const tray = grp('tray');
  const tw = 0.05, td = 0.034, th = 0.024, t = 0.0025;
  tray.add(at(rbox(tw, t, td, 0.001, m.white, 1), 0, 0.007 + t / 2, 0));
  for (const [x, z, w, d] of [[0, td / 2 - t / 2, tw, t], [0, -td / 2 + t / 2, tw, t], [tw / 2 - t / 2, 0, t, td], [-tw / 2 + t / 2, 0, t, td]] as number[][]) {
    tray.add(at(rbox(w, th, d, 0.001, m.white, 1), x, 0.007 + th / 2, z));
  }
  tray.position.set(0, 0, 0.045);
  g.add(tray);
  return g;
}

// --------------------------------------------------------------------------------------------
// white spring over a black faceted polyhedron on a two-step hexagonal plinth (photos 87/168/83)
// --------------------------------------------------------------------------------------------
export function buildSpringHex(m: ToyMats) {
  // A maglev planter (photo 87 zoom): a faceted black pot floating ~12 mm over a white hexagonal
  // magnet base with a chamfered top edge; a white rope spring sculpture coils in the pot and
  // rises in two loose loops.
  const g = grp('spring-hex');
  // base: one hex slab, the top edge chamfered wide (the bevel reads as a second step)
  {
    const r = 0.078, h = 0.016;
    const pts: V2[] = [];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: h - 0.006, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.009, bevelSegments: 1 });
    // keep only the top bevel: squash the bottom bevel flat
    const p = geo.getAttribute('position');
    for (let k = 0; k < p.count; k++) if (p.getZ(k) < 0) p.setZ(k, 0);
    p.needsUpdate = true;
    geo.computeVertexNormals();
    geo.rotateX(-Math.PI / 2);
    g.add(mesh(geo, m.white, 'maglev-base'));
  }
  // pot: a faceted, low-poly bowl — rings of 7 vertices, alternate rings twisted half a step so
  // every face is a triangle (photo: sharp triangular facets), flat-shaded black gloss
  const potY = 0.016 + 0.006 + 0.012; // floats above the base
  {
    const N = 7;
    const rings: [number, number, number][] = [ // [radius, y, twist]
      [0.016, 0, 0], [0.036, 0.012, 0.5], [0.044, 0.028, 0], [0.04, 0.044, 0.5], [0.032, 0.054, 0],
    ];
    const pos: number[] = [];
    const ring = (k: number, i: number) => {
      const [r, y, tw] = rings[k];
      const a = ((i + tw) / N) * Math.PI * 2;
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    };
    const tri = (a: number[], b: number[], c: number[]) => pos.push(...a, ...b, ...c);
    for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < N; i++) {
      const a0 = ring(k, i), a1 = ring(k, i + 1), b0 = ring(k + 1, i), b1 = ring(k + 1, i + 1);
      if (rings[k + 1][2] > rings[k][2]) { tri(a0, b0, a1); tri(a1, b0, b1); } else { tri(a0, b0, b1); tri(a0, b1, a1); }
    }
    // bottom and top caps
    for (let i = 0; i < N; i++) { tri([0, 0, 0], ring(0, i), ring(0, i + 1)); }
    const top = rings.length - 1, ty = rings[top][1];
    for (let i = 0; i < N; i++) { tri([0, ty, 0], ring(top, i + 1), ring(top, i)); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const pot = mesh(geo, m.blackFacet, 'maglev-pot');
    (pot.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    pot.position.y = potY;
    g.add(pot);
    // white "soil" disc sunk just inside the rim
    g.add(at(cyl(0.029, 0.029, 0.002, m.white, 7), 0, potY + ty - 0.001, 0));
  }
  // rope spring: two tight coils sitting in the pot, then two wider loose loops, drawn as one
  // rope with a twisted-strand surface (radial ripple that spirals along the rope)
  {
    const pts: THREE.Vector3[] = [];
    const y0 = potY + 0.056;
    const turns = 4;
    for (let i = 0; i <= 320; i++) {
      const t = i / 320, a = t * turns * Math.PI * 2;
      const r = t < 0.5 ? 0.024 + 0.002 * t : 0.025 + 0.004 * (t - 0.5);
      const y = y0 + (t < 0.5 ? t * 0.012 : 0.006 + (t - 0.5) * 0.12) + 0.004 * Math.sin(a * 0.5);
      const tilt = t > 0.5 ? 0.12 * Math.sin(a) : 0;
      pts.push(new THREE.Vector3(Math.cos(a) * r, y + tilt * r, Math.sin(a) * r));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 640, 0.0042, 10, false);
    const p = geo.getAttribute('position');
    const n = geo.getAttribute('normal');
    for (let k = 0; k < p.count; k++) {
      const seg = Math.floor(k / 11), j = k % 11;
      const rip = 0.00035 * Math.sin((j / 10) * Math.PI * 2 * 3 + seg * 0.9);
      p.setXYZ(k, p.getX(k) + n.getX(k) * rip, p.getY(k) + n.getY(k) * rip, p.getZ(k) + n.getZ(k) * rip);
    }
    geo.computeVertexNormals();
    const rope = new THREE.MeshStandardMaterial({ color: '#f3f2ee', roughness: 0.95, name: 'rope' });
    g.add(mesh(geo, rope, 'rope-spring'));
  }
  return g;
}

// --------------------------------------------------------------------------------------------
// ice-blue acrylic shard cluster behind the fan (photos 85, 86, 87, 168). A fan of flat,
// translucent sky-blue blades whose bases meet in a small clear foot and which spread in the
// plane the desk cameras see (local XY, front = +z; desk-west yaws +z toward photos 85-87).
// Photo 85, left to right: a jagged piece, the tall round-tipped tongue, a mid blade, the sharp
// spike just right of the tongue, and a paler back slab with a dark vertical edge. Only the top
// ~67 mm clears the fan drum from 85-87, and every blade reaches into it: tips at 0.19-0.20
// (jagged, slab), 0.215 (mid), 0.222 (spike) and 0.242 (tongue) above the desk; the bundle is
// only ~45 mm wide up there. Tongue tip triangulated (85/168/87, misses <= 0.2 cm) at (-2.632, 1.062, 1.734) — 0.242
// above the desk; local tip = (+0.010, 0.242, 0).
// --------------------------------------------------------------------------------------------
export function buildCrystal(m: ToyMats) {
  const g = grp('blue-crystal');
  const blade = (pts: [number, number][], thick: number, tilt: number, yaw: number, x: number, z: number, bend: number, tint: string, opacity: number, sy = 1, roundTip = false) => {
    const s = new THREE.Shape();
    if (roundTip) {
      // A true semicircular tongue end, not the pentagonal/chamfered point visible in r12.
      s.moveTo(-0.006, 0); s.lineTo(0.008, 0); s.lineTo(0.0075, 0.20);
      s.lineTo(0.0066, 0.233); s.absarc(0, 0.233, 0.0066, 0, Math.PI, false);
      s.lineTo(-0.0068, 0.20); s.lineTo(-0.0065, 0.12); s.lineTo(-0.006, 0.05); s.closePath();
    } else {
      // The lower jagged blades are a tight bundle in 85; r12 spread them twice as wide.
      pts.forEach(([px, py], i) => i ? s.lineTo(px * 0.65, py * sy) : s.moveTo(px * 0.65, py * sy));
      s.closePath();
    }
    const geo = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelSize: 0.0007, bevelThickness: 0.0005, bevelSegments: 2, curveSegments: 6 });
    geo.translate(0, 0, -thick / 2);
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      p.setZ(i, p.getZ(i) + bend * y * y);
    }
    geo.computeVertexNormals();
    const mat = m.crystalBlue.clone();
    mat.color.set(tint);
    mat.opacity = opacity;
    // the acrylic reads sky-blue against the white wall in every frame (photo 85 blade core
    // ~ wall x (0.70, 0.85, 1.0)): a little self-tint keeps thin blades from going white
    mat.emissive.set(tint).multiplyScalar(0.12);
    const f = mesh(geo, mat);
    f.position.set(x, 0.006, z);
    f.rotation.set(0, yaw, tilt, 'YXZ'); // lean in the face plane first, then turn
    return f;
  };
  // back to front so the transparent faces sort sensibly from the desk cameras
  // E back slab: broad, pale, a ragged top, its right edge reads as a dark vertical line
  g.add(blade([[-0.017, 0], [0.017, 0], [0.018, 0.07], [0.016, 0.128], [0.010, 0.118], [0.004, 0.134], [-0.004, 0.11], [-0.012, 0.118], [-0.018, 0.06]], 0.004, 0.01, 0.18, -0.004, -0.011, 0.06, '#a8cdea', 0.36, 1.5));
  // A jagged piece on the left, notched top
  g.add(blade([[-0.016, 0], [0.010, 0], [0.011, 0.04], [0.006, 0.07], [0.002, 0.058], [-0.003, 0.092], [-0.008, 0.07], [-0.012, 0.098], [-0.016, 0.075], [-0.019, 0.035]], 0.0035, 0.01, -0.22, -0.006, 0.003, 0.08, '#94c3e6', 0.5, 2.0));
  // C the tall tongue: near-parallel sides, a rounded tip, a slight backward curl
  g.add(blade([[-0.006, 0], [0.008, 0], [0.0085, 0.06], [0.008, 0.13], [0.0075, 0.2], [0.0068, 0.226], [0.004, 0.236], [0.0, 0.2395], [-0.004, 0.237], [-0.0065, 0.228], [-0.0068, 0.2], [-0.0065, 0.12], [-0.006, 0.05]], 0.0034, -0.04, 0.05, 0.0, 0.0, -0.15, '#8cc0e8', 0.6, 1, true));
  // D mid blade, pointed, just right of the tongue
  g.add(blade([[-0.006, 0], [0.007, 0], [0.008, 0.06], [0.005, 0.11], [0.0015, 0.152], [-0.002, 0.13], [-0.005, 0.08]], 0.003, -0.03, -0.16, 0.005, 0.006, 0.08, '#86bae4', 0.55, 1.42));
  // B the sharp spike, just right of the tongue tip
  g.add(blade([[-0.0045, 0], [0.006, 0], [0.006, 0.05], [0.0035, 0.12], [0.0005, 0.176], [-0.0025, 0.12], [-0.0045, 0.05]], 0.003, -0.04, 0.26, 0.008, 0.01, 0.12, '#78b0e0', 0.62, 1.26));
  // clear foot the blades are slotted into (hidden behind the fan drum in every frame)
  const foot = m.crystalBlue.clone();
  foot.color.set('#c6e0f2');
  foot.opacity = 0.5;
  g.add(at(cyl(0.022, 0.025, 0.007, foot, 24), 0, 0.0035, 0));
  return g;
}

// --------------------------------------------------------------------------------------------
// medallion (photos 71, 72): a flat brass band round a cream bezel and a large domed red
// centre, a red barrel bail at one o'clock, hung on a stiff red wire. Outer diameter ~36 mm.
// Centre ~0.195 above the desk (triangulated y 1.02 on the 0.82 desktop; 72+87 1.8 cm).
// --------------------------------------------------------------------------------------------
export function buildMedallion(m: ToyMats, hook: V3 = [0.02, 0.232, 0.1]) {
  const g = grp('medallion');
  const gemMat = new THREE.MeshPhysicalMaterial({ color: '#b8121a', roughness: 0.16, metalness: 0.04, clearcoat: 1, clearcoatRoughness: 0.08 });
  const brass = new THREE.MeshStandardMaterial({ color: '#c9a45c', roughness: 0.3, metalness: 1, side: THREE.DoubleSide });
  const cream = new THREE.MeshPhysicalMaterial({ color: '#e9dcc0', roughness: 0.35, clearcoat: 0.6, side: THREE.DoubleSide });
  // nothing stands under it in 71/72: it hangs on a stiff red wire hooked over the raised KAWS
  // glove (the wire leaves the bail up and to the right, kinks, and disappears behind the glove)
  const C = 0.195;
  const disc = grp('disc');
  disc.position.set(0, C, 0);
  // flat brass band (photo 71: a broad annulus, not a round wire), rounded edges
  const band = lathe([[0.0124, -0.0014], [0.0172, -0.0014], [0.0181, -0.0005], [0.0181, 0.0005], [0.0172, 0.0014], [0.0124, 0.0014], [0.0121, 0], [0.0124, -0.0014]], brass, 48);
  band.rotation.x = Math.PI / 2; band.name = 'gold-band';
  disc.add(band);
  // cream enamel bezel between the band and the red centre
  const bez = lathe([[0.0085, -0.0011], [0.0124, -0.0011], [0.0124, 0.0011], [0.0085, 0.0016], [0.0085, -0.0011]], cream, 40);
  bez.rotation.x = Math.PI / 2; bez.name = 'bezel';
  disc.add(bez);
  // large domed red centre (≈ half the outer diameter) with a thin brass collet
  const gem = lathe([[0, 0], [0.0088, 0], [0.0089, 0.0008], [0.007, 0.0026], [0.0035, 0.0036], [0, 0.0039]], gemMat, 36);
  gem.rotation.x = Math.PI / 2;
  gem.position.z = 0.0008;
  gem.name = 'red-centre';
  disc.add(gem);
  const collet = mesh(new THREE.TorusGeometry(0.0088, 0.0006, 8, 40), brass, 'collet');
  collet.position.z = 0.0012;
  disc.add(collet);
  // red barrel bail at about one o'clock, lying along the rim
  const ba = Math.PI / 3, bR = 0.0188;
  const bail = at(cyl(0.0027, 0.0027, 0.009, gemMat, 14), Math.cos(ba) * bR, Math.sin(ba) * bR, 0);
  bail.rotation.z = ba;
  bail.name = 'bail';
  disc.add(bail);
  g.add(disc);
  // the wire: out of the bail, up, a kink, then over toward the glove
  const b0: V3 = [Math.cos(ba) * (bR + 0.002), C + Math.sin(ba) * (bR + 0.002), 0];
  const [hx, hy, hz] = hook;
  g.add(tube([b0, [b0[0] + 0.004, b0[1] + 0.012, 0.002], [b0[0] + 0.002, b0[1] + 0.022, 0.006], [b0[0] + 0.008, b0[1] + 0.03, 0.012],
    [hx * 0.6, (b0[1] + 0.03 + hy) / 2 + 0.006, hz * 0.55], [hx, hy, hz]], 0.0009, gemMat, 48, 6));
  return g;
}

// --------------------------------------------------------------------------------------------
// clear-lavender Frieren figure (stand-in; mostly hidden) ~0.26 tall
// --------------------------------------------------------------------------------------------
/** clear-lavender Frieren figure (hidden behind KAWS; simplified stand-in in _toy-lavender.ts) */
export function buildLavenderFigure(_m: ToyMats) {
  return buildLavenderStandIn();
}

// --------------------------------------------------------------------------------------------
// the Qur'an standing upright: dark leather cover, gold border and a central square-kufic panel
// --------------------------------------------------------------------------------------------
export function buildQuran(m: ToyMats) {
  const g = grp('quran');
  // cover 125 x 220 mm: top corners triangulated from 72+87 (misses 0.7-1.7 cm) span 0.120-0.129 m
  // and stand 0.213-0.229 above the desk (the 170 x 235 block read 1.38x too wide in r11 72)
  const W = 0.125, Hh = 0.22, T = 0.05;
  const cover = canvasTex(272, 480, (c, w, h) => {
    c.fillStyle = '#251812'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#b8903f'; c.lineWidth = 6; c.strokeRect(14, 14, w - 28, h - 28);
    c.lineWidth = 2; c.strokeRect(26, 26, w - 52, h - 52);
    // central square-kufic block: a gold maze of right-angled strokes in a cream field
    const x0 = 60, y0 = 120, s = w - 120;
    c.fillStyle = '#d9cfb3'; c.fillRect(x0, y0, s, s * 1.05);
    c.fillStyle = '#3a2a1e';
    let seed = 11; const r = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
    // square kufic is built on a grid and is four-fold symmetric: generate one quadrant of
    // connected strokes (runs of cells) and mirror it both ways
    const n = 14, cell = s / n, half = n / 2;
    const q: boolean[][] = Array.from({ length: half }, () => Array(half).fill(false));
    for (let j = 0; j < half; j += 2) for (let i = 0; i < half; i++) q[j][i] = r() < 0.8; // horizontal bars
    for (let i = 0; i < half; i += 2) for (let j = 0; j < half; j++) if (r() < 0.35) q[j][i] = true; // risers
    for (let j = 0; j < half; j++) for (let i = 0; i < half; i++) {
      if (!q[j][i]) continue;
      for (const [ii, jj] of [[i, j], [n - 1 - i, j], [i, n - 1 - j], [n - 1 - i, n - 1 - j]]) {
        c.fillRect(x0 + ii * cell, y0 + jj * cell * 1.05, cell + 0.5, cell * 1.05 + 0.5);
      }
    }
    c.strokeStyle = '#b8903f'; c.lineWidth = 4; c.strokeRect(x0 - 6, y0 - 6, s + 12, s * 1.05 + 12);
    // arched header and footer ornaments
    c.beginPath(); c.arc(w / 2, 92, 40, Math.PI, 0); c.stroke();
    c.beginPath(); c.arc(w / 2, h - 70, 30, 0, Math.PI); c.stroke();
  });
  const cm = new THREE.MeshStandardMaterial({ map: cover, roughness: 0.5, metalness: 0.2 });
  // page block: cream, recessed 3 mm inside the boards, its fore-edge finely lined, the front edge
  // gently concave (a real text block), the spine edge rounded
  const pages = canvasTex(64, 256, (c, w, h) => {
    c.fillStyle = '#efe6cf'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 2) { c.fillStyle = `rgba(150,130,95,${0.12 + 0.1 * ((x * 7) % 3)})`; c.fillRect(x, 0, 1, h); }
  });
  pages.wrapS = pages.wrapT = THREE.RepeatWrapping;
  const pageMat = new THREE.MeshStandardMaterial({ map: pages, roughness: 0.9 });
  {
    const pb = new THREE.BoxGeometry(W - 0.006, Hh - 0.008, T - 0.008, 12, 2, 6);
    const p = pb.getAttribute('position');
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), z = p.getZ(k);
      // fore-edge (x = +W/2) concave, spine (x = -W/2) rounded convex
      const zn = z / ((T - 0.008) / 2);
      if (x > 0) p.setX(k, x - 0.0025 * (1 - zn * zn) * (x / (W / 2)));
      else p.setX(k, x - 0.003 * (1 - zn * zn) * (-x / (W / 2)));
    }
    p.needsUpdate = true;
    pb.computeVertexNormals();
    g.add(at(mesh(pb, pageMat, 'page-block'), 0.001, Hh / 2, 0));
  }
  // boards: 3 mm, square-edged with a soft bevel, overhanging the pages; front carries the cover art
  const boardGeo = new RoundedBoxGeometry(W, Hh, 0.0032, 2, 0.0012);
  g.add(at(mesh(boardGeo, [m.leather, m.leather, m.leather, m.leather, cm, m.leather] as THREE.Material[], 'front-board'), 0, Hh / 2, T / 2 - 0.0016));
  g.add(at(mesh(boardGeo, m.leather, 'back-board'), 0, Hh / 2, -T / 2 + 0.0016));
  // rounded spine: a half-cylinder of leather joining the boards, with raised bands and gilt rules
  const spine = new THREE.CylinderGeometry(T / 2, T / 2, Hh, 24, 1, true, Math.PI, Math.PI);
  g.add(at(mesh(spine, m.leather, 'spine'), -W / 2 + 0.002, Hh / 2, 0));
  for (const y of [0.04, 0.085, 0.13, 0.175, 0.2]) {
    const band = new THREE.TorusGeometry(T / 2 + 0.0004, 0.0013, 6, 24, Math.PI);
    const b = mesh(band, m.gold, 'spine-band');
    b.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    b.position.set(-W / 2 + 0.002, y, 0);
    g.add(b);
  }
  // headbands: tiny striped beads top and bottom of the text block at the spine
  for (const y of [0.0045, Hh - 0.0045]) g.add(at(cyl(0.0018, 0.0018, T - 0.012, m.red, 8), -W / 2 + 0.006, y, 0).rotateX(Math.PI / 2));
  return g;
}

/**
 * Teal coin bank (photos 70, 72, 87). The slot is on the TOP: 70 looks down onto the top and shows
 * the slot centred on it, 87 sees the same face as a foreshortened top trapezoid, and 72 (30 deg
 * down) sees it nearly square with the slot running away from the camera. Triangulation:
 * slot centre (-2.784, 1.021, 1.464) from 70/72/87 (misses 0.3/0.4/0.3 cm); back top corners
 * (-2.797, 1.027, 1.501) and (-2.821, 1.026, 1.456) from 72+87, so the top is ~54 mm across by
 * ~60 mm deep: a small cube bank, matte deep cyan, softly rounded. A white sticker with three
 * rows of dark print covers most of the left side (72). Front = local +z, slot along z.
 */
export function buildTealBox(m: ToyMats) {
  const g = grp('teal-box');
  const W = 0.054, H = 0.06, D = 0.06;
  // photo 72 sets the colour: wall-relative (0.17, 0.72, 0.89) -> a deep cyan, matte plastic
  const teal = m.teal.clone();
  teal.color.set('#22a7c6');
  // Body stops below the slotted lid. The old two overlapping top patches occluded the black
  // opening and z-fought into a triangular fleck in the closest r12 view.
  g.add(at(rbox(W, H - 0.004, D, 0.0035, teal, 3), 0, (H - 0.004) / 2, 0));
  const lid = new THREE.Shape();
  const a = W / 2, b = D / 2, r = 0.0035;
  lid.moveTo(-a + r, -b); lid.lineTo(a - r, -b); lid.quadraticCurveTo(a, -b, a, -b + r);
  lid.lineTo(a, b - r); lid.quadraticCurveTo(a, b, a - r, b);
  lid.lineTo(-a + r, b); lid.quadraticCurveTo(-a, b, -a, b - r);
  lid.lineTo(-a, -b + r); lid.quadraticCurveTo(-a, -b, -a + r, -b);
  const slot = new THREE.Path();
  slot.moveTo(-0.0023, -0.014); slot.lineTo(-0.0023, 0.014);
  slot.lineTo(0.0023, 0.014); slot.lineTo(0.0023, -0.014); slot.closePath();
  lid.holes.push(slot);
  const lg = new THREE.ExtrudeGeometry(lid, { depth: 0.003, bevelEnabled: true, bevelSize: 0.0004, bevelThickness: 0.0004, bevelSegments: 2, curveSegments: 12 });
  lg.rotateX(-Math.PI / 2);
  g.add(at(mesh(lg, teal, 'slotted-lid'), 0, H - 0.003, 0));
  // Real 3 mm-deep dark well, with no coplanar overlay covering it.
  g.add(at(box(0.0046, 0.0004, 0.028, m.vinylBlack), 0, H - 0.0038, 0));
  // white sticker on the left side face: three rows of dark print, illegible in every frame
  const lab = canvasTex(160, 160, (c, w, h) => {
    c.fillStyle = '#f2f4f2'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#4c5457';
    const rows: [number, number][][] = [[[14, 52], [74, 40], [122, 26]], [[14, 36], [58, 64], [130, 18]], [[14, 70], [92, 44]]];
    rows.forEach((row, i) => { for (const [x, bw] of row) c.fillRect(x, 30 + i * 44, bw, 18); });
  });
  const labelMat = new THREE.MeshStandardMaterial({ map: lab, roughness: 0.72 });
  const l = mesh(new THREE.PlaneGeometry(0.046, 0.046), labelMat, 'teal-label');
  l.position.set(-W / 2 - 0.0004, H * 0.52, 0.0);
  l.rotation.y = -Math.PI / 2;
  g.add(l);
  return g;
}

/** dark leather riser under the teal bank (hidden behind the Qur'an; lifts the top to y 1.025) */
export function buildTealRiser(m: ToyMats) {
  const g = grp('teal-box-riser');
  g.add(at(box(0.05, 0.145, 0.055, m.leather), 0, 0, 0));
  return g;
}


/** white ceramic bud vase with dark-green enamel leaves edged in gold and a gold leaf */
export function buildLeafVase(m: ToyMats) {
  const g = grp('leaf-vase');
  g.add(lathe([[0, 0], [0.03, 0], [0.038, 0.02], [0.036, 0.05], [0.022, 0.075], [0.014, 0.085], [0.016, 0.09], [0.011, 0.09], [0.0, 0.08]], m.white, 36));
  const leaf = (len: number, wid: number, mat: THREE.Material, rim: THREE.Material | null) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.quadraticCurveTo(wid, len * 0.45, 0, len); s.quadraticCurveTo(-wid, len * 0.45, 0, 0);
    const lg = grp('leaf');
    const geo = new THREE.ShapeGeometry(s, 16);
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.pow(p.getX(i) / wid, 2) * 0.012 - Math.pow(p.getY(i) / len, 2) * 0.02);
    geo.computeVertexNormals();
    lg.add(mesh(geo, mat));
    // ribs: fine diagonal veins (photo 69 shows a herringbone of pale veins)
    if (rim) {
      for (let i = 1; i < 9; i++) {
        const y = (i / 9) * len, w = wid * Math.sin((i / 9) * Math.PI) * 0.8;
        for (const sx of [-1, 1]) lg.add(tube([[0, y, 0.001], [sx * w * 0.5, y + 0.008, 0.002], [sx * w, y + 0.012, 0.003]], 0.0009, rim, 6, 4));
      }
      lg.add(tube([[0, 0, 0.001], [0, len * 0.5, 0.0], [0, len, -0.02]], 0.0014, rim, 12, 4));
    }
    return lg;
  };
  const l1 = leaf(0.15, 0.05, m.enamelGreen, m.gold); l1.position.set(0, 0.085, 0); l1.rotation.set(-0.5, 0.4, 0.5); g.add(l1);
  const l2 = leaf(0.13, 0.045, m.enamelGreen, m.gold); l2.position.set(0, 0.085, 0); l2.rotation.set(-0.3, -0.9, -0.4); g.add(l2);
  const l3 = leaf(0.12, 0.05, m.gold, null); l3.position.set(0, 0.085, 0); l3.rotation.set(-0.7, 2.5, 0.3); g.add(l3);
  g.add(tube([[0, 0.07, 0], [0.004, 0.1, 0], [0.01, 0.12, 0]], 0.002, m.gold, 8, 4));
  // the big round "paddle" leaves on stems (photo 69): dark-green enamel discs, slightly cupped
  for (const [len, r, ry, rz] of [[0.13, 0.034, -0.4, 0.35], [0.1, 0.026, 1.2, -0.3], [0.08, 0.02, 2.4, 0.2]] as number[][]) {
    const stem = new THREE.Group();
    stem.add(tube([[0, 0, 0], [0.004, len * 0.5, 0], [0, len, 0]], 0.0016, m.enamelGreen, 10, 5));
    const disc = new THREE.CircleGeometry(r, 32);
    const dp = disc.getAttribute('position');
    for (let k = 0; k < dp.count; k++) { const x = dp.getX(k), y = dp.getY(k); dp.setZ(k, -0.18 * (x * x + y * y) / r); }
    disc.computeVertexNormals();
    const leafMat = (m.enamelGreen as THREE.MeshStandardMaterial).clone();
    leafMat.side = THREE.DoubleSide;
    const dm = mesh(disc, leafMat, 'paddle-leaf');
    dm.position.set(0, len + r * 0.9, 0);
    stem.add(dm);
    stem.position.set(0, 0.08, 0);
    stem.rotation.set(0, ry, rz);
    g.add(stem);
  }
  return g;
}

/** black lacquer panel stand with a gold mirrored arch/crescent inlay (photo 72, right edge) */
export function buildBlackPanel(m: ToyMats) {
  // Photo 69: a tall black acrylic plaque (round-topped, 5 mm) standing in a slotted foot, with a
  // mirror-gold calligraphic cut-out — a big looping "و" (waw) — mounted proud of it on stand-offs.
  const g = grp('black-panel');
  const plaque = new THREE.Shape();
  const w = 0.056, h = 0.19;
  plaque.moveTo(-w / 2, 0); plaque.lineTo(w / 2, 0); plaque.lineTo(w / 2, h - w / 2);
  plaque.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); plaque.lineTo(-w / 2, 0);
  const pg = new THREE.ExtrudeGeometry(plaque, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0006, bevelSegments: 2, curveSegments: 24 });
  const gloss = new THREE.MeshPhysicalMaterial({ color: '#0d0d0f', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, name: 'black-acrylic' });
  const holder = new THREE.Group();
  holder.add(mesh(pg, gloss, 'plaque'));
  // the waw: a fat teardrop head on top, the stroke sweeping down and hooking left (built as a
  // closed outline, extruded, mirror gold)
  const waw = new THREE.Shape();
  waw.moveTo(0.004, 0.13);
  waw.bezierCurveTo(0.03, 0.13, 0.03, 0.09, 0.006, 0.088);
  waw.bezierCurveTo(0.024, 0.06, 0.02, 0.02, -0.022, 0.016);
  waw.bezierCurveTo(-0.004, 0.03, 0.008, 0.058, -0.008, 0.088);
  waw.bezierCurveTo(-0.022, 0.1, -0.018, 0.13, 0.004, 0.13);
  const hole = new THREE.Path();
  hole.absellipse(0.006, 0.11, 0.0065, 0.0085, 0, Math.PI * 2, true);
  waw.holes.push(hole);
  const wg = new THREE.ExtrudeGeometry(waw, { depth: 0.002, bevelEnabled: true, bevelThickness: 0.0005, bevelSize: 0.0005, bevelSegments: 2, curveSegments: 24 });
  const mirrorGold = new THREE.MeshPhysicalMaterial({ color: '#e2bd63', metalness: 1, roughness: 0.08, clearcoat: 0.5, name: 'mirror-gold' });
  holder.add(at(mesh(wg, mirrorGold, 'waw'), 0, 0.012, 0.0062));
  holder.position.y = 0.01;
  holder.rotation.x = -0.08;
  g.add(holder);
  // slotted foot block
  g.add(at(rbox(0.064, 0.012, 0.03, 0.003, gloss, 2), 0, 0.006, 0.002));
  return g;
}

/** paper-towel roll on a gilt scalloped holder with a faceted black finial */
export function buildPaperTowel(m: ToyMats) {
  const g = grp('paper-towel');
  // scalloped plate: 16 lobes
  const pts: V2[] = [];
  for (let i = 0; i < 160; i++) { const a = (i / 160) * Math.PI * 2; const r = 0.08 + 0.004 * Math.abs(Math.sin(a * 8)); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  const plate = extrude(pts, 0.008, m.gold, 0.0015, 1);
  plate.rotation.x = -Math.PI / 2; plate.position.y = 0.004;
  g.add(plate);
  // raised scalloped rim round the tray (photo 87: a wavy gilt lip ~10 mm tall)
  {
    const N = 320, H = 0.011, t = 0.0012;
    const pos: number[] = [], idx: number[] = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = 0.08 + 0.004 * Math.abs(Math.sin(a * 8));
      const top = H * (0.75 + 0.25 * Math.abs(Math.sin(a * 8)));
      for (const [rr, yy] of [[r, 0.004], [r, 0.004 + top], [r - t, 0.004 + top], [r - t, 0.004]]) pos.push(Math.cos(a) * rr, yy, Math.sin(a) * rr);
    }
    for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) {
      const a0 = i * 4 + k, a1 = i * 4 + ((k + 1) % 4), b0 = a0 + 4, b1 = a1 + 4;
      idx.push(a0, b0, a1, a1, b0, b1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const rimMat = (m.gold as THREE.MeshStandardMaterial).clone();
    rimMat.side = THREE.DoubleSide;
    g.add(mesh(geo, rimMat, 'tray-rim'));
  }
  g.add(at(cyl(0.012, 0.012, 0.25, m.gold, 16), 0, 0.133, 0));
  const fin = mesh(new THREE.OctahedronGeometry(0.018, 1).toNonIndexed(), m.blackFacet, 'finial');
  fin.position.y = 0.262; g.add(fin);
  // the roll: outer wall, top/bottom annuli, cardboard core
  const Ro = 0.071, Ri = 0.023, Hh = 0.28;
  const wall = cyl(Ro, Ro, Hh, m.paperTowel, 64, true);
  wall.position.y = 0.009 + Hh / 2; g.add(wall);
  for (const y of [0.009, 0.009 + Hh]) {
    const ann = mesh(new THREE.RingGeometry(Ri, Ro, 64, 3), new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.95, side: THREE.DoubleSide }));
    ann.rotation.x = -Math.PI / 2; ann.position.y = y; g.add(ann);
  }
  const core = cyl(Ri, Ri, Hh, new THREE.MeshStandardMaterial({ color: '#9b7b55', roughness: 0.9, side: THREE.DoubleSide }), 32, true);
  core.position.y = 0.009 + Hh / 2; g.add(core);
  // loose leading sheet: a slightly lifted flap down the front
  const flap = new THREE.PlaneGeometry(0.06, Hh * 0.96, 6, 10);
  const fp = flap.getAttribute('position');
  for (let i = 0; i < fp.count; i++) { const x = fp.getX(i); fp.setZ(i, Math.sqrt(Math.max(0, Ro * Ro - x * x)) + 0.002 + Math.max(0, -fp.getY(i)) * 0.03); }
  flap.computeVertexNormals();
  const fm = mesh(flap, m.paperTowel); fm.position.set(0.035, 0.009 + Hh / 2, 0); fm.rotation.y = 0.55;
  g.add(fm);
  return g;
}

// --------------------------------------------------------------------------------------------
// HG Strike Freedom Gundam — silver/chrome coating on Bandai Action Base
// Photos 82 / 168: on the G9 stand plate at (-2.11, 2.37). Identified from the open DRAGOON
// wing fan (8 blades), V-fin, and white curved action-base arm holding a flight pose.
// Each limb, armor plate and funnel is its own mesh inside one placeable group.
// --------------------------------------------------------------------------------------------
/** silver Strike Freedom (coating) on action base — photos 82/168 on the G9 stand plate */
export function buildGundam(_m: ToyMats) {
  return buildStrikeFreedom(); // hard-surface build in _toy-gundam.ts
}


