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
    ambientIntensity:.46+day*.46,
    environmentIntensity:.36+day*.64,
    directIntensity:day*(2.8+solar.golden*.9)*(1-overcast)+night*.36*(1-overcast*.55),
    exposure:1.15+day*.03+solar.golden*.15+night*.08,
    nightBlend:night*night*night,
  };
}
