import * as THREE from 'three';
import type { DwMats } from './_desk-west-mats';
import {
  at, box, cable, canvasTex, cyl, grp, instanced, lathe, mat4, mesh, photoTex, rbox, rboxGeo, rod, sphere, tube, v3,
  type V2, type V3,
} from './_desk-west-kit';
import { DESK } from './_desk-west-desk';

/**
 * Everything on the work surface: the two displays, the arm, keyboard, mat, router, laptop dock,
 * photo frame and the small things at the east end.
 *
 * THE WORKSTATION IS DIAGONAL. The G9's corners triangulate (3 photos each, miss <= 1.6 cm) to
 * west end (-2.70, 0.98..1.35, 2.00) and east end (-1.615, 0.99..1.35, 2.53): a 1.207 m chord facing
 * (0.44, -0.90), i.e. turned ~26 deg toward the room from the window wall. The keyboard's front
 * corners (-2.191,1.858) / (-1.755,2.059) are 0.48 m apart (G915 = 475 mm) on the same bearing.
 * "Natural frame" objects below are built with x = user's right, +z = toward the user, then turned
 * by YAW (local +z -> (0.42, 0, -0.91)).
 */
export const YAW = 2.70;
const H = 0.82;

/** Samsung Odyssey OLED G9 (G95SC): 1194.8 x 360.2 mm, 1800R, silver back, thin silver-white lower lip */
export const G9 = { w: 1.195, h: 0.362, R: 1.8, bottom: 0.982, cx: -2.201, cz: 2.355 };

