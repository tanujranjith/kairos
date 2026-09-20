import { Scene, TransformNode, Mesh, PBRMaterial, Color3, Material } from '@babylonjs/core';
import type { VehicleDefinition, VehicleState, Customization, Quality } from '../core/types';
import { instantiateCarAsset } from './car-assets';
import { roadCoachwork } from './coachwork';
import { formulaCoachwork } from './formula-coachwork';
import { carInstruments } from './car-instruments';
import { wheelModel } from './wheel-model';

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
  const brake=material('brake-rotor','#74777b',.82,.52);
  const instruments=carInstruments(scene,d);mats.push(instruments.material);
  const staticParts:Mesh[]=[];
  if(d.class==='FORMULA'){
    staticParts.push(...formulaCoachwork(scene,d,{paint,dark,chrome,light,tail,accent,instruments:instruments!.material},lite,setup?.livery??0).parts);
  }else{
    staticParts.push(...roadCoachwork(scene,d,{paint,glass,dark,chrome,light,tail,accent,instruments:instruments.material},lite,setup?.livery??0).parts);
  }
  function merge(parts:Mesh[],parent:TransformNode){const groups=new Map<Material,Mesh[]>();for(const m of parts){if(!m.material)continue;const list=groups.get(m.material)??[];list.push(m);groups.set(m.material,list);}const result:Mesh[]=[];for(const [mat,list]of groups){const m=list.length>1?Mesh.MergeMeshes(list,true,true,undefined,false,false)!:list[0];m.material=mat;m.parent=parent;m.isPickable=false;result.push(m);}return result;}
  const parts=merge(staticParts,root);
  const display=parts.find(p=>p.material===instruments.material);
  const wheels:TransformNode[]=[],brakes:TransformNode[]=[];
  for(let i=0;i<4;i++){
    const node=new TransformNode(`wheel-${i}`,scene);node.parent=root;node.position.set((i%2===0?-1:1)*d.track*.5,-.32,i<2?d.wheelbase*.5:-d.wheelbase*.5);
    const model=wheelModel(scene,d,i,{rubber,alloy:chrome,brake,accent},lite);parts.push(...merge(model.parts,node));wheels.push(node);
    if(model.caliper){const mount=new TransformNode(`brake-${i}`,scene);mount.parent=root;mount.position.copyFrom(node.position);parts.push(...merge([model.caliper],mount));brakes[i]=mount;}
  }
  return {root,groundOffset:.32+d.wheelRadius,wheels,paint,glass,lights:light,tail,parts,
    update(s){wheels.forEach((w,i)=>{w.position.y=-(.32+d.travel*.5-s.wheels[i].compression);w.rotation.set(s.wheels[i].angle,i<2?s.steer:0,0);if(brakes[i]){brakes[i].position.copyFrom(w.position);brakes[i].rotation.set(0,i<2?s.steer:0,0);}});tail.emissiveColor.r=s.absActive?.95:.5;if(root.isEnabled()&&display?.isVisible)instruments.update(s);},
    dispose(){root.dispose();instruments?.dispose();mats.forEach(m=>m.dispose());}
  };
}
