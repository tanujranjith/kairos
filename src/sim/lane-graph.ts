import type { Road, RoadPoint, V3 } from '../core/types';
import { clamp, distance, lerp, wrap } from '../core/math';
import type { JunctionDefinition } from '../content/junctions';

export interface LanePath {
  id:string; kind:'lane'|'connector'; roadId:string; direction:1|-1; laneIndex:number;
  points:RoadPoint[]; length:number; speedLimit:number; layer:string;
  from:string|null; to:string|null; next:string[]; adjacent:string[]; trafficAllowed:boolean;
  roadStart:number; roadEnd:number;
  junction?:string; targetLane?:string; sourceLane?:string; turn?:'left'|'straight'|'right'|'uturn'; signalGroup?:number; priority?:number;
}
export interface LaneProjection<T=LanePath> { path:T; progress:number; point:RoadPoint; distance:number; lateral:number }
export interface LaneJunction extends JunctionDefinition { y:number; incoming:string[]; outgoing:string[]; connectors:string[] }

export function samplePath(path:{points:RoadPoint[];length:number},progress:number):RoadPoint{
  const s=clamp(progress,0,path.length),points=path.points;let lo=0,hi=points.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(points[mid].s<s)lo=mid;else hi=mid;}
  const a=points[lo],b=points[hi],t=(s-a.s)/Math.max(.000001,b.s-a.s);
  return {x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),z:lerp(a.z,b.z,t),s,yaw:a.yaw+wrap(b.yaw-a.yaw)*t,curvature:lerp(a.curvature,b.curvature,t)};
}
export function projectPath<T extends {points:RoadPoint[];length:number}>(path:T,position:Pick<V3,'x'|'z'>):LaneProjection<T>{
  let best=Infinity,progress=0,lateral=0;
  for(let i=0;i<path.points.length-1;i++){
    const a=path.points[i],b=path.points[i+1],dx=b.x-a.x,dz=b.z-a.z,len2=dx*dx+dz*dz;
    const t=clamp(((position.x-a.x)*dx+(position.z-a.z)*dz)/Math.max(.00001,len2),0,1);
    const x=a.x+dx*t,z=a.z+dz*t,d=Math.hypot(position.x-x,position.z-z);
    if(d<best){best=d;progress=lerp(a.s,b.s,t);lateral=((position.x-x)*dz-(position.z-z)*dx)/Math.sqrt(Math.max(.00001,len2));}
  }
  return {path,progress,point:samplePath(path,progress),distance:best,lateral};
}
function roadPoint(road:Road,s:number,offset=0){
  const p=samplePath(road,road.loop?((s%road.length)+road.length)%road.length:s);
  return {...p,x:p.x+Math.cos(p.yaw)*offset,z:p.z-Math.sin(p.yaw)*offset};
}
function pathPoints(raw:V3[]):RoadPoint[]{
  let length=0;
  const points=raw.map((p,i)=>{if(i)length+=distance(p,raw[i-1]);const a=raw[Math.max(0,i-1)],b=raw[Math.min(raw.length-1,i+1)];return {...p,s:length,yaw:Math.atan2(b.x-a.x,b.z-a.z),curvature:0};});
  for(let i=1;i<points.length-1;i++)points[i].curvature=wrap(points[i+1].yaw-points[i-1].yaw)/Math.max(.1,points[i+1].s-points[i-1].s);
  return points;
}