/** bend a plate around a vertical axis, concave toward +z (edges come toward the viewer) */
function bendZ(geo: THREE.BufferGeometry, R: number) {
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const a = x / R;
    const r = R - z;
    p.setXYZ(i, Math.sin(a) * r, p.getY(i), R - Math.cos(a) * r);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function rrShape(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const a = w / 2, b = h / 2;
  s.moveTo(-a + r, -b); s.lineTo(a - r, -b); s.quadraticCurveTo(a, -b, a, -b + r);
  s.lineTo(a, b - r); s.quadraticCurveTo(a, b, a - r, b); s.lineTo(-a + r, b);
  s.quadraticCurveTo(-a, b, -a, b - r); s.lineTo(-a, -b + r); s.quadraticCurveTo(-a, -b, -a + r, -b);
  return s;
}

/** a thin rounded plate in x/y, thickness along z (0..t), finely segmented in x so it bends cleanly */
function plate(w: number, h: number, t: number, r: number, segX = 64) {
  const g = new THREE.ExtrudeGeometry(rrShape(w, h, r), { depth: t, bevelEnabled: false, curveSegments: 6 });
  // re-tessellate along x by subdividing: Extrude only has outline vertices, so bend a Box instead
  // when the plate is wide. (Kept for the small panels.)
  if (segX <= 0) return g;
  g.dispose();
  const b = new THREE.BoxGeometry(w, h, t, segX, 1, 1);
  b.translate(0, 0, t / 2);
  return b;
}

/** screen texture: black OLED glass with a faint sheen and a hairline active-area edge */
function screenTex(w: number, h: number, chinFrac: number, logo?: string) {
  return canvasTex(1024, Math.round((1024 * h) / w), (c, cw, ch) => {
    const g = c.createLinearGradient(0, 0, cw, ch);
    g.addColorStop(0, '#171923'); g.addColorStop(0.5, '#10121a'); g.addColorStop(1, '#151820');
    c.fillStyle = g; c.fillRect(0, 0, cw, ch);
    const s = c.createLinearGradient(0, 0, 0, ch);
    s.addColorStop(0, 'rgba(140,150,165,0.06)'); s.addColorStop(0.5, 'rgba(0,0,0,0)');
    c.fillStyle = s; c.fillRect(0, 0, cw, ch);
    // Photos 83/166/197: a cool, broad reflection of the pale desktop in the lower glass.
    // Keep it soft and low-contrast; it is an off display, not a lit grey screen.
    for (let x = 0; x < cw; x++) {
      const nx = (x / cw - 0.5) * 2;
      const cy = ch * (0.82 + 0.10 * nx * nx);
      const band = c.createLinearGradient(0, cy - ch * 0.09, 0, cy + ch * 0.09);
      band.addColorStop(0, 'rgba(95,110,137,0)');
      band.addColorStop(0.5, 'rgba(95,110,137,0.15)');
      band.addColorStop(1, 'rgba(95,110,137,0)');
      c.fillStyle = band; c.fillRect(x, cy - ch * 0.09, 1, ch * 0.18);
    }
    c.strokeStyle = 'rgba(70,74,82,0.6)'; c.lineWidth = 2;
    c.strokeRect(3, 3, cw - 6, ch * (1 - chinFrac) - 4);
    if (chinFrac > 0) {
      c.fillStyle = '#121316'; c.fillRect(0, ch * (1 - chinFrac), cw, ch * chinFrac);
      if (logo) {
        c.fillStyle = '#7b7f86'; c.font = `bold ${Math.round(ch * chinFrac * 0.55)}px sans-serif`; c.textAlign = 'center';
        c.fillText(logo, cw / 2, ch - ch * chinFrac * 0.25);
      }
    }
  });
}

export function buildG9(M: DwMats): THREE.Group {
  const g = grp('odyssey-oled-g9');
  const { w, h, R } = G9;
  const face = grp('g9-panel');
  // panel body: 8 mm thick silver shell, bent 1800R
  const shell = mesh(bendZ(plate(w, h, 0.008, 0.004), R), M.alu, 'g9-shell');
  shell.position.z = -0.008;
  // (bendZ bends around a centre R in front, so offsetting z first keeps the shell behind the glass)
  const sg = shell.geometry;
  sg.translate(0, 0, 0);
  face.add(shell);
  // glass face: black, UVs 0..1 across the plate
  const fg = plate(w - 0.002, h - 0.004, 0.0015, 0.003);
  const uv = fg.getAttribute('uv');
  const pp = fg.getAttribute('position');
  for (let i = 0; i < pp.count; i++) uv.setXY(i, pp.getX(i) / (w - 0.002) + 0.5, pp.getY(i) / (h - 0.004) + 0.5);
  const scr = new THREE.MeshPhysicalMaterial({ map: screenTex(w, h, 0), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0 });
  scr.name = 'dw-g9-screen';
  const glass = mesh(bendZ(fg, R), scr, 'g9-glass');
  glass.position.y = 0.002;
  face.add(glass);
  // the thin silver-white lower lip (photos 82/197 show a bright line under the black)
  const lip = mesh(bendZ(plate(w - 0.01, 0.004, 0.006, 0.001), R), new THREE.MeshStandardMaterial({ color: '#d9dadb', roughness: 0.3, metalness: 0.7 }), 'g9-lip');
  lip.position.set(0, -h / 2 - 0.001, -0.004);
  face.add(lip);
  // rear housing: the slim panel thickens into a central silver bulge with the stand mount
  const bulge = rbox(0.62, 0.24, 0.05, 0.022, M.alu, 4);
  bulge.position.set(0, -0.02, -0.035);
  face.add(bulge);
  const bulge2 = rbox(0.9, 0.29, 0.024, 0.012, M.alu, 3);
  bulge2.position.set(0, -0.01, -0.02);
  face.add(bulge2);
  face.add(at(rbox(0.12, 0.012, 0.004, 0.002, M.darkPlastic, 1), 0, -0.12, -0.061));
  face.position.set(0, G9.bottom + h / 2, 0);
  g.add(face);

  // stand: grey aluminium plate (0.34 x 0.20), black column rising from its back to the bulge,
  // black rounded cable boot at the column foot (photo 82 crop)
  const st = grp('g9-stand');
  const pl = new THREE.Shape();
  pl.moveTo(-0.17, 0.0); pl.lineTo(0.17, 0.0); pl.quadraticCurveTo(0.175, 0.0, 0.172, -0.01);
  pl.lineTo(0.15, -0.2); pl.lineTo(-0.15, -0.2); pl.lineTo(-0.172, -0.01); pl.quadraticCurveTo(-0.175, 0.0, -0.17, 0.0);
  const plGeo = new THREE.ExtrudeGeometry(pl, { depth: 0.006, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.0015, bevelSegments: 2 });
  // -90 degrees maps the negative shape-y toward local +z (the user). +90 had put the
  // entire plate behind the monitor, unlike the exposed silver plate in 83/166/197.
  plGeo.rotateX(-Math.PI / 2);
  const plm = mesh(plGeo, new THREE.MeshStandardMaterial({ color: '#b3b5b8', roughness: 0.42, metalness: 0.35 }), 'g9-plate');
  plm.position.set(0, H + 0.0015, -0.09);
  // plate local: extrusion rises from the desktop; shape y (0..-0.2) maps to z (0..+0.2)
  st.add(plm);
  st.add(at(rbox(0.07, G9.bottom + 0.12 - H, 0.045, 0.01, M.blackMetal, 2), 0, H + (G9.bottom + 0.12 - H) / 2, -0.1));
  st.add(at(rbox(0.11, 0.05, 0.08, 0.022, M.black, 3), 0.01, H + 0.03, -0.095));
  st.add(at(rbox(0.085, 0.035, 0.065, 0.016, M.black, 3), 0.0, H + 0.07, -0.098));
  st.add(at(rbox(0.12, 0.08, 0.05, 0.01, M.blackMetal, 2), 0, G9.bottom + 0.15, -0.075));
  g.add(st);

  // webcam is a separate builder (buildWebcam) placed on the G9 top edge by desk-west.ts
  return g;
}

/** MX Brio / Insta360-Link-style square webcam on a clip (photos 82: on G9 top) */
export function buildWebcam(M: DwMats): THREE.Group {
  const g = grp('webcam-mx-brio');
  g.add(at(rbox(0.05, 0.05, 0.045, 0.012, M.darkAlu, 3), 0, 0.03, 0.008));
  g.add(at(cyl(0.016, 0.016, 0.004, M.blackGloss, 20), 0, 0.03, 0.032).rotateX(Math.PI / 2));
  g.add(at(cyl(0.009, 0.009, 0.004, M.glassBlack, 16), 0, 0.03, 0.034).rotateX(Math.PI / 2));
  g.add(at(rbox(0.04, 0.012, 0.03, 0.004, M.black, 2), 0, 0.0, 0.0));
  g.add(at(rbox(0.04, 0.05, 0.008, 0.003, M.black, 2), 0, -0.02, -0.03));
  return g;
}

/**
 * Dell 27" curved on a black gas-spring arm (photos 89/200/91). Top corners triangulated
 * (-1.171,1.431,1.926) and (-1.570,1.433,2.368); the panel faces SW and tips forward ~10 deg
 * (orthogonalised from the third corner). Arm base puck at (-1.12, 2.35) (photos 200/91), elbow
 * (-1.04, 1.17, 2.57) (triangulated, 3.5 cm miss).
 */
export function buildDell(M: DwMats): THREE.Group {
  /** Dell 27" curved panel only — arm is buildMonitorArm (placed separately). */
  const g = grp('dell-curved');
  const w = 0.612, h = 0.385, R = 1.5;
  const u = v3(-0.67, 0.003, 0.742).normalize();
  const up = v3(-0.128, 0.984, -0.122).normalize();
  const n = new THREE.Vector3().crossVectors(u, up).normalize();
  const TL = v3(-1.171, 1.431, 1.926);
  const C = TL.clone().addScaledVector(u, w / 2).addScaledVector(up, -h / 2);
  const panel = grp('dell-panel');
  const shell = mesh(bendZ(plate(w, h, 0.014, 0.006), R), M.darkPlastic, 'dell-shell');
  shell.position.z = -0.014;
  panel.add(shell);
  const fg = plate(w - 0.002, h - 0.002, 0.0015, 0.003);
  const uv = fg.getAttribute('uv'); const pp = fg.getAttribute('position');
  for (let i = 0; i < pp.count; i++) uv.setXY(i, pp.getX(i) / (w - 0.002) + 0.5, pp.getY(i) / (h - 0.002) + 0.5);
  const scr = new THREE.MeshPhysicalMaterial({ map: screenTex(w, h, 0.05, 'DELL'), roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.08 });
  scr.name = 'dw-dell-screen';
  panel.add(mesh(bendZ(fg, R), scr, 'dell-glass'));
  panel.add(at(rbox(0.26, 0.2, 0.03, 0.02, M.darkPlastic, 3), 0, 0.0, -0.028));
  panel.add(at(rbox(0.1, 0.1, 0.012, 0.004, M.blackMetal, 2), 0, 0.0, -0.048));
  const basis = new THREE.Matrix4().makeBasis(u, up, n);
  panel.quaternion.setFromRotationMatrix(basis);
  panel.position.copy(C);
  g.add(panel);
  return g;
}

/**
 * Black gas-spring monitor arm + base puck (photos 89/200/91). Base at (-1.12, 2.35),
 * elbow (-1.04, 1.17, 2.57). Own placeable group — not fused into the Dell panel.
 */
export function buildMonitorArm(M: DwMats): THREE.Group {
  const g = grp('monitor-arm');
  const w = 0.612, h = 0.385;
  const u = v3(-0.67, 0.003, 0.742).normalize();
  const up = v3(-0.128, 0.984, -0.122).normalize();
  const n = new THREE.Vector3().crossVectors(u, up).normalize();
  const TL = v3(-1.171, 1.431, 1.926);
  const C = TL.clone().addScaledVector(u, w / 2).addScaledVector(up, -h / 2);
  const base = v3(-1.12, H, 2.35);
  const elbow = v3(-1.04, 1.17, 2.57);
  const head = C.clone().addScaledVector(n, -0.07);
  const poleTop = v3(-1.12, 0.98, 2.35);
  g.add(at(cyl(0.065, 0.07, 0.016, M.blackMetal, 28), base.x, H + 0.008, base.z));
  g.add(at(cyl(0.017, 0.017, poleTop.y - H, M.blackMetal, 16), base.x, (H + poleTop.y) / 2, base.z));
  g.add(at(rbox(0.05, 0.05, 0.05, 0.012, M.blackMetal, 2), poleTop.x, poleTop.y, poleTop.z));
  const link = (a: THREE.Vector3, b: THREE.Vector3, wd: number, ht: number) => {
    const L = a.distanceTo(b);
    const m = rbox(wd, ht, L, Math.min(wd, ht) * 0.3, M.blackMetal, 2);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.lookAt(b.clone().add(m.position).sub(a));
    return m;
  };
  const lowerA = poleTop.clone().add(v3(0, 0.02, 0));
  g.add(link(lowerA, elbow, 0.05, 0.04));
  g.add(at(rbox(0.06, 0.06, 0.06, 0.015, M.blackMetal, 2), elbow.x, elbow.y, elbow.z));
  const upperB = head.clone().add(v3(0, 0.02, 0)).addScaledVector(n, -0.04);
  g.add(link(elbow.clone().add(v3(0, 0.03, 0)), upperB, 0.055, 0.045));
  g.add(link(upperB, head, 0.04, 0.04));
  g.add(at(rbox(0.05, 0.07, 0.05, 0.012, M.blackMetal, 2), head.x, head.y, head.z));
  g.add(cable([[head.x, head.y - 0.03, head.z], [elbow.x - 0.02, elbow.y - 0.05, elbow.z - 0.02], [-1.08, 0.95, 2.48], [-1.1, H + 0.004, 2.5], [-1.2, H + 0.004, 2.62], [-1.25, H - 0.05, 2.7]], M.black, 0.0035));
  return g;
}


export function buildKeyboard(M: DwMats) {
  const g = grp('g915-keyboard');
  const W = 0.475, D = 0.150;
  // base: wedge 14 mm at the front rising to 22 mm at the back, aluminium plate on top
  const base = new THREE.BoxGeometry(W, 0.014, D, 1, 1, 2);
  const p = base.getAttribute('position');
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setY(i, p.getY(i) + (0.5 - p.getZ(i) / D) * 0.006);
  p.needsUpdate = true; base.computeVertexNormals();
  g.add(at(mesh(base, M.black, 'kb-base'), 0, 0.007, 0));
  g.add(at(rbox(W - 0.002, 0.0025, D - 0.002, 0.0015, new THREE.MeshStandardMaterial({ color: '#9ba2a9', roughness: 0.48, metalness: 0.45 }), 1), 0, 0.0155, 0).rotateX(-0.04));
  // key layout in units (19.05 mm); rows from the F-row (back, -z) to the space row (front)
  const U = 0.01905;
  const rows: { z: number; keys: [number, number][] }[] = [];
  const row = (z: number, spec: (number | string)[]) => {
    let x = 0; const keys: [number, number][] = [];
    for (const s of spec) {
      if (typeof s === 'string') { x += parseFloat(s); continue; }
      keys.push([x, s]); x += s;
    }
    rows.push({ z, keys });
  };
  const nav = ['0.25', 1, 1, 1, '0.25'];
  row(-2.6, [1, '1', 1, 1, 1, 1, '0.5', 1, 1, 1, 1, '0.5', 1, 1, 1, 1, '0.25', 1, 1, 1]);
  row(-1.3, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, ...nav, 1, 1, 1, 1]);
  row(-0.3, [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, ...nav, 1, 1, 1]);
  row(0.7, [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25, '3.5', 1, 1, 1]);
  row(1.7, [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75, '1.25', 1, '1.25', 1, 1, 1]);
  row(2.7, [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25, '0.25', 1, 1, 1, '0.25', 2, 1]);
  const mats: THREE.Matrix4[] = [];
  const x0 = -0.2; // left edge of the main block (G-keys column sits further left)
  for (const r of rows) for (const [x, wu] of r.keys) {
    const cx = x0 + (x + wu / 2) * U, cz = r.z * U + 0.012;
    mats.push(mat4(cx, 0.0195 + (-cz) * 0.04, cz, 0, 0, 0, (wu * U - 0.0035) / 0.0155, 1, 1));
  }
  // tall numpad + and Enter
  for (const zz of [-0.8, 1.2]) mats.push(mat4(x0 + 21.75 * U, 0.0195, zz * U + 0.012, 0, 0, 0, 1, 1, (2 * U - 0.0035) / 0.0155));
  // G1-G5 macro column on the far left
  for (let i = 0; i < 5; i++) mats.push(mat4(x0 - 0.75 * U, 0.0195, (-1.3 + i) * U + 0.012, 0, 0, 0, 1, 1, 1));
  const capGeo = rboxGeo(0.0155, 0.0045, 0.0155, 0.0018, 2);
  const capMat = new THREE.MeshStandardMaterial({ color: '#141518', roughness: 0.55, metalness: 0.05 });
  g.add(instanced(capGeo, capMat, mats, 'kb-caps'));
  // the top strip: G logo, 5 round function buttons, media keys + volume roller over the numpad
  const logoTex = canvasTex(64, 64, (c, s) => { c.fillStyle = '#3c4048'; c.fillRect(0, 0, s, s); c.strokeStyle = '#d8dce2'; c.lineWidth = 6; c.beginPath(); c.arc(32, 32, 18, 0.4, Math.PI * 1.8); c.lineTo(32, 32); c.stroke(); });
  const logo = mesh(new THREE.PlaneGeometry(0.012, 0.012), new THREE.MeshStandardMaterial({ map: logoTex, roughness: 0.5 }), 'kb-logo');
  logo.rotation.x = -Math.PI / 2; logo.position.set(x0 + 0.002, 0.0205, -0.064);
  g.add(logo);
  for (let i = 0; i < 5; i++) g.add(at(cyl(0.0042, 0.0042, 0.003, M.black, 12), x0 + 0.03 + i * 0.02, 0.0195, -0.066));
  for (let i = 0; i < 4; i++) g.add(at(cyl(0.0042, 0.0042, 0.003, M.black, 12), x0 + 0.345 + i * 0.019, 0.0195, -0.066));
  const roller = cyl(0.007, 0.007, 0.03, M.darkAlu, 18);
  roller.rotation.z = Math.PI / 2; roller.position.set(x0 + 0.425, 0.022, -0.065);
  g.add(roller);
  g.add(at(rbox(0.004, 0.002, 0.002, 0.0008, M.led, 1), x0 + 0.29, 0.0205, -0.052));
  return g;
}

