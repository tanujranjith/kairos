import type { InputFrame, V3 } from '../core/types';
import { clamp, distance, lerp, wrap } from '../core/math';
import { LaneGraph, projectPath, samplePath, signalAspect, type LanePath } from './lane-graph';

export interface TrafficObservation { id:string; position:V3; yaw:number; speed:number; length:number; width:number }
export interface TrafficAgent {
  id:string; index:number; pathId:string; progress:number; nextId:string|null; sequence:number;
  decisionAt:number; decisions:number; targetSpeed:number; reason:string; waitingSince:number|null; blockedFor:number;
  permitted:boolean; laneChange:{from:string;to:string;started:number}|null; changeCooldown:number;
}
export interface TrafficDecision {input:InputFrame;targetSpeed:number;reason:string;laneError:number}
type Reservation={agent:string;path:string;expires:number};
const neutral=():InputFrame=>({throttle:0,brake:0,steer:0,handbrake:false,shift:0,reverse:false});
const nextDecision=(clock:number,index:number)=>{const tick=Math.floor(clock*120+1e-6),phase=index%12;let next=tick+(phase-tick%12+12)%12;if(next<=tick)next+=12;return next/120;};

/** Same bounded rule layer for physical nearby cars and lightweight distant actors. */
export class TrafficController {
  agents=new Map<string,TrafficAgent>();
  private reservations=new Map<string,Reservation>();
  private conflicts=new Map<string,boolean>();
  constructor(public graph:LaneGraph){}
  add(id:string,index:number,pathId:string,progress:number,clock=0){
    const agent:TrafficAgent={id,index,pathId,progress,nextId:null,sequence:0,decisionAt:nextDecision(clock,index),decisions:0,targetSpeed:0,reason:'settling',waitingSince:null,blockedFor:0,permitted:false,laneChange:null,changeCooldown:clock+4};
    this.agents.set(id,agent);this.chooseNext(agent);return agent;
  }
  remove(id:string){this.agents.delete(id);this.reservations.delete(id);}
  clear(){this.agents.clear();this.reservations.clear();}
  private chooseNext(agent:TrafficAgent){
    const path=this.graph.paths.get(agent.pathId)!;
    const choices=path.next.map(id=>this.graph.paths.get(id)!).filter(p=>p.trafficAllowed);
    const straight=choices.find(p=>p.turn==='straight');
    const pick=straight&&(agent.index+agent.sequence)%3!==0?straight:choices[(agent.index*7+agent.sequence*3)%Math.max(1,choices.length)];
    agent.nextId=pick?.id??null;agent.sequence++;
  }
  sync(agent:TrafficAgent,observation:TrafficObservation){
    let path=this.graph.paths.get(agent.pathId)!,projection=projectPath(path,observation.position);
    // Validate directional endpoint passage, not nearest-road switching at crossings.
    const end=path.points.at(-1)!,forward=(observation.position.x-end.x)*Math.sin(end.yaw)+(observation.position.z-end.z)*Math.cos(end.yaw);
    if(agent.nextId&&projection.progress>path.length-5&&forward>=-.25){
      const next=this.graph.paths.get(agent.nextId)!;
      if(next.kind!=='connector'||agent.permitted){agent.pathId=next.id;agent.progress=0;agent.permitted=false;agent.waitingSince=null;agent.laneChange=null;this.chooseNext(agent);path=next;projection=projectPath(path,observation.position);}
    }
    agent.progress=projection.progress;return projection;
  }
  private conflict(a:LanePath,b:LanePath){
    const key=[a.id,b.id].sort().join('|');const cached=this.conflicts.get(key);if(cached!==undefined)return cached;
    const conflict=a.id===b.id||a.targetLane===b.targetLane||a.points.some((p,i)=>i%2===0&&b.points.some((q,j)=>j%2===0&&Math.abs(p.y-q.y)<2&&distance(p,q)<3.5));
    this.conflicts.set(key,conflict);return conflict;
  }
  private mayEnter(agent:TrafficAgent,turn:LanePath,observation:TrafficObservation,others:TrafficObservation[],clock:number,stoppingDeceleration=5){
    const junction=this.graph.junctions.get(turn.junction!)!,own=this.reservations.get(agent.id);
    if(own?.path===turn.id&&own.expires>=clock)return true;
    const aspect=signalAspect(junction,turn.signalGroup??-1,clock),gap=this.graph.paths.get(agent.pathId)!.length-agent.progress-3.5;
    if(aspect==='red'||aspect==='amber'&&observation.speed**2/(2*stoppingDeceleration)<Math.max(0,gap))return false;
    const exit=this.graph.paths.get(turn.targetLane!)!;
    // Keep the crossing clear when a queue leaves no room beyond the exit.
    if(others.some(other=>{if(other.id===agent.id||Math.abs(other.position.y-junction.y)>3||Math.abs(other.speed)>2)return false;const p=projectPath(exit,other.position);return p.distance<(observation.width+other.width)/2+.3&&p.progress<12;}))return false;
    for(const [id,reservation] of this.reservations){
      const owner=this.agents.get(id);
      if(!owner||reservation.expires<clock&&owner.pathId!==reservation.path){this.reservations.delete(id);continue;}
      const other=this.graph.paths.get(reservation.path)!;
      if(id!==agent.id&&other.junction===turn.junction&&this.conflict(turn,other))return false;
    }
    for(const other of others){
      if(other.id===agent.id||Math.abs(other.position.y-junction.y)>3)continue;
      const otherAgent=this.agents.get(other.id);
      if(otherAgent){
        const path=this.graph.paths.get(otherAgent.pathId)!;
        if(path.kind==='connector'&&path.junction===turn.junction&&this.conflict(turn,path))return false;
        if(path.to!==junction.id||!otherAgent.nextId)continue;
        const otherTurn=this.graph.paths.get(otherAgent.nextId)!;
        if(!this.conflict(turn,otherTurn))continue;
        const remaining=path.length-otherAgent.progress;
        if(remaining>Math.max(18,Math.abs(other.speed)*3))continue;
        if(signalAspect(junction,otherTurn.signalGroup??-1,clock)!=='green')continue;
        const precedence=(p:LanePath)=>(p.priority??0)*10+(p.turn==='straight'?2:p.turn==='right'?1:0);
        const higher=precedence(otherTurn)>precedence(turn),same=precedence(otherTurn)===precedence(turn);
        const arrivedFirst=(otherAgent.waitingSince??clock)<(agent.waitingSince??clock)-.1;
        if(higher||same&&(arrivedFirst||Math.abs((otherAgent.waitingSince??clock)-(agent.waitingSince??clock))<.1&&otherAgent.index<agent.index))return false;
      }else{
        // The player need not follow a lane or obey a light. Yield to an occupied box
        // or an imminent approach, but not to a parked car outside the junction.
        const d=distance(other.position,junction),toward=(junction.x-other.position.x)*Math.sin(other.yaw)+(junction.z-other.position.z)*Math.cos(other.yaw);
        if(d<junction.radius*.7||other.speed>1&&toward>0&&d<junction.radius+other.speed*2.2)return false;
      }
    }
    if(gap<Math.max(12,Math.abs(observation.speed)*1.4))this.reservations.set(agent.id,{agent:agent.id,path:turn.id,expires:clock+6});
    return true;
  }
  adjacentClear(agent:TrafficAgent,target:LanePath,observation:TrafficObservation,others:TrafficObservation[]){
    const location=projectPath(target,observation.position);
    for(const other of others){
      if(other.id===agent.id||Math.abs(other.position.y-observation.position.y)>3)continue;
      const p=projectPath(target,other.position);if(p.distance>2.5)continue;
      const delta=p.progress-location.progress;
      const closing=delta>0?Math.max(0,observation.speed-other.speed):Math.max(0,other.speed-observation.speed);
      if(Math.abs(delta)<12+closing*2)return false;
    }
    return true;
  }
  decide(agent:TrafficAgent,observation:TrafficObservation,others:TrafficObservation[],clock:number,wheelbase=2.65,wetness=0):TrafficDecision{
    const projection=this.sync(agent,observation),speed=Math.max(0,observation.speed);
    const roadGrip=1-clamp(wetness,0,1)*.28,deceleration=3.5*roadGrip,weatherPace=1-clamp(wetness,0,1)*.1;
    let path=this.graph.paths.get(agent.pathId)!,targetSpeed=path.speedLimit*(.84+(agent.index%4)*.035)*weatherPace,reason='cruise';
    agent.decisions++;agent.decisionAt=nextDecision(clock,agent.index);
    const next=agent.nextId?this.graph.paths.get(agent.nextId):undefined;
    const look=clamp(7+speed*.65,7,35),route=[...(next?[next.id]:[]),...(next?.next??[])];
    for(let ahead=0;ahead<=140;ahead+=8){
      const p=this.graph.sample(path,agent.progress+ahead,route),corner=Math.sqrt(.42*9.81*roadGrip/Math.max(.0001,Math.abs(p.curvature)));
      targetSpeed=Math.min(targetSpeed,Math.sqrt(corner*corner+2*deceleration*ahead));
    }
    if(next)targetSpeed=Math.min(targetSpeed,Math.sqrt((next.speedLimit*weatherPace)**2+2*deceleration*Math.max(0,path.length-agent.progress-4)));
    if(path.kind==='lane'&&next?.kind==='connector'){
      const gap=path.length-agent.progress-3.5;
      if(gap<60){
        agent.permitted=this.mayEnter(agent,next,observation,others,clock,5*roadGrip);
        if(!agent.permitted){targetSpeed=Math.min(targetSpeed,Math.sqrt(2*3.2*roadGrip*Math.max(0,gap-.8)));reason=signalAspect(this.graph.junctions.get(next.junction!)!,next.signalGroup??-1,clock)==='green'?'yield':'signal';if(gap<1.8)targetSpeed=0;}
      }else agent.permitted=false;
    }else if(path.kind==='connector')this.reservations.set(agent.id,{agent:agent.id,path:path.id,expires:clock+4});
    if(!next){const endSpeed=Math.sqrt(6*Math.max(0,path.length-agent.progress-4));if(endSpeed<targetSpeed){targetSpeed=endSpeed;reason='end-of-road';}}
    let obstruction=false,minGap=Infinity;
    // Once a maneuver begins, anticipate traffic in the destination lane. The
    // immediate swept corridor still protects against a car directly in front.
    const followingPath=agent.laneChange?this.graph.paths.get(agent.laneChange.to)!:path;
    const followingProgress=projectPath(followingPath,observation.position).progress;
    for(const other of others){
      if(other.id===agent.id||Math.abs(other.position.y-observation.position.y)>3)continue;
      const p=projectPath(followingPath,other.position),dx=other.position.x-observation.position.x,dz=other.position.z-observation.position.z;
      const forward=dx*Math.sin(observation.yaw)+dz*Math.cos(observation.yaw),side=dx*Math.cos(observation.yaw)-dz*Math.sin(observation.yaw);
      const along=p.progress-followingProgress;
      const inLane=p.distance<(observation.width+other.width)*.5+.4&&along>0;
      const immediate=forward>0&&forward<12+speed*.6&&Math.abs(side)<(observation.width+other.width)*.5+.2;
      if(!inLane&&!immediate)continue;
      const gap=(inLane?along:forward)-(observation.length+other.length)*.5;
      if(gap>100)continue;
      const lead=Math.max(0,other.speed*Math.cos(wrap(other.yaw-observation.yaw)));
      const safe=Math.max(0,Math.min(lead+(gap-4-speed*1.15)*.55,Math.sqrt(lead*lead+2*deceleration*Math.max(0,gap-3))));
      if(safe<targetSpeed){targetSpeed=safe;reason='traffic';obstruction=true;minGap=Math.min(minGap,gap);}
    }
    if(path.kind==='lane'&&!agent.laneChange&&clock>agent.changeCooldown&&path.length-agent.progress>Math.max(85,speed*5)&&agent.progress>30&&Math.abs(projection.point.curvature)<.007){
      const desired=path.adjacent.map(id=>this.graph.paths.get(id)!).find(candidate=>(obstruction&&targetSpeed<path.speedLimit*.65||!obstruction&&path.laneIndex>0&&candidate.laneIndex===0)&&this.adjacentClear(agent,candidate,observation,others));
      if(desired){agent.laneChange={from:path.id,to:desired.id,started:clock};agent.changeCooldown=clock+9;}
    }
    let target=this.graph.sample(path,agent.progress+look,route);
    if(agent.laneChange){
      const change=agent.laneChange,other=this.graph.paths.get(change.to)!,p=projectPath(other,observation.position),blend=clamp((clock-change.started+look/Math.max(5,speed))/3.5,0,1),goal=samplePath(other,p.progress+look);
      target={...target,x:lerp(target.x,goal.x,blend),z:lerp(target.z,goal.z,blend)};reason='lane-change';
      if(clock-change.started>=3.5&&p.distance<1.5){agent.pathId=other.id;agent.progress=p.progress;agent.laneChange=null;path=other;this.chooseNext(agent);}
    }
    const alpha=wrap(Math.atan2(target.x-observation.position.x,target.z-observation.position.z)-observation.yaw);
    if(Math.abs(alpha)>.7)targetSpeed=Math.min(targetSpeed,5);
    let laneError=projectPath(path,observation.position).distance;
    if(agent.laneChange)laneError=Math.min(laneError,projectPath(this.graph.paths.get(agent.laneChange.to)!,observation.position).distance);
    if(laneError>4){targetSpeed=Math.min(targetSpeed,5);reason='recovery';}
    const angle=Math.atan2(2*wheelbase*Math.sin(alpha),look),maxSteer=clamp(.57/(1+speed*.055),.115,.57),error=targetSpeed-speed;
    const input={...neutral(),steer:clamp(angle/maxSteer,-1,1),throttle:clamp(error*.24,0,.65),brake:clamp(-error*.32,0,1)};
    if(targetSpeed<.15){input.throttle=0;input.brake=Math.max(.4,input.brake);}
    if(minGap<2+speed*.3){input.throttle=0;input.brake=1;}
    agent.waitingSince=speed<.5&&targetSpeed<.5?(agent.waitingSince??clock):null;
    // A physically wedged car can remain close to its lane centre with a valid
    // cruise target, so lane error alone cannot identify every deadlock. Count
    // only cars that are commanded to move; red lights and following/yield
    // queues have a near-zero target and never enter recovery through this path.
    agent.blockedFor=speed<.5&&targetSpeed>2?agent.blockedFor+.1:0;
    agent.targetSpeed=targetSpeed;agent.reason=reason;
    return {input,targetSpeed,reason,laneError};
  }
  advanceDistant(agent:TrafficAgent,observation:TrafficObservation,dt:number,clock:number){
    let speed=clamp(observation.speed+clamp((agent.targetSpeed-observation.speed)*1.5,-4.5,2.5)*dt,0,agent.targetSpeed+2);
    let path=this.graph.paths.get(agent.pathId)!,progress=agent.progress+speed*dt;
    if(progress>path.length&&agent.nextId){const next=this.graph.paths.get(agent.nextId)!;if(next.kind!=='connector'||agent.permitted){progress-=path.length;agent.pathId=next.id;path=next;agent.permitted=false;this.chooseNext(agent);}else{progress=path.length-3.5;speed=0;}}
    agent.progress=clamp(progress,0,path.length);let p=samplePath(path,agent.progress);
    if(agent.laneChange){const change=agent.laneChange,target=this.graph.paths.get(change.to)!,ratio=agent.progress/path.length,goal=samplePath(target,ratio*target.length),t=clamp((clock-change.started)/3.5,0,1);p={...p,x:lerp(p.x,goal.x,t),z:lerp(p.z,goal.z,t)};if(t===1){agent.pathId=target.id;agent.progress=goal.s;agent.laneChange=null;this.chooseNext(agent);}}
    return {...observation,position:{x:p.x,y:p.y+.7,z:p.z},yaw:p.yaw,speed};
  }
}
