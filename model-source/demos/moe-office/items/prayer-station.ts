import * as THREE from 'three';
import type { PartContext } from '../parts/types';
import { phys, staticBody } from './_moe-kit';
import { buildChest } from './_prayer-chest';
import { prayerMaterials } from './_prayer-mats';
import { buildStand } from './_prayer-panel';
import { buildChestProps, buildFloorProps } from './_prayer-props';
import { buildTextiles } from './_prayer-textiles';

/**
 * The prayer station on wall 2 between windows 1 and 2 (RoomPlan object 13) — the owner's
 * highest-priority object. Photos 43–45, 58–72, 183, 198, 199.
 *
 * It is one free-standing piece, NOT square to the wall: a low chest (0.59 × 0.435 × 0.42) with a
 * tall carved rack on it (two stepped side boards, three dowel rails, a back board ending in the
 * mihrab crest at 1.755 m). The whole unit is turned 17.8° toward the room centre. Placement was
 * solved from the posed photos, not the RoomPlan box:
 *   - crest tip triangulated from photos 44/45/183 → (−2.805, 1.76, 0.83);
 *   - the two crest crescents triangulated from 44/45/183 → (−2.728, 1.488, 1.056) and
 *     (−2.869, 1.483, 0.617): their line fixes the yaw (front normal (0.952, 0, −0.306));
 *   - chest front corners from rays hitting the chest-top plane in 58/64/65/66/199 (spread < 2 cm).
 *
 * Stand-local frame used by all _prayer-* modules: origin at (−2.80, 0, 0.836), lx across the front
 * (toward smaller world z), +y up, +lz toward the room, lz = 0 at the back board's front face.
 */
export const STAND_ORIGIN = new THREE.Vector3(-2.80, 0, 0.836);
export const STAND_YAW = THREE.MathUtils.degToRad(107.8);

export async function build(_ctx: PartContext): Promise<THREE.Object3D> {
  const m = await prayerMaterials();
  const g = new THREE.Group();
  g.name = 'prayer-station';

  const unit = new THREE.Group();
  unit.name = 'prayer-unit';
  unit.position.copy(STAND_ORIGIN);
  unit.rotation.y = STAND_YAW;
  // Furniture shell stays one static assembly; surface + floor props knoll separately.
  unit.add(buildChest(m), buildStand(m), buildTextiles(m));
  const chestProps = buildChestProps(m);
  for (const child of [...chestProps.children]) {
    phys(child, child.name.includes('book') ? 0.6 : child.name.includes('tray') ? 0.8 : 0.25);
    unit.add(child);
  }
  g.add(staticBody(unit));

  const floor = buildFloorProps(m);
  for (const child of [...floor.children]) {
    phys(child, child.name.includes('register') ? 1.2 : 1.5, child.name.includes('register') ? 'box' : 'hull');
    g.add(child);
  }
  return g;
}
