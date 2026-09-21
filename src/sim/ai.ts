import type { InputFrame, Road } from '../core/types';
import { CIRCUIT, pointAt, nearestRoad } from '../content/world';
import { clamp, wrap } from '../core/math';
import type { Vehicle } from './physics';
import { RACE_AI } from '../content/race-course';

// A reserved lane is an anchored road offset, not the current lateral position
// re-sampled every decision (which integrates ordinary corner tracking error).
const reservedLanes=new WeakMap<Vehicle,{road:Road;offset:number}>();
const plannedLanes=new WeakMap<Vehicle,{road:Road;offset:number}>();
/** A lane change is a path transition, not an instantaneous six-metre target jump. */
export const advanceLaneOffset=(current:number,target:number,dt:number)=>current+clamp(target-current,-RACE_AI.laneChangeSpeed*dt,RACE_AI.laneChangeSpeed*dt);

export function racingInput(vehicle:Vehicle,others:Vehicle[],difficulty:number,wetness:number,index:number,road:Road=CIRCUIT,dt=.1,preferredOffset=0):InputFrame {
  const s=vehicle.state,near=nearestRoad(s.position.x,s.position.z,r=>r.id===road.id),speed=Math.abs(s.speed),lookAhead=clamp(9+speed*.60,9,48);
  // Retain the grid lane until launch traffic has spread out; converging all cars
  // on the centerline in the first seconds caused avoidable contact.
  let offset=s.distance<80?clamp(near.lateral,-3,3):preferredOffset,bypass=false,bypassVehicle:Vehicle|null=null;
  const laneLimit=Math.max(0,road.width/2-vehicle.definition.width/2-RACE_AI.trackingMargin);
  const previous=reservedLanes.get(vehicle),anchor=clamp(previous?.road===road?previous.offset:near.lateral,-laneLimit,laneLimit);
  let leftLimit=-laneLimit,rightLimit=laneLimit,reserved=false;
  for(const other of others){
    if(other===vehicle)continue;
    const relX=other.state.position.x-s.position.x,relZ=other.state.position.z-s.position.z,forward=relX*Math.sin(s.yaw)+relZ*Math.cos(s.yaw),lateral=relX*Math.cos(s.yaw)-relZ*Math.sin(s.yaw);
    if(Math.hypot(relX,relZ)>100||Math.abs(other.state.position.y-s.position.y)>2.5)continue;
    const otherNear=nearestRoad(other.state.position.x,other.state.position.z,r=>r.id===road.id);
    let along=otherNear.progress-near.progress;
    if(road.loop)along=(along+road.length*1.5)%road.length-road.length*.5;
    const relativeSpeed=(other.state.velocity.x-s.velocity.x)*Math.sin(near.point.yaw)+(other.state.velocity.z-s.velocity.z)*Math.cos(near.point.yaw);
    const predicted=along+relativeSpeed*RACE_AI.overlapHorizon,clearance=(vehicle.definition.length+other.definition.length)/2+RACE_AI.longitudinalClearance;
    // Reserve the lane while bodies overlap now or within the next 1.2s.
    // The old 5m side trigger let the two 6m-spaced grid lanes converge, then
    // commanded a reversal too late to avoid a high-speed side contact.
    // Work in road coordinates, not the car's yawing forward ray, and prohibit
    // a later passing decision from overriding this occupied-lane constraint.
    if(otherNear.distance<road.width/2+1&&Math.min(along,predicted)<clearance&&Math.max(along,predicted)>-clearance){
      const side=otherNear.lateral-near.lateral;
      if(Math.abs(side)<vehicle.definition.width+other.definition.width+4){
        reserved=true;const separation=(vehicle.definition.width+other.definition.width)/2+RACE_AI.lateralClearance;
        if(side<=0)leftLimit=Math.max(leftLimit,Math.min(laneLimit,Math.max(anchor,otherNear.lateral+separation)));
        else rightLimit=Math.min(rightLimit,Math.max(-laneLimit,Math.min(anchor,otherNear.lateral-separation)));
      }
    }
    const onRoad=near.distance<road.width/2+1&&otherNear.distance<road.width/2+1,pathForward=onRoad?along:forward,pathLateral=onRoad?otherNear.lateral-near.lateral:lateral;
    if(s.distance>150&&pathForward>1.5&&pathForward<45&&Math.abs(pathLateral)<2.8){
      if(Math.abs(other.state.speed)<2){
        const candidate=pathLateral<=0?Math.min(3,laneLimit):-Math.min(3,laneLimit),clear=others.every(v=>{if(v===vehicle||v===other)return true;const n=nearestRoad(v.state.position.x,v.state.position.z,r=>r.id===road.id);let f=n.progress-near.progress;if(road.loop)f=(f+road.length*1.5)%road.length-road.length*.5;const side=n.lateral-near.lateral;return f< -3||f>45||Math.abs(side-(candidate-near.lateral))>(vehicle.definition.width+v.definition.width)/2+.5;});
        if(clear){offset=candidate;bypass=true;bypassVehicle=other;}
      }else if(Math.abs(near.point.curvature)<.0015)offset=(index%2===0?1:-1)*2.8;
    }
  }
  if(reserved)reservedLanes.set(vehicle,{road,offset:anchor});else reservedLanes.delete(vehicle);
  const planned=plannedLanes.get(vehicle);
  offset=advanceLaneOffset(planned?.road===road?planned.offset:clamp(near.lateral,-laneLimit,laneLimit),offset,dt);
  offset=leftLimit<=rightLimit?clamp(offset,leftLimit,rightLimit):anchor;
  if(road.kind==='pit')offset=0;
  plannedLanes.set(vehicle,{road,offset});
  const target=pointAt(road,near.progress+lookAhead,offset);
  const alpha=wrap(Math.atan2(target.x-s.position.x,target.z-s.position.z)-s.yaw);
  const slipAngle=speed>4?wrap(Math.atan2(s.velocity.x,s.velocity.z)-s.yaw):0;
  // Track the path's requested yaw rate against the actual rigid body's yaw
  // rate. This damps overshoot without adding another v²-scaled curve term or
  // a steady sideslip steering bias. It changes the rack input, never velocity.
  const desiredYawRate=2*speed*Math.sin(alpha)/lookAhead,actualYawRate=vehicle.body?.getAngularVelocity().y??0;
  const angle=Math.atan2(2*vehicle.definition.wheelbase*Math.sin(alpha),lookAhead)+clamp((desiredYawRate-actualYawRate)*RACE_AI.yawRateGain,-RACE_AI.yawCorrectionLimit,RACE_AI.yawCorrectionLimit),maxSteer=clamp(.57/(1+speed*.055),.115,.57);
  let targetSpeed=vehicle.definition.topSpeed/3.6*(.65+difficulty*.25);
  if(bypass)targetSpeed=Math.min(targetSpeed,10);
  // A service-required car limps home instead of reaching full straight-line
  // speed and asking cold, worn tires for a sudden combined braking maneuver.
  if(s.wheels.some(w=>w.wear<RACE_AI.wornTireThreshold))targetSpeed=Math.min(targetSpeed,RACE_AI.wornTireSpeed[vehicle.definition.class]);
  const tireCondition=Math.min(...s.wheels.map(w=>.65+.35*w.wear));
  // Worn tires need both their physical grip reduction and an extra driving
  // margin for combined braking/turning. This changes inputs, never tire forces.
  const wearMargin=clamp(Math.min(...s.wheels.map(w=>w.wear))/.9,.45,1);
  const grip=vehicle.definition.grip*(1-wetness*.4)*tireCondition*wearMargin*wearMargin*(vehicle.definition.class==='GT'?.27+difficulty*.12:.34+difficulty*.16);
  for(let ahead=0;ahead<=150;ahead+=12){const p=pointAt(road,near.progress+ahead);const cornerSpeed=Math.sqrt(grip*9.81/Math.max(.0001,Math.abs(p.curvature)));targetSpeed=Math.min(targetSpeed,Math.sqrt(cornerSpeed*cornerSpeed+2*grip*9.81*ahead*.65));}
  if(Math.abs(alpha)>.65)targetSpeed=Math.min(targetSpeed,12);
  if(near.distance>road.width*.5)targetSpeed=Math.min(targetSpeed,13);
  if(road.kind==='pit')targetSpeed=Math.min(targetSpeed,15.5);
  for(const other of others){
    if(other===vehicle)continue;
    const dx=other.state.position.x-s.position.x,dz=other.state.position.z-s.position.z;
    if(Math.hypot(dx,dz)>220)continue;
    let fwd=dx*Math.sin(s.yaw)+dz*Math.cos(s.yaw),side=dx*Math.cos(s.yaw)-dz*Math.sin(s.yaw);
    const otherNear=nearestRoad(other.state.position.x,other.state.position.z,r=>r.id===road.id),along=road.loop?(otherNear.progress-near.progress+road.length)%road.length:otherNear.progress-near.progress;
    // Cars following the same bend may be far outside each other's straight
    // forward ray. Compare road distance/lane position before deciding to pass.
    if(near.distance<road.width/2+1&&otherNear.distance<road.width/2+1){if(along<=0||along>=220)continue;fwd=along;side=otherNear.lateral-near.lateral;}
    if(fwd>0&&fwd<220&&Math.abs(side)<(vehicle.definition.width+other.definition.width)/2+.4&&Math.abs(s.position.y-other.state.position.y)<2.5){
      const leadSpeed=Math.max(0,other.state.velocity.x*Math.sin(s.yaw)+other.state.velocity.z*Math.cos(s.yaw));
      // A queued car needs a little longitudinal motion before steering can
      // produce lateral clearance. Creep around the selected stationary hazard
      // instead of allowing the generic following rule to command zero speed.
      if(other===bypassVehicle){targetSpeed=Math.min(targetSpeed,3);continue;}
      const gap=Math.max(0,fwd-(vehicle.definition.length+other.definition.length)/2-4-speed*.35);
      // Match the lead car before reaching its bumper, including a slow car
      // on a pit approach. The old 10m proximity check was too late at race pace.
      targetSpeed=Math.min(targetSpeed,Math.sqrt(leadSpeed*leadSpeed+2*Math.max(1.5,grip*9.81*.65)*gap));
      if(gap===0)targetSpeed=Math.min(targetSpeed,Math.max(0,leadSpeed-2));
    }
  }
  const sideSlip=Math.abs(slipAngle);
  const cornerLoad=Math.abs(pointAt(road,near.progress+lookAhead*.4).curvature)*speed*speed/(vehicle.definition.grip*tireCondition*9.81);
  const formula=vehicle.definition.class==='FORMULA';
  const throttleBudget=clamp(1-cornerLoad*(formula?.8:.7),.2,1)*clamp(((formula?.19:.22)-sideSlip)/.12,0,1);
  const error=targetSpeed-speed;return {steer:clamp(angle/maxSteer,-1,1),throttle:clamp(error*.25,0,throttleBudget),brake:clamp(-error*.20,0,1),handbrake:false,shift:0,reverse:false};
}
