import {clamp,smooth} from '../core/math';
import {nearestRoad,terrainHeight,ROADS,pointAt} from '../content/world';
import {RURAL_FIELD_SITES} from '../content/rural-infrastructure';
import type {MeshData} from './mesh-data';

export const AGRICULTURAL_FIELDS=RURAL_FIELD_SITES.map(site=>{
  const road=ROADS.find(road=>road.id===site.road);if(!road)throw new Error(`Missing field road ${site.road}`);
  const centre=pointAt(road,road.length*site.at,site.offset),yaw=centre.yaw+site.yaw;
  return {...site,x:centre.x,z:centre.z,yaw,cos:Math.cos(yaw),sin:Math.sin(yaw)};
});

/** Smooth field ownership is continuous across terrain/cell triangles. */
export function agriculturalFieldWeight(x:number,z:number){
  let weight=0;
  for(const field of AGRICULTURAL_FIELDS){
    const dx=x-field.x,dz=z-field.z,lateral=dx*field.cos-dz*field.sin,forward=dx*field.sin+dz*field.cos;
    const across=smooth(clamp((field.width*.5-Math.abs(lateral))/4,0,1)),along=smooth(clamp((field.length*.5-Math.abs(forward))/5,0,1));
    weight=Math.max(weight,across*along);
  }
  return weight;
}

/** Packed, interpolated material controls, not friction or collision data.
 * R: distance from the outer shoulder / 24m; G: woodland; B: farm field; A: opaque.
 * The road height check prevents a bridge from painting a dirt road underneath. */
export function groundChannels(x:number,y:number,z:number):[number,number,number,number]{
  const near=nearestRoad(x,z,undefined,1);
  const edge=Math.abs(near.point.y-y)<2&&!near.road.id.startsWith('city')?clamp((near.distance-near.road.width/2-1.5)/24,0,1):1;
  const forest=smooth((z-570)/360)*(1-smooth((x-500)/420))*smooth((x+490)/220);
  return [edge,forest,agriculturalFieldWeight(x,z),1];
}

/** Match the loose earth palette after the gravel texture's sRGB decode.
 * Concrete city/bridge shoulders keep their distinct light aggregate. */
export const GRAVEL_TINT=[.558,.460,.358,1] as const;

/** Geometry, contact normals and triangle ordering are deliberately untouched. */
export function applyGroundChannels(data:MeshData){
  const colors=new Float32Array(data.positions.length/3*4);
  for(let i=0;i<data.positions.length;i+=3)colors.set(groundChannels(data.positions[i],data.positions[i+1],data.positions[i+2]),i/3*4);
  data.colors=colors;
}

/** Smooth lighting across duplicate triangle/cell vertices. Havok's mesh shape
 * reads positions and indices; these normals are exclusively a render attribute. */
export function smoothGroundNormals(data:MeshData){
  const cache=new Map<string,readonly number[]>(),delta=2;
  for(let i=0;i<data.positions.length;i+=3){
    const x=data.positions[i],z=data.positions[i+2],key=`${x},${z}`;let normal=cache.get(key);
    if(!normal){const nx=terrainHeight(x-delta,z)-terrainHeight(x+delta,z),nz=terrainHeight(x,z-delta)-terrainHeight(x,z+delta),length=Math.hypot(nx,delta*2,nz);normal=[nx/length,delta*2/length,nz/length];cache.set(key,normal);}
    data.normals.set(normal,i);
  }
}