/** SteelSeries QcK XXL: 900 x 400 x 4 mm black cloth, logo at the front-right corner */
export function buildDeskMat(M: DwMats) {
  const g = grp('qck-xxl');
  const w = 0.9, d = 0.4;
  const s = rrShape(w, d, 0.018);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.0028, bevelEnabled: true, bevelSize: 0.0008, bevelThickness: 0.0006, bevelSegments: 1, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position'); const uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) * 3, pos.getZ(i) * 3);
  g.add(mesh(geo, M.cloth, 'mat-cloth'));
  const logo = canvasTex(256, 256, (c, S) => {
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(236,236,236,0.95)'; c.strokeStyle = 'rgba(236,236,236,0.95)';
    // SteelSeries mark: a ring with a dot, three short "steam" ticks on top-left
    c.lineWidth = S * 0.075; c.beginPath(); c.arc(S * 0.55, S * 0.55, S * 0.25, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(S * 0.55, S * 0.55, S * 0.1, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI * 0.95 + i * 0.22;
      c.beginPath(); c.arc(S * 0.55 + Math.cos(a) * S * 0.36, S * 0.55 + Math.sin(a) * S * 0.36, S * 0.045, 0, Math.PI * 2); c.fill();
    }
  });
  const dec = mesh(new THREE.PlaneGeometry(0.05, 0.05), new THREE.MeshStandardMaterial({ map: logo, transparent: true, roughness: 0.8, depthWrite: false }), 'mat-logo');
  dec.rotation.x = -Math.PI / 2;
  dec.position.set(w / 2 - 0.06, 0.0045, d / 2 - 0.055);
  g.add(dec);
  return g;
}

/** eero 6: 99 x 97 x 62 mm white rounded block, LED on the front, logo on top */
export function buildEero(M: DwMats) {
  // eero 6: 99.4 x 97.9 x 62.5 mm. A squircle in plan (superellipse n≈3.2, sides gently bowed),
  // a big rounded shoulder into a slightly domed top, a small radius at the foot, satin white;
  // pale embossed "eero" on the top, a pin-prick white status LED on the front face (photo 82).
  const g = grp('eero-6');
  const A = 0.0497, B = 0.049, H = 0.0625, rT = 0.02, rB = 0.004, n = 3.2;
  const NA = 96, NP = 24;
  const prof: [number, number][] = []; // (inset, y) around the side profile, bottom to top centre
  for (let k = 0; k <= 4; k++) { const a = (k / 4) * (Math.PI / 2); prof.push([rB - rB * Math.sin(a), rB - rB * Math.cos(a)]); }
  for (let k = 0; k <= NP; k++) { const a = (k / NP) * (Math.PI / 2); prof.push([rT - rT * Math.cos(a), H - rT + rT * Math.sin(a)]); }
  const pos: number[] = [];
  const nr = prof.length;
  for (let i = 0; i <= NA; i++) {
    const t = (i / NA) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t);
    const ex = Math.sign(c) * Math.abs(c) ** (2 / n), ez = Math.sign(sn) * Math.abs(sn) ** (2 / n);
    for (const [ins, y] of prof) {
      const k = 1 - ins / A;
      // the top is domed 1.5 mm toward the centre
      const dome = y >= H - 0.0001 ? 0.0015 : 0;
      pos.push(ex * A * k, y + dome * (1 - k), ez * B * k);
    }
  }
  // close the top and bottom with centre fans
  const top = pos.length / 3; pos.push(0, H + 0.0015, 0);
  const bot = top + 1; pos.push(0, 0, 0);
  const idx: number[] = [];
  for (let i = 0; i < NA; i++) for (let k = 0; k < nr - 1; k++) {
    const a = i * nr + k, b = a + 1, c = a + nr, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  for (let i = 0; i < NA; i++) { idx.push(i * nr + nr - 1, top, (i + 1) * nr + nr - 1); idx.push(i * nr, (i + 1) * nr, bot); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const shell = new THREE.MeshPhysicalMaterial({ color: '#f2f2ef', roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.4, name: 'eero-white' });
  g.add(mesh(geo, shell, 'eero-shell'));
  // embossed wordmark on the top: a pale-grey decal just above the dome
  const t = canvasTex(256, 96, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(150,150,146,0.75)'; c.font = '600 54px sans-serif'; c.textAlign = 'center'; c.fillText('eero', w / 2, 66); });
  const lab = mesh(new THREE.PlaneGeometry(0.03, 0.0112), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }), 'eero-logo');
  lab.rotation.x = -Math.PI / 2; lab.position.set(0, H + 0.0016, 0);
  g.add(lab);
  // status LED: a tiny white dot on the front face, a third of the way up
  const led = mesh(new THREE.CircleGeometry(0.0013, 12), new THREE.MeshBasicMaterial({ color: '#f4f8ff' }), 'eero-led');
  led.position.set(0, 0.024, B + 0.0002);
  g.add(led);
  return g;
}

/** Diet Coke 355 mL can: 66 x 122 mm, silver with the red vertical logo */
export function buildDietCoke(M: DwMats) {
  const g = grp('diet-coke');
  const label = canvasTex(512, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#c7c9cb'); gr.addColorStop(0.5, '#eef0f1'); gr.addColorStop(1, '#bfc1c3');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.save(); c.translate(w * 0.5, h * 0.52); c.rotate(-Math.PI / 2);
    c.fillStyle = '#c4161c'; c.font = 'italic bold 66px serif'; c.textAlign = 'center'; c.fillText('Coke', 0, -40);
    c.fillStyle = '#1b1b1b'; c.font = 'bold 34px sans-serif'; c.fillText('diet', 0, 10);
    c.restore();
    c.fillStyle = '#c4161c'; c.fillRect(w * 0.6, h * 0.1, w * 0.02, h * 0.8);
  });
  const mat = new THREE.MeshStandardMaterial({ map: label, roughness: 0.25, metalness: 0.75 });
  g.add(lathe([[0, 0], [0.025, 0], [0.031, 0.006], [0.033, 0.012], [0.033, 0.106], [0.029, 0.116], [0.0265, 0.122], [0, 0.122]] as V2[], M.canSilver, 32));
  const band = cyl(0.0332, 0.0332, 0.092, mat, 32, true);
  band.position.y = 0.059;
  g.add(band);
  g.add(at(cyl(0.024, 0.024, 0.002, M.steel, 24), 0, 0.1215, 0));
  g.add(at(rbox(0.016, 0.0015, 0.024, 0.005, M.steel, 1), 0.006, 0.1235, 0));
  return g;
}

