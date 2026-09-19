import { Vector3 } from '@babylonjs/core';
import type { Kairos } from '../app';
import { TRAFFIC_GRAPH } from '../content/traffic-network';
import { DEFAULT_SETTINGS, vehicleById } from '../content/vehicles';
import { TrafficController, type TrafficObservation } from '../sim/traffic';
import { projectPath, samplePath, type LanePath } from '../sim/lane-graph';
import { FIXED_DT, Vehicle, neutralInput } from '../sim/physics';
import { distance } from '../core/math';

export type TrafficCase='signal'|'left'|'right'|'uturn'|'following'|'lane-change'|'merge'|'recovery';
function clearance(a:Vehicle,b:Vehicle){
  const axes=(v:Vehicle)=>[{x:Math.cos(v.state.yaw),z:-Math.sin(v.state.yaw)},{x:Math.sin(v.state.yaw),z:Math.cos(v.state.yaw)}],aa=axes(a),bb=axes(b),dx=b.state.position.x-a.state.position.x,dz=b.state.position.z-a.state.position.z;
  const extent=(v:Vehicle,axes:{x:number;z:number}[],axis:{x:number;z:number})=>Math.abs(axes[0].x*axis.x+axes[0].z*axis.z)*v.definition.width/2+Math.abs(axes[1].x*axis.x+axes[1].z*axis.z)*v.definition.length/2;
  return Math.max(...[...aa,...bb].map(axis=>Math.abs(dx*axis.x+dz*axis.z)-extent(a,aa,axis)-extent(b,bb,axis)));
}
/** Physical acceptance rig: standard vehicle inputs, Havok contacts, no force or position correction. */
export async function runTrafficCase(game:Kairos,name:TrafficCase){
  game.advanceTime(0);game.save.settings.traffic=0;await game.startDrive();game.audio.pause();
  const graph=TRAFFIC_GRAPH,paths=[...graph.paths.values()],settings={...DEFAULT_SETTINGS,volume:0,traffic:0,timeRate:0};
  let path:LanePath;
  if(name==='signal')path=paths.find(p=>p.kind==='lane'&&p.roadId==='city3'&&p.to==='westbrook-cedar'&&p.direction===1)!;
  else if(name==='left'||name==='right')path=paths.find(p=>p.kind==='lane'&&p.roadId==='city1'&&p.to==='westbrook-cedar'&&p.direction===1)!;
  else if(name==='uturn')path=paths.find(p=>p.kind==='lane'&&p.roadId==='city1'&&p.to==='terminal-city1-start')!;
  else if(name==='merge')path=paths.find(p=>p.kind==='lane'&&p.roadId==='south'&&p.to==='orchard-east')!;
  else path=paths.find(p=>p.kind==='lane'&&p.roadId===(name==='lane-change'?'crossway':'city1')&&p.length>250&&p.direction===1&&p.laneIndex===0)!;
  const start=name==='following'||name==='lane-change'||name==='recovery'?50:path.length-55,spawn=samplePath(path,start);
  game.world.ensure(spawn);game.player.dispose();const car=game.player=new Vehicle(game.physics,vehicleById('aeris'),'player',spawn,spawn.yaw);
  const others:Vehicle[]=[];
  if(name==='following'||name==='lane-change'||name==='recovery'){const p=samplePath(path,start+45);game.world.ensure(p);others.push(new Vehicle(game.physics,vehicleById('nova'),'obstacle',p,p.yaw));}
  const observation=(v:Vehicle):TrafficObservation=>({id:v.id,position:v.state.position,yaw:v.state.yaw,speed:v.state.speed,length:v.definition.length,width:v.definition.width});
  const controller=new TrafficController(graph),agent=controller.add(car.id,0,path.id,start),visited=new Set([path.id]);
  if(name==='left'||name==='right'||name==='uturn')agent.nextId=path.next.find(id=>graph.paths.get(id)!.turn===name)!;
  if(name==='merge')agent.nextId=path.next.find(id=>graph.paths.get(id)!.targetLane?.startsWith('ring'))!;
  const initialNext=agent.nextId,turnTarget=initialNext?graph.paths.get(initialNext)!.targetLane:undefined;
  for(let tick=0;tick<240;tick++){for(const v of [car,...others])v.preStep({...neutralInput(),brake:1},settings,0,FIXED_DT);game.physics.step(FIXED_DT);for(const v of [car,...others])v.postStep(FIXED_DT);}
  const speed=name==='signal'?10:name==='following'||name==='lane-change'?12:8;
  car.body.setLinearVelocity(new Vector3(Math.sin(spawn.yaw)*speed,0,Math.cos(spawn.yaw)*speed));car.state.speed=speed;car.state.wheels.forEach(w=>w.omega=speed/car.definition.wheelRadius);
  const trace:unknown[]=[],seconds=name==='signal'?32:name==='uturn'?30:name==='merge'?25:22;
  let input=neutralInput(),maxError=0,minGap=Infinity,minBodyClearance=Infinity,redMaxProgress=0,stoppedAtRed=false,stoppedForObstacle=false,laneChanges=0,wasChanging=false,maxDamage=0;
  for(let tick=0;tick<seconds/FIXED_DT;tick++){
    const t=tick*FIXED_DT,clock=t;
    if(name==='recovery'&&t>=12&&others.length){others.forEach(v=>v.dispose());others.length=0;}
    const observations=[car,...others].map(observation);
    if(clock+1e-8>=agent.decisionAt){const decision=controller.decide(agent,observations[0],observations,clock,car.definition.wheelbase);input=decision.input;maxError=Math.max(maxError,decision.laneError);}
    if(agent.laneChange&&!wasChanging)laneChanges++;wasChanging=!!agent.laneChange;
    game.world.ensure(car.state.position);car.preStep(input,settings,0,FIXED_DT);others.forEach(v=>v.preStep({...neutralInput(),brake:1},settings,0,FIXED_DT));game.physics.step(FIXED_DT);[car,...others].forEach(v=>v.postStep(FIXED_DT));
    visited.add(agent.pathId);maxDamage=Math.max(maxDamage,car.state.damage);
    if(others.length){minGap=Math.min(minGap,distance(car.state.position,others[0].state.position)-(car.definition.length+others[0].definition.length)/2);minBodyClearance=Math.min(minBodyClearance,clearance(car,others[0]));if(t>5&&Math.abs(car.state.speed)<.2)stoppedForObstacle=true;}
    if(name==='signal'&&t<16){redMaxProgress=Math.max(redMaxProgress,projectPath(path,car.state.position).progress);if(Math.abs(car.state.speed)<.2)stoppedAtRed=true;}
    if(tick%120===0)trace.push({t,path:agent.pathId,progress:agent.progress,speed:car.state.speed,target:agent.targetSpeed,reason:agent.reason,input,position:{...car.state.position},damage:car.state.damage});
  }
  const result={name,source:path.id,sourceLength:path.length,initialNext,turnTarget,visited:[...visited],distance:car.state.distance,maxError,minGap:Number.isFinite(minGap)?minGap:null,minBodyClearance:Number.isFinite(minBodyClearance)?minBodyClearance:null,redMaxProgress,stoppedAtRed,stoppedForObstacle,laneChanges,maxDamage,finalSpeed:car.state.speed,grounded:car.state.grounded,trace};
  game.clock=seconds;game.advanceTime(0);others.forEach(v=>v.dispose());return result;
}
