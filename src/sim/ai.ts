import type { InputFrame, Road, VehicleDefinition, V3 } from '../core/types';
import { CIRCUIT, ROADS, pointAt, nearestRoad } from '../content/world';
import { clamp, distance, wrap } from '../core/math';
import { neutralInput, Vehicle } from './physics';

export function racingInput(vehicle:Vehicle,others:Vehicle[],difficulty:number,wetness:number,index:number,road:Road=CIRCUIT):InputFrame {
  const s=vehicle.state,near=nearestRoad(s.position.x,s.position.z,r=>r.id===road.id),speed=Math.abs(s.speed),lookAhead=clamp(9+speed*.60,9,48);
  // Retain the grid lane until launch traffic has spread out; converging all cars
  // on the centerline in the first seconds caused avoidable contact.
  let offset=s.distance<80?clamp(near.lateral,-3,3):0;
  for(const other of others){if(other===vehicle)continue;const relX=other.state.position.x-s.position.x,relZ=other.state.position.z-s.position.z,forward=relX*Math.sin(s.yaw)+relZ*Math.cos(s.yaw),lateral=relX*Math.cos(s.yaw)-relZ*Math.sin(s.yaw);if(Math.abs(forward)<8&&Math.abs(lateral)<5)offset=near.lateral>=0?2.7:-2.7;else if(s.distance>150&&forward>3&&forward<32&&Math.abs(lateral)<2.5&&Math.abs(near.point.curvature)<.0015)offset=(index%2===0?1:-1)*2.8;}
  if(road.kind==='pit')offset=0;
  const target=pointAt(road,near.progress+lookAhead,offset);
  const alpha=wrap(Math.atan2(target.x-s.position.x,target.z-s.position.z)-s.yaw);
  const angle=Math.atan2(2*vehicle.definition.wheelbase*Math.sin(alpha),lookAhead)+pointAt(road,near.progress+lookAhead*.4).curvature*speed*speed*.0025,maxSteer=clamp(.57/(1+speed*.055),.115,.57);
  let targetSpeed=vehicle.definition.topSpeed/3.6*(.65+difficulty*.25);
  const grip=vehicle.definition.grip*(1-wetness*.4)*(vehicle.definition.class==='GT'?.27+difficulty*.12:.34+difficulty*.16);
  for(let ahead=0;ahead<=150;ahead+=12){const p=pointAt(road,near.progress+ahead);const cornerSpeed=Math.sqrt(grip*9.81/Math.max(.0001,Math.abs(p.curvature)));targetSpeed=Math.min(targetSpeed,Math.sqrt(cornerSpeed*cornerSpeed+2*grip*9.81*ahead*.65));}
  if(Math.abs(alpha)>.65)targetSpeed=Math.min(targetSpeed,12);
  if(near.distance>road.width*.5)targetSpeed=Math.min(targetSpeed,13);
  if(road.kind==='pit')targetSpeed=Math.min(targetSpeed,15.5);
  for(const other of others){if(other===vehicle)continue;const dx=other.state.position.x-s.position.x,dz=other.state.position.z-s.position.z,fwd=dx*Math.sin(s.yaw)+dz*Math.cos(s.yaw),side=dx*Math.cos(s.yaw)-dz*Math.sin(s.yaw);if(fwd>0&&fwd<10+speed*.3&&Math.abs(side)<1.9)targetSpeed=Math.min(targetSpeed,Math.max(0,other.state.speed-2));}
  const sideSlip=speed>4?Math.abs(wrap(Math.atan2(s.velocity.x,s.velocity.z)-s.yaw)):0;
  const cornerLoad=Math.abs(pointAt(road,near.progress+lookAhead*.4).curvature)*speed*speed/(vehicle.definition.grip*9.81);
  const throttleBudget=vehicle.definition.class==='FORMULA'?clamp(1-cornerLoad*.8,.2,1)*clamp((.19-sideSlip)/.12,0,1):1;
  const error=targetSpeed-speed;return {steer:clamp(angle/maxSteer,-1,1),throttle:clamp(error*.25,0,throttleBudget),brake:clamp(-error*.20,0,1),handbrake:false,shift:0,reverse:false};
}
export interface TrafficAgent {vehicle:Vehicle;road:Road;direction:1|-1;lane:number;input:InputFrame;timer:number;stuck:number;signal:number}
export function trafficInput(agent:TrafficAgent,others:Vehicle[],clock:number):InputFrame {
  const v=agent.vehicle,s=v.state,speed=Math.abs(s.speed),road=agent.road,nearest=nearestRoad(s.position.x,s.position.z,r=>r.id===road.id);
  if(!road.loop&&(agent.direction===1&&nearest.progress>road.length-20||agent.direction===-1&&nearest.progress<20)){
    const end=pointAt(road,agent.direction===1?road.length-.1:0);let candidate:Road|undefined,dir:1|-1=1,best=80;
    for(const r of ROADS){if(r.id===road.id||r.kind==='circuit'||r.kind==='pit'||r.kind==='test')continue;for(const side of [0,1]){const p=side?r.points[r.points.length-1]:r.points[0],dist=distance(end,p);if(dist<best){best=dist;candidate=r;dir=side?-1:1;}}}
    if(candidate){agent.road=candidate;agent.direction=dir;}else agent.direction=agent.direction===1?-1:1;
  }
  let targetSpeed=road.speed*(.8+(agent.signal%4)*.04),lane=agent.direction*road.width/(road.lanes===4?8:4);
  for(const other of others){if(other===v)continue;const dx=other.state.position.x-s.position.x,dz=other.state.position.z-s.position.z,forward=dx*Math.sin(s.yaw)+dz*Math.cos(s.yaw),lateral=dx*Math.cos(s.yaw)-dz*Math.sin(s.yaw);if(forward>0&&forward<10+speed*1.3&&Math.abs(lateral)<2.5){targetSpeed=Math.min(targetSpeed,Math.max(0,other.state.speed+(forward-10-speed*.8)*.4));if(road.lanes===4&&forward>14){const adjacentClear=others.every(o=>o===v||distance(o.state.position,s.position)>16||Math.abs(o.state.position.x-s.position.x)<1);if(adjacentClear)lane*=3;}}}
  // Signals are deterministic by junction zone and clock; traffic slows before entering a red zone.
  const ahead=pointAt(road,nearest.progress+agent.direction*(12+speed),lane);
  if(road.id.startsWith('city')){const junction=nearestRoad(ahead.x,ahead.z,r=>r.id!==road.id&&r.id.startsWith('city'));if(junction.distance<12){const green=(Math.floor(clock/12)+(road.id==='city1'||road.id==='city2'?0:1))%2===0;if(!green)targetSpeed=0;}}
  const lookAhead=8+speed*.65,target=pointAt(agent.road,nearest.progress+agent.direction*lookAhead,lane),alpha=wrap(Math.atan2(target.x-s.position.x,target.z-s.position.z)-s.yaw),angle=Math.atan2(2*v.definition.wheelbase*Math.sin(alpha),lookAhead),maxSteer=clamp(.57/(1+speed*.055),.115,.57);
  const curvature=Math.abs(pointAt(road,nearest.progress+agent.direction*25).curvature);targetSpeed=Math.min(targetSpeed,Math.sqrt(.55*9.81/Math.max(.0001,curvature)));if(Math.abs(alpha)>.8)targetSpeed=Math.min(targetSpeed,5);
  const error=targetSpeed-speed;return {throttle:clamp(error*.22,0,.65),brake:clamp(-error*.25,0,1),steer:clamp(angle/maxSteer,-1,1),handbrake:false,shift:0,reverse:false};
}
export function trafficSpawn(player:V3,index:number):{road:Road;position:ReturnType<typeof pointAt>;direction:1|-1}{const near=nearestRoad(player.x,player.z,r=>r.kind==='road'||r.kind==='highway');const direction:1|-1=index%3===0?-1:1;const road=near.road,offset=direction*road.width/(road.lanes===4?8:4),position=pointAt(road,near.progress+35+index*37,offset);if(direction===-1)position.yaw+=Math.PI;return {road,position,direction};}
