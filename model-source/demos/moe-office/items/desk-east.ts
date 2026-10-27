import * as THREE from 'three';
import type { PartContext } from '../parts/types';
import { buildChair } from './_desk-east-chair';
import { buildDesk } from './_desk-east-desk';
import { buildGear } from './_desk-east-gear';
import { buildLoveseatGear } from './_desk-east-lovegear';
import { deMats } from './_desk-east-mats';
import { buildTuftedCouch, tuftedSetMaterials } from './_tufted-set';

/**
 * East end of wall 0 (z = +2.712): RoomPlan object 9 (the black sit-stand desk) with its
 * lift-mounted display and photographs' worth of gear, object 1 (the black mesh task chair),
 * and object 0 (the cream tufted leather loveseat between the desks).
 *
 * Photos 95–115, 148, 149, 160, 161, 201. Placement notes live in each helper's header.
 * Coordinates: room metres, floor y = 0, +y up.
 *
 * ---- PROVENANCE: what is firm, what is a range -------------------------------------------
 * Firm: the desk top is BLACK satin laminate (photos 112/113/114/160/161); the BRIEF's "white
 * sit-stand desk" wording belongs to the WEST desk — do not repaint this one white.
 * Desk footprint x 1.30..2.668 (west edge measured in photo 114), z 1.96..2.71, top .832±.02.
 * Chair cylinder at (1.871, 1.911), seat 0.47, back top about 1.05; arm-pad centre .774.
 * Firm: loveseat footprint x -0.24..+1.36, z 1.81..2.71 (scan: cream vertices on the west arm face
 * at -0.24, east arm face at 1.30-1.36, front at 1.81-1.83 all along; two full cushions in photo
 * 104), top 0.80, cushions 0.48 — it is the two-seat of the same set as the wall-3 sofa.
 * APPROXIMATE (do not "correct" these to a single value without new evidence):
 *  * The desk/monitor dimensions retain 1–3 cm picked-pixel uncertainty.
 * Chair yaw .485 is fitted to triangulated frame points, not the RoomPlan rotation.
 * Gear: larger items are measured; tiny/occluded inventory and exact loose-paper folds remain approximate.
 * -----------------------------------------------------------------------------------------
 */

/** Widen the existing set's 1.02 m inner field to 1.22 m without widening the 19 cm arms.
 * Photo-115 top-row picks on y=.695 give x .763,.628,.504,.383,.266,.152: pitch .12–.13.
 * Starting with the shorter carcass then warping its inner span preserves every component,
 * including the instanced buttons. No shared SET mutation, and the other sofa is untouched.
 */
function fitLoveseatSpan(g: THREE.Group) {
  const oldHalf=.51, newHalf=.61;
  const clamp=(x:number)=>Math.max(0,Math.min(1,x));
  const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};
  const fitPoint=(p:THREE.Vector3)=>{
    p.x=Math.abs(p.x)<=oldHalf?p.x*newHalf/oldHalf:p.x+Math.sign(p.x)*(newHalf-oldHalf);
    // Photo-115 top-row rays land at z≈2.46, while the lower row is farther roomward.
    // A 25° back lean (not the shared sofa's 10°) gives Δz=.29*(.79-y), anchored at the roll.
    // Leave the wall-side carcass face fixed, and shorten only the rear of the seat cushions.
    if(Math.abs(p.x)<.60 && p.z>0 && p.y>.28) {
      const w=smooth(p.z/.14)*clamp((.45-p.z)/.12);
      p.z-=Math.max(0,.79-p.y)*.29*w;
    }
    // 115:(650,980) and 114:(820,950) on z=1.81 give front-arm crowns y=.833/.842.
    if(Math.abs(p.x)>.60) {
      const crown=Math.cos(clamp(Math.abs(Math.abs(p.x)-.705)/.095)*Math.PI/2);
      p.y+=.04*crown*clamp((.15-p.z)/.60)*smooth((p.y-.60)/.19);
    }
  };
  g.updateMatrixWorld(true);
  const p=new THREE.Vector3(), matrix=new THREE.Matrix4();
  const q=new THREE.Quaternion(), scale=new THREE.Vector3(), oldPos=new THREE.Vector3();
  g.traverse(o=>{
    if(!(o instanceof THREE.Mesh)) return;
    const inverse=o.matrixWorld.clone().invert();
    if(o instanceof THREE.InstancedMesh) {
      for(let i=0;i<o.count;i++) {
        o.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix).applyMatrix4(o.matrixWorld);
        const backButton=Math.abs(p.x)<.48 && p.z>.14;
        fitPoint(p);p.applyMatrix4(inverse);
        matrix.decompose(oldPos,q,scale);
        if(backButton) q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.262));
        matrix.compose(p,q,scale);o.setMatrixAt(i,matrix);
      }
      o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere();return;
    }
    o.geometry=o.geometry.clone();const pos=o.geometry.getAttribute('position');
    for(let i=0;i<pos.count;i++) {
      p.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);fitPoint(p);
      if(o.name==='arm' && p.z<-.40) {
        const edge=Math.exp(-Math.pow((Math.abs(p.x)-.70)/.085,2));
        p.z-=.006*edge*Math.sin(p.y*52)*Math.exp(-Math.pow((p.y-.74)/.15,2));
      }
      // Small radial gathers around the existing back buttons, not a painted-on diamond map.
      if(o.name==='tufted-field' && o.parent===g) {
        const pitch=.104*newHalf/oldHalf;
        [ .695,.607,.519 ].forEach((y,r)=>{
          const off=r===1?pitch/2:0,dx=p.x-(Math.round((p.x-off)/pitch)*pitch+off),dy=p.y-y,d=Math.hypot(dx,dy);
          if(d<.065) p.z+=.0018*Math.sin(Math.atan2(dy,dx)*8)*Math.exp(-d/.028)*(1-Math.exp(-Math.pow(d/.01,2)));
        });
      }
      p.applyMatrix4(inverse);pos.setXYZ(i,p.x,p.y,p.z);
    }
    pos.needsUpdate=true;o.geometry.computeVertexNormals();o.geometry.computeBoundingSphere();
  });
}

export async function build(_ctx: PartContext) {
  const m = await deMats();
  const g = new THREE.Group();
  g.name = 'desk-east';

  g.add(buildDesk(m));
  g.add(buildGear(m));

  const chair = buildChair(m);
  // Fitted from the photographed chair, rather than taking the RoomPlan centre as authoritative.
  // Wider-baseline 108/112/160/161 picks constrain the outer frame and silver band.
  // Joint fit: about 28° yaw, rather than square to the desk.
  chair.position.set(1.871, 0, 1.911);
  chair.rotation.y = 0.485; // joint least-squares fit of four triangulated frame points
  g.add(chair);

  // one of the cream tufted set (the wall-3 sofa is the other) — see _tufted-set.ts
  const couchMats=await tuftedSetMaterials();
  const leather=couchMats.leather as THREE.MeshPhysicalMaterial;
  leather.color.set('#e1d5bf');leather.roughness=.69;leather.clearcoat=.10;
  const loveseat = buildTuftedCouch({ name: 'tufted-loveseat', length: 1.4, seats: 2, seed: 5 }, couchMats);
  fitLoveseatSpan(loveseat); // final footprint remains 1.60 × .90
  // The shared tuft field already winds toward the seat (-z, see _tufted-set.ts tuftPanel); do NOT
  // reverse it here — flipping it culls the room-facing side and only the buttons remain (photo 104).
  loveseat.add(buildLoveseatGear(m));
  loveseat.position.set(0.56, 0, 2.71 - 0.45);
  g.add(loveseat);

  return g;
}
