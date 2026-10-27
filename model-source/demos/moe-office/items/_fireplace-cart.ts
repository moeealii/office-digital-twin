import * as THREE from 'three';
import { at, cyl, mesh, rbox, rod, rng, tube, v3 } from './_moe-kit';
import type { FireplaceMats } from './_fireplace-mats';
import { inst, lathe, sph } from './_fireplace-geo';

/**
 * The gold two-tier bar cart (RoomPlan object 8, photos 13–22, 28–31; close-ups 17, 18, 21, 22).
 *
 * It is not the teak-slat cart of the old draft: photos 16/17/21 show a hollow brass tube frame,
 * TWO MIRRORED shelves in raised gilt frames, gilt gallery rails (two at the top tier, one at the
 * lower), a push handle on the west end and twin-wheel castors. Measurements:
 *   - casters (photo 13: 213,999 / 428,1029 / 496,826 at y=.035) give world
 *     x −.643…−.176, z −1.889…−2.583: the LONG axis is into the wall, not across it.
 *     Frame .69 × .45 m, centre (−.415,−2.237), yaw π/2; handle at the room end;
 *   - top shelf .700 m, lower shelf .235 m, rails .820/.770 and .290. Photo 13's
 *     front-right post gives y=.699/.773/.822 at shelf/lower-gallery/upper-gallery;
 *     this uses the independently measured caster's z=−1.904, not the wall plane;
 *   - contents identified at full resolution: a ceramic mushroom (photo 21/29), a hammered-gold
 *     vase of white hydrangea, two gilded glass jars with gold butterfly lids, a
 *     cream pitcher with a grape motif, a linen-spray bottle, the "Best MOM ever" pick; the lower
 *     tier holds the ribbed cobalt vase with a dark red rose and the gilt filigree glass box.
 *
 * Local frame: origin on the floor at the cart's centre, +x toward the wall, +z east.
 */
export const CART = {
  centre: new THREE.Vector2(-0.415, -2.237),
  yaw: Math.PI / 2,
  w: 0.69,
  d: 0.45,
  topShelf: 0.700,
  lowShelf: 0.235,
  railTop: 0.820,
  railLow: 0.290,
  postTop: 0.855,
  castor: 0.072,
};

export function buildCart(m: FireplaceMats) {
  const g = new THREE.Group();
  g.name = 'gold-bar-cart';
  g.position.set(CART.centre.x, 0, CART.centre.y);
  g.rotation.y = CART.yaw;
  const hw = CART.w / 2, hd = CART.d / 2;

  // --- frame ------------------------------------------------------------------------------
  const postInset = 0.012;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (hw - postInset), z = sz * (hd - postInset);
      const post = cyl(0.0105, 0.0105, CART.postTop - CART.castor, m.gilt, 14);
      at(post, x, (CART.postTop + CART.castor) / 2, z);
      g.add(post);
      // twin-wheel castor: brass yoke, two dark wheels
      const yoke = rbox(0.026, 0.036, 0.032, 0.005, m.giltMatte, 2);
      at(yoke, x, CART.castor / 2 + 0.012, z);
      g.add(yoke);
      for (const dy of [-0.011, 0.011]) {
        const wheel = cyl(0.030, 0.030, 0.011, m.rubber, 16);
        wheel.rotation.z = Math.PI / 2;
        at(wheel, x + dy, 0.032, z);
        g.add(wheel);
      }
      const pin = cyl(0.004, 0.004, 0.035, m.chrome, 8);
      pin.rotation.z = Math.PI / 2;
      at(pin, x, 0.032, z);
      g.add(pin);
    }
  }

  for (const y of [CART.topShelf, CART.lowShelf]) g.add(shelfFrame(m, y));

  // gallery rails: two at the top tier, one at the lower
  for (const y of [CART.railTop, 0.770]) {
    g.add(railRing(m, y, 0.020, 0.0095));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (hw - postInset), z = sz * (hd - postInset);
        const riser = cyl(0.0095, 0.0095, 0.03, m.gilt, 12);
        at(riser, x, y - 0.015, z);
        g.add(riser);
      }
    }
  }
  g.add(railRing(m, CART.railLow, 0.020, 0.0095));
  {
    const y = CART.railLow;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (hw - postInset), z = sz * (hd - postInset);
        const riser = cyl(0.0095, 0.0095, 0.03, m.gilt, 12);
        at(riser, x, y - 0.015, z);
        g.add(riser);
      }
    }
  }

  // --- push handle on the west end (photos 16, 17, 22) -------------------------------------
  {
    const y = 0.850;
    const pts: [number, number, number][] = [
      [-hw + postInset, y, hd - postInset],
      [-hw - 0.045, y + 0.004, hd - 0.035],
      [-hw - 0.075, y, hd - 0.080],
      [-hw - 0.075, y, -hd + 0.080],
      [-hw - 0.045, y + 0.004, -hd + 0.035],
      [-hw + postInset, y, -hd + postInset],
    ];
    const curve = new THREE.CatmullRomCurve3(pts.map(p => v3(...p)), false, 'catmullrom', 0.35);
    const geo = new THREE.TubeGeometry(curve, 48, 0.0115, 10, false);
    g.add(mesh(geo, m.gilt, 'cart-handle'));
  }

  g.add(topTier(m));
  g.add(lowTier(m));
  return g;
}

