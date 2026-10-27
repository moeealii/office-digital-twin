import * as THREE from 'three';
import { canvasTex, rng } from './_moe-kit';

/**
 * Materials for the lounge items — created inside build() after the texture preload.
 * Photo crops (rectified at the measured planes) live in data/web-assets/moe-office/textures:
 *   lounge-whiteboard.jpg  photos 214/217, board face plane z=-1.80 (handwriting)
 *   lounge-throw.jpg       photo 177, the grey printed throw on the settee
 *   lounge-weave.jpg       photo 177, the woven room-divider panel
 *   lounge-marble-photo125.png is the OFFLINE rectification of photo 125's clean marble strip.
 *   The old procedural lounge-marble.jpg is no longer used; concealed vein continuation remains
 *   reconstructed by mirror-repeating the photographed strip, with capture-light tint removed.
 *   Full capture photos are never a runtime material dependency.
 *   lounge-weave-nor.png   seamless 512 px plain-weave normal map for the divider (20 mm cell).
 * CC0 sets come from /textures/.
 */

const loader = new THREE.TextureLoader();
const PHOTO = '/moe-office/textures/';
const CC0 = '/textures/';

async function photo(file: string) {
  const t = await loader.loadAsync(PHOTO + file);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
async function photoLinear(file: string) {
  const t = await loader.loadAsync(PHOTO + file);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
async function cc0(file: string, repeat = 1, srgb = false) {
  const t = await loader.loadAsync(CC0 + file);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}
function rep(t: THREE.Texture, r: number) {
  const c = t.clone();
  c.needsUpdate = true;
  c.repeat.set(r, r);
  return c;
}

/** hammered copper with a repoussé floral band for the domed dish (photos 103/125) */
function copperBandTex() {
  return canvasTex(512, 128, (c, w, h) => {
    const r = rng(19);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#8a4c2d'); g.addColorStop(0.45, '#c98b5c'); g.addColorStop(1, '#6d3721');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 7; i++) {
      const x = 24 + i * 70;
      // leaves
      c.strokeStyle = '#5c7048'; c.lineWidth = 3;
      for (let k = 0; k < 4; k++) {
        c.beginPath(); c.ellipse(x - 14 + k * 9, h * 0.62 + (k % 2) * 6, 11, 4, -0.5 + k * 0.3, 0, 7); c.stroke();
      }
      // petals
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        c.fillStyle = k % 2 ? '#e7b9b4' : '#f0d9cf';
        c.beginPath(); c.ellipse(x + Math.cos(a) * 11, h * 0.36 + Math.sin(a) * 7, 7, 4.5, a, 0, 7); c.fill();
      }
      c.fillStyle = '#e8d27a';
      c.beginPath(); c.arc(x, h * 0.36, 4.5, 0, 7); c.fill();
      c.strokeStyle = '#f2e0c8'; c.lineWidth = 1; c.beginPath(); c.arc(x - 1.5, h * 0.36 - 1.5, 3.5, 0, 7); c.stroke();
      c.strokeStyle = '#6b3a22'; c.lineWidth = 1.2;
      c.beginPath(); c.arc(x, h * 0.36, 13, 0, 7); c.stroke();
    }
    c.globalAlpha = 0.18;
    for (let i = 0; i < 300; i++) {
      c.fillStyle = r() < 0.5 ? '#ffffff' : '#4a2314';
      c.fillRect(r() * w, r() * h, 1.5, 1.5);
    }
    c.globalAlpha = 1;
  }, 1);
}

/** open rattan weave with see-through holes, for the pouf (photos 103/125) */
function rattanTex() {
  return canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#8d7a5c'; c.fillRect(0, 0, w, h);
    const r = rng(5);
    // diagonal woven strands
    for (let i = -h; i < w + h; i += 36) {
      c.strokeStyle = '#c9b48c'; c.lineWidth = 16;
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke();
      c.strokeStyle = '#a08a63'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(i + 3, 0); c.lineTo(i + h + 3, h); c.stroke();
    }
    for (let i = -h; i < w + h; i += 36) {
      c.strokeStyle = 'rgba(150,128,95,0.9)'; c.lineWidth = 15;
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i - h, h); c.stroke();
    }
    // dark holes in the gaps (large openwork, as in the photo)
    c.fillStyle = '#221a12';
    for (let y = 18; y < h; y += 36) {
      for (let x = 18 + (Math.round(y / 36) % 2) * 18; x < w; x += 36) {
        c.beginPath(); c.arc(x, y, 9.5, 0, 7); c.fill();
      }
    }
    c.globalAlpha = 0.25;
    for (let i = 0; i < 500; i++) {
      c.strokeStyle = r() < 0.5 ? '#e3d2ad' : '#6e5a3c';
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(r() * w, r() * h); c.lineTo(r() * w, r() * h); c.stroke();
    }
    c.globalAlpha = 1;
  }, 2);
}

