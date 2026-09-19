import { JUNCTIONS, junctionRadius } from './world';
type Point={x:number;z:number};
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