/** MacBook Pro 14 standing closed in a black vertical dock: 312 x 221 x 15.5 mm */
export function buildMacbookDock(M: DwMats) {
  const g = grp('macbook-dock');
  g.add(at(rbox(0.06, 0.03, 0.2, 0.012, M.black, 3), 0, 0.015, 0));
  g.add(at(rbox(0.0155, 0.221, 0.312, 0.006, M.alu, 3), 0, 0.02 + 0.1105, 0));
  g.add(at(rbox(0.002, 0.004, 0.004, 0.001, M.led, 1), -0.008, 0.2, -0.15));
  g.add(cable([[-0.008, 0.2, -0.155], [-0.02, 0.21, -0.18], [-0.04, 0.1, -0.22], [-0.05, 0.0, -0.24]], M.plastic, 0.0022));
  return g;
}

/** 10" digital photo frame with the actual safe public Home HQ renderer */
export async function buildPhotoFrame(M: DwMats) {
  const g = grp('photo-frame');
  const W = 0.262, Hh = 0.178;
  const body = grp('frame-body');
  body.add(at(rbox(W, Hh, 0.016, 0.005, M.black, 2), 0, Hh / 2, 0));
  const tex = await new THREE.TextureLoader().loadAsync('/frame-demo-poster.jpg');
  const scr = new THREE.MeshStandardMaterial({ map: tex, color: tex ? '#ffffff' : '#334', roughness: 0.3, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: tex ? 0.55 : 0 });
  const s = mesh(new THREE.PlaneGeometry(W - 0.03, Hh - 0.028), scr, 'frame-screen');
  s.position.set(0, Hh / 2 + 0.002, 0.0082);
  body.add(s);
  body.rotation.x = -0.26;
  g.add(body);
  g.add(rod([0, 0.05, -0.01], [0, 0.0, -0.06], 0.004, M.black));
  return g;
}

