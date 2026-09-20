import { clamp } from '../core/math';

/** Combined slip with load sensitivity and a progressive post-peak falloff. */
export function tireForces(slipRatio:number,slipAngle:number,load:number,mu:number){
  if(load<=0)return {longitudinal:0,lateral:0};
  const loadSensitivity=clamp(1-.08*Math.log(Math.max(300,load)/3500),.8,1.18);
  const limit=load*mu*loadSensitivity;
  const sx=slipRatio*10,sy=-Math.tan(clamp(slipAngle,-1.25,1.25))*7.5;
  const length=Math.hypot(sx,sy);
  const magnitude=limit*Math.tanh(length)*(1-.16*clamp((length-1.8)/5,0,1));
  return length<1e-6?{longitudinal:0,lateral:0}:{longitudinal:magnitude*sx/length,lateral:magnitude*sy/length};
}

/** Engine torque intervention, using the same combined-slip tire as the contact solve.
 * Limit next-step wheelspin before it consumes the lateral grip needed to turn.
 * No force boost, velocity correction, or hidden grip multiplier. */
export function tractionTorque(requested:number,omega:number,longitudinal:number,angle:number,load:number,mu:number,radius:number,inertia:number,dt:number,direction:number){
  if(requested*direction<=0)return requested;
  const targetSlip=.14/(1+18*Math.abs(angle));
  const targetOmega=(Math.max(0,longitudinal*direction)+targetSlip*Math.max(3,Math.abs(longitudinal)))/radius;
  const contactTorque=tireForces(targetSlip,angle,load,mu).longitudinal*radius;
  const budget=Math.max(0,contactTorque+(targetOmega-omega*direction)*inertia/dt);
  return direction*Math.min(Math.abs(requested),budget);
}