/** chinoiserie garden stool: green ground, cream bamboo leaves (photos 123/125/177) */
function gardenStoolTex() {
  return canvasTex(512, 256, (c, w, h) => {
    const r = rng(31);
    c.fillStyle = '#5d7746'; c.fillRect(0, 0, w, h);
    c.globalAlpha = 0.3;
    for (let i = 0; i < 40; i++) {
      c.strokeStyle = i % 2 ? '#7a9159' : '#4b6238';
      c.lineWidth = 2 + r() * 6;
      c.beginPath();
      c.moveTo(r() * w, -10);
      c.bezierCurveTo(r() * w, h * 0.3, r() * w, h * 0.7, r() * w, h + 10);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.globalAlpha = 0.55;
    for (let i = 0; i < 16; i++) {
      const x = 16 + i * 32, y = h * (0.22 + (i % 4) * 0.19);
      c.fillStyle = i % 3 === 0 ? '#cfc6ab' : '#ddd6bf';
      // small bamboo leaves on a stem
      for (let k = 0; k < 3; k++) {
        c.save(); c.translate(x + k * 7, y + k * 9); c.rotate(-0.8 + k * 0.5);
        c.beginPath(); c.ellipse(0, 0, 13, 3.6, 0, 0, 7); c.fill(); c.restore();
      }
      c.strokeStyle = '#cfc6ab'; c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(x - 4, y - 18); c.lineTo(x + 7, y + 22); c.stroke();
    }
    c.globalAlpha = 1;
    c.globalAlpha = 0.35;
    c.fillStyle = '#4c6338'; c.fillRect(0, 0, w, 8); c.fillRect(0, h - 8, w, 8);
    c.globalAlpha = 1;
  }, 1);
}

/**
 * Marble rectification is baked offline into lounge-marble-photo125.png: the same measured
 * y=.488 plane, clean z=.73–.91 strip, mirror continuation, and tint/glare normalization.
 * Only marble pixels ship; no full capture photo is requested by the model at runtime.
 */
export type LoungeMats = Awaited<ReturnType<typeof loungeMaterials>>;

export async function loungeMaterials() {
  const [marbleMap, boardMap, throwMap, weaveMap, weaveNor, leatherNor, leatherRough, linenNor, woolNor, oakDiff, oakNor, woolRough, tuftAlbedo, tuftNor, tuftBump] =
    await Promise.all([
      photo('lounge-marble-photo125.png'),
      photo('lounge-whiteboard.jpg'),
      photo('lounge-throw.jpg'),
      photo('lounge-weave.jpg'),
      photoLinear('lounge-weave-nor.png'),
      cc0('leather_nor.jpg', 7),
      cc0('leather_rough.jpg', 7),
      cc0('linen_nor.jpg', 8),
      cc0('wool_nor.jpg', 6),
      cc0('oak_diff.jpg', 1.4, true),
      cc0('oak_nor.jpg', 1.4),
      cc0('wool_rough.jpg', 5),
      // photo 103 rectified on back plane x=2.822 → baked tuft albedo/normal/bump
      photo('lounge-tuft-albedo.jpg'),
      photoLinear('lounge-tuft-nor.png'),
      photoLinear('lounge-tuft-bump.png'),
    ]);
  const named = <M extends THREE.Material>(name: string, m: M) => ((m.name = name), m);

  // warm cream leather (photos 103/123/125) — matte-soft, not glossy plastic
  const cream = named('sofa-cream-leather', new THREE.MeshPhysicalMaterial({
    color: '#e6d9c4', roughness: 0.72, roughnessMap: rep(leatherRough, 3.6),
    normalMap: rep(leatherNor, 3.6), normalScale: new THREE.Vector2(0.18, 0.18),
    clearcoat: 0.12, clearcoatRoughness: 0.55, sheen: 0.28, sheenColor: new THREE.Color('#f0e8da'), sheenRoughness: 0.60,
    specularIntensity: 0.35,
  }));
  // photo-baked Chesterfield field (rectify 103 @ x=2.822, u −0.55…1.35, v 0.28…0.82)
  for (const t of [tuftAlbedo, tuftNor, tuftBump]) {
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 8;
  }
  // photo albedo for leather grain/creases; hand lobes carry volume (normal map only a hint)
  const creamTuft = named('sofa-cream-tuft-photo', new THREE.MeshPhysicalMaterial({
    map: tuftAlbedo, color: '#f3ece3', roughness: 0.70,
    normalMap: tuftNor, normalScale: new THREE.Vector2(0.22, 0.22),
    bumpMap: tuftBump, bumpScale: 0.0025,
    clearcoat: 0.08, clearcoatRoughness: 0.60, sheen: 0.18, sheenColor: new THREE.Color('#f0e8da'),
    sheenRoughness: 0.65, specularIntensity: 0.28,
  }));
  const leatherDark = named('sofa-plinth', new THREE.MeshStandardMaterial({
    color: '#8a8376', roughness: 0.72, normalMap: rep(leatherNor, 4), normalScale: new THREE.Vector2(0.4, 0.4),
  }));
  const piping = named('sofa-piping', new THREE.MeshPhysicalMaterial({
    color: '#cfc8ba', roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.38, normalMap: rep(leatherNor, 6),
  }));
  const setteeLeather = named('settee-ivory-leather', new THREE.MeshPhysicalMaterial({
    color: '#e4d6b8', roughness: 0.55, clearcoat: 0.22, clearcoatRoughness: 0.4,
    normalMap: rep(leatherNor, 3), normalScale: new THREE.Vector2(0.16, 0.16),
  }));
  // the printed throw is a photo crop of a fine knit; tile it so the print reads at knit scale
  // instead of one giant motif stretched over each cloth piece
  const throwTile = throwMap.clone();
  throwTile.needsUpdate = true;
  // mirrored so the crop's edges meet themselves (no tile seams), at roughly the print's real scale
  throwTile.wrapS = throwTile.wrapT = THREE.MirroredRepeatWrapping;
  throwTile.repeat.set(1.3, 1.1);
  const throwMat = named('grey-printed-throw', new THREE.MeshStandardMaterial({
    map: throwTile, color: '#cfcfcf', roughness: 0.98, normalMap: rep(linenNor, 12), normalScale: new THREE.Vector2(0.5, 0.5), side: THREE.DoubleSide,
  }));
  const blue = named('blue-fleece', new THREE.MeshPhysicalMaterial({
    color: '#173f8f', roughness: 1, sheen: 0.85, sheenColor: new THREE.Color('#5a92e6'), sheenRoughness: 0.6,
    normalMap: rep(woolNor, 9), normalScale: new THREE.Vector2(0.5, 0.5),
  }));
  const blackJacket = named('black-jacket', new THREE.MeshPhysicalMaterial({
    color: '#15161a', roughness: 0.92, sheen: 0.35, sheenColor: new THREE.Color('#4a4a52'),
    normalMap: rep(woolNor, 8), normalScale: new THREE.Vector2(0.4, 0.4),
  }));
  const card = named('lounge-cardboard', new THREE.MeshStandardMaterial({
    color: '#c39a6b', roughness: 0.94, normalMap: rep(woolNor, 14), normalScale: new THREE.Vector2(0.25, 0.25),
  }));
  const cardTape = named('cardboard-tape', new THREE.MeshStandardMaterial({ color: '#c9a269', roughness: 0.8 }));
  const gold = named('lounge-gold', new THREE.MeshStandardMaterial({ color: '#c8a35a', metalness: 1, roughness: 0.22 }));
  const copper = named('lounge-copper', new THREE.MeshPhysicalMaterial({
    color: '#d8a393', metalness: 1, roughness: 0.28, clearcoat: 0.5, clearcoatRoughness: 0.18, envMapIntensity: 1.7, side: THREE.DoubleSide,
  }));
  const bandTex = copperBandTex();
  const copperBand = named('lounge-copper-band', new THREE.MeshPhysicalMaterial({
    map: bandTex, bumpMap: bandTex, bumpScale: 0.0035, metalness: 1, roughness: 0.3, envMapIntensity: 1.7,
    clearcoat: 0.45, clearcoatRoughness: 0.18,
  }));
  const copperDark = named('lounge-copper-dark', new THREE.MeshStandardMaterial({ color: '#8d573a', metalness: 0.95, roughness: 0.4, envMapIntensity: 1.4 }));
  const marble = named('lounge-marble', new THREE.MeshPhysicalMaterial({
    map: marbleMap, color: '#e6e0d2', roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.06, metalness: 0,
    normalMap: rep(linenNor, 2), normalScale: new THREE.Vector2(0.04, 0.04),
  }));
  const boardTex = boardMap.clone();
  boardTex.needsUpdate = true;
  boardTex.repeat.set(0.92, 0.91);
  boardTex.offset.set(0.055, 0.045);
  const board = named('lounge-whiteboard-face', new THREE.MeshPhysicalMaterial({
    map: boardTex, color: '#e4e1da', roughness: 0.28, clearcoat: 0.5, clearcoatRoughness: 0.25, metalness: 0,
  }));
  const boardBack = named('lounge-whiteboard-back', new THREE.MeshStandardMaterial({ color: '#eeece5', roughness: 0.42 }));
  const alu = named('lounge-alu', new THREE.MeshStandardMaterial({ color: '#9ba1a4', metalness: 0.8, roughness: 0.42 }));
  const steel = named('lounge-steel', new THREE.MeshStandardMaterial({ color: '#a9aeb1', metalness: 0.9, roughness: 0.3 }));
  const chrome = named('lounge-chrome', new THREE.MeshStandardMaterial({ color: '#d7dbdd', metalness: 1, roughness: 0.14 }));
  const blackMetal = named('lounge-black-metal', new THREE.MeshStandardMaterial({ color: '#1b1c1f', metalness: 0.6, roughness: 0.4 }));
  const rubber = named('lounge-rubber', new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.92 }));
  // Photo 177: wide dark horizontal ribbons woven through narrow pale binding strands.
  // The old crop contained the whiteboard frame: tiling it stamped silver diamonds into every
  // panel. Reconstruct the repeat itself, keeping the photographed ~25 mm cell pitch.
  const dividerWeave = canvasTex(1024, 1024, (c, w, h) => {
    const r = rng(177), cell = w / 16;
    c.fillStyle = '#38291d'; c.fillRect(0, 0, w, h);
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      const x = i * cell, y = j * cell;
      const light = 28 + Math.floor(r() * 12);
      c.fillStyle = `hsl(29 27% ${light}%)`;
      c.fillRect(x + 2, y + 2, cell - 4, cell - 5);
      c.fillStyle = 'rgba(225,196,147,0.12)';
      for (let f = 0; f < 5; f++) c.fillRect(x + 3, y + 7 + f * 10, cell - 6, 1);
      // Binding passes over the ribbon in alternate rows and disappears behind the next.
      c.fillStyle = (i + j) % 2 ? '#9e8b65' : '#51402b';
      c.fillRect(x - 2, y + 2, 4, cell - 4);
      c.fillStyle = '#b29c74'; c.fillRect(x - 1, y, 2, 4);
      c.fillStyle = 'rgba(15,10,6,0.35)'; c.fillRect(x + 2, y + cell - 4, cell - 4, 2);
    }
  });
  dividerWeave.wrapS = dividerWeave.wrapT = THREE.RepeatWrapping;
  dividerWeave.repeat.set(1, 1.36);
  const wicker = named('lounge-divider-weave', new THREE.MeshStandardMaterial({
    map: dividerWeave,
    roughness: 0.95,
    // woven normal map derived from the plain-weave relief (not a linen normal): over/under
    // strands at the same 20 mm pitch, 512 px tile, seamless
    normalMap: (() => {
      const t = weaveNor.clone();
      t.needsUpdate = true;
      t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
      t.repeat.set(2.0, 2.6);
      return t;
    })(),
    normalScale: new THREE.Vector2(1.0, 1.0),
    side: THREE.DoubleSide,
  }));
  const wickerFrame = named('lounge-divider-frame', new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: 0.72 }));
  const wickerPale = named('lounge-divider-band', new THREE.MeshStandardMaterial({ color: '#cfc6b4', roughness: 0.9 }));
  const rattan = named('lounge-rattan', new THREE.MeshStandardMaterial({
    map: rattanTex(), roughness: 0.92, bumpMap: rattanTex(), bumpScale: 0.006, side: THREE.DoubleSide,
  }));
  const rattanSolid = named('lounge-rattan-solid', new THREE.MeshStandardMaterial({ color: '#b6a179', roughness: 0.9 }));
  const gardenGreen = named('lounge-garden-stool', new THREE.MeshPhysicalMaterial({
    map: gardenStoolTex(), roughness: 0.3, clearcoat: 0.85, clearcoatRoughness: 0.12,
  }));
  const oak = named('lounge-oak', new THREE.MeshPhysicalMaterial({
    map: oakDiff, color: '#c69a68', normalMap: oakNor, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.35,
  }));
  const walnut = named('lounge-walnut', new THREE.MeshPhysicalMaterial({
    map: oakDiff, color: '#7d5433', normalMap: oakNor, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.42, clearcoat: 0.4,
  }));
  const redPillow = named('lounge-red-pillow', new THREE.MeshPhysicalMaterial({
    color: '#b01427', roughness: 0.92, sheen: 0.5, sheenColor: new THREE.Color('#f0637a'),
    normalMap: rep(linenNor, 8), normalScale: new THREE.Vector2(0.4, 0.4),
  }));
  const acrylic = named('lounge-acrylic', new THREE.MeshPhysicalMaterial({
    color: '#eef4f4', roughness: 0.06, metalness: 0, transparent: true, opacity: 0.24,
    clearcoat: 1, clearcoatRoughness: 0.04, side: THREE.DoubleSide, depthWrite: false,
    transmission: 0, ior: 1.49,
  }));
  const mirrorGlass = named('lounge-mirror', new THREE.MeshStandardMaterial({
    color: '#cfd2cf', metalness: 1, roughness: 0.07,
  }));
  const mirrorFrame = named('lounge-mirror-frame', new THREE.MeshStandardMaterial({
    color: '#cbbfa6', metalness: 0.65, roughness: 0.32,
  }));
  const mirrorMosaic = named('lounge-mirror-mosaic', new THREE.MeshStandardMaterial({
    color: '#e3d9c2', metalness: 0.35, roughness: 0.42,
  }));
  const ceilingWhite = named('lounge-plastic-white', new THREE.MeshStandardMaterial({ color: '#e6e4dd', roughness: 0.45 }));
  const marker = (hex: string) => named('marker-' + hex, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.45 }));
  const crystal = named('lounge-button-crystal', new THREE.MeshPhysicalMaterial({
    color: '#ffffff', metalness: 0.2, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 3.4,
  }));
  // dark cup so buttons punch through cream leather at room distance
  const buttonCup = named('lounge-button-cup', new THREE.MeshStandardMaterial({
    color: '#3a342c', metalness: 0.65, roughness: 0.32,
  }));
  const whitePaint = named('lounge-white-paint', new THREE.MeshStandardMaterial({ color: '#efece4', roughness: 0.62 }));

  return {
    cream, creamTuft, leatherDark, piping, setteeLeather, throwMat, blue, blackJacket, card, cardTape,
    gold, copper, copperBand, copperDark, marble, board, boardBack, alu, steel, chrome, blackMetal, rubber,
    wicker, wickerFrame, wickerPale, rattan, rattanSolid, gardenGreen, oak, walnut, redPillow,
    acrylic, mirrorGlass, mirrorFrame, mirrorMosaic, ceilingWhite, crystal, buttonCup, whitePaint,
    markerRed: marker('#a8242a'), markerBlack: marker('#232528'), markerBlue: marker('#2b4c8c'),
    markerGreen: marker('#3c7a44'), markerOrange: marker('#c26a2a'),
    textures: { marbleMap, boardMap, throwMap, weaveMap, weaveNor, leatherNor, linenNor, woolNor, oakNor, tuftAlbedo, tuftNor, tuftBump },
  };
}
