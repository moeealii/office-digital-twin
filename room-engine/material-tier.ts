import * as THREE from 'three';
const reflectedPrograms = new WeakSet<object>();

/** Source colors/maps/geometry immediately; original physical response is retained for hydration. */
export function createMaterialTier() {
  const previews = new Map<THREE.Material, THREE.Material>();
  const sources = new Map<THREE.Material, THREE.Material>();
  const nodes = new Map<THREE.Mesh, { material: THREE.Material | THREE.Material[]; receiveShadow: boolean }>();
  const lights = new Map<THREE.Light, boolean>();
  let complete = false;
  const preview = (original: THREE.Material): THREE.Material => {
    const cached = previews.get(original); if (cached) return cached;
    if (!(original instanceof THREE.MeshStandardMaterial)) return original;
    const transmission = original instanceof THREE.MeshPhysicalMaterial ? original.transmission : 0;
    const material = new THREE.MeshLambertMaterial({
      name: `${original.name}-preview`, color: original.color, map: original.map,
      emissive: original.emissive, emissiveMap: original.emissiveMap, emissiveIntensity: original.emissiveIntensity,
      alphaMap: original.alphaMap, alphaTest: original.alphaTest, vertexColors: original.vertexColors,
      opacity: original.opacity * (1 - 0.8 * transmission), transparent: original.transparent || transmission > 0,
      side: original.side, depthWrite: transmission > 0 ? false : original.depthWrite, depthTest: original.depthTest,
      flatShading: original.flatShading, fog: original.fog,
    });
    material.forceSinglePass = true;
    previews.set(original, material); sources.set(material, original);
    return material;
  };
  const source = (material: THREE.Material): THREE.Material => sources.get(material) ?? material;
  return {
    source,
    get ready(): boolean { return complete; },
    preview(root: THREE.Object3D): void {
      if (complete) return;
      root.traverse((node) => {
        if (node instanceof THREE.Light && !lights.has(node)) {
          const prior: unknown = node.userData['officePreviewCastShadow'];
          const cast = typeof prior === 'boolean' ? prior : node.castShadow;
          lights.set(node, cast); node.userData['officePreviewCastShadow'] = cast; node.castShadow = false;
        }
        if (!(node instanceof THREE.Mesh)) return;
        const mesh = node as THREE.Mesh;
        if (nodes.has(mesh)) return;
        // An editor duplicate can share a preview material; retain its canonical
        // original so later quality hydration never strands the clone in preview.
        const original = Array.isArray(mesh.material) ? mesh.material.map(source) : source(mesh.material);
        const prior: unknown = mesh.userData['officePreviewShadow'];
        const receiveShadow = typeof prior === 'boolean' ? prior : mesh.receiveShadow;
        nodes.set(mesh, { material: original, receiveShadow });
        mesh.userData['officePreviewShadow'] = receiveShadow;
        mesh.material = Array.isArray(original) ? original.map(preview) : preview(original);
        mesh.receiveShadow = false;
      });
    },
    /** Reconstitute original material/shadow defines on a shared-resource compilation clone. */
    originals(root: THREE.Object3D): void {
      root.traverse((node) => {
        const cast: unknown = node.userData['officePreviewCastShadow'];
        if (node instanceof THREE.Light && typeof cast === 'boolean') node.castShadow = cast;
        delete node.userData['officePreviewCastShadow'];
        if (!(node instanceof THREE.Mesh)) return;
        const mesh = node as THREE.Mesh;
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(source) : source(mesh.material);
        const shadow: unknown = mesh.userData['officePreviewShadow'];
        if (typeof shadow === 'boolean') mesh.receiveShadow = shadow;
        delete mesh.userData['officePreviewShadow'];
      });
    },
    restore(): void {
      complete = true;
      for (const [light, cast] of lights) { light.castShadow = cast; delete light.userData['officePreviewCastShadow']; }
      for (const [mesh, original] of nodes) {
        mesh.material = original.material; mesh.receiveShadow = original.receiveShadow;
        delete mesh.userData['officePreviewShadow'];
      }
    },
  };
}

/** Never leave the interactive renderer pointed at a compile target while awaiting driver work. */
export async function compileMaterialTier(renderer: Pick<THREE.WebGLRenderer, 'getRenderTarget' | 'setRenderTarget' | 'compileAsync'>, scene: THREE.Object3D, camera: THREE.Camera, linear: boolean, targetScene?: THREE.Scene): Promise<void> {
  const previous = renderer.getRenderTarget();
  const target = linear ? new THREE.WebGLCubeRenderTarget(16, { type: THREE.HalfFloatType }) : null;
  try {
    const started = performance.now();
    const compilation = (() => {
      try { if (target) renderer.setRenderTarget(target); return renderer.compileAsync(scene, camera, targetScene); }
      finally { renderer.setRenderTarget(previous); performance.mark('office:shader-link', { detail: { linear, ms: performance.now() - started } }); }
    })();
    await compilation;
  } finally { target?.dispose(); }
}

