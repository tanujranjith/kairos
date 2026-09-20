import {MeshBuilder,PhysicsRaycastResult,Vector3} from '@babylonjs/core';
import type {Kairos} from '../app';
import type {SurfaceKind} from '../core/types';
import {ROADS,pointAt,nearestRoadAt} from '../content/world';
import {DEFAULT_SETTINGS,vehicleById} from '../content/vehicles';
import {Vehicle,FIXED_DT,neutralInput} from '../sim/physics';
import {contactForTriangle,steeringContactGrip} from '../sim/contacts';
import {wrap} from '../core/math';

export type RoadSurfaceScenario={id:string;road:string;s:number;offset:number;heading:number;mph:number};
/** Place only the initial condition. Normal game stepping, streaming, input and
 * recovery remain enabled throughout the subsequent real-road browser test. */
export async function prepareRoadSurfaceScenario(game:Kairos,scenario:RoadSurfaceScenario){
  await game.advanceTime(0);await game.action('select-car',scenario.id);
  Object.assign(game.save.settings,structuredClone(DEFAULT_SETTINGS),{traffic:0,volume:0,timeRate:0});
  await game.startDrive();game.setAutopilot(false);
  const road=ROADS.find(r=>r.id===scenario.road)!,p=pointAt(road,scenario.s,scenario.offset);
  for(let s=scenario.s-60;s<=scenario.s+220;s+=100)game.world.ensure(pointAt(road,s));
  game.physics.step();const hit=new PhysicsRaycastResult();
  game.physics.engine.raycastToRef(new Vector3(p.x,p.y+3,p.z),new Vector3(p.x,p.y-4,p.z),hit,{collideWith:1});
  if(!hit.hasHit)throw new Error('Initial road test surface missing');
  game.player.reset({x:p.x,y:hit.hitPointWorld.y,z:p.z},p.yaw+scenario.heading);
  await game.advanceTime(2000);game.input.clear();
  const v=game.player,d=v.definition,speed=scenario.mph*.44704,yaw=v.state.yaw;
  const velocity=new Vector3(Math.sin(yaw)*speed,0,Math.cos(yaw)*speed);
  v.body.setLinearVelocity(velocity);v.state.speed=speed;v.state.velocity={x:velocity.x,y:0,z:velocity.z};v.state.gear=scenario.mph>50?3:2;
  v.state.wheels.forEach(w=>w.omega=speed/d.wheelRadius);
  v.state.rpm=speed/d.wheelRadius*d.gears[v.state.gear-1]*d.finalDrive*60/(2*Math.PI);
  await game.advanceTime(0);await game.renderer.scene.whenReadyAsync();
  return roadSurfaceTelemetry(game,scenario.road);
}
export function roadSurfaceTelemetry(game:Kairos,road:string){
  const v=game.player,s=v.state,n=nearestRoadAt(s.position,r=>r.id===road);
  const lateral=s.velocity.x*Math.cos(s.yaw)-s.velocity.z*Math.sin(s.yaw);
  return {position:{...s.position},speed:s.speed,magnitude:v.body.getLinearVelocity().length(),yaw:s.yaw,beta:Math.atan2(lateral,Math.max(.5,Math.abs(s.speed)))*180/Math.PI,lateral:n.lateral,progress:n.progress,roadClearance:s.position.y-n.point.y,contacts:s.wheels.filter(w=>w.contact).length,surfaces:s.wheels.map(w=>w.surface),layers:s.wheels.map(w=>w.layer),damage:s.damage,message:game.snapshot().message,loading:game.loading};
}

/** Diagnostic initial conditions only; subsequent motion uses normal Havok,
 * suspension, contact materials and keyboard inputs, with no pose correction. */