/** Mirrored shelf in a raised gilt frame. */
function shelfFrame(m: FireplaceMats, y: number) {
  const grp = new THREE.Group();
  const hw = CART.w / 2 - 0.004, hd = CART.d / 2 - 0.004;
  const panel = rbox(hw * 2 - 0.012, 0.006, hd * 2 - 0.012, 0.002, m.mirror, 2);
  at(panel, 0, y, 0);
  grp.add(panel);
  const bar = (bw: number, bd: number, x: number, z: number) => {
    grp.add(at(rbox(bw, 0.013, bd, 0.004, m.gilt, 2), x, y + 0.004, z));
  };
  bar(hw * 2, 0.016, 0, hd);
  bar(hw * 2, 0.016, 0, -hd);
  bar(0.016, hd * 2, hw, 0);
  bar(0.016, hd * 2, -hw, 0);
  return grp;
}

function railRing(m: FireplaceMats, y: number, inset: number, r: number) {
  const grp = new THREE.Group();
  const hw = CART.w / 2 - 0.012 - inset + 0.012, hd = CART.d / 2 - 0.012 - inset + 0.012;
  const x = hw, z = hd;
  grp.add(rod([-x, y, z], [x, y, z], r, m.gilt, 10));
  grp.add(rod([-x, y, -z], [x, y, -z], r, m.gilt, 10));
  grp.add(rod([-x, y, -z], [-x, y, z], r, m.gilt, 10));
  grp.add(rod([x, y, -z], [x, y, z], r, m.gilt, 10));
  return grp;
}

