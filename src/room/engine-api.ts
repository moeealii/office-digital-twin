/**
 * Contract between the React app and the prebuilt 3D room engine
 * (`room-engine/engine.ts` → `public/room/engine.js`, rebuilt by
 * `pnpm --filter office-showcase run build:room`). The app never imports
 * three.js: it loads the engine at runtime and talks to it only through
 * these types, so the main bundle stays small and the room can be
 * re-exported without touching the app.
 */

import type { FrameScreenProjection } from './frame-screen-projection';

export type Vec3 = readonly [number, number, number];

export interface CameraPose {
  readonly position: Vec3;
  readonly target: Vec3;
}

/** Where a hotspot lives: the first named object found in the scene wins. */
export interface AnchorSpec {
  readonly id: string;
  /** Object names to look for (item/part group names from the room source). */
  readonly names: readonly string[];
  /** Optional room-space fallback (meters, +y up). Omit when only the genuine modeled object is acceptable. */
  readonly fallback?: Vec3;
  /** Raise the marker this far above the object's top (meters). */
  readonly lift: number;
}

export interface ScreenPoint {
  /** CSS pixels relative to the canvas. */
  readonly x: number;
  readonly y: number;
  /** In front of the camera and inside the viewport. */
  readonly visible: boolean;
  /** Camera distance in meters (for depth-sorting and fading). */
  readonly distance: number;
}

type Quality = 'high' | 'low';

export interface RoomStats {
  readonly meshes: number;
  readonly triangles: number;
  readonly objects: number;
  readonly buildMs: number;
}

export interface RoomQuality {
  stage: 'sharpening' | 'materials' | 'detail' | 'ready' | 'limited';
  /** Actual successfully upgraded map sources, not a guessed whole-room percentage. */
  completed: number;
  total: number;
}

interface TidyItem { id: string; label: string; hidden: boolean }
export interface TidyState {
  enabled: boolean; preparing: boolean; hiddenCount: number; selection: string | null; selectedId: string;
  lastHidden: string | null; parts: boolean; shell: boolean; muted: boolean; error: string | null;
  bounds: { x: number; y: number; width: number; height: number } | null;
  items: readonly TidyItem[];
}

export interface RoomEngine {
  /** Resolved anchor positions, by AnchorSpec id. */
  readonly anchors: Readonly<Record<string, Vec3>>;
  readonly stats: RoomStats;
  readonly home: CameraPose;
  /** Resolves only after a real rendered frame has had a browser paint opportunity. */
  readonly presented: Promise<void>;
  /** Exact geometry/textures and original offline-baked lighting, independent of first usability. */
  readonly fullQuality: Promise<boolean>;
  onQuality(listener: (quality: RoomQuality) => void): () => void;
  /** Animate the camera; resolves when it lands (or immediately when durationMs <= 0). */
  flyTo(pose: CameraPose, durationMs: number): Promise<void>;
  /** Align with the actual west display's plane; false when missing, hidden or obstructed. */
  focusPictureFrame(durationMs: number): Promise<boolean>;
  leavePictureFrame(durationMs: number, restoreCamera?: boolean): Promise<void>;
  onFrameScreen(listener: (projection: FrameScreenProjection | null) => void): () => void;
  hitPictureFrame(point: { x: number; y: number }): boolean;
  /** Enable/disable user orbit (off during the cinematic intro). */
  setInteractive(on: boolean): void;
  /** Slow turntable orbit around the current target. */
  setAutoRotate(on: boolean): void;
  /** Lazy, visitor-local official Editor; never prefetched on the room startup path. */
  prepareSceneEditor?(): Promise<import('./scene-editor-api').RoomSceneEditor>;
  /** Cheap saved-key check; only existing local saves trigger deferred graph hydration. */
  restoreSavedScene?(onRestoring?: (restoring: boolean) => void): Promise<import('./scene-editor-api').RoomSceneEditor | null>;
  setTidy(on: boolean): Promise<void>;
  onTidy(cb: (state: TidyState) => void): () => void;
  undoTidy(): void;
  restoreTidy(): void;
  configureTidy(parts: boolean, shell: boolean): void;
  selectTidy(id: string): void;
  hideTidySelection(): void;
  muteTidy(muted: boolean): void;
  /** Called after every rendered frame with each anchor's screen position. */
  onFrame(cb: (points: Readonly<Record<string, ScreenPoint>>) => void): () => void;
  /** Called when the visitor grabs the camera (cancels intro/tour). */
  onUserInput(cb: () => void): () => void;
  dispose(): void;
}

export interface MountOptions {
  readonly quality: Quality;
  readonly anchors: readonly AnchorSpec[];
  /** Anchor id that gets the glowing uplink beam (the "rack"). */
  readonly beamAnchor?: string | undefined;
  readonly onProgress: (progress: number, stage: string) => void;
}

export type MountRoom = (canvas: HTMLCanvasElement, options: MountOptions) => Promise<RoomEngine>;

export interface RoomEngineModule {
  readonly mountRoom: MountRoom;
}
