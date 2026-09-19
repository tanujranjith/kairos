import { Scene, TransformNode, Mesh, MeshBuilder, VertexData, Vector3, PBRMaterial, Color3, Material } from '@babylonjs/core';
import type { VehicleDefinition, VehicleState, Customization, Quality } from '../core/types';
import { instantiateCarAsset } from './car-assets';
import { roadCoachwork } from './coachwork';

type Section=[number,number,number,number]; // longitudinal coordinate, half width, lower edge, upper edge
function loft(name:string,sections:Section[],scene:Scene,mat:Material,round=.13,arch?:{wheelbase:number;radius:number},lite=false){
  const positions:number[]=[],indices:number[]=[],normals:number[]=[];
  const rings:Section[]=[],steps=lite?3:8;
  const cubic=(a:number,b:number,c:number,d:number,t:number)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
  for(let i=0;i<sections.length-1;i++)for(let j=0;j<steps;j++){
    const a=sections[Math.max(0,i-1)],b=sections[i],c=sections[i+1],d=sections[Math.min(sections.length-1,i+2)],t=j/steps;
    rings.push([b[0]+(c[0]-b[0])*t,...[1,2,3].map(k=>cubic(a[k],b[k],c[k],d[k],t))] as Section);
  }rings.push(sections[sections.length-1]);
  const segments=lite?16:32;
  for(const [z,w,b,t] of rings){
    let bottom=b;if(arch){const dz=Math.min(Math.abs(z-arch.wheelbase*.5),Math.abs(z+arch.wheelbase*.5));if(dz<arch.radius)bottom=Math.max(b,-.32+Math.sqrt(arch.radius*arch.radius-dz*dz));}
    const perimeter=[[-w+round,bottom],[-w,bottom+Math.min(round,(t-bottom)*.25)],[-w,t-round*.62],[-w*.76,t],[w*.76,t],[w,t-round*.62],[w,bottom+Math.min(round,(t-bottom)*.25)],[w-round,bottom]];
    for(let k=0;k<segments;k++){const u=k/segments*8,i=Math.floor(u),f=u-i,a=perimeter[(i+7)%8],b=perimeter[i],c=perimeter[(i+1)%8],d=perimeter[(i+2)%8];positions.push(cubic(a[0],b[0],c[0],d[0],f),cubic(a[1],b[1],c[1],d[1],f),z);}
  }
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){const a=j*segments+i,b=j*segments+(i+1)%segments,c=a+segments,d=b+segments;indices.push(a,b,c,b,d,c);}
  for(let i=1;i<segments-1;i++){indices.push(0,i+1,i);const o=(rings.length-1)*segments;indices.push(o,o+i,o+i+1);}
  VertexData.ComputeNormals(positions,indices,normals);const mesh=new Mesh(name,scene);const data=new VertexData();data.positions=positions;data.indices=indices;data.normals=normals;data.uvs=positions.flatMap((_,i)=>i%3===0?[positions[i],positions[i+2]]:[]);data.applyToMesh(mesh);mesh.material=mat;return mesh;
}
export interface CarVisual {root:TransformNode;groundOffset:number;wheels:TransformNode[];paint:PBRMaterial;glass:PBRMaterial;lights:PBRMaterial;tail:PBRMaterial;parts:Mesh[];readonly lod?:0|1;selectDetail?:(distance:number,quality:Quality)=>void;update:(s:VehicleState)=>void;dispose:()=>void}
export function createCar(scene:Scene,d:VehicleDefinition,setup?:Customization,lite=false):CarVisual {
  const asset=instantiateCarAsset(scene,d,setup,lite);if(asset)return asset;
  const root=new TransformNode(`visual-${d.id}`,scene),mats:PBRMaterial[]=[];root.metadata={kairosCar:true};
  const material=(name:string,color:string,metallic:number,roughness:number)=>{const m=new PBRMaterial(`${d.id}-${name}`,scene);m.albedoColor=Color3.FromHexString(color).toLinearSpace();m.metallic=metallic;m.roughness=roughness;mats.push(m);return m;};
  const paint=material('paint',setup?.paint??d.color,.68,.25);paint.clearCoat.isEnabled=true;paint.clearCoat.intensity=1;paint.clearCoat.roughness=.07;
  const dark=material('carbon','#24292c',.08,.58),glass=material('glass','#151c23',.05,.065),chrome=material('alloy',setup?.wheels??'#9baab4',.9,.19),rubber=material('rubber','#27282a',0,.94);
  glass.clearCoat.isEnabled=true;glass.clearCoat.intensity=1;glass.indexOfRefraction=1.52;
  const light=material('headlight','#c8edff',.1,.16);light.emissiveColor=new Color3(.5,.7,.9);
  const tail=material('taillight','#cf1c2b',.1,.18);tail.emissiveColor=new Color3(.7,.015,.015);
  const accent=material('accent',d.class==='GT'?'#298fad':'#d9e3de',.45,.25);
  const staticParts:Mesh[]=[];const add=(m:Mesh)=>{staticParts.push(m);return m;};
  function box(name:string,w:number,h:number,l:number,x:number,y:number,z:number,mat:Material){const m=MeshBuilder.CreateBox(name,{width:w,height:h,depth:l},scene);m.position.set(x,y,z);m.material=mat;return add(m);}
  function tube(name:string,points:Vector3[],radius:number,mat:Material){const m=MeshBuilder.CreateTube(name,{path:points,radius,tessellation:6},scene);m.material=mat;return add(m);}
  const W=d.width*.5,L=d.length*.5;
  if(d.class==='FORMULA'){
    add(loft('monocoque',[[-L,.36,-.21,.13],[-1.35,.48,-.26,.40],[0,.40,-.25,.31],[1.2,.19,-.15,.18],[L,.13,-.12,.09]],scene,paint,.045,undefined,lite));
    for(const side of [-1,1]){
      const pod=loft('sidepod',[[-1.65,.29,-.19,.15],[-.4,.36,-.23,.22],[.55,.17,-.23,.16]],scene,paint,.05,undefined,lite);pod.position.x=side*.54;add(pod);
      box('intake',.24,.18,.15,side*.50,.14,.40,dark);
      for(const z of [-d.wheelbase*.5,d.wheelbase*.5]){tube('wishbone',[new Vector3(side*.27,-.12,z+.25),new Vector3(side*d.track*.5,-.25,z),new Vector3(side*.3,-.20,z-.3)],.024,dark);}
      box('front-endplate',.05,.26,.56,side*.91,-.13,L-.12,paint);
      box('rear-endplate',.045,.38,.5,side*.84,.62,-L+.08,paint);
    }
    box('floor',1.5,.045,2.8,0,-.27,-.4,dark);box('front-wing',1.87,.045,.37,0,-.18,L-.12,dark);box('front-wing-upper',1.7,.055,.18,0,-.08,L-.23,paint);
    box('rear-wing',1.72,.10,.48,0,.67,-L+.1,paint);box('rear-wing-support',.10,.59,.11,0,.3,-L+.1,dark);
    box('cockpit',.50,.04,.84,0,.34,-.23,dark);box('seat',.35,.30,.30,0,.44,-.56,dark);
    tube('halo',[new Vector3(-.33,.35,-.55),new Vector3(-.34,.61,.18),new Vector3(0,.65,.39),new Vector3(.34,.61,.18),new Vector3(.33,.35,-.55)],.038,dark);
    tube('halo-pillar',[new Vector3(0,.29,.49),new Vector3(0,.65,.39)],.035,dark);
    add(loft('engine-cover',[[-1.7,.16,.12,.24],[-.75,.19,.17,.71],[-.5,.12,.19,.7]],scene,paint,.04,undefined,lite));
    box('rain-light',.14,.14,.04,0,.03,-L-.01,tail);
  }else{
    staticParts.push(...roadCoachwork(scene,d,{paint,glass,dark,chrome,light,tail},lite).parts);
  }
  if((setup?.livery??0)>0){
    const stripe=(x:number,width:number,profile:[number,number][])=>{const mesh=MeshBuilder.CreateRibbon('livery',{pathArray:[profile.map(([z,y])=>new Vector3(x-width*.5,y+.006,z)),profile.map(([z,y])=>new Vector3(x+width*.5,y+.006,z))],sideOrientation:Mesh.DOUBLESIDE},scene);mesh.material=accent;add(mesh);};
    const centers=setup!.livery===1?[-.20,.20]:[0],width=setup!.livery===1?.12:.36;
    if(d.class==='FORMULA'){for(const x of setup!.livery===1?[-.055,.055]:[0])stripe(x,setup!.livery===1?.035:.15,[[.55,.31-.55/1.2*.13],[1.2,.18],[L,.09]]);stripe(0,.13,[[-1.7,.24],[-.75,.71],[-.5,.70]]);}
    else for(const x of centers){const roof=d.height-(.32+d.wheelRadius);stripe(x,width,[[-L,.19],[-L+.22,.245],[-1.32,.26]]);stripe(x,width,[[-.65,roof+.003],[-.30,roof+.023],[.23,roof+.003]]);stripe(x,width,[[.98,.202],[d.wheelbase*.5,.19],[L-.38,.13],[L,.048]]);}
  }
  const steering=MeshBuilder.CreateTorus('steering-wheel',{diameter:.30,thickness:.027,tessellation:16},scene);steering.rotation.x=Math.PI/2.5;steering.position.set(d.class==='FORMULA'?0:-.34,.32,.43);steering.material=dark;add(steering);
  function merge(parts:Mesh[],parent:TransformNode){const groups=new Map<Material,Mesh[]>();for(const m of parts){if(!m.material)continue;const list=groups.get(m.material)??[];list.push(m);groups.set(m.material,list);}const result:Mesh[]=[];for(const [mat,list]of groups){const m=list.length>1?Mesh.MergeMeshes(list,true,true,undefined,false,false)!:list[0];m.material=mat;m.parent=parent;m.isPickable=false;result.push(m);}return result;}
  const parts=merge(staticParts,root);
  const wheels:TransformNode[]=[];
  for(let i=0;i<4;i++){
    const node=new TransformNode(`wheel-${i}`,scene),wheelParts:Mesh[]=[];node.parent=root;node.position.set((i%2===0?-1:1)*d.track*.5,-.32,i<2?d.wheelbase*.5:-d.wheelbase*.5);
    const width=d.class==='FORMULA'?(i<2?.30:.39):d.class==='GT'?.30:.25;
    const r=d.wheelRadius,profile=[new Vector3(r*.72,-width*.5,0),new Vector3(r*.92,-width*.5,0),new Vector3(r*.99,-width*.39,0),new Vector3(r,width*.32,0),new Vector3(r*.97,width*.46,0),new Vector3(r*.86,width*.5,0),new Vector3(r*.72,width*.5,0)];
    const tire=MeshBuilder.CreateLathe('tire',{shape:profile,tessellation:lite?20:48,sideOrientation:Mesh.DOUBLESIDE},scene);tire.rotation.z=Math.PI/2;tire.material=rubber;wheelParts.push(tire);
    for(const side of [-1,1]){
      const rim=MeshBuilder.CreateCylinder('brake-disc',{height:.015,diameter:d.wheelRadius*1.28,tessellation:lite?20:40},scene);rim.rotation.z=Math.PI/2;rim.position.x=side*(width*.5-.028);rim.material=chrome;wheelParts.push(rim);
      const ring=(name:string,radius:number,thickness:number,x:number,mat:Material)=>{const steps=lite?20:40,path=Array.from({length:steps+1},(_,i)=>new Vector3(x,Math.cos(i/steps*Math.PI*2)*radius,Math.sin(i/steps*Math.PI*2)*radius));const mesh=MeshBuilder.CreateTube(name,{path,radius:thickness/2,tessellation:lite?4:6},scene);mesh.material=mat;wheelParts.push(mesh);};
      ring('rim-barrel',r*.695,.035,side*(width*.5-.005),dark);
      const hub=MeshBuilder.CreateCylinder('hub',{height:.03,diameter:.12,tessellation:12},scene);hub.rotation.z=Math.PI/2;hub.position.x=side*(width*.5+.022);hub.material=chrome;wheelParts.push(hub);
      ring('forged-rim-lip',r*.715,.021,side*(width*.5+.018),chrome);
      for(let s=0;s<10;s++){const a=s*Math.PI*.2+(s%2)*.065;const spoke=MeshBuilder.CreateBox('forged-spoke',{width:.038,height:r*.61,depth:.025},scene);spoke.rotation.x=a;spoke.position.set(side*(width*.5+.026),Math.cos(a)*r*.36,Math.sin(a)*r*.36);spoke.material=chrome;wheelParts.push(spoke);}
    }
    parts.push(...merge(wheelParts,node));wheels.push(node);
  }
  return {root,groundOffset:.32+d.wheelRadius,wheels,paint,glass,lights:light,tail,parts,
    update(s){wheels.forEach((w,i)=>{w.position.y=-(.32+d.travel*.5-s.wheels[i].compression);w.rotation.set(s.wheels[i].angle,i<2?s.steer:0,0);});tail.emissiveColor.r=s.absActive?.95:.5;},
    dispose(){root.dispose();mats.forEach(m=>m.dispose());}
  };
}