// ------------------------------------------------------------------------------------------
// top tier contents
// ------------------------------------------------------------------------------------------
function topTier(m: FireplaceMats) {
  const g = new THREE.Group();
  g.name = 'cart-top';
  const y = CART.topShelf + 0.014;

  g.add(mushroom(m, 0.225, y, -0.125));
  {
    const vase = lathe([
      [0, 0], [0.038, 0], [0.045, 0.006], [0.052, 0.03], [0.055, 0.09], [0.056, 0.16],
      [0.052, 0.185], [0.049, 0.19], [0.046, 0.186], [0.046, 0.06], [0, 0.055],
    ], m.giltHammered, 32);
    vase.scale.y = 0.68; // photo 13 shows a ~.13 m vase above the mirror, not a .19 m cylinder
    at(vase, 0.08, y, 0.035);
    g.add(vase);
    g.add(hydrangea(m, 0.08, y + 0.125, 0.035, 1.0, 7));
    // the "Best MOM ever" pick standing out of the bouquet (photo 17)
    const stemTop = y + 0.125 + 0.30;
    g.add(rod([0.08, y + 0.12, 0.035], [0.095, stemTop, 0.025], 0.0016, m.wireGold, 6));
    const card = mesh(new THREE.PlaneGeometry(0.060, 0.060), m.pickCard, 'mom-pick');
    at(card, 0.095, stemTop + 0.030, 0.025, -Math.PI / 2);
    card.rotation.x = -0.12;
    g.add(card);
  }

  // Paired butterfly jars across the ROOM end, bouquet/pitcher/mushroom behind (13/22).
  g.add(goldJar(m, -0.178, y, -0.022, 0.052, 0.130, 0.7));
  g.add(goldJar(m, -0.119, y, 0.092, 0.049, 0.115, 2.3));

  // cream pitcher with the grape motif (photo 21)
  {
    const p = new THREE.Group();
    const body = lathe([
      [0, 0], [0.030, 0], [0.036, 0.008], [0.042, 0.035], [0.040, 0.07], [0.033, 0.088],
      [0.031, 0.094], [0.026, 0.092], [0.028, 0.06], [0, 0.055],
    ], m.ceramicCream, 26);
    p.add(body);
    const rimRing = cyl(0.032, 0.031, 0.006, m.ceramicBrown, 24);
    at(rimRing, 0, 0.094, 0);
    p.add(rimRing);
    const handle = mesh(new THREE.TorusGeometry(0.022, 0.004, 6, 16, Math.PI * 1.15), m.ceramicCream);
    at(handle, 0.041, 0.062, 0);
    handle.rotation.z = -1.9;
    p.add(handle);
    for (let i = 0; i < 7; i++) {
      const grape = sph(0.0042, m.roseRed, 8, 6);
      const gx = 0.016 + (i % 4) * 0.0065;
      const gy = 0.05 + Math.floor(i / 4) * 0.0065 + (i % 2) * 0.002;
      at(grape, gx, gy, 0.031 - Math.abs(gx) * 0.15);
      p.add(grape);
    }
    for (const [lx, ly, a] of [[0.008, 0.062, 0.5], [0.028, 0.058, -0.9]] as const) {
      const lf = mesh(new THREE.PlaneGeometry(0.024, 0.011), m.leaf);
      at(lf, lx, ly, 0.033, 0);
      lf.rotation.set(-0.3, a, 0.5);
      p.add(lf);
    }
    at(p, 0.080, y, -0.135, -1.8);
    g.add(p);
  }

  // linen spray bottle (photo 21/17)
  {
    const b = new THREE.Group();
    const body = cyl(0.022, 0.024, 0.10, m.frostedJar, 18);
    at(body, 0, 0.05, 0);
    b.add(body);
    const label = mesh(new THREE.CylinderGeometry(0.0225, 0.0245, 0.055, 18, 1, true), m.sprayLabel);
    at(label, 0, 0.05, 0);
    b.add(label);
    const neck = cyl(0.011, 0.012, 0.02, m.plugWhite, 12);
    at(neck, 0, 0.11, 0);
    b.add(neck);
    const pump = cyl(0.008, 0.008, 0.016, m.chrome, 10);
    at(pump, 0, 0.128, 0);
    b.add(pump);
    const nozzle = rbox(0.016, 0.012, 0.026, 0.003, m.plugWhite, 2);
    at(nozzle, 0.008, 0.136, 0.004);
    b.add(nozzle);
    at(b, 0.065, y, -0.045, 0.4);
    g.add(b);
  }
  return g;
}

