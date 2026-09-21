export const surfaceKinds=['asphalt','meadow','gravel','concrete','stone','bark','water','cliff','boulder'];
const fract=value=>value-Math.floor(value);
const hash=(x,y)=>fract(Math.sin(x*127.1+y*311.7)*43758.5453);

/** Deterministic periodic lattice noise shared by runtime fallbacks and the
 * development-time KTX2 build. */
export function periodicNoise(x,y,period){
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
  const h=(a,b)=>hash((a%period+period)%period,(b%period+period)%period);
  return (h(ix,iy)*(1-sx)+h(ix+1,iy)*sx)*(1-sy)+(h(ix,iy+1)*(1-sx)+h(ix+1,iy+1)*sx)*sy;
}

/** Original periodic material fields. No source photographs or external art. */
export function surfacePixels(kind,size=256){
  if(!surfaceKinds.includes(kind))throw new Error(`Unknown Kairos surface kind: ${kind}`);
  const heights=new Float32Array(size*size),color=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4);
  const base={asphalt:[79,82,83],meadow:[122,135,98],gravel:[135,128,111],concrete:[183,178,165],stone:[81,88,90],bark:[79,68,52],water:[45,76,79],cliff:[203,207,210],boulder:[118,119,111]}[kind];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size,n=periodicNoise(u*8,v*8,8),fine=periodicNoise(u*96,v*96,96),grain=hash(x,y);
    let height=n*.4+fine*.45+grain*.15,variation=(n-.5)*.15+(fine-.5)*.18+(grain-.5)*.14;
    if(kind==='asphalt'){height=fine*.45+grain*.25;variation=(fine-.5)*.15+(grain-.5)*.14;if(grain>.985)variation+=.16;}
    if(kind==='meadow'){variation=(fine-.5)*.16+(grain-.5)*.14;height=periodicNoise(u*120,v*80,120)*.6+grain*.4;}
    if(kind==='concrete'){variation=(n-.5)*.055+(fine-.5)*.06+(grain-.5)*.025;height=fine*.25+grain*.15;}
    if(kind==='bark'){height=periodicNoise(u*32,v*4,32)*.8+fine*.2;variation=(height-.5)*.65;}
    if(kind==='stone'){variation=(n-.5)*.08+(fine-.5)*.015;height=n*.10+fine*.015;}
    if(kind==='boulder'){
      const seam=Math.pow(Math.max(0,1-Math.abs(periodicNoise(u*16,v*16,16)-.49)*22),5),mineral=periodicNoise(u*40,v*40,40);
      height=n*.25+fine*.42+grain*.10-seam*.17;
      variation=(n-.5)*.21+(mineral-.5)*.35+(grain-.5)*.26-seam*.15;
    }
    if(kind==='water'){height=.5+Math.sin((u*9+v*3+periodicNoise(u*4,v*4,4)*.45)*Math.PI*2)*.17+Math.sin((u*3-v*11)*Math.PI*2)*.12+Math.sin((u*21+v*17)*Math.PI*2)*.05;variation=(height-.5)*.10;}
    if(kind==='cliff'){const strata=periodicNoise(u*12,v*36+periodicNoise(u*4,v*4,4)*2,12);height=n*.30+strata*.5+fine*.2;variation=(n-.5)*.08+(strata-.5)*.10+(fine-.5)*.04;}
    heights[y*size+x]=height;const offset=(y*size+x)*4;
    for(let channel=0;channel<3;channel++)color[offset+channel]=Math.max(0,Math.min(255,base[channel]*(1+variation)));
    color[offset+3]=255;
  }
  const strength=kind==='meadow'?1.5:kind==='asphalt'?.7:kind==='bark'?2:kind==='water'?3:1;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const h=(dx,dy)=>heights[((y+dy+size)%size)*size+(x+dx+size)%size];
    const dx=(h(-1,0)-h(1,0))*strength,dy=(h(0,-1)-h(0,1))*strength,length=Math.hypot(dx,dy,1),offset=(y*size+x)*4;
    normal.set([(dx/length*.5+.5)*255,(dy/length*.5+.5)*255,(1/length*.5+.5)*255,255],offset);
  }
  return {color,normal};
}

/** Original packed cloud coverage / erosion / high-cloud fields. */
export function cloudAtlas(size=512){
  const pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size,wx=periodicNoise(u*4+13,v*4-7,4)*1.1,wz=periodicNoise(u*4-5,v*4+19,4)*1.1;
    const broad=periodicNoise(u*4,v*4,4)*.55+periodicNoise(u*8+wx,v*8+wz,8)*.30+periodicNoise(u*16+wx*2,v*16+wz*2,16)*.15;
    const fine=periodicNoise(u*64,v*64,64)*.65+periodicNoise(u*128,v*128,128)*.35;
    const cirrus=periodicNoise(u*16+wx,v*16+wz,16)*.65+periodicNoise(u*32,v*32,32)*.35;
    pixels.set([broad*255,fine*255,cirrus*255,255],(y*size+x)*4);
  }
  return pixels;
}
