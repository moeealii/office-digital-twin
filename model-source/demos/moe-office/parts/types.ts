import type * as THREE from 'three';
import type { WallDef } from '../../../packages/room-runtime/walls';
import type { Palette } from '../../../packages/room-runtime/materials';
import type { ShellMaterials } from '../shell';

/** Everything a part/item needs from the room. Room coordinates: meters, floor y = 0, +y up. */
export interface PartContext {
  /** walls by index (see BRIEF.md): origin = interior face, left end; u along; n into room */
  walls: WallDef[];
  /** place obj on wall `wall` (local +x along the wall, +y up, +z into the room) and attach it to that wall's group */
  onWall<T extends THREE.Object3D>(wall: number, obj: T, u: number, v: number, out?: number): T;
  /** attach something already positioned in room coords to a wall's group (hides with the wall in cutaway) */
  attachToWall<T extends THREE.Object3D>(wall: number, obj: T): T;
  /** shared generic palette (brass, silver, darkWood, oak, glass, mirror, linen, leather, …) */
  materials: Palette;
  /** the shell's own materials (paint, trimWhite, floor, …) */
  shell: ShellMaterials;
  ceiling: number;
  insideRoom(x: number, z: number, margin?: number): boolean;
  /** add a light; it survives the budget only when tagged userData.keep BEFORE this call */
  addLight(light: THREE.Light): void;
}

export interface PartModule {
  /** return a group in room coordinates (floor-standing things); wall-mounted things go through ctx.onWall */
  build(ctx: PartContext): THREE.Object3D | Promise<THREE.Object3D>;
}