// ------------------------------------------------------------------------------------------
// lower tier contents
// ------------------------------------------------------------------------------------------
function lowTier(m: FireplaceMats) {
  const g = new THREE.Group();
  g.name = 'cart-low';
  const y = CART.lowShelf + 0.012;

  // ribbed cobalt vase holding a dark red rose (photos 16, 18, 21)
  {
    const v = new THREE.Group();
    const body = lathe([
      [0, 0], [0.045, 0], [0.062, 0.012], [0.073, 0.038], [0.075, 0.07], [0.068, 0.10],
      [0.052, 0.122], [0.030, 0.134], [0.028, 0.142], [0.024, 0.143], [0.024, 0.128], [0, 0.12],
    ], m.cobalt, 40);
    v.add(body);
    const water = cyl(0.028, 0.028, 0.002, m.mirror, 20);
    at(water, 0, 0.126, 0);
    v.add(water);
    // stems, leaves and one dark rose
    v.add(rod([0.004, 0.13, 0.002], [0.012, 0.29, 0.012], 0.0032, m.leaf, 6));
    v.add(rod([-0.012, 0.13, -0.006], [-0.03, 0.25, 0.01], 0.0028, m.leaf, 6));
    for (const [lx, ly, lz, a] of [[0.02, 0.2, 0.02, 0.7], [-0.03, 0.19, 0.015, -1.1], [0.005, 0.24, -0.02, 2.4]] as const) {
      const lf = mesh(new THREE.PlaneGeometry(0.026, 0.011), m.leaf);
      at(lf, lx, ly, lz, 0);
      lf.rotation.set(-0.4, a, 0.4);
      v.add(lf);
    }
    const rose = lathe([
      [0, 0], [0.012, 0.002], [0.019, 0.010], [0.021, 0.019], [0.017, 0.027], [0.008, 0.030], [0, 0.028],
    ], m.roseRed, 20);
    at(rose, 0.012, 0.288, 0.012);
    v.add(rose);
    at(v, 0.16, y, -0.070);
    g.add(v);
  }

  // gilt filigree glass box (photos 18, 21, 22)
  {
    const b = new THREE.Group();
    const L = 0.32, W = 0.125, H = 0.082;
    // Three shallow glass compartments in the wire basket (193), not an opaque white block.
    b.add(at(rbox(L - 0.03, 0.004, W - 0.025, 0.002, m.mirror, 2), 0, 0.008, 0));
    for (const x of [-0.095, 0, 0.095]) {
      const dish = lathe([[0, 0], [0.020, 0], [0.030, 0.006], [0.033, 0.020], [0.030, 0.021], [0.027, 0.008], [0, 0.005]], m.glassJar, 24);
      dish.scale.x = 1.25;
      at(dish, x, 0.012, 0);
      b.add(dish);
    }
    // wire basket: rails + uprights + scalloped lace panels
    const rr = 0.0045;
    for (const yy of [0.012, H * 0.72]) {
      for (const zz of [-W / 2, W / 2]) b.add(rod([-L / 2, yy, zz], [L / 2, yy, zz], rr, m.wireGold, 8));
      for (const xx of [-L / 2, L / 2]) b.add(rod([xx, yy, -W / 2], [xx, yy, W / 2], rr, m.wireGold, 8));
    }
    for (const xx of [-L / 2, L / 2]) {
      for (const zz of [-W / 2, W / 2]) b.add(rod([xx, 0, zz], [xx, H * 0.8, zz], rr, m.wireGold, 8));
    }
    for (const zz of [-W / 2, W / 2]) {
      for (const xx of [-L / 2, 0, L / 2]) b.add(rod([xx, 0, zz], [xx, H * 0.75, zz], rr, m.wireGold, 8));
    }
    // lace wrap around the four sides
    for (const zz of [-W / 2 - 0.001, W / 2 + 0.001]) {
      const lace = mesh(new THREE.PlaneGeometry(L - 0.004, H * 0.75), m.laceSleeve, 'box-lace');
      at(lace, 0, H * 0.375, zz);
      b.add(lace);
    }
    for (const xx of [-L / 2 - 0.001, L / 2 + 0.001]) {
      const lace = mesh(new THREE.PlaneGeometry(W - 0.004, H * 0.75), m.laceSleeve, 'box-lace');
      at(lace, xx, H * 0.375, 0, Math.PI / 2);
      b.add(lace);
    }
    // Open serving tray with small upright gilt loop handles, visible in photos 21/193.
    for (const sx of [-1, 1]) {
      const handle = mesh(new THREE.TorusGeometry(0.024, 0.0025, 6, 24), m.wireGold);
      handle.rotation.y = Math.PI / 2;
      at(handle, sx * L / 2, H * 0.76, 0, Math.PI / 2);
      b.add(handle);
    }
    at(b, -0.065, y, 0.090, -0.04);
    g.add(b);
  }
  return g;
}

