import { smooth } from '../core/math';

export const windowLighting=(time:number)=>smooth((Math.abs(time-12)-5)/2);
/** Interior light becomes noticeable as dusk deepens, rather than tinting the
 * entire glass facade orange while the exterior is still sunlit. */
export const windowEmission=(time:number)=>windowLighting(time)**2*1.1;
/** One sun definition for directional light, sky shader, visible disc and fog. */
export function solarLighting(time:number){
  const phase=(time-6)/12*Math.PI,elevation=Math.sin(phase)*1.12;
  const daylight=smooth((elevation+.12)/.42),golden=(1-smooth((Math.abs(elevation)-.06)/.55))*daylight;
  const azimuth=-.32; // North-west evening key light, in the authored valley's driving direction.
  return {elevation,daylight,golden,azimuth,direction:{x:Math.sin(azimuth)*Math.cos(elevation),y:Math.sin(elevation),z:Math.cos(azimuth)*Math.cos(elevation)}};
}
