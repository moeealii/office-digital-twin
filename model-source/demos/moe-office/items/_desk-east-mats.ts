import * as THREE from 'three';
import { textured } from '../../../packages/room-runtime/materials';
import { canvasTex, heightToNormal, noiseNormal, loadTex, mulberry32 } from './_desk-east-geo';
import { NOTEBOOK_PAGE, WAFER_LABEL, FLORAL_BOX } from './_desk-east-graphics';

/**
 * Materials for the east desk, its gear, the mesh chair and the cream tufted loveseat.
 * Created inside build() (never at module scope) so the runtime's texture preload has finished.
 */

const SRGB = THREE.SRGBColorSpace;

function repeat(tex: THREE.Texture, n: number) {
  const t = tex.clone();
  t.repeat.set(n, n);
  return t;
}

/** pale-tan leather: CC0 grain/roughness maps (preloaded by the room) under a flat cream albedo */
function creamLeather() {
  const base = textured({ color: '#c8b89d', set: 'leather', repeat: 3.4, diffuse: false });
  const m = new THREE.MeshPhysicalMaterial({
    color: '#cbbc9f',
    normalMap: base.normalMap,
    normalScale: new THREE.Vector2(0.42, 0.42),
    roughnessMap: base.roughnessMap,
    roughness: 0.74,
    metalness: 0,
    clearcoat: 0.07,
    clearcoatRoughness: 0.62,
    sheen: 0.22,
    sheenRoughness: 0.85,
    sheenColor: new THREE.Color('#fff6e4'),
  });
  m.name = 'cream-leather';
  return m;
}


/** diamond-quilt normal map matching the loveseat's tuft lattice (one diamond per tile) */
function quiltNormal(size: number, amp: number) {
  return canvasTex(size, size, (c, w, h) => {
    const hgt = new Float32Array(w * h);
    const puff = (t: number) => Math.pow(0.5 - 0.5 * Math.cos(2 * Math.PI * t), 0.6);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const v = y / h;
        hgt[y * w + x] = amp * puff(u + v) * puff(u - v);
      }
    }
    heightToNormal(c, hgt, w, h, 2.4);
  }, false, true);
}

