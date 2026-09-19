import {ROADS} from './world';
import {roadSpanAt} from './road-layers';
import {subtractConvex} from './terrain-clipping';

type Point={x:number;z:number};
const buckets=new Map<string,{vertices:Point[];bounds:number[]}[]>();
// Ground may remain under a bridge, but never cover an at-grade driving surface.
for(const road of ROADS)for(let i=0;i<road.points.length-1;i++){
  const a=road.points[i],b=road.points[i+1];if(roadSpanAt(road,(a.s+b.s)/2)?.kind==='bridge')continue;
  const edge=(p:typeof a,side:number)=>({x:p.x+Math.cos(p.yaw)*road.width/2*side,z:p.z-Math.sin(p.yaw)*road.width/2*side});
  const vertices=[edge(a,-1),edge(a,1),edge(b,1),edge(b,-1)],bounds=[Math.min(...vertices.map(v=>v.x)),Math.min(...vertices.map(v=>v.z)),Math.max(...vertices.map(v=>v.x)),Math.max(...vertices.map(v=>v.z))],f={vertices,bounds};
  for(let x=Math.floor(bounds[0]/128);x<=Math.floor(bounds[2]/128);x++)for(let z=Math.floor(bounds[1]/128);z<=Math.floor(bounds[3]/128);z++){const key=`${x},${z}`,list=buckets.get(key)??[];list.push(f);buckets.set(key,list);}
}
export function terrainOutsideRoads(pieces:Point[][],bounds:readonly [number,number,number,number]):Point[][]{
  const [x,z,right,top]=bounds,shapes=new Set<NonNullable<ReturnType<typeof buckets.get>>[number]>();
  for(let cx=Math.floor(x/128);cx<=Math.floor(right/128);cx++)for(let cz=Math.floor(z/128);cz<=Math.floor(top/128);cz++)for(const f of buckets.get(`${cx},${cz}`)??[])shapes.add(f);
  for(const f of shapes){const [a,b,c,d]=f.bounds;if(c<=x||a>=right||d<=z||b>=top)continue;pieces=pieces.flatMap(p=>subtractConvex(p,f.vertices));if(!pieces.length)break;}
  return pieces.filter(p=>Math.abs(p.reduce((sum,v,i)=>{const q=p[(i+1)%p.length];return sum+v.x*q.z-v.z*q.x;},0))>1e-7);
}
