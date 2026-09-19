import { Vector3, type Scene } from '@babylonjs/core';
import { TRAFFIC_GRAPH } from '../content/traffic-network';
import { VEHICLES } from '../content/vehicles';
import { inHandlingCourse } from '../content/handling-course';
import { distance } from '../core/math';
import type { InputFrame, V3 } from '../core/types';
import { type CarVisual } from '../render/car';
import { createLodCar } from '../render/car-lod';
import type { WorldRenderer } from '../render/world';
import { PhysicsWorld, Vehicle, neutralInput } from '../sim/physics';
import { samplePath } from '../sim/lane-graph';
import { TrafficController, type TrafficAgent, type TrafficObservation } from '../sim/traffic';

export type PhysicalTraffic={vehicle:Vehicle;visual:CarVisual;input:InputFrame;agent:TrafficAgent};
interface Actor {agent:TrafficAgent;observation:TrafficObservation;physical:PhysicalTraffic|null;recoveries:number;pendingPromotion?:boolean}
const observation=(vehicle:Vehicle):TrafficObservation=>({id:vehicle.id,position:vehicle.state.position,yaw:vehicle.state.yaw,speed:vehicle.state.speed,length:vehicle.definition.length,width:vehicle.definition.width});
const SPAWNS=[...TRAFFIC_GRAPH.paths.values()].filter(p=>p.kind==='lane'&&p.trafficAllowed).flatMap(path=>{
  const positions=[];for(let s=35;s<path.length-35;s+=43)positions.push({pathId:path.id,progress:s,point:samplePath(path,s)});return positions;
});