/** a small black TV-box remote */
export function buildRemote(M: DwMats) {
  const g = grp('remote');
  g.add(at(rbox(0.04, 0.016, 0.155, 0.007, M.black, 3), 0, 0.008, 0));
  for (let i = 0; i < 4; i++) g.add(at(rbox(0.012, 0.003, 0.009, 0.0015, M.darkPlastic, 1), (i % 2 ? 0.008 : -0.008), 0.0165, -0.05 + Math.floor(i / 2) * 0.014));
  g.add(at(cyl(0.008, 0.008, 0.003, M.darkPlastic, 16), 0, 0.0165, -0.022));
  return g;
}

/** navy hard glasses case with a gold crest */
export function buildGlassesCase(M: DwMats) {
  const g = grp('glasses-case');
  const navy = new THREE.MeshStandardMaterial({ color: '#141a2c', roughness: 0.55 });
  const geo = new THREE.SphereGeometry(1, 24, 12);
  geo.scale(0.034, 0.018, 0.078);
  const m = mesh(geo, navy); m.position.y = 0.017; m.scale.set(1, 1, 1);
  g.add(m);
  g.add(at(box(0.06, 0.003, 0.15, navy), 0, 0.002, 0));
  const crest = canvasTex(128, 128, (c, S) => { c.fillStyle = '#0d0f17'; c.fillRect(0, 0, S, S); c.strokeStyle = '#c9a34a'; c.lineWidth = 8; c.beginPath(); c.arc(64, 64, 52, 0, 7); c.stroke(); c.lineWidth = 3; c.beginPath(); c.arc(64, 64, 36, 0, 7); c.stroke(); c.fillStyle = '#c9a34a'; c.font = 'bold 34px serif'; c.textAlign = 'center'; c.fillText('R', 64, 76); });
  const cm = mesh(new THREE.CircleGeometry(0.014, 24), new THREE.MeshStandardMaterial({ map: crest, roughness: 0.3, metalness: 0.5 }), 'case-crest');
  cm.rotation.x = -Math.PI / 2; cm.position.set(0, 0.0352, 0.042);
  g.add(cm);
  return g;
}

