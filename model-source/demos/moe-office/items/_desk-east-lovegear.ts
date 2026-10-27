import * as THREE from 'three';
import { Batch, M, boxUV, cyl, deform, gridGeo, rb, v3, canvasTex, tube, noiseNormal } from './_desk-east-geo';
import type { DEMats } from './_desk-east-mats';

/**
 * The things parked on the loveseat, all visible in photos 108/114/115/201: a grey perforated
 * shiatsu massage back cushion (dark-grey bolsters, light-grey centre) leaning against the tufted back, its seat
 * pad lying on the cushions, a red-and-white garment, a yellow tag, a stack of notebooks with a red folder on the
 * back rail, and a black box hooked over it.
 *
 * Local frame matches the loveseat: origin on the floor at its footprint centre, +x east,
 * +z toward the wall. Seat top 0.468, cushion depth to z ~ +0.16.
 *
 * ---- PROVENANCE: what is firm, what is a range -------------------------------------------
 * Firm: a grey moulded floor-chair cushion with a pale trim ring sits on the loveseat against
 * its back, plus a red/white garment, a yellow tag, and a stack of notebooks with a red folder and
 * a black box hooked over the back rail (photos 108/114/115/201).
 * APPROXIMATE (do not "correct" these to a single value without new evidence):
 * Exactly how these drape is not resolvable from the photos; sizes follow photo 108's grey
 * cushion silhouette (±3 cm).
 * -----------------------------------------------------------------------------------------
 */

const SEAT = 0.49; // shared tufted set: cushion tops 0.48 + crown

