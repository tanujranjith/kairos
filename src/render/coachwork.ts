import { Color3, Mesh, MeshBuilder, PBRMaterial, Vector3, VertexData, type Material, type Scene } from '@babylonjs/core';
import type { VehicleDefinition } from '../core/types';
import {roadDesign} from './road-design';
import {panelStripe,panelHeight,panelSide,panelDecal} from './panel-stripe';
import {fascia,fasciaDepth} from './fascia';
import {profileCurve} from './profile-curve';
import {roadCabin} from './road-cabin';

type Point=[number,number,number];
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;

/** Original continuous body surfaces, separate glazing and inset trim. Metres, +Z nose. */
export function roadCoachwork(scene:Scene,d:VehicleDefinition,m:{paint:PBRMaterial;glass:PBRMaterial;lens?:PBRMaterial;dark:PBRMaterial;chrome:PBRMaterial;light:PBRMaterial;tail:PBRMaterial;accent?:PBRMaterial;instruments?:PBRMaterial},lite:boolean,livery=0){
  const parts:Mesh[]=[],W=d.width/2,L=d.length/2,roof=d.height-(.32+d.wheelRadius),gt=d.class==='GT',design=roadDesign(d);
  const [cabinRear,backRoof,frontRoof,frontBase]=design.cabin;
  const add=(mesh:Mesh,material:Material)=>{mesh.material=material;parts.push(mesh);return mesh;};
  const steeringPart=(mesh:Mesh)=>{mesh.metadata={...mesh.metadata,kairosAnimated:'steering'};return mesh;};
  const box=(name:string,w:number,h:number,l:number,x:number,y:number,z:number,material:Material)=>{const mesh=MeshBuilder.CreateBox(name,{width:w,height:h,depth:l},scene);mesh.position.set(x,y,z);return add(mesh,material);};
  const tube=(name:string,points:Point[],radius:number,material:Material)=>add(MeshBuilder.CreateTube(name,{path:points.map(p=>Vector3.FromArray(p)),radius,tessellation:lite?4:8},scene),material);
  const sheet=(name:string,rows:Point[][],material:Material,surfaceNormals?:number[])=>{
    let positions=rows.flat(2),uvs:number[]=[],normals=surfaceNormals??[];const indices:number[]=[],width=rows[0].length;
    for(let j=0;j<rows.length;j++)for(let i=0;i<width;i++){uvs.push(i/(width-1),j/(rows.length-1));if(j<rows.length-1&&i<width-1){const a=j*width+i;
      const x=(rows[j][i][0]+rows[j][i+1][0])*.5,z=(rows[j][i][2]+rows[j+1][i][2])*.5;
      if(name==='sculpted-coachwork'&&Math.abs(x)<W*.73&&z>cabinRear+.035&&z<frontBase-.035)continue;
      indices.push(a,a+1,a+width,a+1,a+width+1,a+width);
    }}
    if(name==='sculpted-coachwork'){
      // Remove unused inner vertices too: the passenger cell is a real opening,
      // not a painted bonnet surface bisecting the dashboard and seats.
      const map=new Map<number,number>(),p:number[]=[],uv:number[]=[],n:number[]=[];
      for(let i=0;i<indices.length;i++){const old=indices[i];if(!map.has(old)){map.set(old,p.length/3);p.push(...positions.slice(old*3,old*3+3));uv.push(...uvs.slice(old*2,old*2+2));if(surfaceNormals)n.push(...normals.slice(old*3,old*3+3));}indices[i]=map.get(old)!;}positions=p;uvs=uv;if(surfaceNormals)normals=n;
    }
    if(!surfaceNormals)VertexData.ComputeNormals(positions,indices,normals);
    if((name==='recessed-headlamp'&&normals.filter((_,i)=>i%3===1).reduce((a,b)=>a+b,0)<0)||(name.startsWith('kairos-')&&normals.filter((_,i)=>i%3===2).reduce((a,b)=>a+b,0)>0)){for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];VertexData.ComputeNormals(positions,indices,normals);}
    const data=new VertexData();data.positions=positions;data.indices=indices;data.normals=normals;data.uvs=uvs;const mesh=new Mesh(name,scene);data.applyToMesh(mesh);return add(mesh,material);
  };
  const stations=design.stations;
  const profiles=[1,2,3].map(channel=>profileCurve(stations.map(s=>[s[0],s[channel]])));
  const rows:Point[][]=[];
  for(let k=0;k<stations.length-1;k++)for(let j=0;j<(lite?4:7);j++){
    const t=j/(lite?4:7),z=mix(stations[k][0],stations[k+1][0],t),[w,shoulder,centre]=profiles.map(p=>p.at(z));
    rows.push(section(z,w,shoulder,centre));
  }
  rows.push(section(...stations[stations.length-1]));
  function section(z:number,w:number,shoulder:number,centre:number):Point[]{
    const dz=Math.min(Math.abs(z-d.wheelbase/2),Math.abs(z+d.wheelbase/2)),radius=d.wheelRadius+.045;
    const bottom=dz<radius?-.32+Math.sqrt(radius*radius-dz*dz):-.43;
    const crown=crownPoints(shoulder,centre),profile=profileCurve(crown);
    const upper=lite?crown:[0,.18,.36,.51,.65,.74,.83,.885,.94].map(x=>[x,profile.at(x)] as [number,number]);
    const half:[number,number][]=[...upper,[.99,shoulder-.035],[1,mix(shoulder-.045,bottom,.65)],[.98,bottom],[.86,bottom-.015]];
    return [...half.slice(1).reverse().map(([x,y])=>[-x*w,y,z] as Point),...half.map(([x,y])=>[x*w,y,z] as Point)];
  }
  function crownPoints(shoulder:number,centre:number):[number,number][]{return [[0,centre+.015],[.36,centre+.012],[.65,centre+.01],[.83,shoulder+.008],[.94,shoulder]];}
  // Evaluate normals from the continuous skin, not triangle counts. Unequal
  // station spacing and changing wheel-arch height otherwise crease reflections.
  const skinNormals=rows.flatMap(row=>{
    const z=row[0][2],z0=Math.max(stations[0][0],z-.0001),z1=Math.min(stations.at(-1)![0],z+.0001);
    const sample=(at:number)=>{const [w,s,c]=profiles.map(p=>p.at(at));return {w,crown:profileCurve(crownPoints(s,c)),row:section(at,w,s,c)};};
    const a=sample(z0),b=sample(z1),now=sample(z);
    return row.flatMap((p,i)=>{
      const u=Math.abs(p[0])/now.w;
      if(u<=.940001){
        const dx=now.crown.derivative(Math.min(u,.94))*Math.sign(p[0])/now.w;
        const dz=(b.crown.at(Math.abs(p[0])/b.w)-a.crown.at(Math.abs(p[0])/a.w))/(z1-z0);
        return new Vector3(-dx,1,-dz).normalize().asArray();
      }
      const across=Vector3.FromArray(row[Math.min(row.length-1,i+1)]).subtract(Vector3.FromArray(row[Math.max(0,i-1)]));
      const along=Vector3.FromArray(b.row[i]).subtract(Vector3.FromArray(a.row[i]));
      return Vector3.Cross(along,across).normalize().asArray();
    });
  });
  const body=sheet('sculpted-coachwork',rows,m.paint,skinNormals);
  const onSkin=(points:Point[],offset=.004):Point[]=>points.map(([x,,z])=>[x,(panelHeight(body,x,z)??0)+offset,z]);
  const rear=fascia(scene,d,rows[0],false,lite,m.paint,m.dark),front=fascia(scene,d,rows.at(-1)!,true,lite,m.paint,m.dark);
  parts.push(...rear.parts,...front.parts);
  const rearTrim=(x:number,y:number,offset=.007):Point=>[x,y,(fasciaDepth(rear.panel,x,y,-1)??-L)-offset];
  box('undertray',d.width*.82,.045,d.length*.85,0,-.42,0,m.dark);

  const cabin=roadCabin(scene,d,m,lite,body),roofPanel=cabin.roofPanel;parts.push(...cabin.parts);
  for(const side of [-1,1]){
    // Fender lips follow the tire aperture and leave the suspension clearance open.
    for(const zc of [-d.wheelbase/2,d.wheelbase/2]){const points:Point[]=[];for(let k=0;k<=20;k++){const a=k/20*Math.PI,y=-.32+Math.sin(a)*(d.wheelRadius+.051),z=zc+Math.cos(a)*(d.wheelRadius+.051);points.push([side*(profiles[0].at(z)*.98+.003),y,z]);}tube('rolled-fender-lip',points,.010,m.paint);}
    tube('rocker-sill',[[side*W*.97,-.385,-d.wheelbase/2+.38],[side*W*.94,-.40,0],[side*W*.98,-.385,d.wheelbase/2-.38]],gt?.045:.027,m.dark);
    const seam:Point[]=[],outline=[[.205,.66],[-.31,.54],[-.34,-.74],[.21,-.84]];
    for(let edge=0;edge<outline.length-1;edge++)for(let i=0;i<=8;i++){const t=i/8,y=mix(outline[edge][0],outline[edge+1][0],t),z=mix(outline[edge][1],outline[edge+1][1],t);seam.push([(panelSide(body,y,z,side)??side*W)+side*.002,y,z]);}
    tube('door-shutline',seam,.0021,m.dark);
    box('flush-door-handle',.014,.023,.135,(panelSide(body,.15,-.51,side)??side*W)+side*.007,.15,-.51,m.chrome);
    tube('mirror-arm',[[side*W*.76,.30,.66],[side*(W+.04),.31,.57]],.017,m.dark);
    const mirror=MeshBuilder.CreateSphere('sculpted-mirror',{diameter:1,segments:lite?8:16},scene);mirror.scaling.set(.22,.09,.22);mirror.position.set(side*(W+.055),.33,.55);add(mirror,m.paint);
    const mirrorLens=MeshBuilder.CreateSphere('mirror-lens',{diameter:1,segments:8},scene);mirrorLens.scaling.set(.17,.058,.018);mirrorLens.position.set(side*(W+.055),.33,.455);add(mirrorLens,m.chrome);
    // Dark housings and separate light guides follow the fender sweep.
    const lampInset=design.lamp==='compact'?.43:design.lamp==='race'?.56:.38;
    const lamp:Point[][]=[onSkin([[side*lampInset,0,L-.21],[side*W*.85,0,L-.40]],.005),onSkin([[side*(lampInset+.02),0,L-.025],[side*W*.88,0,L-.23]],.005)],lampFootprint=lamp[0].concat(lamp[1].slice().reverse()).map(([x,,z])=>[x,z] as [number,number]);
    parts.push(panelDecal(scene,'recessed-headlamp',body,m.dark,lampFootprint,.003));
    // The clear cover and nested projector/reflector sit on the same authored
    // skin as the housing, avoiding the previous flat glowing cutout.
    const projectorX=side*(lampInset+(design.lamp==='compact'?.105:.145)),projectorZ=L-(design.lamp==='race'?.235:.205),projectorY=(panelHeight(body,projectorX,projectorZ)??design.shoulders.at(-1)!)+.011;
    const bezel=MeshBuilder.CreateTorus('headlamp-projector-bezel',{diameter:design.lamp==='compact'?.072:.090,thickness:.007,tessellation:lite?8:16},scene);bezel.position.set(projectorX,projectorY,projectorZ);add(bezel,m.chrome);
    const optic=MeshBuilder.CreateCylinder('headlamp-projector-optic',{height:.009,diameter:design.lamp==='compact'?.050:.064,tessellation:lite?10:20},scene);optic.position.set(projectorX,projectorY+.003,projectorZ);add(optic,m.light);
    if(!lite&&(design.lamp==='rally'||design.lamp==='race'||design.lamp==='tourer')){
      const secondaryX=projectorX+side*.125,secondaryZ=projectorZ-.055,secondaryY=(panelHeight(body,secondaryX,secondaryZ)??projectorY)+.010;
      const secondary=MeshBuilder.CreateCylinder('headlamp-secondary-optic',{height:.008,diameter:.041,tessellation:12},scene);secondary.position.set(secondaryX,secondaryY+.002,secondaryZ);add(secondary,m.light);
      const ring=MeshBuilder.CreateTorus('headlamp-secondary-bezel',{diameter:.057,thickness:.005,tessellation:12},scene);ring.position.set(secondaryX,secondaryY,secondaryZ);add(ring,m.chrome);
    }
    tube('led-signature',onSkin([[side*(lampInset+.04),0,L-.187],[side*.66,0,L-.263],[side*W*.835,0,L-.359]],.016),design.lamp==='blade'?.009:.013,m.light);
    if(design.lamp==='tourer'||design.lamp==='compact')tube('led-return',onSkin([[side*(lampInset+.05),0,L-.080],[side*.67,0,L-.225]],.016),.010,m.light);
    if(design.lamp==='rally')tube('rally-lamp-hook',onSkin([[side*W*.825,0,L-.34],[side*W*.85,0,L-.21],[side*W*.70,0,L-.12]],.016),.014,m.light);
    parts.push(panelDecal(scene,'headlamp-clear-lens',body,m.lens??m.glass,lampFootprint,.019));
    const rearY=design.shoulders[0]-.015,rearInner=d.id==='aeris'?.52:d.id==='crest'?.39:.13;
    const lampEnd=W*design.widths[0]*.92;
    tube('rear-lamp-housing',[rearTrim(side*rearInner,rearY),rearTrim(side*(rearInner+lampEnd)/2,rearY+.006),rearTrim(side*lampEnd,rearY+.005)],d.id==='aeris'?.035:.025,m.dark);
    tube('rear-light-guide',[rearTrim(side*(rearInner+.012),rearY+.007,.031),rearTrim(side*(rearInner+lampEnd)/2,rearY+.012,.031),rearTrim(side*(lampEnd-.012),rearY+.012,.031)],.009,m.tail);
    if(!lite)for(let prism=0;prism<3;prism++){
      const u=(prism+1)/4,x=mix(rearInner+.025,lampEnd-.025,u),height=.015+(prism===1?.004:0);
      tube('rear-lamp-separator',[rearTrim(side*x,rearY-height,.034),rearTrim(side*x,rearY+height,.034)],.0028,m.dark);
    }
    if(d.id==='crest')tube('rear-lamp-hook',[rearTrim(side*lampEnd,rearY,.032),rearTrim(side*lampEnd,rearY-.080,.032)],.010,m.tail);
    const exhaust=MeshBuilder.CreateTorus('exhaust-tip',{diameter:.105,thickness:.010,tessellation:lite?12:24},scene);exhaust.rotation.x=Math.PI/2;exhaust.position.set(side*rear.openingW*.79,-.30,-L+.015);add(exhaust,m.chrome);
  }
  // Recessed vanes leave the painted bumper visible around the intake.
  const grille=design.grille;
  if(d.id==='nova'){for(let i=-7;i<=7;i++)box('tourer-grille-fin',.006,.175,.018,i*grille/8,-.205,L-.028,m.chrome);}
  else for(let i=0;i<(lite?2:4);i++)box('grille-louvre',grille*1.75,.006,.018,0,-.14-i*(lite?.115:.038),L-.028,m.dark);
  tube('front-splitter',[[-W*.87,-.395,L-.13],[-W*.70,-.405,L+.045],[0,-.405,L+.095],[W*.70,-.405,L+.045],[W*.87,-.395,L-.13]],gt?.045:.021,m.dark);
  sheet('shaped-diffuser-ramp',[[[-rear.openingW,-.425,-L+.24],[0,-.425,-L+.27],[rear.openingW,-.425,-L+.24]],[[-rear.openingW*.87,-.365,-L+.015],[0,-.375,-L],[rear.openingW*.87,-.365,-L+.015]]],m.dark);
  for(let i=-2;i<=2;i++)box('diffuser-fin',.008,.055,.19,i*.16,-.406,-L+.065,m.dark);
  const plate=box('rear-registration-panel',.28,.068,.010,0,-.060,(fasciaDepth(rear.panel,0,-.060,-1)??-L)-.010,m.dark);
  // Original line-letter badge and plate, merged into existing trim materials.
  const glyphs=[[[0,0,0,1],[0,.5,.65,1],[0,.5,.65,0]],[[0,0,.32,1],[.32,1,.65,0],[.12,.4,.53,.4]],[[.1,1,.55,1],[.32,1,.32,0],[.1,0,.55,0]],[[0,0,0,1],[0,1,.6,1],[.6,1,.6,.55],[.6,.55,0,.55],[.3,.55,.65,0]],[[0,0,0,1],[0,1,.65,1],[.65,1,.65,0],[.65,0,0,0]],[[.65,1,0,1],[0,1,0,.5],[0,.5,.65,.5],[.65,.5,.65,0],[.65,0,0,0]]];
  if(!lite)for(const [letter,strokes]of glyphs.entries())for(const [x0,y0,x1,y1]of strokes){const x=(letter-2.5)*.039-.013,dx=(x1-x0)*.029,dy=(y1-y0)*.027,len=Math.hypot(dx,dy),ox=-dy/len*.0014,oy=dx/len*.0014;
    sheet('kairos-tail-badge',[[rearTrim(x+x0*.029-ox,.09+y0*.027-oy,.004),rearTrim(x+x0*.029+ox,.09+y0*.027+oy,.004)],[rearTrim(x+x1*.029-ox,.09+y1*.027-oy,.004),rearTrim(x+x1*.029+ox,.09+y1*.027+oy,.004)]],m.chrome);
    sheet('kairos-registration-letter',[[[x+x0*.029-ox,-.074+y0*.027-oy,plate.position.z-.006],[x+x0*.029+ox,-.074+y0*.027+oy,plate.position.z-.006]],[[x+x1*.029-ox,-.074+y1*.027-oy,plate.position.z-.006],[x+x1*.029+ox,-.074+y1*.027+oy,plate.position.z-.006]]],m.chrome);
  }
  box('front-badge',.058,.019,.015,0,.035,L+.019,m.chrome);
  if(gt){
    const wing:Point[][]=[];for(let i=0;i<=8;i++){const u=i/8;wing.push([[-W*.96,.50+.11*Math.sin(u*Math.PI),-L-.17+u*.38],[0,.48+.10*Math.sin(u*Math.PI),-L-.22+u*.43],[W*.96,.50+.11*Math.sin(u*Math.PI),-L-.17+u*.38]]);}
    sheet('gt-curved-rear-wing',wing,m.dark);for(const side of [-1,1]){box('wing-endplate',.026,.18,.40,side*W*.96,.54,-L+.02,m.paint);tube('swan-neck',[[side*.46,.22,-L+.30],[side*.46,.64,-L+.18],[side*.46,.66,-L-.035],[side*.46,.58,-L-.06]],.022,m.dark);}
    for(const side of [-1,1]){for(let slot=0;slot<(lite?2:5);slot++)tube('fender-extractor',[[side*.75,.30,d.wheelbase/2-.15-slot*.06],[side*.87,.283,d.wheelbase/2-.16-slot*.06]],.009,m.dark);tube('front-diveplane',[[side*W*.9,-.26,L-.05],[side*W*1.035,-.21,L-.19],[side*W*1.02,-.14,L-.39]],.018,m.dark);}
  }else if(d.id==='crest'){box('roof-spoiler',W*1.35,.040,.20,0,roof-.065,backRoof-.075,m.paint);}
  else tube('integrated-rear-lip',[[-W*.81,design.shoulders[0]+.016,-L+.04],[0,design.centres[0]+.02,-L-.008],[W*.81,design.shoulders[0]+.016,-L+.04]],.014,m.paint);
  const dashDrop=gt?.06:0;
  box('instrument-binnacle',.28,.12,.08,-.34,.29-dashDrop,.50,m.dark);box('driver-instruments',.225,.098,.008,-.34,.291-dashDrop,.455,m.instruments??m.dark);
  if(!lite){box('centre-display',.135,.086,.015,.06,.275-dashDrop,.495,m.dark);for(const side of [-1,1])for(let i=0;i<3;i++)box('dash-vent',.032,.032,.012,side*.54+i*.046,.27-dashDrop,.485,m.dark);}
  const steeringY=gt?.14:.20,steeringRadius=gt?.13:.15;
  const steering=MeshBuilder.CreateTorus('steering-wheel',{diameter:steeringRadius*2,thickness:.027,tessellation:lite?10:20},scene);steering.rotation.x=Math.PI/2.5;steering.position.set(-.34,steeringY,.43);steeringPart(add(steering,m.dark));
  const boss=MeshBuilder.CreateCylinder('steering-boss',{diameter:.075,height:.04,tessellation:12},scene);boss.rotation.x=Math.PI/2;boss.position.set(-.34,steeringY,.414);steeringPart(add(boss,m.dark));
  for(const a of [Math.PI,Math.PI*.43,Math.PI*1.57])steeringPart(tube('steering-spoke',[[-.34,steeringY,.43],[-.34+Math.sin(a)*steeringRadius*.88,steeringY+Math.cos(a)*steeringRadius*.84,.43-Math.cos(a)*steeringRadius*.27]],.009,m.dark));
  if(!lite){
    steeringPart(box('steering-centre-badge',.038,.038,.012,-.34,steeringY,.388,m.accent??m.chrome));
    const marker=steeringPart(box('steering-top-marker',.044,.014,.018,-.34,steeringY+steeringRadius*.84,.43-steeringRadius*.27,m.accent??m.chrome));marker.rotation.x=Math.PI/2.5;
    for(const side of [-1,1]){const paddle=steeringPart(box('steering-paddle',.025,.095,.012,-.34+side*steeringRadius*.72,steeringY-.003,.463,m.chrome));paddle.rotation.x=Math.PI/2.5;}
  }
  if(livery>0)for(const x of livery===1?[-.19,.19]:[0]){
    const w=livery===1?.10:.32,mat=m.accent??m.chrome;
    parts.push(panelStripe(scene,'bonnet-livery',body,mat,x,w,frontBase+.05,L-.02),panelStripe(scene,'deck-livery',body,mat,x,w,-L+.03,cabinRear-.04),panelStripe(scene,'roof-livery',roofPanel,mat,x,w,backRoof+.02,frontRoof-.02));
  }
  m.glass.alpha=.64;m.glass.transparencyMode=PBRMaterial.PBRMATERIAL_ALPHABLEND;m.glass.backFaceCulling=false;m.glass.twoSidedLighting=true;m.glass.albedoColor=Color3.FromHexString('#23353e').toLinearSpace();m.glass.roughness=.17;
  return {parts,body,roofHeight:roof};
}
