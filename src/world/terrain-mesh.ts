import {CELL_SIZE,terrainHeight} from '../content/world';
import {terrainOutsideHandling} from '../content/handling-course';
import {terrainOutsideJunctions} from '../content/terrain-clipping';
import {terrainOutsideRoads} from '../content/road-terrain-clipping';
import {MeshDataBuilder} from './mesh-data';

export type TerrainPoint={x:number;z:number};
const TILE=16,EPS=1e-5;
const cross=(a:TerrainPoint,b:TerrainPoint,c:TerrainPoint)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
const sideTolerance=(a:TerrainPoint,b:TerrainPoint)=>EPS*Math.hypot(b.x-a.x,b.z-a.z);
const pointKey=(p:TerrainPoint)=>`${p.x},${p.z}`;

/** Triangulate a convex clipped polygon without skipping collinear boundary
 * vertices. A simple corner fan can recreate the very T-junction being fixed. */
export function terrainTriangles(points:readonly TerrainPoint[]):number[]{
  const remaining=points.map((_,i)=>i),indices:number[]=[];
  while(remaining.length>3){
    let found=false;
    for(let step=0;step<remaining.length;step++){
      const i=(step+1)%remaining.length,a=remaining[(i+remaining.length-1)%remaining.length],b=remaining[i],c=remaining[(i+1)%remaining.length];
      if(cross(points[a],points[b],points[c])<=sideTolerance(points[a],points[c]))continue;
      if(remaining.some(k=>k!==a&&k!==b&&k!==c&&cross(points[a],points[b],points[k])>=-sideTolerance(points[a],points[b])&&cross(points[b],points[c],points[k])>=-sideTolerance(points[b],points[c])&&cross(points[c],points[a],points[k])>=-sideTolerance(points[c],points[a])))continue;
      indices.push(a,b,c);remaining.splice(i,1);found=true;break;
    }
    if(!found)throw new Error('Terrain polygon cannot be triangulated without losing boundary vertices');
  }
  if(remaining.length===3&&cross(points[remaining[0]],points[remaining[1]],points[remaining[2]])>1e-9)indices.push(...remaining);
  return indices;
}

/** One shared height sample per canonical vertex. Halo polygons contribute only
 * edge vertices, never faces, so independently streamed cells agree at borders. */
export function conformTerrain(polygons:readonly TerrainPoint[][],neighbors:readonly TerrainPoint[][],height=terrainHeight){
  const points=new Map<string,TerrainPoint>(),buckets=new Map<string,TerrainPoint[]>(),heights=new Map<string,number>();
  const canonical=(p:TerrainPoint)=>({x:Math.round(p.x*1e6)/1e6,z:Math.round(p.z*1e6)/1e6});
  for(const polygon of [...polygons,...neighbors])for(const point of polygon){
    const p=canonical(point),key=pointKey(p);if(points.has(key))continue;points.set(key,p);
    const bucket=`${Math.floor(p.x/TILE)},${Math.floor(p.z/TILE)}`,list=buckets.get(bucket)??[];list.push(p);buckets.set(bucket,list);
  }
  const g=new MeshDataBuilder();
  for(const polygon of polygons){
    const boundary:TerrainPoint[]=[];
    for(let i=0;i<polygon.length;i++){
      const a=canonical(polygon[i]),b=canonical(polygon[(i+1)%polygon.length]),dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz;
      if(l2<1e-10)continue;
      const length=Math.sqrt(l2),hits:{p:TerrainPoint;t:number}[]=[{p:a,t:0}];
      for(let x=Math.floor((Math.min(a.x,b.x)-EPS)/TILE);x<=Math.floor((Math.max(a.x,b.x)+EPS)/TILE);x++)for(let z=Math.floor((Math.min(a.z,b.z)-EPS)/TILE);z<=Math.floor((Math.max(a.z,b.z)+EPS)/TILE);z++)for(const p of buckets.get(`${x},${z}`)??[]){
        const t=((p.x-a.x)*dx+(p.z-a.z)*dz)/l2;
        if(t>EPS/length&&t<1-EPS/length&&Math.abs(cross(a,b,p))/length<EPS)hits.push({p,t});
      }
      hits.sort((a,b)=>a.t-b.t);for(const hit of hits)if(!boundary.length||Math.hypot(hit.p.x-boundary.at(-1)!.x,hit.p.z-boundary.at(-1)!.z)>EPS)boundary.push(hit.p);
    }
    if(boundary.length<3)continue;
    const triangles=terrainTriangles(boundary),first=g.positions.length/3;
    for(const p of boundary){const key=pointKey(p);if(!heights.has(key))heights.set(key,height(p.x,p.z));g.positions.push(p.x,heights.get(key)!,p.z);g.uvs.push(p.x/12,p.z/12);}
    g.indices.push(...triangles.map(i=>i+first));
  }
  return g;
}

export function buildTerrainMesh(cx:number,cz:number){
  const x0=cx*CELL_SIZE,z0=cz*CELL_SIZE,owned:TerrainPoint[][]=[],halo:TerrainPoint[][]=[];
  for(let x=x0-TILE;x<x0+CELL_SIZE+TILE;x+=TILE)for(let z=z0-TILE;z<z0+CELL_SIZE+TILE;z+=TILE){
    const target=x>=x0&&x<x0+CELL_SIZE&&z>=z0&&z<z0+CELL_SIZE?owned:halo;
    for(const bounds of terrainOutsideHandling([x,z,x+TILE,z+TILE]))target.push(...terrainOutsideRoads(terrainOutsideJunctions(bounds),bounds));
  }
  return conformTerrain(owned,halo);
}
