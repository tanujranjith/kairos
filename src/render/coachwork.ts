import { Color3, Mesh, MeshBuilder, PBRMaterial, Vector3, VertexData, type Material, type Scene } from '@babylonjs/core';
import type { VehicleDefinition } from '../core/types';

type Point=[number,number,number];
type Station=[number,number,number,number]; // z, half-width, shoulder, centre height
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(a:number,b:number,c:number,d:number,t:number)=>.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);

/** Original continuous body surfaces, separate glazing and inset trim. Metres, +Z nose. */
export function roadCoachwork(scene:Scene,d:VehicleDefinition,m:{paint:PBRMaterial;glass:PBRMaterial;dark:PBRMaterial;chrome:PBRMaterial;light:PBRMaterial;tail:PBRMaterial},lite:boolean){
  const parts:Mesh[]=[],W=d.width/2,L=d.length/2,roof=d.height-(.32+d.wheelRadius),gt=d.class==='GT';
  const add=(mesh:Mesh,material:Material)=>{mesh.material=material;parts.push(mesh);return mesh;};
  const box=(name:string,w:number,h:number,l:number,x:number,y:number,z:number,material:Material)=>{const mesh=MeshBuilder.CreateBox(name,{width:w,height:h,depth:l},scene);mesh.position.set(x,y,z);return add(mesh,material);};
  const tube=(name:string,points:Point[],radius:number,material:Material)=>add(MeshBuilder.CreateTube(name,{path:points.map(p=>Vector3.FromArray(p)),radius,tessellation:lite?4:8},scene),material);
  const sheet=(name:string,rows:Point[][],material:Material)=>{
    const positions=rows.flat(2),indices:number[]=[],normals:number[]=[],uvs:number[]=[],width=rows[0].length;
    for(let j=0;j<rows.length;j++)for(let i=0;i<width;i++){uvs.push(i/(width-1),j/(rows.length-1));if(j<rows.length-1&&i<width-1){const a=j*width+i;indices.push(a,a+1,a+width,a+1,a+width+1,a+width);}}
    VertexData.ComputeNormals(positions,indices,normals);
    if(name==='recessed-headlamp'&&normals.filter((_,i)=>i%3===1).reduce((a,b)=>a+b,0)<0){for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];VertexData.ComputeNormals(positions,indices,normals);}
    const data=new VertexData();data.positions=positions;data.indices=indices;data.normals=normals;data.uvs=uvs;const mesh=new Mesh(name,scene);data.applyToMesh(mesh);return add(mesh,material);
  };
  const stations:Station[]=[[-L,W*.84,.14,.17],[-L+.22,W*.98,.22,.22],[-d.wheelbase/2,W,.27,.24],[-.65,W*.92,.24,.22],[.20,W*.92,.22,.20],[d.wheelbase/2,W*.99,.24,.16],[L-.38,W*.94,.14,.10],[L,W*.80,-.015,.025]];
  const rows:Point[][]=[];
  for(let k=0;k<stations.length-1;k++)for(let j=0;j<(lite?4:10);j++){
    const t=j/(lite?4:10),a=stations[Math.max(0,k-1)],b=stations[k],c=stations[k+1],e=stations[Math.min(stations.length-1,k+2)];
    const z=mix(b[0],c[0],t),w=smooth(a[1],b[1],c[1],e[1],t),shoulder=smooth(a[2],b[2],c[2],e[2],t),centre=smooth(a[3],b[3],c[3],e[3],t);
    rows.push(section(z,w,shoulder,centre));
  }
  rows.push(section(...stations[stations.length-1]));
  function section(z:number,w:number,shoulder:number,centre:number):Point[]{
    const dz=Math.min(Math.abs(z-d.wheelbase/2),Math.abs(z+d.wheelbase/2)),radius=d.wheelRadius+.045;
    const bottom=dz<radius?-.32+Math.sqrt(radius*radius-dz*dz):-.43;
    const half:[number,number][]=[[0,centre+.015],[.36,centre+.012],[.65,centre+.01],[.83,shoulder+.008],[.94,shoulder],[.99,shoulder-.035],[1,mix(shoulder-.045,bottom,.65)],[.98,bottom],[.86,bottom-.015]];
    return [...half.slice(1).reverse().map(([x,y])=>[-x*w,y,z] as Point),...half.map(([x,y])=>[x*w,y,z] as Point)];
  }
  const body=sheet('sculpted-coachwork',rows,m.paint);
  // End caps are separate surfaces so the bumper does not smear normals across the bonnet.
  for(const end of [0,rows.length-1]){const edge=rows[end],z=edge[0][2],points=edge.map(p=>new Vector3(...p));points.push(new Vector3(0,-.43,z));const cap=MeshBuilder.CreateRibbon('bumper-cap',{pathArray:[points,points.map(()=>new Vector3(0,-.18,z))],sideOrientation:Mesh.DOUBLESIDE},scene);add(cap,m.paint);}
  box('undertray',d.width*.82,.045,d.length*.85,0,-.42,0,m.dark);

  const cabinRear=d.id==='crest'?-1.13:-1.30,backRoof=-.65,frontRoof=.23,frontBase=.94;
  // Bowed windscreen/backlight and crowned roof, rather than a solid glass box.
  const span=(z:number,y:number,width:number,crown:number):Point[]=>Array.from({length:lite?9:17},(_,i)=>{const u=i/(lite?8:16)*2-1;return [u*width,y+crown*(1-u*u),z] as Point;});
  const windshield:Point[][]=[],rearGlass:Point[][]=[],roofRows:Point[][]=[];
  for(let i=0;i<=8;i++){const t=i/8;windshield.push(span(mix(frontBase,frontRoof,t),mix(.22,roof-.03,t)+Math.sin(t*Math.PI)*.016,mix(W*.77,W*.61,t),.025));rearGlass.push(span(mix(backRoof,cabinRear,t),mix(roof-.045,.245,t),mix(W*.62,W*.78,t),.018));roofRows.push(span(mix(backRoof,frontRoof,t),roof-.024+Math.sin(t*Math.PI)*.018,W*(.61+Math.sin(t*Math.PI)*.035),.025));}
  sheet('panoramic-windscreen',windshield,m.glass);sheet('fastback-backlight',rearGlass,m.glass);sheet('crowned-roof',roofRows,m.paint);
  sheet('interior-headliner',[...roofRows].reverse().map(row=>row.map(([x,y,z])=>[x,y-.028,z] as Point)),m.dark);
  for(const side of [-1,1]){
    const corners:Point[]=[[side*W*.785,.255,cabinRear],[side*W*.623,roof-.026,backRoof],[side*W*.615,roof-.010,frontRoof],[side*W*.778,.238,frontBase]];
    sheet('side-glazing',[[corners[0],corners[3]],[corners[1],corners[2]]],m.glass);
    tube('window-surround',[...corners,corners[0]],.023,m.paint);
    tube('window-rubber',[corners[0],corners[3]],.009,m.dark);
    tube('b-pillar',[[side*W*.64,roof-.008,-.49],[side*W*.78,.248,-.51]],.027,m.dark);
    // Fender lips follow the tire aperture and leave the suspension clearance open.
    for(const zc of [-d.wheelbase/2,d.wheelbase/2]){const points:Point[]=[];for(let k=0;k<=20;k++){const a=k/20*Math.PI;points.push([side*W*.996,-.32+Math.sin(a)*(d.wheelRadius+.051),zc+Math.cos(a)*(d.wheelRadius+.051)]);}tube('rolled-fender-lip',points,.012,m.paint);}
    tube('rocker-sill',[[side*W*.97,-.385,-d.wheelbase/2+.38],[side*W*.94,-.40,0],[side*W*.98,-.385,d.wheelbase/2-.38]],gt?.045:.027,m.dark);
    tube('door-shutline',[[side*W*.926,.205,.66],[side*W*.975,-.31,.54],[side*W*.969,-.34,-.74],[side*W*.937,.21,-.84]],.0028,m.dark);
    box('flush-door-handle',.014,.023,.135,side*W*.936,.15,-.51,m.chrome);
    tube('mirror-arm',[[side*W*.76,.30,.66],[side*(W+.04),.31,.57]],.017,m.dark);
    const mirror=MeshBuilder.CreateSphere('sculpted-mirror',{diameter:1,segments:lite?8:16},scene);mirror.scaling.set(.22,.09,.22);mirror.position.set(side*(W+.055),.33,.55);add(mirror,m.paint);
    const mirrorLens=MeshBuilder.CreateSphere('mirror-lens',{diameter:1,segments:8},scene);mirrorLens.scaling.set(.17,.058,.018);mirrorLens.position.set(side*(W+.055),.33,.455);add(mirrorLens,m.chrome);
    // Dark housings and separate light guides follow the fender sweep.
    const lamp:Point[][]=[[[side*.39,.101,L-.21],[side*W*.85,.157,L-.40]],[[side*.41,.041,L-.025],[side*W*.88,.074,L-.23]]];
    sheet('recessed-headlamp',lamp,m.dark);
    tube('led-signature',[[side*.43,.094,L-.187],[side*.64,.116,L-.263],[side*W*.835,.141,L-.359]],.013,m.light);
    tube('led-return',[[side*.44,.063,L-.080],[side*.60,.079,L-.151]],.008,m.light);
    box('side-intake',.25,.19,.028,side*W*.68,-.21,L-.008,m.dark);
    if(!lite)for(let k=0;k<3;k++)box('intake-louvre',.22,.011,.035,side*W*.68,-.28+k*.055,L+.012,m.dark);
    tube('rear-lamp-housing',[[side*.13,.143,-L-.010],[side*W*.82,.148,-L-.004]],.043,m.dark);
    tube('rear-light-guide',[[side*.17,.160,-L-.041],[side*W*.81,.168,-L-.034]],.013,m.tail);
    const exhaust=MeshBuilder.CreateTorus('exhaust-tip',{diameter:.112,thickness:.013,tessellation:lite?12:24},scene);exhaust.rotation.x=Math.PI/2;exhaust.position.set(side*.64,-.33,-L-.048);add(exhaust,m.chrome);
    box('exhaust-recess',.16,.125,.04,side*.64,-.325,-L-.012,m.dark);
  }
  // Broad, inset trapezoidal grille. Thin louvres catch light without covering the opening.
  sheet('front-grille',[[[-.47,-.10,L+.018],[.47,-.10,L+.018]],[[-.56,-.335,L+.023],[.56,-.335,L+.023]]],m.dark);
  for(let i=0;i<(lite?3:6);i++)box('grille-louvre',.91+i*.014,.009,.027,0,-.12-i*(lite?.083:.038),L+.032,m.dark);
  tube('front-splitter',[[-W*.87,-.395,L-.13],[-W*.70,-.405,L+.045],[0,-.405,L+.095],[W*.70,-.405,L+.045],[W*.87,-.395,L-.13]],gt?.045:.021,m.dark);
  box('rear-diffuser',1.15,.17,.15,0,-.345,-L+.025,m.dark);
  for(let i=-3;i<=3;i++)box('diffuser-fin',.012,.15,.29,i*.14,-.39,-L+.026,m.dark);
  box('rear-registration-inset',.31,.082,.014,0,-.11,-L-.014,m.dark);
  box('front-badge',.058,.019,.015,0,.035,L+.019,m.chrome);
  if(gt){box('gt-rear-wing',d.width*.94,.055,.36,0,.54,-L+.01,m.dark);for(const side of [-1,1]){box('wing-endplate',.032,.20,.40,side*W*.94,.54,-L+.01,m.paint);box('swan-neck',.035,.36,.07,side*.46,.38,-L+.13,m.dark);}}
  else tube('integrated-rear-lip',[[-W*.84,.225,-L+.045],[0,.236,-L-.008],[W*.84,.225,-L+.045]],.016,m.paint);
  // Visible interior: low dash, bolstered seats and door cards. Shared trim material.
  box('cockpit-floor',1.30,.05,1.75,0,-.32,-.12,m.dark);box('dashboard',1.35,.115,.28,0,.21,.65,m.dark);
  box('centre-console',.17,.18,.83,0,-.12,-.08,m.dark);
  for(const side of [-1,1]){
    const cushion=MeshBuilder.CreateSphere('seat-cushion',{diameter:1,segments:lite?8:16},scene);cushion.scaling.set(.40,.14,.46);cushion.position.set(side*.36,-.12,-.39);add(cushion,m.dark);
    const back=MeshBuilder.CreateSphere('bucket-seat-back',{diameter:1,segments:lite?8:16},scene);back.scaling.set(.40,.53,.13);back.position.set(side*.36,.17,-.65);back.rotation.x=-.13;add(back,m.dark);
    box('seat-headrest',.19,.15,.08,side*.36,.43,-.675,m.dark);
    for(const edge of [-1,1])tube('seat-bolster',[[side*.36+edge*.16,-.11,-.20],[side*.36+edge*.17,.09,-.56],[side*.36+edge*.13,.36,-.65]],.038,m.dark);
    box('door-card',.06,.29,1.18,side*.71,-.07,-.08,m.dark);
  }
  if(!lite){for(const x of [-.40,-.25]){const gauge=MeshBuilder.CreateTorus('instrument-bezel',{diameter:.088,thickness:.006,tessellation:20},scene);gauge.rotation.x=Math.PI/2.2;gauge.position.set(x,.281,.465);add(gauge,m.chrome);}box('instrument-display',.09,.035,.012,0,.264,.497,m.light);}
  m.glass.alpha=.64;m.glass.transparencyMode=PBRMaterial.PBRMATERIAL_ALPHABLEND;m.glass.backFaceCulling=false;m.glass.twoSidedLighting=true;m.glass.albedoColor=Color3.FromHexString('#23353e').toLinearSpace();m.glass.roughness=.17;
  return {parts,body,roofHeight:roof};
}
