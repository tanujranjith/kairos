import { clamp, lerp, smooth } from '../core/math';
import type { Weather } from '../core/types';
import { landscapeNoise } from '../world/landscape';

export const SKY_WIDTH=1024,SKY_HEIGHT=256;
export const windowLighting=(time:number)=>smooth((Math.abs(time-12)-5)/2);
/** Interior light becomes noticeable as dusk deepens, rather than tinting the
 * entire glass facade orange while the exterior is still sunlit. */
export const windowEmission=(time:number)=>windowLighting(time)**2*1.1;
/** One sun definition for directional light, sky texture, visible disc and fog. */
export function solarLighting(time:number){
  const phase=(time-6)/12*Math.PI,elevation=Math.sin(phase)*1.12;
  const daylight=smooth((elevation+.12)/.42),golden=(1-smooth((Math.abs(elevation)-.06)/.55))*daylight;
  const azimuth=-.32; // North-west evening key light, in the authored valley's driving direction.
  return {elevation,daylight,golden,azimuth,direction:{x:Math.sin(azimuth)*Math.cos(elevation),y:Math.sin(elevation),z:Math.cos(azimuth)*Math.cos(elevation)}};
}
/** Equirectangular upper hemisphere; periodic longitude avoids a visible sky seam. */
export function cloudField(width=SKY_WIDTH,height=SKY_HEIGHT){
  const field=new Float32Array(width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const az=x/Math.max(1,width-1)*Math.PI*2,h=y/(height-1),horizontal=Math.sqrt(1-h*h),distance=horizontal/(h+.10)*3.25;
    const px=Math.sin(az)*distance,pz=Math.cos(az)*distance,wx=landscapeNoise(px*.23+17,pz*.23-9)*1.7,wz=landscapeNoise(px*.23-32,pz*.23+3)*1.7;
    const u=px+wx,v=pz+wz;
    // Project a world-space cloud deck onto the dome. Perspective compresses
    // clouds naturally at the horizon and is seamless around the full azimuth.
    field[y*width+x]=landscapeNoise(u,v)*.51+landscapeNoise(u*2.1,v*2.1)*.26+landscapeNoise(u*4.3,v*4.3)*.13+landscapeNoise(u*8.7,v*8.7)*.065+landscapeNoise(u*17.5,v*17.5)*.035;
  }return field;
}
export function skyPixels(time:number,weather:Weather,field:Float32Array,width=SKY_WIDTH,height=SKY_HEIGHT){
  const pixels=new Uint8Array(width*height*4),sun=solarLighting(time),day=sun.daylight,sunset=sun.golden,cover=weather==='Rain'?.78:weather==='Overcast'?.64:weather==='Cloudy'?.32:0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const h=y/(height-1),t=Math.pow(h,.55),az=x/Math.max(1,width-1)*Math.PI*2,alignment=Math.cos(az-sun.azimuth),sunward=Math.pow(Math.max(0,alignment),4),warm=sunset*(.30+sunward*.70)*(1-cover),n=field[y*width+x];
    const threshold=.555-cover*.27,density=smooth((n-threshold)*10)*smooth(h*24);
    const glow=Math.exp(-Math.abs(h-Math.max(0,sun.direction.y))*5)*warm;
    const thickness=smooth((n-threshold-.04)*4),rim=(1-thickness)*sunward*sunset;
    // Clear-weather cumulus has bright bodies and soft undersides. Dense grey
    // shading belongs to overcast/rain, not every sunny sky.
    const shade=clamp(.99-thickness*(.18+cover*.22)-cover*.24,.36,1),light=day;
    const horizon=[.76,.85,.96],zenith=[.10,.29,.55],night=[.008,.016,.035];
    for(let c=0;c<3;c++){
      let sky=lerp(horizon[c],zenith[c],t);sky=lerp(sky,[1,.66,.32][c],glow*.88);sky=lerp(sky,[.42,.48,.56][c],cover*.65);
      const cloud=lerp(shade*[.91,.95,1][c],[1,.78,.48][c]*(.90+rim*.22),warm*.72),value=lerp(night[c]*(1-h*.7),lerp(sky,cloud,density),light);
      pixels[(y*width+x)*4+c]=Math.round(clamp(value,0,1)*255);
    }pixels[(y*width+x)*4+3]=255;
  }return pixels;
}
