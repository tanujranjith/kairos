import type {Road,V3} from '../core/types';
import {CIRCUIT,PIT,pointAt,nearestRoad} from './world';
import {clamp,lerp} from '../core/math';

export const RACE_RULES={checkpoints:12,trackMargin:1.5,trackLimitDelay:.65,warningInterval:3,trackPenalty:5,falseStartPenalty:10,pitSpeed:60/3.6,pitSpeedTolerance:.83,pitPenalty:5,finishWindow:120} as const;
export const RACE_AI={wornTireThreshold:.55,wornTireSpeed:{ROAD:27,GT:27,FORMULA:18},
  laneChangeSpeed:1.2,overlapHorizon:1.2,longitudinalClearance:3,lateralClearance:.7,
  // Reserve space for measured corner-following error and the full vehicle,
  // rather than planning a body centre almost on top of the curb.
  trackingMargin:2,yawRateGain:.18,yawCorrectionLimit:.12,
} as const;
export interface TimingGate {id:string;position:V3;yaw:number;halfWidth:number;roadS:number;mainCheckpoint?:number}
const gate=(road:Road,s:number,id:string,halfWidth:number,mainCheckpoint?:number):TimingGate=>{const p=pointAt(road,s);return {id,position:p,yaw:p.yaw,halfWidth,roadS:s,mainCheckpoint};};
export const CIRCUIT_GATES=Array.from({length:RACE_RULES.checkpoints},(_,i)=>gate(CIRCUIT,i*CIRCUIT.length/RACE_RULES.checkpoints,`circuit-${i}`,CIRCUIT.width/2+RACE_RULES.trackMargin,i));
export const gateSide=(p:V3,g:TimingGate)=>(p.x-g.position.x)*Math.sin(g.yaw)+(p.z-g.position.z)*Math.cos(g.yaw);
/** Fraction of a forward crossing, clipped to the line's width and elevation. */
export function gateCrossing(a:V3,b:V3,g:TimingGate):number|null{
  const da=gateSide(a,g),db=gateSide(b,g);if(da>=0||db<0||db-da<1e-8)return null;
  const t=clamp(-da/(db-da),0,1),x=lerp(a.x,b.x,t)-g.position.x,z=lerp(a.z,b.z,t)-g.position.z;
  if(Math.abs(x*Math.cos(g.yaw)-z*Math.sin(g.yaw))>g.halfWidth||Math.abs(lerp(a.y,b.y,t)-g.position.y)>2.5)return null;
  return t;
}
function pitFinishProgress(){
  const finish=CIRCUIT_GATES[0];
  for(let i=1;i<PIT.points.length;i++){const a=PIT.points[i-1],b=PIT.points[i],da=gateSide(a,finish),db=gateSide(b,finish);if(da<=0&&db>0)return lerp(a.s,b.s,-da/(db-da));}
  throw new Error('Aster pit must cross the extended start/finish plane');
}
const circuitProgress=(p:V3)=>nearestRoad(p.x,p.z,r=>r.id===CIRCUIT.id).progress;
export const PIT_TIMING={entry:20,exit:PIT.length-20,finish:pitFinishProgress(),startCircuit:circuitProgress(PIT.points[0]),endCircuit:circuitProgress(PIT.points.at(-1)!)};
export const PIT_PROGRESS_KNOTS=[{s:0,race:PIT_TIMING.startCircuit},{s:PIT_TIMING.entry,race:circuitProgress(pointAt(PIT,PIT_TIMING.entry))},{s:PIT_TIMING.finish,race:CIRCUIT.length},{s:PIT_TIMING.exit,race:CIRCUIT.length+circuitProgress(pointAt(PIT,PIT_TIMING.exit))},{s:PIT.length,race:CIRCUIT.length+PIT_TIMING.endCircuit}];
/** Continuous unwrapped circuit-equivalent metres, anchored at entry, finish and merge. */
export function pitRaceProgress(s:number){
  const i=PIT_PROGRESS_KNOTS.findIndex((p,i)=>i>0&&s<=p.s),b=PIT_PROGRESS_KNOTS[i<0?PIT_PROGRESS_KNOTS.length-1:i],a=PIT_PROGRESS_KNOTS[(i<0?PIT_PROGRESS_KNOTS.length-1:i)-1];
  return lerp(a.race,b.race,clamp((s-a.s)/(b.s-a.s),0,1));
}
function pitAtRaceProgress(s:number){const i=PIT_PROGRESS_KNOTS.findIndex((p,i)=>i>0&&s<=p.race);if(i<0)return Infinity;const a=PIT_PROGRESS_KNOTS[i-1],b=PIT_PROGRESS_KNOTS[i];return lerp(a.s,b.s,(s-a.race)/(b.race-a.race));}
const pitMarks:{s:number;mainCheckpoint?:number}[]=[{s:PIT_TIMING.entry},{s:PIT_TIMING.exit}];
for(let s=PIT_TIMING.entry+50;s<PIT_TIMING.exit-5;s+=50)pitMarks.push({s});
for(let i=0;i<RACE_RULES.checkpoints;i++){const s=pitAtRaceProgress(CIRCUIT.length+i*CIRCUIT.length/RACE_RULES.checkpoints);if(s>PIT_TIMING.entry&&s<PIT_TIMING.exit)pitMarks.push({s,mainCheckpoint:i});}
export const PIT_GATES=pitMarks.sort((a,b)=>a.s-b.s).map(({s,mainCheckpoint},i)=>gate(PIT,s,`pit-${i}`,PIT.width/2+1,mainCheckpoint));
// The timing line across the pit is parallel to the circuit finish line.
PIT_GATES.find(g=>g.mainCheckpoint===0)!.yaw=CIRCUIT_GATES[0].yaw;
export const insidePitLane=(progress:number,distance:number,trackDistance:number)=>progress>10&&progress<PIT.length-12&&distance<PIT.width/2&&trackDistance>CIRCUIT.width/2;
