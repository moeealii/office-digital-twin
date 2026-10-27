import * as THREE from 'three';
import type { PartContext } from '../parts/types';
import { at, cable, grp, noPhys, phys, staticBody } from './_desk-west-kit';
import { dwMaterials } from './_desk-west-mats';
import { ALEX, DESK, buildAlex, buildDesk, buildGlassTable } from './_desk-west-desk';
import { buildChair } from './_desk-west-chair';
import {
  G9, YAW, buildBlueLotion, buildComb, buildDell, buildDeskMat, buildDeskSurfaceCables, buildDietCoke,
  buildEero, buildG9, buildGlassesCase, buildHub, buildKeyboard, buildLaneige, buildMacbookDock,
  buildMarker, buildMatCable, buildMonitorArm, buildPhotoFrame, buildRemote, buildSachet, buildWebcam,
} from './_desk-west-gear';
import {
  buildBlackPanel, buildCrystal, buildGundam, buildKaws, buildLavenderFigure, buildLeafVase, buildMedallion,
  buildPaperTowel, buildQuran, buildRedStand, buildSpringHex, buildTealBox, buildTealRiser, buildTurbineFan,
  toyMaterials,
} from './_desk-west-toys';
import {
  TABLE, buildBagBin, buildGoveeLamp, buildHeadphoneHook, buildPC, buildTide, buildTreadmill, buildWhiteBottle,
} from './_desk-west-side';
import {
  buildAMSOpen, buildRunningShoe, buildScratcherBox, buildScratcherOval, buildStorageBin, buildX1Carbon,
} from './_printer-corner';

/**
 * Moe's west workstation — placement-only assembler (Wes Bos pattern).
 *
 * Desk frame/top/legs live in buildDesk. Every surface / floor object is its own exported
 * buildX() returning a named THREE.Group, then placed here with at(...). Nothing on the desk
 * is baked into the desk mesh. Each placeable root is physics-tagged so knolling explodes them
 * into individual pieces (same pattern as demos/office-v2/items/desk-gear.ts).
 *
 * Inventory: data/captures/moe-office/desk-west/inv/items.txt (+ inventory.jpg).
 * Query `?dw=desk,toys,gear,side,chair` builds a subset for A/B renders.
 */
