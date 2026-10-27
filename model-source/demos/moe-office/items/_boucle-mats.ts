import * as THREE from 'three';
import { rng } from './_moe-kit';

/**
 * Materials for the bouclé corner (objects 10/11/12).
 *
 * The sofa is light warm-grey *loop bouclé*: at 1–2 m the loops read as a dense nubby pile with a
 * soft sheen, so the fabric is a canvas height field of interlocking loops turned into a colour map
 * (per-loop tone + a little depth shading) and a normal map (Sobel of the same field). One tile is
 * BOUCLE_TILE metres square, i.e. texel scale is real; geometry UVs are in metres.
 */
/** one tile = 18 cm — oversized loops so the nubby pile reads at room distance (12 cm was sand) */
export const BOUCLE_TILE = 0.180;

function normalFromHeight(h: Float32Array, n: number, strength: number) {
  const out = new Uint8Array(n * n * 4);
  const at = (x: number, y: number) => h[((y + n) % n) * n + ((x + n) % n)];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const o = (y * n + x) * 4;
      out[o] = Math.round((-dx / len * 0.5 + 0.5) * 255);
      out[o + 1] = Math.round((-dy / len * 0.5 + 0.5) * 255);
      out[o + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
      out[o + 3] = 255;
    }
  }
  return out;
}

/** Loop-bouclé height field + colour map. n px = BOUCLE_TILE metres. */
function boucleMaps(n = 512) {
  const r = rng(9143);
  const h = new Float32Array(n * n);
  // chunky interlocking rings — must look nubby/oatmeal at 1–2 m, not fine noise
  const count = 1400;
  const tints: number[] = [];
  const loops: { x: number; y: number; rad: number; w: number; lift: number; tint: number }[] = [];
  for (let i = 0; i < count; i++) {
    const rad = 7.0 + r() * 14.0;
    loops.push({ x: r() * n, y: r() * n, rad, w: 2.2 + r() * 3.0, lift: 0.75 + r() * 0.55, tint: r() });
    tints.push(r());
  }
  const pad = 16;
  for (const L of loops) {
    const R = L.rad + L.w * 3;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx, dy);
        const ring = Math.exp(-((d - L.rad) ** 2) / (2 * L.w * L.w));
        if (ring < 0.02) continue;
        // the loop's crown sits toward its own tilt so the pile has direction
        const crown = 0.75 + 0.25 * Math.cos(Math.atan2(dy, dx) - L.tint * 6.28);
        const val = ring * L.lift * crown;
        const xx = ((L.x + dx) % n + n) % n | 0;
        const yy = ((L.y + dy) % n + n) % n | 0;
        const idx = yy * n + xx;
        if (val > h[idx]) h[idx] = val;
      }
    }
  }
  // coarser secondary loops for multi-scale pile
  for (let i = 0; i < 280; i++) {
    const x = r() * n, y = r() * n, rad = 16 + r() * 22, w = 3.0 + r() * 3.5;
    for (let dy = -rad - 10; dy <= rad + 10; dy++) {
      for (let dx = -rad - 10; dx <= rad + 10; dx++) {
        const d = Math.hypot(dx, dy);
        const ring = Math.exp(-((d - rad) ** 2) / (2 * w * w)) * 1.05;
        if (ring < 0.03) continue;
        const idx = ((((y + dy) % n) + n) % n | 0) * n + ((((x + dx) % n) + n) % n | 0);
        h[idx] = Math.max(h[idx], ring);
      }
    }
  }
  for (let i = 0; i < n * n; i++) h[i] += (r() - 0.5) * 0.08;

  const colour = new Uint8Array(n * n * 4);
  // cool light-grey loop pile (photos 54/55). Mild cool bias only — v2 oatmeal [214,208,196]
  // + warm sheen made the couch yellow; overshooting to blue is also wrong.
  // light cool-grey (photos 54/55 under pot lights) — brighter than prior cement; no yellow
  const base = [210, 210, 212];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const v = Math.min(1, Math.max(0, h[i]));
      const shade = 0.88 + 0.18 * v + (r() - 0.5) * 0.025;
      const o = i * 4;
      colour[o] = Math.min(255, Math.round(base[0] * shade));
      colour[o + 1] = Math.min(255, Math.round(base[1] * shade));
      colour[o + 2] = Math.min(255, Math.round(base[2] * shade));
      colour[o + 3] = 255;
    }
  }
  const nor = normalFromHeight(h, n, 36);
  const mk = (data: Uint8Array, srgb: boolean) => {
    const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  };
  return { colour: mk(colour, true), normal: mk(nor, false) };
}