export async function runSurfaceValidation(game:Kairos,ids=['velara','gtx']){
  await game.advanceTime(0);await game.startDrive();
  Object.assign(game.save.settings,structuredClone(DEFAULT_SETTINGS),{traffic:0,volume:0,timeRate:0});
  const rays=[];
  for(const [id,s] of [['northbridge',650],['pass',3150],['lakeshore',1700],['south',300],['circuit',350]] as const){
    const road=ROADS.find(r=>r.id===id)!;const center=pointAt(road,s);game.world.ensure(center);game.physics.step();
    for(const side of [-1,1])for(const beyond of [.25,.8,1.25]){
      const p=pointAt(road,s,side*(road.width/2+beyond)),hit=new PhysicsRaycastResult();
      game.physics.engine.raycastToRef(new Vector3(p.x,p.y+2,p.z),new Vector3(p.x,p.y-2,p.z),hit,{collideWith:1});
      rays.push({id,s,side,beyond,expectedHeight:p.y-.015,hit:hit.hasHit,height:hit.hasHit?hit.hitPointWorld.y:null,material:hit.hasHit?contactForTriangle(hit.body?.transformNode.metadata,hit.triangleIndex):null});
    }
  }
  const cases=[];const dt=FIXED_DT,settings=game.save.settings;
  for(const condition of ['asphalt','wet','grass','gravel','split-gravel','split-grass'])for(const mirrored of condition.startsWith('split')?[false,true]:[false]){
    const surface=(right:boolean):SurfaceKind=>condition==='grass'?'Grass':condition==='gravel'?'Gravel':condition==='split-gravel'&&right?'Gravel':condition==='split-grass'&&right?'Grass':'Asphalt';
    const floors=[-1,1].map(side=>{const mesh=MeshBuilder.CreateGround('validation-'+condition,{width:700,height:60},game.renderer.scene);mesh.position.set(150,200,side*30);mesh.metadata={contactSurface:{surface:surface((side===1)!==mirrored),layer:'validation'}};mesh.isVisible=false;return {mesh,...game.physics.addStaticMesh(mesh)};});
    try{for(const id of ids){
      game.input.clear();game.player.dispose();const d=vehicleById(id),v=game.player=new Vehicle(game.physics,d,'player',{x:0,y:200,z:condition.startsWith('split')?0:20},Math.PI/2+(mirrored?-.01:.01));
      const step=(input=neutralInput())=>{v.preStep(input,settings,condition==='wet'?1:0,dt);game.physics.step(dt);v.postStep(dt);};
      for(let n=0;n<240;n++)step({...neutralInput(),brake:1});
      const speed=70*.44704;v.body.setLinearVelocity(new Vector3(speed,0,0));v.state.speed=speed;v.state.velocity={x:speed,y:0,z:0};v.state.gear=3;v.state.wheels.forEach(w=>w.omega=speed/d.wheelRadius);v.state.rpm=speed/d.wheelRadius*d.gears[2]*d.finalDrive*60/(2*Math.PI);
      let peakSideslip=0,yawChange=0,previousYaw=v.state.yaw,peakYawChange=0,minContacts=4,absSteps=0,seconds=0;const trace=[];
      game.input.keys.add('ArrowDown');
      for(let n=0;n<2400&&v.body.getLinearVelocity().length()>.5;n++){
        const input=game.input.poll(dt,v.state.speed,d.wheelbase,condition==='wet'?1:0,steeringContactGrip(v.state.wheels));step(input);seconds+=dt;
        const s=v.state,side=s.velocity.x*Math.cos(s.yaw)-s.velocity.z*Math.sin(s.yaw),beta=Math.atan2(side,Math.max(.5,Math.abs(s.speed)))*180/Math.PI;
        yawChange+=wrap(s.yaw-previousYaw);previousYaw=s.yaw;peakYawChange=Math.max(peakYawChange,Math.abs(yawChange*180/Math.PI));
        if(s.speed>3)peakSideslip=Math.max(peakSideslip,Math.abs(beta));minContacts=Math.min(minContacts,s.wheels.filter(w=>w.contact).length);if(s.absActive)absSteps++;
        if(n%12===0)trace.push({t:seconds,speed:s.speed,beta,yawChange:yawChange*180/Math.PI,position:{...s.position},loads:s.wheels.map(w=>w.load),omega:s.wheels.map(w=>w.omega),slips:s.wheels.map(w=>w.slip),surfaces:s.wheels.map(w=>w.surface),contacts:s.wheels.map(w=>w.contact),abs:s.absActive});
      }
      cases.push({id,condition,mirrored,seconds,peakSideslip,peakYawChange,minContacts,absFraction:absSteps/(seconds/dt),distance:v.state.position.x,finalSpeed:v.state.speed,finalSpeedMagnitude:v.body.getLinearVelocity().length(),damage:v.state.damage,trace});
    }}finally{game.input.clear();for(const floor of floors){floor.body.dispose();floor.shape.dispose();floor.mesh.dispose();}}
  }
  const corners=[];
  for(const surface of ['Asphalt','Grass','Gravel'] as const){
    const mesh=MeshBuilder.CreateGround('cornering-'+surface,{width:700,height:160},game.renderer.scene);mesh.position.set(150,200,0);mesh.metadata={contactSurface:{surface,layer:'validation'}};mesh.isVisible=false;
    const floor=game.physics.addStaticMesh(mesh);
    try{for(const id of ids)for(const direction of [-1,1]){
      game.input.clear();game.player.dispose();const d=vehicleById(id),v=game.player=new Vehicle(game.physics,d,'player',{x:0,y:200,z:0},Math.PI/2);
      const step=(input=neutralInput())=>{v.preStep(input,settings,0,dt);game.physics.step(dt);v.postStep(dt);};for(let n=0;n<240;n++)step({...neutralInput(),brake:1});
      const speed=40*.44704;v.body.setLinearVelocity(new Vector3(speed,0,0));v.state.speed=speed;v.state.velocity={x:speed,y:0,z:0};v.state.gear=2;v.state.wheels.forEach(w=>w.omega=speed/d.wheelRadius);
      let peakSideslip=0,peakYawChange=0,yawChange=0,lastYaw=v.state.yaw,minContacts=4;const trace=[];
      game.input.keys.add('ArrowUp');
      for(let n=0;n<420;n++){
        const key=direction===1?'ArrowRight':'ArrowLeft';if(n<60)game.input.keys.add(key);else game.input.keys.delete(key);
        step(game.input.poll(dt,v.state.speed,d.wheelbase,0,steeringContactGrip(v.state.wheels)));
        const s=v.state,side=s.velocity.x*Math.cos(s.yaw)-s.velocity.z*Math.sin(s.yaw),beta=Math.atan2(side,Math.max(.5,Math.abs(s.speed)))*180/Math.PI;
        yawChange+=wrap(s.yaw-lastYaw);lastYaw=s.yaw;peakYawChange=Math.max(peakYawChange,Math.abs(yawChange*180/Math.PI));peakSideslip=Math.max(peakSideslip,Math.abs(beta));minContacts=Math.min(minContacts,s.wheels.filter(w=>w.contact).length);
        if(n%12===0)trace.push({t:n*dt,speed:s.speed,beta,yawChange:yawChange*180/Math.PI,steer:s.steer,contacts:s.wheels.map(w=>w.contact),surfaces:s.wheels.map(w=>w.surface)});
      }
      corners.push({id,surface,direction,peakSideslip,peakYawChange,minContacts,damage:v.state.damage,trace});
    }}finally{game.input.clear();floor.body.dispose();floor.shape.dispose();mesh.dispose();}
  }
  await game.startDrive();await game.advanceTime(1000);
  return {environment:'Controlled120Hz development-host Havok. Flat isolated physical material strips, initial70mph and0.57degree heading offset, then actual keyboard brake; mirrored split grip. Also40mph500ms throttle-on keyboard turns in both directions. Not runtime FPS or real-road unevenness acceptance.',rays,cases,corners};
}
