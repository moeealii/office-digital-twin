import * as THREE from 'three';
import { photoTex, sharedTex, walnutTex } from './_prayer-tex';

/** Materials shared by the prayer-station modules (created inside build(), after texture preload). */
export async function prayerMaterials() {
  const [oakNor, crest, drawer, rug, lace, register, inlay, woolNor, linenNor, leatherNor, leatherRough] = await Promise.all([
    sharedTex('oak_nor.jpg', 2.4),
    photoTex('prayer-crest.jpg'),
    photoTex('prayer-drawer.jpg'),
    photoTex('prayer-rug.jpg'),
    photoTex('prayer-lace.jpg'),
    photoTex('prayer-register.png'),
    photoTex('prayer-inlay.jpg'),
    sharedTex('wool_nor.jpg', 6),
    sharedTex('linen_nor.jpg', 8),
    sharedTex('leather_nor.jpg', 5),
    sharedTex('leather_rough.jpg', 5),
  ]);
  const named = <M extends THREE.Material>(name: string, m: M) => ((m.name = name), m);
  const walnutV = walnutTex(11, '#4c3120', '#281709', '#684528');
  walnutV.repeat.set(2.2, 1.6);
  const walnutH = walnutTex(17, '#5a3a24', '#321d10', '#7c5433', false);
  walnutH.repeat.set(1.8, 2.4);

  const wood = named('prayer-walnut', new THREE.MeshPhysicalMaterial({
    map: walnutV, normalMap: oakNor, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.48,
    clearcoat: 0.25, clearcoatRoughness: 0.45,
  }));
  const woodEdge = named('prayer-walnut-edge', new THREE.MeshPhysicalMaterial({
    map: walnutV, color: '#b8a493', normalMap: oakNor, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.52,
  }));
  const chestWood = named('prayer-chest-wood', new THREE.MeshPhysicalMaterial({
    map: walnutH, normalMap: oakNor, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.45,
    clearcoat: 0.3, clearcoatRoughness: 0.4,
  }));
  const darkWood = named('prayer-dark-wood', new THREE.MeshStandardMaterial({ color: '#33200f', roughness: 0.5 }));
  const gold = named('prayer-gilt', new THREE.MeshStandardMaterial({ color: '#c9a250', metalness: 0.85, roughness: 0.32 }));
  const brass = named('prayer-brass', new THREE.MeshStandardMaterial({ color: '#b48d48', metalness: 0.9, roughness: 0.28 }));
  const oldBrass = named('prayer-old-brass', new THREE.MeshStandardMaterial({ color: '#6e5631', metalness: 0.85, roughness: 0.42 }));
  const ivory = named('prayer-bone', new THREE.MeshStandardMaterial({ color: '#e9e1cf', roughness: 0.45 }));
  const glass = named('prayer-glass', new THREE.MeshPhysicalMaterial({
    color: '#8a8f86', roughness: 0.1, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide,
  }));

  // sample 3 % inside the photographed silhouette so the crest's rim never picks up the wall behind it
  crest.repeat.set(0.965 / 0.64, 0.975 / 0.6);
  crest.offset.set(0.5, 0.5 - 1.5 * 0.975 / 0.6);
  const crestFace = named('prayer-crest', new THREE.MeshPhysicalMaterial({
    map: crest, bumpMap: crest, bumpScale: 0.6, roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.5,
  }));
  const drawerFace = named('prayer-drawer', new THREE.MeshPhysicalMaterial({
    map: drawer, roughness: 0.45, clearcoat: 0.25, clearcoatRoughness: 0.45,
  }));

  return {
    textures: { rug, lace, register, inlay, woolNor, linenNor, leatherNor, leatherRough, oakNor },
    wood, woodEdge, chestWood, darkWood, gold, brass, oldBrass, ivory, glass, crestFace, drawerFace,
  };
}

export type PrayerMats = Awaited<ReturnType<typeof prayerMaterials>>;
