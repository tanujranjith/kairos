import type {Kairos} from '../app';
import type {Road,RoadPoint,V3,InputFrame} from '../core/types';
import {CIRCUIT,PIT,LANE_GRAPH,pointAt,nearestRoad} from '../content/world';
import {projectPath,samplePath} from '../sim/lane-graph';
import {racingInput} from '../sim/ai';
import {neutralInput} from '../sim/physics';
import {clamp,smooth,wrap,distance} from '../core/math';

/** Follow the real authored entry/exit connectors, not a teleport into service. */
function visitPath(){
  const entry=[...LANE_GRAPH.paths.values()].find(p=>p.junction==='aster-paddock-gate'&&p.sourceLane?.startsWith('circuit:')&&p.targetLane?.startsWith('pit:'))!;
  const exit=[...LANE_GRAPH.paths.values()].find(p=>p.junction==='aster-pit-exit'&&p.sourceLane?.startsWith('pit:'))!;
  const source=LANE_GRAPH.paths.get(entry.sourceLane!)!,lane=LANE_GRAPH.paths.get(entry.targetLane!)!,target=LANE_GRAPH.paths.get(exit.targetLane!)!;
  const start=source.roadEnd-180,raw:V3[]=[];
  for(let s=start;s<source.roadEnd;s+=3)raw.push(pointAt(CIRCUIT,s,-3.5*smooth((s-start)/70)));
  raw.push(...entry.points,...lane.points,...exit.points);
  for(let s=target.roadStart+3;s<target.roadStart+140;s+=3)raw.push(pointAt(CIRCUIT,s,-3.5*(1-smooth((s-target.roadStart)/90))));
  const unique=raw.filter((p,i)=>!i||distance(p,raw[i-1])>.01);let length=0;
  const points:RoadPoint[]=unique.map((p,i)=>{if(i)length+=distance(p,unique[i-1]);const a=unique[Math.max(0,i-1)],b=unique[Math.min(unique.length-1,i+1)];return {...p,s:length,yaw:Math.atan2(b.x-a.x,b.z-a.z),curvature:0};});
  for(let i=1;i<points.length-1;i++)points[i].curvature=wrap(points[i+1].yaw-points[i-1].yaw)/Math.max(.1,points[i+1].s-points[i-1].s);
  return {start,road:{id:'pit-visit-check',name:'Pit visit check',points,length,width:7,kind:'pit',loop:false,lanes:1,speed:12} as Road};
}
export async function installPitTimingDriver(g:Kairos,vehicleClass:'GT'|'FORMULA'){
  await g.advanceTime(0);g.save.settings.volume=0;g.save.settings.timeRate=0;Object.assign(g.raceConfig,{kind:'Practice',vehicleClass,entrants:1,position:1});await g.startRace();
  const visit=visitPath(),poll=g.input.poll.bind(g.input);let phase:'circuit'|'pit'|'service'|'exit'|'done'='circuit',serviceAt=0,maxError=0,served=false;
  const service:unknown[]=[];
  g.input.poll=():InputFrame=>{
    const v=g.player,s=v.state,track=nearestRoad(s.position.x,s.position.z,r=>r.id===CIRCUIT.id),pit=nearestRoad(s.position.x,s.position.z,r=>r.id===PIT.id);
    if(phase==='circuit'&&g.race.player.lap>=1&&track.progress>=visit.start&&track.progress<visit.start+80)phase='pit';
    if(phase==='circuit'||phase==='done'){
      const input=racingInput(v,[v],.65,g.wetness,0),ahead=visit.start-track.progress;
      // Brake on the racing line before moving across to the pit approach.
      if(phase==='circuit'&&g.race.player.lap>=1&&ahead>0&&ahead<240){const target=Math.sqrt(12*12+2*2.5*ahead);input.throttle=Math.min(input.throttle,clamp((target-s.speed)*.2,0,1));input.brake=Math.max(input.brake,clamp((s.speed-target)*.2,0,.5));}
      return input;
    }
    const n=projectPath(visit.road,s.position,true);maxError=Math.max(maxError,n.distance);
    if(phase==='service'){
      if(g.clock-serviceAt<6.3)return {...neutralInput(),brake:1};
      served=true;phase='exit';service.push({when:'after',fuel:s.fuel,wear:s.wheels.map(w=>w.wear),race:structuredClone(g.race.player)});
    }
    if(phase==='exit'&&n.progress>visit.road.length-4){phase='done';return racingInput(v,[v],.65,g.wetness,0);}
    const look=7+Math.abs(s.speed)*.65,aim=samplePath(visit.road,n.progress+look),delta=wrap(Math.atan2(aim.x-s.position.x,aim.z-s.position.z)-s.yaw);
    const curve=Math.max(...[0,10,20,30].map(a=>Math.abs(samplePath(visit.road,n.progress+a).curvature)));let speed=Math.min(12,Math.sqrt(2.8/Math.max(.004,curve)));
    if(phase==='pit'&&pit.progress>150&&pit.distance<5){speed=Math.min(speed,Math.sqrt(Math.max(0,450-pit.progress)*2));if(Math.abs(s.speed)<.5&&Math.abs(pit.progress-450)<7){
      s.fuel=5;s.wheels.forEach(w=>w.wear=.4);service.push({when:'before',fuel:s.fuel,wear:s.wheels.map(w=>w.wear),race:structuredClone(g.race.player)});
      serviceAt=g.clock;phase='service';void g.action('service');return {...neutralInput(),brake:1};
    }}
    const maxSteer=clamp(.57/(1+Math.abs(s.speed)*.055),.115,.57),steer=Math.atan2(2*v.definition.wheelbase*Math.sin(delta),look)/maxSteer;
    return {...neutralInput(),throttle:clamp((speed-s.speed)*.25,0,.65),brake:clamp((s.speed-speed)*.25,0,1),steer:clamp(steer,-1,1)};
  };
  return {status:()=>({phase,served,maxError,service,race:structuredClone(g.race.player),vehicle:structuredClone(g.player.state),elapsed:g.race.state.elapsed}),dispose:()=>{g.input.poll=poll;}};
}
