import {Mesh,VertexData,PBRMaterial,Color3,type Scene} from '@babylonjs/core';
import {clamp,smooth} from '../core/math';
import {surfaceTextures} from './surface-textures';

/** Low-poly, water-worn angular rock with normals recomputed after shaping.
 * Coincident UV vertices share a normal, avoiding artificial atlas seams. */
export function boulderGeometry(){
  const data=VertexData.CreateIcoSphere({radius:2.5,subdivisions:3,flat:false}),p=Array.from(data.positions!),indices=Array.from(data.indices!),normals:number[]=[],colors:number[]=[];
  for(let i=0;i<p.length;i+=3){
    const x=p[i],y=p[i+1],z=p[i+2],shape=.91+.08*Math.sin(x*1.3+z*.65)+.045*Math.cos(y*1.7-z);
    p[i]=x*shape;p[i+1]=clamp(y*shape*.66,-1.25,1.13+x*.12-z*.055);p[i+2]=z*shape*1.08;
    const skirt=1-smooth((p[i+1]+.35)/1.25),lichen=smooth((Math.sin(x*2.9+z*1.2)*Math.cos(z*2.4-y)-.12)/.72)*smooth((p[i+1]+.6)/1.4);
    colors.push(1-skirt*.29-lichen*.12,1-skirt*.23-lichen*.06,1-skirt*.35-lichen*.23,1);
  }
  VertexData.ComputeNormals(p,indices,normals);
  const groups=new Map<string,number[]>();
  for(let i=0;i<p.length;i+=3){const key=p.slice(i,i+3).map(v=>v.toFixed(5)).join(','),group=groups.get(key)??[];group.push(i);groups.set(key,group);}
  for(const group of groups.values()){
    const sum=[0,0,0];for(const i of group)for(let c=0;c<3;c++)sum[c]+=normals[i+c];const length=Math.hypot(...sum)||1;
    for(const i of group)for(let c=0;c<3;c++)normals[i+c]=sum[c]/length;
  }
  data.positions=p;data.normals=normals;data.colors=colors;return data;
}
export function createBoulders(scene:Scene){
  const material=new PBRMaterial('weathered-rock',scene),maps=surfaceTextures(scene,'boulder',2.2);
  material.albedoColor=Color3.White();material.albedoTexture=maps.albedo;material.bumpTexture=maps.normal;material.bumpTexture.level=.50;material.roughness=.96;material.metallic=0;material.maxSimultaneousLights=6;
  const mesh=new Mesh('rock-source',scene);boulderGeometry().applyToMesh(mesh);mesh.material=material;mesh.isVisible=false;mesh.isPickable=false;return mesh;
}