/** Transmission renders opaque objects into a LINEAR target even when the main view is sRGB. */
export async function compileOriginalMaterials(renderer: Pick<THREE.WebGLRenderer, 'getRenderTarget' | 'setRenderTarget' | 'compileAsync'>, scene: THREE.Scene, camera: THREE.Camera, high: boolean, checkpoint: () => Promise<boolean>): Promise<boolean> {
  const backfaces = new Map<THREE.Material, THREE.Side>();
  const meshes = new Map<string, THREE.Mesh>();
  scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const mesh = node as THREE.Mesh;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const attributes = Object.entries(mesh.geometry.attributes).map(([name, attribute]) => `${name}:${attribute.itemSize}`).sort().join(',');
    const key = `${materials.map((material) => material.uuid).join(',')}|${attributes}|${mesh instanceof THREE.InstancedMesh}|${mesh instanceof THREE.SkinnedMesh}|${mesh.receiveShadow}`;
    if (!meshes.has(key)) meshes.set(key, mesh.clone(false));
    for (const material of materials) {
      if (material.side === THREE.DoubleSide && ((material.transparent && !material.forceSinglePass)
        || (material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0))) backfaces.set(material, material.side);
    }
  });
  let budgetStarted = -Infinity;
  const yieldToInput = async () => {
    if (performance.now() - budgetStarted < 4) return true;
    const active = await checkpoint(); budgetStarted = performance.now(); return active;
  };
  for (const linear of high ? [true] : [true, false]) for (const mesh of meshes.values()) {
    if (!await yieldToInput()) return false;
    await compileMaterialTier(renderer, mesh, camera, linear, scene);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const sided = materials.filter((material) => backfaces.has(material));
    if (sided.length) for (const side of [THREE.FrontSide, THREE.BackSide]) {
      if (!await yieldToInput()) return false;
      sided.forEach((material) => { material.side = side; });
      // Capture ONE material/geometry variant, restore shared state before yielding, then wait.
      const compilation = compileMaterialTier(renderer, mesh, camera, linear, scene);
      sided.forEach((material) => { material.side = backfaces.get(material) ?? THREE.DoubleSide; });
      await compilation;
    }
  }
  return true;
}

/** Upload retained maps before activation, yielding between GPU allocations instead of one giant draw. */
export async function warmOriginalTextures(renderer: Pick<THREE.WebGLRenderer, 'initTexture'>, scene: THREE.Scene, checkpoint: () => Promise<boolean>): Promise<boolean> {
  const textures = new Set<THREE.Texture>();
  if (scene.environment) textures.add(scene.environment);
  scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const mesh = node as THREE.Mesh;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value as THREE.Texture);
    }
  });
  let started = -Infinity;
  for (const texture of textures) {
    if (performance.now() - started >= 4) {
      if (!await checkpoint()) return false;
      started = performance.now();
    }
    const began = performance.now(); renderer.initTexture(texture);
    performance.mark('office:texture-upload', { detail: { ms: performance.now() - began } });
  }
  return true;
}

/** Execute post-pass setup without drawing: compile against each pass's ACTUAL target/defines. */
export async function compilePostprocessing(renderer: Pick<THREE.WebGLRenderer, 'render' | 'compileAsync' | 'getRenderTarget' | 'setRenderTarget'> & Parameters<typeof warmProgramReflection>[0],
  pipeline: { ao: boolean; render(): void; setSceneRenderer(draw?: (renderer: THREE.WebGLRenderer, camera: THREE.Camera) => void): void },
  scene: THREE.Scene, checkpoint: () => Promise<boolean>): Promise<boolean> {
  if (!await checkpoint()) return false;
  const original = renderer.render.bind(renderer), target = renderer.getRenderTarget(), enabled = pipeline.ao;
  const compilations: Promise<THREE.Object3D>[] = [];
  try {
    renderer.render = (object, camera) => { compilations.push(renderer.compileAsync(object, camera)); };
    pipeline.setSceneRenderer((draw, camera) => { draw.render(scene, camera); });
    pipeline.ao = true;
    pipeline.render();
  } finally {
    renderer.render = original; renderer.setRenderTarget(target);
    pipeline.setSceneRenderer(); pipeline.ao = enabled;
  }
  await Promise.all(compilations);
  return warmProgramReflection(renderer, checkpoint);
}

/** compileAsync links programs, but Three defers expensive diagnostic/reflection queries until draw. */
export async function warmProgramReflection(renderer: { info: { programs: readonly { id: number; getUniforms(): unknown; getAttributes(): unknown }[] | null } }, checkpoint: () => Promise<boolean>): Promise<boolean> {
  for (const program of renderer.info.programs ?? []) {
    if (reflectedPrograms.has(program)) continue;
    if (!await checkpoint()) return false;
    const started = performance.now();
    program.getUniforms(); program.getAttributes();
    reflectedPrograms.add(program); // diagnostics stay ON; one program per yielded turn
    performance.mark('office:shader-reflection', { detail: { id: program.id, ms: performance.now() - started } });
  }
  return true;
}
