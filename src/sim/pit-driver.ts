import type {InputFrame,RacerProgress,RaceState,VehicleState,VehicleDefinition} from '../core/types';
import type {Vehicle} from './physics';
import {neutralInput} from './physics';
import {racingInput} from './ai';
import {CIRCUIT,PIT,nearestRoad} from '../content/world';
import {PIT_POLICY,PIT_VISIT,pitBox} from '../content/pit-plan';
import {clamp,wrap} from '../core/math';
import {projectPath,samplePath} from './lane-graph';

type PitPhase='circuit'|'requested'|'approach'|'service'|'exit'|'yield'|'rejoin';
export function serviceReason(s:VehicleState,d:VehicleDefinition,r:RacerProgress|undefined,race:RaceState,rate:number=PIT_POLICY.initialFuelPerMetre):'fuel'|'tires'|''{
  if(!r||r.finished||race.phase==='countdown'||race.phase==='finished'||race.phase==='idle')return '';
  const remaining=race.phase==='racing'?Math.max(0,(race.session.laps-Math.max(1,r.lap))*CIRCUIT.length+CIRCUIT.length-r.progress):Infinity;
  const nextVisit=(CIRCUIT.length+PIT.length)*rate+PIT_POLICY.fuelReserve;
  if(s.fuel<Math.min(nextVisit,remaining*rate+PIT_POLICY.fuelReserve))return 'fuel';
  if(s.wheels.some(w=>w.wear<PIT_POLICY.wearThreshold)&&(remaining>1500||s.wheels.some(w=>w.wear<.25)))return 'tires';
  return '';
}

/** Conservative time gap at the actual pit/circuit merge, height-aware and
 * excluding cars still in the parallel pit lane. No priority over main track. */
export function pitMergeBlocker(self:VehicleState,others:VehicleState[]):string|null{
  for(const other of others){
    if(other.id===self.id)continue;
    const n=nearestRoad(other.position.x,other.position.z,r=>r.id===CIRCUIT.id);
    if(n.distance>CIRCUIT.width/2+2||Math.abs(other.position.y-n.point.y)>2.5)continue;
    const ahead=(n.progress-PIT_VISIT.mergeCircuit+CIRCUIT.length)%CIRCUIT.length,behind=(PIT_VISIT.mergeCircuit-n.progress+CIRCUIT.length)%CIRCUIT.length;
    if(ahead<45||behind<25+Math.abs(other.speed)*PIT_POLICY.mergeGap)return other.id;
  }return null;
}

