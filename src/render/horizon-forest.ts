import {Color3,DynamicTexture,Mesh,PBRMaterial,Texture,VertexData,type Scene,type TransformNode} from '@babylonjs/core';
import {rng} from '../core/math';
import {horizonTrees} from '../world/horizon-forest';

/** Two crossed whole-tree cards per distant conifer, one shared atlas and draw.
 * Near trees retain their existing branch geometry. This LOD is never a caster. */
export function createHorizonForest(scene:Scene,parent:TransformNode){
  const atlas=new DynamicTexture('original-distant-fir-atlas',{width:512,height:256},scene,true),ctx=atlas.getContext() as CanvasRenderingContext2D,random=rng(181);
  ctx.clearRect(0,0,512,256);
  for(let variant=0;variant<4;variant++){
    const x=variant*128+64;
    ctx.strokeStyle='#403b28';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(x,251);ctx.lineTo(x,8);ctx.stroke();
    for(let row=0;row<43;row++){
      const y=13+row*5.2,width=3+row*.95,shade=.67+random()*.34;
      for(const side of [-1,1]){
        const extent=width*(.7+random()*.32),tip=y+5+random()*7;
        ctx.fillStyle=`rgb(${Math.round(47*shade)},${Math.round(70*shade)},${Math.round(42*shade)})`;
        ctx.beginPath();ctx.moveTo(x-side*2,y-3);ctx.lineTo(x+side*extent,tip);ctx.lineTo(x+side*extent*.49,tip-1);ctx.lineTo(x+side*extent*.72,tip+5);ctx.lineTo(x,y+5);ctx.closePath();ctx.fill();
      }
    }
  }
  atlas.update();atlas.hasAlpha=true;atlas.wrapU=atlas.wrapV=Texture.CLAMP_ADDRESSMODE;
  const material=new PBRMaterial('distant-woodland',scene);material.albedoTexture=atlas;material.useAlphaFromAlbedoTexture=true;material.transparencyMode=PBRMaterial.PBRMATERIAL_ALPHATEST;material.alphaCutOff=.36;material.backFaceCulling=false;material.twoSidedLighting=true;material.roughness=1;material.metallic=0;material.emissiveColor=new Color3(.006,.010,.005);material.maxSimultaneousLights=2;
  const positions:number[]=[],indices:number[]=[],normals:number[]=[],uvs:number[]=[],colors:number[]=[],trees=horizonTrees();
  for(const tree of trees)for(const angle of [tree.yaw,tree.yaw+Math.PI/2]){
    const first=positions.length/3,c=Math.cos(angle),s=Math.sin(angle);
    for(const [u,v]of [[0,0],[1,0],[0,1],[1,1]]){const offset=(u-.5)*tree.width;positions.push(tree.x+c*offset,tree.y+v*tree.height,tree.z+s*offset);normals.push(c*.35,.88,s*.35);uvs.push((tree.variant+u)/4,v);colors.push(tree.tint,tree.tint,tree.tint,1);}
    indices.push(first,first+1,first+2,first+1,first+3,first+2);
  }
  const mesh=new Mesh('outer-foothill-woodland',scene),data=new VertexData();Object.assign(data,{positions,indices,normals,uvs,colors});data.applyToMesh(mesh);mesh.material=material;mesh.parent=parent;mesh.isPickable=false;mesh.freezeWorldMatrix();mesh.metadata={horizonTreeCount:trees.length,visualOnly:true};
  return mesh;
}
