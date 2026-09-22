import {clamp,lerp} from '../core/math';
import type {Weather} from '../core/types';
import {solarLighting} from './atmosphere';
import {periodicNoise,cloudAtlas as generatedCloudAtlas} from './texture-fields.mjs';

export const CLOUD_ATLAS_SIZE=512;
// Fade completely before the low-angle projection is clamped. Otherwise a
// nearly constant cloud lookup becomes a vertical streak at the horizon.
export const CLOUD_HORIZON={projectionMin:.075,fadeStart:.085,fadeEnd:.24} as const;
/** Periodic lattice noise: the texture wraps without a longitude or pole seam. */
export const cloudNoise=periodicNoise;
/** Original packed coverage / erosion / high-cloud fields, generated once.
 * No weather-dependent texture upload, equirectangular projection or external art. */
export function cloudAtlas(size=CLOUD_ATLAS_SIZE){return generatedCloudAtlas(size);}
export function skyState(time:number,weather:Weather,clock:number){
  const solar=solarLighting(time),cover={Clear:.18,Cloudy:.48,Overcast:.88,Rain:1}[weather];
  return {sun:solar.direction,day:solar.daylight,golden:solar.golden,cover,wind:Math.max(0,clock)*.000007,moonVisibility:(1-solar.daylight)*(1-cover*.80)};
}
/** Gamma-space scene fog colour (Babylon converts this for PBR). Rain must
 * desaturate the distant terrain along with the sky, not leave blue cutouts. */
export function atmosphereFog(time:number,weather:Weather):[number,number,number]{
  const state=skyState(time,weather,0),overcast={Clear:0,Cloudy:.20,Overcast:.55,Rain:.72}[weather];
  const day=[.54,.66,.79],warm=[.76,.67,.58],storm=[.47,.49,.53],night=[.055,.075,.11];
  return day.map((c,i)=>lerp(night[i],lerp(lerp(c,warm[i],state.golden*(1-overcast)*.40),storm[i],overcast/.72*.85),state.day)) as [number,number,number];
}
/** Pure equivalent of the shader coverage gate, for parameter regression. */
export function cloudCoverage(value:number,cover:number){
  const threshold=.67-clamp(cover,0,1)*.43,t=clamp((value-threshold+.045)/.18,0,1);return t*t*(3-2*t);
}