export class PitDriver {
  phase:PitPhase='circuit';reason='';serviceElapsed=0;stops=0;waitingFor:string|null=null;routeProgress=0;
  private clearTime=0;private previousFuel?:number;private previousDistance?:number;private measuredFuel=0;private measuredDistance=0;private fuelRate:number=PIT_POLICY.initialFuelPerMetre;
  constructor(readonly index:number){}
  get active(){return !['circuit','requested'].includes(this.phase);}
  reset(){this.phase='circuit';this.reason='';this.serviceElapsed=0;this.clearTime=0;this.waitingFor=null;}
  snapshot(){return {phase:this.phase,reason:this.reason,box:pitBox(this.index),serviceElapsed:this.serviceElapsed,stops:this.stops,waitingFor:this.waitingFor,routeProgress:this.routeProgress,fuelPerLap:this.fuelRate*CIRCUIT.length};}
  update(dt:number,vehicle:Vehicle,others:Vehicle[],race:RaceState,wetness:number):{input:InputFrame;serviceComplete:boolean}{
    const s=vehicle.state,track=nearestRoad(s.position.x,s.position.z,r=>r.id===CIRCUIT.id),r=race.entrants.find(r=>r.id===s.id);
    // Learn consumption from normal travel only. Refueling/reset and injected
    // test faults cannot become a huge spurious per-lap estimate.
    if(!this.active&&this.previousFuel!==undefined&&this.previousDistance!==undefined){const used=this.previousFuel-s.fuel,travel=s.distance-this.previousDistance;if(used>=0&&used<.2&&travel>0&&travel<30){this.measuredFuel+=used;this.measuredDistance+=travel;if(this.measuredDistance>250){this.fuelRate=clamp(Math.max(this.fuelRate*.9,this.measuredFuel/this.measuredDistance*1.1),.0002,.005);this.measuredFuel=0;this.measuredDistance=0;}}}
    this.previousFuel=s.fuel;this.previousDistance=s.distance;
    if(!this.active){
      this.reason=serviceReason(s,vehicle.definition,r,race,this.fuelRate);this.phase=this.reason?'requested':'circuit';
      const ahead=(PIT_VISIT.start-track.progress+CIRCUIT.length)%CIRCUIT.length;
      // Commit only at the entrance on a valid driving lap, never from the grid
      // or by turning back after missing the approach.
      if(this.reason&&r&&r.lap>=1&&ahead>CIRCUIT.length-25&&track.distance<CIRCUIT.width/2+1&&s.grounded&&Math.abs(s.position.y-track.point.y)<2.5)this.phase='approach';
      else{
        const input=racingInput(vehicle,others,race.session.difficulty,wetness,this.index,CIRCUIT,dt);
        if(this.reason&&r&&r.lap>=1&&ahead<260){const target=Math.sqrt(PIT_POLICY.speed**2+2*PIT_POLICY.braking*ahead);input.throttle=Math.min(input.throttle,clamp((target-s.speed)*.2,0,1));input.brake=Math.max(input.brake,clamp((s.speed-target)*.2,0,.7));}
        return {input,serviceComplete:false};
      }
    }
    const n=projectPath(PIT_VISIT.road,s.position,true),pit=nearestRoad(s.position.x,s.position.z,r=>r.id===PIT.id);this.routeProgress=n.progress;
    const box=pitBox(this.index),atBox=pit.distance<2&&Math.abs(pit.progress-box)<PIT_POLICY.stopTolerance&&Math.abs(s.position.y-pit.point.y)<2.5&&s.grounded&&Math.abs(s.speed)<PIT_POLICY.stoppedSpeed;
    if(this.phase==='approach'&&atBox)this.phase='service';
    if(this.phase==='service'){
      this.serviceElapsed=atBox?this.serviceElapsed+dt:0;
      if(!atBox){this.phase='approach';}
      else if(this.serviceElapsed>=PIT_POLICY.serviceSeconds){this.phase='exit';this.stops++;this.serviceElapsed=0;return {input:{...neutralInput(),brake:1},serviceComplete:true};}
      else return {input:{...neutralInput(),brake:1},serviceComplete:false};
    }
    if(this.phase==='rejoin'&&n.progress>PIT_VISIT.road.length-4){this.reset();return {input:racingInput(vehicle,others,race.session.difficulty,wetness,this.index,CIRCUIT,dt),serviceComplete:false};}
    const look=7+Math.abs(s.speed)*.65,aim=samplePath(PIT_VISIT.road,n.progress+look),delta=wrap(Math.atan2(aim.x-s.position.x,aim.z-s.position.z)-s.yaw);
    const curve=Math.max(...[0,10,20,30].map(a=>Math.abs(samplePath(PIT_VISIT.road,n.progress+a).curvature)));
    let targetSpeed=Math.min(PIT_POLICY.speed,Math.sqrt(2.8/Math.max(.004,curve)));
    if(this.phase==='approach'&&pit.progress>150&&pit.distance<6)targetSpeed=Math.min(targetSpeed,Math.sqrt(Math.max(0,box-pit.progress)*2));
    if((this.phase==='exit'||this.phase==='yield')&&n.progress>PIT_VISIT.hold-100){
      this.waitingFor=pitMergeBlocker(s,others.map(v=>v.state));this.clearTime=this.waitingFor?0:this.clearTime+dt;
      if(this.clearTime<PIT_POLICY.mergeClearSeconds){this.phase='yield';targetSpeed=Math.min(targetSpeed,Math.sqrt(Math.max(0,PIT_VISIT.hold-n.progress)*2*PIT_POLICY.braking));}
      else if(n.progress>PIT_VISIT.hold-3){this.phase='rejoin';this.waitingFor=null;}
      else this.phase='exit';
    }
    // Single-file pit traffic: no passing through a stopped service car. Predict
    // a stopping distance instead of braking only at bumper contact.
    for(const other of others){if(other===vehicle)continue;const dx=other.state.position.x-s.position.x,dz=other.state.position.z-s.position.z,forward=dx*Math.sin(s.yaw)+dz*Math.cos(s.yaw),side=dx*Math.cos(s.yaw)-dz*Math.sin(s.yaw);
      if(forward>0&&forward<65&&Math.abs(side)<(vehicle.definition.width+other.definition.width)/2+.35&&Math.abs(s.position.y-other.state.position.y)<2.5){const gap=forward-(vehicle.definition.length+other.definition.length)/2-3;targetSpeed=Math.min(targetSpeed,Math.sqrt(Math.max(0,other.state.speed)**2+2*PIT_POLICY.braking*Math.max(0,gap)));if(gap<.5)targetSpeed=0;}
    }
    const maxSteer=clamp(.57/(1+Math.abs(s.speed)*.055),.115,.57),steer=Math.atan2(2*vehicle.definition.wheelbase*Math.sin(delta),look)/maxSteer;
    const input={...neutralInput(),throttle:clamp((targetSpeed-s.speed)*.25,0,.65),brake:clamp((s.speed-targetSpeed)*.25,0,1),steer:clamp(steer,-1,1)};
    if(targetSpeed<.15&&Math.abs(s.speed)<.7){input.throttle=0;input.brake=1;}
    return {input,serviceComplete:false};
  }
}
