import { clamp } from './math';

/** Mechanical rack limit, shared by physics and the keyboard's input envelope. */
export const steeringLock=(speed:number)=>clamp(.57/(1+Math.abs(speed)*.055),.115,.57);

/** A digital key expresses cornering intent, not instant full rack lock at 40 mph.
 * Preserve parking lock; at speed map a held key to a moderate lateral demand.
 * This changes only the input, never tire friction or chassis velocity. */
export function keyboardSteeringScale(speed:number,wheelbase=2.65,wetness=0,surfaceGrip=1){
  const acceleration=8*(1-.4*clamp(wetness,0,1))*clamp(surfaceGrip,.2,1);
  const angle=Math.atan(wheelbase*acceleration/Math.max(1,speed*speed));
  return clamp(angle/steeringLock(speed),0,1);
}