/** a squeeze tube (cap end at local -y when standing): body flattens toward the crimp */
export function buildTube(len: number, r: number, body: THREE.Material, cap: THREE.Material, label?: THREE.Texture) {
  const g = grp('tube');
  const geo = new THREE.CylinderGeometry(r, r, len, 24, 8, true);
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const y = THREE.MathUtils.clamp(p.getY(i) / len + 0.5, 0, 1); // 0 bottom (cap) .. 1 top (crimp)
    const f = Math.max(0.08, 1 - Math.pow(y, 2.2));
    p.setX(i, p.getX(i) * (1 + (1 - f) * 0.35));
    p.setZ(i, p.getZ(i) * f);
  }
  p.needsUpdate = true; geo.computeVertexNormals();
  const mat = label ? (body as THREE.MeshStandardMaterial).clone() : body;
  if (label) (mat as THREE.MeshStandardMaterial).map = label;
  const bm = mesh(geo, mat); bm.position.y = len / 2 + 0.02;
  g.add(bm);
  g.add(at(rbox(r * 2.7, 0.006, 0.006, 0.002, body, 1), 0, len + 0.022, 0));
  g.add(at(cyl(r * 0.95, r * 0.95, 0.02, cap, 20), 0, 0.01, 0));
  return g;
}

