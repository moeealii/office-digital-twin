import * as THREE from 'three';
import { canvasTex, rng } from './_moe-kit';

/**
 * Textures for the prayer station. Photo-derived ones are rectified crops made from the posed raw
 * photos at the measured planes (see prayer-station.ts):
 *   prayer-crest.jpg     photo 45, back-panel plane, lx −0.32…0.32, y 1.20…1.80 (stand frame)
 *   prayer-drawer.jpg    photo 58, chest front plane, lx −0.305…0.285, y 0…0.42
 *   prayer-rug.jpg       photo 66, green rug's front panel (4-corner perspective warp)
 *   prayer-lace.jpg      photo 45, top-rail cloth, lx −0.152…0.164, y 1.325…1.175
 *   prayer-register.png  photo 60, floor register face (alpha = cut-outs)
 *   prayer-inlay.jpg     photo 66, carved stand's plinth top (y 0.444), s 0…0.25 along the plinth,
 *                        t −0.012…0.056 across it (3000 px/m, levels stretched)
 * The rest are drawn here from those photos.
 */

const loader = new THREE.TextureLoader();
const BASE = '/moe-office/textures/';

export async function photoTex(file: string, srgb = true) {
  const t = await loader.loadAsync(BASE + file);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export async function sharedTex(file: string, repeat: number, srgb = false) {
  const t = await loader.loadAsync('/textures/' + file);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

/** walnut grain; vertical = grain along v */
export function walnutTex(seed = 11, base = '#6e4a2c', dark = '#3e2615', light = '#8d6440', vertical = true) {
  return canvasTex(1024, 1024, (c, w, h) => {
    const r = rng(seed);
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
    const along = vertical ? h : w;
    for (let k = 0; k < 300; k++) {
      const p = r() * (vertical ? w : h);
      const amp = 2 + r() * 12;
      const freq = 0.003 + r() * 0.016;
      const ph = r() * 6;
      c.beginPath();
      for (let q = -20; q <= along + 20; q += 6) {
        const off = p + Math.sin(q * freq + ph) * amp + Math.sin(q * freq * 3.1 + ph) * 1.2;
        if (vertical) { if (q < 0) c.moveTo(off, q); else c.lineTo(off, q); } else if (q < 0) c.moveTo(q, off); else c.lineTo(q, off);
      }
      c.strokeStyle = r() < 0.55 ? dark : light;
      c.globalAlpha = 0.05 + r() * 0.16;
      c.lineWidth = 0.6 + r() * 3;
      c.stroke();
    }
    for (let k = 0; k < 8; k++) {
      const x = r() * w, y = r() * h;
      const g = c.createRadialGradient(x, y, 0, x, y, 60 + r() * 140);
      g.addColorStop(0, r() < 0.5 ? dark : light);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.14;
      c.fillStyle = g;
      c.fillRect(x - 200, y - 200, 400, 400);
    }
    c.globalAlpha = 1;
  }, 1);
}

/** figured cherry burl for the oval tray (photos 58/61/66: warm brown, not scarlet) */
export function burlTex() {
  return canvasTex(512, 1024, (c, w, h) => {
    const r = rng(77);
    c.fillStyle = '#8d5340';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = r() * w, y = r() * h, rr = 4 + r() * 40;
      c.strokeStyle = r() < 0.5 ? '#5c3018' : '#c48a62';
      c.globalAlpha = 0.08 + r() * 0.2;
      c.lineWidth = 1 + r() * 2.5;
      c.beginPath();
      c.ellipse(x, y, rr, rr * (0.4 + r() * 0.6), r() * 3, 0, Math.PI * 2);
      c.stroke();
    }
    for (let i = 0; i < 90; i++) {
      c.fillStyle = '#2e1206';
      c.globalAlpha = 0.25 + r() * 0.4;
      c.beginPath();
      c.arc(r() * w, r() * h, 1 + r() * 2.5, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  });
}

/** scorched pine of the carved calligraphy piece: amber face with dark burnt recesses (photos 64/65) */
export function pineTex() {
  return canvasTex(512, 512, (c, w, h) => {
    const r = rng(91);
    // photo 65/66 face tone ~ (165,110,60): honey pine whose late-wood was scorched dark
    c.fillStyle = '#9c6434';
    c.fillRect(0, 0, w, h);
    const TAU = Math.PI * 2;
    // broad scorched late-wood bands first (the tiger-stripe look of photos 64/65), then fine grain;
    // the waviness uses whole periods across the width so the map tiles
    for (let k = 0; k < 80; k++) {
      const broad = k < 10;
      const y0 = r() * h, ph = r() * TAU, n1 = 1 + Math.floor(r() * 2), n2 = 3 + Math.floor(r() * 3);
      c.beginPath();
      for (let x = -8; x <= w + 8; x += 8) c.lineTo(x, y0 + Math.sin((x / w) * TAU * n1 + ph) * 7 + Math.sin((x / w) * TAU * n2) * 2);
      c.strokeStyle = broad ? '#2a1206' : r() < 0.55 ? '#3a1d0c' : '#cf9e64';
      c.globalAlpha = broad ? 0.22 + r() * 0.2 : 0.15 + r() * 0.3;
      c.lineWidth = broad ? 4 + r() * 8 : 1 + r() * 3.5;
      c.stroke();
    }
    c.globalAlpha = 1;
  }, 1);
}

/** the mother-of-pearl inlay on the carved stand's plinth front (photos 61/64/65/198): a wide low
 *  cream panel with three large ochre-brown scroll rosettes, teal accents and a wood-tone border */
export function shellInlayTex() {
  // 1080×200 maps onto the 0.216 × 0.040 m plinth face (5000 px/m both ways), so a
  // circle in pixels is a circle on the wood. Five round scroll medallions.
  return canvasTex(1080, 200, (c, w, h) => {
    const r = rng(5);
    c.fillStyle = '#efe8d8';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      c.fillStyle = r() < 0.22 ? '#b7ddd6' : r() < 0.6 ? '#f7f3ea' : '#ddd4c4';
      c.globalAlpha = 0.55;
      c.fillRect(r() * w, r() * h, 4 + r() * 12, 3 + r() * 8);
    }
    c.globalAlpha = 1;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const cx of [108, 324, 540, 756, 972]) {
      const cy = h * 0.5, rad = 78;
      c.strokeStyle = '#5a3a22';
      c.lineWidth = 11;
      c.beginPath();
      c.arc(cx, cy, rad, 0, Math.PI * 2);
      c.stroke();
      c.lineWidth = 8;
      c.beginPath();
      c.arc(cx, cy, rad * 0.62, 0.4, Math.PI * 1.7);
      c.stroke();
      c.beginPath();
      c.moveTo(cx - rad * 0.15, cy - rad * 0.05);
      c.bezierCurveTo(cx - rad * 0.55, cy - rad * 0.7, cx + rad * 0.2, cy - rad * 0.75, cx + rad * 0.45, cy - rad * 0.1);
      c.bezierCurveTo(cx + rad * 0.7, cy + rad * 0.45, cx - rad * 0.05, cy + rad * 0.65, cx - rad * 0.35, cy + rad * 0.15);
      c.stroke();
      c.beginPath();
      c.arc(cx + rad * 0.08, cy + rad * 0.05, 16, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#7ec8c4';
      c.beginPath();
      c.arc(cx - rad * 0.55, cy + rad * 0.28, 11, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(cx + rad * 0.58, cy - rad * 0.32, 9, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = '#a8834a';
    c.lineWidth = 10;
    c.strokeRect(6, 6, w - 12, h - 12);
  });
}

/** a gilt-tooled hardback cover (front board); spine label band on the left */
export function bookCoverTex(base: string, gold = '#c9a45a', seed = 1) {
  return canvasTex(512, 768, (c, w, h) => {
    const r = rng(seed);
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) {
      c.globalAlpha = 0.06;
      c.fillStyle = r() < 0.5 ? '#000' : '#fff';
      c.fillRect(r() * w, r() * h, 2, 2);
    }
    c.globalAlpha = 1;
    c.strokeStyle = gold;
    c.lineWidth = 6;
    c.strokeRect(34, 34, w - 68, h - 68);
    c.lineWidth = 2.5;
    c.strokeRect(50, 50, w - 100, h - 100);
    // corner pieces + central medallion (an almond shamsa)
    c.fillStyle = gold;
    for (const [x, y, sx, sy] of [[50, 50, 1, 1], [w - 50, 50, -1, 1], [50, h - 50, 1, -1], [w - 50, h - 50, -1, -1]] as const) {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 56 * sx, y);
      c.quadraticCurveTo(x + 24 * sx, y + 24 * sy, x, y + 56 * sy);
      c.closePath();
      c.fill();
    }
    // small shamsa — the cover is the side face (photos 64/66 show the spine)
    c.beginPath();
    c.ellipse(w / 2, h / 2, 28, 44, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = base;
    c.beginPath();
    c.ellipse(w / 2, h / 2, 20, 32, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = gold;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      c.beginPath();
      c.ellipse(w / 2 + Math.cos(a) * 10, h / 2 + Math.sin(a) * 16, 5, 8, a, 0, Math.PI * 2);
      c.fill();
    }
  });
}

/** spine: dark with raised gilt bands and a small label */
export function bookSpineTex(base: string, gold = '#c9a45a') {
  return canvasTex(128, 768, (c, w, h) => {
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
    c.fillStyle = gold;
    for (const y of [60, 120, 600, 660]) c.fillRect(8, y, w - 16, 8);
    c.strokeStyle = gold;
    c.lineWidth = 3;
    c.strokeRect(18, 170, w - 36, 380);
    for (let i = 0; i < 9; i++) {
      c.beginPath();
      c.arc(w / 2, 200 + i * 40, 9, 0, Math.PI * 2);
      c.stroke();
    }
  });
}

export function pageEdgeTex() {
  return canvasTex(256, 64, (c, w, h) => {
    c.fillStyle = '#efe6cf';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#d4c7a8';
    for (let y = 0; y < h; y += 2) {
      c.globalAlpha = 0.07 + ((y * 7) % 5) * 0.025;   // smooth cream page edges (photos 64/66)
      c.beginPath();
      c.moveTo(0, y + 0.5);
      c.lineTo(w, y + 0.5);
      c.stroke();
    }
    c.globalAlpha = 1;
  });
}

/** fluffy teal-blue pile (the blue rug on the middle rail): streaky shading for the normal-mapped wool */
export function bluePileTex() {
  return canvasTex(512, 512, (c, w, h) => {
    const r = rng(19);
    c.fillStyle = '#1b7aa0';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 7000; i++) {
      c.globalAlpha = 0.06 + r() * 0.16;
      c.fillStyle = r() < 0.45 ? '#0f5f80' : r() < 0.85 ? '#2c9cc4' : '#58b9d8';
      c.fillRect(r() * w, r() * h, 1.4, 3 + r() * 9);
    }
    c.globalAlpha = 1;
  }, 1);
}

/** brown felt-ish backing cloth under the lace */
export function feltTex(base = '#3b2619', seed = 23) {
  return canvasTex(256, 256, (c, w, h) => {
    const r = rng(seed);
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) {
      c.globalAlpha = 0.05 + r() * 0.1;
      c.fillStyle = r() < 0.5 ? '#000' : '#7a5a44';
      c.fillRect(r() * w, r() * h, 1 + r() * 3, 1);
    }
    c.globalAlpha = 1;
  }, 1);
}

/** grey polyester mesh of the drawstring bag (photos 60/63: fine square mesh over darker lining) */
export function meshFabricTex() {
  return canvasTex(256, 256, (c, w, h) => {
    // photos 58/199: a light mid-grey knit, ~ (140,148,152) with darker open cells
    c.fillStyle = '#a7afb3';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#5d6669';
    for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < w; x += 8) c.fillRect(x + 2, y + 2, 4, 4);
  }, 1);
}

/** pressed clay/stone of the turbah discs: pale with darker specks and a rim stain */
export function stoneTex() {
  return canvasTex(128, 128, (c, w, h) => {
    const r = rng(13);
    c.fillStyle = '#d5cbb8';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      c.globalAlpha = 0.1 + r() * 0.25;
      c.fillStyle = r() < 0.6 ? '#8d8476' : '#c9c2b4';
      c.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3);
    }
    c.globalAlpha = 1;
  });
}
