import * as THREE from 'three';
import { Batch, M, boxUV, cyl, gridGeo, rb, rod, tube, v3 } from './_desk-east-geo';
import type { DEMats } from './_desk-east-mats';

/**
 * Black perforated-mesh task chair, photos 108/112/114/160/161. Local +z faces the desk.
 * Triangulated frame points: top-east (1.980,1.040,1.683), silver-band west
 * (1.662,.660,1.875), bottom-west (1.634,.449,1.925), bottom-east (2.000,.476,1.733).
 * Wider-baseline pairs are used: 160/161 alone have only a ~9 cm camera baseline and unstable depth.
 * Joint fit gives cylinder (1.871,1.911), yaw .485, back width .410, height .580, lean -.092;
 * residuals are <=17 mm, comparable to the picked-pixel uncertainty. Seat crown .47.
 * Real construction: open mesh and curved ribs, broad lumbar pad with silver insert, crescent
 * seat shell, dark upholstered cushion, loop-arm supports, tilt mechanism, gas lift, five twin casters.
 * The precise caster forks and hidden tilt mechanism are inferred from visible silhouettes.
 */

const SEAT_H = 0.47;
const BACK_TOP = 1.05; // outer top including frame, 108/112/161 triangulation

export function buildChair(m: DEMats) {
  const g = new THREE.Group();
  g.name = 'mesh-chair';
  const b = new Batch();

  // ---- five-star base
  const HUB = 0.115;
  b.add(cyl(0.045, 0.055, 0.05, 16), m.chairFrame, M(0, HUB, 0));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.31;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const legPts = [
      v3(0, HUB, 0),
      v3(ca * 0.09, HUB + 0.008, sa * 0.09),
      v3(ca * 0.20, 0.082, sa * 0.20),
      v3(ca * 0.29, 0.072, sa * 0.29),
      v3(ca * 0.325, 0.068, sa * 0.325),
    ];
    b.add(tube(legPts, 0.022, 24, 8), m.chairFrame);
    b.add(cyl(0.014, 0.012, 0.045, 10), m.chairFrame, M(ca * 0.335, 0.045, sa * 0.335));
    for (const s of [-1, 1]) {
      const wheel = cyl(0.028, 0.028, 0.016, 14);
      wheel.rotateZ(Math.PI / 2);
      wheel.applyMatrix4(M(ca * 0.338 - sa * 0.012 * s, 0.029, sa * 0.338 + ca * 0.012 * s, a));
      b.add(wheel, m.rubber);
    }
    b.add(cyl(0.029, 0.029, 0.026, 10), m.rubber, M(ca * 0.338, 0.029, sa * 0.338));
  }

  // ---- gas cylinder, mechanism, levers
  b.add(cyl(0.031, 0.035, 0.17, 16), m.chairFrame, M(0, 0.20, 0));
  b.add(cyl(0.014, 0.014, 0.14, 12), m.chrome, M(0, 0.335, 0));
  b.add(cyl(0.041, 0.045, 0.025, 16), m.chairFrame, M(0, 0.41, 0));
  b.add(boxUV(rb(0.15, 0.07, 0.15, 0.02, 3)), m.chairFrame, M(0, SEAT_H - 0.055, -0.03));
  b.add(cyl(0.026, 0.026, 0.05, 12).rotateZ(Math.PI / 2), m.chairFrame, M(0.09, SEAT_H - 0.062, -0.03));
  b.add(cyl(0.03, 0.03, 0.014, 12).rotateZ(Math.PI / 2), m.chairFrame, M(0.116, SEAT_H - 0.062, -0.03));
  b.add(boxUV(rb(0.11, 0.014, 0.022, 0.005, 2)), m.chairFrame, M(-0.10, SEAT_H - 0.072, 0.05));
  b.add(boxUV(rb(0.075, 0.012, 0.018, 0.005, 2)), m.chairFrame, M(-0.11, SEAT_H - 0.088, 0.012));

  // ---- seat: pale shell under a dark cushion
  // A moulded cup with a broad rear crescent flange, not a deformed rounded-box slab.
  // Photo 161: the rear flange is narrow at the sides and drops about 4 cm at its centre.
  const panPoint=(u:number,v:number,under=false)=>{
    const a=u*2-1,t=Math.min(1,v/.75),s=t*t*(3-2*t),w=.36+.115*s;
    const x=a*w/2,z=-.18+v*.44+.025*(1-2*v)*Math.pow(Math.abs(a),6);
    const top=.445-.010*v+.008*a*a-.012*Math.pow(Math.max(0,(v-.87)/.13),2);
    const thickness=.007+.033*(1-a*a)*Math.exp(-v/.10);
    return v3(x,top-(under?thickness:0),z);
  };
  b.add(gridGeo(40,36,(u,v)=>panPoint(u,v),true),m.chairShell);
  b.add(gridGeo(40,36,(u,v)=>panPoint(u,v,true)),m.chairShell);
  const rim=(u:number,under:boolean)=>{
    const t=u*4;
    if(t<1)return panPoint(t,0,under);
    if(t<2)return panPoint(1,t-1,under);
    if(t<3)return panPoint(3-t,1,under);
    return panPoint(0,4-t,under);
  };
  b.add(gridGeo(160,1,(u,v)=>rim(u,v>0)),m.chairShell);
  const cush = rb(0.462, 0.050, 0.425, 0.025, 4);
  const cp = cush.getAttribute('position');
  for (let i = 0; i < cp.count; i++) {
    const z = cp.getZ(i) / 0.21;
    const x = cp.getX(i) / 0.2275;
    cp.setY(i, cp.getY(i) + 0.014 * (1 - x * x) - 0.02 * Math.pow(Math.max(0, -z), 2));
  }
  cp.needsUpdate = true;
  cush.computeVertexNormals();
  boxUV(cush, 1);
  b.add(cush, m.seatFabric, M(0, SEAT_H - 0.039, 0.065));
  // pale side cheeks of the shell, visible from behind in photos 160/161
  for (const s of [-1, 1]) {
    b.add(boxUV(rb(0.012, 0.035, 0.20, 0.006, 3)), m.chairShell, M(s * 0.228, SEAT_H - 0.055, 0.075));
  }

  // ---- arms
  for (const s of [-1, 1]) {
    const ax = s * 0.272;
    // Arm-pad centre triangulated in 112/161: (2.164,.774,1.900), gap 23 mm.
    b.add(boxUV(rb(0.055, 0.02, 0.055, 0.008, 2)), m.chairFrame, M(ax, SEAT_H - 0.072, 0.12));
    b.add(boxUV(rb(0.04, 0.032, 0.04, 0.008, 2)), m.chairFrame, M(ax, SEAT_H - 0.048, 0.12));
    b.add(boxUV(rb(0.028, 0.31, 0.04, 0.012, 2)), m.chairFrame, M(ax, SEAT_H + 0.13, 0.105));
    const pad = rb(0.07, 0.026, 0.24, 0.013, 3);
    boxUV(pad, 1);
    b.add(pad, m.rubber, M(ax - s * 0.004, SEAT_H + 0.30, 0.125));
    b.add(rb(.030,.020,.008,.002,2),m.silverBand,M(ax,SEAT_H+.16,.081));
    b.add(tube([v3(ax,SEAT_H-.035,-.11),v3(ax,SEAT_H+.005,-.15),v3(ax,SEAT_H+.26,-.04),v3(ax,SEAT_H+.29,.07)],.014,32,8),m.chairFrame);
  }

  // ---- back
  const back = new THREE.Group();
  back.name = 'chair-back';
  const bb = new Batch();
  const BW = 0.410;
  const BH = BACK_TOP - 0.47; // fitted together with yaw/lean, residuals ≤17 mm on measured points
  const panelPoint = (u: number, v: number, off: number) => {
    const x = (u - 0.5) * BW;
    const y = v * BH;
    const bow = Math.sin(Math.PI * u); // 0 at the edges, 1 in the middle
    const z = 0.035 * (1 - bow) + 0.014 * Math.sin(v * Math.PI) + off;
    return v3(x, y, z);
  };
  bb.add(gridGeo(30, 34, (u, v) => panelPoint(u, v, 0), true, 1), m.mesh);
  // flat horizontal ribs (photo 161: a dozen bands, not round tubes) plus the satin lumbar bar
  const rib = (v: number, h: number, off: number, mat: THREE.Material) => {
    const span = BW * 0.9;
    const geo = new THREE.BoxGeometry(span, h, 0.008, 20, 1, 1);
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      // Use exactly the mesh/frame surface, otherwise the ribs protrude beyond the perimeter.
      const u = Math.min(1, Math.max(0, x / BW + 0.5));
      p.setZ(i, p.getZ(i) + panelPoint(u, v, off).z);
      p.setY(i, p.getY(i) + v * BH);
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
    bb.add(geo, mat);
  };
  for (let i = 0; i < 13; i++) rib(0.045 + (i / 12) * 0.9, i === 6 ? 0.016 : 0.011, -0.012, m.chairFrame);
  // Wide lumbar pad with its thin brushed-metal insert, not a naked chrome rib.
  rib(0.36, 0.085, -0.019, m.chairFrame);
  rib(0.36, 0.022, -0.026, m.silverBand);
  // frame: a soft-cornered loop around the panel, thicker at the sides
  const framePts: THREE.Vector3[] = [];
  const N = 72;
  for (let k = 0; k < N; k++) {
    const t = k / N;
    let u: number, v: number;
    if (t < 0.25) {
      u = 0.012;
      v = t / 0.25;
    } else if (t < 0.5) {
      u = 0.012 + ((t - 0.25) / 0.25) * 0.976;
      v = 1;
    } else if (t < 0.75) {
      u = 0.988;
      v = 1 - (t - 0.5) / 0.25;
    } else {
      u = 0.988 - ((t - 0.75) / 0.25) * 0.976;
      v = 0;
    }
    framePts.push(panelPoint(u, v, -0.002));
  }
  framePts.push(framePts[0].clone());
  bb.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(framePts, true, 'catmullrom', 0.02), 160, 0.018, 8, true), m.chairFrame);
  // the back's central spine behind the panel, down to the mechanism
  bb.add(rod(v3(0, -0.14, 0.13), v3(0, -0.04, 0.13), 0.016, 12), m.chairFrame); // internal connector below the rear frame
  bb.build(back, 'chair-back');
  back.position.set(0, 0.457, -0.13);
  back.rotation.x = -0.092;
  g.add(back);

  // support arm from the mechanism up behind the seat into the back's spine
  b.add(rod(v3(0, SEAT_H - 0.09, -0.09), v3(0, SEAT_H - 0.035, -0.12), 0.026, 12), m.chairFrame);
  b.add(rod(v3(0, SEAT_H - 0.035, -0.12), v3(0, SEAT_H - 0.01, -0.13), 0.022, 12), m.chairFrame);

  b.build(g, 'chair');
  g.userData.physics = { type: 'dynamic', mass: 14, shape: 'box', surface: 'metal' };
  return g;
}