// ------------------------------------------------------------------------------------------
// props
// ------------------------------------------------------------------------------------------
/** Glossy ceramic mushroom, 0.245 m tall (photo 21 is the reference shot). */
function mushroom(m: FireplaceMats, x: number, y: number, z: number) {
  const g = new THREE.Group();
  g.name = 'cart-mushroom';
  const stem = lathe([
    [0, 0], [0.034, 0], [0.036, 0.005], [0.033, 0.018], [0.028, 0.045], [0.028, 0.070],
    [0.034, 0.092], [0.044, 0.108], [0.050, 0.118], [0.042, 0.122], [0, 0.120],
  ], m.mushroomStem, 30);
  g.add(stem);
  const capY = 0.118;
  const cap = lathe([
    [0, 0.098], [0.018, 0.097], [0.036, 0.092], [0.054, 0.082], [0.068, 0.066],
    [0.078, 0.044], [0.083, 0.022], [0.081, 0.006], [0.070, 0.001], [0.055, 0.004], [0, 0.005],
  ], m.mushroomCap, 40);
  at(cap, 0, capY, 0);
  // a wavy rim, as the photo's cap edge undulates
  const pos = cap.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), pz = pos.getZ(i), py = pos.getY(i);
    const r = Math.hypot(px, pz);
    if (r > 0.062 && py < 0.02) {
      const a = Math.atan2(pz, px);
      const w = 1 + 0.06 * Math.sin(a * 5);
      pos.setXYZ(i, px * w, py + 0.004 * Math.sin(a * 5), pz * w);
    }
  }
  pos.needsUpdate = true;
  cap.geometry.computeVertexNormals();
  g.add(cap);
  const dark = cyl(0.050, 0.048, 0.004, m.ceramicBrown, 24);
  at(dark, 0, capY - 0.001, 0);
  g.add(dark);
  at(g, x, y, z, 0.4);
  g.scale.setScalar(0.86);
  return g;
}

/** Flat scalloped gilt butterfly, with larger forewings, smaller hindwings and raised veins (22). */
function butterfly(m: FireplaceMats, scale: number) {
  const g = new THREE.Group();
  const outline = new THREE.Shape();
  outline.moveTo(0, 0);
  outline.quadraticCurveTo(0.003, 0.015, 0.022, 0.025);
  outline.bezierCurveTo(0.036, 0.022, 0.032, 0.009, 0.014, 0.002);
  outline.bezierCurveTo(0.031, -0.004, 0.022, -0.023, 0.011, -0.017);
  outline.quadraticCurveTo(0, -0.012, 0, 0);
  const geo = new THREE.ExtrudeGeometry(outline, {
    depth: 0.0012, bevelEnabled: true, bevelSize: 0.0007, bevelThickness: 0.0005,
    bevelSegments: 2, curveSegments: 10,
  });
  geo.rotateX(-Math.PI / 2);
  for (const sx of [-1, 1]) {
    const wing = mesh(geo, m.gilt);
    wing.scale.set(sx, 1, 1);
    wing.rotation.z = sx * 0.65;
    wing.position.y = 0.004;
    g.add(wing);
    g.add(rod([0, 0.006, 0], [sx * 0.021, 0.022, -0.018], 0.0007, m.gilt, 5));
    g.add(rod([0, 0.006, 0], [sx * 0.015, 0.017, 0.013], 0.0007, m.gilt, 5));
    g.add(rod([0, 0.008, -0.013], [sx * 0.008, 0.011, -0.026], 0.0008, m.gilt, 5));
  }
  g.add(at(rbox(0.005, 0.004, 0.028, 0.001, m.gilt, 2), 0, 0.006, 0));
  g.scale.setScalar(scale);
  return g;
}

/** Frosted gilded jar with a gold lid and a gilt butterfly (photos 17/20/22). */
function goldJar(m: FireplaceMats, x: number, y: number, z: number, r: number, h: number, lidSeed: number) {
  const g = new THREE.Group();
  const body = cyl(r, r * 0.99, h, m.glassJar, 28);
  at(body, 0, h / 2, 0);
  g.add(body);
  // Frosted/crackled glass with sparse gold leaf, not the trinket box's wire filigree.
  const sleeve = mesh(new THREE.CylinderGeometry(r + 0.0012, r + 0.0012, h - 0.045, 28, 1, true), m.jarSleeve);
  at(sleeve, 0, h / 2 + 0.012, 0);
  g.add(sleeve);
  const band = cyl(r + 0.0025, r + 0.0025, 0.016, m.giltHammered, 28);
  at(band, 0, 0.022, 0);
  g.add(band);
  const footRing = cyl(r + 0.004, r + 0.004, 0.012, m.giltHammered, 28);
  at(footRing, 0, 0.006, 0);
  g.add(footRing);
  const rim = cyl(r + 0.002, r + 0.002, 0.008, m.gilt, 28);
  at(rim, 0, h - 0.004, 0);
  g.add(rim);
  // domed lid
  const dome = lathe([
    [0, 0.010], [0.018, 0.0097], [0.032, 0.0087], [0.044, 0.0063], [0.052, 0.0033], [0.054, 0.0], [0, 0],
  ], m.giltHammered, 30);
  at(dome, 0, h, 0);
  g.add(dome);
  // gilt butterfly lying on the lid (photos 17, 20, 22 — wings spread, not a stag)
  const orn = butterfly(m, 0.9 + (lidSeed % 2) * 0.25);
  at(orn, 0, h + 0.012, 0);
  orn.rotation.y = lidSeed;
  orn.rotation.x = -0.15;
  g.add(orn);
  at(g, x, y, z, lidSeed * 0.2);
  return g;
}