/** Cream marble with soft grey veining, drawn at a real scale (one tile = 0.8 m of table top). */
function marbleMaps(n = 512) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const c = cv.getContext('2d')!;
  const r = rng(313);
  const g = c.createLinearGradient(0, 0, n, n);
  g.addColorStop(0, '#f4efe3');
  g.addColorStop(0.5, '#efe9dc');
  g.addColorStop(1, '#f3eee2');
  c.fillStyle = g;
  c.fillRect(0, 0, n, n);
  // broad cloudy patches
  for (let i = 0; i < 26; i++) {
    const x = r() * n, y = r() * n, rad = 40 + r() * 130;
    const grd = c.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(206,198,183,${0.06 + r() * 0.1})`);
    grd.addColorStop(1, 'rgba(206,198,183,0)');
    c.fillStyle = grd;
    c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // veins: a few major ones with branches, then hairlines
  const vein = (x: number, y: number, len: number, ang: number, width: number, alpha: number, depth: number) => {
    let px = x, py = y, a = ang;
    c.beginPath();
    c.moveTo(px, py);
    const steps = Math.max(6, Math.round(len / 6));
    for (let s = 0; s < steps; s++) {
      a += (r() - 0.5) * 0.55;
      px += Math.cos(a) * (len / steps);
      py += Math.sin(a) * (len / steps);
      c.lineTo(px, py);
      if (depth > 0 && r() < 0.16) vein(px, py, len * 0.35, a + (r() - 0.5) * 1.5, width * 0.55, alpha * 0.7, depth - 1);
    }
    c.strokeStyle = `rgba(150,143,130,${alpha})`;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.stroke();
    // soft halo beside the vein
    c.strokeStyle = `rgba(178,171,157,${alpha * 0.45})`;
    c.lineWidth = width * 3.4;
    c.stroke();
  };
  for (let i = 0; i < 5; i++) vein(r() * n, r() * n, 220 + r() * 240, -0.5 + r() * 0.5, 2.2 + r() * 2.4, 0.2 + r() * 0.16, 2);
  for (let i = 0; i < 16; i++) vein(r() * n, r() * n, 90 + r() * 170, -0.9 + r() * 1.8, 0.7 + r() * 0.8, 0.1 + r() * 0.14, 1);
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  return map;
}

export type BoucleMats = ReturnType<typeof boucleMaterialSet>;

function boucleMaterialSet() {
  const { colour, normal } = boucleMaps();
  const tile = 1 / BOUCLE_TILE;
  const rep = (t: THREE.Texture) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(tile, tile);
    return c;
  };
  const boucle = new THREE.MeshPhysicalMaterial({
    // light cool-grey multiply — photo reads almost white-grey under pots
    color: '#e4e6ea',
    map: rep(colour),
    normalMap: rep(normal),
    normalScale: new THREE.Vector2(0.48, 0.48),
    roughness: 0.84,
    metalness: 0,
    sheen: 0.40,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color('#f2f3f5'),
  });
  boucle.name = 'boucle-grey';
  const boucleSoft = boucle.clone();
  boucleSoft.name = 'boucle-grey-soft';
  boucleSoft.normalScale = new THREE.Vector2(0.85, 0.85);

  const marble = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    map: marbleMaps(),
    roughness: 0.16,
    metalness: 0,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
  });
  marble.name = 'boucle-marble';

  // muted brushed champagne — photos 24/55 (prior was still too yellow-glossy in comps)
  const gold = new THREE.MeshStandardMaterial({ color: '#9a8862', metalness: 0.92, roughness: 0.42 });
  gold.name = 'boucle-gold';
  const plinth = new THREE.MeshStandardMaterial({ color: '#413c36', roughness: 1 });
  plinth.name = 'boucle-plinth';
  // cool mid-grey soft fabric pillows (photos 54/55) — linen-scale normal so they aren't plastic
  const greige = new THREE.MeshPhysicalMaterial({
    // mid-cool grey satin throws (photos 54/55) — soft fabric, not CAD plastic
    color: '#a8b0b8',
    map: (() => {
      const c = colour.clone();
      c.needsUpdate = true;
      c.repeat.set(tile * 2.2, tile * 2.2);
      return c;
    })(),
    normalMap: (() => {
      const n = normal.clone();
      n.needsUpdate = true;
      n.repeat.set(tile * 2.2, tile * 2.2);
      return n;
    })(),
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.78,
    sheen: 0.50,
    sheenRoughness: 0.48,
    sheenColor: new THREE.Color('#d0d6de'),
    metalness: 0.04,
  });
  greige.name = 'pillow-greige';
  const nylon = new THREE.MeshPhysicalMaterial({
    color: '#141518',
    roughness: 0.62,
    sheen: 0.55,
    sheenRoughness: 0.42,
    sheenColor: new THREE.Color('#3a3e45'),
  });
  nylon.name = 'backpack-nylon';
  const nylonMatte = new THREE.MeshStandardMaterial({ color: '#0d0e10', roughness: 0.92 });
  nylonMatte.name = 'backpack-trim';
  const whiteCloth = new THREE.MeshStandardMaterial({ color: '#f2f0ea', roughness: 0.95 });
  whiteCloth.name = 'white-cloth';
  const navy = new THREE.MeshStandardMaterial({ color: '#1b2136', roughness: 0.9 });
  navy.name = 'navy-cloth';
  const lilac = new THREE.MeshPhysicalMaterial({
    color: '#b9a6e4',
    roughness: 0.34,
    clearcoat: 0.4,
    clearcoatRoughness: 0.35,
  });
  lilac.name = 'lilac-case';
  const fruit = new THREE.MeshPhysicalMaterial({
    color: '#d6e01f',
    roughness: 0.14,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    metalness: 0,
  });
  fruit.name = 'glass-fruit';
  const stem = new THREE.MeshStandardMaterial({ color: '#2f5c1c', roughness: 0.7 });
  stem.name = 'fruit-stem';
  const rubber = new THREE.MeshStandardMaterial({ color: '#171717', roughness: 0.85 });
  rubber.name = 'black-rubber';

  return { boucle, boucleSoft, marble, gold, plinth, greige, nylon, nylonMatte, whiteCloth, navy, lilac, fruit, stem, rubber };
}

export function boucleMaterials(): BoucleMats {
  // no module cache — HMR and capture reloads must pick up new loop maps / gold
  return boucleMaterialSet();
}
