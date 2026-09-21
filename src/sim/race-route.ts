import type {V3} from '../core/types';
import {CIRCUIT,PIT,nearestRoad} from '../content/world';
import {CIRCUIT_GATES,PIT_GATES,PIT_TIMING,RACE_RULES,pitRaceProgress,gateCrossing,insidePitLane} from '../content/race-course';
import {insidePitServiceApron} from '../content/pit-plan';

export interface RaceSample {id:string;position:V3;speed:number;grounded:boolean;reset?:boolean}
export interface RaceGateEvent {checkpoint:number;fraction:number;via:'circuit'|'pit'}
/** Per-entrant physical route proof, independent of session/lap bookkeeping. */
export class RaceRouteTracker {
  private previous?:RaceSample;private pitActive=false;private pitValid=false;private pitNext=0;
  reset(){this.previous=undefined;this.pitActive=false;this.pitValid=false;this.pitNext=0;}
  update(sample:RaceSample,dt:number){
    const p=sample.position,track=nearestRoad(p.x,p.z,r=>r.id===CIRCUIT.id),pit=nearestRoad(p.x,p.z,r=>r.id===PIT.id);
    const lateral=(p.x-pit.point.x)*Math.cos(pit.point.yaw)-(p.z-pit.point.z)*Math.sin(pit.point.yaw);
    const inServiceApron=insidePitServiceApron(pit.progress,lateral),heightValid=Math.abs(p.y-pit.point.y)<2.5;
    const inPit=(insidePitLane(pit.progress,pit.distance,track.distance)||inServiceApron)&&heightValid;
    const inPitRouteCorridor=pit.progress>10&&pit.progress<PIT.length-12&&(pit.distance<PIT.width/2+1||inServiceApron)&&heightValid;
    let invalid=false;const events:RaceGateEvent[]=[];const previous=this.previous;
    this.previous={...sample,position:{...p}};
    if(sample.reset){this.pitActive=false;this.pitValid=false;this.pitNext=0;invalid=true;}
    const motion=previous?Math.hypot(p.x-previous.position.x,p.y-previous.position.y,p.z-previous.position.z):0;
    const continuous=!!previous&&!sample.reset&&motion<=Math.max(12,Math.max(sample.speed,previous.speed)*dt*2+3);
    if(previous&&!continuous){invalid=true;this.pitActive=false;this.pitValid=false;this.pitNext=0;}
    // A small curb hop can cross a line legitimately. The line's height bounds
    // reject other road layers without depending on instantaneous tire contact.
    const crossing=(g:typeof PIT_GATES[number])=>continuous&&previous?gateCrossing(previous.position,p,g):null;
    const entry=crossing(PIT_GATES[0]);
    if(!this.pitActive&&entry!==null){this.pitActive=true;this.pitValid=true;this.pitNext=1;}
    else if(!this.pitActive&&inPit&&pit.progress>PIT_TIMING.entry+1){this.pitActive=true;this.pitValid=false;this.pitNext=0;}
    if(this.pitActive){
      // Leaving the actual lane, skipping a gate or teleporting cannot create
      // timing credit by nearest-point projection on the parallel main straight.
      if(!inPitRouteCorridor)this.pitValid=false;
      if(this.pitNext<PIT_GATES.length&&pit.progress>PIT_GATES[this.pitNext].roadS+12)this.pitValid=false;
      if(this.pitValid)while(this.pitNext<PIT_GATES.length){
        const gate=PIT_GATES[this.pitNext],fraction=crossing(gate);if(fraction===null)break;
        if(gate.mainCheckpoint!==undefined)events.push({checkpoint:gate.mainCheckpoint,fraction,via:'pit'});
        this.pitNext++;
      }
      invalid ||= !this.pitValid;
      if(this.pitNext===PIT_GATES.length){this.pitActive=false;}
      else if(!inPit&&(pit.progress<PIT_TIMING.entry-10||pit.progress>PIT_TIMING.exit+10)&&track.distance<CIRCUIT.width/2){this.pitActive=false;this.pitValid=false;}
    }else if(!inPit&&continuous)for(const gate of CIRCUIT_GATES){const fraction=crossing(gate);if(fraction!==null)events.push({checkpoint:gate.mainCheckpoint!,fraction,via:'circuit'});}
    const progress=this.pitActive||events.some(e=>e.via==='pit')?pitRaceProgress(pit.progress)%CIRCUIT.length:track.progress;
    const onTrack=track.distance<=CIRCUIT.width/2+RACE_RULES.trackMargin&&Math.abs(p.y-track.point.y)<2.5;
    return {progress,onTrack,pit:inPit,pitRoute:this.pitActive,pitCheckpoint:this.pitNext,pitValid:this.pitValid,invalid,events:events.sort((a,b)=>a.fraction-b.fraction)};
  }
}
