import * as THREE from 'three';

export function roomAssetURL(url: string, base: string, previews: Readonly<Record<string, string>>): string {
  // Never reintroduce the old household photograph during full-resolution refinement.
  if (url.endsWith('/dw-frame-screen.jpg')) return new URL('../frame-demo-poster.jpg', base).href;
  const relative = url.startsWith('/textures/') || url.startsWith('/moe-office/') ? url.slice(1) : null;
  return relative ? new URL(previews[relative] ?? relative, base).href : url;
}

interface RefinementOptions {
  phase?: 'visible' | 'remaining';
  camera?: THREE.PerspectiveCamera;
  viewportHeight?: number;
  progress?: (completed: number, total: number) => void;
}
interface TextureEntry { full: string; textures: Set<THREE.Texture>; score: number }
const VISIBLE_MAPS = new Set(['map', 'emissiveMap', 'alphaMap']);

/** Source appearance first: visible albedo/emission precedes maps the Lambert tier cannot display. */
export async function refineTextures(root: THREE.Object3D, base: string, previews: Readonly<Record<string, string>>, checkpoint: () => Promise<boolean>, changed: () => void,
  materialSource: (material: THREE.Material) => THREE.Material = (material) => material, options: RefinementOptions = {}): Promise<boolean> {
  const originals = new Map(Object.entries(previews).map(([full, preview]) => [new URL(preview, base).href, full]));
  const textures = new Map<THREE.TextureSource<unknown>, TextureEntry>();
  const camera = options.camera, frustum = new THREE.Frustum(), sphere = new THREE.Sphere(), at = new THREE.Vector3();
  root.updateMatrixWorld(true);
  if (camera) { camera.updateMatrixWorld(); frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); }
  const coverage = (mesh: THREE.Mesh) => {
    for (let node: THREE.Object3D | null = mesh; node; node = node.parent) if (!node.visible) return 0;
    if (!camera) return 1;
    if (!frustum.intersectsObject(mesh)) return 0;
    const geometry = mesh.geometry;
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    if (!geometry.boundingSphere) return 0;
    sphere.copy(geometry.boundingSphere).applyMatrix4(mesh.matrixWorld); camera.getWorldPosition(at);
    const radius = sphere.radius / Math.max(0.1, at.distanceTo(sphere.center));
    return (radius * (options.viewportHeight ?? 800) / Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV()) / 2)) ** 2;
  };
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const mesh = node as THREE.Mesh, score = coverage(mesh);
    for (const displayed of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const [name, value] of Object.entries(materialSource(displayed))) {
        if (!(value instanceof THREE.Texture)) continue;
        if (options.phase === 'visible' && (!VISIBLE_MAPS.has(name) || score <= 0)) continue;
        const texture = value as THREE.Texture, image: unknown = texture.source.data;
        if (!(image instanceof HTMLImageElement)) continue;
        const full = originals.get(image.src);
        if (!full || full.endsWith('/dw-frame-screen.jpg')) continue;
        let entry = textures.get(texture.source);
        if (!entry) { entry = { full, textures: new Set(), score: 0 }; textures.set(texture.source, entry); }
        entry.textures.add(texture);
        // Visible color-bearing maps rank above invisible normals/roughness, even in the remainder.
        entry.score += VISIBLE_MAPS.has(name) ? score : 0;
      }
    }
  });
  const queue = [...textures].sort((a, b) => b[1].score - a[1].score);
  options.progress?.(0, queue.length);
  const loader = new THREE.ImageLoader(new THREE.LoadingManager()); // bypass initial-preview URL modifier
  const loaded = new Map<string, HTMLImageElement>();
  let successful = true, completed = 0;
  for (const [source, entry] of queue) {
    if (!await checkpoint()) return false;
    try {
      let image = loaded.get(entry.full);
      if (!image) { image = await loader.loadAsync(new URL(entry.full, base).href); loaded.set(entry.full, image); }
      if (!await checkpoint()) return false;
      source.data = image;
      for (const texture of entry.textures) texture.needsUpdate = true;
      changed(); completed++;
      performance.mark('office:texture-refined', { detail: { file: entry.full, phase: options.phase ?? 'remaining', visible: entry.score > 0 } });
    } catch { successful = false; } // retain the real preview, never replace it with a missing texture
    options.progress?.(completed, queue.length);
  }
  return successful;
}
