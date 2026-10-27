import * as THREE from 'three';
import scan from '../../data/demos/moe-office.json';
import { loadTextures, materials } from '../../packages/room-runtime/materials';
import { batchStatic } from '../../packages/room-runtime/batch';
import type { BuiltRoom, RoomModule } from '../../packages/room-runtime/types';
import { buildShell, CEILING, FAN, insideRoom, onWall, POTS, WALLS } from './shell';
import type { PartContext, PartModule } from './parts/types';

/**
 * Moe's office: single-room House Capture session, 2026-10-26 01:39 UTC (iPhone 16 Pro Max).
 * The shell lives in ./shell.ts; each area is a part in ./parts/*.ts and each detailed object an
 * item in ./items/*.ts (files starting with _ are shared helpers). See BRIEF.md.
 *   ?parts=a,b     build only those parts        (parts=none → shell + items only)
 *   ?items=a,b     build only those items        ?hideItems=a   omit items (A/B against photos)
 *   ?alllights     every light, ignoring the budget
 */
const partModules = import.meta.glob<PartModule>('./parts/*.ts');
const itemModules = import.meta.glob<PartModule>('./items/*.ts');

const q = new URLSearchParams(globalThis.location?.search ?? '');
const ALL_LIGHTS = q.has('alllights');
/** debug overrides for A/B renders: ?hemi=0.5&pot=7&exp=1&ring=1 */
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);

/**
 * The shell now models the twelve recessed cans that are actually in the ceiling (they were
 * back-projected from 218 posed photos onto y = 2.438; see POTS in shell.ts). Lighting all twelve
 * doubles the rig's irradiance and blows the ceiling out, so six of them carry the light and the
 * rest are trim only. SHADOWED indexes into LIT: the desk-side can and the lounge-side one.
 */
const LIT = [0, 2, 5, 7, 8, 10];
const SHADOWED = new Set([1, 4]);

function baseLights() {
  const lights = new THREE.Group();
  lights.name = 'moe-office-lights';
  // Night capture: warm-white pots only. The white walls (not the dark floor) bounce light onto
  // the ceiling, which reads bright gray-white in 0137/0148, so the ground term stays pale.
  // The room is lit by six warm pots and the pale ceiling/wall bounce. The office-v2 rig
  // (which is the quality benchmark) runs ~0.8 hemi plus four shadowed 16 cd spots; this
  // room is smaller and the pots sit closer together, so the combined irradiance is lower.
  // Ground colour kept warm-neutral: a floor faces UP, so it samples the sky colour, not the
  // ground - cooling this to fix the floor's blue only tinted the ceiling. The floor's colour is
  // fixed at the source instead, by drawing its albedo to the measured planks (shell.ts).
  lights.add(new THREE.HemisphereLight('#f2efe9', '#cfc8bf', num('hemi', 0.55)));
  LIT.forEach((pot, i) => {
    const [x, z] = POTS[pot];
    const spot = new THREE.SpotLight('#fff1df', num('pot', 7), 0, THREE.MathUtils.degToRad(80), 1, 2);
    spot.position.set(x, CEILING - 0.02, z);
    spot.target.position.set(x, 0, z);
    if (SHADOWED.has(i)) {
      spot.castShadow = true;
      spot.shadow.mapSize.set(1024, 1024);
      spot.shadow.camera.near = 0.05;
      spot.shadow.camera.far = 5;
      spot.shadow.bias = -0.0006;
      spot.shadow.normalBias = 0.015;
    }
    lights.add(spot, spot.target);
  });
  // The fan has a modelled light kit; this PointLight stands in for it. It used to sit 0.4 m below
  // the ceiling, which is inside the cage once the drum was solved at 0.53 m dia - it leaked through
  // the blades. Keep it up inside the drum instead.
  const ring = new THREE.PointLight('#fff4e2', num('ring', 0.5), 5, 2);
  ring.position.set(FAN[0], CEILING - 0.14, FAN[1]);
  lights.add(ring);
  return lights;
}

