import type { InputFrame, Road } from '../core/types';
import { CIRCUIT, pointAt, nearestRoad } from '../content/world';
import { clamp, wrap } from '../core/math';
import { Vehicle } from './physics';
import { RACE_AI } from '../content/race-course';

export function racingInput(vehicle:Vehicle,others:Vehicle[],difficulty:number,wetness:number,index:number,road:Road=CIRCUIT):InputFrame {
  const s=vehicle.state,near=nearestRoad(s.position.x,s.position.z,r=>r.id===road.id),speed=Math.abs(s.speed),lookAhead=clamp(9+speed*.60,9,48);
  // Retain the grid lane until launch traffic has spread out; converging all cars
  // on the centerline in the first seconds caused avoidable contact.
  let offset=s.distance<80?clamp(near.lateral,-3,3):0,bypass=false;
  for(const other of others){
    if(other===vehicle)continue;
    const relX=other.state.position.x-s.position.x,relZ=other.state.position.z-s.position.z,forward=relX*Math.sin(s.yaw)+relZ*Math.cos(s.yaw),lateral=relX*Math.cos(s.yaw)-relZ*Math.sin(s.yaw);
    if(Math.abs(forward)<8&&Math.abs(lateral)<5)offset=lateral<0?2.7:-2.7;
    else if(s.distance>150&&forward>3&&forward<40&&Math.abs(lateral)<2.5){
      if(Math.abs(other.state.speed)<2){
        const candidate=lateral<=0?3:-3,clear=others.every(v=>{if(v===vehicle||v===other)return true;const dx=v.state.position.x-s.position.x,dz=v.state.position.z-s.position.z,f=dx*Math.sin(s.yaw)+dz*Math.cos(s.yaw),side=dx*Math.cos(s.yaw)-dz*Math.sin(s.yaw);return f< -10||f>45||Math.abs(side-(candidate-near.lateral))>(vehicle.definition.width+v.definition.width)/2+.5;});
        if(clear){offset=candidate;bypass=true;}
      }else if(Math.abs(near.point.curvature)<.0015)offset=(index%2===0?1:-1)*2.8;
    }
  }
  if(road.kind==='pit')offset=0;
  const target=pointAt(road,near.progress+lookAhead,offset);
  const alpha=wrap(Math.atan2(target.x-s.position.x,target.z-s.position.z)-s.yaw);
  const angle=Math.atan2(2*vehicle.definition.wheelbase*Math.sin(alpha),lookAhead)+pointAt(road,near.progress+lookAhead*.4).curvature*speed*speed*.0025,maxSteer=clamp(.57/(1+speed*.055),.115,.57);
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
      const gap=Math.max(0,fwd-(vehicle.definition.length+other.definition.length)/2-4-speed*.35);
      // Match the lead car before reaching its bumper, including a slow car
      // on a pit approach. The old 10m proximity check was too late at race pace.
      targetSpeed=Math.min(targetSpeed,Math.sqrt(leadSpeed*leadSpeed+2*Math.max(1.5,grip*9.81*.65)*gap));
      if(gap===0)targetSpeed=Math.min(targetSpeed,Math.max(0,leadSpeed-2));
    }
  }
  const sideSlip=speed>4?Math.abs(wrap(Math.atan2(s.velocity.x,s.velocity.z)-s.yaw)):0;
  const cornerLoad=Math.abs(pointAt(road,near.progress+lookAhead*.4).curvature)*speed*speed/(vehicle.definition.grip*tireCondition*9.81);
  const formula=vehicle.definition.class==='FORMULA';
  const throttleBudget=clamp(1-cornerLoad*(formula?.8:.7),.2,1)*clamp(((formula?.19:.22)-sideSlip)/.12,0,1);
  const error=targetSpeed-speed;return {steer:clamp(angle/maxSteer,-1,1),throttle:clamp(error*.25,0,throttleBudget),brake:clamp(-error*.20,0,1),handbrake:false,shift:0,reverse:false};
}
