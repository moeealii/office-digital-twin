/**
 * The office-showcase room engine. Bundled (with three.js and the room
 * sources from the 3d-model-anything repo) into `public/room/engine.js` by
 * `build-room.mjs`; the React app loads it at runtime through the
 * `RoomEngineModule` contract in `src/room/engine-api.ts`.
 *
 * Rendering mirrors the room viewer in that repo (same pipeline, cutaway and
 * camera-depth logic) so the showcase looks like the approved renders, plus:
 * camera flights for the intro/tour, projected hotspot anchors, a glowing
 * uplink beam on the "rack", and a low-quality path for phones.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildMoeOffice, type BuiltRoom } from '@moe-office/room';
import { configureRoomRendering, createPipeline } from '@moe-office/runtime/render';
import { updateCameraDepth } from '@moe-office/runtime/camera-depth';
import { setMaxAnisotropy } from '@moe-office/runtime/materials';
import { isProgressiveSculpt, prepareSculptCache } from './sculpt-cache';
import { refineSculpts } from './refine-sculpts';
import { roomAssetURL, refineTextures } from './progressive-textures';
import { loadBakedEnvironment } from './baked-environment';
import { compileOriginalMaterials, compilePostprocessing, createMaterialTier, warmOriginalTextures, warmProgramReflection } from './material-tier';
import { warmRoomAssets } from './warm-assets';
import type { TidyController, TidyOptions } from './tidy';
import type { RoomQuality, TidyState } from '../src/room/engine-api';
import { EMPTY_TIDY } from '../src/room/tidy-state';
import { createRoomCutaway } from './cutaway';
import { createPictureFrameScreen, preservePictureFrameScreen } from './picture-frame-screen';
import type { FrameScreenProjection } from '../src/room/frame-screen-projection';
import type { RoomSceneEditor } from '../src/room/scene-editor-api';
import type { SceneViewportOptions } from './scene-editor-viewport';
import { sceneEditorThree } from './scene-editor-three';
import { createSceneSaveStore } from '../src/room/scene-save-store';
declare const __OFFICE_SCULPT_MANIFEST__: unknown;
declare const __OFFICE_SCULPT_SOURCE_HASH__: string;
declare const __OFFICE_ROOM_ASSETS__: readonly string[];
declare const __OFFICE_SCULPT_PREVIEW__: unknown;
declare const __OFFICE_ENVIRONMENT_BINDING__: string;
declare const __OFFICE_IMAGE_PREVIEWS__: { images: Readonly<Record<string, string>> };
import type {
  AnchorSpec,
  CameraPose,
  MountOptions,
  MountRoom,
  RoomEngine,
  ScreenPoint,
  Vec3,
} from '../src/room/engine-api';

/** Directory engine.js was served from; room assets live beside it. */
const ASSET_BASE = new URL(/* @vite-ignore */ './', import.meta.url).href;
let fullTextureTier = false;
THREE.DefaultLoadingManager.setURLModifier((url) => roomAssetURL(url, ASSET_BASE, fullTextureTier ? {} : __OFFICE_IMAGE_PREVIEWS__.images));

const BACKGROUND = '#0d0b09';
const BEAM_COLOR = new THREE.Color('#ffb35c');

function isTidyModule(value: unknown): value is { createTidyController: (options: TidyOptions) => TidyController } {
  return typeof value === 'object' && value !== null && 'createTidyController' in value && typeof value.createTidyController === 'function';
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const v3 = (v: Vec3) => new THREE.Vector3(v[0], v[1], v[2]);

function resolveAnchors(group: THREE.Object3D, specs: readonly AnchorSpec[], hidden: (node: THREE.Object3D) => boolean = () => false, canonical?: ReadonlyMap<string, THREE.Object3D>): Record<string, Vec3> {
  group.updateMatrixWorld(true);
  const out: Record<string, Vec3> = {};
  const box = new THREE.Box3();
  for (const spec of specs) {
    let found: THREE.Object3D | undefined = canonical?.get(spec.id);
    if (!canonical) for (const name of spec.names) {
      found = group.getObjectByName(name);
      if (found) break;
    }
    if (found && canonical) {
      let belongs = false;
      for (let node: THREE.Object3D | null = found; node; node = node.parent) if (node === group) { belongs = true; break; }
      if (!belongs) continue;
    }
    if (found) {
      let excluded = false;
      for (let node: THREE.Object3D | null = found; node; node = node.parent) if (hidden(node)) { excluded = true; break; }
      if (excluded) continue;
      box.setFromObject(found);
      if (!box.isEmpty()) {
        const c = box.getCenter(new THREE.Vector3());
        out[spec.id] = [c.x, box.max.y + spec.lift, c.z];
        continue;
      }
    }
    if (spec.fallback) out[spec.id] = [spec.fallback[0], spec.fallback[1] + spec.lift, spec.fallback[2]];
  }
  return out;
}

/** A thin column of light from the router up through the ceiling: the uplink
 * to the NAS, which lives elsewhere in the house. Unlit + not tone-mapped so
 * the HDR bloom picks it up. */
function buildBeam(base: Vec3, ceiling: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'twin-uplink-beam';
  const height = Math.max(0.2, ceiling - base[1]);
  const hot = BEAM_COLOR.clone().multiplyScalar(6);
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, height, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: hot, toneMapped: false }),
  );
  core.position.set(base[0], base[1] + height / 2, base[2]);
  const glow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, height, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: BEAM_COLOR,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  glow.position.copy(core.position);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.05, 0.075, 48).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: hot, side: THREE.DoubleSide, toneMapped: false }),
  );
  ring.position.set(base[0], ceiling - 0.004, base[2]);
  g.add(core, glow, ring);
  for (const m of [core, glow, ring]) {
    m.castShadow = false;
    m.receiveShadow = false;
    m.raycast = () => undefined; // decoration: never intercept clicks
  }
  return g;
}

