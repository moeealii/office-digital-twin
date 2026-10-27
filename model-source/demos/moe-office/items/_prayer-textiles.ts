import * as THREE from 'three';
import { rng } from './_moe-kit';
import { drapePoint, railDrape, type P3, strands } from './_prayer-geo';
import type { PrayerMats } from './_prayer-mats';
import { STAND } from './_prayer-panel';
import { bluePileTex, feltTex } from './_prayer-tex';

/**
 * The cloths on the stand's three rails (stand-local frame), measured on the frontal photo 183 and
 * the rectified views of photos 45/66:
 * - top rail (y 1.32): chocolate cloth with a grey lace panel (rectified photo 45) and a pale grey strap;
 * - middle rail (1.21): the fluffy teal-blue rug, lx −0.21…0.125, front hem at 0.56, blue pile fringe;
 * - front rail (1.10): the black/lime-green prayer rug (rectified photo 66), lx −0.13…0.105, hem at
 *   0.73, blue overcast edge + blue pile on its left side and hem, white piping on the hem and the long
 *   white cotton fringe of its end hanging down the right side.
 */
export function buildTextiles(m: PrayerMats): THREE.Group {
  const g = new THREE.Group();
  g.name = 'prayer-textiles';
  const [r1, r2, r3] = STAND.rails;
  const R = STAND.railR;

  // ---------------------------------------------------------------- top cloth + lace
  {
    const d = railDrape({ x0: -0.152, x1: 0.164, zr: r1[0], yr: r1[1], r: R + 0.003, yFront: 1.195, yBack: 1.19, folds: 3, foldAmp: 0.003, seed: 3, segX: 30, segS: 40 });
    const lace = m.textures.lace.clone();
    lace.needsUpdate = true;
    lace.repeat.set(1, d.total / (1.327 - 1.195));
    const mat = new THREE.MeshStandardMaterial({ map: lace, normalMap: m.textures.linenNor, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.92, side: THREE.DoubleSide });
    mat.name = 'prayer-lace-cloth';
    g.add(new THREE.Mesh(d.geo, mat));
    const strap = railDrape({ x0: 0.172, x1: 0.195, zr: r1[0], yr: r1[1], r: R + 0.004, yFront: 1.07, yBack: 1.14, seed: 4, segX: 2, segS: 30 });
    const strapMat = new THREE.MeshStandardMaterial({ color: '#a9aba7', roughness: 0.85, side: THREE.DoubleSide });
    g.add(new THREE.Mesh(strap.geo, strapMat));
    // the dark cloth continues behind the lace to the right end of the rail
    const felt = feltTex();
    felt.repeat.set(3, 3);
    const brown = new THREE.MeshStandardMaterial({ map: felt, roughness: 0.95, side: THREE.DoubleSide });
    const back = railDrape({ x0: -0.18, x1: 0.17, zr: r1[0], yr: r1[1], r: R + 0.0015, yFront: 1.2, yBack: 1.15, folds: 2, foldAmp: 0.002, seed: 6, segX: 20, segS: 30 });
    g.add(new THREE.Mesh(back.geo, brown));
  }

  // ---------------------------------------------------------------- blue rug
  let blueMat: THREE.Material | undefined;
  {
    const d = railDrape({ x0: -0.21, x1: 0.125, zr: r2[0], yr: r2[1], r: R + 0.006, yFront: 0.60, yBack: 0.68, tiltBack: 0.02, folds: 2.5, foldAmp: 0.006, seed: 8, segX: 34, segS: 70, flare: 0.01 });
    const pile = bluePileTex();
    pile.repeat.set(1.5, 3);
    const mat = new THREE.MeshPhysicalMaterial({
      map: pile, normalMap: m.textures.woolNor, normalScale: new THREE.Vector2(1.1, 1.1), roughness: 1,
      sheen: 0.55, sheenColor: new THREE.Color('#5fb7d8'), sheenRoughness: 0.7, side: THREE.DoubleSide,
    });
    mat.name = 'prayer-blue-pile';
    g.add(new THREE.Mesh(d.geo, mat));
    g.add(pileFringe(d.geo, d.segX, d.segS, 0, 1, 0.0, 0.03, '#1f87ad', 220, 11));
    blueMat = mat;
  }

  // ---------------------------------------------------------------- green / black prayer rug
  {
    const d = railDrape({ x0: -0.13, x1: 0.105, zr: r3[0], yr: r3[1], r: R + 0.005, yFront: 0.765, yBack: 0.84, folds: 1.5, foldAmp: 0.003, seed: 12, segX: 30, segS: 64 });
    const tex = m.textures.rug.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, d.total / d.front);
    const mat = new THREE.MeshStandardMaterial({ map: tex, normalMap: m.textures.woolNor, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.9, side: THREE.DoubleSide });
    mat.name = 'prayer-green-rug';
    const rug = new THREE.Mesh(d.geo, mat);
    rug.name = 'green-prayer-rug';
    g.add(rug);
    const sFront = d.front / d.total;
    // the rug's blue pile border: a band just behind the field, showing 22 mm down the left side and
    // under the hem (photos 64-66), fuzzed with tufts
    const border = railDrape({ x0: -0.152, x1: 0.103, zr: r3[0], yr: r3[1], r: R + 0.0038, yFront: 0.738, yBack: 0.80, folds: 1.5, foldAmp: 0.003, seed: 12, segX: 30, segS: 64 });
    g.add(new THREE.Mesh(border.geo, blueMat!));
    const bFront = border.front / border.total;
    g.add(pileFringe(border.geo, border.segX, border.segS, 0, bFront, 0, 0.011, '#1c8fb6', 420, 21, 'left'));
    g.add(pileFringe(border.geo, border.segX, border.segS, 0, 1, 0, 0.026, '#1c8fb6', 420, 22, 'hem'));
    // white piping on the hem
    const piping: P3[] = [];
    for (let i = 0; i <= 10; i++) {
      const p = drapePoint(d.geo, d.segX, d.segS, i / 10, 0.004);
      piping.push([p[0], p[1] + 0.006, p[2] + 0.003]);
    }
    g.add(new THREE.Mesh(strands([piping], 0.0024, 6), new THREE.MeshStandardMaterial({ color: '#d9dcd6', roughness: 0.6 })));
    // the end fringe: cotton cords hanging from the right edge
    g.add(endFringe(d.geo, d.segX, d.segS, sFront));
  }

  g.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
  });
  return g;
}

