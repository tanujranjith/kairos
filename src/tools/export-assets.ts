import { Scene, TransformNode, DracoEncoder, MeshBuilder } from '@babylonjs/core';
import { GLTF2Export } from '@babylonjs/serializers';
import { createCar } from '../render/car';
import { vehicleById } from '../content/vehicles';
import { cameraMounts } from '../render/camera-mounts';
import {vehicleCollisionShape} from '../content/vehicle-collision';
export async function exportVehicle(id:string,lod:number){
  DracoEncoder.DefaultConfiguration={wasmUrl:location.origin+'/node_modules/@babylonjs/core/assets/Draco/draco_encoder_wasm_wrapper.js',wasmBinaryUrl:location.origin+'/node_modules/@babylonjs/core/assets/Draco/draco_encoder.wasm',numWorkers:2};
  const scene=new Scene(window.kairos!.renderer.engine),d=vehicleById(id),car=createCar(scene,d,undefined,lod===1);
  for(const [name,p]of Object.entries(cameraMounts(d))){const n=new TransformNode('camera-'+name,scene);n.parent=car.root;n.position.set(p.x,p.y,p.z);}
  const collision=vehicleCollisionShape(d),collisionMesh=MeshBuilder.CreateBox('collision-chassis',{width:collision.size.x,height:collision.size.y,depth:collision.size.z},scene);collisionMesh.parent=car.root;collisionMesh.position.set(collision.center.x,collision.center.y,collision.center.z);collisionMesh.isPickable=false;collisionMesh.metadata={gltf:{extras:{kairosCollision:collision}}};
  car.root.metadata={kairos:{author:'Kairos procedural mesh generator',units:'meters',wheelOrder:['front-left','front-right','rear-left','rear-right'],collision,lod}};
  const data=await GLTF2Export.GLBAsync(scene,`${id}-lod${lod}`,{meshCompressionMethod:'Draco',exportUnusedUVs:false});
  const file=data.glTFFiles[`${id}-lod${lod}.glb`] as Blob;
  const bytes=Array.from(new Uint8Array(await file.arrayBuffer()));scene.dispose();return bytes;
}
