import * as THREE from 'three';
import { canvasTex, makeMaterials, rng } from './_moe-kit';
import {
  acPanelTex, acRemoteFaceTex, aranetScreenTex, coolLivingLogoTex, gildedJarTex, hammeredTex, laceTex,
  momPickTex, mushroomCapTex, mushroomStemTex, pearlMosaicTex, perfTex, purifierPanelTex,
  ratingTex, ribBumpTex, screenReflTex, warningLabelTex, whiteMarbleTex, winixLogoTex,
} from './_fireplace-geo';

/**
 * Every material the wall-1 modules use, created inside build() (after the texture preload), so the
 * TV glass, the cart's gilt, the marble hearth and the AC's plastic are shared instead of cloned.
 */
export function fireplaceMats() {
  const kit = makeMaterials();
  const named = <M extends THREE.Material>(name: string, m: M) => ((m.name = name), m);

  // --- television -------------------------------------------------------------------------
  // off, at night: a near-black panel that mirrors the room.  Photos 0/192 show a soft oval of
  // pot light in it, which a clearcoat alone cannot produce offline, so the reflection is painted.
  const refl = screenReflTex();
  const tvGlass = named('tv-glass', new THREE.MeshPhysicalMaterial({
    color: '#05060a', roughness: 0.055, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.04,
    envMapIntensity: 1.5,
  }));
  const tvReflection = named('tv-reflection', new THREE.MeshBasicMaterial({
    map: refl, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  const tvBezel = named('tv-bezel', new THREE.MeshStandardMaterial({ color: '#0b0c0e', roughness: 0.42, metalness: 0.5 }));
  const tvBody = named('tv-body', new THREE.MeshStandardMaterial({ color: '#101113', roughness: 0.66, metalness: 0.35 }));
  const standBlack = named('stand-black', new THREE.MeshStandardMaterial({ color: '#121316', roughness: 0.36, metalness: 0.55 }));

  // --- fireplace --------------------------------------------------------------------------
  const marble = whiteMarbleTex();
  marble.repeat.set(1.6, 0.55);
  const hearth = named('hearth-marble', new THREE.MeshPhysicalMaterial({
    map: marble, color: '#ffffff', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.06,
    envMapIntensity: 0.8,
  }));
  const fireGlass = named('firebox-glass', new THREE.MeshPhysicalMaterial({
    color: '#060608', roughness: 0.05, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.03,
    transparent: true, opacity: 0.55, envMapIntensity: 1.6, depthWrite: false,
  }));
  const fireInterior = named('firebox-interior', new THREE.MeshStandardMaterial({ color: '#08090a', roughness: 0.55, metalness: 0.2 }));
  const fireFrame = named('firebox-frame', new THREE.MeshStandardMaterial({ color: '#1b1c1f', roughness: 0.3, metalness: 0.75 }));
  const fireEdge = named('firebox-edge', new THREE.MeshStandardMaterial({ color: '#282a2c', roughness: 0.34, metalness: 0.9 }));
  const perf = perfTex();
  perf.repeat.set(14, 1);
  const ventGrille = named('firebox-vent', new THREE.MeshStandardMaterial({ map: perf, roughness: 0.5, metalness: 0.4 }));
  const label = warningLabelTex();
  const warningLabel = named('firebox-label', new THREE.MeshBasicMaterial({
    map: label, transparent: true, depthWrite: false,
  }));
  const crystalClear = named('fire-crystal', new THREE.MeshPhysicalMaterial({
    color: '#e8f0f5', roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.9,
    envMapIntensity: 1.4, ior: 1.5, side: THREE.DoubleSide,
    emissive: '#aab6c2', emissiveIntensity: 0.85,
  }));
  // The media bed still reads as a bright crushed-glass band with the unit off: the chips catch the
  // white walls, so they carry a little of that bounce rather than going black behind the glass.
  const crystalWhite = named('fire-crystal-bright', new THREE.MeshStandardMaterial({
    color: '#e9eef1', roughness: 0.32, metalness: 0.05, envMapIntensity: 1.2,
    emissive: '#6a7480', emissiveIntensity: 0.42,
  }));
  const driftwood = named('fire-driftwood', new THREE.MeshStandardMaterial({ color: '#8a8173', roughness: 0.90 }));

  // --- gold bar cart ----------------------------------------------------------------------
  const lace = laceTex(5, 0.55);
  const gilt = named('cart-gilt', new THREE.MeshStandardMaterial({ color: '#c8a97a', roughness: 0.28, metalness: 0.85, envMapIntensity: 1.05 }));
  const giltMatte = named('cart-gilt-matte', new THREE.MeshStandardMaterial({ color: '#b59a70', roughness: 0.42, metalness: 0.8 }));
  const hammer = hammeredTex();
  hammer.repeat.set(2, 1.4);
  const giltHammered = named('cart-gilt-hammered', new THREE.MeshStandardMaterial({
    bumpMap: hammer, bumpScale: 0.0016, color: '#d9b878', roughness: 0.26, metalness: 0.62,
  }));
  const laceSleeve = named('cart-lace', new THREE.MeshStandardMaterial({
    map: lace, transparent: true, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.5,
    color: '#c49a55', depthWrite: false, alphaTest: 0.4,
  }));
  // Photos 19/22/31 show upside-down jar bases and the pitcher: these are mirrored shelves.
  // The room environment provides approximate reflections, not a live planar mirror of each prop.
  const mirror = named('cart-shelf-mirror', new THREE.MeshPhysicalMaterial({
    color: '#adb3ad', roughness: 0.06, metalness: 1,
    clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.2,
  }));
  const glassJar = named('cart-glass-jar', new THREE.MeshPhysicalMaterial({
    color: '#eef0ec', roughness: 0.04, metalness: 0.02, transparent: true, opacity: 0.26,
    side: THREE.DoubleSide, envMapIntensity: 1.8, depthWrite: false,
  }));
  const jarSleeve = named('cart-jar-gilding', new THREE.MeshStandardMaterial({
    map: gildedJarTex(), color: '#fff7df', roughness: 0.32, metalness: 0.13,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  const frostedJar = named('cart-frosted-jar', new THREE.MeshPhysicalMaterial({
    color: '#f6f3ea', roughness: 0.16, metalness: 0.05, transparent: true, opacity: 0.24,
    side: THREE.DoubleSide, envMapIntensity: 1.6, depthWrite: false,
  }));
  const cobalt = named('cart-cobalt', new THREE.MeshPhysicalMaterial({
    color: '#10269c', roughness: 0.07, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05,
    bumpMap: ribBumpTex(), bumpScale: 0.0018, envMapIntensity: 1.5,
  }));
  const capTex = mushroomCapTex();
  const mushroomCap = named('cart-mushroom-cap', new THREE.MeshPhysicalMaterial({
    map: capTex, bumpMap: capTex, bumpScale: 0.0012, color: '#b0ae86',
    roughness: 0.24, clearcoat: 0.55, clearcoatRoughness: 0.12,
  }));
  const stemTex = mushroomStemTex();
  const mushroomStem = named('cart-mushroom-stem', new THREE.MeshStandardMaterial({ map: stemTex, roughness: 0.45 }));
  const ceramicCream = named('cart-ceramic', new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.36 }));
  const ceramicBrown = named('cart-ceramic-rim', new THREE.MeshStandardMaterial({ color: '#7d4a2e', roughness: 0.42 }));
  const petalWhite = named('flower-white', new THREE.MeshStandardMaterial({ color: '#f3f2e5', roughness: 0.88 }));
  const petalBlue = named('flower-blue', new THREE.MeshStandardMaterial({ color: '#d3e5e2', roughness: 0.86 }));
  const petalGreen = named('flower-green', new THREE.MeshStandardMaterial({ color: '#dcead2', roughness: 0.9 }));
  const leaf = named('flower-leaf', new THREE.MeshStandardMaterial({ color: '#3f5a33', roughness: 0.86, side: THREE.DoubleSide }));
  const roseRed = named('cart-rose', new THREE.MeshStandardMaterial({ color: '#5c1220', roughness: 0.55 }));
  const wireGold = named('cart-wire', new THREE.MeshStandardMaterial({ color: '#c9a35c', roughness: 0.3, metalness: 0.9 }));
  const pickCard = named('cart-pick-card', new THREE.MeshBasicMaterial({
    map: momPickTex(), transparent: true, depthWrite: false,
  }));
  const sprayLabel = named('cart-spray-label', new THREE.MeshBasicMaterial({
    map: canvasTex(96, 128, (c, w, h) => {
      c.fillStyle = '#f2e6da';
      c.fillRect(0, 0, w, h);
      const r = rng(2);
      for (let i = 0; i < 26; i++) {
        c.fillStyle = ['#d96a5a', '#e2a45c', '#8aa860'][i % 3];
        c.beginPath();
        c.arc(10 + r() * (w - 20), 20 + r() * (h - 40), 4 + r() * 7, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#5c5148';
      c.font = '9px sans-serif';
      c.textAlign = 'center';
      c.fillText('LINEN', w / 2, h - 12);
    }), transparent: false,
  }));

  // --- appliances -------------------------------------------------------------------------
  const applianceWhite = named('appliance-white', new THREE.MeshPhysicalMaterial({
    color: '#eceae3', roughness: 0.34, clearcoat: 0.28, clearcoatRoughness: 0.42,
  }));
  const applianceWhiteMatte = named('appliance-white-matte', new THREE.MeshStandardMaterial({ color: '#e4e2db', roughness: 0.55 }));
  const applianceDark = named('appliance-dark', new THREE.MeshStandardMaterial({ color: '#26282c', roughness: 0.4, metalness: 0.2 }));
  const appliancePanel = named('ac-panel', new THREE.MeshStandardMaterial({
    map: acPanelTex(), roughness: 0.24, metalness: 0.15,
  }));
  const applianceGrille = named('ac-grille', new THREE.MeshStandardMaterial({ color: '#f1efea', roughness: 0.5 }));
  const hosePlastic = named('hose-plastic', new THREE.MeshStandardMaterial({ color: '#f0eeea', roughness: 0.62 }));
  const hoseGrey = named('hose-grey', new THREE.MeshStandardMaterial({ color: '#c9c7c2', roughness: 0.7 }));
  const rating = named('rating-label', new THREE.MeshBasicMaterial({ map: ratingTex() }));
  const sticker = named('energy-sticker', new THREE.MeshBasicMaterial({
    map: canvasTex(48, 64, (c, w, h) => {
      c.fillStyle = '#f4f4f0';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#1e6fd0';
      c.fillRect(0, 0, w, h * 0.42);
      c.fillStyle = '#ffffff';
      c.font = 'bold 9px sans-serif';
      c.textAlign = 'center';
      c.fillText('ENERGY', w / 2, h * 0.2);
      c.fillText('STAR', w / 2, h * 0.34);
      c.fillStyle = '#1e6fd0';
      c.font = '9px sans-serif';
      c.fillText('Midea', w / 2, h * 0.66);
    }),
  }));
  const logoMidea = named('midea-logo', new THREE.MeshBasicMaterial({
    map: canvasTex(128, 40, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.fillStyle = '#5d6166';
      c.font = 'italic bold 22px sans-serif';
      c.textAlign = 'center';
      c.fillText('Midea', w / 2, h * 0.72);
    }), transparent: true, depthWrite: false,
  }));
  const logoCoolLiving = named('cool-living-logo', new THREE.MeshBasicMaterial({
    map: coolLivingLogoTex(), transparent: true, depthWrite: false,
  }));
  const logoLiving = logoCoolLiving;
  const acRemoteFace = named('ac-remote-face', new THREE.MeshBasicMaterial({
    map: acRemoteFaceTex(),
  }));
  const aranetShell = named('aranet-shell', new THREE.MeshPhysicalMaterial({
    color: '#d8d6d0', roughness: 0.28, transmission: 0.35, thickness: 0.01, transparent: true, opacity: 0.92,
  }));
  const aranetScreen = named('aranet-screen', new THREE.MeshBasicMaterial({ map: aranetScreenTex() }));
  const acLedGreen = named('ac-led-green', new THREE.MeshStandardMaterial({
    color: '#3dff8a', emissive: '#28c05a', emissiveIntensity: 1.4, roughness: 0.35,
  }));
  const purifierConsole = named('purifier-console', new THREE.MeshStandardMaterial({
    color: '#1a1c20', roughness: 0.38, metalness: 0.15,
  }));
  const purifierPanel = named('purifier-panel', new THREE.MeshBasicMaterial({ map: purifierPanelTex() }));
  const purifierLedAmber = named('purifier-led-amber', new THREE.MeshStandardMaterial({
    color: '#ffb020', emissive: '#e09010', emissiveIntensity: 1.6, roughness: 0.4,
  }));
  const logoWinix = named('winix-logo', new THREE.MeshBasicMaterial({
    map: winixLogoTex(), transparent: true, depthWrite: false,
  }));

  // --- sunburst mirror (photo 141) ---------------------------------------------------------
  const pearl = pearlMosaicTex();
  pearl.repeat.set(3, 3);
  const pearlFrame = named('mirror-pearl', new THREE.MeshStandardMaterial({
    map: pearl, roughness: 0.42, metalness: 0.12, envMapIntensity: 0.9,
  }));
  const mirrorGlass = named('mirror-glass', new THREE.MeshStandardMaterial({
    color: '#cfd6d4', roughness: 0.05, metalness: 1, envMapIntensity: 1.9,
  }));
  const bronzeRim = named('mirror-rim', new THREE.MeshStandardMaterial({
    color: '#4a382a', roughness: 0.38, metalness: 0.7,
  }));
  const scaleGold = named('mirror-scale-gold', new THREE.MeshStandardMaterial({
    color: '#c7a367', roughness: 0.3, metalness: 0.85, envMapIntensity: 1.1,
  }));
  const scaleDark = named('mirror-scale-dark', new THREE.MeshStandardMaterial({
    color: '#5b4530', roughness: 0.5, metalness: 0.5,
  }));
  const switchPlate = named('switch-plate', new THREE.MeshStandardMaterial({ color: '#f2f0ea', roughness: 0.42 }));

  // --- wall fittings ----------------------------------------------------------------------
  const outletPlate = named('outlet-plate', new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.42 }));
  const plugWhite = named('plug-white', new THREE.MeshStandardMaterial({ color: '#efeee8', roughness: 0.4 }));
  const cableBlack = named('cable-black', new THREE.MeshStandardMaterial({ color: '#181a1c', roughness: 0.72 }));
  const cableWhite = named('cable-white', new THREE.MeshStandardMaterial({ color: '#e8e6df', roughness: 0.66 }));

  return {
    kit,
    tvGlass, tvReflection, tvBezel, tvBody, standBlack,
    hearth, fireGlass, fireInterior, fireFrame, fireEdge, ventGrille, warningLabel,
    crystalClear, crystalWhite, driftwood,
    gilt, giltMatte, giltHammered, laceSleeve, mirror, glassJar, jarSleeve, frostedJar, cobalt,
    mushroomCap, mushroomStem, ceramicCream, ceramicBrown,
    petalWhite, petalBlue, petalGreen, leaf, roseRed, wireGold, pickCard, sprayLabel,
    applianceWhite, applianceWhiteMatte, applianceDark, appliancePanel, applianceGrille,
    hosePlastic, hoseGrey, rating, sticker, logoMidea, logoLiving, logoCoolLiving, logoWinix,
    acRemoteFace, aranetShell, aranetScreen, acLedGreen,
    purifierConsole, purifierPanel, purifierLedAmber,
    outletPlate, plugWhite, cableBlack, cableWhite,
    pearlFrame, mirrorGlass, bronzeRim, scaleGold, scaleDark, switchPlate,
    // shared CC0-ish palette from the room kit, reused rather than re-created
    rubber: kit.rubber, brass: kit.brass, chrome: kit.chrome, marble: kit.marble,
  };
}

export type FireplaceMats = ReturnType<typeof fireplaceMats>;
