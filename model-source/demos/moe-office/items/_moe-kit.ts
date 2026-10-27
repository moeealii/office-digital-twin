import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Shared geometry, texture and material helpers for the detailed moe-office items. */
export type V3 = [number, number, number];

export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const DEG = THREE.MathUtils.degToRad;

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, name?: string) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (name) m.name = name;
  return m;
}

export function at<T extends THREE.Object3D>(obj: T, x: number, y: number, z: number, ry = 0) {
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  return obj;
}

export function rbox(w: number, h: number, d: number, r: number, mat: THREE.Material, seg = 3) {
  const rr = Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  return mesh(new RoundedBoxGeometry(w, h, d, seg, rr), mat);
}

export function slab(w: number, d: number, t: number, r: number, mat: THREE.Material) {
  return rbox(w, t, d, r, mat, 4);
}

export function cyl(rt: number, rb: number, h: number, mat: THREE.Material, seg = 24, open = false) {
  return mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat);
}

export function rod(a: V3, b: V3, r: number, mat: THREE.Material, seg = 12) {
  const A = v3(...a), B = v3(...b);
  const g = new THREE.CylinderGeometry(r, r, A.distanceTo(B), seg);
  const m = mesh(g, mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(v3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}

export function tube(pts: V3[], r: number, mat: THREE.Material, seg = 32, radial = 8) {
  return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => v3(...p))), seg, r, radial, false), mat);
}

export function pillow(w: number, h: number, d: number, mat: THREE.Material, r = 0.035) {
  const m = rbox(w, h, d, Math.min(r, h / 2 - 0.002), mat, 4);
  const p = m.geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2), y = p.getY(i) / (h / 2), z = p.getZ(i) / (d / 2);
    const k = 1 - 0.18 * Math.pow(Math.abs(y), 3) - 0.08 * Math.pow(Math.abs(x), 4);
    p.setXYZ(i, p.getX(i), p.getY(i), p.getZ(i) * k);
    if (Math.abs(z) > 0.48 && Math.abs(x) > 0.72) p.setY(i, p.getY(i) * 0.94);
  }
  p.needsUpdate = true;
  m.geometry.computeVertexNormals();
  return m;
}

export function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, repeat = 0) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d')!;
  draw(c, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat, repeat);
  return t;
}

export function grainTex(seed: number, base: string, dark: string, light: string) {
  return canvasTex(1024, 512, (c, w, h) => {
    const r = rng(seed);
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
    for (let k = 0; k < 190; k++) {
      const y = r() * h, amp = 3 + r() * 15, freq = 0.005 + r() * 0.018;
      c.beginPath();
      for (let x = -20; x <= w + 20; x += 8) {
        const yy = y + Math.sin(x * freq + r() * 0.2) * amp + Math.sin(x * freq * 3.1) * 1.2;
        if (x < 0) c.moveTo(x, yy); else c.lineTo(x, yy);
      }
      c.strokeStyle = r() < 0.55 ? dark : light;
      c.globalAlpha = 0.08 + r() * 0.22;
      c.lineWidth = 0.6 + r() * 2.8;
      c.stroke();
    }
    c.globalAlpha = 1;
    for (let k = 0; k < 16; k++) {
      const x = r() * w, y = r() * h;
      const g = c.createRadialGradient(x, y, 0, x, y, 30 + r() * 60);
      g.addColorStop(0, dark); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.12; c.fillStyle = g; c.fillRect(x - 80, y - 80, 160, 160);
    }
    c.globalAlpha = 1;
  }, 1);
}

export function marbleTex(seed = 4) {
  return canvasTex(1024, 1024, (c, w, h) => {
    const r = rng(seed);
    c.fillStyle = '#f2f0eb';
    c.fillRect(0, 0, w, h);
    for (let k = 0; k < 180; k++) {
      const x = r() * w, y = r() * h, len = 120 + r() * 500, a = -0.7 + r() * 1.4;
      c.beginPath();
      c.moveTo(x, y);
      for (let s = 1; s <= 24; s++) {
        const t = s / 24;
        c.lineTo(x + Math.cos(a) * len * t + Math.sin(t * 8 + k) * 9, y + Math.sin(a) * len * t + Math.cos(t * 8 + k) * 9);
      }
      c.strokeStyle = r() < 0.45 ? '#9b9a93' : '#c8c3b7';
      c.globalAlpha = 0.04 + r() * 0.16;
      c.lineWidth = 0.4 + r() * 2.2;
      c.stroke();
    }
    c.globalAlpha = 1;
  }, 1);
}

