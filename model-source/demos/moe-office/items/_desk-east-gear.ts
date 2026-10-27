import * as THREE from 'three';
import { Batch, M, boxUV, cyl, deform, gridGeo, lathe, rb, rod, tube, v3, canvasTex } from './_desk-east-geo';
import type { DEMats } from './_desk-east-mats';
import { DESK } from './_desk-east-desk';

/**
 * Measured east-desk contents, photos 108/112–114/160/161.
 * Laptop corners from 114/160 put the front at y .842–.855, rear .959–.975, logo near
 * (1.524,.917,2.457), gaps 6–33 mm: a CLOSED silver laptop on an inclined riser, not an open lid.
 * Wafer-tin top (1.395,.977,2.153), gap 8 mm: PC chocolate-hazelnut wafers, NOT Chips Ahoy.
 * Photo-plane reads place notebook (1.605,2.095), paper pile (2.168,2.300), wire trays
 * (2.50,2.30), sanitizer (2.536,2.046), pumps near (2.63,2.58), frame (2.32,2.515).
 * The blue-lined bin is under the EAST side at (2.34,2.10), not beside the loveseat.
 * Notebook and floral/clock packaging use rectified photo-114 graphics with object-local UVs.
 * Small/occluded inventory (paper-roll holder, ceramic piece, rear mailers) is retained from the
 * interrupted model; their exact identification/placement is not established by these close-ups.
 * Exact loose-paper arrangements, cable coils and tiny printed labels remain approximate.
 */

const TOP = DESK.top;

function laptop(m: DEMats) {
  const g = new THREE.Group();
  const b = new Batch();
  // closed MacBook: tapered slab, rounded corners, small foot shadow gap
  const body = rb(0.312, 0.016, 0.219, 0.008, 4);
  const p = body.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i) / 0.11;
    p.setY(i, p.getY(i) - 0.004 * (1 - z * z));
  }
  p.needsUpdate = true;
  body.computeVertexNormals();
  boxUV(body, 1);
  b.add(body, m.laptop, M(0, 0.008, 0));
  // lid edge shadow line (a hairline, not a plate: a full cap turned the silver lid black)
  b.add(boxUV(rb(0.302, 0.0012, 0.004, 0.0006, 2)), m.deskBlack, M(0, 0.0161, 0.104));
  // rubber feet
  for (const [x, z] of [[-0.13, -0.085], [0.13, -0.085], [-0.13, 0.085], [0.13, 0.085]]) {
    b.add(cyl(0.007, 0.007, 0.003, 8), m.rubber, M(x, 0.0015, z));
  }
  // apple mark on the lid
  const apple = canvasTex(128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#4a4d50';
    c.beginPath();
    c.ellipse(w * 0.5, h * 0.56, w * 0.22, h * 0.25, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(w * 0.66, h * 0.36, w * 0.085, h * 0.09, 0.5, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(w * 0.5, h * 0.3);
    c.quadraticCurveTo(w * 0.44, h * 0.2, w * 0.5, h * 0.18);
    c.quadraticCurveTo(w * 0.56, h * 0.2, w * 0.5, h * 0.3);
    c.fill();
  });
  const mark = new THREE.Mesh(
    new THREE.PlaneGeometry(0.045, 0.045),
    new THREE.MeshStandardMaterial({ map: apple, transparent: true, roughness: 0.4, metalness: 0.5 }),
  );
  mark.rotation.x = -Math.PI / 2;
  mark.position.set(0, 0.0165, 0.0);
  g.add(mark);
  b.build(g, 'macbook');
  return g;
}

