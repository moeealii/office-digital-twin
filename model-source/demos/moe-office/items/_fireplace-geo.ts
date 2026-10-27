import * as THREE from 'three';
import { canvasTex, mesh, rng, v3, type V3 } from './_moe-kit';

/** Geometry + texture helpers used only by the wall-1 (fireplace wall) modules. */

export type P2 = [number, number];

export function lathe(pts: P2[], mat: THREE.Material, seg = 40, phiStart = 0, phiLength = Math.PI * 2) {
  const g = new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), seg, phiStart, phiLength,
  );
  const m = mesh(g, mat);
  return m;
}

export function sph(r: number, mat: THREE.Material, ws = 16, hs = 12) {
  return mesh(new THREE.SphereGeometry(r, ws, hs), mat);
}

export function inst(geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[], name?: string) {
  const m = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((mm, i) => m.setMatrixAt(i, mm));
  m.instanceMatrix.needsUpdate = true;
  m.castShadow = true;
  m.receiveShadow = true;
  if (name) m.name = name;
  return m;
}

/**
 * Tube whose radius is modulated along its length — the portable AC's corrugated exhaust hose.
 * TubeGeometry orders vertices as (seg+1) rings of (radial+1); the ring index gives u along the run.
 */
export function ribbedTube(
  pts: V3[], radius: number, ribsPerMetre: number, mat: THREE.Material, seg = 180, radial = 12, amp = 0.12,
) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => v3(...p)));
  const geo = new THREE.TubeGeometry(curve, seg, radius, radial, false);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const nrm = geo.getAttribute('normal') as THREE.BufferAttribute;
  const len = curve.getLength();
  const ringVerts = radial + 1;
  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / ringVerts);
    const u = ring / seg;
    const k = radius * amp * Math.sin(u * len * ribsPerMetre * Math.PI * 2);
    pos.setXYZ(i, pos.getX(i) + nrm.getX(i) * k, pos.getY(i) + nrm.getY(i) * k, pos.getZ(i) + nrm.getZ(i) * k);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return mesh(geo, mat, 'exhaust-hose');
}

/** A tapered, slightly bent log: TubeGeometry with radius wander, for the fireplace's driftwood. */
export function logMesh(pts: V3[], r0: number, r1: number, mat: THREE.Material, seed = 1, seg = 26) {
  const r = rng(seed);
  const curve = new THREE.CatmullRomCurve3(pts.map(p => v3(...p)));
  const geo = new THREE.TubeGeometry(curve, seg, 1, 9, false);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const nrm = geo.getAttribute('normal') as THREE.BufferAttribute;
  const ringVerts = 10;
  const wob = [r() * 6, r() * 6, r() * 6];
  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / ringVerts);
    const t = ring / seg;
    const rad = r0 + (r1 - r0) * t;
    const k = rad * (1 + 0.12 * Math.sin(t * 9 + wob[0]) + 0.07 * Math.sin(t * 23 + wob[1]) + 0.05 * Math.sin(t * 41 + wob[2]));
    pos.setXYZ(i, pos.getX(i) + nrm.getX(i) * (k - 1), pos.getY(i) + nrm.getY(i) * (k - 1), pos.getZ(i) + nrm.getZ(i) * (k - 1));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return mesh(geo, mat);
}