export function boucleTex() {
  return canvasTex(512, 512, (c, w, h) => {
    const r = rng(21);
    c.fillStyle = '#d9d4c9'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const x = r() * w, y = r() * h, a = r() * Math.PI, l = 2 + r() * 5;
      c.strokeStyle = r() < 0.45 ? '#bdb6a7' : r() < 0.6 ? '#f0ece3' : '#cac3b6';
      c.globalAlpha = 0.2 + r() * 0.45;
      c.lineWidth = 0.7 + r() * 1.2;
      c.beginPath(); c.arc(x, y, l, a, a + 1.5 + r() * 2); c.stroke();
    }
    c.globalAlpha = 1;
  }, 4);
}

export function rugTex() {
  return canvasTex(512, 768, (c, w, h) => {
    c.fillStyle = '#102a22'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#071812'; c.fillRect(22, 22, w - 44, h - 44);
    c.strokeStyle = '#2f6674'; c.lineWidth = 12; c.strokeRect(32, 32, w - 64, h - 64);
    c.strokeStyle = '#d8d1b8'; c.lineWidth = 3; c.strokeRect(46, 46, w - 92, h - 92);
    c.strokeStyle = '#8bb7c1'; c.lineWidth = 2;
    for (let y = 80; y < h - 70; y += 92) {
      for (let x = 78; x < w - 70; x += 92) {
        c.save(); c.translate(x, y); c.rotate(Math.PI / 4);
        c.strokeRect(-25, -25, 50, 50);
        c.strokeStyle = '#c9a963'; c.strokeRect(-12, -12, 24, 24);
        c.restore(); c.strokeStyle = '#8bb7c1';
      }
    }
  }, 0);
}

export type MoeMaterials = {
  whiteDesk: THREE.MeshPhysicalMaterial;
  whitePlastic: THREE.MeshStandardMaterial;
  creamLeather: THREE.MeshPhysicalMaterial;
  creamFabric: THREE.MeshStandardMaterial;
  boucle: THREE.MeshStandardMaterial;
  darkWood: THREE.MeshPhysicalMaterial;
  wood: THREE.MeshPhysicalMaterial;
  blackMetal: THREE.MeshStandardMaterial;
  black: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  marble: THREE.MeshPhysicalMaterial;
  greyMarble: THREE.MeshPhysicalMaterial;
  glass: THREE.MeshPhysicalMaterial;
  acrylic: THREE.MeshPhysicalMaterial;
  screenGlass: THREE.MeshPhysicalMaterial;
  screenBlack: THREE.MeshStandardMaterial;
  linen: THREE.MeshStandardMaterial;
  rug: THREE.MeshStandardMaterial;
  brassText: THREE.MeshStandardMaterial;
  ceramic: THREE.MeshStandardMaterial;
  greyFabric: THREE.MeshStandardMaterial;
  whiteboard: THREE.MeshStandardMaterial;
  paper: THREE.MeshStandardMaterial;
  cardboard: THREE.MeshStandardMaterial;
  liveEdge: THREE.MeshPhysicalMaterial;
};
let cache: MoeMaterials | undefined;