/** UGREEN-style grey aluminium USB-C hub, 115 x 48 x 15 */
export function buildHub(M: DwMats) {
  const g = grp('usb-hub');
  g.add(at(rbox(0.048, 0.015, 0.115, 0.006, M.darkAlu, 3), 0, 0.0075, 0));
  for (let i = 0; i < 3; i++) g.add(at(box(0.012, 0.0045, 0.002, M.black), -0.01 + i * 0.012, 0.0075, 0.0577));
  const t = canvasTex(64, 32, (c, w, h) => { c.fillStyle = '#4b4f55'; c.fillRect(0, 0, w, h); c.fillStyle = '#9ca1a8'; c.font = '14px sans-serif'; c.fillText('UGREEN', 4, 21); });
  const lab = mesh(new THREE.PlaneGeometry(0.02, 0.008), new THREE.MeshStandardMaterial({ map: t, roughness: 0.4 }), 'hub-logo');
  lab.rotation.set(-Math.PI / 2, 0, Math.PI / 2); lab.position.set(0, 0.0152, 0.0);
  g.add(lab);
  g.add(cable([[0, 0.006, -0.058], [0, 0.006, -0.08], [0.02, 0.004, -0.12], [0.05, -0.02, -0.12], [0.06, -0.12, -0.1]], M.black, 0.0025));
  return g;
}

/** dark-red translucent pocket comb, ~180 mm */
export function buildComb(M: DwMats) {
  const g = grp('comb');
  const red = new THREE.MeshPhysicalMaterial({ color: '#1c0405', roughness: 0.3, clearcoat: 0.8, transparent: true, opacity: 0.95 });
  g.add(at(rbox(0.18, 0.004, 0.012, 0.002, red, 1), 0, 0.002, -0.006));
  const mats: THREE.Matrix4[] = [];
  for (let i = 0; i < 60; i++) mats.push(mat4(-0.086 + i * 0.0029, 0.0018, 0.006, 0, 0, 0));
  g.add(instanced(new THREE.BoxGeometry(0.0013, 0.0032, 0.014), red, mats, 'comb-teeth'));
  return g;
}

/** a blue chisel marker */
export function buildMarker(M: DwMats) {
  const g = grp('marker');
  const blue = new THREE.MeshStandardMaterial({ color: '#1f45b8', roughness: 0.35 });
  const b = cyl(0.0075, 0.0075, 0.1, blue, 16); b.rotation.z = Math.PI / 2; b.position.y = 0.0075; g.add(b);
  const c = cyl(0.0085, 0.0085, 0.04, M.black, 16); c.rotation.z = Math.PI / 2; c.position.set(0.065, 0.0085, 0); g.add(c);
  const sleeve = canvasTex(256, 64, (c, w, h) => {
    c.fillStyle = '#f4f1ec'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e9a7aa'; c.fillRect(0, h - 16, w, 16);
    c.fillStyle = '#1d3f9a'; c.font = 'bold 26px sans-serif'; c.fillText('PANTHER LIPS', 14, 36);
  });
  const lab = cyl(0.0078, 0.0078, 0.05, new THREE.MeshStandardMaterial({ map: sleeve, roughness: 0.6 }), 24, true);
  lab.rotation.z = Math.PI / 2; lab.position.set(-0.01, 0.0075, 0); g.add(lab);
  return g;
}

/** the white/blue paper sachet beside the marker ("…LIPS") */
export function buildSachet() {
  const t = canvasTex(256, 96, (c, w, h) => { c.fillStyle = '#f2f0ec'; c.fillRect(0, 0, w, h); c.fillStyle = '#1d3f9a'; c.font = 'bold 30px sans-serif'; c.fillText('…ENT LIPS', 20, 58); c.fillStyle = '#e8a0a4'; c.fillRect(0, h - 14, w, 14); });
  const m = mesh(new THREE.BoxGeometry(0.075, 0.004, 0.03), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }), 'sachet');
  m.position.y = 0.002;
  return grp('sachet', m);
}

