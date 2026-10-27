import * as THREE from 'three';
import { textured } from '../../../packages/room-runtime/materials';
import { canvasTex } from './_desk-west-kit';

/**
 * Materials for the west desk group. Created inside build() (never at module scope) so the
 * runtime's texture preload has finished. Photo-derived crops are loaded by the caller.
 */
export interface DwMats {
  /** the white laminate desktop + drawer fronts: warm off-white with a satin sheen */
  laminate: THREE.MeshPhysicalMaterial;
  /** the slightly greyer laminate of the cabinet carcasses / printer table */
  laminateGrey: THREE.MeshStandardMaterial;
  /** white plastic (printer shells, drawer runners, stand columns) */
  plastic: THREE.MeshStandardMaterial;
  /** dark grey plastic (monitor shells, arm knuckles, laptop feet) */
  darkPlastic: THREE.MeshStandardMaterial;
  black: THREE.MeshStandardMaterial;
  blackGloss: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  /** grey powder coat: desk frame feet, monitor base plate */
  greyMetal: THREE.MeshStandardMaterial;
  /** the desk's under-structure and cable tray */
  blackMetal: THREE.MeshStandardMaterial;
  screenOff: THREE.MeshPhysicalMaterial;
  screenGlass: THREE.MeshPhysicalMaterial;
  rubber: THREE.MeshStandardMaterial;
  /** black mesh fabric with alpha (chair back, dust filters) */
  mesh: THREE.MeshStandardMaterial;
  /** black task-chair seat fabric */
  seatFabric: THREE.MeshStandardMaterial;
  /** matte black desk mat with a rubber underside */
  deskMat: THREE.MeshStandardMaterial;
  /** translucent smoked acrylic (resin printer lid) */
  smoked: THREE.MeshPhysicalMaterial;
  /** white frosted plastic (resin vat, bottle, bin) */
  frostedWhite: THREE.MeshPhysicalMaterial;
  ceramic: THREE.MeshPhysicalMaterial;
  bag: THREE.MeshPhysicalMaterial;
  red: THREE.MeshPhysicalMaterial;
  orange: THREE.MeshStandardMaterial;
  paper: THREE.MeshStandardMaterial;
  canSilver: THREE.MeshStandardMaterial;
  canRed: THREE.MeshPhysicalMaterial;
  led: THREE.MeshStandardMaterial;
  /** screen contents */
  tabletScreen: THREE.MeshStandardMaterial;
  meshNormal: THREE.Texture;
  weaveNormal: THREE.Texture;
  /** light grey powder coat of the desk frame (photo 197: legs read pale grey, not white) */
  frameGrey: THREE.MeshStandardMaterial;
  /** brushed silver aluminium (G9 back + stand plate, MacBook, keyboard plate) */
  alu: THREE.MeshStandardMaterial;
  /** dark grey anodised aluminium (G915 top plate, USB hub) */
  darkAlu: THREE.MeshStandardMaterial;
  /** glossy black glass (screens off) */
  glassBlack: THREE.MeshPhysicalMaterial;
  /** cloth mat (QcK) */
  cloth: THREE.MeshStandardMaterial;
}