export function makeMaterials(): MoeMaterials {
  if (cache) return cache;
  const wood = grainTex(7, '#5c3a23', '#2a160d', '#936743');
  wood.repeat.set(1.2, 1.2);
  const boucle = boucleTex();
  const marble = marbleTex();
  marble.repeat.set(1, 1);
  const std = (name: string, color: THREE.ColorRepresentation, roughness = 0.6, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    m.name = name;
    return m;
  };
  const phys = (name: string, color: THREE.ColorRepresentation, roughness = 0.5, extra: THREE.MeshPhysicalMaterialParameters = {}) => {
    const m = new THREE.MeshPhysicalMaterial({ color, roughness, ...extra });
    m.name = name;
    return m;
  };
  cache = {
    whiteDesk: phys('desk-white', '#e4e2db', 0.33, { clearcoat: 0.24, clearcoatRoughness: 0.38 }),
    whitePlastic: std('white-plastic', '#d8d7d1', 0.42),
    creamLeather: phys('cream-leather', '#ded5c3', 0.62, {
      clearcoat: 0.12, clearcoatRoughness: 0.5, bumpMap: boucle.clone(), bumpScale: 0.0015,
    }),
    creamFabric: std('cream-fabric', '#ddd7c9', 1, 0, { map: boucle, roughnessMap: boucle }),
    boucle: std('boucle', '#d5cfc2', 1, 0, { map: boucle, bumpMap: boucle, bumpScale: 0.004 }),
    darkWood: phys('dark-walnut', '#ffffff', 0.45, { map: wood, clearcoat: 0.5, clearcoatRoughness: 0.25 }),
    wood: phys('warm-walnut', '#c7a078', 0.52, { map: wood, clearcoat: 0.3, clearcoatRoughness: 0.35 }),
    blackMetal: std('black-metal', '#17181a', 0.34, 0.55),
    black: std('black', '#111214', 0.68),
    rubber: std('rubber', '#111112', 0.92),
    steel: std('steel', '#aeb0b2', 0.28, 0.9),
    chrome: std('chrome', '#e2e3e3', 0.16, 1),
    brass: std('brass', '#b78b42', 0.3, 0.9),
    gold: std('gold', '#c6a15a', 0.26, 1),
    marble: phys('white-marble', '#ffffff', 0.2, { map: marble, clearcoat: 1, clearcoatRoughness: 0.1 }),
    greyMarble: phys('grey-marble', '#b9b5ab', 0.3, { map: marble, clearcoat: 0.7 }),
    glass: phys('smoked-glass', '#2d3337', 0.06, { metalness: 0.15, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    acrylic: phys('acrylic', '#f5f5f3', 0.08, { transparent: true, opacity: 0.32, side: THREE.DoubleSide }),
    screenGlass: phys('tv-glass', '#050607', 0.02, { clearcoat: 1 }),
    screenBlack: std('screen-frame', '#050505', 0.22, 0.35),
    linen: std('linen', '#e2ddcf', 0.96, 0, { map: boucle, bumpMap: boucle, bumpScale: 0.001 }),
    rug: std('prayer-rug', '#ffffff', 0.92, 0, { map: rugTex(), side: THREE.DoubleSide }),
    brassText: std('brass-inlay', '#b38d4a', 0.38, 0.75),
    ceramic: std('ceramic', '#e9e3d4', 0.35),
    greyFabric: std('grey-fabric', '#727474', 0.93, 0, { map: boucle }),
    whiteboard: std('whiteboard', '#e8e7e2', 0.4),
    paper: std('paper', '#f4f1e8', 0.85),
    cardboard: std('cardboard', '#a5784e', 0.9),
    liveEdge: phys('live-edge-marble', '#ffffff', 0.24, { map: marble.clone(), clearcoat: 0.8 }),
  };
  return cache;
}

export function shadowGroup(g: THREE.Object3D, cast = true, receive = true) {
  g.traverse(o => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = cast; m.receiveShadow = receive; }
  });
  return g;
}

/** Physics / knolling tags (Wes office-v2 pattern): named roots with these become separate knoll pieces. */
export function tag<T extends THREE.Object3D>(o: T, physics: Record<string, unknown>): T {
  o.userData.physics = physics;
  return o;
}
export function phys<T extends THREE.Object3D>(obj: T, mass: number, shape?: 'box' | 'sphere' | 'cylinder' | 'hull'): T {
  obj.userData.physics = shape ? { type: 'dynamic', mass, shape } : { type: 'dynamic', mass };
  return obj;
}
export function noPhys<T extends THREE.Object3D>(obj: T): T {
  obj.userData.physics = { type: 'none' };
  return obj;
}
export function staticBody<T extends THREE.Object3D>(obj: T): T {
  return tag(obj, { type: 'static' });
}

export function screenMaterial(texture: THREE.Texture) {
  const m = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55, side: THREE.DoubleSide });
  m.name = 'screen';
  return m;
}

export function labelTexture(lines: string[], bg = '#ecebe3', fg = '#252525') {
  return canvasTex(512, 320, (c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#bab8ae'; c.lineWidth = 4; c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    lines.forEach((line, i) => {
      c.font = `${i === 0 ? 'bold ' : ''}${i === 0 ? 66 : 36}px sans-serif`;
      c.fillText(line, w / 2, h * (0.42 + i * 0.2));
    });
  });
}

export function screenTexture(w: number, h: number, seed: number) {
  return canvasTex(w, h, (c, width, height) => {
    const r = rng(seed);
    const bg = c.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#17202b'); bg.addColorStop(0.55, '#29343e'); bg.addColorStop(1, '#0c1016');
    c.fillStyle = bg; c.fillRect(0, 0, width, height);
    c.globalAlpha = 0.72;
    c.fillStyle = '#6e858b';
    for (let i = 0; i < 18; i++) c.fillRect(30 + r() * (width - 80), 40 + r() * (height - 80), 30 + r() * 100, 2 + r() * 5);
    c.fillStyle = '#d1a15e';
    c.fillRect(width * 0.62, height * 0.16, width * 0.17, height * 0.36);
    c.globalAlpha = 1;
    c.fillStyle = '#07090b'; c.fillRect(0, height * 0.93, width, height * 0.07);
  });
}