function cap() {
  const g = new THREE.Group();
  const b = new Batch();
  const mat = new THREE.MeshStandardMaterial({ color: '#1f4a2c', roughness: 0.95 });
  // crown: a squashed sphere with a seam, brim in front
  const crown = new THREE.SphereGeometry(0.085, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const cp = crown.getAttribute('position');
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i) / 0.085;
    const z = cp.getZ(i) / 0.085;
    cp.setY(i, cp.getY(i) * 0.72);
    cp.setX(i, cp.getX(i) * (1 - 0.12 * Math.max(0, -z)));
    cp.setZ(i, cp.getZ(i) * (1 - 0.16 * Math.max(0, -z)) - 0.0 * x);
  }
  cp.needsUpdate = true;
  crown.computeVertexNormals();
  b.add(crown, mat);
  const brim = cyl(0.085, 0.085, 0.008, 20, false);
  deform(brim, p => {
    const r = Math.hypot(p.x, p.z);
    p.setY(p.y - 0.02 * Math.pow(r / 0.085, 2));
    p.setZ(p.z);
  });
  brim.scale(1, 1, 1.25);
  b.add(brim, mat, M(0, 0.028, 0.03));
  // Embroidered front lettering seen in 114, and radial panel seams.
  const logo = canvasTex(512,128,(c,w,h)=>{c.clearRect(0,0,w,h);c.fillStyle='#e4e8dc';c.font='italic bold 64px sans-serif';c.textAlign='center';c.fillText('definition',w/2,h*.75);});
  const word = new THREE.Mesh(new THREE.PlaneGeometry(.13,.032),new THREE.MeshStandardMaterial({map:logo,transparent:true,roughness:1}));
  word.position.set(0,.027,.079);g.add(word);
  for(let i=0;i<6;i++) { const a=i/6*Math.PI*2; const pts=[];
    for(let j=0;j<=16;j++){const t=j/16*Math.PI/2;pts.push(v3(.085*Math.sin(t)*Math.cos(a),.061*Math.cos(t),.085*Math.sin(t)*Math.sin(a)));}
    b.add(tube(pts,.0008,24,5),mat);
  }
  // button
  b.add(cyl(0.008, 0.008, 0.006, 10), mat, M(0, 0.062, 0));
  b.build(g, 'cap');
  return g;
}