/** Gold filigree lace on transparent ground: sleeves over the cart's glass jars, the trinket box. */
export function laceTex(seed = 3, scale = 1) {
  return canvasTex(512, 512, (c, w, h) => {
    const r = rng(seed);
    c.clearRect(0, 0, w, h);
    // floral lattice of little leaves on a transparent ground: only the wire is drawn, so the
    // glass shows between the lattice when this is used as an alpha-tested sleeve
    const step = 46 * scale;
    c.strokeStyle = '#c99a4e';
    c.lineCap = 'round';
    for (let y = 0; y <= h + step; y += step) {
      for (let x = 0; x <= w + step; x += step) {
        const ox = x + (Math.round(y / step) % 2 ? step / 2 : 0);
        c.lineWidth = 3.0;
        c.beginPath();
        c.arc(ox, y, step * 0.32, 0, Math.PI * 2);
        c.stroke();
        c.lineWidth = 1.1;
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2 + 0.3;
          c.beginPath();
          c.ellipse(ox + Math.cos(a) * step * 0.33, y + Math.sin(a) * step * 0.33, step * 0.1, step * 0.055, a, 0, Math.PI * 2);
          c.stroke();
        }
        c.beginPath();
        c.arc(ox, y, step * 0.06, 0, Math.PI * 2);
        c.fillStyle = '#f6dfa6';
        c.fill();
      }
    }
    // speckle of gold foil so the sleeve reads as gilded glass rather than a wire cage
    for (let i = 0; i < 90; i++) {
      c.globalAlpha = 0.7 + r() * 0.3;
      c.fillStyle = r() < 0.5 ? '#e6c684' : '#b98c3c';
      c.beginPath();
      c.arc(r() * w, r() * h, 1.4 + r() * 2.6, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }, 1);
}

/** Frosted crackled glass with scattered gilding: the jars are not wire-mesh cylinders (19/22). */
export function gildedJarTex() {
  return canvasTex(512, 512, (c, w, h) => {
    const random = rng(58);
    c.fillStyle = 'rgba(233,231,214,0.24)';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) {
      const x = random() * w, y = random() * h;
      const gold = random() < 0.22;
      c.fillStyle = gold ? 'rgba(191,148,65,0.66)' : 'rgba(249,247,232,0.68)';
      const s = 1 + random() * 5;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + s, y - s * 0.2);
      c.lineTo(x + s * 0.6, y + s * 1.8);
      c.lineTo(x - s * 0.4, y + s * 0.8);
      c.fill();
    }
    c.strokeStyle = 'rgba(250,249,235,0.38)';
    c.lineWidth = 0.7;
    for (let i = 0; i < 160; i++) {
      const x = random() * w, y = random() * h;
      c.beginPath(); c.moveTo(x, y);
      c.lineTo(x + 5 + random() * 8, y + 9);
      c.lineTo(x + 1, y + 19);
      c.stroke();
    }
  }, 1);
}

/** Hammered gold: dented relief used as bump on the cart's vase and the jar lids. */
export function hammeredTex(seed = 9) {
  return canvasTex(512, 512, (c, w, h) => {
    const r = rng(seed);
    c.fillStyle = '#e0bd7c';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = r() * w, y = r() * h, rad = 4 + r() * 16;
      const g = c.createRadialGradient(x, y, rad * 0.1, x, y, rad);
      const light = r() < 0.5;
      g.addColorStop(0, light ? 'rgba(255,244,212,0.5)' : 'rgba(120,88,34,0.28)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(x, y, rad * (0.7 + r() * 0.6), rad * (0.6 + r() * 0.5), r() * 3, 0, Math.PI * 2);
      c.fill();
    }
  }, 1);
}

/** Perforated vent grille: dark plate with a regular field of small bright holes. */
export function perfTex(pitch = 7, hole = 2.2) {
  return canvasTex(256, 64, (c, w, h) => {
    c.fillStyle = '#141416';
    c.fillRect(0, 0, w, h);
    for (let y = pitch / 2; y < h; y += pitch) {
      for (let x = pitch / 2; x < w; x += pitch) {
        c.fillStyle = '#3c3d40';
        c.beginPath();
        c.arc(x, y, hole, 0, Math.PI * 2);
        c.fill();
      }
    }
  }, 1);
}