/** White/pale-blue hydrangea: four scalloped sepals per floret, not a ball of beads. */
function hydrangea(m: FireplaceMats, x: number, y: number, z: number, scale: number, seed: number) {
  const g = new THREE.Group();
  g.name = 'cart-hydrangea';
  const r = rng(seed);
  // Dense pale interior stops tiny gaps reading as a black, perforated ball against the firebox.
  const heart = sph(0.105 * scale, m.petalGreen, 24, 16);
  heart.scale.y = 0.75;
  at(heart, 0, 0.082 * scale, 0);
  heart.castShadow = false;
  heart.receiveShadow = false;
  g.add(heart);
  const mats: THREE.Matrix4[] = [];
  const cols: THREE.Color[] = [];
  const palette = ['#f7f6ea', '#eef2e0', '#dfeae0', '#fbfaf1', '#e7efec', '#f2f4e6'];
  const petal = new THREE.Shape();
  petal.moveTo(0, 0);
  petal.bezierCurveTo(-0.007, 0.002, -0.011, 0.010, -0.006, 0.015);
  petal.bezierCurveTo(-0.003, 0.018, -0.001, 0.015, 0, 0.016);
  petal.bezierCurveTo(0.004, 0.019, 0.010, 0.013, 0.008, 0.009);
  petal.bezierCurveTo(0.007, 0.004, 0.003, 0.001, 0, 0);
  const geo = new THREE.ShapeGeometry(petal, 5);
  const vertices = geo.getAttribute('position');
  for (let i = 0; i < vertices.count; i++) {
    vertices.setZ(i, 0.0015 * Math.pow(vertices.getY(i) / 0.018, 2));
  }
  geo.computeVertexNormals();
  const n = 320;
  for (let i = 0; i < n; i++) {
    const a = i * 2.399963 + r() * 0.20;
    const ny = 1 - 1.85 * (i + 0.5) / n;
    const nr = Math.sqrt(1 - ny * ny);
    const radius = 0.121 * scale * (0.91 + 0.09 * r()) * (1 + 0.06 * Math.sin(a * 5) * nr);
    const centre = new THREE.Vector3(Math.cos(a) * nr * radius, 0.082 * scale + ny * radius * 0.78, Math.sin(a) * nr * radius);
    const normal = new THREE.Vector3(Math.cos(a) * nr, ny, Math.sin(a) * nr).normalize();
    const face = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    const phase = r() * Math.PI * 2;
    const color = new THREE.Color(palette[Math.floor(r() * palette.length)]);
    for (let k = 0; k < 4; k++) {
      const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), phase + k * Math.PI / 2);
      const s = scale * (0.68 + r() * 0.28);
      mats.push(new THREE.Matrix4().compose(centre, face.clone().multiply(turn), new THREE.Vector3(s, s, s)));
      cols.push(color);
    }
  }
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.88, side: THREE.DoubleSide });
  const im = inst(geo, mat, mats, 'hydrangea-florets');
  // Millimetre sepals should not self-shadow into black triangles at the room's shadow-map scale.
  im.castShadow = false;
  im.receiveShadow = false;
  cols.forEach((c, i) => im.setColorAt(i, c));
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  g.add(im);
  // a few leaves poking out of the dome
  for (let i = 0; i < 2; i++) {
    const a = (i / 2) * Math.PI * 2 + 1.4;
    const lf = mesh(new THREE.PlaneGeometry(0.026 * scale, 0.011 * scale), m.leaf);
    at(lf, Math.cos(a) * 0.086 * scale, 0.020 * scale, Math.sin(a) * 0.082 * scale, a);
    lf.rotation.set(-1.5, a, 0.1);
    g.add(lf);
  }
  at(g, x, y, z);
  return g;
}