export function dwMaterials(): DwMats {
  // the white laminate: the CC0 *laminate* diffuse is a warm wood print, so use only its
  // normal/roughness maps under a white satin clearcoat (photos 86/167: a plain white desktop)
  const lamBase = textured({ color: '#ffffff', set: 'laminate', repeat: 0.62, diffuse: false, roughness: 0.5, normalScale: 0.18 });
  const laminate = new THREE.MeshPhysicalMaterial({
    color: '#fafbfc', normalMap: lamBase.normalMap, normalScale: lamBase.normalScale,
    roughnessMap: lamBase.roughnessMap, roughness: 0.44, clearcoat: 0.26, clearcoatRoughness: 0.34,
  });
  laminate.name = 'dw-laminate';
  const lamGreyBase = textured({ color: '#ffffff', set: 'laminate', repeat: 0.8, diffuse: false, roughness: 0.62, normalScale: 0.18 });
  const laminateGrey = new THREE.MeshStandardMaterial({
    color: '#d9d7d1', normalMap: lamGreyBase.normalMap, normalScale: lamGreyBase.normalScale,
    roughnessMap: lamGreyBase.roughnessMap, roughness: 0.58,
  });
  laminateGrey.name = 'dw-laminate-grey';

  const weaveNormal = textured({ color: '#ffffff', set: 'linen', repeat: 6 }).normalMap as THREE.Texture;

  const meshAlpha = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#0a0a0b';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#4a4b4e';
    c.lineWidth = 1.6;
    for (let i = -h; i < w; i += 7) {
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke();
      c.beginPath(); c.moveTo(i + h, 0); c.lineTo(i, h); c.stroke();
    }
  }, 3);
  const meshMat = new THREE.MeshStandardMaterial({
    color: '#17181b', map: meshAlpha, roughness: 0.82, metalness: 0.12,
    transparent: true, alphaTest: 0.25, side: THREE.DoubleSide, depthWrite: true,
  });
  meshMat.name = 'dw-mesh';

  const meshNormal = canvasTex(64, 64, (c, w, h) => {
    c.fillStyle = '#8080ff';
    c.fillRect(0, 0, w, h);
  }, 8);
  meshNormal.colorSpace = THREE.NoColorSpace;

  const fabric = canvasTex(256, 256, (c, w, h) => {
    const r = (x: number) => ((Math.sin(x * 12.9898) * 43758.5453) % 1 + 1) % 1;
    c.fillStyle = '#3d4347';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const x = r(i) * w, y = r(i * 3.3) * h;
      c.fillStyle = r(i * 7.7) > 0.5 ? '#4a5055' : '#30363a';
      c.fillRect(x, y, 2, 1.4);
    }
  }, 5);
  const seatFabric = new THREE.MeshStandardMaterial({ color: '#1b1c1f', map: fabric, roughness: 0.94, normalMap: weaveNormal, normalScale: new THREE.Vector2(0.4, 0.4) });
  seatFabric.name = 'dw-seat-fabric';

  const tabletex = canvasTex(512, 256, (c, w, h) => {
    // paused video: cool blue crowd scene, the way it reads in photos 89/200
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1a2733'); g.addColorStop(0.55, '#2f4a63'); g.addColorStop(1, '#101a24');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(90,120,150,0.55)';
    for (let i = 0; i < 70; i++) c.fillRect((i * 71) % w, 20 + ((i * 37) % (h - 60)), 10 + (i % 5) * 7, 14 + (i % 4) * 9);
    c.fillStyle = 'rgba(240,240,230,0.75)';
    c.fillRect(w * 0.18, h * 0.42, 22, 30);
    c.fillStyle = 'rgba(30,60,110,0.9)';
    c.fillRect(w * 0.42, h * 0.36, 26, 44);
    c.fillStyle = 'rgba(255,210,120,0.55)';
    c.fillRect(w * 0.66, h * 0.3, 18, 22);
    c.fillStyle = 'rgba(8,10,14,0.9)';
    c.fillRect(0, h - 8, w, 8);
  });

  return {
    laminate,
    laminateGrey,
    plastic: new THREE.MeshStandardMaterial({ color: '#e3e2dd', roughness: 0.42, metalness: 0.02 }),
    darkPlastic: new THREE.MeshStandardMaterial({ color: '#26272a', roughness: 0.5, metalness: 0.08 }),
    black: new THREE.MeshStandardMaterial({ color: '#101012', roughness: 0.62 }),
    blackGloss: new THREE.MeshPhysicalMaterial({ color: '#0b0b0d', roughness: 0.22, clearcoat: 0.5, clearcoatRoughness: 0.22 }),
    steel: new THREE.MeshStandardMaterial({ color: '#b6b8ba', roughness: 0.32, metalness: 0.92 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#e6e7e8', roughness: 0.13, metalness: 1 }),
    greyMetal: new THREE.MeshStandardMaterial({ color: '#b9babb', roughness: 0.46, metalness: 0.55 }),
    blackMetal: new THREE.MeshStandardMaterial({ color: '#1a1b1d', roughness: 0.38, metalness: 0.6 }),
    screenOff: new THREE.MeshPhysicalMaterial({ color: '#08090b', roughness: 0.1, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 }),
    screenGlass: new THREE.MeshPhysicalMaterial({ color: '#05060a', roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#121213', roughness: 0.94 }),
    mesh: meshMat,
    seatFabric,
    deskMat: new THREE.MeshStandardMaterial({ color: '#141517', roughness: 0.88, map: fabric, normalMap: weaveNormal, normalScale: new THREE.Vector2(0.3, 0.3) }),
    smoked: new THREE.MeshPhysicalMaterial({ color: '#2b2f33', roughness: 0.18, metalness: 0.2, transparent: true, opacity: 0.62, clearcoat: 0.8, side: THREE.DoubleSide }),
    frostedWhite: new THREE.MeshPhysicalMaterial({ color: '#e6e4de', roughness: 0.55, transmission: 0, transparent: true, opacity: 0.92 }),
    ceramic: new THREE.MeshPhysicalMaterial({ color: '#f2efe9', roughness: 0.24, clearcoat: 0.7 }),
    bag: new THREE.MeshPhysicalMaterial({ color: '#cdd3d6', roughness: 0.35, transparent: true, opacity: 0.72, side: THREE.DoubleSide }),
    red: new THREE.MeshPhysicalMaterial({ color: '#8c1f18', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, transparent: true, opacity: 0.88 }),
    orange: new THREE.MeshStandardMaterial({ color: '#c8501c', roughness: 0.55 }),
    paper: new THREE.MeshStandardMaterial({ color: '#f3f0e6', roughness: 0.9 }),
    canSilver: new THREE.MeshStandardMaterial({ color: '#cfd1d2', roughness: 0.24, metalness: 1 }),
    canRed: new THREE.MeshPhysicalMaterial({ color: '#b0201c', roughness: 0.28, metalness: 0.35, clearcoat: 0.6 }),
    led: new THREE.MeshStandardMaterial({ color: '#3a4f63', emissive: '#79b4e0', emissiveIntensity: 2.6, roughness: 0.4 }),
    tabletScreen: new THREE.MeshStandardMaterial({ map: tabletex, roughness: 0.28, emissive: '#ffffff', emissiveMap: tabletex, emissiveIntensity: 0.35 }),
    meshNormal: meshNormal,
    weaveNormal,
    frameGrey: new THREE.MeshStandardMaterial({ color: '#b4b5b3', roughness: 0.48, metalness: 0.35 }),
    alu: new THREE.MeshStandardMaterial({ color: '#c9cacb', roughness: 0.32, metalness: 0.85 }),
    darkAlu: new THREE.MeshStandardMaterial({ color: '#4a4d52', roughness: 0.38, metalness: 0.8 }),
    glassBlack: new THREE.MeshPhysicalMaterial({ color: '#050608', roughness: 0.08, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.06 }),
    cloth: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, map: fabric, normalMap: weaveNormal, normalScale: new THREE.Vector2(0.35, 0.35) }),
  };
}
