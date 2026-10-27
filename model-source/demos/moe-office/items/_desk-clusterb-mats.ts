import * as THREE from 'three';
import { bumpTex, darkCanLabel, ornamentPrint, physMat, ribBump, std, vinyl, whoLabel } from './_desk-clusterb-kit';

/**
 * Materials for the pedestal clutter. Created inside build() (via clusterMaterials) so textures
 * exist after the runtime's preload. Names are unique per object so a render can be debugged.
 *
 * Surface intent, from the photos:
 *  - the black pump is soft-touch (velvet) resin, low sheen; its lower quarter is clear acrylic
 *    with the dark product showing through;
 *  - the clear pump bottle is thin-walled PET with a milky cream fill;
 *  - the WHOSON can is a white printed aluminium aerosol; its dome is translucent orange;
 *  - the dark can is a printed aerosol with a matt black overcap;
 *  - the bristle tower's filaments are matt maroon nylon with lighter worn tips;
 *  - the green ornament is printed PLA: matt to satin, with visible layer lines (bump).
 */
export type CM = ReturnType<typeof clusterMaterials>;

export function clusterMaterials() {
  const who = whoLabel();
  const dark = darkCanLabel();
  const orn = ornamentPrint();
  const ribs = ribBump();

  // fine horizontal layer lines for the printed green ornament
  const layerBump = bumpTex(64, 256, (c, w, h) => {
    c.fillStyle = '#808080';
    c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      c.fillStyle = y % 6 ? '#a0a0a0' : '#606060';
      c.fillRect(0, y, w, 1);
    }
  }, 6);

  // leather grain for the pen pot
  const leatherBump = bumpTex(256, 256, (c, w, h) => {
    c.fillStyle = '#808080';
    c.fillRect(0, 0, w, h);
    const r = (i: number) => {
      const s = Math.sin(i * 12.9898) * 43758.5453;
      return s - Math.floor(s);
    };
    for (let i = 0; i < 5000; i++) {
      const x = r(i) * w, y = r(i + 7) * h, rad = 1 + r(i + 13) * 3;
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, rad, 0, Math.PI * 2);
      c.fill();
    }
  }, 2);

  const m = {
    // ---- black soft-touch resin (pump body, pen pot) ----
    blackSoft: physMat('cb-black-soft', '#141417', 0.66, { clearcoat: 0.12, clearcoatRoughness: 0.6 }),
    blackSoftPot: physMat('cb-black-pot', '#1b1b1f', 0.74, {
      clearcoat: 0.08, bumpMap: leatherBump, bumpScale: 0.0006,
    }),
    potRim: physMat('cb-pot-rim', '#33333a', 0.5, { clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    blackGloss: physMat('cb-black-gloss', '#0b0b0d', 0.15, { clearcoat: 0.85, clearcoatRoughness: 0.12 }),
    blackMatte: std('cb-black-matte', '#191a1d', 0.78),
    darkGrey: std('cb-dark-grey', '#33363a', 0.55),
    greyPlastic: std('cb-grey-plastic', '#7c8084', 0.5),
    steel: std('cb-steel', '#b9bdc0', 0.3, 0.85),
    alu: std('cb-alu', '#cdd1d4', 0.26, 0.92),
    chrome: std('cb-chrome', '#dfe3e6', 0.14, 1),
    white: std('cb-white', '#eeede9', 0.44),
    whiteGloss: physMat('cb-white-gloss', '#f1f0ec', 0.2, { clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    // ---- clears ----
    clearPET: physMat('cb-clear-pet', '#dce9ea', 0.05, {
      transparent: true, opacity: 0.20, side: THREE.DoubleSide, depthWrite: false,
      clearcoat: 1, clearcoatRoughness: 0.05, ior: 1.5,
    }),
    clearThick: physMat('cb-clear-thick', '#dbe7e8', 0.08, {
      transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false,
      clearcoat: 0.9, clearcoatRoughness: 0.08, ior: 1.5,
    }),
    orangeClear: physMat('cb-orange-clear', '#e5501c', 0.16, {
      transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false,
      clearcoat: 1, clearcoatRoughness: 0.08,
    }),
    cream: physMat('cb-cream', '#f3eddb', 0.4, { transparent: false }),
    productDark: physMat('cb-product-dark', '#2a1d16', 0.3, { clearcoat: 0.4, clearcoatRoughness: 0.3 }),
    productFade: physMat('cb-product-fade', '#6b4a33', 0.34, { transparent: true, opacity: 0.55 }),
    // ---- labels ----
    who: physMat('cb-who-label', '#ffffff', 0.34, { map: who, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
    darkCan: physMat('cb-dark-can-label', '#ffffff', 0.38, { map: dark, metalness: 0.35, clearcoat: 0.3 }),
    whoCapOrange: physMat('cb-who-cap', '#e14a17', 0.22, { clearcoat: 0.7, clearcoatRoughness: 0.2 }),
    maroon: std('cb-maroon', '#5d1226', 0.4),
    // ---- brush ----
    bristle: std('cb-bristle', '#45272a', 0.58),
    bristleTip: std('cb-bristle-tip', '#7b5250', 0.5),
    brushCore: physMat('cb-brush-core', '#231416', 0.32, { clearcoat: 0.4, clearcoatRoughness: 0.3 }),
    // ---- green ornament ----
    green: physMat('cb-green', '#3f8b39', 0.42, {
      clearcoat: 0.25, clearcoatRoughness: 0.45, bumpMap: layerBump, bumpScale: 0.00035,
    }),
    greenDark: std('cb-green-dark', '#1e3a1c', 0.62),
    olive: physMat('cb-olive', '#39442f', 0.55, { bumpMap: layerBump, bumpScale: 0.0006 }),
    ornPrint: std('cb-orn-print', '#ffffff', 0.46, 0, { map: orn }),
    orange: vinyl('cb-orange', '#e2603a', 0.3),
    orangeCard: std('cb-orange-card', '#d9432a', 0.6),
    // ---- pens ----
    blueBarrel: physMat('cb-pen-blue', '#2b4f8e', 0.3, { clearcoat: 0.5 }),
    bluePale: physMat('cb-pen-blue-pale', '#5f79b0', 0.32, { clearcoat: 0.45 }),
    whiteBarrel: physMat('cb-pen-white', '#e9e7e0', 0.3, { clearcoat: 0.4 }),
    greyPencil: std('cb-pencil', '#8e8a80', 0.55),
    graphite: std('cb-graphite', '#2b2b2e', 0.42, 0.35),
    nib: std('cb-nib', '#c8ccd0', 0.24, 0.9),
    ribCollar: physMat('cb-rib-collar', '#eceae3', 0.3, { bumpMap: ribs, bumpScale: 0.0009, clearcoat: 0.3 }),
    // ---- misc ----
    labelWhite: std('cb-label-white', '#f4f2ec', 0.6),
    paperGrey: std('cb-paper-grey', '#d9d6cc', 0.84),
    foil: physMat('cb-foil', '#e6e4dc', 0.36, { metalness: 0.55, clearcoat: 0.3 }),
    red: std('cb-red', '#b3282a', 0.4),
    waterClear: physMat('cb-water', '#dfe9ea', 0.04, { transparent: true, opacity: 0.24, depthWrite: false }),
  };
  return m;
}
