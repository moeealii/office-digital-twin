import * as THREE from 'three';
import type { PartContext } from '../parts/types';
import {
  buildAc, buildAcController, buildAranet4, buildExhaustVent, buildFloorCords,
  buildHose, buildOutlet, EXHAUST,
} from './_fireplace-appl';
import { buildCart } from './_fireplace-cart';
import { fireplaceMats } from './_fireplace-mats';
import { buildSwitch, SWITCH } from './_fireplace-mirror';
import { buildTv, buildTvCable, TV_OUTLET } from './_fireplace-tv';
import { buildFireplace, buildHearth, FIRE, FIRE_U } from './_fireplace-unit';
import { noPhys, phys, staticBody } from './_moe-kit';
import { buildWinixD480 } from './_winix-d480';

/**
 * Wall 1 (z = −2.712): the television on its rolling floor stand, the gold two-tier bar cart, the
 * linear electric fireplace on its marble hearth, the Cool-Living portable AC (black control deck and
 * remote on the TOP, louvres on the front), the ribbed exhaust hose arching to a round wall port at
 * (−1.06, 0.38), and the Winix D480 tower purifier, plus the wall receptacle the TV lead drops into.
 *
 * CAMERA RELIABILITY ON THIS WALL (measured, not assumed — project the room's own lines and see
 * where they land): photos **13, 14, 16 and 17 are good to 2–6 px** on the baseboard's 0.140 m line
 * and the fireplace's 0.346/0.860 edges, so use them for anything where apparent size matters.
 * **Photo 0 is ~3 % off vertically** and 192 worse: use those two for shape and silhouette only,
 * never for size. `photo=N` capture renders of 13/14/16/17 are therefore correctly framed; the
 * ~1.6× shrink reported elsewhere in the room does not reproduce on these four.
 *
 * Every dimension below comes from a posed photo after that check: the fireplace from a true-scale
 * rectification verified twice (see _fireplace-unit.ts), the TV panel from a least-squares fit of
 * its four corner pixels (see _fireplace-tv.ts), the AC from photo 1's vertical edge and four top
 * corners (see _fireplace-appl.ts), the cart from photo 13's castors and post, and the hearth's front
 * edge from four rays.
 *
 * The bouclé sectional, the wall-3 lounge, the prayer station and the desks belong to other workers
 * and are deliberately absent. The fireplace, its hearth, the mirror, the switch and the receptacle
 * hang on the wall (ctx.onWall) so the cutaway hides them with it; the TV, cart and appliances
 * stand on the floor.
 */
export function build(ctx: PartContext) {
  const m = fireplaceMats();
  const g = new THREE.Group();
  g.name = 'fireplace-wall';

  // --- wall-mounted: fireplace, hearth inlay, mirror, switch, receptacle --------------------
  ctx.onWall(1, staticBody(buildFireplace(m)), FIRE_U, FIRE.v0, 0);
  ctx.onWall(1, staticBody(buildHearth(m)), FIRE_U, 0, 0);
  // the round mirror is lounge's (0.80 m, matches photo 141); this smaller copy duplicated it
  ctx.onWall(1, staticBody(buildSwitch(m)), SWITCH.u, SWITCH.v, 0.001);
  ctx.onWall(1, staticBody(buildOutlet(m)), TV_OUTLET.u, TV_OUTLET.v, 0.001);
  ctx.onWall(1, staticBody(buildExhaustVent(m)), EXHAUST.u, EXHAUST.v, 0.001);

  // --- floor-standing (each appliance/prop is its own knoll piece) --------------------------
  g.add(phys(buildTv(m), 28, 'box'));
  g.add(noPhys(buildTvCable(m)));
  {
    const cart = buildCart(m);
    // Decor on the cart knolls separately when tagged; cart frame stays the support.
    for (const name of ['cart-top', 'cart-low', 'cart-mushroom', 'cart-hydrangea']) {
      const child = cart.getObjectByName(name);
      if (child && name !== 'cart-top' && name !== 'cart-low') phys(child, name.includes('mushroom') ? 0.4 : 0.6);
    }
    g.add(phys(cart, 12, 'box'));
  }
  g.add(phys(buildAc(m), 32, 'box'));
  g.add(phys(buildAcController(m), 0.12, 'box'));
  g.add(phys(buildAranet4(m), 0.15, 'box'));
  g.add(phys(buildWinixD480(), 8.5, 'box'));
  g.add(noPhys(buildHose(m)));
  g.add(noPhys(buildFloorCords(m)));
  return g;
}
