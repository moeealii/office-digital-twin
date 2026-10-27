import * as THREE from 'three';
import { bumpTex, canvasTex, phys, rng, std, vinyl } from './_desk-toys-kit';

/**
 * Materials and printed textures for the west-desk toys. Everything is created inside this
 * function (called from build) so the runtime's texture preload has already run.
 *
 * Graphics that exist in the photos but are too small to read at native resolution are drawn as
 * canvas textures (Coke label, WHOOSH can, towel emboss, kufic plaque) — the photos show the
 * colours and the layout, not the letterforms.
 */
export type DT = ReturnType<typeof deskToyMaterials>;

export function deskToyMaterials() {
  // ---- printing / labels ----------------------------------------------------------------
  const coke = canvasTex(1024, 512, (c, w, h) => {
    // a slim silver can: brushed metal, a red vertical panel, white Coca-Cola script
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#d9dbdd');
    g.addColorStop(0.18, '#eef0f1');
    g.addColorStop(0.5, '#cfd2d4');
    g.addColorStop(0.82, '#e6e8e9');
    g.addColorStop(1, '#c3c6c8');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // subtle vertical brushed streaks
    const r = rng(9);
    for (let i = 0; i < 220; i++) {
      c.globalAlpha = 0.05 + r() * 0.08;
      c.fillStyle = r() < 0.5 ? '#ffffff' : '#9aa0a4';
      c.fillRect(r() * w, 0, 1 + r() * 2, h);
    }
    c.globalAlpha = 1;
    // red panel behind the script (the can is silver with a red "Coca-Cola" block)
    c.fillStyle = '#c1121f';
    c.beginPath();
    c.moveTo(w * 0.30, 0);
    c.quadraticCurveTo(w * 0.34, h * 0.5, w * 0.30, h);
    c.lineTo(w * 0.70, h);
    c.quadraticCurveTo(w * 0.74, h * 0.5, w * 0.70, 0);
    c.closePath();
    c.fill();
    // white script: a flowing swash drawn as thick tapered strokes
    c.strokeStyle = '#f7f4ef';
    c.lineCap = 'round';
    const stroke = (pts: [number, number][], width: number) => {
      c.lineWidth = width;
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x * w, y * h) : c.moveTo(x * w, y * h)));
      c.stroke();
    };
    stroke([[0.36, 0.44], [0.40, 0.30], [0.46, 0.40], [0.52, 0.30], [0.58, 0.42], [0.64, 0.31]], h * 0.055);
    stroke([[0.36, 0.62], [0.42, 0.52], [0.48, 0.60], [0.54, 0.50], [0.60, 0.60], [0.66, 0.52]], h * 0.05);
    stroke([[0.37, 0.74], [0.44, 0.68], [0.50, 0.76], [0.57, 0.67], [0.63, 0.74]], h * 0.035);
    // top and bottom rolled rims
    c.fillStyle = '#b9bdc0';
    c.fillRect(0, 0, w, h * 0.05);
    c.fillRect(0, h * 0.95, w, h * 0.05);
    c.fillStyle = 'rgba(255,255,255,.35)';
    c.fillRect(0, h * 0.05, w, 3);
  });
  coke.wrapS = THREE.RepeatWrapping;

  const whoosh = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#efeee8';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#e9622a';
    c.fillRect(0, 0, w, h * 0.18);
    c.fillStyle = '#f7f6f1';
    c.font = 'bold 74px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.save();
    c.translate(w * 0.52, h * 0.62);
    c.rotate(Math.PI / 2);
    c.fillStyle = '#c9302c';
    c.fillText('WHOSON', 0, 0);
    c.restore();
    c.fillStyle = '#6a6a6a';
    c.font = '22px sans-serif';
    c.save();
    c.translate(w * 0.28, h * 0.62);
    c.rotate(Math.PI / 2);
    c.fillText('MULTI-PURPOSE CLEANER', 0, 0);
    c.restore();
    c.fillStyle = '#e3c86a';
    c.fillRect(0, h * 0.94, w, h * 0.06);
  });

  // quilted/embossed paper towel relief
  const towelBump = bumpTex(512, 512, (c, w, h) => {
    c.fillStyle = '#808080';
    c.fillRect(0, 0, w, h);
    const step = w / 16;
    c.strokeStyle = '#ffffff';
    c.lineWidth = 2;
    for (let i = -16; i < 32; i++) {
      c.beginPath();
      c.moveTo(i * step, 0);
      c.lineTo(i * step + h, h);
      c.stroke();
      c.beginPath();
      c.moveTo(i * step, 0);
      c.lineTo(i * step - h, h);
      c.stroke();
    }
    // the emboss dimples that give the roll its sparkle
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const g = c.createRadialGradient(x, y, 0, x, y, step * 0.42);
        g.addColorStop(0, 'rgba(0,0,0,.5)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(x - step, y - step, step * 2, step * 2);
      }
    }
  }, 3);

  // square-kufic plaque: black field, gilt border, white geometric script blocks
  const kufic = canvasTex(512, 640, (c, w, h) => {
    c.fillStyle = '#111010';
    c.fillRect(0, 0, w, h);
    // gilt frame: braided gold bands
    c.strokeStyle = '#b98c3d';
    c.lineWidth = 16;
    c.strokeRect(10, 10, w - 20, h - 20);
    c.strokeStyle = '#e7cd8b';
    c.lineWidth = 4;
    c.strokeRect(26, 26, w - 52, h - 52);
    c.strokeStyle = '#7a5a24';
    c.lineWidth = 3;
    for (let x = 30; x < w - 30; x += 22) {
      c.beginPath();
      c.moveTo(x, 18);
      c.lineTo(x + 11, 30);
      c.stroke();
      c.beginPath();
      c.moveTo(x, h - 18);
      c.lineTo(x + 11, h - 30);
      c.stroke();
    }
    // the square-kufic field: white blocks on black, three bands
    const r = rng(31);
    c.fillStyle = '#efe9dc';
    const block = (x: number, y: number, bw: number, bh: number) => c.fillRect(x, y, bw, bh);
    for (let band = 0; band < 3; band++) {
      const by = 96 + band * 170;
      let x = 72;
      while (x < w - 96) {
        const bw = 16 + Math.floor(r() * 3) * 16;
        const bh = r() < 0.28 ? 84 : r() < 0.5 ? 56 : 30;
        block(x, by + (r() < 0.5 ? 0 : 24), bw, bh);
        if (r() < 0.45) block(x, by + bh + 20, bw, 18 + Math.floor(r() * 2) * 16);
        if (r() < 0.3) block(x + bw, by + 24, 16, 60);
        x += bw + 20 + Math.floor(r() * 2) * 12;
      }
    }
    c.fillStyle = '#b98c3d';
    c.fillRect(60, 74, w - 120, 6);
    c.fillRect(60, h - 96, w - 120, 6);
  });

  // red mini-table inlay: a fine white starburst lattice printed on the discs
  const lattice = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#8e1f2c';
    c.fillRect(0, 0, w, h);
    const r = rng(17);
    c.strokeStyle = 'rgba(255,225,225,.75)';
    c.lineWidth = 2;
    for (let i = 0; i < 34; i++) {
      const a0 = r() * Math.PI * 2;
      const cx = w * (0.2 + r() * 0.6);
      const cy = h * (0.2 + r() * 0.6);
      const len = 70 + r() * 260;
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(a0) * len, cy + Math.sin(a0) * len);
      c.stroke();
    }
    c.strokeStyle = 'rgba(255,215,215,.35)';
    c.lineWidth = 1;
    for (let i = 0; i < 60; i++) {
      const a0 = r() * Math.PI * 2;
      const cx = w * r();
      const cy = h * r();
      const len = 40 + r() * 120;
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(a0) * len, cy + Math.sin(a0) * len);
      c.stroke();
    }
  });

  // the black leather card wallet's gilt roundel
  const roundel = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#151312';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#c9a24a';
    c.lineWidth = 6;
    c.beginPath();
    c.arc(w / 2, h / 2, w * 0.33, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = 3;
    c.beginPath();
    c.arc(w / 2, h / 2, w * 0.26, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#c9a24a';
    c.font = 'bold 52px serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('R', w / 2, h / 2 + 4);
  });

  // hand-cream tube print
  const tubeLabel = canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = '#f6f5f1';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#2a4f8e';
    c.fillRect(0, h * 0.30, w, h * 0.24);
    c.fillStyle = '#ffffff';
    c.font = 'bold 50px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('CREAM', w * 0.5, h * 0.42);
    c.fillStyle = '#8b8b8b';
    c.font = '24px sans-serif';
    c.fillText('hand repair', w * 0.5, h * 0.68);
  });

  const m = {
    // ---- structural ----
    white: std('toy-white', '#e9e8e3', 0.42),
    whiteGloss: phys('toy-white-gloss', '#eeece6', 0.22, { clearcoat: 0.5, clearcoatRoughness: 0.3 }),
    porcelain: phys('toy-porcelain', '#f1efe9', 0.28, { clearcoat: 0.35 }),
    blackGloss: phys('toy-black-gloss', '#111214', 0.18, { clearcoat: 0.7, clearcoatRoughness: 0.18 }),
    blackMatte: std('toy-black', '#17181a', 0.72),
    red: phys('toy-red-print', '#ffffff', 0.3, { map: lattice, clearcoat: 0.5, clearcoatRoughness: 0.25 }),
    redPlain: std('toy-red-plain', '#a12330', 0.35),
    gold: std('toy-gold', '#c9a24a', 0.28, 1),
    brass: std('toy-brass', '#b98b3f', 0.3, 0.9),
    silver: std('toy-silver', '#cfd2d4', 0.26, 0.92),
    steelGrey: std('toy-steel', '#9ea3a6', 0.4, 0.7),
    // ---- figurine ----
    furGrey: vinyl('fig-fur', '#8e9195', 0.34),
    furDark: vinyl('fig-fur-dark', '#3d4249', 0.24),
    furMid: vinyl('fig-fur-mid', '#5c6166', 0.3),
    glove: vinyl('fig-glove', '#f2f1ec', 0.35),
    shorts: vinyl('fig-shorts', '#16181b', 0.3),
    belt: std('fig-belt', '#e8e6e0', 0.5),
    eyeInk: std('fig-eye', '#101012', 0.5),
    // ---- printed ----
    coke: phys('coke-label', '#ffffff', 0.22, { map: coke, metalness: 0.35, clearcoat: 0.4 }),
    cokeTop: std('coke-top', '#c6c9cb', 0.3, 0.9),
    whoosh: std('whoosh-label', '#ffffff', 0.45, 0, { map: whoosh }),
    kufic: phys('kufic-print', '#ffffff', 0.34, { map: kufic, clearcoat: 0.3 }),
    towelPaper: std('towel-paper', '#f6f5f2', 0.92, 0, { bumpMap: towelBump, bumpScale: 0.0012 }),
    core: std('towel-core', '#9c7a52', 0.9),
    tubePrint: std('cream-tube', '#ffffff', 0.45, 0, { map: tubeLabel }),
    roundel: phys('wallet-roundel', '#ffffff', 0.3, { map: roundel, metalness: 0.4 }),
    // ---- plastics ----
    green: vinyl('toy-green', '#3f7d3a', 0.3),
    greenDeep: std('toy-green-deep', '#1f4426', 0.55),
    greenLeaf: std('plant-leaf', '#2c5230', 0.62),
    blueFin: phys('toy-blue-fin', '#8fc2dd', 0.16, { transparent: true, opacity: 0.62, clearcoat: 0.6 }),
    orange: vinyl('toy-orange', '#e8542c', 0.3),
    blueGrey: std('toy-blue-grey', '#5b6b86', 0.4),
    copper: std('toy-copper', '#a4623a', 0.32, 0.9),
    clear: phys('toy-clear', '#eef3f4', 0.1, { transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
    liquidWhite: phys('toy-liquid-white', '#e7e9e2', 0.25, { transparent: true, opacity: 0.8 }),
    greyPlastic: std('toy-grey-plastic', '#7b7f82', 0.5),
    darkGrey: std('toy-dark-grey', '#2a2c2f', 0.45),
    brownBristle: std('toy-bristle', '#3a2620', 0.62),
    paperLabel: std('toy-paper', '#efece2', 0.85),
  };
  return m;
}
