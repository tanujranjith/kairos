import {clamp,lerp} from '../core/math';
import type {Weather} from '../core/types';
import {solarLighting} from './atmosphere';

export const CLOUD_ATLAS_SIZE=512;
// Fade completely before the low-angle projection is clamped. Otherwise a
// nearly constant cloud lookup becomes a vertical streak at the horizon.
export const CLOUD_HORIZON={projectionMin:.075,fadeStart:.085,fadeEnd:.24} as const;
const fract=(n:number)=>n-Math.floor(n);
const hash=(x:number,y:number)=>fract(Math.sin(x*127.1+y*311.7)*43758.5453);
/** Periodic lattice noise: the texture wraps without a longitude or pole seam. */
export function cloudNoise(x:number,y:number,period:number){
  const ix=Math.floor(x),iy=Math.floor(y),fx=fract(x),fy=fract(y),u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  const h=(a:number,b:number)=>hash((a%period+period)%period,(b%period+period)%period);
  return (h(ix,iy)*(1-u)+h(ix+1,iy)*u)*(1-v)+(h(ix,iy+1)*(1-u)+h(ix+1,iy+1)*u)*v;
}
/** Original packed coverage / erosion / high-cloud fields, generated once.
 * No weather-dependent texture upload, equirectangular projection or external art. */
export function cloudAtlas(size=CLOUD_ATLAS_SIZE){
  const pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size,wx=cloudNoise(u*4+13,v*4-7,4)*1.1,wz=cloudNoise(u*4-5,v*4+19,4)*1.1;
    const broad=cloudNoise(u*4,v*4,4)*.55+cloudNoise(u*8+wx,v*8+wz,8)*.30+cloudNoise(u*16+wx*2,v*16+wz*2,16)*.15;
    const fine=cloudNoise(u*64,v*64,64)*.65+cloudNoise(u*128,v*128,128)*.35;
    const cirrus=cloudNoise(u*16+wx,v*16+wz,16)*.65+cloudNoise(u*32,v*32,32)*.35;
    pixels.set([broad*255,fine*255,cirrus*255,255],(y*size+x)*4);
  }
  return pixels;
}
export function skyState(time:number,weather:Weather,clock:number){
  const solar=solarLighting(time),cover={Clear:.18,Cloudy:.48,Overcast:.88,Rain:1}[weather];
  return {sun:solar.direction,day:solar.daylight,golden:solar.golden,cover,wind:Math.max(0,clock)*.000007,moonVisibility:(1-solar.daylight)*(1-cover*.80)};
}
/** Gamma-space scene fog colour (Babylon converts this for PBR). Rain must
 * desaturate the distant terrain along with the sky, not leave blue cutouts. */
export function atmosphereFog(time:number,weather:Weather):[number,number,number]{
  const state=skyState(time,weather,0),overcast={Clear:0,Cloudy:.20,Overcast:.55,Rain:.72}[weather];
  const day=[.54,.66,.79],warm=[.76,.67,.58],storm=[.47,.49,.53],night=[.035,.05,.08];
  return day.map((c,i)=>lerp(night[i],lerp(lerp(c,warm[i],state.golden*(1-overcast)*.40),storm[i],overcast/.72*.85),state.day)) as [number,number,number];
}
/** Pure equivalent of the shader coverage gate, for parameter regression. */
export function cloudCoverage(value:number,cover:number){
  const threshold=.67-clamp(cover,0,1)*.43,t=clamp((value-threshold+.045)/.18,0,1);return t*t*(3-2*t);
}
