import { RawTexture, Texture, type Scene } from '@babylonjs/core';

export type SurfaceKind='asphalt'|'meadow'|'gravel'|'concrete'|'stone'|'bark';
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
  const base={asphalt:[69,73,74],meadow:[100,110,64],gravel:[135,128,111],concrete:[159,154,140],stone:[81,88,90],bark:[79,68,52]}[kind];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size,n=noise(u*8,v*8,8),fine=noise(u*96,v*96,96),grain=hash(x,y);
    let height=n*.4+fine*.45+grain*.15,variation=(n-.5)*.15+(fine-.5)*.18+(grain-.5)*.14;
    if(kind==='asphalt'){height=fine*.65+grain*.35;variation=(fine-.5)*.28+(grain-.5)*.25;if(grain>.97)variation+=.24;}
    if(kind==='meadow'){variation=(n-.5)*.44+(noise(u*24,v*24,24)-.5)*.25+(grain-.5)*.18;height=noise(u*120,v*40,120)*.8+grain*.2;}
    if(kind==='bark'){height=noise(u*32,v*4,32)*.8+fine*.2;variation=(height-.5)*.65;}
    if(kind==='stone'){const vein=Math.pow(Math.abs(Math.sin((u*8+v*5+n*.8)*Math.PI)),18);variation+=(vein-.2)*.13;height=n*.25+fine*.1;}
    heights[y*size+x]=height;const o=(y*size+x)*4;
    for(let c=0;c<3;c++)color[o+c]=Math.max(0,Math.min(255,base[c]*(1+variation)));
    color[o+3]=255;
  }
  const strength=kind==='meadow'?1.5:kind==='asphalt'?.7:kind==='bark'?2:1;
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