function countGeometry(root: THREE.Object3D) {
  let meshes = 0;
  let triangles = 0;
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    meshes++;
    const geo = o.geometry as THREE.BufferGeometry;
    const count = geo.index ? geo.index.count : geo.getAttribute('position').count;
    triangles += (count / 3) * (o instanceof THREE.InstancedMesh ? o.count : 1);
  });
  return { meshes, triangles: Math.round(triangles) };
}

export const mountRoom: MountRoom = async (canvas: HTMLCanvasElement, options: MountOptions): Promise<RoomEngine> => {
  const started = performance.now();
  performance.mark('office:engine:start');
  THREE.Cache.enabled = true; // one decoded image per URL, even when multiple original materials request it
  const high = options.quality === 'high';
  const report = options.onProgress;
  report(0.02, 'Fetching room assets');
  performance.mark('office:sculpt-cache:start');
  const cacheReady = prepareSculptCache(__OFFICE_SCULPT_PREVIEW__, __OFFICE_SCULPT_SOURCE_HASH__, ASSET_BASE).then((cached) => {
    performance.mark('office:sculpt-cache:end', { detail: { cached, sourceHash: __OFFICE_SCULPT_SOURCE_HASH__ } });
  });
  performance.mark('office:assets:start');
  const warmManager = new THREE.LoadingManager();
  warmManager.onProgress = (_url, loaded, total) => { if (total) report(0.04 + 0.4 * loaded / total, 'Fetching room textures'); };
  const previews = __OFFICE_ROOM_ASSETS__.map((url) => __OFFICE_IMAGE_PREVIEWS__.images[url] ?? url);
  const imagesReady = warmRoomAssets(previews, ASSET_BASE, (url) => new THREE.ImageLoader(warmManager).loadAsync(url), 6).then(() => {
    performance.mark('office:assets:end', { detail: { images: __OFFICE_ROOM_ASSETS__.length } });
  });

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: high, powerPreference: 'high-performance' });
  const maxRatio = Math.min(window.devicePixelRatio, 2);
  const entryRatio = Math.min(maxRatio, 1);
  renderer.setPixelRatio(entryRatio);
  const host = canvas.parentElement ?? canvas;
  const size = () => ({ w: Math.max(1, host.clientWidth), h: Math.max(1, host.clientHeight) });
  renderer.setSize(size().w, size().h, false);
  setMaxAnisotropy(high ? renderer.capabilities.getMaxAnisotropy() : 2);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND);
  renderer.shadowMap.enabled = high; // preview light casters are disabled; full defines warm offscreen
  const previewFill = new THREE.HemisphereLight('#ffe9d5', '#514334', 0.4);
  previewFill.name = 'office-preview-fill'; scene.add(previewFill);
  const materialTier = createMaterialTier();

  const camera = new THREE.PerspectiveCamera(50, size().w / size().h, 0.05, 100);
  const pipeline = createPipeline(renderer, scene, camera);
  pipeline.ao = false; // genuine room first; postprocessing and the baked environment refine later
  performance.mark('office:renderer:ready');
  await Promise.all([cacheReady, imagesReady]);

  // Texture loads are the only fine-grained progress signal the room exposes;
  // everything else advances by stage.
  let stageFloor = 0.55;
  THREE.DefaultLoadingManager.onProgress = (_url, loaded, total) => {
    if (total > 0) report(Math.min(0.55, stageFloor + (loaded / total) * 0.45), 'Fetching textures');
  };
  report(0.55, 'Assembling the furniture');
  const creep = window.setInterval(() => {
    stageFloor = Math.min(0.78, stageFloor + 0.01);
    if (stageFloor > 0.5) report(stageFloor, 'Assembling the furniture');
  }, 250);
  let room: BuiltRoom;
  try {
    performance.mark('office:assembly:start');
    room = await buildMoeOffice();
    performance.mark('office:assembly:end');
  } finally {
    window.clearInterval(creep);
    THREE.DefaultLoadingManager.onProgress = () => undefined;
  }

  report(0.8, 'Placing the hotspots');
  const anchors = resolveAnchors(room.group, options.anchors);
  const geometry = countGeometry(room.group);
  let objects = 0;
  const sculptureUses = new Map<THREE.BufferGeometry, number>();
  room.group.traverse((o) => {
    if (o.name && !(o instanceof THREE.Mesh)) objects++;
    if (o instanceof THREE.Mesh && isProgressiveSculpt(o.geometry)) {
      o.userData['noMerge'] = true;
      const shape = o.geometry as THREE.BufferGeometry;
      sculptureUses.set(shape, (sculptureUses.get(shape) ?? 0) + (o instanceof THREE.InstancedMesh ? o.count : 1));
    }
  });
  const sculptureTriangles = () => [...sculptureUses].reduce((sum, [shape, uses]) => sum + ((shape.index?.count ?? shape.getAttribute('position').count) / 3) * uses, 0);
  const initialSculptureTriangles = sculptureTriangles();
  if (options.beamAnchor) {
    const at = anchors[options.beamAnchor];
    if (at) room.group.add(buildBeam([at[0], at[1] - 0.12, at[2]], room.wallTop));
  }
  if (!high && room.render) {
    room.render.envSize = 128; // cheaper cube capture on phones
    room.render.envBounces = 1;
  }

  scene.add(room.group, room.lights);
  const bounds = new THREE.Box3().setFromObject(room.group);
  const normalCutaway = createRoomCutaway(room); // preserve hall visibility boundary BEFORE static batching
  preservePictureFrameScreen(room.group); // retain the actual digital plane and its modeled border
  performance.mark('office:optimize:start');
  room.optimize?.({ static: true });
  performance.mark('office:optimize:end', { detail: { ...geometry, objects } });
  materialTier.preview(scene);

  const home: CameraPose = { position: room.camera.orbit, target: room.camera.target };
  camera.position.copy(v3(home.position));
  const orbit = new OrbitControls(camera, canvas);
  orbit.target.copy(v3(home.target));
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.12;
  orbit.rotateSpeed = 0.6;
  orbit.minDistance = 0.4;
  orbit.maxDistance = 16;
  orbit.maxPolarAngle = Math.PI / 2 + 0.08;
  orbit.screenSpacePanning = true;
  orbit.autoRotateSpeed = 0.35;
  orbit.update();

  report(0.86, 'Preparing the first view');
  // Split the source's render configuration from its synchronous environment bake.
  configureRoomRendering(renderer, scene, room, pipeline, { bloom: true });
  // Initial albedo/direct-light tier has no shadow casters. Final shadows refresh once,
  // never on every orbit frame; later geometry/Tidy changes explicitly request a refresh.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = false;
  performance.mark('office:shaders:start');
  await renderer.compileAsync(scene, camera);
  performance.mark('office:shaders:end', { detail: { programs: renderer.info.programs?.length ?? 0 } });
  if (!high) renderer.shadowMap.enabled = false;
  report(0.95, 'Drawing the first view');
  performance.mark('office:engine:ready', { detail: { ...geometry, objects, quality: options.quality } });

  // No editable hierarchy/audio/picker is built or imported on the startup path.
  let view = room;
  let cutaway = normalCutaway;
  let editor: BuiltRoom | null = null;
  let sceneEditor: RoomSceneEditor | null = null;
  let sceneEditorRoot: THREE.Scene | null = null;
  let sceneEditorPreparing: Promise<RoomSceneEditor> | null = null;
  let stagingEditor: RoomSceneEditor | null = null;
  const sceneSourceKey = `office:${__OFFICE_SCULPT_SOURCE_HASH__}:scene-v1`;
  const localSaveStore = createSceneSaveStore();
  const currentEditor = (): BuiltRoom | null => editor;
  let tidy: TidyController | null = null;
  let tidyWanted = false;
  let tidyState = { ...EMPTY_TIDY };
  const tidyListeners = new Set<(state: TidyState) => void>();
  const updateTidy = (state: TidyState) => {
    tidyState = state;
    if (!sceneEditorRoot && !state.enabled && state.hiddenCount === 0 && editor) { editor.group.visible = false; room.group.visible = true; view = room; cutaway = normalCutaway; }
    for (const cb of tidyListeners) cb(state);
  };

  // ---- render on demand -----------------------------------------------------
  const frameListeners = new Set<(p: Readonly<Record<string, ScreenPoint>>) => void>();
  const screenListeners = new Set<(projection: FrameScreenProjection | null) => void>();
  const pictureFrame = createPictureFrameScreen({ root: () => sceneEditorRoot ?? view.group, camera, viewport: size, hidden: (node) => sceneEditor?.hidden(node) ?? tidy?.hidden(node) ?? false });
  pictureFrame.bindRoot(room.group);
  const fitPictureFrame = () => size().w < 640 ? pictureFrame.focusPose(0.86) : pictureFrame.focusPose(0.64, THREE.MathUtils.degToRad(8));
  let frameReturn: CameraPose | null = null;
  let frameFitDistance = 0;
  let frameRequest = 0;
  const inputListeners = new Set<() => void>();
  let pending = 0;
  let disposed = false;
  const isDisposed = () => disposed;
  const refinementAbort = new AbortController();
  let lastInput = performance.now();
  const activePointers = new Set<number>();
  let finalEnvironment: THREE.DataTexture | null = null;
  let finishQuality: (ready: boolean) => void = () => undefined;
  const fullQuality = new Promise<boolean>((resolve) => { finishQuality = resolve; });
  let qualityState: RoomQuality = { stage: 'sharpening', completed: 0, total: 0 };
  const qualityListeners = new Set<(quality: RoomQuality) => void>();
  const updateQuality = (quality: RoomQuality) => {
    if (quality.stage !== qualityState.stage) performance.mark(`office:quality:${quality.stage}`);
    qualityState = quality;
    for (const listener of qualityListeners) listener(quality);
  };
  let flight:
    | { start: number; ms: number; from: THREE.Vector3; to: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; done: () => void }
    | undefined;
  const projected = new THREE.Vector3();
  let anchorVecs = Object.entries(anchors).map(([id, p]) => [id, v3(p)] as const);

  const updateCutaway = () => { cutaway(camera.position, (node) => sceneEditor?.hidden(node) ?? tidy?.hidden(node) ?? false, (node) => sceneEditor?.preserveShell(node) ?? false); };

  const emitFrame = () => {
    if (screenListeners.size) {
      const projection = pictureFrame.project();
      for (const listener of screenListeners) listener(projection);
    }
    if (!frameListeners.size) return;
    const { w, h } = size();
    const points: Record<string, ScreenPoint> = Object.fromEntries(options.anchors.map((spec) => [spec.id, { x: 0, y: 0, visible: false, distance: 0 }]));
    for (const [id, p] of anchorVecs) {
      projected.copy(p).project(camera);
      const x = (projected.x * 0.5 + 0.5) * w;
      const y = (-projected.y * 0.5 + 0.5) * h;
      const spec = options.anchors.find((a) => a.id === id);
      const visible = (!spec || !tidy || tidy.anchor(spec.names)) && projected.z < 1 && x > -40 && x < w + 40 && y > -40 && y < h + 40;
      points[id] = { x, y, visible, distance: camera.position.distanceTo(p) };
    }
    for (const cb of frameListeners) cb(points);
  };

  let lastRatio = entryRatio;
  const setRatio = (r: number) => {
    if (r === lastRatio) return;
    lastRatio = r;
    renderer.setPixelRatio(r);
    pipeline.setPixelRatio(r);
  };

  let lastMove = 0;
  let firstFrame = true;
  let sharpPixels = false, pixelsMarked = false, visibleMapPending = false, firstSharpness = false;
  let finishPresentation: () => void = () => undefined;
  const presented = new Promise<void>((resolve) => { finishPresentation = resolve; });
  const frame = (time: number) => {
    pending = 0;
    if (disposed) return;
    let moving = false;
    const hadFlight = flight !== undefined;
    const navigating = sceneEditor?.updateNavigation(time) ?? false;
    if (flight) {
      const t = flight.ms <= 0 ? 1 : Math.min(1, (time - flight.start) / flight.ms);
      const e = easeInOut(t);
      camera.position.lerpVectors(flight.from, flight.to, e);
      orbit.target.lerpVectors(flight.fromT, flight.toT, e);
      if (t >= 1) {
        const done = flight.done;
        flight = undefined;
        done();
      }
      moving = true;
    }
    const changed = !sceneEditor?.usesFirstPerson() || hadFlight ? orbit.update() : navigating;
    if (changed || moving || orbit.autoRotate) lastMove = time;
    const settling = time - lastMove < 120;
    // Only the first entry frame uses the motion cap. Never keep a new visitor
    // at .75 DPR / low resolution throughout the intro or subsequent navigation.
    setRatio(sharpPixels ? maxRatio : entryRatio);
    updateCutaway();
    updateCameraDepth(camera, bounds, true);
    pipeline.render();
    sceneEditor?.renderHelpers();
    if (sharpPixels && !pixelsMarked) {
      pixelsMarked = true;
      performance.mark('office:sharp-pixels', { detail: { ratio: lastRatio, antialias: renderer.getContext().getContextAttributes()?.antialias ?? false } });
    }
    if (visibleMapPending) {
      visibleMapPending = false;
      performance.mark(firstSharpness ? 'office:sharpness:update' : 'office:first-sharpness', { detail: { completed: qualityState.completed, total: qualityState.total } });
      firstSharpness = true;
    }
    if (firstFrame) {
      firstFrame = false;
      performance.mark('office:first-frame', { detail: { programs: renderer.info.programs?.length ?? 0, textures: renderer.info.memory.textures, calls: renderer.info.render.calls } });
      requestAnimationFrame(() => {
        performance.mark('office:first-paint');
        report(1, 'Ready');
        finishPresentation(); sharpPixels = true; request();
        requestAnimationFrame(() => { performance.mark('office:first-presented'); });
      });
    }
    emitFrame();
    if (flight || settling || orbit.autoRotate || navigating) request();
  };
  const request = () => {
    if (!pending && !disposed) pending = requestAnimationFrame(frame);
  };
  orbit.addEventListener('change', request);
  orbit.addEventListener('start', () => {
    flight?.done();
    flight = undefined; // user orbit takes over immediately, not after the flight
    for (const cb of inputListeners) cb();
  });

  const resize = () => {
    const { w, h } = size();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (frameReturn) {
      const fit = fitPictureFrame();
      if (fit) {
        const target = v3(fit.target), at = v3(fit.position), distance = at.distanceTo(target);
        if (flight) { flight.to.copy(at); flight.toT.copy(target); }
        else {
          const direction = camera.position.clone().sub(orbit.target);
          const scale = frameFitDistance > 0 ? direction.length() / frameFitDistance : 1;
          camera.position.copy(target).addScaledVector(direction.normalize(), distance * scale);
          orbit.target.copy(target); orbit.update();
        }
        frameFitDistance = distance;
      }
    }
    renderer.setSize(w, h, false);
    pipeline.setSize(w, h);
    request();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const onVisibility = () => {
    if (!document.hidden) request();
  };
  document.addEventListener('visibilitychange', onVisibility);
  resize();

  const touchInput = () => { lastInput = performance.now(); };
  const pointerDown = (event: PointerEvent) => { activePointers.add(event.pointerId); touchInput(); };
  const pointerUp = (event: PointerEvent) => { activePointers.delete(event.pointerId); touchInput(); };
  canvas.addEventListener('pointerdown', pointerDown, { passive: true });
  window.addEventListener('pointerup', pointerUp, { passive: true });
  window.addEventListener('pointercancel', pointerUp, { passive: true });
  canvas.addEventListener('wheel', touchInput, { passive: true });
  // Camera gestures always win. No decode/bake callback is allowed to monopolize input.
  const canRefine = () => !document.hidden && activePointers.size === 0 && !flight && !tidyState.preparing && performance.now() - lastInput >= 200;
  const checkpoint = () => new Promise<boolean>((resolve) => {
    const check = () => {
      if (disposed) { resolve(false); return; }
      if (!canRefine()) { window.setTimeout(check, 50); return; }
      requestAnimationFrame(() => { window.setTimeout(() => {
        // Input may have arrived while yielding to the browser: recheck, do not race it.
        if (disposed) resolve(false);
        else if (canRefine()) resolve(true);
        else check();
      }, 0); });
    };
    check();
  });
  // Visible color-map changes are cheap and yield every source. They must progress
  // during the cinematic and dragging, unlike heavyweight geometry/program work.
  const visualCheckpoint = () => new Promise<boolean>((resolve) => {
    const check = () => {
      if (disposed) { resolve(false); return; }
      if (document.hidden) { window.setTimeout(check, 100); return; }
      requestAnimationFrame(() => { window.setTimeout(() => { resolve(!disposed); }, 0); });
    };
    check();
  });
  const stats = { ...geometry, objects, buildMs: Math.round(performance.now() - started) };
  void (async () => {
    await presented;
    performance.mark('office:refinement:start');
    await refineTextures(room.group, ASSET_BASE, __OFFICE_IMAGE_PREVIEWS__.images, visualCheckpoint,
      () => { visibleMapPending = true; request(); }, materialTier.source, {
        phase: 'visible', camera, viewportHeight: size().h,
        progress: (completed, total) => { updateQuality({ stage: 'sharpening', completed, total }); },
      });
    if (isDisposed()) return;
    performance.mark('office:visible-textures:ready');
    updateQuality({ stage: 'materials', completed: 0, total: 0 });
    // Tiny/offscreen sculpts and hidden PBR maps cannot compete with the first visible surfaces.
    const sculptsReady = refineSculpts(__OFFICE_SCULPT_MANIFEST__, __OFFICE_SCULPT_SOURCE_HASH__, ASSET_BASE, checkpoint, refinementAbort.signal, request);
    const environmentReady = loadBakedEnvironment(ASSET_BASE, __OFFICE_SCULPT_SOURCE_HASH__, __OFFICE_ENVIRONMENT_BINDING__);
    const textures = await refineTextures(room.group, ASSET_BASE, __OFFICE_IMAGE_PREVIEWS__.images, visualCheckpoint, request, materialTier.source, { phase: 'remaining', camera });
    if (textures) fullTextureTier = true;
    const editable = currentEditor();
    const editableComplete = editable ? await refineTextures(editable.group, ASSET_BASE, __OFFICE_IMAGE_PREVIEWS__.images, visualCheckpoint, request, materialTier.source) : true;
    const environment = await environmentReady;
    if (environment) {
      if (!await checkpoint()) { environment.texture.dispose(); return; }
      const compilation = scene.clone(); materialTier.originals(compilation);
      compilation.environment = environment.texture; compilation.environmentIntensity = environment.intensity;
      const fill = compilation.getObjectByName('office-preview-fill');
      if (fill instanceof THREE.HemisphereLight) fill.intensity = 0;
      if (!await warmOriginalTextures(renderer, compilation, checkpoint)
        || !await compileOriginalMaterials(renderer, compilation, camera, high, checkpoint)
        || !await warmProgramReflection(renderer, checkpoint)
        || (high && !await compilePostprocessing(renderer, pipeline, compilation, checkpoint))
        || !await checkpoint()) { environment.texture.dispose(); return; }
      materialTier.restore(); previewFill.intensity = 0;
      finalEnvironment = environment.texture;
      scene.environment = finalEnvironment; scene.environmentIntensity = environment.intensity;
      pipeline.ao = high;
      renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
      performance.mark('office:lighting:artifact-ready', { detail: { programs: renderer.info.programs?.length ?? 0 } });
      request();
    }
    updateQuality({ stage: 'detail', completed: 0, total: 0 });
    const sculpts = await sculptsReady;
    if (!await checkpoint()) return;
    stats.triangles = Math.round(geometry.triangles + sculptureTriangles() - initialSculptureTriangles);
    performance.mark('office:refinement:detail', { detail: { sculpts, textures: textures && editableComplete, triangles: stats.triangles } });
    renderer.shadowMap.needsUpdate = true; request();
    await new Promise<void>((resolve) => { requestAnimationFrame(() => { requestAnimationFrame(() => { resolve(); }); }); });
    if (isDisposed()) return;
    const complete = sculpts && textures && editableComplete && environment !== null;
    updateQuality({ stage: complete ? 'ready' : 'limited', completed: 0, total: 0 });
    performance.mark(complete ? 'office:full-quality:ready' : 'office:full-quality:limited', { detail: { programs: renderer.info.programs?.length ?? 0 } });
    finishQuality(complete);
  })().catch(() => { if (!disposed) { updateQuality({ stage: 'limited', completed: 0, total: 0 }); performance.mark('office:full-quality:limited'); finishQuality(false); } });

  const flyToPose = (pose: CameraPose, durationMs: number) => new Promise<void>((resolve) => {
    flight?.done();
    flight = { start: performance.now(), ms: durationMs, from: camera.position.clone(), to: v3(pose.position),
      fromT: orbit.target.clone(), toT: v3(pose.target), done: resolve };
    request();
  });

  const prepareSceneEditor = (intent = true): Promise<RoomSceneEditor> => {
    if (intent) { frameRequest++; frameReturn = null; orbit.minDistance = 0.4; flight?.done(); flight = undefined; }
    if (sceneEditor) return Promise.resolve(sceneEditor);
    if (sceneEditorPreparing) return sceneEditorPreparing;
    sceneEditorPreparing = (async () => {
      performance.mark('office:editor:prepare-start');
      const moduleReady: Promise<unknown> = import(/* @vite-ignore */ new URL('scene-editor-viewport.js', ASSET_BASE).href);
      // Intent-only rebuild keeps all original anonymous meshes, without retaining
      // a second unbatched hierarchy/geometry set on the visitor startup path.
      const [editable, module] = await Promise.all([buildMoeOffice(), moduleReady]);
      if (isDisposed()) throw new Error('Room closed.');
      materialTier.preview(editable.group);
      if (fullTextureTier) await refineTextures(editable.group, ASSET_BASE, __OFFICE_IMAGE_PREVIEWS__.images, checkpoint, request, materialTier.source);
      if (materialTier.ready) {
        const compilation = scene.clone(); compilation.add(editable.group.clone());
        await warmOriginalTextures(renderer, compilation, checkpoint);
        await compileOriginalMaterials(renderer, compilation, camera, high, checkpoint);
        await warmProgramReflection(renderer, checkpoint);
      }
      if (isDisposed()) throw new Error('Room closed.');
      if (typeof module !== 'object' || module === null || !('createSceneEditorViewport' in module) || typeof module.createSceneEditorViewport !== 'function') throw new Error('Scene editor viewport unavailable.');
      const createViewport = module.createSceneEditorViewport as (options: SceneViewportOptions) => RoomSceneEditor;
      const editScene = new THREE.Scene(); editScene.name = 'Office objects'; editScene.add(editable.group);
      const canonicalAnchors = new Map<string, THREE.Object3D>();
      for (const spec of options.anchors) for (const name of spec.names) {
        const target = editScene.getObjectByName(name);
        if (target) { canonicalAnchors.set(spec.id, target); break; }
      }
      pictureFrame.bindRoot(editScene); // Canonical genuine screen BEFORE saved rename/delete/clone hydration.
      let viewportRef: RoomSceneEditor | null = null;
      const viewport = createViewport({
        three: sceneEditorThree(), scene: editScene, renderer, camera, orbit, request,
        sourceKey: sceneSourceKey,
        firstPerson: { position: editable.camera.walk, target: editable.camera.walkLook },
        focus: (pose) => { void flyToPose(pose, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450); },
        changed: (mutation) => {
          if (mutation.kind === 'structure' && mutation.action === 'add') materialTier.preview(mutation.object);
          editScene.updateMatrixWorld(true);
          // Edited/deleted hardware never gets an invented fallback marker.
          const exactSpecs = options.anchors.map(({ id, names, lift }) => ({ id, names, lift }));
          const updated = resolveAnchors(editScene, exactSpecs, (node) => viewportRef?.hidden(node) ?? false, canonicalAnchors);
          for (const id of Object.keys(anchors)) Reflect.deleteProperty(anchors, id);
          Object.assign(anchors, updated); anchorVecs = Object.entries(anchors).map(([id, at]) => [id, v3(at)] as const);
          const nextBounds = new THREE.Box3().setFromObject(editScene);
          if (!nextBounds.isEmpty()) bounds.copy(nextBounds);
          renderer.shadowMap.needsUpdate = true; request();
        },
      });
      viewportRef = viewport; stagingEditor = viewport;
      await viewport.restoreSaved(); // ONE shared preparation/restore before any interactive editor is returned.
      if (isDisposed()) { viewport.dispose(); throw new Error('Room closed.'); }
      tidyWanted = false; await tidy?.enable(false);
      orbit.enableDamping = true;
      if (editor) editor.group.visible = false;
      room.group.visible = false; editable.group.visible = true;
      editor = editable; view = editable; cutaway = createRoomCutaway(editable);
      sceneEditorRoot = editScene; pictureFrame.bindRoot(editScene);
      scene.add(editScene); sceneEditor = viewport; stagingEditor = null;
      performance.mark('office:editor:prepare-ready', { detail: { meshes: countGeometry(editScene).meshes } });
      request(); return viewport;
    })().catch((error: unknown) => { stagingEditor?.dispose(); stagingEditor = null; sceneEditorPreparing = null; throw error; });
    return sceneEditorPreparing;
  };

  return {
    anchors,
    stats,
    home,
    presented,
    fullQuality,
    onQuality(listener) {
      qualityListeners.add(listener); queueMicrotask(() => { if (qualityListeners.has(listener)) listener(qualityState); });
      return () => qualityListeners.delete(listener);
    },
    async flyTo(pose, durationMs) {
      const token = ++frameRequest; frameReturn = null;
      await flyToPose(pose, durationMs);
      if (token === frameRequest) orbit.minDistance = 0.4;
    },
    async focusPictureFrame(durationMs) {
      const pose = fitPictureFrame();
      if (!pose) return false;
      const token = ++frameRequest;
      frameReturn ??= { position: [camera.position.x, camera.position.y, camera.position.z], target: [orbit.target.x, orbit.target.y, orbit.target.z] };
      frameFitDistance = v3(pose.position).distanceTo(v3(pose.target));
      orbit.minDistance = 0.06; orbit.autoRotate = false;
      await flyToPose(pose, durationMs);
      const aligned = fitPictureFrame();
      if (isDisposed() || token !== frameRequest || !aligned || camera.position.distanceTo(v3(aligned.position)) > 0.001) return false;
      return pictureFrame.project() !== null;
    },
    async leavePictureFrame(durationMs, restoreCamera = true) {
      const token = ++frameRequest;
      const previous = frameReturn; frameReturn = null;
      if (previous && restoreCamera) await flyToPose(previous, durationMs);
      if (token === frameRequest) orbit.minDistance = 0.4;
      request();
    },
    onFrameScreen(listener) {
      screenListeners.add(listener);
      queueMicrotask(() => { if (screenListeners.has(listener) && !disposed) listener(pictureFrame.project()); });
      request();
      return () => screenListeners.delete(listener);
    },
    hitPictureFrame(point) { return pictureFrame.hit(point); },
    setInteractive(on) {
      orbit.enabled = on;
      if (on) performance.mark('office:controls:ready');
    },
    setAutoRotate(on) {
      orbit.autoRotate = on;
      request();
    },
    prepareSceneEditor,
    async restoreSavedScene(onRestoring) {
      const saved = await localSaveStore.has(sceneSourceKey, refinementAbort.signal);
      if (!saved.ok || !saved.value || isDisposed()) return null;
      onRestoring?.(true);
      try { return await prepareSceneEditor(false); }
      finally { onRestoring?.(false); }
    },
    async setTidy(on) {
      if (sceneEditor) { if (on) throw new Error('Use the scene editor actions and shared Undo history.'); return; }
      if (on) { frameRequest++; frameReturn = null; orbit.minDistance = 0.4; }
      tidyWanted = on;
      flight?.done(); flight = undefined; orbit.enabled = true;
      orbit.enableDamping = !on; // precise picks: no continued camera drift after a Tidy drag
      if (!on && !tidy) { updateTidy({ ...EMPTY_TIDY }); return; }
      if (!tidy) {
        updateTidy({ ...tidyState, enabled: true, preparing: true });
        try {
          const module: unknown = await import(/* @vite-ignore */ new URL('tidy.js', ASSET_BASE).href);
          if (disposed || !tidyWanted) return;
          if (!isTidyModule(module)) throw new Error('Tidy module unavailable');
          tidy = module.createTidyController({
            canvas, camera,
            load: async () => {
              // Rebuild only on first Tidy use; exact SDF buffers and decoded images are already cached.
              editor = await buildMoeOffice();
              if (disposed) throw new Error('Room closed');
              materialTier.preview(editor.group);
              if (fullTextureTier) await refineTextures(editor.group, ASSET_BASE, __OFFICE_IMAGE_PREVIEWS__.images, checkpoint, request, materialTier.source);
              if (materialTier.ready) {
                const compilation = scene.clone(); compilation.add(editor.group.clone());
                await warmOriginalTextures(renderer, compilation, checkpoint);
                await compileOriginalMaterials(renderer, compilation, camera, high, checkpoint);
                await warmProgramReflection(renderer, checkpoint);
              }
              return editor.group;
            },
            activate: (group) => { room.group.visible = false; group.visible = true; scene.add(group); if (editor) { view = editor; cutaway = createRoomCutaway(editor); } },
            shellRoots: () => [...view.walls.map((w) => w.group), ...view.ceiling],
            request: () => { renderer.shadowMap.needsUpdate = true; request(); },
            changed: updateTidy,
          });
        } catch { updateTidy({ ...EMPTY_TIDY, error: 'Tidy could not start. The original room is unchanged.' }); return; }
      }
      await tidy.enable(tidyWanted);
    },
    onTidy(cb) {
      tidyListeners.add(cb); queueMicrotask(() => { if (tidyListeners.has(cb)) cb(tidyState); });
      return () => tidyListeners.delete(cb);
    },
    undoTidy() { tidy?.undo(); }, restoreTidy() { tidy?.restore(); },
    configureTidy(parts, shell) { tidy?.configure(parts, shell); },
    selectTidy(id) { tidy?.select(id); }, hideTidySelection() { tidy?.hide(); },
    muteTidy(value) { tidy?.mute(value); },
    onFrame(cb) {
      frameListeners.add(cb);
      request();
      return () => frameListeners.delete(cb);
    },
    onUserInput(cb) {
      inputListeners.add(cb);
      return () => inputListeners.delete(cb);
    },
    dispose() {
      disposed = true; refinementAbort.abort();
      if (pending) cancelAnimationFrame(pending);
      finishPresentation(); finishQuality(false);
      finalEnvironment?.dispose();
      canvas.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', pointerUp);
      canvas.removeEventListener('wheel', touchInput);
      flight?.done();
      qualityListeners.clear(); frameListeners.clear(); screenListeners.clear(); frameRequest++; frameReturn = null;
      inputListeners.clear();
      tidyListeners.clear(); tidy?.dispose(); sceneEditor?.dispose(); stagingEditor?.dispose();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      orbit.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
};
