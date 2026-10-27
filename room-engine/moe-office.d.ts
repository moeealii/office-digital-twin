/**
 * Typed surface of the 3d-model-anything room code that the engine uses.
 * At build time `vite.room.config.ts` aliases these specifiers to the real
 * (read-only) sources in the WSL repo; for typechecking, only these
 * declarations are seen, so the strict gate never crawls third-party code.
 * Keep in sync with packages/room-runtime/types.ts + render.ts there.
 */

declare module '@moe-office/room' {
  import type { Group, Object3D, ToneMapping, Vector3 } from 'three';

  type V3 = [number, number, number];

  export interface WallDef {
    origin: Vector3;
    u: Vector3;
    n: Vector3;
    length: number;
  }

  export interface BuiltRoom {
    group: Group;
    lights: Group;
    walls: { def: WallDef; group: Object3D }[];
    ceiling: Object3D[];
    wallTop: number;
    exposure?: number;
    bloom?: { strength: number; radius: number; threshold: number };
    render?: {
      toneMapping?: ToneMapping;
      envSize?: number;
      envBounces?: number;
      envNeutral?: boolean;
    };
    camera: { orbit: V3; target: V3; walk: V3; walkLook: V3 };
    environment: { center: V3; intensity: number };
    optimize?(opts?: { static?: boolean }): unknown;
  }

  export function buildMoeOffice(): Promise<BuiltRoom>;
}

declare module '@moe-office/runtime/render' {
  import type { Camera, Scene, WebGLRenderer } from 'three';
  import type { BuiltRoom } from '@moe-office/room';

  export interface Pipeline {
    render(): void;
    setSize(w: number, h: number): void;
    setPixelRatio(ratio: number): void;
    setSceneRenderer(draw?: (renderer: WebGLRenderer, camera: Camera) => void): void;
    ao: boolean;
  }

  export function createPipeline(renderer: WebGLRenderer, scene: Scene, camera: Camera): Pipeline;
  export function precompileRoomRendering(
    renderer: WebGLRenderer,
    scene: Scene,
    room: BuiltRoom,
    camera: Camera,
  ): Promise<void>;
  export function configureRoomRendering(
    renderer: WebGLRenderer, scene: Scene, room: BuiltRoom, pipeline?: Pipeline, opts?: { bloom?: boolean },
  ): void;
  export function applyRoomRendering(
    renderer: WebGLRenderer,
    scene: Scene,
    room: BuiltRoom,
    pipeline?: Pipeline,
    opts?: { bloom?: boolean },
  ): void;
}

declare module '@moe-office/runtime/lighting' {
  import type { Scene, WebGLRenderer, WebGLRenderTarget } from 'three';

  export function configureRenderer(renderer: WebGLRenderer, scene: Scene): void;
  export function officeEnvironmentTarget(scene: Scene): WebGLRenderTarget | undefined;
}

declare module '@moe-office/runtime/camera-depth' {
  import type { Box3, PerspectiveCamera } from 'three';

  export function updateCameraDepth(camera: PerspectiveCamera, bounds: Box3, orbit: boolean): boolean;
}

declare module '@moe-office/runtime/materials' {
  export function setMaxAnisotropy(value: number): void;
}
