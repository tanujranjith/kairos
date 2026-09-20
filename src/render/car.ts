import { Scene, TransformNode, Mesh, MeshBuilder, Vector3, PBRMaterial, Color3, Material } from '@babylonjs/core';
import type { VehicleDefinition, VehicleState, Customization, Quality } from '../core/types';
import { instantiateCarAsset } from './car-assets';
import { roadCoachwork } from './coachwork';
import { formulaCoachwork } from './formula-coachwork';
import { carInstruments } from './car-instruments';

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
  const instruments=d.class==='FORMULA'?carInstruments(scene,d):undefined;if(instruments)mats.push(instruments.material);
  const staticParts:Mesh[]=[];const add=(m:Mesh)=>{staticParts.push(m);return m;};
  const L=d.length*.5;
  if(d.class==='FORMULA'){
    staticParts.push(...formulaCoachwork(scene,d,{paint,dark,chrome,light,tail,accent,instruments:instruments!.material},lite,setup?.livery??0).parts);
  }else{
    staticParts.push(...roadCoachwork(scene,d,{paint,glass,dark,chrome,light,tail},lite).parts);
  }
  if(d.class!=='FORMULA'&&(setup?.livery??0)>0){
    const stripe=(x:number,width:number,profile:[number,number][])=>{const mesh=MeshBuilder.CreateRibbon('livery',{pathArray:[profile.map(([z,y])=>new Vector3(x-width*.5,y+.006,z)),profile.map(([z,y])=>new Vector3(x+width*.5,y+.006,z))],sideOrientation:Mesh.DOUBLESIDE},scene);mesh.material=accent;add(mesh);};
    const centers=setup!.livery===1?[-.20,.20]:[0],width=setup!.livery===1?.12:.36;
    for(const x of centers){const roof=d.height-(.32+d.wheelRadius);stripe(x,width,[[-L,.19],[-L+.22,.245],[-1.32,.26]]);stripe(x,width,[[-.65,roof+.003],[-.30,roof+.023],[.23,roof+.003]]);stripe(x,width,[[.98,.202],[d.wheelbase*.5,.19],[L-.38,.13],[L,.048]]);}
  }
  if(d.class!=='FORMULA'){const steering=MeshBuilder.CreateTorus('steering-wheel',{diameter:.30,thickness:.027,tessellation:16},scene);steering.rotation.x=Math.PI/2.5;steering.position.set(-.34,.32,.43);steering.material=dark;add(steering);}
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
    update(s){wheels.forEach((w,i)=>{w.position.y=-(.32+d.travel*.5-s.wheels[i].compression);w.rotation.set(s.wheels[i].angle,i<2?s.steer:0,0);});tail.emissiveColor.r=s.absActive?.95:.5;if(root.isEnabled())instruments?.update(s);},
    dispose(){root.dispose();instruments?.dispose();mats.forEach(m=>m.dispose());}
  };
}
