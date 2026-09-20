import { Vector3 } from '@babylonjs/core';
import type { Kairos } from '../app';
import { DEFAULT_SETTINGS, VEHICLES } from '../content/vehicles';
import { FIXED_DT, Vehicle, neutralInput } from '../sim/physics';
import { wrap } from '../core/math';

/** Reproduce the reported 40 mph keyboard turn on flat, dry asphalt.
 * Only the initial speed is prescribed; all subsequent motion is Havok + real inputs. */
export async function runKeyboardValidation(game: Kairos) {
  await game.advanceTime(0);await game.startDrive(true);
  Object.assign(game.save.settings, structuredClone(DEFAULT_SETTINGS), { volume: 0, traffic: 0, timeRate: 0 });
  for(let x=-1950;x<-1450;x+=180)game.world.ensure({x,y:18.05,z:1940});
  const dt=FIXED_DT, cases=[];
  for(const wetness of [0,1])for(const direction of [1,-1])for(const definition of VEHICLES)for(const seconds of [.15,.5,1])for(const throttle of [false,true]){
    game.input.clear();game.player.dispose();
    const v=game.player=new Vehicle(game.physics,definition,'player',{x:-1850,y:18.05,z:1930},Math.PI/2);
    const step=(input=neutralInput())=>{v.preStep(input,game.save.settings,wetness,dt);game.physics.step(dt);v.postStep(dt);};
    for(let n=0;n<240;n++)step({...neutralInput(),brake:1});
    const speed=40*.44704;v.body.setLinearVelocity(new Vector3(speed,0,0));
    v.state.speed=speed;v.state.velocity={x:speed,y:0,z:0};v.state.gear=2;
    v.state.wheels.forEach(w=>w.omega=speed/definition.wheelRadius);
    v.state.rpm=speed/definition.wheelRadius*definition.gears[1]*definition.finalDrive*60/(2*Math.PI);
    let peakSideslip=0,peakYawRate=0,peakSteer=0,minContacts=4,tcSteps=0,yawChange=0,previousYaw=v.state.yaw;
    const trace=[];
    for(let n=0;n<Math.round((seconds+3)/dt);n++){
      const key=direction===1?'ArrowRight':'ArrowLeft';
      if(n*dt<seconds)game.input.keys.add(key);else game.input.keys.delete(key);
      if(throttle)game.input.keys.add('ArrowUp');
      const input=game.input.poll(dt,v.state.speed,definition.wheelbase,wetness);step(input);
      const s=v.state,side=s.velocity.x*Math.cos(s.yaw)-s.velocity.z*Math.sin(s.yaw);
      const beta=Math.atan2(side,Math.max(.5,Math.abs(s.speed)))*180/Math.PI;
      const yawRate=v.body.getAngularVelocity().y;
      yawChange+=wrap(s.yaw-previousYaw);previousYaw=s.yaw;
      peakSideslip=Math.max(peakSideslip,Math.abs(beta));peakYawRate=Math.max(peakYawRate,Math.abs(yawRate));peakSteer=Math.max(peakSteer,Math.abs(s.steer));
      minContacts=Math.min(minContacts,s.wheels.filter(w=>w.contact).length);if(s.tcActive)tcSteps++;
      if(n%12===0||s.wheels.some(w=>!w.contact))trace.push({t:n*dt,speed:s.speed,beta,yawRate,yawChange,steer:s.steer,input,load:s.wheels.map(w=>w.load),slip:s.wheels.map(w=>w.slip),contact:s.wheels.map(w=>w.contact),compression:s.wheels.map(w=>w.compression),rotation:v.node.rotationQuaternion!.toEulerAngles().asArray(),angular:v.body.getAngularVelocity().asArray(),position:{...s.position},surface:s.surface});
    }
    cases.push({id:definition.id,wetness,direction,seconds,throttle,peakSideslip,peakYawRate,peakSteer,minContacts,yawChange:yawChange*180/Math.PI,tcFraction:tcSteps/((seconds+3)/dt),damage:v.state.damage,trace});
  }
  game.input.clear();await game.startDrive(true);await game.advanceTime(1000);
  return {environment:'Controlled 120 Hz Havok, flat dry/wet Northstar, actual default keyboard Input.poll, initial 40 mph, both directions. Not an FPS benchmark.',cases};
}
