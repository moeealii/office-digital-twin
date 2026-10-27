import * as THREE from 'three';
import { at, canvasTex, mesh, rbox, tube } from './_moe-kit';

/**
 * Winix D480 air purifier (owner ID'd; Home Depot 1001551154; spec 16.77 W x 11.81 D x 22.83 H in).
 * Built from the product photo and room photos 3/22/192/193:
 *  - a separate, slightly convex white front plate with big rounded corners, standing proud of
 *    the body (it covers nearly the whole front);
 *  - behind it a dark navy frame that shows as a band across the top (touch controls + LED) and
 *    as a dark reveal down both sides of the plate;
 *  - a deep white body with soft vertical edges; fine outlet slats on the top behind the controls;
 *  - a flat pale foot plate that runs out in front of the plate;
 *  - "WINIX" low and centred on the plate, Energy Star badge low right.
 * Placement from the scan: body centred x ≈ -1.38, front z ≈ -2.12, top ≈ 0.6; turned 0.28 rad.
 * Origin on the floor at the footprint centre, front toward +z.
 */
export const WINIX = { x: -1.38, z: -2.28, yaw: 0.28, w: 0.426, d: 0.3, h: 0.58 };

export function buildWinixD480() {
  const g = new THREE.Group();
  g.name = 'winix-d480';
  const W = WINIX.w, D = WINIX.d, H = WINIX.h;
  const white = new THREE.MeshPhysicalMaterial({ color: '#f3f3f1', roughness: 0.32, clearcoat: 0.35, clearcoatRoughness: 0.3, name: 'd480-white' });
  const navy = new THREE.MeshPhysicalMaterial({ color: '#33373f', roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.25, name: 'd480-navy' });
  const foot = new THREE.MeshStandardMaterial({ color: '#dcdcd8', roughness: 0.45, name: 'd480-foot' });
  const slat = new THREE.MeshStandardMaterial({ color: '#e9e9e6', roughness: 0.5, name: 'd480-slat' });
  const well = new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.8, name: 'd480-well' });

  const FOOT_H = 0.018;
  const bodyD = D - 0.05; // the body sits behind the plate and above the foot
  const bodyZ = -0.025;

  // foot plate: flat, slightly wider than the plate, its front edge rounded and running out ahead
  {
    const sh = new THREE.Shape();
    const hw = W / 2 - 0.02, z0 = -D / 2 + 0.02, z1 = D / 2 + 0.01;
    sh.moveTo(-hw, z0);
    sh.lineTo(hw, z0);
    sh.lineTo(hw, z1 - 0.05);
    sh.quadraticCurveTo(hw, z1, hw - 0.06, z1);
    sh.quadraticCurveTo(0, z1 + 0.012, -hw + 0.06, z1);
    sh.quadraticCurveTo(-hw, z1, -hw, z1 - 0.05);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: FOOT_H - 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.004, bevelSegments: 3, curveSegments: 16 });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, FOOT_H - 0.003, 0);
    g.add(mesh(geo, foot, 'd480-foot'));
  }

  // body: deep white shell with soft vertical edges and a rounded top
  g.add(at(rbox(W - 0.03, H - FOOT_H - 0.01, bodyD, 0.04, white, 6), 0, FOOT_H + 0.005 + (H - FOOT_H - 0.01) / 2, bodyZ));

  // navy frame on the body's front: a rounded-rect slab a little larger than the plate, so it
  // reads as a dark band across the top and a dark reveal down the sides
  const frameH = H - FOOT_H - 0.02;
  const frameZ = bodyZ + bodyD / 2;
  g.add(at(rbox(W - 0.026, frameH, 0.03, 0.035, navy, 6), 0, FOOT_H + 0.01 + frameH / 2, frameZ - 0.012));
  // the band continues back over the top front edge, where the controls sit
  g.add(at(rbox(W - 0.05, 0.012, 0.075, 0.006, navy, 3), 0, H - 0.004, frameZ - 0.04));

  // front plate: convex white panel with big corner radii, inset from the frame's top by the
  // control band and from its sides by the reveal
  {
    const pw = W - 0.06, ph = frameH - 0.04, r = 0.06;
    const sh = new THREE.Shape();
    sh.moveTo(-pw / 2 + r, 0);
    sh.lineTo(pw / 2 - r, 0); sh.quadraticCurveTo(pw / 2, 0, pw / 2, r);
    sh.lineTo(pw / 2, ph - r); sh.quadraticCurveTo(pw / 2, ph, pw / 2 - r, ph);
    // top edge rises slightly to the middle (product photo)
    sh.quadraticCurveTo(0, ph + 0.012, -pw / 2 + r, ph);
    sh.quadraticCurveTo(-pw / 2, ph, -pw / 2, ph - r);
    sh.lineTo(-pw / 2, r); sh.quadraticCurveTo(-pw / 2, 0, -pw / 2 + r, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 5, curveSegments: 20 });
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / (pw / 2), v = (p.getY(i) - ph / 2) / (ph / 2);
      p.setZ(i, p.getZ(i) + 0.012 * (1 - u * u) * (1 - 0.4 * v * v));
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
    const plate = mesh(geo, white, 'd480-front-plate');
    plate.position.set(0, FOOT_H + 0.012, frameZ + 0.004);
    g.add(plate);

    // wordmark + Energy Star badge, riding the plate's surface
    const bz = frameZ + 0.004 + 0.02 + 0.012; // plate front at its centre line
    const logo = mesh(new THREE.PlaneGeometry(0.075, 0.02), new THREE.MeshBasicMaterial({
      map: canvasTex(256, 64, (c, w, h) => {
        c.clearRect(0, 0, w, h);
        c.strokeStyle = '#2b3140'; c.lineWidth = 4;
        c.beginPath(); c.arc(30, 34, 18, Math.PI * 0.6, Math.PI * 2.1); c.stroke();
        c.fillStyle = '#2b3140'; c.font = 'bold 34px sans-serif'; c.fillText('WINIX', 44, 46);
      }), transparent: true, depthWrite: false,
    }), 'd480-logo');
    logo.position.set(0, FOOT_H + 0.012 + ph * 0.11, bz - 0.001);
    g.add(logo);
    const badge = mesh(new THREE.PlaneGeometry(0.016, 0.026), new THREE.MeshBasicMaterial({
      map: canvasTex(32, 52, (c, w, h) => { c.fillStyle = '#1b6fbf'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.fillRect(4, h - 12, w - 8, 6); }),
    }), 'd480-energy-star');
    const bx = pw / 2 - 0.035;
    badge.position.set(bx, FOOT_H + 0.012 + ph * 0.1, frameZ + 0.004 + 0.02 + 0.012 * (1 - (bx / (pw / 2)) ** 2) - 0.001);
    g.add(badge);
  }

  // top: touch icons + status LED on the navy band, outlet slats over a dark well behind it
  {
    const ty = H + 0.0025;
    for (let k = 0; k < 5; k++) {
      const ic = mesh(new THREE.CircleGeometry(0.005, 12), new THREE.MeshBasicMaterial({ color: '#9aa3b5' }), 'd480-icon');
      ic.rotation.x = -Math.PI / 2;
      ic.position.set(-0.12 + k * 0.05, ty, frameZ - 0.035);
      g.add(ic);
    }
    const led = mesh(new THREE.CircleGeometry(0.004, 12), new THREE.MeshBasicMaterial({ color: '#ff4a3a' }), 'd480-led');
    led.rotation.x = -Math.PI / 2;
    led.position.set(0.14, ty, frameZ - 0.035);
    g.add(led);
    const gd = bodyD - 0.13, gz = bodyZ - bodyD / 2 + 0.03 + gd / 2;
    g.add(at(rbox(W - 0.09, 0.004, gd, 0.003, well, 1), 0, H - 0.0005, gz));
    for (let i = 0; i < 10; i++) {
      g.add(at(rbox(W - 0.1, 0.004, 0.004, 0.001, slat, 1), 0, H + 0.002, gz - gd / 2 + 0.006 + i * ((gd - 0.012) / 9)));
    }
  }

  // power cord out of the back corner
  g.add(tube([[W / 2 - 0.05, 0.02, -D / 2 + 0.03], [W / 2 + 0.02, 0.012, -D / 2 + 0.05], [W / 2 + 0.1, 0.01, 0.05]], 0.0032, white, 16, 6));

  g.position.set(WINIX.x, 0, WINIX.z);
  g.rotation.y = WINIX.yaw;
  return g;
}
