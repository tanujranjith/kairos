import {Matrix,Quaternion,Vector3,Mesh,MeshBuilder,type TransformNode} from '@babylonjs/core';
import {circuitWoodland} from '../world/circuit-setting';
import type {Quality} from '../core/types';
import {pitGardenPlants} from '../content/circuit-landscape';

/** Two shared-material draws for the entire authored tree belt. No per-tree
 * materials, colliders, lights or additional shadow passes. */
export function createCircuitWoodland(parent:TransformNode,leaves:Mesh,trunk:Mesh){
  const trees=circuitWoodland();
  const limbs:Mesh[]=[],scene=parent.getScene();
  const branch=(a:Vector3,b:Vector3,diameter:number)=>{const direction=b.subtract(a),m=MeshBuilder.CreateCylinder('woodland-limb',{height:direction.length(),diameterBottom:diameter,diameterTop:diameter*.4,tessellation:4},scene);m.position.copyFrom(Vector3.Center(a,b));m.rotationQuaternion=Quaternion.Identity();Quaternion.FromUnitVectorsToRef(Vector3.Up(),direction.normalize(),m.rotationQuaternion);limbs.push(m);};
  branch(new Vector3(0,-4,0),new Vector3(.1,2.2,0),.65);
  for(let i=0;i<3;i++){const a=i*2.399;branch(new Vector3(0,-.4+i*.45,0),new Vector3(Math.sin(a)*3,2.6,Math.cos(a)*3),.26);}
  const fork=Mesh.MergeMeshes(limbs,true,true)!;fork.material=trunk.material;fork.isVisible=false;
  let leafMesh!:Mesh;const leafIndices=Array.from(leaves.getIndices()!);
  for(const [name,source,height] of [['leaves',leaves,6],['trunks',fork,4]] as const){
    const mesh=source.clone(`aster-woodland-${name}`,parent)!;mesh.makeGeometryUnique();
    // Wider, layered crowns and sparse low growth read as woodland rather than
    // a repeated row of poles. Fewer leaf sprays bound the total geometry cost.
    if(name==='leaves')leafMesh=mesh;
    const undergrowth=name==='leaves'?trees.filter((_,i)=>i%3===0):[],transforms=new Float32Array((trees.length+undergrowth.length)*16);
    trees.forEach((tree,i)=>{
      const {x,y,z}=tree.position,s=tree.scale;
      Matrix.Compose(new Vector3(s*(name==='leaves'?1.65:1),s,s*(name==='leaves'?1.65:1)),Quaternion.RotationYawPitchRoll(tree.yaw,0,0),new Vector3(x,y+height*s,z)).copyToArray(transforms,i*16);
    });
    undergrowth.forEach((tree,i)=>{const {x,y,z}=tree.position;Matrix.Compose(new Vector3(.7,.5,.7),Quaternion.RotationYawPitchRoll(tree.yaw+1,0,0),new Vector3(x+3,y+2,z+2)).copyToArray(transforms,(trees.length+i)*16);});
    mesh.thinInstanceSetBuffer('matrix',transforms,16,true);mesh.thinInstanceRefreshBoundingInfo(true);
    mesh.isVisible=true;mesh.isPickable=false;mesh.receiveShadows=true;mesh.metadata={worldCaster:false,backgroundWoodland:true};
  }
  fork.dispose();
  // One bounded batch for all forecourt planters, sharing the existing oak atlas.
  // No per-plant materials/colliders/shadow passes or distant streaming pop-in.
  const planting=leaves.clone('aster-forecourt-planting',parent)!;planting.makeGeometryUnique();
  const plants=pitGardenPlants(),plantMatrices=new Float32Array(plants.length*16);
  plants.forEach((p,i)=>Matrix.Compose(new Vector3(p.scale.x,p.scale.y,p.scale.z),Quaternion.RotationYawPitchRoll(p.yaw,0,0),new Vector3(p.x,p.y,p.z)).copyToArray(plantMatrices,i*16));
  planting.thinInstanceSetBuffer('matrix',plantMatrices,16,true);planting.thinInstanceRefreshBoundingInfo(true);planting.isVisible=true;planting.isPickable=false;planting.receiveShadows=true;planting.metadata={worldCaster:false,forecourtPlanting:true};
  const setQuality=(quality:Quality)=>{const indices:number[]=[];for(let cluster=0;cluster<25;cluster++)if(quality==='Low'?cluster%2===0&&cluster!==10:quality==='Medium'?cluster%3!==1:true)indices.push(...leafIndices.slice(cluster*18,cluster*18+18));leafMesh.setIndices(indices);planting.setIndices(indices);};
  setQuality('Low');return {setQuality};
}