/** Owns physical resources; pure lane/rule logic remains in sim/traffic.ts. */
export class TrafficRuntime {
  controller=new TrafficController(TRAFFIC_GRAPH);actors:Actor[]=[];
  private density=0;private tierAt=0;private rebalanceAt=0;
  private generation=0;
  promotions=0;demotions=0;peakPhysical=0;maxDecisionsPerStep=0;
  constructor(private physics:PhysicsWorld,private world:WorldRenderer,private scene:Scene){}
  get cars(){return this.actors.flatMap(a=>a.physical?[a.physical]:[]);}
  async populate(player:Vehicle,count:number,clock:number){
    this.clear();this.density=Math.round(count);if(!count||inHandlingCourse(player.state.position.x,player.state.position.z))return;
    const generation=this.generation,nearby:Actor[]=[];
    const selected:V3[]=[player.state.position];
    for(let i=0;i<count*2;i++){
      const near=i<count,min=near?50:550,max=near?480:1150;
      const candidates=SPAWNS.filter(p=>{const d=distance(p.point,player.state.position);return d>min&&d<max&&selected.every(other=>distance(other,p.point)>22);});
      candidates.sort((a,b)=>distance(a.point,player.state.position)-distance(b.point,player.state.position));
      const spawn=candidates[Math.min(candidates.length-1,(i*7)%Math.min(24,candidates.length))];if(!spawn)continue;
      const def=VEHICLES[[0,2,3][i%3]],id=`traffic-${i}`,agent=this.controller.add(id,i,spawn.pathId,spawn.progress,clock),p=spawn.point;
      const actor:Actor={agent,observation:{id,position:{x:p.x,y:p.y+.7,z:p.z},yaw:p.yaw,speed:0,length:def.length,width:def.width},physical:null,recoveries:0};
      this.actors.push(actor);selected.push(p);if(near)nearby.push(actor);
    }
    await this.world.waitForSurfaces(nearby.map(a=>a.observation.position));if(generation!==this.generation)return;
    for(const actor of nearby)this.promote(actor);this.tierAt=clock+.5;this.rebalanceAt=clock+3;
  }
  private promote(actor:Actor){
    if(actor.physical)return;
    const path=TRAFFIC_GRAPH.paths.get(actor.agent.pathId)!,sample=samplePath(path,actor.agent.progress),p={...sample,x:actor.observation.position.x,z:actor.observation.position.z,yaw:actor.observation.yaw},def=VEHICLES[[0,2,3][actor.agent.index%3]];
    if(!this.world.readyAround(p)){actor.pendingPromotion=true;this.world.requestAround(p);return;}actor.pendingPromotion=false;
    const vehicle=new Vehicle(this.physics,def,actor.agent.id,p,p.yaw),visual=createLodCar(this.scene,def,{paint:['#bac7c4','#9bafbc','#936951','#d9d3c2','#425762'][actor.agent.index%5],wheels:'#82929c',livery:0,brakeBias:.6,aero:1});
    const speed=actor.observation.speed;vehicle.body.setLinearVelocity(new Vector3(Math.sin(p.yaw)*speed,0,Math.cos(p.yaw)*speed));
    vehicle.state.speed=speed;vehicle.state.wheels.forEach(w=>w.omega=speed/def.wheelRadius);
    actor.physical={vehicle,visual,input:neutralInput(),agent:actor.agent};this.promotions++;this.peakPhysical=Math.max(this.peakPhysical,this.cars.length);
  }
  private demote(actor:Actor){
    if(!actor.physical)return;
    actor.observation=observation(actor.physical.vehicle);this.controller.sync(actor.agent,actor.observation);
    actor.physical.vehicle.dispose();actor.physical.visual.dispose();actor.physical=null;this.demotions++;
  }
  beforeStep(player:Vehicle,clock:number,dt:number){
    if(!this.actors.length)return;
    const playerState=observation(player);
    for(const actor of this.actors)if(actor.physical)actor.observation=observation(actor.physical.vehicle);
    for(const actor of this.actors){const separation=distance(actor.observation.position,playerState.position);if(separation>Math.max(500,Math.abs(playerState.speed)*6+100))actor.pendingPromotion=false;if(!actor.physical&&(actor.pendingPromotion||separation<140)&&this.clearAt(actor.observation.position,actor.agent.id,playerState,8))this.promote(actor);}
    if(clock>=this.tierAt){
      this.tierAt=clock+.5;
      const reach=Math.max(450,Math.abs(playerState.speed)*6+80),ranked=[...this.actors].sort((a,b)=>distance(a.observation.position,playerState.position)-distance(b.observation.position,playerState.position));
      const wanted=new Set(ranked.filter(a=>distance(a.observation.position,playerState.position)<reach).slice(0,this.density));
      // Safety takes precedence over the normal count cap: never leave a nearby car non-solid.
      for(const actor of ranked)if(distance(actor.observation.position,playerState.position)<140)wanted.add(actor);
      for(const actor of this.actors)if(actor.physical&&!wanted.has(actor)&&distance(actor.observation.position,playerState.position)>reach-40)this.demote(actor);
      for(const actor of wanted)if(!actor.physical&&this.clearAt(actor.observation.position,actor.agent.id,playerState,8))this.promote(actor);
    }
    const all=[playerState,...this.actors.map(a=>a.observation)];let decisions=0;
    for(const actor of this.actors){
      if(clock+1e-8>=actor.agent.decisionAt){
        const result=this.controller.decide(actor.agent,actor.observation,all,clock,actor.physical?.vehicle.definition.wheelbase??2.65);decisions++;
        if(actor.physical)actor.physical.input=result.input;
      }
      if(!actor.physical)actor.observation=this.controller.advanceDistant(actor.agent,actor.observation,dt,clock);
    }
    this.maxDecisionsPerStep=Math.max(this.maxDecisionsPerStep,decisions);
    if(clock>=this.rebalanceAt){
      this.rebalanceAt=clock+2;
      let shortage=this.density-this.cars.length;
      for(const actor of this.actors){
        const separation=distance(actor.observation.position,playerState.position),far=separation>1350;
        // Nonphysical actors just outside the promotion horizon can otherwise sit
        // forever in the old 450–600m gap while the nearby population stays low.
        const refill=shortage>0&&!actor.physical&&separation>Math.max(450,Math.abs(playerState.speed)*6+80);
        const stranded=actor.physical&&(actor.physical.vehicle.needsRecovery()||actor.agent.blockedFor>10);
        // Never reset visible nearby queues or move a car onto the player. Waiting at
        // signals/obstructions is not a recovery failure and does not count as stranded.
        if(!far&&!refill&&!(stranded&&separation>160))continue;
        const candidates=SPAWNS.filter(p=>{const d=distance(p.point,playerState.position),ahead=(p.point.x-playerState.position.x)*Math.sin(playerState.yaw)+(p.point.z-playerState.position.z)*Math.cos(playerState.yaw);return d>(refill?220:500)&&d<(refill?410:1000)&&(!refill||ahead<d*.4)&&this.clearAt(p.point,actor.agent.id,playerState,25);});
        const spawn=candidates[(actor.agent.index*17+actor.recoveries*13)%Math.max(1,candidates.length)];if(!spawn)continue;
        this.demote(actor);this.controller.remove(actor.agent.id);actor.agent=this.controller.add(actor.agent.id,actor.agent.index,spawn.pathId,spawn.progress,clock);actor.recoveries++;
        actor.observation={...actor.observation,position:{...spawn.point,y:spawn.point.y+.7},yaw:spawn.point.yaw,speed:0};
        if(refill){this.promote(actor);shortage--;}
      }
    }
    // Surface requests are asynchronous; the application gates fixed steps when
    // a physical actor's collision neighborhood is not ready yet.
  }
  private clearAt(position:V3,id:string,player:TrafficObservation,radius:number){
    return distance(position,player.position)>radius&&this.actors.every(a=>a.agent.id===id||Math.abs(position.y-a.observation.position.y)>3||distance(position,a.observation.position)>radius);
  }
  criticalPositions(player:Vehicle){return this.actors.filter(a=>{const d=distance(a.observation.position,player.state.position);return a.physical||d<160||a.pendingPromotion&&d<Math.max(500,Math.abs(player.state.speed)*6+100);}).map(a=>a.physical?a.physical.vehicle.node.position:a.observation.position);}
  clear(){this.generation++;for(const actor of this.actors){actor.physical?.vehicle.dispose();actor.physical?.visual.dispose();}this.actors=[];this.controller.clear();this.promotions=0;this.demotions=0;this.peakPhysical=0;this.maxDecisionsPerStep=0;}
  snapshot(){return {physical:this.cars.length,distant:this.actors.filter(a=>!a.physical).length,promotions:this.promotions,demotions:this.demotions,peakPhysical:this.peakPhysical,maxDecisionsPerStep:this.maxDecisionsPerStep,agents:this.actors.map(a=>({id:a.agent.id,tier:a.physical?'physical':'distant',path:a.agent.pathId,progress:a.agent.progress,position:a.observation.position,speed:a.observation.speed,targetSpeed:a.agent.targetSpeed,reason:a.agent.reason,decisions:a.agent.decisions,recoveries:a.recoveries}))};}
}
