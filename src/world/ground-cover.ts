import {clamp,smooth} from '../core/math';
import {nearestRoad,terrainHeight} from '../content/world';
import type {MeshData} from './mesh-data';

/** Packed, interpolated material controls, not friction or collision data.
 * R: distance from the outer shoulder / 24m; G: woodland; B/A: neutral.
 * The road height check prevents a bridge from painting a dirt road underneath. */
export function groundChannels(x:number,y:number,z:number):[number,number,number,number]{
  const near=nearestRoad(x,z,undefined,1);
  const edge=Math.abs(near.point.y-y)<2&&!near.road.id.startsWith('city')?clamp((near.distance-near.road.width/2-1.5)/24,0,1):1;
  const forest=smooth((z-570)/360)*(1-smooth((x-500)/420))*smooth((x+490)/220);
  return [edge,forest,1,1];
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
