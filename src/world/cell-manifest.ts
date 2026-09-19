import type { V3, Quality, WorldCellManifest } from '../core/types';
import { CELL_SIZE, ROADS, CIRCUIT, PIT } from '../content/world';
import { hash } from '../core/math';

export type StreamingProfile='exploration'|'racing';
export const cellKey=(cx:number,cz:number)=>`${cx},${cz}`;
export const cellCoordinates=(p:Pick<V3,'x'|'z'>)=>({cx:Math.floor(p.x/CELL_SIZE),cz:Math.floor(p.z/CELL_SIZE)});
export function cellManifest(cx:number,cz:number):WorldCellManifest{
  const x=cx*CELL_SIZE,z=cz*CELL_SIZE;
  return {id:cellKey(cx,cz),cx,cz,bounds:[x,z,x+CELL_SIZE,z+CELL_SIZE],seed:hash(cx,cz),version:1,assets:[],dependencies:[],roadIds:ROADS.filter(r=>r.points.some(p=>p.x>=x-20&&p.x<x+CELL_SIZE+20&&p.z>=z-20&&p.z<z+CELL_SIZE+20)).map(r=>r.id),layers:['terrain','surface']};
}
export interface CellDemand {id:string;cx:number;cz:number;priority:number;collision:boolean;detail:boolean;owners:Set<string>}
export interface StreamActor {id:string;position:V3;velocity:V3}
const valid=(cx:number,cz:number)=>cx>=-9&&cx<=8&&cz>=-9&&cz<=8;
export function planCells(player:StreamActor,others:StreamActor[],quality:Quality,profile:StreamingProfile):Map<string,CellDemand>{
  const demand=new Map<string,CellDemand>(),center=cellCoordinates(player.position);
  const add=(cx:number,cz:number,owner:string,collision:boolean,detail:boolean,priority:number)=>{
    if(!valid(cx,cz))return;const id=cellKey(cx,cz),entry=demand.get(id)??{id,cx,cz,priority,collision:false,detail:false,owners:new Set<string>()};entry.collision ||= collision;entry.detail ||= detail;entry.priority=Math.min(entry.priority,priority);entry.owners.add(owner);demand.set(id,entry);
  };
  const around=(p:V3,radius:number,owner:string,collision:boolean,detail:boolean,priority:number)=>{const c=cellCoordinates(p);for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++)add(c.cx+dx,c.cz+dz,owner,collision,detail,priority+dx*dx+dz*dz);};
  for(const actor of [player,...others]){
    around(actor.position,1,actor.id,true,actor===player,actor===player?-1000:-800);
    // Sample the entire six-second swept corridor, not only its far endpoint.
    const length=Math.hypot(actor.velocity.x,actor.velocity.z)*6,count=Math.max(1,Math.ceil(length/(CELL_SIZE*.5)));
    for(let i=1;i<=count;i++){const t=i/count*6;around({x:actor.position.x+actor.velocity.x*t,y:actor.position.y,z:actor.position.z+actor.velocity.z*t},1,`${actor.id}:ahead`,true,false,-500+i);}
  }
  const radius=quality==='Low'?2:quality==='Ultra'?4:3;
  for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++)add(center.cx+dx,center.cz+dz,'view',false,true,dx*dx+dz*dz-(dx*player.velocity.x+dz*player.velocity.z)*.02);
  if(profile==='racing')for(const road of [CIRCUIT,PIT])for(const p of road.points)around(p,1,'race-reservation',true,false,-300);
  return demand;
}