export class LaneGraph {
  paths=new Map<string,LanePath>(); junctions=new Map<string,LaneJunction>(); issues:string[]=[];
  private roadById:Map<string,Road>;
  constructor(public roads:Road[],definitions:JunctionDefinition[],privateRoads=new Set<string>()){
    this.roadById=new Map(roads.map(r=>[r.id,r]));
    const ports=new Map<string,{junction:LaneJunction;s:number}[]>();
    for(const definition of definitions){
      const junction:LaneJunction={...definition,y:0,incoming:[],outgoing:[],connectors:[]},heights:number[]=[],pending:{id:string;s:number}[]=[];
      const issueCount=this.issues.length;
      for(const id of definition.roads){
        const road=this.roadById.get(id);if(!road){this.issues.push(`${definition.id}: missing road ${id}`);continue;}
        const projected=projectPath(road,definition);
        if(projected.distance>30)this.issues.push(`${definition.id}: ${id} is ${projected.distance.toFixed(1)}m from authored junction`);
        heights.push(projected.point.y);pending.push({id,s:projected.progress});
      }
      junction.y=heights.reduce((a,b)=>a+b,0)/Math.max(1,heights.length);
      if(Math.max(...heights)-Math.min(...heights)>2)this.issues.push(`${definition.id}: incompatible surface elevations`);
      if(this.issues.length!==issueCount)continue;
      for(const entry of pending){const list=ports.get(entry.id)??[];list.push({junction,s:entry.s});ports.set(entry.id,list);}
      this.junctions.set(junction.id,junction);
    }
    for(const road of roads){
      const entries=(ports.get(road.id)??[]).sort((a,b)=>a.s-b.s);
      const section=(start:number,end:number,from:LaneJunction|null,to:LaneJunction|null,index:number)=>{
        if(end-start<2)return;
        const count=Math.max(1,road.lanes/2),width=road.width/road.lanes;
        for(const direction of [1,-1] as const)for(let laneIndex=0;laneIndex<count;laneIndex++){
          const offset=direction*(road.width/2-width*(laneIndex+.5)),raw:V3[]=[],n=Math.max(2,Math.ceil((end-start)/6));
          for(let i=0;i<=n;i++)raw.push(roadPoint(road,lerp(start,end,direction===1?i/n:1-i/n),offset));
          const points=pathPoints(raw),id=`${road.id}:${index}:${direction}:${laneIndex}`,a=direction===1?from:to,b=direction===1?to:from;
          const path:LanePath={id,kind:'lane',roadId:road.id,direction,laneIndex,points,length:points.at(-1)!.s,speedLimit:road.speed,layer:a?.layer??b?.layer??'surface',from:a?.id??null,to:b?.id??null,next:[],adjacent:[],trafficAllowed:!privateRoads.has(road.id),roadStart:direction===1?start:end,roadEnd:direction===1?end:start};
          this.paths.set(id,path);a?.outgoing.push(id);b?.incoming.push(id);
        }
      };
      if(road.loop&&entries.length){for(let i=0;i<entries.length;i++){const a=entries[i],b=entries[(i+1)%entries.length];section(a.s+a.junction.radius,b.s+(i===entries.length-1?road.length:0)-b.junction.radius,a.junction,b.junction,i);}}
      else{let start=0,previous:LaneJunction|null=null;for(let i=0;i<entries.length;i++){const entry=entries[i];section(start,Math.max(0,entry.s-entry.junction.radius),previous,entry.junction,i);start=Math.min(road.length,entry.s+entry.junction.radius);previous=entry.junction;}section(start,road.length,previous,null,entries.length);}
    }
    for(const path of this.paths.values())if(path.kind==='lane'){
      for(const other of this.paths.values())if(other.kind==='lane'&&path.roadId===other.roadId&&path.direction===other.direction&&path.from===other.from&&path.to===other.to&&Math.abs(path.laneIndex-other.laneIndex)===1)path.adjacent.push(other.id);
    }
    for(const junction of this.junctions.values())for(const incomingId of junction.incoming)for(const outgoingId of junction.outgoing){
      const incoming=this.paths.get(incomingId)!,outgoing=this.paths.get(outgoingId)!,uturn=incoming.roadId===outgoing.roadId&&incoming.direction!==outgoing.direction;
      if(uturn&&junction.control!=='turnaround')continue;
      const a=incoming.points.at(-1)!,b=outgoing.points[0],angle=wrap(b.yaw-a.yaw),turn=uturn?'uturn':Math.abs(angle)<.5?'straight':angle>0?'right':'left';
      const incomingCount=this.roadById.get(incoming.roadId)!.lanes/2,outgoingCount=this.roadById.get(outgoing.roadId)!.lanes/2;
      if(turn==='straight'&&outgoing.laneIndex!==Math.min(incoming.laneIndex,outgoingCount-1))continue;
      if(turn==='right'&&(incoming.laneIndex!==0||outgoing.laneIndex!==0))continue;
      if(turn==='left'&&(incoming.laneIndex!==incomingCount-1||outgoing.laneIndex!==outgoingCount-1))continue;
      const handle=uturn?junction.radius*2:Math.min(30,Math.max(8,distance(a,b)*.52)),c={x:a.x+Math.sin(a.yaw)*handle,z:a.z+Math.cos(a.yaw)*handle},d={x:b.x-Math.sin(b.yaw)*handle,z:b.z-Math.cos(b.yaw)*handle};
      let raw=Array.from({length:33},(_,i)=>{const t=i/32,u=1-t;return {x:u**3*a.x+3*u*u*t*c.x+3*u*t*t*d.x+t**3*b.x,z:u**3*a.z+3*u*u*t*c.z+3*u*t*t*d.z+t**3*b.z,y:lerp(a.y,b.y,t)};});
      if(uturn){
        // A broad turning pad, not a narrow hairpin below the car's steering radius.
        const forward={x:Math.sin(a.yaw),z:Math.cos(a.yaw)},right={x:Math.cos(a.yaw),z:-Math.sin(a.yaw)};
        const arc=Array.from({length:33},(_,i)=>{const angle=i/32*Math.PI;return {x:junction.x+right.x*9*Math.cos(angle)+forward.x*9*Math.sin(angle),z:junction.z+right.z*9*Math.cos(angle)+forward.z*9*Math.sin(angle),y:lerp(a.y,b.y,i/32)};});
        const link=(start:V3,end:V3,heading:number)=>Array.from({length:17},(_,i)=>{const t=i/16,u=1-t,dx=Math.sin(heading)*7,dz=Math.cos(heading)*7;return {x:u**3*start.x+3*u*u*t*(start.x+dx)+3*u*t*t*(end.x-dx)+t**3*end.x,z:u**3*start.z+3*u*u*t*(start.z+dz)+3*u*t*t*(end.z-dz)+t**3*end.z,y:lerp(start.y,end.y,t)};});
        raw=[...link(a,arc[0],a.yaw).slice(0,-1),...arc.slice(0,-1),...link(arc.at(-1)!,b,b.yaw)];
      }
      const points=pathPoints(raw),id=`turn:${junction.id}:${incoming.id}>${outgoing.id}`;
      const path:LanePath={id,kind:'connector',roadId:incoming.roadId,direction:incoming.direction,laneIndex:incoming.laneIndex,points,length:points.at(-1)!.s,speedLimit:uturn?3.5:turn==='straight'?Math.min(incoming.speedLimit,outgoing.speedLimit):8,layer:junction.layer,from:junction.id,to:junction.id,next:[outgoing.id],adjacent:[],trafficAllowed:incoming.trafficAllowed&&outgoing.trafficAllowed,roadStart:incoming.roadEnd,roadEnd:outgoing.roadStart,junction:junction.id,targetLane:outgoing.id,sourceLane:incoming.id,turn,signalGroup:junction.signalGroups?.findIndex(group=>group.includes(incoming.roadId))??-1,priority:junction.priority.includes(incoming.roadId)?1:0};
      this.paths.set(id,path);incoming.next.push(id);junction.connectors.push(id);
    }
  }
  nearest(position:Pick<V3,'x'|'z'>&Partial<Pick<V3,'y'>>,yaw?:number,trafficOnly=false){
    let best:LaneProjection|undefined,score=Infinity;
    for(const path of this.paths.values()){
      if(path.kind!=='lane'||trafficOnly&&!path.trafficAllowed)continue;
      const projection=projectPath(path,position),height=position.y===undefined?0:Math.abs(projection.point.y-position.y),heading=yaw===undefined?0:Math.abs(wrap(projection.point.yaw-yaw));
      const value=projection.distance+height*4+heading*5;
      if(value<score){score=value;best=projection;}
    }
    if(!best)throw new Error('Lane graph has no matching lanes');return best;
  }
  sample(path:LanePath,progress:number,nextIds:string[]=[]){
    let current=path,s=progress;
    for(let i=0;i<nextIds.length&&s>current.length;i++){s-=current.length;current=this.paths.get(nextIds[i])??current;}
    return samplePath(current,s);
  }
}

/** Two protected groups, amber and an all-red interval. No conflicting greens. */
export function signalAspect(junction:Pick<LaneJunction,'control'|'offset'>,group:number,clock:number):'green'|'amber'|'red'{
  if(junction.control!=='signal')return 'green';
  if(group<0||group>1)return 'red';
  const phase=((clock+(junction.offset??0))%32+32)%32,slot=group===0?phase:((phase+16)%32);
  return slot<12?'green':slot<15?'amber':'red';
}
