import * as THREE from 'three';
import type { PartContext } from '../parts/types';

/**
 * DISABLED — duplicate of the west-desk toys.
 *
 * The older desk-toys worker (`_desk-toys-a/b/c.ts`) modelled the same physical objects as
 * `desk-west.ts` + `_desk-west-toys.ts` (KAWS / Minnie figure, turbine fan, paper towel, spring-
 * hex ornament, Diet Coke, plant/leaf vase, blue crystal/fin, etc.). Both item modules were
 * auto-built by `import.meta.glob('./items/*.ts')`, so every toy appeared twice.
 *
 * Keep this stub so `?items=desk-toys` still resolves; the real toys live under desk-west.
 * Helper files `_desk-toys-*.ts` are unused and not auto-built (underscore prefix).
 */
export async function build(_ctx: PartContext): Promise<THREE.Object3D> {
  const g = new THREE.Group();
  g.name = 'desk-toys-disabled';
  return g;
}