/** short pile tufts along the hem (or the left edge) of a drape grid */
function pileFringe(geo: THREE.BufferGeometry, segX: number, segS: number, s0: number, s1: number, _o: number, len: number,
  color: string, count: number, seed: number, mode: 'hem' | 'left' = 'hem') {
  const r = rng(seed);
  const tuft = new THREE.ConeGeometry(0.0032, len, 4, 1);
  tuft.translate(0, -len / 2, 0);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1 });
  const inst = new THREE.InstancedMesh(tuft, mat, count);
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < count; i++) {
    let p: P3;
    if (mode === 'hem') {
      p = drapePoint(geo, segX, segS, (i + r()) / count, 0);
      e.set((r() - 0.5) * 0.9, r() * 3, (r() - 0.5) * 0.9);
    } else {
      p = drapePoint(geo, segX, segS, 0, s0 + (s1 - s0) * ((i + r()) / count));
      p = [p[0] - 0.002, p[1], p[2] + 0.001];
      e.set((r() - 0.5) * 0.5, r() * 3, -Math.PI / 2 + 0.5 + (r() - 0.5) * 0.6);
    }
    q.setFromEuler(e);
    const s = 0.5 + r() * 0.9;
    mm.compose(new THREE.Vector3(...p), q, new THREE.Vector3(1, s, 1));
    inst.setMatrixAt(i, mm);
  }
  inst.instanceMatrix.needsUpdate = true;
  return inst;
}

/** the prayer rug's white fringe: cords leaving the right edge, curving down beside the rug */
function endFringe(geo: THREE.BufferGeometry, segX: number, segS: number, sFront: number) {
  const r = rng(31);
  const lines: P3[][] = [];
  const n = 560;
  for (let i = 0; i < n; i++) {
    // dense along the front drop, thinning over the fold at the rail
    const s = Math.min(0.99, Math.pow(r(), 1.1) * (sFront + 0.08));
    const p = drapePoint(geo, segX, segS, 1, s);
    const len = 0.045 + r() * 0.07 + Math.max(0, 1 - s / (sFront * 0.35)) * (0.06 + r() * 0.05);   // the hem corner's cords hang below the rug (photo 44)
    const out = 0.01 + r() * 0.035;
    const dz = (r() - 0.35) * 0.016;
    const ph = r() * 6, fq = 40 + r() * 40, amp = 0.002 + r() * 0.003;
    const pts: P3[] = [[p[0] - 0.002, p[1], p[2]]];
    for (let k = 1; k <= 6; k++) {
      const t = k / 6;
      const bend = Math.sin(Math.min(1, t * 1.8) * Math.PI / 2);
      pts.push([
        p[0] + 0.006 + out * bend + Math.sin(t * fq * 0.1 + ph) * amp,
        p[1] - len * t * t * 0.9 - 0.004 * t,
        p[2] + dz * t + Math.cos(t * fq * 0.1 + ph) * amp,
      ]);
    }
    lines.push(pts);
  }
  const mat = new THREE.MeshStandardMaterial({ color: '#e2dbc9', roughness: 0.95 });
  mat.name = 'prayer-cotton-fringe';
  const g = new THREE.Group();
  g.add(new THREE.Mesh(strands(lines, 0.0014, 3), mat));
  // fluffy body: three alpha-cut strand cards along the edge fill the gaps between the cords
  const card = fringeCardTex();
  const cardMat = new THREE.MeshStandardMaterial({ map: card, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 1, color: '#efe9da' });
  for (let layer = 0; layer < 3; layer++) {
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const N = 24;
    const out = 0.045 + layer * 0.008, drop = 0.07 + layer * 0.012;
    for (let i = 0; i <= N; i++) {
      const s = (i / N) * (sFront + 0.06);
      const p = drapePoint(geo, segX, segS, 1, Math.min(0.99, s));
      const dz = (layer - 1) * 0.004;
      pos.push(p[0] - 0.001, p[1], p[2] + dz, p[0] + out, p[1] - drop, p[2] + dz * 2.5);
      uv.push(i / N * 3, 1, i / N * 3, 0);
      if (i > 0) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    cg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    cg.setIndex(idx);
    cg.computeVertexNormals();
    g.add(new THREE.Mesh(cg, cardMat));
  }
  return g;
}

/** white cotton cords on transparent background, for the fringe cards */
function fringeCardTex() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const c = cv.getContext('2d')!;
  const r = rng(77);
  c.clearRect(0, 0, cv.width, cv.height);
  c.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    const x0 = r() * cv.width;
    const len = cv.height * (0.6 + r() * 0.4);
    c.strokeStyle = r() < 0.7 ? '#f4efe3' : '#c9c0ac';
    c.lineWidth = 2 + r() * 2.5;
    c.beginPath();
    c.moveTo(x0, 0);
    c.bezierCurveTo(x0 + (r() - 0.5) * 30, len * 0.3, x0 + (r() - 0.5) * 40, len * 0.6, x0 + (r() - 0.5) * 50, len);
    c.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
