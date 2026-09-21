import {wrap} from '../core/math';
import { JUNCTIONS, junctionRadius } from './world';
type Point={x:number;z:number};
export interface JunctionStripPoint extends Point {y:number;yaw:number}
const footprints=JUNCTIONS.map(j=>({x:j.x,z:j.z,r:junctionRadius(j),vertices:Array.from({length:64},(_,i)=>({x:j.x+Math.cos(i/64*Math.PI*2)*junctionRadius(j),z:j.z+Math.sin(i/64*Math.PI*2)*junctionRadius(j)}))}));

/** Subtract a convex pavement polygon, retaining disjoint outside pieces. */
export function subtractConvex(subject:Point[],clip:Point[]):Point[][]{
  const result:Point[][]=[];let remaining=subject;
  for(let i=0;i<clip.length&&remaining.length>=3;i++){
    const a=clip[i],b=clip[(i+1)%clip.length],side=(p:Point)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x),inside:Point[]=[],outside:Point[]=[];
    for(let j=0;j<remaining.length;j++){
      const p=remaining[j],q=remaining[(j+1)%remaining.length],ps=side(p),qs=side(q);
      (ps>=0?inside:outside).push(p);
      if((ps>=0)!==(qs>=0)){const t=ps/(ps-qs),hit={x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t};inside.push(hit);outside.push(hit);}
    }
    if(outside.length>=3)result.push(outside);remaining=inside;
  }
  return result;
}
export function terrainOutsideJunctions(bounds:readonly [number,number,number,number]):Point[][]{
  const [x,z,right,top]=bounds;let pieces:Point[][]=[[{x,z},{x:right,z},{x:right,z:top},{x,z:top}]];
  for(const f of footprints){
    if(f.x+f.r<x||f.x-f.r>right||f.z+f.r<z||f.z-f.r>top)continue;
    pieces=pieces.flatMap(p=>subtractConvex(p,f.vertices));if(!pieces.length)break;
  }
  return pieces;
}

/** Retain only the portions of a sampled road segment outside authored
 * junction aprons. This avoids shoulder and sidewalk wedges over the apron. */
export function segmentOutsideJunctions(a:JunctionStripPoint,b:JunctionStripPoint,roadId:string,clearance=0):[JunctionStripPoint,JunctionStripPoint][]{
  let intervals:[number,number][]=[[0,1]];
  const dx=b.x-a.x,dz=b.z-a.z,lengthSquared=dx*dx+dz*dz;
  if(lengthSquared<1e-8)return [];
  for(const junction of JUNCTIONS){
    if(!junction.roads.includes(roadId))continue;
    const radius=junctionRadius(junction)+clearance,ox=a.x-junction.x,oz=a.z-junction.z,B=2*(ox*dx+oz*dz),C=ox*ox+oz*oz-radius*radius,discriminant=B*B-4*lengthSquared*C;
    if(discriminant<=0)continue;
    const root=Math.sqrt(discriminant),insideStart=Math.max(0,(-B-root)/(2*lengthSquared)),insideEnd=Math.min(1,(-B+root)/(2*lengthSquared));
    if(insideEnd<=insideStart)continue;
    intervals=intervals.flatMap(([start,end])=>insideEnd<=start||insideStart>=end?[[start,end]]:[...(insideStart>start?[[start,Math.min(end,insideStart)] as [number,number]]:[]),...(insideEnd<end?[[Math.max(start,insideEnd),end] as [number,number]]:[])]);
    if(!intervals.length)break;
  }
  const point=(t:number):JunctionStripPoint=>({x:a.x+dx*t,y:a.y+(b.y-a.y)*t,z:a.z+dz*t,yaw:a.yaw+wrap(b.yaw-a.yaw)*t});
  return intervals.filter(([start,end])=>end-start>1e-5).map(([start,end])=>[point(start),point(end)]);
}