export async function buildMoeOffice(): Promise<BuiltRoom> {
  await loadTextures();
  const m = materials();
  const group = new THREE.Group();
  group.name = 'moe-office';
  const shell = buildShell(m);
  group.add(shell.floor, shell.ceiling, ...shell.walls.map(w => w.group));
  const lights = baseLights();

  const ctx: PartContext = {
    walls: WALLS,
    onWall: (wall, obj, u, v, out = 0) => {
      onWall(obj, WALLS[wall], u, v, out);
      shell.walls[wall].group.add(obj); // hides with its wall in the dollhouse cutaway
      return obj;
    },
    attachToWall: (wall, obj) => {
      shell.walls[wall].group.add(obj);
      return obj;
    },
    materials: m,
    shell: shell.materials,
    ceiling: CEILING,
    insideRoom,
    addLight: (light) => (!ALL_LIGHTS && !light.userData.keep ? undefined : lights.add(light)),
  };

  const only = q.get('parts')?.split(',');
  const onlyItems = q.get('items')?.split(',');
  const hideItems = q.get('hideItems')?.split(',');
  const modules = [
    ...Object.entries(partModules).map(([p, l]) => [p.replace('./parts/', '').replace('.ts', ''), l, 'part'] as const),
    ...Object.entries(itemModules).map(([p, l]) => [p.replace('./items/', '').replace('.ts', ''), l, 'item'] as const),
  ];
  for (const [name, load, kind] of modules) {
    if (name === 'types' || name.startsWith('_')) continue;
    if (kind === 'part' && only && !only.includes(name)) continue;
    if (kind === 'item' && ((onlyItems && !onlyItems.includes(name)) || hideItems?.includes(name))) continue;
    try {
      const mod = await load();
      const obj = await mod.build(ctx);
      obj.name ||= name;
      group.add(obj);
    } catch (e) {
      console.error(`moe-office ${kind} "${name}" failed`, e); // one broken item shouldn't take the room down
    }
  }

  // anisotropy needs tangents; a mirror-smooth clearcoat under the spots overflows half floats
  group.traverse((o) => {
    const mm = o as THREE.Mesh;
    if (!mm.isMesh) return;
    for (const mat of Array.isArray(mm.material) ? mm.material : [mm.material]) {
      const p = mat as THREE.MeshPhysicalMaterial;
      if (p.isMeshPhysicalMaterial && p.clearcoat > 0) p.clearcoatRoughness = Math.max(0.05, p.clearcoatRoughness);
      if (p.isMeshPhysicalMaterial && p.anisotropy > 0 && !mm.geometry.getAttribute('tangent')) {
        try {
          if (mm.geometry.index && mm.geometry.getAttribute('uv') && mm.geometry.getAttribute('normal')) mm.geometry.computeTangents();
          else p.anisotropy = 0;
        } catch {
          p.anisotropy = 0;
        }
      }
    }
  });

  let optimized: ReturnType<typeof batchStatic> | undefined;
  return {
    layout: { polygon: scan.polygon, walls: scan.walls, objects: scan.objects.map(o => ({ ...o, center: [o.center[0], o.center[2]] })) },
    group,
    lights,
    walls: shell.walls,
    ceiling: [shell.ceiling],
    wallTop: CEILING,
    exposure: num('exp', 1.0),
    bloom: { strength: 0.25, radius: 0.3, threshold: 4.5 },
    render: { toneMapping: THREE.NeutralToneMapping, envSize: 512, envBounces: 2, envNeutral: true },
    optimize(opts) {
      if (!optimized && !q.has('nobatch')) optimized = batchStatic(group, [...shell.walls.map(w => w.group), shell.ceiling], { mergeDynamic: !!opts?.static });
      return optimized;
    },
    walkable: (x, z) => insideRoom(x, z, 0.25),
    camera: { orbit: [5.2, 6, 5.6], target: [0, 0.7, 0], walk: [0.2, 1.6, -0.6], walkLook: [1.6, 1.2, 2.4] },
    environment: { center: [0, 1.3, 0], intensity: 1 },
    loadReference() { return Promise.reject(new Error('Private scan is excluded from this public model')); },
    referenceAvailable: false,
    referenceKind: 'scan',
    photos: [],
  };
}

export const moeOffice: RoomModule = { id: 'moe-office', label: 'Moe’s office', build: buildMoeOffice };
