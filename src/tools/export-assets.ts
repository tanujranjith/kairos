import { Scene, TransformNode, DracoEncoder } from '@babylonjs/core';
import { GLTF2Export } from '@babylonjs/serializers';
import { createCar } from '../render/car';
import { vehicleById } from '../content/vehicles';
export async function exportVehicle(id:string,lod:number){
  DracoEncoder.DefaultConfiguration={wasmUrl:location.origin+'/node_modules/@babylonjs/core/assets/Draco/draco_encoder_wasm_wrapper.js',wasmBinaryUrl:location.origin+'/node_modules/@babylonjs/core/assets/Draco/draco_encoder.wasm',numWorkers:2};
  const scene=new Scene(window.kairos!.renderer.engine),d=vehicleById(id),car=createCar(scene,d,undefined,lod===1);
  for(const [name,p]of [['camera-cockpit',[-.34,.45,.15]],['camera-hood',[0,.18,d.length*.31]],['camera-bumper',[0,-.12,d.length*.51]]] as [string,number[]][]){const n=new TransformNode(name,scene);n.parent=car.root;n.position.set(p[0],p[1],p[2]);}
  car.root.metadata={kairos:{author:'Kairos procedural mesh generator',units:'meters',wheelOrder:['front-left','front-right','rear-left','rear-right'],chassis:[d.width*.86,.38,d.length*.87],lod}};
  const data=await GLTF2Export.GLBAsync(scene,`${id}-lod${lod}`,{meshCompressionMethod:'Draco',exportUnusedUVs:false});
  const file=data.glTFFiles[`${id}-lod${lod}.glb`] as Blob;
  const bytes=Array.from(new Uint8Array(await file.arrayBuffer()));scene.dispose();return bytes;
}
