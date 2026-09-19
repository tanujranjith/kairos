import type {Kairos} from '../app';
import {ROADS,CIRCUIT,PIT,RoadGraph,pointAt,nearestRoad,landmarkPosition,LANDMARKS} from '../content/world';
import {projectPath,samplePath} from '../sim/lane-graph';
import {DEFAULT_SETTINGS,vehicleById} from '../content/vehicles';
import {FIXED_DT,Vehicle,neutralInput} from '../sim/physics';
import {clamp,wrap,distance} from '../core/math';
import type {V3,RoadPoint} from '../core/types';

function routePath(raw:V3[]){let length=0;const points:RoadPoint[]=raw.map((p,i)=>{if(i)length+=distance(p,raw[i-1]);const a=raw[Math.max(0,i-1)],b=raw[Math.min(raw.length-1,i+1)];return {...p,s:length,yaw:Math.atan2(b.x-a.x,b.z-a.z),curvature:0};});for(let i=1;i<points.length-1;i++)points[i].curvature=wrap(points[i+1].yaw-points[i-1].yaw)/Math.max(.1,points[i+1].s-points[i-1].s);return {points,length};}
/** Input-only physical route check. Immediate cell installation isolates geometry from streaming latency. */
export async function validateAccess(g:Kairos,which:'inbound'|'outbound'|'contacts'='inbound'){
  await g.advanceTime(0);g.save.settings.traffic=0;g.save.settings.timeRate=0;await g.startDrive();
  const settings={...DEFAULT_SETTINGS,traffic:0,volume:0,timeRate:0},access=ROADS.find(r=>r.id==='circuitlink')!;let v=g.player;
  const step=(input=neutralInput())=>{v.preStep(input,settings,0,FIXED_DT);g.physics.step();v.postStep(FIXED_DT);};
  const prepare=(p:V3,yaw:number)=>{g.world.ensure(p);g.player.dispose();v=g.player=new Vehicle(g.physics,vehicleById('velara'),'player',p,yaw);for(let i=0;i<240;i++)step({...neutralInput(),brake:1});};
  if(which==='contacts'){
    const top=pointAt(CIRCUIT,3441.3,0),under=nearestRoad(top.x,top.z,r=>r.id===access.id),states:Record<string,unknown>={};
    for(const [id,p] of [['upper',top],['lower',pointAt(access,under.progress,2)],['pit',pointAt(PIT,450)]] as const){prepare(p,p.yaw);states[id]=structuredClone(v.state);await g.action('reset');for(let i=0;i<240;i++)step({...neutralInput(),brake:1});states[id+'Reset']=structuredClone(v.state);}
    return {states};
  }
  const crossing=nearestRoad(1050,-210,r=>r.id==='crossway'),publicSpawn=pointAt(crossing.road,crossing.progress-100,7.125),destination=landmarkPosition(LANDMARKS.find(l=>l.id==='aster')!),from=which==='inbound'?publicSpawn:pointAt(PIT,450),to=which==='inbound'?destination:pointAt(crossing.road,crossing.progress+100,7.125);
  const path=routePath(new RoadGraph().route({...from,yaw:from.yaw},to));if(path.points.length<2)throw new Error('No access route');
  for(let s=0;s<=path.length+80;s+=120)g.world.ensure(samplePath(path,s));prepare(path.points[0],path.points[0].yaw);
  let maxError=0,air=0,elapsed=0,progress=0;const contacts=new Set<string>(),wrongContacts:unknown[]=[],trace:unknown[]=[];
  for(let i=0;i<Math.ceil((path.length/5+40)/FIXED_DT);i++){
    const n=projectPath(path,v.state.position,true),remaining=path.length-n.progress,look=7+Math.abs(v.state.speed)*.65,aim=samplePath(path,n.progress+look),delta=wrap(Math.atan2(aim.x-v.state.position.x,aim.z-v.state.position.z)-v.state.yaw);
    const curve=Math.max(...[0,10,20,30].map(a=>Math.abs(samplePath(path,n.progress+a).curvature))),target=Math.min(12,Math.sqrt(2.8/Math.max(.004,curve)),Math.sqrt(Math.max(0,remaining-4)*3));
    const maxSteer=clamp(.57/(1+Math.abs(v.state.speed)*.055),.115,.57),steer=Math.atan2(2*v.definition.wheelbase*Math.sin(delta),look)/maxSteer;
    step({...neutralInput(),throttle:clamp((target-v.state.speed)*.25,0,.65),brake:clamp((v.state.speed-target)*.25,0,1),steer:clamp(steer,-1,1)});
    maxError=Math.max(maxError,n.distance);if(!v.state.grounded)air+=FIXED_DT;for(const w of v.state.wheels)if(w.contact)contacts.add(`${w.surface}:${w.layer}:${w.roadId??'junction'}`);
    if(v.state.wheels.some(w=>w.contact&&w.surface!=='Asphalt')&&wrongContacts.length<16)wrongContacts.push({s:n.progress,position:{...v.state.position},surface:v.state.surface});
    elapsed+=FIXED_DT;progress=n.progress;if(i%600===0)trace.push({s:n.progress,speed:v.state.speed,error:n.distance,position:{...v.state.position},damage:v.state.damage});
    if(remaining<8&&Math.abs(v.state.speed)<.6)break;if(v.state.damage>.05||n.distance>8)break;
  }
  if(which==='inbound'&&path.length-progress<12){await g.action('navigate','aster');await g.advanceTime(3200);}
  return {which,length:path.length,progress,elapsed,maxError,air,contacts:[...contacts],wrongContacts,trace,state:structuredClone(v.state),arrival:{destination:g.destination,visits:g.save.visits,message:g.message}};
}