export function buildGear(m: DEMats) {
  const g = new THREE.Group();
  g.name = 'desk-gear';
  const b = new Batch();

  // ---- MacBook on a thin wedge riser at the west end, beside the loveseat (photo 114)
  const riser = rb(0.28, 0.012, 0.16, 0.004, 2);
  // Its support plane matches tan(.57); it stays inside the laptop's projected .184 m depth.
  // A shallower/larger riser intersected the closed lid after the desktop-height correction.
  deform(riser, (p) => { p.setY(p.y + 0.064 * (p.z / 0.1)); });
  b.add(boxUV(riser, 1), m.alu, M(1.54, 0.890, 2.45, -0.38));
  const lap = laptop(m);
  lap.position.set(1.54, 0.902, 2.45);
  lap.rotation.order = 'YXZ'; // yaw THEN local tilt, matching the riser's YXZ matrix
  lap.rotation.y = -0.38;
  lap.rotation.x = -0.57; // 114/160 corners: front .842–.855, back .959–.975
  lap.userData.physics = { type: 'dynamic', mass: 1.4, shape: 'box' };
  g.add(lap);

  // ---- keyboard + gel wrist rest, centre of the front edge (photos 112/113)
  b.add(boxUV(rb(0.46, 0.014, 0.085, 0.012, 3)), m.rubber, M(1.91, TOP + 0.008, 2.06, 0.04));
  b.add(boxUV(rb(0.44, 0.022, 0.152, 0.008, 3)), m.deskBlack, M(1.91, TOP + 0.02, 2.16, 0.04));
  const keyGroup = new THREE.Group();
  keyGroup.name = 'east-keyboard-keys';
  const rows = [
    ['Ctrl','Win','Alt','Space','Alt','Fn','Ctrl'],
    ['Shift','Z','X','C','V','B','N','M',',','.','/','Shift'],
    ['Caps','A','S','D','F','G','H','J','K','L',';','Enter'],
    ['Tab','Q','W','E','R','T','Y','U','I','O','P','[',']'],
    ['`','1','2','3','4','5','6','7','8','9','0','-','=','Back'],
    ['Esc','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'],
  ];
  const numRows = [['0','0','.','Enter'],['1','2','3','Enter'],['4','5','6','+'],['7','8','9','+'],['Num','/','*','-'],['Ins','Home','PgUp','Del']];
  const specs: { x:number; z:number; w:number; label:string }[] = [];
  rows.forEach((row,r) => {
    const widths = row.map(t => t==='Space'?5.5:['Shift','Enter','Back','Caps','Tab'].includes(t)?1.5:1);
    const unit = .306 / widths.reduce((a,b)=>a+b,0); let x = -.206;
    row.forEach((label,i) => { const w=widths[i]*unit; specs.push({x:x+w/2,z:-.055+r*.022,w:w-.002,label});x+=w; });
    numRows[r].forEach((label,c) => specs.push({x:.122+c*.023,z:-.055+r*.022,w:.020,label}));
  });
  const caps = new THREE.InstancedMesh(rb(.020,.007,.019,.002,2),m.trayBlack,specs.length);
  specs.forEach((k,i) => caps.setMatrixAt(i,M(k.x,TOP+.036,k.z,0,0,0,[k.w/.020,1,1])));
  caps.castShadow=caps.receiveShadow=true;caps.instanceMatrix.needsUpdate=true;keyGroup.add(caps);
  const legends = canvasTex(1320,456,(c,w,h) => {
    c.clearRect(0,0,w,h);c.fillStyle='#d4d7d5';c.textAlign='center';c.textBaseline='middle';
    specs.forEach(k => {c.save();c.translate((.5+k.x/.44)*w,(.5+k.z/.152)*h);c.rotate(Math.PI);
      c.font=k.label.length>2?'11px sans-serif':'17px sans-serif';c.fillText(k.label==='Space'?'':k.label,0,0);c.restore();});
    c.font='italic 14px sans-serif';c.fillText('logitech',w*.51,h*.965);
  });
  const lettering = new THREE.Mesh(new THREE.PlaneGeometry(.44,.152),new THREE.MeshStandardMaterial({map:legends,transparent:true,roughness:.7,depthWrite:false}));
  lettering.rotation.x=-Math.PI/2;lettering.position.y=TOP+.040;keyGroup.add(lettering);
  keyGroup.rotation.y = 0.04;
  keyGroup.position.set(1.91, 0, 2.16);
  keyGroup.userData.physics = { type: 'dynamic', mass: 0.4, shape: 'box' };
  g.add(keyGroup);

  // ---- mouse mat + mouse
  b.add(boxUV(rb(0.22, 0.004, 0.18, 0.02, 3)), m.deskBlack, M(1.68, TOP + 0.002, 2.34, -0.4));
  const mouse = rb(0.062, 0.032, 0.104, 0.028, 4);
  deform(mouse, p => {
    const z = p.z / 0.052;
    p.setY(p.y * (1 - 0.25 * z * z) + 0.006 * (1 - Math.abs(z)));
  });
  boxUV(mouse, 1);
  b.add(mouse, m.deskBlack, M(1.68, TOP + 0.018, 2.34, -0.5));

  // ---- notebooks and loose sheets
  const sheetMat = m.paper;
  // Photo-112 rays on y=.84: pile centre (2.168,2.300), edges (2.368,2.099)/(2.009,2.448).
  const sheets = [
    [2.22, 2.24, 0.30, 0.38],
    [2.14, 2.32, 0.29, -0.15],
    [2.19, 2.28, 0.30, 0.24],
    [2.28, 2.21, 0.29, -0.30],
    [2.12, 2.30, 0.28, 0.10],
    [2.18, 2.29, 0.30, -0.08],
  ];
  sheets.forEach(([x, z, s, r], i) => {
    b.add(boxUV(rb(s * 0.75, 0.0016, s, 0.0007, 2)), sheetMat, M(x, TOP + 0.002 + i * 0.0022, z, r));
    const page = new THREE.Mesh(new THREE.PlaneGeometry(s * .73, s * .98), m.looseNotes);
    page.rotation.x = -Math.PI / 2;
    const p = new THREE.Group(); p.add(page); p.position.set(x, TOP + .003 + i * .0022, z); p.rotation.y = r;
    g.add(p);
  });
  // a loose pile of papers near the front edge (photo 108/113)
  for (let i = 0; i < 5; i++) {
    b.add(boxUV(rb(0.2, 0.0018, 0.27, 0.004, 2), 1), sheetMat,
      M(2.18 + i * 0.01, TOP + 0.003 + i * 0.0024, 2.27 + i * 0.006, 0.25 - i * 0.08));
  }
  // the spiral notebook with handwriting (photo 114)
  b.add(boxUV(rb(0.24, 0.012, 0.30, 0.006, 3)), m.paper, M(1.605, TOP + 0.01, 2.095, -0.25));
  const notebookPage = new THREE.Mesh(new THREE.PlaneGeometry(0.232, 0.292), m.notes);
  notebookPage.rotation.set(-Math.PI / 2, 0, 0); // explicit 0..1 page UVs, no box-projected corner
  const notebook = new THREE.Group(); notebook.name = 'handwritten-notebook';
  notebook.add(notebookPage); notebook.position.set(1.605, TOP + 0.017, 2.095); notebook.rotation.y = -0.25;
  g.add(notebook);
  // Spiral-wire loops follow the notebook's bound edge.
  for (let i = 0; i < 24; i++) {
    const loop = new THREE.TorusGeometry(0.004, 0.0007, 5, 10);
    b.add(loop, m.chrome, M(1.605, TOP + 0.018, 2.095, -0.25).multiply(M(-0.117, 0, -0.138 + i * 0.012)));
  }
  // blue pen on the notebook, black sleep mask beside the canister (photo 114)
  b.add(rod(v3(1.51, TOP + 0.022, 2.04), v3(1.70, TOP + 0.024, 2.11), 0.0035, 8), m.penBlue);
  b.add(cyl(0.0035, 0.0035, 0.02, 8), m.alu, M(1.70, TOP + 0.024, 2.11));
  const mask = rb(0.19, 0.018, 0.08, 0.012, 3);
  deform(mask, (p) => { p.setY(p.y + 0.008 * (1 - Math.pow(p.x / 0.095, 2))); });
  b.add(boxUV(mask, 1), m.rubber, M(1.42, TOP + 0.012, 2.039, 0.12));

  // Folded black face mask and its small yellow card on the loose papers (112/113).
  const faceMask = gridGeo(20,12,(u,v) => v3((u-.5)*.145,.027+.013*Math.sin(u*8)+.007*Math.sin(v*11),(v-.5)*.09),true);
  b.add(faceMask,new THREE.MeshStandardMaterial({color:'#171b1b',roughness:.98,side:THREE.DoubleSide}),M(2.15,TOP,2.26,.35));
  b.add(rb(.07,.0015,.04,.001,2),new THREE.MeshStandardMaterial({color:'#e6c253',roughness:.9}),M(2.24,TOP+.018,2.22,.12));

  // ---- PC chocolate-hazelnut wafer tin (not Chips Ahoy), photo 114
  b.push(M(0.10, 0, -0.23));
  const tinLabel = canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = '#f3efe6';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#d33b3b';
    c.fillRect(w * .64, h * 0.08, w * .05, h * .13);
    c.fillStyle = '#fff8ef';
    c.font = 'bold 44px sans-serif';
    c.textAlign = 'center';
    c.font = 'bold 34px sans-serif';
    c.font = 'italic 14px serif'; c.fillText('PC', w * 0.665, h * 0.18);
    c.fillStyle = '#3b2a1c';
    c.font = 'bold 26px sans-serif';
    c.font = 'bold 22px sans-serif';
    c.fillText('CHOCOLATE HAZELNUT', w * 0.5, h * 0.42);
    c.font = '16px sans-serif'; c.fillText('WAFER ROLLS', w * 0.5, h * 0.53);
    for (let i = 0; i < 5; i++) {
      const x = w * (0.16 + i * 0.17);
      c.fillStyle = i % 2 ? '#c98a4b' : '#8d5a2b';
      c.beginPath();
      c.ellipse(x, h * 0.76 + (i % 3) * 8, 5, 34, (i-2)*.35, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#efe7d8';
    c.fillRect(0, h * 0.86, w, h * 0.14);
  });
  const tinSide = new THREE.MeshStandardMaterial({ map: tinLabel, roughness: 0.42 });
  const tin = cyl(0.048, 0.048, 0.155, 20, true);
  b.add(tin, tinSide, M(1.30, TOP + 0.078, 2.38));
  b.add(cyl(0.05, 0.05, 0.014, 20), m.tin, M(1.30, TOP + 0.162, 2.38));
  const lidPrint=canvasTex(256,256,(c,w,h)=>{
    c.fillStyle='#f2f0e9';c.fillRect(0,0,w,h);c.strokeStyle='#bdc0b9';c.lineWidth=3;c.beginPath();c.arc(w/2,h/2,w*.48,0,Math.PI*2);c.stroke();
    c.fillStyle='#b73936';c.fillRect(w*.40,h*.17,w*.13,h*.13);c.fillStyle='#faf7ed';c.font='italic 18px serif';c.fillText('PC',w*.40,h*.27);
    c.fillStyle='#68665c';c.font='bold 20px sans-serif';c.textAlign='center';c.fillText('CHOCOLATE',w/2,h*.44);c.fillText('HAZELNUT',w/2,h*.54);
    c.font='13px sans-serif';c.fillText('WAFER ROLLS',w/2,h*.65);
  });
  b.add(new THREE.CircleGeometry(.0475,40).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({map:lidPrint,roughness:.6}),M(1.30,TOP+.1692,2.38));
  b.add(cyl(0.05, 0.05, 0.008, 20), m.tin, M(1.30, TOP + 0.004, 2.38));
  b.add(cyl(0.049, 0.049, 0.002, 20), m.card, M(1.30, TOP + 0.152, 2.38));
  b.add(new THREE.CylinderGeometry(0.0485, 0.0485, 0.127, 32, 1, true, Math.PI - 1.0, 2.0),
    m.waferLabel, M(1.30, TOP + 0.074, 2.38));
  b.pop();

  // ---- tissue box (pink/white) with a lifted sheet
  b.add(boxUV(rb(0.065, 0.15, 0.10, 0.008, 3)), m.pinkBox, M(1.34, TOP + 0.075, 2.31, 0.2));
  b.add(boxUV(rb(0.055, 0.004, 0.09, 0.002, 2)), m.tissue, M(1.34, TOP + 0.152, 2.31, 0.2));
  const tissuePull = rb(0.05, 0.05, 0.02, 0.012, 3);
  b.add(tissuePull, m.tissue, M(1.34, TOP + 0.175, 2.31, 0.2));

  // ---- green cap on a black tray at the back-west corner, mailer boxes behind the laptop (photo 114)
  b.add(boxUV(rb(0.22, 0.014, 0.16, 0.008, 2)), m.trayBlack, M(1.08, TOP + 0.008, 2.62, -0.2));
  const c = cap();
  c.name = 'green-cap';
  c.position.set(0.98, TOP + 0.016, 2.62);
  c.rotation.y = Math.PI - 0.3;
  c.userData.physics = { type: 'dynamic', mass: 0.1, surface: 'soft' };
  g.add(c);
  b.add(boxUV(rb(0.16, 0.055, 0.115, 0.008, 2)), m.trayBlack, M(1.28, TOP + 0.028, 2.58, 0.3));
  // pink patterned box + blue box (photo 114)
  const pinkPat = canvasTex(256, 256, (cx, w, h) => {
    cx.fillStyle = '#e79aa5';
    cx.fillRect(0, 0, w, h);
    cx.fillStyle = '#f6ead9';
    for (let i = 0; i < 26; i++) {
      cx.beginPath();
      cx.arc((i * 71) % w, (i * 113) % h, 8 + (i % 4) * 5, 0, Math.PI * 2);
      cx.fill();
      cx.strokeStyle = '#b5656f';
      cx.lineWidth = 3;
      cx.stroke();
    }
  });
  const pinkMat = m.floralBox; // rectified clock/floral print from the actual box
  b.add(rb(0.13, 0.13, 0.13, 0.01, 2), m.pinkBox, M(1.20, TOP + 0.065, 2.58, 0.22));
  b.add(rb(0.12, 0.10, 0.12, 0.01, 2), m.pinkBox, M(1.06, TOP + 0.05, 2.60, -0.2));
  // The flower/clock print occupies entire front and top faces, with explicit 0..1 UVs.
  for(const [x,z,w,h,ry] of [[1.20,2.58,.13,.13,.22],[1.06,2.60,.12,.10,-.2]]) {
    const packet = new THREE.Group();
    const front = new THREE.Mesh(new THREE.PlaneGeometry(w-.008,h-.008),pinkMat);front.rotation.y=Math.PI;front.position.z=-w/2-.001;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w-.008,w-.008),pinkMat);top.rotation.x=-Math.PI/2;top.position.y=h/2+.001;
    packet.add(front,top);packet.position.set(x,TOP+h/2,z);packet.rotation.y=ry;g.add(packet);
  }
  b.add(boxUV(rb(0.14, 0.045, 0.10, 0.008, 2)), m.blueBox, M(1.58, TOP + 0.024, 2.60, 0.4));

  // ---- pump bottles (clear sanitizer + white lotion) and the pen cup
  const clear = lathe([[0, 0], [0.028, 0], [0.03, 0.01], [0.03, 0.13], [0.026, 0.15], [0.012, 0.155], [0, 0.155]], 20);
  // tall sanitizer at the front-east corner (photo 113); the two smaller pumps sit by the arm
  b.push(M(0.036, 0, -0.034));
  b.add(clear, m.clearBottle, M(2.50, TOP, 2.08));
  b.add(cyl(0.027, 0.027, 0.09, 20), m.blueLiquid, M(2.50, TOP + 0.045, 2.08));
  b.add(cyl(.0304,.0304,.012,32,true),new THREE.MeshStandardMaterial({color:'#5595bb',roughness:.55}),M(2.50,TOP+.028,2.08));
  b.add(cyl(0.008, 0.008, 0.03, 10), m.whiteBottle, M(2.50, TOP + 0.168, 2.08));
  b.add(boxUV(rb(0.028, 0.014, 0.05, 0.005, 2)), m.whiteBottle, M(2.515, TOP + 0.183, 2.08));
  b.pop();
  const white = lathe([[0, 0], [0.032, 0], [0.034, 0.012], [0.034, 0.11], [0.024, 0.13], [0.01, 0.135], [0, 0.135]], 20);
  b.push(M(0.39, 0, 0));
  b.add(white, m.whiteBottle, M(2.24, TOP, 2.58));
  b.add(cyl(0.009, 0.009, 0.028, 10), m.whiteBottle, M(2.24, TOP + 0.148, 2.58));
  b.add(boxUV(rb(0.03, 0.012, 0.045, 0.005, 2)), m.whiteBottle, M(2.255, TOP + 0.162, 2.58));
  b.add(white.clone(), m.whiteBottle, M(2.32, TOP, 2.56));
  b.pop();
  // black pen cup with pens, just west of the arm pole
  b.push(M(0.257, 0, -0.118));
  b.add(cyl(0.041, 0.038, 0.105, 16), m.deskBlack, M(2.08, TOP + 0.052, 2.58));
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3;
    b.add(rod(v3(2.08 + Math.cos(a) * 0.018, TOP + 0.04, 2.58 + Math.sin(a) * 0.018),
      v3(2.08 + Math.cos(a) * 0.05, TOP + 0.19, 2.58 + Math.sin(a) * 0.05), 0.005, 8),
      i === 1 ? m.penRed : i === 3 ? m.penBlue : m.deskBlack);
  }

  b.pop();
  // Second pen cup at the tray's front corner, visible below the paper pile in 112/113.
  b.add(lathe([[0,0],[0.034,0],[0.038,.09],[.034,.09],[.030,.01],[0,.01]],20), m.deskBlack, M(2.38, TOP, 2.10));
  for (let i=0;i<4;i++) b.add(rod(v3(2.38+i*.006,TOP+.02,2.10),v3(2.38+i*.01,TOP+.16,2.10+i*.007),.0035,8),i%2?m.penBlue:m.penRed);

  // ---- chrome wire basket with two paper trays (photo 112/113)
  const wire = (x0: number, x1: number, y: number, z0: number, z1: number) => {
    const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i];
      const [bx, bz] = corners[(i + 1) % 4];
      b.add(rod(v3(ax, y, az), v3(bx, y, bz), 0.0035, 6), m.steelMesh);
    }
  };
  const bx = 2.50, bz = 2.30;
  for (const y of [TOP + 0.004, TOP + 0.06, TOP + 0.11]) wire(bx - 0.16, bx + 0.16, y, bz - 0.12, bz + 0.12);
  for (const [cx2, cz2] of [[-0.16, -0.12], [0.16, -0.12], [0.16, 0.12], [-0.16, 0.12]]) {
    b.add(rod(v3(bx + cx2, TOP + 0.004, bz + cz2), v3(bx + cx2, TOP + 0.11, bz + cz2), 0.0035, 6), m.steelMesh);
  }
  // Fine crossed wire mesh on all four sides, not an empty four-rod frame (112 close-up).
  const woven: THREE.Matrix4[]=[];
  const corners=[[bx-.16,bz-.12],[bx+.16,bz-.12],[bx+.16,bz+.12],[bx-.16,bz+.12]];
  const strand=(side:number,s0:number,v0:number,s1:number,v1:number) => {
    const a=corners[side],c=corners[(side+1)%4],len=Math.hypot(c[0]-a[0],c[1]-a[1]);
    const p=v3(a[0]+(c[0]-a[0])*s0/len,TOP+.006+v0,a[1]+(c[1]-a[1])*s0/len);
    const q=v3(a[0]+(c[0]-a[0])*s1/len,TOP+.006+v1,a[1]+(c[1]-a[1])*s1/len);
    const d=q.clone().sub(p);if(d.length()<.001)return;
    woven.push(new THREE.Matrix4().compose(p.clone().add(q).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(v3(0,1,0),d.clone().normalize()),v3(1,d.length(),1)));
  };
  corners.forEach((a,i)=>{const c=corners[(i+1)%4],len=Math.hypot(c[0]-a[0],c[1]-a[1]),h=.102;
    for(let o=-h;o<len;o+=.009){const l=Math.max(0,o),r=Math.min(len,o+h);strand(i,l,l-o,r,r-o);}
    for(let o=0;o<len+h;o+=.009){const l=Math.max(0,o-h),r=Math.min(len,o);strand(i,l,o-l,r,o-r);}
  });
  const weave=new THREE.InstancedMesh(cyl(.0007,.0007,1,4),m.steelMesh,woven.length);
  woven.forEach((m,i)=>weave.setMatrixAt(i,m));weave.instanceMatrix.needsUpdate=true;weave.name='east-wire-paper-basket';g.add(weave);
  // overflowing paper, manila envelope on top (photo 113)
  for (let i = 0; i < 8; i++) {
    b.add(boxUV(rb(0.28, 0.006, 0.2, 0.003, 2), 1), i % 3 === 0 ? m.card : m.paper,
      M(bx + (i % 2) * 0.008, TOP + 0.026 + i * 0.016, bz + (i % 3) * 0.004, 0.08 - i * 0.02));
  }
  b.add(boxUV(rb(0.24, 0.004, 0.16, 0.001, 2), 1), m.card, M(bx + 0.02, TOP + 0.145, bz - 0.01, -0.15));
  const address = canvasTex(768,512,(c,w,h)=>{
    c.fillStyle='#d9cb9c';c.fillRect(0,0,w,h);
    c.strokeStyle='#b3a276';c.lineWidth=2;c.strokeRect(8,8,w-16,h-16);
    c.fillStyle='#f4f1e6';c.fillRect(w*.12,h*.15,w*.31,h*.12);c.fillRect(w*.28,h*.67,w*.45,h*.16);
    c.fillStyle='#88867e';for(let i=0;i<4;i++)c.fillRect(w*.32,h*(.69+i*.025),w*(.14+i%2*.12),3);
    c.fillStyle='#57564f';for(let i=0;i<40;i++)c.fillRect(w*.72+i*2,h*.16,1+i%2,h*.1);
  });
  const envelope = new THREE.Mesh(new THREE.PlaneGeometry(.238,.158),new THREE.MeshStandardMaterial({map:address,roughness:.95}));
  envelope.rotation.x=-Math.PI/2;
  const parcel=new THREE.Group();parcel.add(envelope);parcel.position.set(bx+.02,TOP+.1475,bz-.01);parcel.rotation.y=-.15;g.add(parcel);

  // paper-towel roll on a freestanding holder, back-east corner (kept off the measured west cluster)
  b.add(cyl(0.045, 0.048, 0.01, 16), m.tin, M(2.55, TOP + 0.005, 2.64));
  b.add(cyl(0.008, 0.008, 0.22, 10), m.alu, M(2.55, TOP + 0.12, 2.64));
  b.add(cyl(0.05, 0.05, 0.16, 16), m.paper, M(2.55, TOP + 0.11, 2.64));

  // ---- small white ceramic figure (photo 112/113, beside the basket)
  const fig = new THREE.Group();
  const fb = new Batch();
  fb.add(lathe([[0, 0], [0.045, 0], [0.046, 0.008], [0.028, 0.02], [0.03, 0.06], [0.05, 0.1], [0.038, 0.13], [0.02, 0.145], [0, 0.148]], 20), m.ceramic);
  fb.add(new THREE.SphereGeometry(0.026, 14, 10), m.ceramic, M(0, 0.175, 0));
  fb.add(cyl(0.006, 0.006, 0.03, 8), m.ceramic, M(0, 0.152, 0));
  fb.build(fig, 'figurine');
  fig.name = 'ceramic-figurine';
  fig.position.set(2.02, TOP, 2.64);
  fig.scale.setScalar(.5); // small ceramic piece below the monitor, not a 20 cm vase
  fig.userData.physics = { type: 'dynamic', mass: 0.35 };
  g.add(fig);

  // ---- small wooden picture frame leaning on the wall behind the monitor (photo 112)
  const frame = new THREE.Group();
  const fb2 = new Batch();
  fb2.add(boxUV(rb(0.13, 0.11, 0.012, 0.004, 2), 1), m.cardboard, M(0, 0.055, 0));
  fb2.add(boxUV(rb(0.108, 0.088, 0.004, 0.002, 2), 1), m.paper, M(0, 0.055, 0.008));
  fb2.build(frame, 'photo-frame');
  frame.name = 'east-photo-frame';
  frame.position.set(2.32, TOP, 2.515);
  frame.rotation.order = 'YXZ';
  frame.rotation.y = Math.PI; // picture faces the room, not the wall
  frame.rotation.x = -0.22;
  frame.rotation.z = 0.25;
  frame.userData.physics = { type: 'dynamic', mass: 0.25, shape: 'box' };
  g.add(frame);

  // ---- red-and-white pill bottle (photo 114)
  b.add(cyl(0.022, 0.022, 0.07, 16), m.paper, M(1.60, TOP + 0.035, 2.62));
  b.add(cyl(0.023, 0.023, 0.012, 16), new THREE.MeshStandardMaterial({ color: '#b8323c', roughness: 0.5 }), M(1.60, TOP + 0.04, 2.62));
  b.add(cyl(0.02, 0.02, 0.012, 16), m.whiteBottle, M(1.60, TOP + 0.076, 2.62));

  // ---- coiled white cable beside the basket (photo 114)
  for (let i = 0; i < 3; i++) {
    const torus = new THREE.TorusGeometry(0.035 - i * 0.004, 0.004, 6, 20);
    torus.rotateX(Math.PI / 2);
    b.add(torus, m.cableGrey, M(1.54 + i * 0.004, TOP + 0.006 + i * 0.004, 2.58));
  }

  // ---- black mug beside the keyboard (photo 112)
  b.add(lathe([[0, 0], [0.035, 0], [0.038, 0.006], [0.04, 0.085], [0.036, 0.085], [0.034, 0.012], [0, 0.01]], 18), m.cupBlack, M(2.10, TOP, 2.57));
  const handle = new THREE.TorusGeometry(0.028, 0.006, 6, 14, Math.PI * 1.2);
  handle.rotateY(Math.PI / 2);
  b.add(handle, m.cupBlack, M(2.14, TOP + 0.05, 2.57));
  b.add(lathe([[0,.086],[.02,.086],[.037,.080],[.039,.079]],24),m.cupBlack,M(2.10,TOP,2.57));

  // loose sheets in front of the keyboard, a second mug, and the dark jar by the arm
  // Blue tape roll with a white cardboard core beside the black lidded cup, crop 112.
  b.add(lathe([[.025,0],[.035,0],[.035,.05],[.025,.05],[.025,0]],24),m.blueBox,M(2.28,TOP,2.53));
  b.add(new THREE.TorusGeometry(.030,.004,8,32).rotateX(Math.PI/2),m.paper,M(2.28,TOP+.051,2.53));
  b.add(cyl(0.032, 0.034, 0.07, 16), new THREE.MeshStandardMaterial({ color: '#3b3f3a', roughness: 0.35, metalness: 0.1 }), M(1.97, TOP + 0.035, 2.60));
  b.add(cyl(0.034, 0.034, 0.012, 16), m.deskBlack, M(1.97, TOP + 0.076, 2.60));
  b.add(rb(.095,.055,.075,.004,2),m.trayBlack,M(2.0,TOP+.028,2.50));
  b.add(rb(.075,.002,.0015,.0005,2),m.paper,M(2.0,TOP+.047,2.461));
  b.add(boxUV(rb(0.16, 0.06, 0.11, 0.008, 2), 1), m.cardboard, M(2.42, TOP + 0.03, 2.64, 0.1));

  // Blue-lined open waste bin, east of the chair; floor picks 112/161 put its centre at
  // (2.34,2.10), radius .13, rim .29. It is not the closed blue sphere at the west foot.
  const bag = new THREE.CylinderGeometry(0.13, 0.105, 0.28, 48, 12, true);
  deform(bag, p => {
    const a = Math.atan2(p.z, p.x), v = (p.y + .14) / .28;
    const fold = 1 + .035 * Math.sin(a * 11 + v * 2) + .018 * Math.sin(a * 23 - v * 5);
    p.x *= fold; p.z *= fold;
    p.y += .15 + .009 * Math.sin(a * 7) * Math.pow(v, 5);
  });
  const bagMat = new THREE.MeshStandardMaterial({ color: '#336b9b', roughness: .62, side: THREE.DoubleSide });
  b.add(bag, bagMat, M(2.34, 0, 2.10));
  b.add(cyl(.106,.106,.012,32), m.deskBlack, M(2.34,.012,2.10));
  const lip = [];
  for(let i=0;i<=64;i++) { const a=i/64*Math.PI*2; const r=.13*(1+.035*Math.sin(a*11));
    lip.push(v3(2.34+r*Math.cos(a),.29+.009*Math.sin(a*7),2.10+r*Math.sin(a))); }
  b.add(tube(lip,.005,96,6),bagMat);

  b.build(g, 'gear');
  // Batched clutter stays one static assembly; the named peers above knoll separately.
  g.userData.physics = { type: 'static' };
  return g;
}