/** the grey braided USB-C lead across the mat (166 hits), off the front edge and down */
export function buildMatCable(M: DwMats) {
  const grey = new THREE.MeshStandardMaterial({ color: '#7a7c80', roughness: 0.75 });
  const y = H + 0.006;
  const pts: V3[] = [[-1.635, y, 2.47], [-1.613, y, 2.406], [-1.564, y, 2.29], [-1.551, y, 2.17], [-1.529, y, 2.051], [-1.551, y, 1.944], [-1.597, y - 0.002, 1.876], [-1.64, H, 1.80], [-1.66, H - 0.05, 1.79], [-1.67, H - 0.3, 1.82], [-1.62, H - 0.42, 1.86]];
  const g = grp('mat-cable', cable(pts, grey, 0.0026));
  // USB-A plug end lying on the desk at the back
  g.add(at(rbox(0.012, 0.007, 0.03, 0.002, grey, 1), -1.64, y, 2.49, 0.3));
  return g;
}


/**
 * Printed tube sleeve. Canvas x runs round the tube, y runs along it (top of the canvas = the
 * crimp end). `draw` paints one face in a rotated frame where +x runs from cap toward crimp, so
 * text reads along the tube the way it is printed; the face is repeated on the back.
 */
function tubeLabel(bg: string, draw: (c: CanvasRenderingContext2D, len: number, face: number) => void) {
  const W = 512, H = 1024;
  return canvasTex(W, H, (c) => {
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    for (const cx of [W * 0.25, W * 0.75]) {
      c.save();
      c.translate(cx, H);
      c.rotate(-Math.PI / 2); // +x now runs up the canvas (cap -> crimp), +y across the face
      c.translate(0, -W * 0.18);
      draw(c, H, W * 0.36);
      c.restore();
    }
  });
}

/** blue lotion squeeze tube lying on the desk (photos 80/166): slate blue, white print, white cap */
export function buildBlueLotion(M: DwMats) {
  const label = tubeLabel('#6f97ba', (c, len, face) => {
    c.fillStyle = '#ffffff';
    c.font = '600 40px sans-serif'; c.fillText('HYDRATING', len * 0.2, face * 0.42);
    c.font = '28px sans-serif'; c.fillText('body lotion', len * 0.2, face * 0.62);
    c.font = '20px sans-serif';
    for (let k = 0; k < 3; k++) c.fillText('for normal to dry skin · fragrance free', len * 0.2, face * (0.78 + k * 0.08));
    // the white block near the crimp
    c.fillRect(len * 0.74, face * 0.3, len * 0.14, face * 0.42);
    c.fillStyle = '#6f97ba'; c.font = '600 22px sans-serif'; c.fillText('200 mL', len * 0.76, face * 0.56);
  });
  const blue = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.45 });
  const g = buildTube(0.14, 0.016, blue, M.plastic, label);
  g.name = 'blue-lotion';
  g.rotation.x = Math.PI / 2;
  return g;
}

/** LANEIGE sunscreen tube standing cap-down (photo 80): cream, grey wordmark, a thin gold band */
export function buildLaneige(M: DwMats) {
  const label = tubeLabel('#f2efe7', (c, len, face) => {
    c.fillStyle = '#7d7a75';
    c.font = '600 46px serif'; c.fillText('LANEIGE', len * 0.62, face * 0.36);
    c.font = '22px sans-serif'; c.fillText('Radian-C Sun Cream', len * 0.62, face * 0.54);
    c.font = '18px sans-serif'; c.fillText('SPF 50+ PA++++', len * 0.62, face * 0.68);
    c.fillStyle = '#c9a646'; c.fillRect(len * 0.4, face * 0.46, len * 0.16, 6);
    c.fillStyle = '#9b978f'; c.font = '16px sans-serif'; c.fillText('50 mL', len * 0.12, face * 0.5);
  });
  const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
  const g = buildTube(0.12, 0.018, white, M.plastic, label);
  g.name = 'laneige-tube';
  return g;
}

/** named desktop power/data leads (eero, frame, hub, G9, keyboard) — each a child group */
export function buildDeskSurfaceCables(M: DwMats) {
  const g = grp('desk-surface-cables');
  const add = (name: string, pts: V3[], r: number) => {
    const c = grp(name, cable(pts, M.black, r));
    g.add(c);
  };
  add('eero-power', [[-1.973, H + 0.02, 2.505], [-1.95, H + 0.003, 2.56], [-1.8, H + 0.003, 2.6], [-1.75, H - 0.04, 2.68]], 0.0025);
  add('frame-power', [[-1.36, H + 0.03, 2.33], [-1.42, H + 0.003, 2.42], [-1.55, H + 0.003, 2.5], [-1.6, H - 0.03, 2.66]], 0.0025);
  add('hub-to-macbook', [[-1.098, H + 0.007, 1.958], [-1.09, H + 0.003, 1.92], [-1.12, H + 0.003, 1.99], [-1.18, H + 0.01, 2.1]], 0.0022);
  add('g9-cables', [[-2.23, H + 0.1, 2.43], [-2.25, H + 0.01, 2.47], [-2.2, H + 0.003, 2.55], [-2.1, H - 0.03, 2.66]], 0.004);
  add('keyboard-charge', [[-1.88, H + 0.015, 2.1], [-1.82, H + 0.006, 2.16], [-1.76, H + 0.004, 2.3], [-1.72, H + 0.003, 2.5], [-1.7, H - 0.04, 2.66]], 0.0018);
  return g;
}

export { cyl, sphere, tube, box };
