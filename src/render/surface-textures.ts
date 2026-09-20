import { RawTexture, Texture, type Scene } from '@babylonjs/core';

export type SurfaceKind='asphalt'|'meadow'|'gravel'|'concrete'|'stone'|'bark'|'water'|'cliff'|'boulder';
const fract=(v:number)=>v-Math.floor(v);
const hash=(x:number,y:number)=>fract(Math.sin(x*127.1+y*311.7)*43758.5453);
export function noise(x:number,y:number,period:number){
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
  const h=(a:number,b:number)=>hash((a%period+period)%period,(b%period+period)%period);
  return (h(ix,iy)*(1-sx)+h(ix+1,iy)*sx)*(1-sy)+(h(ix,iy+1)*(1-sx)+h(ix+1,iy+1)*sx)*sy;
}
/** Original, periodic material fields: no photo licensing or third-party runtime downloads. */
export function surfacePixels(kind:SurfaceKind,size=256){
  const heights=new Float32Array(size*size),color=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4);
  const base={asphalt:[79,82,83],meadow:[122,135,98],gravel:[135,128,111],concrete:[183,178,165],stone:[81,88,90],bark:[79,68,52],water:[45,76,79],cliff:[203,207,210],boulder:[118,119,111]}[kind];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size,n=noise(u*8,v*8,8),fine=noise(u*96,v*96,96),grain=hash(x,y);
    let height=n*.4+fine*.45+grain*.15,variation=(n-.5)*.15+(fine-.5)*.18+(grain-.5)*.14;
    if(kind==='asphalt'){height=fine*.45+grain*.25;variation=(fine-.5)*.15+(grain-.5)*.14;if(grain>.985)variation+=.16;}
    if(kind==='meadow'){variation=(fine-.5)*.16+(grain-.5)*.14;height=noise(u*120,v*80,120)*.6+grain*.4;}
    if(kind==='concrete'){variation=(n-.5)*.055+(fine-.5)*.06+(grain-.5)*.025;height=fine*.25+grain*.15;}
    if(kind==='bark'){height=noise(u*32,v*4,32)*.8+fine*.2;variation=(height-.5)*.65;}
    if(kind==='stone'){variation=(n-.5)*.08+(fine-.5)*.015;height=n*.10+fine*.015;}
    if(kind==='boulder'){
      const seam=Math.pow(Math.max(0,1-Math.abs(noise(u*16,v*16,16)-.49)*22),5),mineral=noise(u*40,v*40,40);
      height=n*.25+fine*.42+grain*.10-seam*.17;
      variation=(n-.5)*.21+(mineral-.5)*.35+(grain-.5)*.26-seam*.15;
    }
    if(kind==='water'){height=.5+Math.sin((u*9+v*3+noise(u*4,v*4,4)*.45)*Math.PI*2)*.17+Math.sin((u*3-v*11)*Math.PI*2)*.12+Math.sin((u*21+v*17)*Math.PI*2)*.05;variation=(height-.5)*.10;}
    if(kind==='cliff'){const strata=noise(u*12,v*36+noise(u*4,v*4,4)*2,12);height=n*.30+strata*.5+fine*.2;variation=(n-.5)*.08+(strata-.5)*.10+(fine-.5)*.04;}
    heights[y*size+x]=height;const o=(y*size+x)*4;
    for(let c=0;c<3;c++)color[o+c]=Math.max(0,Math.min(255,base[c]*(1+variation)));
    color[o+3]=255;
  }
  const strength=kind==='meadow'?1.5:kind==='asphalt'?.7:kind==='bark'?2:kind==='water'?3:1;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const h=(dx:number,dy:number)=>heights[((y+dy+size)%size)*size+(x+dx+size)%size];
    const dx=(h(-1,0)-h(1,0))*strength,dy=(h(0,-1)-h(0,1))*strength,length=Math.hypot(dx,dy,1),o=(y*size+x)*4;
    normal.set([(dx/length*.5+.5)*255,(dy/length*.5+.5)*255,(1/length*.5+.5)*255,255],o);
  }
  return {color,normal};
}
export function surfaceTextures(scene:Scene,kind:SurfaceKind,scale=1){
  const size=256,pixels=surfacePixels(kind,size);
  const texture=(data:Uint8Array,name:string,gamma:boolean)=>{const t=RawTexture.CreateRGBATexture(data,size,size,scene,true,false,Texture.TRILINEAR_SAMPLINGMODE);t.name=`original-${kind}-${name}`;t.gammaSpace=gamma;t.wrapU=t.wrapV=Texture.WRAP_ADDRESSMODE;t.anisotropicFilteringLevel=8;t.uScale=t.vScale=scale;return t;};
  return {albedo:texture(pixels.color,'albedo',true),normal:texture(pixels.normal,'normal',false)};
}