/** diamond-quilt colour map: the seams sit in shadow, the puffs catch light */
function quiltColor(size: number) {
  return canvasTex(size, size, (c, w, h) => {
    const img = c.createImageData(w, h);
    const puff = (t: number) => Math.pow(0.5 - 0.5 * Math.cos(2 * Math.PI * t), 0.6);
    const dark = [166, 146, 112];
    const light = [226, 213, 184];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const v = y / h;
        const f = Math.pow(puff(u + v) * puff(u - v), 0.55);
        const i = (y * w + x) * 4;
        for (let k = 0; k < 3; k++) img.data[i + k] = dark[k] + (light[k] - dark[k]) * f;
        img.data[i + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
  }, true, true);
}

/** the tufted back's leather: cream leather + quilt relief and quilt shading */
function quiltLeather(base: THREE.MeshPhysicalMaterial) {
  const quilt = quiltNormal(256, 1);
  quilt.repeat.set(1 / 0.235, 1 / 0.2); // one tile per tuft cell
  const tint = quiltColor(256);
  tint.repeat.set(1 / 0.235, 1 / 0.2);
  const m = base.clone();
  m.normalMap = quilt;
  m.normalScale = new THREE.Vector2(3.2, 3.2);
  m.map = tint;
  m.color = new THREE.Color('#ffffff');
  m.roughness = 0.82;
  m.name = 'quilted-leather';
  return m;
}

export type DEMats = Awaited<ReturnType<typeof deMats>>;

export async function deMats() {
  const [notebookPhoto, waferPhoto, floralPhoto] = await Promise.all([
    loadTex(NOTEBOOK_PAGE), loadTex(WAFER_LABEL), loadTex(FLORAL_BOX),
  ]);
  const fine = noiseNormal(256, 24, 1.1, 5); // fine plastic/metal micro grain
  // Actual open perforations, not black dots on an opaque sheet: the desk shows through in 161.
  const dot = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#383b3c'; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'destination-out';
    for (let y = -8; y < h + 8; y += 8) for (let x = -8; x < w + 8; x += 8) {
      c.beginPath(); c.arc(x + ((y / 8) % 2) * 4, y + 4, 2.8, 0, Math.PI * 2); c.fill();
    }
  }, true, true);
  dot.repeat.set(14, 14); // ~92 perforations across the .41 m back, photo 161

  // Deterministic handwriting on loose pages; the notebook itself uses rectified photo 114.
  const random = mulberry32(41);
  const notes = canvasTex(512, 640, (c, w, h) => {
    c.fillStyle = '#f6f4ec';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(80,120,170,.25)';
    c.lineWidth = 1;
    for (let y = 60; y < h; y += 30) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    c.strokeStyle = '#2a3f6d';
    for (let i = 0; i < 46; i++) {
      const y = 66 + i * 12.4;
      c.lineWidth = 1.4;
      c.beginPath();
      let x = 34 + (i % 3) * 6;
      c.moveTo(x, y);
      while (x < w - 40) {
        const step = 4 + random() * 7;
        x += step;
        c.lineTo(x, y + (random() - 0.5) * 8);
      }
      c.stroke();
    }
  });

  const m = {
    creamLeather: creamLeather(),
    quiltLeather: quiltLeather(creamLeather()),
    leatherSeam: new THREE.MeshStandardMaterial({ color: '#cbba9b', roughness: 0.85 }),
    tuftButton: new THREE.MeshStandardMaterial({ color: '#8b7856', roughness: 0.66 }),
    /* ---- the black sit-stand desk ---- */
    deskTop: new THREE.MeshPhysicalMaterial({
      color: '#141517',
      roughness: 0.42,
      metalness: 0.08,
      clearcoat: 0.3,
      clearcoatRoughness: 0.42,
      normalMap: repeat(fine, 3),
      normalScale: new THREE.Vector2(0.12, 0.12),
    }),
    deskBlack: new THREE.MeshStandardMaterial({ color: '#141517', roughness: 0.55, metalness: 0.1 }),
    frameSteel: new THREE.MeshStandardMaterial({ color: '#1a1b1d', roughness: 0.38, metalness: 0.62 }),
    armWhite: new THREE.MeshStandardMaterial({ color: '#dfe4e0', roughness: 0.34, metalness: 0.15 }),
    armGrey: new THREE.MeshStandardMaterial({ color: '#b9c3bd', roughness: 0.4, metalness: 0.2 }),
    alu: new THREE.MeshStandardMaterial({ color: '#c9cdcd', roughness: 0.28, metalness: 0.95 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#d8dcdd', roughness: 0.12, metalness: 1 }),
    blackGloss: new THREE.MeshPhysicalMaterial({ color: '#08090a', roughness: 0.12, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
    monitorShell: new THREE.MeshStandardMaterial({ color: '#0e0f11', roughness: 0.52, metalness: 0.25 }),
    screenOff: new THREE.MeshPhysicalMaterial({
      color: '#05070a', roughness: 0.06, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.04,
    }),
    rubber: new THREE.MeshStandardMaterial({ color: '#101012', roughness: 0.94 }),
    /* ---- mesh task chair ---- */
    mesh: new THREE.MeshStandardMaterial({
      color: '#ffffff', map: dot, alphaTest: 0.42,
      normalMap: repeat(fine, 15), normalScale: new THREE.Vector2(0.12, 0.12),
      roughness: 0.86, metalness: 0.1, side: THREE.DoubleSide,
    }),
    chairFrame: new THREE.MeshStandardMaterial({ color: '#35383b', roughness: 0.60, metalness: 0.08 }),
    chairShell: new THREE.MeshStandardMaterial({ color: '#b5bab4', roughness: 0.70, metalness: 0 }),
    seatFabric: new THREE.MeshStandardMaterial({ color: '#242628', roughness: 0.95 }),
    silverBand: new THREE.MeshStandardMaterial({ color: '#e5e5df', roughness: 0.32, metalness: 0.50, envMapIntensity: 1.4 }),
    /* ---- desk gear ---- */
    laptop: new THREE.MeshPhysicalMaterial({
      color: '#eceef0', roughness: 0.34, metalness: 0.2, clearcoat: 0.4, clearcoatRoughness: 0.28,
      normalMap: repeat(fine, 6), normalScale: new THREE.Vector2(0.04, 0.04),
    }),
    paper: new THREE.MeshStandardMaterial({ color: '#f4f1e7', roughness: 0.9 }),
    notes: new THREE.MeshStandardMaterial({ map: notebookPhoto, roughness: 0.92 }),
    looseNotes: new THREE.MeshStandardMaterial({ map: notes, roughness: 0.92, side: THREE.DoubleSide }),
    waferLabel: new THREE.MeshStandardMaterial({ map: waferPhoto, roughness: 0.53 }),
    floralBox: new THREE.MeshStandardMaterial({ map: floralPhoto, roughness: 0.8 }),
    card: new THREE.MeshStandardMaterial({ color: '#e8dfc8', roughness: 0.85 }),
    cardboard: new THREE.MeshStandardMaterial({ color: '#b08a5c', roughness: 0.92 }),
    ceramic: new THREE.MeshStandardMaterial({ color: '#efeade', roughness: 0.32 }),
    cupBlack: new THREE.MeshStandardMaterial({ color: '#17181a', roughness: 0.4 }),
    tin: new THREE.MeshStandardMaterial({ color: '#f1ede4', roughness: 0.44, metalness: 0.05 }),
    steelMesh: new THREE.MeshStandardMaterial({ color: '#b6b9ba', roughness: 0.45, metalness: 0.7 }),
    clearBottle: new THREE.MeshPhysicalMaterial({
      color: '#e8f0f2', roughness: 0.18, metalness: 0, transparent: true, opacity: 0.20, depthWrite: false, side: THREE.DoubleSide,
    }),
    blueLiquid: new THREE.MeshStandardMaterial({ color: '#abc9d2', roughness: 0.35, transparent: true, opacity: 0.16, depthWrite: false }),
    whiteBottle: new THREE.MeshStandardMaterial({ color: '#f2f1ec', roughness: 0.42 }),
    capGreen: new THREE.MeshStandardMaterial({ color: '#1f4a2c', roughness: 0.95 }),
    trayBlack: new THREE.MeshStandardMaterial({ color: '#131416', roughness: 0.6, metalness: 0.15 }),
    binBlue: new THREE.MeshStandardMaterial({ color: '#2a4d78', roughness: 0.75, side: THREE.DoubleSide }),
    cable: new THREE.MeshStandardMaterial({ color: '#1b1c1e', roughness: 0.8 }),
    cableGrey: new THREE.MeshStandardMaterial({ color: '#c8c8c4', roughness: 0.8 }),
    tissue: new THREE.MeshStandardMaterial({ color: '#f7f5f1', roughness: 0.95 }),
    pinkBox: new THREE.MeshStandardMaterial({ color: '#c08c92', roughness: 0.88 }),
    blueBox: new THREE.MeshStandardMaterial({ color: '#5b7590', roughness: 0.88 }),
    penBlue: new THREE.MeshStandardMaterial({ color: '#2a4f9b', roughness: 0.45 }),
    penRed: new THREE.MeshStandardMaterial({ color: '#a83232', roughness: 0.45 }),
  };
  return m;
}