export async function build(_ctx: PartContext): Promise<THREE.Object3D> {
  const want = new URLSearchParams(globalThis.location?.search ?? '').get('dw');
  if (want === 'off') return new THREE.Group();
  const on = (k: string) => !want || want.split(',').includes(k);
  const M = dwMaterials();
  const g = grp('desk-west');
  const H = DESK.top;

  // ---------------------------------------------------------------- desk shell + ALEX (furniture only)
  if (on('desk')) {
    g.add(staticBody(buildDesk(M)));
    g.add(staticBody(at(buildAlex(M), ALEX.x, 0, ALEX.z, Math.PI)));
  }
  if (on('chair')) g.add(phys(buildChair(M), 18, 'box'));

  // ---------------------------------------------------------------- displays + work surface (each its own model)
  if (on('gear')) {
    const gear = grp('desk-gear');
    gear.add(phys(at(buildG9(M), G9.cx, 0, G9.cz, YAW), 9, 'box'));
    gear.add(phys(at(buildWebcam(M), -2.26, 1.344, 2.43, YAW), 0.2, 'box'));
    gear.add(phys(buildDell(M), 6, 'box'));
    gear.add(staticBody(buildMonitorArm(M)));
    gear.add(phys(at(buildDeskMat(M), -2.008, H, 2.076, YAW), 0.4, 'box'));
    gear.add(phys(at(buildKeyboard(M), -2.004, H + 0.0035, 2.026, YAW), 0.9, 'box'));
    gear.add(phys(at(buildDietCoke(M), -2.455, H + 0.0035, 2.062), 0.35, 'cylinder'));
    gear.add(phys(at(buildEero(M), -1.973, H, 2.457, YAW + 0.2), 0.35, 'box'));
    gear.add(phys(at(buildComb(M), -1.666, H + 0.0035, 2.052, 2.59), 0.05, 'box'));
    gear.add(noPhys(buildMatCable(M)));
    gear.add(phys(at(buildMacbookDock(M), -1.19, H, 2.26, 0.02), 1.6, 'box'));
    gear.add(phys(at(await buildPhotoFrame(M), -1.315, H, 2.276, -2.264), 0.25, 'box'));
    gear.add(phys(at(buildRemote(M), -1.386, H, 2.263, 2.74), 0.08, 'box'));
    gear.add(phys(at(buildGlassesCase(M), -1.266, H, 2.064, 2.72), 0.12, 'box'));
    gear.add(phys(at(buildMarker(M), -1.335, H + 0.002, 2.13, 2.10), 0.03, 'cylinder'));
    gear.add(phys(at(buildSachet(), -1.31, H + 0.036, 2.08, 2.4), 0.02, 'box'));
    gear.add(phys(at(buildHub(M), -1.098, H, 2.017, 0.1), 0.15, 'box'));
    gear.add(phys(at(buildBlueLotion(M), -1.192, H + 0.016, 2.067, 2.54), 0.12, 'cylinder'));
    gear.add(phys(at(buildLaneige(M), -1.16, H, 2.085, 0.6), 0.08, 'cylinder'));
    gear.add(noPhys(buildDeskSurfaceCables(M)));
    g.add(gear);
  }

  // ---------------------------------------------------------------- desk toys (west wing) — one builder each
  if (on('toys')) {
    const m = toyMaterials();
    const t = grp('desk-toys-west');
    // ?toy=kaws,fan isolates named toys (by group name substring) for lightbox renders
    const only = new URLSearchParams(globalThis.location?.search ?? '').get('toy')?.split(',');
    // KAWS: the sculpt is 0.394 m to the spike; the spike tip triangulates at y 1.162 (87/168/197,
    // misses <= 1.6 cm) = 0.342 above the desk, so 0.87. The old 1.1 made it 0.433 m tall (r9 87/168).
    { const k = at(buildKaws(m), -2.60, H, 1.56, 0.95); k.scale.setScalar(0.87); t.add(phys(k, 0.4)); } // faces the fan (photos 72/87)
    // red stand: top disc centre triangulates at (-2.437, 0.959, 1.500) (87+168, 0.3 cm) and the
    // disc reads ~44 mm radius in 87 -> 1.15x and nudged 2 cm east
    { const rs = at(buildRedStand(m), -2.45, H, 1.505, 0.6); rs.scale.setScalar(1.15); t.add(phys(rs, 0.25, 'box')); }
    // fan: cap top triangulates at (-2.521, 1.050, 1.635) (85/168/87, <= 0.1 cm) = 0.23 above the desk,
    // the drum reads R ~0.084 in 85; the model is 0.185 / R 0.07 -> 1.22x
    { const fn = at(buildTurbineFan(m), -2.515, H, 1.65, 1.5); fn.scale.setScalar(1.22); t.add(phys(fn, 0.55, 'cylinder')); }
    { const sh = at(buildSpringHex(m), -2.598, H, 1.866, 0.3); sh.scale.setScalar(1.2); t.add(phys(sh, 0.15)); }
    t.add(phys(at(buildCrystal(m), -2.628, H, 1.743, 2.0), 0.2)); // blade fan faces photos 85-87
    // hangs on a stiff red wire from the raised KAWS glove (hook = glove tip, medallion-local metres)
    t.add(phys(at(buildMedallion(m, [0.02, 0.232, 0.1]), -2.61, H, 1.66, 2.24), 0.08, 'box'));
    t.add(phys(at(buildLavenderFigure(m), -2.715, H, 1.575, 1.1), 0.15));
    t.add(phys(at(buildQuran(m), -2.705, H, 1.455, 2.02), 0.35, 'box'));
    // teal coin bank (slot on the TOP; see buildTealBox): top centre = triangulated slot centre
    // (-2.784, 1.021, 1.464), back edge runs (-2.821, 1.456) -> (-2.797, 1.501) so the front
    // faces yaw 2.06; its riser stands hidden behind the Qur'an
    t.add(phys(at(buildTealRiser(m), -2.784, H + 0.0725, 1.464, 2.06), 0.1, 'box'));
    t.add(phys(at(buildTealBox(m), -2.784, H + 0.145, 1.464, 2.06), 0.12, 'box'));
    t.add(phys(at(buildLeafVase(m), -2.645, H, 1.40, 1.3), 0.25, 'cylinder'));
    t.add(phys(at(buildBlackPanel(m), -2.765, H, 1.31, 1.45), 0.3, 'box'));
    t.add(phys(at(buildPaperTowel(m), -2.452, H, 1.333, 0.4), 0.35, 'cylinder'));
    { const gd = at(buildGundam(m), -2.11, H + 0.009, 2.37, YAW); gd.scale.setScalar(1.15); t.add(phys(gd, 0.45)); }
    if (only) for (const c of [...t.children]) if (!only.some(n => c.name.includes(n))) t.remove(c);
    g.add(t);
  }

  // ---------------------------------------------------------------- floor + east end — separate models
  if (on('side')) {
    const s = grp('desk-side');
    s.add(staticBody(at(buildGlassTable(M, TABLE.w, TABLE.d, TABLE.h), TABLE.x, 0, TABLE.z)));
    // printer corner (_printer-corner.ts): X1C flush to the loveseat arm, white bottle between it
    // and the ALEX, the open-lid AMS on top (photos 89/104/200/201; front z 2.27 from the scan)
    s.add(phys(at(buildX1Carbon(M), -0.435, TABLE.h, 2.465), 14, 'box'));
    s.add(phys(at(buildAMSOpen(M), -0.435, TABLE.h + 0.459, 2.47), 4.5, 'box'));
    s.add(phys(at(buildWhiteBottle(M), -0.615, TABLE.h, 2.5, 0.3), 0.4, 'cylinder'));
    s.add(noPhys(grp('printer-power', cable([[-0.3, TABLE.h + 0.1, 2.66], [-0.28, TABLE.h - 0.1, 2.68], [-0.27, 0.2, 2.69], [-0.26, 0.01, 2.69], [0.1, 0.01, 2.7]], M.black, 0.004))));
    { const t = at(buildTide(M), -0.56, 0, 2.52, 0.3); t.scale.setScalar(1.2); s.add(phys(t, 2.7, 'cylinder')); }
    s.add(phys(at(buildStorageBin(), -0.43, 0, 1.97), 2.5, 'box'));
    s.add(phys(at(buildPC(M), -1.70, 0, 2.46, Math.PI / 2 + 0.17), 12, 'box'));
    s.add(phys(at(buildBagBin(M), -1.27, 0, 2.42), 1.5, 'box'));
    // running shoes: heel/toe from photo 200 (toes SE toward the room) —
    // the NE shoe is the grey ASICS-style trainer, the SW one all black (photos 89/200)
    s.add(phys(at(buildRunningShoe(true, true), -0.79, 0, 2.03, -1.346), 0.35, 'box'));
    s.add(phys(at(buildRunningShoe(false), -0.843, 0, 1.86, -0.905), 0.35, 'box'));
    // cat scratchers in front of the loveseat (photo 104)
    s.add(phys(at(buildScratcherBox(), 0.37, 0, 1.64, 0.08), 0.8, 'box'));
    s.add(phys(at(buildScratcherOval(), -0.16, 0, 1.64), 0.7, 'cylinder')); // 2 cm gap to the box
    s.add(phys(at(buildGoveeLamp(M), -2.85, 0, 1.335, 1.3), 1.8, 'cylinder'));
    s.add(phys(at(buildTreadmill(M), -2.63, 0, 2.03, -0.02), 22, 'box'));
    {
      const hook = buildHeadphoneHook(M);
      const hp = hook.getObjectByName('headphones');
      if (hp) phys(hp, 0.3);
      s.add(staticBody(at(hook, -1.12, H - DESK.thickness, 1.99, 0)));
    }
    s.add(noPhys(grp('skirting-power', cable([[-1.75, 0.03, 2.68], [-1.2, 0.02, 2.7], [-0.7, 0.02, 2.7], [-0.4, 0.03, 2.69]], M.black, 0.004))));
    g.add(s);
  }

  // guard: drop any mesh whose geometry has non-finite positions
  const bad: THREE.Object3D[] = [];
  g.traverse(o => {
    const m = o as THREE.Mesh;
    const pos = m.isMesh ? (m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined) : undefined;
    if (!pos) return;
    const a = pos.array as ArrayLike<number>;
    for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) { bad.push(o); break; }
    if (Number.isNaN(o.position.x + o.position.y + o.position.z)) bad.push(o);
  });
  for (const o of bad) {
    const path: string[] = [];
    for (let p: THREE.Object3D | null = o; p; p = p.parent) path.push(p.name || p.type);
    console.error('[desk-west] non-finite geometry:', path.reverse().join(' / '), (o as THREE.Mesh).geometry?.type);
    o.parent?.remove(o);
  }
  // Area root stays untagged so knolling sees the per-object peers, not one desk-west blob.
  return g;
}
