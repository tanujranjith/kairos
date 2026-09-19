import type { RaceSessionConfig, RaceState, RacerProgress } from '../core/types';
import { CIRCUIT, PIT } from '../content/world';
export const insidePitLane=(progress:number,distance:number,trackDistance:number)=>progress>10&&progress<PIT.length-12&&distance<3.5&&trackDistance>CIRCUIT.width*.5;
export function validatedRaceDistance(r:RacerProgress){
  if(r.lap===0)return r.progress-CIRCUIT.length;
  const lower=(r.checkpoint===0?11:r.checkpoint-1)*CIRCUIT.length/12;
  const upper=(r.checkpoint===0?12:r.checkpoint)*CIRCUIT.length/12;
  return (r.lap-1)*CIRCUIT.length+Math.max(lower,Math.min(upper,r.progress));
}
export const DRIVER_NAMES=['You','M. Laurent','A. Kim','S. Moretti','R. Okafor','L. Chen','K. Rivera','J. Berg','E. Sato','T. Walsh','N. Varga','I. Costa','D. Park','H. Rossi','F. Silva','P. Anders'];
export interface RaceSample {id:string;progress:number;lateral:number;speed:number;pit:boolean;reset?:boolean}
export class RaceManager {
  state:RaceState;stage=0;private offTrack=new Map<string,number>();private limitsLatch=new Set<string>();private pitLatch=new Set<string>();private samples=new Map<string,number>();private checkeredAt=Infinity;private falseStarts=new Set<string>();
  constructor(){this.state={phase:'idle',elapsed:0,remaining:0,countdown:3,flag:'',entrants:[],session:{kind:'Free Drive',laps:5,entrants:8,difficulty:.65,position:4,vehicleClass:'GT'}};}
  start(config:RaceSessionConfig,stage=0){this.stage=stage;this.checkeredAt=Infinity;this.falseStarts.clear();this.offTrack.clear();this.limitsLatch.clear();this.pitLatch.clear();this.samples.clear();const phase=config.kind==='Practice'||config.kind==='Race Weekend'&&stage===0?'practice':config.kind==='Qualifying'||config.kind==='Race Weekend'&&stage===1?'qualifying':'countdown';this.state={phase,elapsed:0,remaining:phase==='qualifying'||config.kind==='Race Weekend'&&stage===0?300:Infinity,countdown:3,flag:phase==='countdown'?'GET READY':'GREEN',session:{...config},entrants:Array.from({length:config.entrants},(_,i)=>({id:i===0?'player':`racer-${i}`,name:DRIVER_NAMES[i],lap:0,checkpoint:0,progress:0,lastProgress:0,lapStart:0,best:Infinity,last:0,sectorStart:0,sectors:[],valid:true,warnings:0,penalty:0,finished:false,finishTime:0,pit:false}))};}
  nextStage(){if(this.state.session.kind!=='Race Weekend'||this.stage>=2)return false;const config={...this.state.session};if(this.stage===1){const ordered=[...this.state.entrants].sort((a,b)=>a.best-b.best);config.position=ordered.findIndex(r=>r.id==='player')+1;}this.start(config,this.stage+1);return true;}
  resetLap(id:string){const r=this.state.entrants.find(r=>r.id===id);if(r){r.valid=false;this.samples.delete(id);}}
  end(){this.state.phase='finished';this.state.flag='CHECKERED';}
  update(dt:number,samples:RaceSample[]){const state=this.state;if(state.phase==='idle'||state.phase==='finished')return;
    if(state.phase==='countdown'){
      for(const sample of samples){const initial=this.samples.get(sample.id);if(initial===undefined)this.samples.set(sample.id,sample.progress);else if(Math.abs(sample.progress-initial)>1&&sample.speed>1&&!this.falseStarts.has(sample.id)){const r=state.entrants.find(r=>r.id===sample.id);if(r){r.penalty+=10;this.falseStarts.add(r.id);}}}
      state.countdown-=dt;if(state.countdown<=0){state.phase='racing';state.elapsed=0;state.flag='GREEN';this.samples.clear();}return;}
    state.elapsed+=dt;if(Number.isFinite(state.remaining)){state.remaining=Math.max(0,state.remaining-dt);if(state.remaining===0){this.end();return;}}
    state.flag='GREEN';
    for(const sample of samples){const r=state.entrants.find(r=>r.id===sample.id);if(!r||r.finished)continue;const previous=this.samples.get(r.id);this.samples.set(r.id,sample.progress);r.progress=sample.progress;r.pit=sample.pit;
      if(sample.reset){r.valid=false;continue;}
      if(sample.pit){if(sample.speed>17.5&&!this.pitLatch.has(r.id)){r.penalty+=5;this.pitLatch.add(r.id);}this.limitsLatch.delete(r.id);}else this.pitLatch.delete(r.id);
      if(Math.abs(sample.lateral)>CIRCUIT.width*.5+1.5&&!sample.pit){const duration=(this.offTrack.get(r.id)??0)+dt;this.offTrack.set(r.id,duration);if(r.id==='player')state.flag='YELLOW';if(duration>.65&&!this.limitsLatch.has(r.id)){r.valid=false;r.warnings++;if(r.warnings%3===0)r.penalty+=5;this.limitsLatch.add(r.id);}}else{this.offTrack.set(r.id,0);this.limitsLatch.delete(r.id);}
      if(previous===undefined)continue;
      let delta=sample.progress-previous;if(delta< -CIRCUIT.length*.5)delta+=CIRCUIT.length;if(delta>CIRCUIT.length*.5)delta-=CIRCUIT.length;
      if(Math.abs(delta)>Math.max(12,Math.abs(sample.speed)*dt*2+3)){r.valid=false;continue;}
      if(delta<-.5)continue;
      const nextGate=r.checkpoint*CIRCUIT.length/12;
      const crossed=nextGate===0?previous>CIRCUIT.length*.8&&sample.progress<CIRCUIT.length*.2:previous<nextGate&&sample.progress>=nextGate;
      if(!crossed)continue;
      if(r.checkpoint===0){if(r.lap>0){const lap=state.elapsed-r.lapStart;r.last=lap;r.sectors.push(state.elapsed-r.sectorStart);if(r.valid&&lap>10)r.best=Math.min(r.best,lap);if(state.phase==='racing'&&(r.lap>=state.session.laps||Number.isFinite(this.checkeredAt))){r.finished=true;r.finishTime=state.elapsed+r.penalty;this.checkeredAt=Math.min(this.checkeredAt,state.elapsed);continue;}}
        r.lap++;r.lapStart=state.elapsed;r.sectorStart=state.elapsed;r.sectors=[];r.valid=true;
      }else if(r.checkpoint===4||r.checkpoint===8){r.sectors.push(state.elapsed-r.sectorStart);r.sectorStart=state.elapsed;}
      r.checkpoint=(r.checkpoint+1)%12;r.lastProgress=sample.progress;
    }
    const player=state.entrants[0];if(player&&!player.finished&&this.order()[0]?.lap>player.lap+1)state.flag='BLUE';
    if(Number.isFinite(this.checkeredAt)){state.flag='CHECKERED';if(state.entrants.every(r=>r.finished)||state.elapsed-this.checkeredAt>120)this.end();}
  }
  order():RacerProgress[]{const timing=this.state.phase==='practice'||this.state.phase==='qualifying'||this.state.phase==='finished'&&(this.state.session.kind==='Practice'||this.state.session.kind==='Qualifying'||this.state.session.kind==='Race Weekend'&&this.stage<2);return [...this.state.entrants].sort((a,b)=>timing?a.best-b.best:a.finished&&b.finished?b.lap-a.lap||a.finishTime-b.finishTime:a.finished?-1:b.finished?1:validatedRaceDistance(b)-validatedRaceDistance(a));}
  get player(){return this.state.entrants[0];}
}
