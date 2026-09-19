import { Mesh, MeshBuilder, VertexData, Vector3, Quaternion, Color3, PBRMaterial, DynamicTexture, Texture, type Scene } from '@babylonjs/core';
import { rng } from '../core/math';
import { surfaceTextures } from './surface-textures';

/** Needle branch atlas + crossed bough clusters, not solid cones. Two shared draw materials. */
export function createVegetation(scene:Scene){
  const foliage=new PBRMaterial('silver-fir-needles',scene),atlas=new DynamicTexture('original-fir-bough',512,scene,true),ctx=atlas.getContext(),random=rng(906);
  ctx.clearRect(0,0,512,512);
  const branch=(x:number,y:number,length:number,angle:number,depth:number)=>{
    const ex=x+Math.cos(angle)*length,ey=y+Math.sin(angle)*length;
    ctx.strokeStyle=depth===0?'#3c3d2c':'#5a6040';ctx.lineWidth=depth===0?3:1.4;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.stroke();
    if(depth<2){for(let j=1;j<=8;j++){const t=j/9;for(const side of [-1,1])branch(x+(ex-x)*t,y+(ey-y)*t,length*(1-t)*.48,angle+side*(.65+random()*.35),depth+1);}}
    else for(let j=0;j<14;j++){const t=j/14,nx=x+(ex-x)*t,ny=y+(ey-y)*t;for(const side of [-1,1]){const a=angle+side*.8,len=10+random()*13;ctx.strokeStyle=`rgb(${82+random()*36},${108+random()*45},${46+random()*31})`;ctx.lineWidth=2.7;ctx.beginPath();ctx.moveTo(nx,ny);ctx.lineTo(nx+Math.cos(a)*len,ny+Math.sin(a)*len);ctx.stroke();}}
  };
  branch(256,492,435,-Math.PI/2,0);atlas.update();atlas.hasAlpha=true;atlas.wrapU=atlas.wrapV=Texture.CLAMP_ADDRESSMODE;atlas.anisotropicFilteringLevel=4;
  foliage.albedoTexture=atlas;foliage.useAlphaFromAlbedoTexture=true;foliage.albedoColor=Color3.White();foliage.emissiveColor=new Color3(.035,.05,.015);foliage.transparencyMode=PBRMaterial.PBRMATERIAL_ALPHATEST;foliage.alphaCutOff=.40;foliage.backFaceCulling=false;foliage.twoSidedLighting=true;foliage.roughness=1;foliage.metallic=0;foliage.forceDepthWrite=true;
  const positions:number[]=[],indices:number[]=[],uvs:number[]=[],colors:number[]=[],normals:number[]=[];
  const card=(center:Vector3,right:Vector3,up:Vector3,tint:number)=>{
    const first=positions.length/3;
    for(const [u,v]of [[0,0],[1,0],[0,1],[1,1]]){const p=center.add(right.scale(u-.5)).add(up.scale(v));positions.push(p.x,p.y,p.z);uvs.push(u,v);colors.push(tint,tint,tint,1);}
    indices.push(first,first+1,first+2,first+1,first+3,first+2);
  };
  for(let layer=0;layer<9;layer++){
    const y=-5.2+layer*1.16,length=(3.5-layer*.30)*(1+random()*.13),count=layer<6?8:6;
    for(let j=0;j<count;j++){
      const a=j/count*Math.PI*2+layer*2.399,radial=new Vector3(Math.sin(a),.2+random()*.13,Math.cos(a)),tangent=new Vector3(Math.cos(a),0,-Math.sin(a)),base=new Vector3(0,y+random()*.65,0);
      card(base,tangent.scale(length*1.2),radial.scale(length),.70+layer*.027+random()*.13);
      card(base.add(radial.scale(length*.16)),tangent.scale(length*1.35),new Vector3(radial.x*length*.75,1.6,radial.z*length*.75),.85+random()*.15);
      card(base.add(radial.scale(length*.48)),tangent.scale(length*.85),new Vector3(0,1.9-layer*.12,0),.9+random()*.1);
    }
  }
  for(let i=0;i<3;i++){const a=i*Math.PI/3;card(new Vector3(0,3.2,0),new Vector3(Math.cos(a)*1.5,0,Math.sin(a)*1.5),new Vector3(0,2.6,0),1);}
  VertexData.ComputeNormals(positions,indices,normals);const tree=new Mesh('fir-source',scene),data=new VertexData();Object.assign(data,{positions,indices,uvs,normals,colors});data.applyToMesh(tree);tree.material=foliage;tree.isVisible=false;tree.receiveShadows=true;
  const bark=new PBRMaterial('fir-bark',scene),maps=surfaceTextures(scene,'bark');bark.albedoTexture=maps.albedo;bark.bumpTexture=maps.normal;bark.roughness=1;bark.metallic=0;
  const trunk=MeshBuilder.CreateCylinder('fir-trunk-source',{diameterTop:.10,diameterBottom:.58,height:12,tessellation:9},scene);trunk.position.y=0;trunk.material=bark;trunk.isVisible=false;
  const leaves=new DynamicTexture('original-oak-leaves',512,scene,true),leafctx=leaves.getContext() as CanvasRenderingContext2D;leafctx.clearRect(0,0,512,512);
  // Irregular branch sprays leave actual sky holes and ragged edges, rather than solid circular cards.
  for(let spray=0;spray<19;spray++){
    const a=spray*2.399,r=Math.sqrt(random())*169,cx=256+Math.cos(a)*r,cy=249+Math.sin(a)*r*.91;
    leafctx.strokeStyle='#5b5933';leafctx.lineWidth=2;leafctx.beginPath();leafctx.moveTo(256,473);leafctx.quadraticCurveTo(239,300,cx,cy);leafctx.stroke();
    for(let i=0;i<77;i++){
      const angle=random()*Math.PI*2,rad=Math.sqrt(random())*(39+random()*31),x=cx+Math.cos(angle)*rad,y=cy+Math.sin(angle)*rad*.76,light=.65+random()*.51+(1-y/512)*.16;
      leafctx.fillStyle=`rgb(${Math.round(86*light)},${Math.round(108*light)},${Math.round(44*light)})`;
      leafctx.beginPath();leafctx.ellipse(x,y,3+random()*4,1.6+random()*2.8,angle,0,Math.PI*2);leafctx.fill();
    }
  }
  leaves.update();leaves.hasAlpha=true;leaves.wrapU=leaves.wrapV=Texture.CLAMP_ADDRESSMODE;leaves.anisotropicFilteringLevel=4;
  const oakMaterial=foliage.clone('valley-oak-leaves');oakMaterial.albedoTexture=leaves;oakMaterial.emissiveColor=new Color3(.028,.036,.009);
  const oak=new Mesh('oak-source',scene),op:number[]=[],oi:number[]=[],ou:number[]=[],on:number[]=[],oc:number[]=[];
  for(let cluster=0;cluster<25;cluster++){
    const a=cluster*2.399,r=cluster>20?1:2.0+random()*1.7,c=new Vector3(Math.sin(a)*r,-1.4+random()*3.7+(cluster>20?1.4:0),Math.cos(a)*r),width=2.9+random()*1.4,height=2.6+random()*1.2;
    for(let plane=0;plane<3;plane++){const angle=plane*Math.PI/3+a,right=new Vector3(Math.cos(angle),0,Math.sin(angle)),up=new Vector3(Math.sin(angle)*.24,1,Math.cos(angle)*.24),first=op.length/3;
      for(const [u,v]of [[0,0],[1,0],[0,1],[1,1]]){const p=c.add(right.scale((u-.5)*width)).add(up.scale((v-.5)*height)),n=p.subtract(new Vector3(0,-2,0)).normalize();op.push(p.x,p.y,p.z);ou.push(u,v);on.push(n.x,n.y,n.z);const tint=.82+random()*.16;oc.push(tint,tint,tint,1);}oi.push(first,first+1,first+2,first+1,first+3,first+2);
    }
  }
  const od=new VertexData();Object.assign(od,{positions:op,indices:oi,uvs:ou,normals:on,colors:oc});od.applyToMesh(oak);oak.material=oakMaterial;oak.isVisible=false;oak.receiveShadows=true;
  const branches:Mesh[]=[];
  const limb=(from:Vector3,to:Vector3,diameter:number)=>{const direction=to.subtract(from),mesh=MeshBuilder.CreateCylinder('oak-limb',{height:direction.length(),diameterBottom:diameter,diameterTop:diameter*.34,tessellation:6},scene);mesh.position.copyFrom(Vector3.Center(from,to));mesh.rotationQuaternion=Quaternion.Identity();Quaternion.FromUnitVectorsToRef(Vector3.Up(),direction.normalize(),mesh.rotationQuaternion);mesh.material=bark;branches.push(mesh);};
  limb(new Vector3(0,-6,0),new Vector3(.16,1.5,.1),.60);
  for(let i=0;i<7;i++){const a=i*2.399,start=new Vector3(0,-2.7+i*.4,0),end=new Vector3(Math.sin(a)*(2.7+random()),1+random()*1.6,Math.cos(a)*(2.7+random()));limb(start,end,.23);limb(Vector3.Lerp(start,end,.65),end.add(new Vector3(Math.cos(a),1.2,-Math.sin(a))),.105);}
  const oakTrunk=Mesh.MergeMeshes(branches,true,true)!;oakTrunk.name='oak-trunk-source';oakTrunk.material=bark;oakTrunk.isVisible=false;
  const grassTexture=new DynamicTexture('original-meadow-grass',256,scene,true),gc=grassTexture.getContext() as CanvasRenderingContext2D;gc.clearRect(0,0,256,256);
  for(let i=0;i<125;i++){const x=20+random()*216,top=25+random()*170,lean=(random()-.5)*85;gc.strokeStyle=`rgb(${92+random()*52},${101+random()*43},${48+random()*31})`;gc.lineWidth=1+random()*2.5;gc.beginPath();gc.moveTo(x,255);gc.quadraticCurveTo(x+lean*.3,top+65,x+lean,top);gc.stroke();if(i%8===0){gc.strokeStyle='#a89e6d';gc.lineWidth=2;for(let k=0;k<5;k++){gc.beginPath();gc.moveTo(x+lean,top+k*4);gc.lineTo(x+lean+(k%2?4:-4),top+k*4-5);gc.stroke();}}}
  grassTexture.update();grassTexture.hasAlpha=true;grassTexture.wrapU=grassTexture.wrapV=Texture.CLAMP_ADDRESSMODE;
  const grassMat=foliage.clone('meadow-grass');grassMat.albedoTexture=grassTexture;grassMat.emissiveColor.set(.03,.035,.01);grassMat.alphaCutOff=.42;
  const grassCards:Mesh[]=[];for(let i=0;i<3;i++){const card=MeshBuilder.CreatePlane('grass-card',{width:2.7,height:.65,sideOrientation:Mesh.DOUBLESIDE},scene);card.position.y=.325;card.rotation.y=i*Math.PI/3;card.material=grassMat;grassCards.push(card);}const grass=Mesh.MergeMeshes(grassCards,true,true)!;grass.name='grass-source';grass.isVisible=false;
  return {tree,oak,trunk,oakTrunk,grass,foliage,bark};
}
