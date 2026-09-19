import { smooth, lerp } from '../core/math';
import { MeshDataBuilder } from './mesh-data';

const fract=(x:number)=>x-Math.floor(x);
const hash=(x:number,z:number)=>fract(Math.sin(x*127.1+z*311.7)*43758.5453);
export function landscapeNoise(x:number,z:number){
  const ix=Math.floor(x),iz=Math.floor(z),u=smooth(x-ix),v=smooth(z-iz);
  return lerp(lerp(hash(ix,iz),hash(ix+1,iz),u),lerp(hash(ix,iz+1),hash(ix+1,iz+1),u),v);
}
/** Nonperiodic, metre-scale colour variation; the fine grass texture supplies only close detail. */
export function meadowColor(x:number,z:number):[number,number,number,number]{
  const broad=landscapeNoise(x/190,z/190),patch=landscapeNoise(x/42,z/42),dry=smooth((broad-.36)*2.1),value=.80+patch*.19;
  return [lerp(.60,.88,dry)*value,lerp(.72,.80,dry)*value,lerp(.39,.49,dry)*value,1];
}
/** Visual-only outer mountain range. Nothing in this mesh replaces a driving surface. */
export function mountainHeight(x:number,z:number){
  const edge=Math.max(Math.abs(x),Math.abs(z)),blend=smooth((edge-2180)/1500);
  const warp=landscapeNoise(x/1100,z/1100)*450;
  const ridge=(scale:number)=>1-Math.abs(landscapeNoise((x+warp)/scale,z/scale)*2-1);
  const range=.35+.65*landscapeNoise(x/2600+4,z/2600-8);
  const peaks=Math.pow(ridge(920),2.3)*1050+Math.pow(ridge(330),2)*230+ridge(110)*65+ridge(42)*20;
  return -14+blend*(65+peaks*range*.72);
}
export function mountainMesh(groundHeight?:(x:number,z:number)=>number){
  const g=new MeshDataBuilder(),segments=384,rings=40;
  // Preserve a coarse, recessed valley floor beyond the streamed detail ring.
  // Without it, unloading a cell exposes sky between the player and the outer range.
  if(groundHeight)for(let x=-2176;x<2176;x+=128)for(let z=-2176;z<2176;z+=128){const p=(x:number,z:number)=>({x,y:groundHeight(x,z)-8,z});g.quad(p(x,z),p(x+128,z),p(x,z+128),p(x+128,z+128));}
  const groundComponents=g.positions.length;
  const point=(sector:number,ring:number)=>{const a=sector/segments*Math.PI*2,c=Math.cos(a),s=Math.sin(a),inner=2010/Math.max(Math.abs(c),Math.abs(s)),r=inner+(8000-inner)*ring/rings,x=c*r,z=s*r;return {x,y:mountainHeight(x,z),z};};
  for(let ring=0;ring<rings;ring++)for(let sector=0;sector<segments;sector++){
    // Reversed angular winding produces upward-facing terrain in the Y-up scene.
    g.quad(point(sector+1,ring),point(sector,ring),point(sector+1,ring+1),point(sector,ring+1));
  }
  const data=g.finish(),colors=new Float32Array(data.positions.length/3*4);
  for(let i=0;i<data.positions.length;i+=3){const [x,y,z]=data.positions.subarray(i,i+3),grain=landscapeNoise(x/95,z/95),rock=smooth((y-240)/350),snow=smooth((y-880+grain*160)/170),shade=.83+grain*.17;
    colors.set([lerp(lerp(.26,.46,rock),.80,snow)*shade,lerp(lerp(.32,.45,rock),.83,snow)*shade,lerp(lerp(.23,.43,rock),.85,snow)*shade,1],i/3*4);
    // Duplicate seam vertices must share a smooth height-field normal, not a separate flat face.
    const height=i<groundComponents?groundHeight!:mountainHeight,nx=height(x-12,z)-height(x+12,z),nz=height(x,z-12)-height(x,z+12),length=Math.hypot(nx,24,nz);data.normals.set([nx/length,24/length,nz/length],i);
    if(i<groundComponents)colors.set(meadowColor(x,z).map((c,k)=>k===3?1:c*[.56,.59,.40][k]),i/3*4);
  }data.colors=colors;return data;
}
