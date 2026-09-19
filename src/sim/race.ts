import type {RaceSessionConfig,RaceState,RacerProgress,V3} from '../core/types';
import {CIRCUIT} from '../content/world';
import {RACE_RULES} from '../content/race-course';
import {RaceRouteTracker,type RaceSample} from './race-route';
export {insidePitLane} from '../content/race-course';
export type {RaceSample} from './race-route';
export function validatedRaceDistance(r:RacerProgress){
  if(r.lap===0)return r.progress-CIRCUIT.length;
  const count=RACE_RULES.checkpoints,lower=(r.checkpoint===0?count-1:r.checkpoint-1)*CIRCUIT.length/count,upper=(r.checkpoint===0?count:r.checkpoint)*CIRCUIT.length/count;
  return (r.lap-1)*CIRCUIT.length+Math.max(lower,Math.min(upper,r.progress));
}
export const DRIVER_NAMES=['You','M. Laurent','A. Kim','S. Moretti','R. Okafor','L. Chen','K. Rivera','J. Berg','E. Sato','T. Walsh','N. Varga','I. Costa','D. Park','H. Rossi','F. Silva','P. Anders'];
export class RaceManager {
  state:RaceState;stage=0;
  private offTrack=new Map<string,number>();private limitsLatch=new Set<string>();private pitLatch=new Set<string>();
  private routes=new Map<string,RaceRouteTracker>();private gridPositions=new Map<string,V3>();private checkeredAt=Infinity;private falseStarts=new Set<string>();
  constructor(){this.state={phase:'idle',elapsed:0,remaining:0,countdown:3,flag:'',entrants:[],session:{kind:'Free Drive',laps:5,entrants:8,difficulty:.65,position:4,vehicleClass:'GT'}};}
  start(config:RaceSessionConfig,stage=0){
    this.stage=stage;this.checkeredAt=Infinity;this.falseStarts.clear();this.offTrack.clear();this.limitsLatch.clear();this.pitLatch.clear();this.routes.clear();this.gridPositions.clear();
    const phase=config.kind==='Practice'||config.kind==='Race Weekend'&&stage===0?'practice':config.kind==='Qualifying'||config.kind==='Race Weekend'&&stage===1?'qualifying':'countdown';
    this.state={phase,elapsed:0,remaining:phase==='qualifying'||config.kind==='Race Weekend'&&stage===0?300:Infinity,countdown:3,flag:phase==='countdown'?'GET READY':'GREEN',session:{...config},entrants:Array.from({length:config.entrants},(_,i)=>({id:i===0?'player':`racer-${i}`,name:DRIVER_NAMES[i],lap:0,checkpoint:0,progress:0,lastProgress:0,lapStart:0,best:Infinity,last:0,sectorStart:0,sectors:[],valid:true,warnings:0,penalty:0,finished:false,finishTime:0,pit:false,pitRoute:false,pitCheckpoint:0,pitValid:false}))};
  }
  nextStage(){if(this.state.session.kind!=='Race Weekend'||this.stage>=2)return false;const config={...this.state.session};if(this.stage===1){const ordered=[...this.state.entrants].sort((a,b)=>a.best-b.best);config.position=ordered.findIndex(r=>r.id==='player')+1;}this.start(config,this.stage+1);return true;}
  resetLap(id:string){const r=this.state.entrants.find(r=>r.id===id);if(r){r.valid=false;this.routes.get(id)?.reset();r.pitRoute=false;r.pitCheckpoint=0;r.pitValid=false;}}
  end(){this.state.phase='finished';this.state.flag='CHECKERED';}
  update(dt:number,samples:RaceSample[]){
    const state=this.state;if(state.phase==='idle'||state.phase==='finished')return;
    if(state.phase==='countdown'){
      for(const sample of samples){const initial=this.gridPositions.get(sample.id);if(!initial)this.gridPositions.set(sample.id,{...sample.position});else if(Math.hypot(sample.position.x-initial.x,sample.position.z-initial.z)>1&&sample.speed>1&&!this.falseStarts.has(sample.id)){const r=state.entrants.find(r=>r.id===sample.id);if(r){r.penalty+=RACE_RULES.falseStartPenalty;this.falseStarts.add(r.id);}}}
      state.countdown-=dt;if(state.countdown<=0){state.phase='racing';state.elapsed=0;state.flag='GREEN';this.routes.clear();}return;
    }
    state.elapsed+=dt;if(Number.isFinite(state.remaining)){state.remaining=Math.max(0,state.remaining-dt);if(state.remaining===0){this.end();return;}}
    state.flag='GREEN';
    for(const sample of samples){
      const r=state.entrants.find(r=>r.id===sample.id);if(!r||r.finished)continue;
      let tracker=this.routes.get(r.id);if(!tracker){tracker=new RaceRouteTracker();this.routes.set(r.id,tracker);}
      const route=tracker.update(sample,dt);Object.assign(r,{progress:route.progress,pit:route.pit,pitRoute:route.pitRoute,pitCheckpoint:route.pitCheckpoint,pitValid:route.pitValid});
      if(route.invalid||sample.reset)r.valid=false;
      if(route.pit||route.pitRoute){if(sample.speed>RACE_RULES.pitSpeed+RACE_RULES.pitSpeedTolerance&&!this.pitLatch.has(r.id)){r.penalty+=RACE_RULES.pitPenalty;this.pitLatch.add(r.id);}if(route.pit)this.limitsLatch.delete(r.id);}else this.pitLatch.delete(r.id);
      if(!route.onTrack&&!route.pit){
        const duration=(this.offTrack.get(r.id)??0)+dt;this.offTrack.set(r.id,duration);if(r.id==='player')state.flag='YELLOW';
        if(duration>RACE_RULES.trackLimitDelay&&!this.limitsLatch.has(r.id)){r.valid=false;r.warnings++;if(r.warnings%RACE_RULES.warningInterval===0)r.penalty+=RACE_RULES.trackPenalty;this.limitsLatch.add(r.id);}
      }else{this.offTrack.set(r.id,0);this.limitsLatch.delete(r.id);}
      if(sample.reset)continue;
      for(const event of route.events){
        if(event.checkpoint!==r.checkpoint){r.valid=false;continue;}
        const time=state.elapsed-dt+event.fraction*dt;
        if(r.checkpoint===0){
          if(r.lap>0){const lap=time-r.lapStart;r.last=lap;r.sectors.push(time-r.sectorStart);if(r.valid&&lap>10)r.best=Math.min(r.best,lap);
            if(state.phase==='racing'&&(r.lap>=state.session.laps||Number.isFinite(this.checkeredAt))){r.finished=true;r.finishTime=time+r.penalty;this.checkeredAt=Math.min(this.checkeredAt,time);break;}}
          r.lap++;r.lapStart=time;r.sectorStart=time;r.sectors=[];r.valid=!route.invalid;
        }else if(r.checkpoint===4||r.checkpoint===8){r.sectors.push(time-r.sectorStart);r.sectorStart=time;}
        r.checkpoint=(r.checkpoint+1)%RACE_RULES.checkpoints;r.lastProgress=route.progress;
      }
    }
    const player=state.entrants[0];if(player&&!player.finished&&this.order()[0]?.lap>player.lap+1)state.flag='BLUE';
    if(Number.isFinite(this.checkeredAt)){state.flag='CHECKERED';if(state.entrants.every(r=>r.finished)||state.elapsed-this.checkeredAt>RACE_RULES.finishWindow)this.end();}
  }
  order():RacerProgress[]{const timing=this.state.phase==='practice'||this.state.phase==='qualifying'||this.state.phase==='finished'&&(this.state.session.kind==='Practice'||this.state.session.kind==='Qualifying'||this.state.session.kind==='Race Weekend'&&this.stage<2);return [...this.state.entrants].sort((a,b)=>timing?a.best-b.best:a.finished&&b.finished?b.lap-a.lap||a.finishTime-b.finishTime:a.finished?-1:b.finished?1:validatedRaceDistance(b)-validatedRaceDistance(a));}
  get player(){return this.state.entrants[0];}
}
