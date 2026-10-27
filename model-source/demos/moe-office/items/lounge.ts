import * as THREE from 'three';
import type { PartContext } from '../parts/types';
import { loungeMaterials } from './_lounge-mats';
import { buildSofa } from './_lounge-sofa';
import { tuftedSetMaterials } from './_tufted-set';
import { buildTable } from './_lounge-table';
import {
  buildAcrylicChair, buildCardboardBox, buildDivider, buildGardenStool, buildMirror, buildRattanPouf,
  buildSettee, buildWhiteboard,
} from './_lounge-ne';

/**
 * The lounge side of Moe's office: the wall-3 tufted cream leather sofa (RoomPlan object 3), the
 * white marble + gold coffee table with its copper tray and domed dish (object 7), the acrylic
 * chair, the woven four-panel divider, the garden stool and rattan pouf, and the north-east corner
 * (settee = object 5, rolling whiteboard, cardboard box, sunburst mirror).
 *
 * Measurements and photo evidence are in the header of each _lounge-* module. All of it is
 * floor-standing and free-standing except the mirror, which goes through ctx.onWall(1, …).
 * Nothing here needs a light of its own — the shell's pot lights cover the lounge.
 */
export async function build(ctx: PartContext): Promise<THREE.Object3D> {
  const m = await loungeMaterials();
  const g = new THREE.Group();
  g.name = 'lounge';

  // wall-3 sofa group
  // the sofa is one of the cream tufted set; the loveseat in desk-east is built from the same module
  const sofa = buildSofa({
    set: await tuftedSetMaterials(), card: m.card, cardTape: m.cardTape,
    fleece: m.blue, hoodie: m.blackJacket,
  });
  g.add(sofa);

  g.add(buildTable(m));

  // stools beside the sofa's north arm (photos 103, 123, 125); the garden stool sits just clear of the arm (z ≤ -0.69)
  g.add(buildGardenStool(m, 2.03, -0.88));
  g.add(buildRattanPouf(m, 1.68, -0.60));

  // NE corner
  g.add(buildSettee(m));
  g.add(buildWhiteboard(m));
  g.add(buildCardboardBox(m));
  g.add(buildDivider(m));
  g.add(buildAcrylicChair(m));

  // the mirror hangs on wall 1 (u = x + 2.976)
  const mirror = buildMirror(m);
  // centre u 5.006 (photo 141 plate-scale measurement): clears the light switch at u 4.495
  ctx.onWall(1, mirror, 5.006, 1.46);
  g.add(mirror);

  return g;
}
