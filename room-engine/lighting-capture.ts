import * as THREE from 'three';
import { buildMoeOffice } from '@moe-office/room';
import { applyRoomRendering, precompileRoomRendering } from '@moe-office/runtime/render';
import { configureRenderer, officeEnvironmentTarget } from '@moe-office/runtime/lighting';
import { prepareSculptCache, isProgressiveSculpt } from './sculpt-cache';
import { roomAssetURL } from './progressive-textures';
import { createRoomCutaway } from './cutaway';

declare const __OFFICE_SCULPT_MANIFEST__: unknown;
declare const __OFFICE_SCULPT_SOURCE_HASH__: string;
const base = new URL('./', import.meta.url).href;

/** Offline-only entry: never imported by the site or included in its startup bundle. */
export async function captureLighting(): Promise<{ width: number; height: number; intensity: number; rgba: string; revision: string }> {
  THREE.Cache.enabled = true;
  THREE.DefaultLoadingManager.setURLModifier((url) => roomAssetURL(url, base, {}));
  if (!await prepareSculptCache(__OFFICE_SCULPT_MANIFEST__, __OFFICE_SCULPT_SOURCE_HASH__, base)) throw new Error('Exact geometry is required for lighting export');
  const canvas = document.createElement('canvas'); document.body.append(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas }); renderer.setSize(16, 16);
  try {
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#0d0b09');
    configureRenderer(renderer, scene);
    const room = await buildMoeOffice();
    room.group.traverse((node) => { if (node instanceof THREE.Mesh && isProgressiveSculpt(node.geometry)) node.userData['noMerge'] = true; });
    createRoomCutaway(room);
    room.optimize?.({ static: true }); scene.add(room.group, room.lights);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 100); camera.position.set(...room.camera.orbit); camera.lookAt(new THREE.Vector3(...room.camera.target));
    await precompileRoomRendering(renderer, scene, room, camera);
    applyRoomRendering(renderer, scene, room);
    const target = officeEnvironmentTarget(scene);
    if (target?.texture.type !== THREE.HalfFloatType) throw new Error('Expected original half-float PMREM target');
    const pixels = new Uint16Array(target.width * target.height * 4);
    await renderer.readRenderTargetPixelsAsync(target, 0, 0, target.width, target.height, pixels);
    const bytes = new Uint8Array(pixels.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return { width: target.width, height: target.height, intensity: scene.environmentIntensity, rgba: btoa(binary), revision: THREE.REVISION };
  } finally { renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); }
}
