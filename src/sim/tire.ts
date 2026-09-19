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
