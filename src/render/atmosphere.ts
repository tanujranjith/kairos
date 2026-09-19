import { clamp, lerp, smooth } from '../core/math';
import type { Weather } from '../core/types';
import { noise } from './surface-textures';

export const SKY_WIDTH=1024,SKY_HEIGHT=256;
export const windowLighting=(time:number)=>smooth((Math.abs(time-12)-5)/2);
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
    const u=x/width,v=y/(height-1),warp=noise(u*8,v*5,8)*1.8;
    field[y*width+x]=noise(u*18,v*25+warp,18)*.48+noise(u*36,v*50+warp,36)*.25+noise(u*72,v*100,72)*.15+noise(u*144,v*200,144)*.08+noise(u*288,v*400,288)*.04;
  }return field;
}
export function skyPixels(time:number,weather:Weather,field:Float32Array,width=SKY_WIDTH,height=SKY_HEIGHT){
  const pixels=new Uint8Array(width*height*4),sun=solarLighting(time),day=sun.daylight,sunset=sun.golden,cover=weather==='Rain'?.78:weather==='Overcast'?.64:weather==='Cloudy'?.32:0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const h=y/(height-1),t=Math.pow(h,.55),az=x/width*Math.PI*2,alignment=Math.cos(az-sun.azimuth),sunward=Math.pow(Math.max(0,alignment),4),warm=sunset*(.30+sunward*.70)*(1-cover),n=field[y*width+x];
    const density=smooth((n-(.48-cover*.18))*9)*smooth(h*25)*(1-smooth((h-.88)*7));
    const glow=Math.exp(-Math.abs(h-Math.max(0,sun.direction.y))*3.5)*warm;
    const edge=(1-smooth((n-.47)*6))*sunward*sunset;
    const shade=clamp(.52+(n-.48)*.65+edge*.38,.35,1),light=day;
    const horizon=[.78,.84,.90],zenith=[.12,.31,.59],night=[.008,.016,.035];
    for(let c=0;c<3;c++){
      let sky=lerp(horizon[c],zenith[c],t);sky=lerp(sky,[1,.66,.32][c],glow*.88);sky=lerp(sky,[.42,.48,.56][c],cover*.65);
      const cloud=lerp(shade,[1,.71,.39][c]*(.76+edge*.24),warm*.8),value=lerp(night[c]*(1-h*.7),lerp(sky,cloud,density),light);
      pixels[(y*width+x)*4+c]=Math.round(clamp(value,0,1)*255);
    }pixels[(y*width+x)*4+3]=255;
  }return pixels;
}
