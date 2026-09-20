import { LoadAssetContainerAsync, type AssetContainer, Scene, TransformNode, Mesh, PBRMaterial, Color3 } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import type { VehicleDefinition, Customization } from '../core/types';
import type { CarVisual } from './car';
import { carInstruments } from './car-instruments';
const libraries=new WeakMap<Scene,Map<string,AssetContainer>>();
export async function loadCarAssets(scene:Scene,ids:string[]){
  const library=libraries.get(scene)??new Map<string,AssetContainer>();libraries.set(scene,library);
  await Promise.all(ids.flatMap(id=>[0,1].map(async lod=>{try{const container=await LoadAssetContainerAsync(`/models/${id}-lod${lod}.glb`,scene);library.set(`${id}:${lod}`,container);}catch(error){console.warn(`Kairos: using original procedural fallback for ${id} LOD${lod}`,error);}})));
}
export function instantiateCarAsset(scene:Scene,d:VehicleDefinition,setup?:Customization,lite=false):CarVisual|null{
  const container=libraries.get(scene)?.get(`${d.id}:${lite?1:0}`);if(!container||(setup?.livery??0)>0)return null;
  const root=new TransformNode(`visual-${d.id}`,scene),entry=container.instantiateModelsToScene(name=>`${d.id}-instance-${name}`,true,{doNotInstantiate:true});root.metadata={kairosCar:true};entry.rootNodes.forEach(n=>n.parent=root);
  const parts=root.getChildMeshes().filter((m):m is Mesh=>m instanceof Mesh),nodes=root.getChildTransformNodes(),wheels=Array.from({length:4},(_,i)=>nodes.find(n=>n.name.endsWith(`wheel-${i}`))!);
  const materials=[...new Set(parts.map(p=>p.material).filter((m):m is PBRMaterial=>m instanceof PBRMaterial))];
  const find=(name:string)=>materials.find(m=>m.name.includes(`${d.id}-${name}`))!;
  const paint=find('paint'),glass=find('glass')??new PBRMaterial('unused-open-wheel-glass',scene),lights=find('headlight')??find('taillight'),tail=find('taillight');if(!materials.includes(glass))materials.push(glass);
  if(!paint||!glass||!lights||!tail||wheels.some(w=>!w)){root.dispose();materials.forEach(m=>m.dispose());return null;}
  paint.albedoColor=Color3.FromHexString(setup?.paint??d.color).toLinearSpace();const alloy=find('alloy');if(alloy)alloy.albedoColor=Color3.FromHexString(setup?.wheels??'#b2bac0').toLinearSpace();parts.forEach(p=>{p.isPickable=false;p.receiveShadows=true;});
  const display=find('instruments');
  // PBRMaterial.clone also clones embedded GLB textures. The static instrument
  // image is replaced by a live display: release only this instance's clone,
  // never the asset library's source or another instance's texture.
  if(display?.emissiveTexture&&!container.textures.includes(display.emissiveTexture)){const unused=display.emissiveTexture;display.emissiveTexture=null;unused.dispose();}
  const instruments=display?carInstruments(scene,d,display):undefined;
  return {root,groundOffset:.32+d.wheelRadius,wheels,paint,glass,lights,tail,parts,update(s){wheels.forEach((w,i)=>{w.position.y=-(.32+d.travel*.5-s.wheels[i].compression);w.rotation.set(s.wheels[i].angle,i<2?-s.steer:0,0);w.rotationQuaternion=null;});tail.emissiveColor.r=s.absActive?.95:.5;if(root.isEnabled())instruments?.update(s);},dispose(){root.dispose();instruments?.dispose();materials.forEach(m=>m.dispose());}};
}
