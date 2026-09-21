import { smooth } from '../core/math';
import type {Weather} from '../core/types';

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

/** Shared outdoor lighting envelope. At night the existing directional sun is
 * repurposed as a restrained moon key, keeping silhouettes and road edges
 * readable without adding another light or changing the Low render budget. */
export function drivingLighting(time:number,weather:Weather){
  const solar=solarLighting(time),day=solar.daylight,night=1-day;
  const overcast={Clear:0,Cloudy:.20,Overcast:.55,Rain:.72}[weather];
  return {
    solar,day,night,overcast,
    ambientIntensity:.38+day*.54,
    environmentIntensity:.28+day*.72,
    directIntensity:day*(2.8+solar.golden*.9)*(1-overcast)+night*.30*(1-overcast*.55),
    exposure:1.12+day*.06+solar.golden*.15+night*.05,
    nightBlend:night*night*night,
  };
}
