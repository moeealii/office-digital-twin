import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { boxUV, sweep } from '../../../packages/room-runtime/helpers';
import { crescent, extrudeShape, shapeFrom } from './_prayer-geo';
import type { PrayerMats } from './_prayer-mats';

/**
 * The base chest the stand sits on (RoomPlan object 13; stand-local frame). Corners triangulated
 * on the chest top in photos 58/64/65/66/199: front at lz 0.40, lx −0.305…0.285, top 0.42.
 * The front is the rectified photo 58 (drawer with bone crescents, a scalloped bone cartouche and an
 * antique-brass bail pull), with the applied drawer moulding, crescents and pull modelled on it.
 */
export const CHEST = { x0: -0.305, x1: 0.285, z0: -0.035, z1: 0.40, top: 0.42 };

export function buildChest(m: PrayerMats): THREE.Group {
  const g = new THREE.Group();
  g.name = 'prayer-chest';
  const { x0, x1, z0, z1, top } = CHEST;
  const cxm = (x0 + x1) / 2, w = x1 - x0, d = z1 - z0;
  const box = (W: number, H: number, D: number, r: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const geo = new RoundedBoxGeometry(W, H, D, 2, r);
    boxUV(geo, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };

  // top board with a rounded overhanging edge, and a thin cove strip under it
  box(w, 0.02, d, 0.006, m.chestWood, cxm, top - 0.01, (z0 + z1) / 2);
  box(w - 0.012, 0.012, d - 0.008, 0.004, m.woodEdge, cxm, top - 0.024, (z0 + z1) / 2 - 0.002);
  // carcass
  const front = z1 - 0.008;
  box(w - 0.016, top - 0.03 - 0.055, d - 0.012, 0.003, m.chestWood, cxm, 0.055 + (top - 0.03 - 0.055) / 2, (z0 + front) / 2);
  // base moulding + recessed plinth
  box(w - 0.004, 0.03, d - 0.006, 0.006, m.chestWood, cxm, 0.04, (z0 + z1 - 0.004) / 2);
  box(w - 0.03, 0.026, d - 0.03, 0.004, m.darkWood, cxm, 0.013, (z0 + z1) / 2 - 0.01);

  // the photographed front (texture spans lx x0..x1, y 0..0.42)
  const fy0 = 0.055, fy1 = top - 0.03;
  const fx0 = x0 + 0.008, fx1 = x1 - 0.008;
  const plane = new THREE.PlaneGeometry(fx1 - fx0, fy1 - fy0);
  const uv = plane.getAttribute('uv');
  const pos = plane.getAttribute('position');
  for (let i = 0; i < uv.count; i++) {
    const lx = pos.getX(i) + (fx0 + fx1) / 2, y = pos.getY(i) + (fy0 + fy1) / 2;
    uv.setXY(i, (lx - x0) / (x1 - x0), y / 0.42);
  }
  const face = new THREE.Mesh(plane, m.drawerFace);
  face.position.set((fx0 + fx1) / 2, (fy0 + fy1) / 2, front + 0.0004);
  g.add(face);

  // applied drawer moulding (measured on the rectified front: lx −0.24…0.165, y 0.12…0.348)
  const mx0 = -0.24, mx1 = 0.165, my0 = 0.12, my1 = 0.348, mz = front + 0.0004;
  const path = [new THREE.Vector3(mx0, my0, mz), new THREE.Vector3(mx1, my0, mz), new THREE.Vector3(mx1, my1, mz), new THREE.Vector3(mx0, my1, mz)];
  const profile: [number, number][] = [[-0.002, 0], [-0.002, 0.003], [0.001, 0.0055], [0.005, 0.006], [0.009, 0.0045], [0.012, 0.0022], [0.016, 0.0008], [0.019, 0]];
  const moulding = new THREE.Mesh(sweep(profile, path, new THREE.Vector3(0, 0, 1), { closed: true }), m.chestWood);
  g.add(moulding);
  // drawer gap (thin dark line just outside the moulding)
  const gapMat = new THREE.MeshBasicMaterial({ color: '#1a0d06' });
  for (const [ax, ay, bx, by] of [[mx0 - 0.004, my0 - 0.004, mx1 + 0.004, my0 - 0.004], [mx0 - 0.004, my1 + 0.004, mx1 + 0.004, my1 + 0.004],
    [mx0 - 0.004, my0 - 0.004, mx0 - 0.004, my1 + 0.004], [mx1 + 0.004, my0 - 0.004, mx1 + 0.004, my1 + 0.004]] as const) {
    const L = Math.hypot(bx - ax, by - ay) + 0.002;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(ax === bx ? 0.0016 : L, ax === bx ? L : 0.0016), gapMat);
    line.position.set((ax + bx) / 2, (ay + by) / 2, front + 0.0008);
    g.add(line);
  }

  // bone crescents (relief over their photographed inlay) with carnelian centres — dimmer, aged
  // bone than the crest's (photo 58: they read cream-tan against the walnut)
  const bone = new THREE.MeshStandardMaterial({ color: '#cfc2a8', roughness: 0.5 });
  const stone = new THREE.MeshPhysicalMaterial({ color: '#7a2a1a', roughness: 0.3, clearcoat: 0.6 });
  for (const [cx, open] of [[-0.135, 1], [0.105, -1]] as const) {
    const cy = 0.226;
    const sh = shapeFrom(crescent([cx, cy], 0.026, 0.02, 0.011, [open, 0]));
    const c = new THREE.Mesh(extrudeShape(sh, 0.0018, 0.0006, 32), bone);
    c.position.z = front + 0.0004;
    g.add(c);
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 12, 8), stone);
    gem.scale.z = 0.5;
    gem.position.set(cx + open * 0.004, cy, front + 0.002);
    g.add(gem);
  }

  // antique-brass bail pull: back plate, two posts, the bail
  const px = -0.02, py = 0.24;
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.064, 0.03, 0.003, 2, 0.0012), m.oldBrass);
  plate.position.set(px, py + 0.004, front + 0.0018);
  g.add(plate);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.012, 8), m.oldBrass);
    post.rotation.x = Math.PI / 2;
    post.position.set(px + s * 0.026, py + 0.01, front + 0.008);
    g.add(post);
  }
  const bail = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0028, 8, 24, Math.PI), m.oldBrass);
  bail.rotation.z = Math.PI;
  bail.rotation.x = -0.35;
  bail.position.set(px, py + 0.01, front + 0.013);
  g.add(bail);

  g.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
  });
  return g;
}