/** Dark glossy screen with the two soft pot-light blobs the photos show reflected in it. */
export function screenReflTex() {
  return canvasTex(512, 288, (c, w, h) => {
    c.fillStyle = '#04050a';
    c.fillRect(0, 0, w, h);
    const blob = (x: number, y: number, rx: number, ry: number, a: number) => {
      const g = c.createRadialGradient(x, y, 0, x, y, rx);
      g.addColorStop(0, `rgba(214,222,228,${a})`);
      g.addColorStop(0.45, `rgba(150,163,172,${a * 0.55})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.save();
      c.translate(x, y);
      c.scale(1, ry / rx);
      c.translate(-x, -y);
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, rx, 0, Math.PI * 2);
      c.fill();
      c.restore();
    };
    blob(w * 0.52, h * 0.56, w * 0.26, h * 0.2, 0.2);
    blob(w * 0.56, h * 0.5, w * 0.1, h * 0.08, 0.26);
    blob(w * 0.2, h * 0.3, w * 0.2, h * 0.22, 0.1);
    blob(w * 0.85, h * 0.75, w * 0.14, h * 0.12, 0.07);
  }, 1);
}

/** The bilingual factory warning label on the fireplace's top vent. */
export function warningLabelTex() {
  return canvasTex(256, 48, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#e9e9e6';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.font = 'bold 13px sans-serif';
    c.fillText('DO NOT MOVE THE UNIT DURING OPERATION', 4, h * 0.32);
    c.font = '11px sans-serif';
    c.fillText('NE PAS DÉPLACER L’APPAREIL PENDANT QU’IL FONCTIONNE', 4, h * 0.72);
  }, 1);
}

/** Round "Best MOM ever" pick that stands in the cart's flowers (photo 17). */
export function momPickTex() {
  return canvasTex(128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#f4eee4';
    c.beginPath();
    c.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#d9b978';
    c.lineWidth = 4;
    c.stroke();
    c.fillStyle = '#4a6f8f';
    c.textAlign = 'center';
    c.font = 'italic 22px serif';
    c.fillText('Best', w / 2, h * 0.42);
    c.font = 'bold 26px serif';
    c.fillText('MOM', w / 2, h * 0.62);
    c.font = '12px serif';
    c.fillStyle = '#a0503f';
    c.fillText('ever', w / 2, h * 0.78);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      c.fillStyle = i % 2 ? '#d98a8a' : '#e0c06a';
      c.beginPath();
      c.arc(w / 2 + Math.cos(a) * w * 0.4, h / 2 + Math.sin(a) * h * 0.4, 2.6, 0, Math.PI * 2);
      c.fill();
    }
  }, 1);
}

/** The AC's black control panel: icon row plus the green LED cluster seen in photos 0/172/193. */
export function acPanelTex() {
  return canvasTex(512, 160, (c, w, h) => {
    c.fillStyle = '#15171a';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#2c2f33';
    c.lineWidth = 3;
    c.strokeRect(3, 3, w - 6, h - 6);
    // icon row
    c.fillStyle = '#b9bec4';
    c.font = '17px sans-serif';
    c.textAlign = 'center';
    const labels = ['−', '+', 'MODE', 'FAN', 'TIMER', 'POWER'];
    labels.forEach((s, i) => c.fillText(s, 60 + i * 78, 44));
    // LED readout
    c.fillStyle = '#0f2016';
    c.fillRect(w * 0.36, h * 0.52, w * 0.28, h * 0.3);
    c.fillStyle = '#38e07a';
    c.font = 'bold 30px monospace';
    c.fillText('−−', w * 0.5, h * 0.77);
    c.font = '13px sans-serif';
    c.fillStyle = '#7f8a92';
    c.fillText('COOL  ·  FAN HIGH', w * 0.5, h * 0.94);
    c.fillRect(w * 0.1, h * 0.6, 34, 4);
    c.fillRect(w * 0.82, h * 0.6, 34, 4);
  }, 1);
}

/** Small blue-and-white energy sticker on the purifier and the AC's rating plate. */
export function ratingTex() {
  return canvasTex(160, 200, (c, w, h) => {
    c.fillStyle = '#f2f2ee';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#c8c8c2';
    c.lineWidth = 2;
    c.strokeRect(2, 2, w - 4, h - 4);
    c.fillStyle = '#33363a';
    c.font = 'bold 12px sans-serif';
    c.textAlign = 'center';
    c.fillText('RATING LABEL', w / 2, 22);
    c.fillStyle = '#8a8f93';
    for (let i = 0; i < 10; i++) {
      c.fillRect(14, 40 + i * 13, w - 28 - (i % 3) * 18, 4);
    }
    c.fillStyle = '#1d63c8';
    c.fillRect(w * 0.25, h * 0.82, w * 0.5, h * 0.1);
  }, 1);
}

/**
 * The sunburst mirror's frame: mosaic of cream / beige / brown pearl tiles between the gold scale
 * rings (photo 141). Drawn once, mapped onto the flat annulus of the frame.
 */
export function pearlMosaicTex(seed = 41) {
  return canvasTex(512, 512, (c, w, h) => {
    const r = rng(seed);
    c.fillStyle = '#e6dccb';
    c.fillRect(0, 0, w, h);
    // irregular quad tiles, each a slightly different shell/pearl tone
    const tones = ['#efe6d6', '#ddcdb3', '#c9b596', '#a98d6c', '#8d6f52', '#f3ecdf', '#bfa585'];
    for (let i = 0; i < 620; i++) {
      const x = r() * w, y = r() * h;
      const s = 12 + r() * 26;
      c.fillStyle = tones[Math.floor(r() * tones.length)];
      c.beginPath();
      const n = 4 + Math.floor(r() * 2);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + r() * 0.5;
        const rad = s * (0.6 + r() * 0.5);
        const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
        if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(90,72,52,0.35)';
      c.lineWidth = 1.5;
      c.stroke();
    }
    // a few gold flecks where the light catches the shell
    for (let i = 0; i < 140; i++) {
      c.fillStyle = r() < 0.5 ? 'rgba(255,246,214,0.6)' : 'rgba(190,150,80,0.5)';
      c.beginPath();
      c.arc(r() * w, r() * h, 1 + r() * 3, 0, Math.PI * 2);
      c.fill();
    }
  }, 1);
}

/** Vertical rib relief for the cobalt vase (canvas grey, used as bump). */
export function ribBumpTex() {
  return canvasTex(256, 64, (c, w, h) => {
    c.fillStyle = '#808080';
    c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) {
      const g = c.createLinearGradient(x, 0, x + 8, 0);
      g.addColorStop(0, '#4a4a4a');
      g.addColorStop(0.45, '#d8d8d8');
      g.addColorStop(0.7, '#9a9a9a');
      g.addColorStop(1, '#4a4a4a');
      c.fillStyle = g;
      c.fillRect(x, 0, 8, h);
    }
  }, 1);
}

/** Marble surface: white ground, thin grey veins, used for the hearth and the fireplace trim. */
export function whiteMarbleTex(seed = 31) {
  return canvasTex(1024, 1024, (c, w, h) => {
    const r = rng(seed);
    c.fillStyle = '#f4f2ee';
    c.fillRect(0, 0, w, h);
    for (let k = 0; k < 26; k++) {
      const x = r() * w, y = r() * h, len = 260 + r() * 700, a = -0.5 + r() * 1.4;
      c.beginPath();
      c.moveTo(x, y);
      let px = x, py = y;
      for (let s = 0; s < 40; s++) {
        px += Math.cos(a) * (len / 40) + Math.sin(s * 0.9 + k) * 5;
        py += Math.sin(a) * (len / 40) + Math.cos(s * 1.1 + k) * 5;
        c.lineTo(px, py);
      }
      c.strokeStyle = r() < 0.5 ? '#9d9a90' : '#bdb9ac';
      c.globalAlpha = 0.22 + r() * 0.4;
      c.lineWidth = 1.0 + r() * 3.0;
      c.stroke();
    }
    // a couple of stronger features, like the photo's diagonal vein
    for (let k = 0; k < 3; k++) {
      const x = r() * w, y = r() * h, len = 500 + r() * 400, a = 0.5 + r() * 0.5;
      c.beginPath();
      c.moveTo(x, y);
      let px = x, py = y;
      for (let s = 0; s < 50; s++) {
        px += Math.cos(a) * (len / 50) + Math.sin(s * 0.7 + k) * 7;
        py += Math.sin(a) * (len / 50) + Math.cos(s * 0.8 + k) * 7;
        c.lineTo(px, py);
      }
      c.strokeStyle = '#8b8880';
      c.globalAlpha = 0.5;
      c.lineWidth = 2.4 + r() * 2.4;
      c.stroke();
    }
    c.globalAlpha = 1;
  }, 1);
}

/** Vertical stripes/mottle for the mushroom cap (olive-brown glaze). */
export function mushroomCapTex(seed = 12) {
  return canvasTex(256, 256, (c, w, h) => {
    const r = rng(seed);
    c.fillStyle = '#6e6c46';
    c.fillRect(0, 0, w, h);
    for (let k = 0; k < 260; k++) {
      const y = r() * h;
      c.strokeStyle = r() < 0.5 ? 'rgba(48,50,26,0.6)' : 'rgba(140,138,96,0.35)';
      c.lineWidth = 1 + r() * 4;
      c.beginPath();
      c.moveTo(0, y);
      for (let x = 0; x <= w; x += 16) c.lineTo(x, y + Math.sin(x * 0.05 + k) * 4);
      c.stroke();
    }
    for (let k = 0; k < 40; k++) {
      const x = r() * w, y = r() * h;
      const g = c.createRadialGradient(x, y, 0, x, y, 8 + r() * 26);
      g.addColorStop(0, 'rgba(96,74,40,0.5)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x - 30, y - 30, 60, 60);
    }
  }, 1);
}

/** The mushroom's stem: pale wood-grain cream with brown streaks. */
export function mushroomStemTex(seed = 13) {
  return canvasTex(128, 256, (c, w, h) => {
    const r = rng(seed);
    c.fillStyle = '#d8c9a8';
    c.fillRect(0, 0, w, h);
    for (let k = 0; k < 90; k++) {
      const x = r() * w;
      c.strokeStyle = r() < 0.6 ? 'rgba(150,110,66,0.45)' : 'rgba(240,232,210,0.5)';
      c.lineWidth = 0.8 + r() * 3;
      c.beginPath();
      c.moveTo(x, 0);
      for (let y = 0; y <= h; y += 12) c.lineTo(x + Math.sin(y * 0.05 + k) * 3, y);
      c.stroke();
    }
  }, 1);
}

/** Cool-Living top / front brand mark (photos 0/172). */
export function coolLivingLogoTex() {
  return canvasTex(256, 64, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#2f78c4';
    c.font = 'bold 28px sans-serif';
    c.textAlign = 'center';
    c.fillText('COOL-LIVING', w / 2, h * 0.68);
  }, 1);
}

/** AC IR remote face: button grid + blue brand (photos 0/172). */
export function acRemoteFaceTex() {
  return canvasTex(128, 384, (c, w, h) => {
    c.fillStyle = '#f2f0ea';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#d8d6d0';
    c.fillRect(8, 12, w - 16, 40);
    c.fillStyle = '#3a3d42';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 3; col++) {
        const x = 28 + col * 36, y = 70 + row * 32;
        c.beginPath();
        c.arc(x, y, 7, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.fillStyle = '#2f78c4';
    c.font = 'bold 14px sans-serif';
    c.textAlign = 'center';
    c.fillText('COOL-LIVING', w / 2, h - 24);
  }, 1);
}

/** Aranet4 e-ink face: large CO₂ ppm + traffic-light bar. */
export function aranetScreenTex() {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#e8e6da';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#1a1c1e';
    c.font = 'bold 92px sans-serif';
    c.textAlign = 'center';
    c.fillText('812', w / 2, h * 0.52);
    c.font = '22px sans-serif';
    c.fillStyle = '#5a5e62';
    c.fillText('ppm CO₂', w / 2, h * 0.66);
    // status bar: green → yellow → red
    const bw = w * 0.7, bh = 14, bx = (w - bw) / 2, by = h * 0.78;
    const grd = c.createLinearGradient(bx, 0, bx + bw, 0);
    grd.addColorStop(0, '#3cb85a');
    grd.addColorStop(0.45, '#3cb85a');
    grd.addColorStop(0.55, '#e0c03a');
    grd.addColorStop(0.75, '#e0c03a');
    grd.addColorStop(1, '#d0453a');
    c.fillStyle = grd;
    c.fillRect(bx, by, bw, bh);
    c.fillStyle = '#1a1c1e';
    c.fillRect(bx + bw * 0.38 - 2, by - 3, 4, bh + 6);
    c.font = '16px sans-serif';
    c.fillStyle = '#6a6e72';
    c.fillText('aranet4', w / 2, h * 0.94);
  }, 1);
}

/** Winix top console face (mode strip). */
export function purifierPanelTex() {
  return canvasTex(384, 128, (c, w, h) => {
    c.fillStyle = '#1c1e22';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#9aa0a6';
    c.font = '11px sans-serif';
    c.textAlign = 'center';
    const labels = ['Sleep', 'Low', 'Med', 'High', 'Turbo'];
    labels.forEach((s, i) => {
      const x = 50 + i * 58;
      c.beginPath();
      c.arc(x, 38, 5, 0, Math.PI * 2);
      c.fill();
      c.fillText(s, x, 62);
    });
    c.fillStyle = '#c8ccd0';
    c.beginPath();
    c.arc(w - 48, h / 2, 14, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#1c1e22';
    c.beginPath();
    c.arc(w - 48, h / 2, 6, 0, Math.PI * 2);
    c.fill();
  }, 1);
}

/** WINIX wordmark for the tower purifier front. */
export function winixLogoTex() {
  return canvasTex(200, 48, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#4a4e52';
    c.font = 'bold 26px sans-serif';
    c.textAlign = 'center';
    c.fillText('WINIX', w / 2, h * 0.72);
  }, 1);
}

