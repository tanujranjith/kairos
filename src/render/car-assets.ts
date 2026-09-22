import { LoadAssetContainerAsync, type AssetContainer, Scene, TransformNode, Mesh, InstancedMesh, PBRMaterial, Color3, Quaternion } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import type { VehicleDefinition, Customization } from '../core/types';
import type { CarVisual } from './car';
import { carInstruments } from './car-instruments';
import { finishCarTrim,finishCarPaint } from './car-materials';
import {updateSteeringVisual} from './car-steering';
import {modelAssetUrl} from './asset-version';
const libraries=new WeakMap<Scene,Map<string,AssetContainer>>();
let staticInstance=0;
export const SHARED_CAR_MODEL='velara';
export const visualModelId=(_vehicleId:string)=>SHARED_CAR_MODEL;

export async function loadCarAssets(scene:Scene,_ids:string[]){
  const library=libraries.get(scene)??new Map<string,AssetContainer>();libraries.set(scene,library);
  await Promise.all([0,1].map(async lod=>{try{const container=await LoadAssetContainerAsync(modelAssetUrl(SHARED_CAR_MODEL,lod),scene);library.set(`${SHARED_CAR_MODEL}:${lod}`,container);}catch(error){console.warn(`Kairos: using original procedural fallback for shared ${SHARED_CAR_MODEL} LOD${lod}`,error);}}));
}
export function instantiateCarAsset(scene:Scene,d:VehicleDefinition,setup?:Customization,lite=false):CarVisual|null{
  const modelId=visualModelId(d.id),container=libraries.get(scene)?.get(`${modelId}:${lite?1:0}`);if(!container)return null;
  const root=new TransformNode(`visual-${d.id}`,scene),entry=container.instantiateModelsToScene(name=>`${d.id}-instance-${name}`,true,{doNotInstantiate:true});root.metadata={kairosCar:true,visualModel:modelId,handlingProfile:d.id};entry.rootNodes.forEach(n=>n.parent=root);
  const parts=root.getChildMeshes().filter((m):m is Mesh=>m instanceof Mesh),nodes=root.getChildTransformNodes(),wheels=Array.from({length:4},(_,i)=>nodes.find(n=>n.name.endsWith(`wheel-${i}`))!);
  const brakes=Array.from({length:4},(_,i)=>nodes.find(n=>n.name.endsWith(`brake-${i}`)));
  const steering=nodes.find(node=>node.name.endsWith('steering-pivot'));if(steering&&!steering.rotationQuaternion)steering.rotationQuaternion=Quaternion.Identity();
  const materials=[...new Set(parts.map(p=>p.material).filter((m):m is PBRMaterial=>m instanceof PBRMaterial))];
  const find=(name:string)=>materials.find(m=>m.name.includes(`${modelId}-${name}`))!;
  const trim=find('carbon');if(trim)finishCarTrim(trim);
  const paint=find('paint'),glass=find('glass')??new PBRMaterial('unused-open-wheel-glass',scene),lights=find('headlight')??find('taillight'),tail=find('taillight');if(!materials.includes(glass))materials.push(glass);
  if(!paint||!glass||!lights||!tail||wheels.some(w=>!w)){root.dispose();materials.forEach(m=>m.dispose());return null;}
  finishCarPaint(paint);paint.albedoColor=Color3.FromHexString(setup?.paint??d.color).toLinearSpace();const alloy=find('alloy');if(alloy)alloy.albedoColor=Color3.FromHexString(setup?.wheels??'#b2bac0').toLinearSpace();const accent=find('accent');if(accent&&(setup?.livery??0)>0)accent.albedoColor=Color3.FromHexString(setup?.livery===1?'#e9edf0':'#2a9bb7').toLinearSpace();parts.forEach(p=>{p.isPickable=false;p.receiveShadows=true;});
  const display=find('instruments');
  // PBRMaterial.clone also clones embedded GLB textures. The static instrument
  // image is replaced by a live display: release only this instance's clone,
  // never the asset library's source or another instance's texture.
  if(display?.emissiveTexture&&!container.textures.includes(display.emissiveTexture)){const unused=display.emissiveTexture;display.emissiveTexture=null;unused.dispose();}
  const instruments=display?carInstruments(scene,d,display):undefined;
  const displayMesh=parts.find(p=>p.material===display);
  return {root,groundOffset:.32+d.wheelRadius,wheels,paint,glass,lights,tail,parts,update(s){wheels.forEach((w,i)=>{w.position.y=-(.32+d.travel*.5-s.wheels[i].compression);w.rotation.set(s.wheels[i].angle,i<2?-s.steer:0,0);w.rotationQuaternion=null;const b=brakes[i];if(b){b.position.copyFrom(w.position);b.rotationQuaternion=null;b.rotation.set(0,i<2?-s.steer:0,0);}});if(steering)updateSteeringVisual(d,s.steer,steering.rotationQuaternion!);tail.emissiveColor.r=s.absActive?.95:.5;if(root.isEnabled()&&displayMesh?.isVisible)instruments?.update(s);},dispose(){root.dispose();instruments?.dispose();materials.forEach(m=>m.dispose());}};
}

/** Reuse the authored LOD1 container for static scenery. Babylon creates
 * hardware instances where the GLB hierarchy permits it, while every parked
 * car keeps the exact same geometry and materials as the driveable model. */
export function instantiateStaticCarAsset(scene:Scene,d:VehicleDefinition){
  const modelId=visualModelId(d.id),container=libraries.get(scene)?.get(`${modelId}:1`);if(!container)return null;
  const id=staticInstance++,root=new TransformNode(`parked-${d.id}-${id}`,scene),entry=container.instantiateModelsToScene(name=>`parked-${id}-${name}`,false,{doNotInstantiate:false});
  root.metadata={kairosCar:true,parkedCar:true,visualModel:modelId};entry.rootNodes.forEach(node=>node.parent=root);
  for(const part of root.getChildMeshes()){
    part.isPickable=false;if(part instanceof InstancedMesh)part.sourceMesh.receiveShadows=true;else part.receiveShadows=true;
    const material=part.material;if(material instanceof PBRMaterial)material.maxSimultaneousLights=6;
    const name=material?.name??'';part.metadata={...part.metadata,worldCaster:!/(glass|headlight|lamp-lens|taillight|instruments)/.test(name),parkedCar:true};
  }
  return {root,groundOffset:.32+d.wheelRadius,dispose:()=>root.dispose()};
}
