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
// Authored massifs leave distinct valleys and a northern lake vista. Heights
// remain visual only; the playable 4 km region retains its own terrain/contacts.
export const MOUNTAIN_MASSIFS=[
  {x:-4100,z:4500,width:1250,depth:1800,height:820,yaw:-.5},
  {x:-1600,z:5900,width:1600,depth:820,height:850,yaw:-.4},
  {x:3400,z:5900,width:2000,depth:950,height:1250,yaw:.6},
  {x:5100,z:2200,width:950,depth:2100,height:1080,yaw:.25},
  {x:5900,z:-2000,width:1250,depth:1650,height:720,yaw:-.5},
  {x:2400,z:-5700,width:1800,depth:850,height:810,yaw:.1},
  {x:-3600,z:-5100,width:1600,depth:1100,height:620,yaw:-.5},
  {x:-6000,z:300,width:900,depth:2300,height:570,yaw:-.1},
].map(p=>({...p,cos:Math.cos(p.yaw),sin:Math.sin(p.yaw)}));
/** Visual-only outer mountain range. Nothing in this mesh replaces a driving surface. */
export function mountainHeight(x:number,z:number){
  const edge=Math.max(Math.abs(x),Math.abs(z)),blend=smooth((edge-2180)/850),a=Math.atan2(z,x),r=Math.hypot(x,z);
  const hill=Math.exp(-Math.pow((r-3050-170*Math.sin(a*4))/350,2));
  const wx=(landscapeNoise(x/1700,z/1700)-.5)*330,wz=(landscapeNoise(x/1700+31,z/1700-19)-.5)*330;
  const ridge=(scale:number)=>1-Math.sqrt(Math.pow(landscapeNoise((x+wx)/scale,(z+wz)/scale)*2-1,2)+.008);
  let mass=0;
  for(const p of MOUNTAIN_MASSIFS){const dx=x-p.x,dz=z-p.z,u=(dx*p.cos+dz*p.sin)/p.width,v=(-dx*p.sin+dz*p.cos)/p.depth,h=p.height*Math.exp(-(u*u+v*v)*1.45);mass+=h*h*h*h;}
  // Large ridge spines and subordinate gullies shape the silhouette and its
  // actual lighting, instead of painting tiny rock noise onto smooth domes.
  const mountain=Math.pow(mass,.25)*(.30+ridge(900)*.40+ridge(400)*.21+ridge(210)*.12),foothills=hill*(25+landscapeNoise(x/650,z/650)*95);
  return -14+blend*(18+foothills+mountain);
}
export function mountainMesh(groundHeight?:(x:number,z:number)=>number){
  const g=new MeshDataBuilder(),segments=256,rings=60;
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
  for(let i=0;i<data.positions.length;i+=3){const [x,y,z]=data.positions.subarray(i,i+3),grain=landscapeNoise(x/95,z/95);
    // Duplicate seam vertices must share a smooth height-field normal, not a separate flat face.
    const height=i<groundComponents?groundHeight!:mountainHeight,nx=height(x-12,z)-height(x+12,z),nz=height(x,z-12)-height(x,z+12),length=Math.hypot(nx,24,nz);data.normals.set([nx/length,24/length,nz/length],i);
    const steep=1-24/length,rock=Math.max(smooth((steep-.08)/.30),smooth((y-430)/420)),snow=smooth((y-865+grain*75)/125)*(1-smooth((steep-.1)/.25));
    // Wide concavities retain darker material/occlusion at every time of day.
    const cavity=i<groundComponents?0:Math.max(0,(height(x-160,z)+height(x+160,z)+height(x,z-160)+height(x,z+160))*.25-y);
    const shade=(.78+grain*.30)*(1-smooth(cavity/100)*.38);
    // Linear reflectance: the earlier sRGB-like vertex values washed out under
    // direct sun. Cool forest/rock separates foreground from warm sky haze.
    colors.set([lerp(lerp(.045,.15,rock),.55,snow)*shade,lerp(lerp(.081,.17,rock),.60,snow)*shade,lerp(lerp(.068,.19,rock),.66,snow)*shade,1],i/3*4);
    if(i<groundComponents)colors.set(meadowColor(x,z).map((c,k)=>k===3?1:c*[.56,.59,.40][k]),i/3*4);
  }data.colors=colors;return data;
}
