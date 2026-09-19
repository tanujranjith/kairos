import { clamp, lerp, smooth } from '../core/math';
import type { Weather } from '../core/types';
import { noise } from './surface-textures';

export const SKY_WIDTH=768,SKY_HEIGHT=192;
export const windowLighting=(time:number)=>smooth((Math.abs(time-12)-5)/2);
/** Equirectangular upper hemisphere; periodic longitude avoids a visible sky seam. */
export function cloudField(width=SKY_WIDTH,height=SKY_HEIGHT){
  const field=new Float32Array(width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=x/width,v=y/(height-1),warp=noise(u*8,v*4,8)*.4;
    field[y*width+x]=noise(u*24,v*13+warp,24)*.52+noise(u*48,v*26,48)*.27+noise(u*96,v*52,96)*.14+noise(u*192,v*104,192)*.07;
  }return field;
}
export function skyPixels(time:number,weather:Weather,field:Float32Array,width=SKY_WIDTH,height=SKY_HEIGHT){
  const pixels=new Uint8Array(width*height*4),day=clamp(Math.sin((time-5.5)/25*Math.PI*2)*1.5+.38,.035,1),sunset=1-clamp(Math.abs(time-17.7)/2.9,0,1),cover=weather==='Rain'?.64:weather==='Overcast'?.48:weather==='Cloudy'?.20:0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const h=y/(height-1),t=Math.pow(h,.42),az=x/width*Math.PI*2,sunward=Math.pow(Math.max(0,Math.cos(az-2.27)),5),warm=sunset*(.24+sunward*.76)*(1-cover),n=field[y*width+x];
    const density=smooth((n-(.61-cover*.31))*7)*smooth(h*28)*(1-smooth((h-.80)*5));
    const glow=Math.exp(-h*8)*warm,shade=clamp(.76+(n-.5)*.32+sunward*sunset*.18,.5,1),light=clamp((day-.035)/.6,0,1);
    const horizon=[.74,.81,.86],zenith=[.16,.36,.64],night=[.008,.016,.035];
    for(let c=0;c<3;c++){
      let sky=lerp(horizon[c],zenith[c],t);sky=lerp(sky,[1,.63,.29][c],glow*.72);sky=lerp(sky,[.47,.53,.59][c],cover*.6);
      const cloud=shade*[1,1-warm*.15,1-warm*.34][c],value=lerp(night[c]*(1-h*.7),lerp(sky,cloud,density),light);
      pixels[(y*width+x)*4+c]=Math.round(clamp(value,0,1)*255);
    }pixels[(y*width+x)*4+3]=255;
  }return pixels;
}