export function buildLoveseatGear(m: DEMats) {
  const g = new THREE.Group();
  g.name = 'loveseat-gear';
  // One assembly of seat clutter — separate from the loveseat body in knolling.
  g.userData.physics = { type: 'dynamic', mass: 2.5, surface: 'soft' };
  const b = new Batch();

  const weave = canvasTex(128, 128, (c,w,h) => {
    c.fillStyle='#c1c1bb'; c.fillRect(0,0,w,h);
    c.strokeStyle='#7c7e7b'; c.lineWidth=1;
    for(let x=0;x<w;x+=4) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,h); c.stroke(); }
    for(let y=0;y<h;y+=4) { c.beginPath(); c.moveTo(0,y); c.lineTo(w,y); c.stroke(); }
  },true,true); weave.repeat.set(10,10);
  const fine = noiseNormal(128, 30, 1.2, 17);
  const grey = new THREE.MeshStandardMaterial({ color: '#8b8d88', roughness: 0.95, normalMap:fine, normalScale:new THREE.Vector2(.2,.2), name: 'massage-grey' });
  const greyLight = new THREE.MeshStandardMaterial({ color: '#f1f2ee', map:weave, normalMap:fine, normalScale:new THREE.Vector2(.15,.15), roughness: 0.92, side: THREE.DoubleSide, name: 'massage-light' });
  const greyFrame = new THREE.MeshStandardMaterial({ color: '#b9b9b4', roughness: 0.8 });

  // ---- shiatsu massage back cushion leaning on the loveseat's back (photos 108/114/201):
  //   a thick padded shell, dark-grey side bolsters and crown round a light-grey centre panel
  //   that bulges forward, plus its matching seat pad
  const support = new THREE.Group();
  const BW = 0.36; // bevel adds 4 cm; photographed outside width is about .42 m
  const BH = 0.590; // include the crown bevel in the measured y≈1.064 top
  const BT = 0.05;
  // silhouette (photo 108): straight-ish sides that widen a touch at the shoulders, then a broad
  // rounded crown — a tombstone, not a rectangle
  const outline = (w: number, h: number, crown: number) => {
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2 + 0.03, 0);
    sh.lineTo(w / 2 - 0.03, 0);
    sh.quadraticCurveTo(w / 2, 0, w / 2, 0.04);
    sh.lineTo(w / 2 + 0.01, h - crown);
    sh.bezierCurveTo(w / 2 + 0.01, h - crown * 0.3, w * 0.28, h, 0, h);
    sh.bezierCurveTo(-w * 0.28, h, -w / 2 - 0.01, h - crown * 0.3, -w / 2 - 0.01, h - crown);
    sh.lineTo(-w / 2, 0.04);
    sh.quadraticCurveTo(-w / 2, 0, -w / 2 + 0.03, 0);
    return sh;
  };
  const shellGeo = new THREE.ExtrudeGeometry(outline(BW, BH, 0.11), {
    depth: BT - 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 6, curveSegments: 28,
  });
  shellGeo.translate(0, 0, -(BT - 0.04) / 2);
  shellGeo.computeVertexNormals();
  support.add(new THREE.Mesh(shellGeo, grey));
  // lighter centre panel: same silhouette inset, thin, domed forward with a lumbar swell
  const panelGeo = new THREE.ExtrudeGeometry(outline(BW * 0.56, BH - 0.1, 0.13), {
    depth: 0.008, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.01, bevelSegments: 4, curveSegments: 24,
  });
  deform(panelGeo, p => {
    const u = p.x / (BW * 0.28), v = p.y / (BH - 0.1);
    // dome toward local +z, which the π turn below points at the room
    p.setZ(p.z + 0.012 * (1 - u * u) + 0.012 * Math.exp(-(((v - 0.3) / 0.18) ** 2)));
  });
  panelGeo.computeVertexNormals();
  const panelMesh = new THREE.Mesh(panelGeo, greyLight);
  panelMesh.rotation.y = Math.PI; // face -z (the room)
  panelMesh.position.set(0, 0.05, -BT / 2 - 0.012);
  support.add(panelMesh);
  // control remote on its cord hanging at the side (photo 114)
  support.add(new THREE.Mesh(rb(0.05, 0.11, 0.02, 0.008, 2), greyFrame).translateX(BW / 2 + 0.015).translateY(0.12));
  support.traverse(o => {
    const mm = o as THREE.Mesh;
    if (mm.isMesh) mm.castShadow = mm.receiveShadow = true;
  });
  // Crown centre x 1.044, z 2.354 in the room; body leans back onto the back rail.
  // Base from 108/114: (.878,.474,2.222), gap 11 mm. Crown (1.044,1.064,2.354).
  support.position.set(0.33, SEAT, -0.068);
  support.rotation.order = 'YXZ'; // recline along the cushion's own facing direction
  support.rotation.x = 0.35;
  support.rotation.y = 0.85; // reclines diagonally toward the back rail
  // Continuous sewn piping follows the inset panel instead of a featureless grey slab.
  const welt = outline(BW * 0.56, BH - 0.1, 0.13).getPoints(80).map(p => v3(-p.x, p.y + .05, -BT / 2 - .019));
  support.add(new THREE.Mesh(tube(welt,.0022,140,6,true),greyFrame));
  const badge = new THREE.Mesh(rb(.045,.012,.003,.003,2),greyFrame);
  badge.position.set(0,BH-.033,-BT/2-.003);support.add(badge);
  g.add(support);
  // seat pad, separate, lying on the cushions
  const pad = rb(0.44, 0.045, 0.36, 0.022, 5); // thin, soft-edged seat pad
  deform(pad, p => {
    const z = p.z / 0.17;
    p.setY(p.y + 0.012 * (1 - z * z));
  });
  boxUV(pad, 1);
  const padMesh = new THREE.Mesh(pad, grey);
  padMesh.castShadow = padMesh.receiveShadow = true;
  padMesh.position.set(0.17, SEAT + 0.02, -0.19);
  padMesh.rotation.y = 0.85;
  g.add(padMesh);
  // the pad's light centre band, like the back's (photo 201)
  const padTop = new THREE.Mesh(rb(0.28, 0.012, 0.32, 0.006, 2), greyLight);
  padTop.position.set(0.17, SEAT + 0.02 + 0.026, -0.19);
  padTop.rotation.y = 0.85;
  g.add(padTop);

  // ---- a red-and-white garment crumpled mid-seat, west of the back support
  const clothMat = new THREE.MeshStandardMaterial({ color: '#a83a34', roughness: 0.98, side: THREE.DoubleSide });
  const drape = (u:number,v:number) => {
    const z=.04-v*.35; const drop=.12*Math.pow(Math.max(0,(v-.76)/.24),1.4);
    return v3((u-.5)*.22+.006*Math.sin(v*14),.023+.007*Math.sin(u*17+v*6)+.006*Math.cos(v*19)-drop,z);
  };
  const cloth = gridGeo(36,45,drape,true);
  b.add(cloth, clothMat, M(.34,SEAT,-.24,.18));
  const cloth2 = gridGeo(28,38,(u,v)=>drape(.12+u*.62,v*.96).add(v3(0,.003,0)),true);
  b.add(cloth2, new THREE.MeshStandardMaterial({ color: '#efe9e0', roughness: .98, side:THREE.DoubleSide }), M(.34,SEAT,-.24,.18));
  // yellow tag
  b.add(boxUV(rb(0.07, 0.004, 0.05, 0.004, 2), 1), new THREE.MeshStandardMaterial({ color: '#e8d33a', roughness: 0.8 }), M(0.06, SEAT + 0.055, 0.0, 0.5));

  // ---- notebooks + red folder resting on the top rail, black box hooked over it (photos 108/115)
  // the set's flat top is y 0.80 behind the roll (local z 0.31..0.44); the stack sits by the west arm
  b.add(boxUV(rb(0.3, 0.02, 0.2, 0.006, 2), 1), m.trayBlack, M(-0.44, 0.812, 0.36, -0.06));
  b.add(boxUV(rb(0.28, 0.035, 0.18, 0.006, 2), 1), new THREE.MeshStandardMaterial({ color: '#cfc9bb', roughness: 0.9 }), M(-0.44, 0.835, 0.36, -0.08));
  b.add(boxUV(rb(0.24, 0.004, 0.16, 0.0015, 2), 1), new THREE.MeshStandardMaterial({ color: '#b8323c', roughness: 0.8 }), M(-0.44, 0.866, 0.36, -0.13));
  b.add(boxUV(rb(0.22, 0.03, 0.15, 0.008, 2), 1), m.paper, M(-0.55, 0.84, 0.35, 0.06));
  // black pouch hanging over the back rail in front of that stack (photo 115)
  const pouch = rb(0.30, 0.09, 0.045, 0.02, 3);
  deform(pouch, (p) => { p.setY(p.y - 0.008 * Math.max(0, -p.z / 0.02)); });
  b.add(boxUV(pouch, 1), m.trayBlack, M(-0.42, 0.77, 0.205, 0.05));

  // The pouch folds over the top rail; its front must not float detached from the book stack.
  const flap=gridGeo(24,20,(u,v)=>v3((u-.5)*.30,.806+.005*Math.sin(v*Math.PI),.225+v*.135),true);
  b.add(flap,m.trayBlack,M(-.42,0,0,.05));
  for(const x of [-.565,-.275]) b.add(tube([v3(x,.76,.17),v3(x-.005,.68,.155),v3(x+.008,.65,.16),v3(x+.011,.69,.17)],.0018,28,5),m.cable);
  const binding=new THREE.InstancedMesh(new THREE.TorusGeometry(.004,.0008,5,12).rotateY(Math.PI/2),m.chrome,28);
  for(let i=0;i<28;i++) binding.setMatrixAt(i,M(-.575+i*.01,.836,.26));
  binding.instanceMatrix.needsUpdate=true;g.add(binding);
  // Uneven loose papers and the yellow envelope under the red folder, photo 115.
  for(let i=0;i<10;i++) {
    const page = gridGeo(8,6,(u,v)=>v3((u-.5)*(.26+(i%3)*.012),.0015*Math.sin(u*8+i)+(i%2)*.002*Math.pow(v,4),(v-.5)*.18),true);
    b.add(page,i===1?m.card:m.paper,M(-.44+(i%3)*.005,.847+i*.0015,.36,-.08+i*.009));
  }
  b.build(g, 'loveseat-gear');
  return g;
}
