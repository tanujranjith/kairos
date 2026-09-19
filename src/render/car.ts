import { Scene, TransformNode, Mesh, MeshBuilder, VertexData, Vector3, PBRMaterial, Color3, Material } from '@babylonjs/core';
import type { VehicleDefinition, VehicleState, Customization, Quality } from '../core/types';
import { instantiateCarAsset } from './car-assets';

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
  const paint=material('paint',setup?.paint??d.color,.58,.24);paint.clearCoat.isEnabled=true;paint.clearCoat.intensity=1;paint.clearCoat.roughness=.09;
  const dark=material('carbon','#24292c',.22,.4),glass=material('glass','#151c23',.05,.065),chrome=material('alloy',setup?.wheels??'#9baab4',.9,.19),rubber=material('rubber','#27282a',0,.94);
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
    add(loft('coachwork',[[-L,.76*W,-.26,.14],[-L+.35,.96*W,-.28,.26],[-d.wheelbase*.5,W,-.27,.34],[-.4,.91*W,-.23,.25],[.6,.91*W,-.23,.24],[d.wheelbase*.5,W,-.27,.31],[L-.35,.94*W,-.24,.11],[L,.79*W,-.19,.025]],scene,paint,.10,{wheelbase:d.wheelbase,radius:d.wheelRadius+.075},lite));
    box('undertray',d.width*.70,.04,d.length*.82,0,-.27,0,dark);
    add(loft('cabin',[[-1.2,.66*W,.20,.28],[-.70,.70*W,.23,d.height-.53],[.27,.64*W,.23,d.height-.52],[.96,.73*W,.20,.27]],scene,glass,.045,undefined,lite));
    add(loft('roof',[[-.76,.61*W,d.height-.55,d.height-.49],[.24,.59*W,d.height-.54,d.height-.48]],scene,paint,.012,undefined,lite));
    box('dashboard',1.18,.20,.26,0,.20,.65,dark);box('cabin-floor',1.2,.10,1.4,0,-.11,-.1,dark);
    for(const side of [-1,1]){
      box('seat',.38,.49,.34,side*.35,.22,-.55,dark);
      tube('window-pillar',[new Vector3(side*.7*W,.26,-1.04),new Vector3(side*.62*W,d.height-.51,-.66)],.027,paint);
      tube('a-pillar',[new Vector3(side*.59*W,d.height-.51,.24),new Vector3(side*.74*W,.26,.96)],.028,paint);
      box('sill',.10,.09,d.wheelbase-.25,side*(W-.015),-.22,0,dark);
      box('doorhandle',.14,.022,.025,side*(W-.075),.18,-.24,chrome).rotation.y=Math.PI/2;
      const mirror=MeshBuilder.CreateSphere('mirror',{diameter:1,segments:lite?6:12},scene);mirror.scaling.set(.22,.095,.25);mirror.position.set(side*(W+.06),.36,.47);mirror.material=paint;add(mirror);
      box('headlight',.41,.047,.05,side*.56,.045,L-.017,light).rotation.z=side*.10;
      box('headlight-lower',.29,.03,.046,side*.61,-.017,L+.005,light);
      box('tail-light',.62,.04,.035,side*.43,.19,-L-.005,tail);
      box('front-vent',.3,.13,.033,side*.6,-.12,L+.004,dark);
      const exhaust=MeshBuilder.CreateTorus('exhaust-tip',{diameter:.105,thickness:.018,tessellation:lite?12:24},scene);exhaust.rotation.x=Math.PI/2;exhaust.position.set(side*.59,-.19,-L-.04);exhaust.material=chrome;add(exhaust);
      tube('door-shutline',[new Vector3(side*W*.973,.24,.58),new Vector3(side*W*.985,-.12,.51),new Vector3(side*W*.965,-.17,-.68),new Vector3(side*W*.983,.20,-.78)],.0045,dark);
      tube('body-crease',[new Vector3(side*(W-.07),.20,-1.6),new Vector3(side*(W-.01),.18,0),new Vector3(side*(W-.08),.10,1.7)],.009,paint);
    }
    box('front-grille',.80,.14,.06,0,-.12,L+.015,dark);box('splitter',d.width*.88,.04,.2,0,-.245,L-.07,dark);
    box('rear-diffuser',1.1,.14,.25,0,-.24,-L+.02,dark);
    for(let i=-3;i<=3;i++)box('diffuser-fin',.018,.17,.30,i*.14,-.22,-L+.02,dark);
    box('rear-light-center',.35,.019,.03,0,.19,-L-.01,tail);
    if(d.class==='GT'||d.id==='velara'){
      const y=d.class==='GT'?.70:.28;add(loft('spoiler',[[-L-.04,d.width*.43,y-.018,y],[-L+.10,d.width*.47,y-.009,y+.018],[-L+.25,d.width*.44,y-.003,y+.010]],scene,d.class==='GT'?dark:paint,.007));
      for(const side of [-1,1])box('spoiler-mount',.027,Math.max(.035,y-.18),.065,side*.5,(y+.18)/2,-L+.17,dark);
    }
  }
  if((setup?.livery??0)>0){
    const stripe=(x:number,width:number,profile:[number,number][])=>{const mesh=MeshBuilder.CreateRibbon('livery',{pathArray:[profile.map(([z,y])=>new Vector3(x-width*.5,y+.006,z)),profile.map(([z,y])=>new Vector3(x+width*.5,y+.006,z))],sideOrientation:Mesh.DOUBLESIDE},scene);mesh.material=accent;add(mesh);};
    const centers=setup!.livery===1?[-.20,.20]:[0],width=setup!.livery===1?.12:.36;
    if(d.class==='FORMULA'){for(const x of setup!.livery===1?[-.055,.055]:[0])stripe(x,setup!.livery===1?.035:.15,[[.55,.31-.55/1.2*.13],[1.2,.18],[L,.09]]);stripe(0,.13,[[-1.7,.24],[-.75,.71],[-.5,.70]]);}
    else for(const x of centers){stripe(x,width,[[-L,.14],[-L+.35,.26],[-1.3,.31]]);stripe(x,width,[[-.7,d.height-.48],[.23,d.height-.48]]);stripe(x,width,[[.98,.26],[d.wheelbase*.5,.27],[L-.35,.09],[L,.025]]);}
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
      const rim=MeshBuilder.CreateCylinder('rim',{height:.025,diameter:d.wheelRadius*1.48,tessellation:24},scene);rim.rotation.z=Math.PI/2;rim.position.x=side*(width*.5+.004);rim.material=dark;wheelParts.push(rim);
      const hub=MeshBuilder.CreateCylinder('hub',{height:.03,diameter:.12,tessellation:12},scene);hub.rotation.z=Math.PI/2;hub.position.x=side*(width*.5+.022);hub.material=chrome;wheelParts.push(hub);
      const lip=MeshBuilder.CreateTorus('forged-rim-lip',{diameter:r*1.43,thickness:.021,tessellation:lite?20:40},scene);lip.rotation.z=Math.PI/2;lip.position.x=side*(width*.5+.018);lip.material=chrome;wheelParts.push(lip);
      for(let s=0;s<10;s++){const a=s*Math.PI*.2+(s%2)*.055;const spoke=MeshBuilder.CreateBox('forged-spoke',{width:.029,height:r*.61,depth:.022},scene);spoke.rotation.x=a;spoke.position.set(side*(width*.5+.026),Math.cos(a)*r*.36,Math.sin(a)*r*.36);spoke.material=chrome;wheelParts.push(spoke);}
    }
    parts.push(...merge(wheelParts,node));wheels.push(node);
  }
  return {root,groundOffset:.32+d.wheelRadius,wheels,paint,glass,lights:light,tail,parts,
    update(s){wheels.forEach((w,i)=>{w.position.y=-(.32+d.travel*.5-s.wheels[i].compression);w.rotation.set(s.wheels[i].angle,i<2?s.steer:0,0);});tail.emissiveColor.r=s.absActive?.95:.5;},
    dispose(){root.dispose();mats.forEach(m=>m.dispose());}
  };
}
