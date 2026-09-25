import {clamp} from '../core/math';

export interface RaceNeighbour {id:string;along:number;offset:number;speed:number;width:number;length:number}
export interface RaceTacticsContext {speed:number;freeSpeed:number;offset:number;width:number;length:number;limit:number;curvature:number;cornerAhead:number;difficulty:number;preferred:number;neighbours:RaceNeighbour[]}
export interface RaceTactic {mode:'line'|'pass'|'defend';offset:number;opponent:string;age:number;cooldown:number}
export const initialTactic=():RaceTactic=>({mode:'line',offset:0,opponent:'',age:0,cooldown:0});

/** Check the entire lateral sweep and predicted longitudinal overlap, not just
 * the destination lane. Inputs are road coordinates and decisions alter only
 * steering targets; every entrant retains the same physical grip and power. */
export function corridorClear(c:RaceTacticsContext,target:number){
  const horizon=Math.max(1.2,Math.abs(target-c.offset)/1.2+.35);
  return c.neighbours.every(n=>{
    const separation=(c.width+n.width)/2+.65;
    if(n.offset<Math.min(c.offset,target)-separation||n.offset>Math.max(c.offset,target)+separation)return true;
    const end=n.along+(n.speed-c.speed)*horizon,clearance=(c.length+n.length)/2+3;
    return Math.min(n.along,end)>clearance||Math.max(n.along,end)<-clearance;
  });
}

export function chooseRaceTactic(c:RaceTacticsContext,previous:RaceTactic,dt:number):RaceTactic{
  const next={...previous,age:previous.age+Math.max(0,dt),cooldown:Math.max(0,previous.cooldown-dt)};
  const base=clamp(c.preferred,-c.limit,c.limit),straight=Math.abs(c.curvature)<.0015;
  const opponent=c.neighbours.find(n=>n.id===previous.opponent);
  if(previous.mode!=='line'){
    const completed=!opponent||(previous.mode==='pass'
      ?opponent.along<-(c.length+opponent.length)/2-6||next.age>12
      :opponent.along>(c.length+opponent.length)/2+6||next.age>5);
    // Once committed, keep the side while overlapping. Reservation/braking in
    // racingInput remain authoritative if a rival occupies our swept corridor.
    if(!completed&&straight){
      if(corridorClear(c,previous.offset))return next;
      return {...next,offset:c.offset};
    }
    if(!corridorClear(c,base))return {...next,offset:c.offset};
    return {mode:'line',offset:base,opponent:'',age:0,cooldown:4};
  }
  next.offset=corridorClear(c,base)?base:c.offset;
  if(!straight||c.speed<5||next.cooldown>0)return next;
  const lead=c.neighbours.filter(n=>n.along>10&&n.along<55&&Math.abs(n.offset-c.offset)<(c.width+n.width)/2+.7&&c.freeSpeed-n.speed>1.1+(1-c.difficulty)*1.3).sort((a,b)=>a.along-b.along||a.id.localeCompare(b.id))[0];
  if(lead){
    const candidates=[-1,1].map(side=>clamp(lead.offset+side*((c.width+lead.width)/2+.85),-c.limit,c.limit))
      .filter(target=>Math.abs(target-lead.offset)>(c.width+lead.width)/2+.6&&corridorClear(c,target));
    // Prefer the shortest available move; use the approaching corner only as
    // a tie-break. Array order is stable, never the entrant's grid/index parity.
    candidates.sort((a,b)=>Math.abs(a-c.offset)-Math.abs(b-c.offset)||(c.cornerAhead>=0?b-a:a-b));
    if(candidates.length)return {mode:'pass',offset:candidates[0],opponent:lead.id,age:0,cooldown:0};
  }
  const chaser=c.neighbours.filter(n=>n.along< -18&&n.along> -55&&n.speed-c.speed>1&&n.speed-c.speed<7).sort((a,b)=>b.along-a.along||a.id.localeCompare(b.id))[0];
  // A single early inside-line move, never a late block against an overlap.
  if(chaser&&Math.abs(c.cornerAhead)>.001&&c.difficulty>=.45){
    const target=Math.sign(c.cornerAhead)*Math.min(1.6,c.limit);
    if(corridorClear(c,target))return {mode:'defend',offset:target,opponent:chaser.id,age:0,cooldown:0};
  }
  return next;
}
