import {ASTER_GROVES,inPaddock} from '../content/circuit-landscape';
import {CELL_SIZE,CIRCUIT,nearestRoad,pointAt,terrainHeight} from '../content/world';
import {hash,rng} from '../core/math';
import type {V3} from '../core/types';
import type {ArchitectureBuffers} from './architecture';
import {MeshDataBuilder} from './mesh-data';

export interface WoodlandTree {position:V3;scale:number;yaw:number}
/** Permanent, bounded middle-distance tree batches avoid a disappearing horizon
 * at the cell detail boundary. Nearby road vegetation still uses streamed cells. */
export function circuitWoodland():WoodlandTree[]{
  const trees:WoodlandTree[]=[],used=new Set<string>();
  for(let k=0;k<ASTER_GROVES.length;k++){
    const grove=ASTER_GROVES[k],random=rng(hash(k,793));
    for(let x=grove.x-grove.rx;x<grove.x+grove.rx;x+=22)for(let z=grove.z-grove.rz;z<grove.z+grove.rz;z+=22){
      const px=x+(random()-.5)*11,pz=z+(random()-.5)*11,r=((px-grove.x)/grove.rx)**2+((pz-grove.z)/grove.rz)**2;
      if(r>.82+random()*.28||random()<.09||inPaddock(px,pz,15))continue;
      const n=nearestRoad(px,pz,undefined,2),key=`${Math.round(px/10)},${Math.round(pz/10)}`;
      if(n.distance<n.road.width/2+27||used.has(key))continue;
      // Keep the grandstand footprint and its access concourse clear.
      if(px>795&&px<1005&&pz> -1575&&pz< -1520)continue;
      used.add(key);trees.push({position:{x:px,y:terrainHeight(px,pz),z:pz},scale:.95+random()*.65,yaw:random()*Math.PI*2});
    }
  }
  return trees;
}

const stone=[.73,.76,.74,1],steel=[.27,.33,.36,1],white=[.87,.88,.84,1],blue=[.15,.38,.53,1];
export const PADDOCK_TRUCKS=[566,628,690,752,814,876,938,1000,1062,1124,1186,1248] as const;
export function buildCircuitSetting(cx:number,cz:number,b:ArchitectureBuffers,paving:MeshDataBuilder,paint:MeshDataBuilder){
  const owns=(x:number,z:number)=>Math.floor(x/CELL_SIZE)===cx&&Math.floor(z/CELL_SIZE)===cz;
  const box=(g:MeshDataBuilder,x:number,y:number,z:number,w:number,h:number,d:number,c:number[],yaw=0)=>{const first=g.positions.length/3;g.box(x,y,z,w,h,d,yaw);g.tintSince(first,c);};
  const slab=(x:number,z:number,w:number,d:number)=>{if(!owns(x,z))return;box(paving,x,17.02,z,w,.008,d,[.61,.63,.61,1]);};
  // A back-of-house loop and parking aprons, distinct from the timed pit lane.
  for(let x=520;x<1300;x+=20){slab(x,-1410,20,10);slab(x,-1380,20,27);}
  for(const x of [530,760,1015,1290])for(let z=-1420;z<=-1380;z+=10)slab(x,z,7,10);
  // The pit safety wall separates the working lane from the main straight;
  // both connector mouths and all timed-road widths stay completely open.
  for(let x=592;x<1260;x+=12)if(owns(x,-1472)){
    const base=Math.min(...[-6,0,6].map(dx=>terrainHeight(x+dx,-1472)))-.4;
    box(b.wall,x,base,-1472,12,17.85-base,.48,stone);box(b.roof,x,17.85,-1472,12,.06,.55,white);
    if(x%36===4)box(b.roof,x,17.20,-1472.251,8,.25,.014,blue);
  }
  for(const x of PADDOCK_TRUCKS){
    if(!owns(x,-1380))continue;
    const z=-1380,y=17.035,accent=x%3===0?blue:[.56,.22,.17,1];
    // Transporter trailer, chamfered tractor cab, axles and team canopy.
    box(b.wall,x,y+.9,z+2,2.8,3.05,12.8,white);box(b.roof,x,y+.68,z+2,2.6,.28,13.5,steel);
    box(b.roof,x,y+1.55,z+2,2.83,.36,12.7,accent);box(b.roof,x,y+3.93,z+2,2.83,.10,12.85,white);
    const first=b.wall.positions.length/3;
    const p=(side:number,h:number,d:number)=>({x:x+side,y:y+h,z:z+d});
    for(const side of [-1,1]){const points=[p(side*1.33,.8,-7.2),p(side*1.33,2.25,-7.2),p(side*1.25,3.2,-6.4),p(side*1.25,3.2,-4.65),p(side*1.33,.8,-4.65)];b.wall.polygon(side>0?points.reverse():points);}
    b.wall.quad(p(-1.33,.8,-7.2),p(1.33,.8,-7.2),p(-1.33,2.25,-7.2),p(1.33,2.25,-7.2));
    b.wall.quad(p(-1.25,3.2,-6.4),p(1.25,3.2,-6.4),p(-1.25,3.2,-4.65),p(1.25,3.2,-4.65));b.wall.tintSince(first,white);
    const glass=b.glass.positions.length/3;b.glass.quad(p(-1.2,2.18,-7.22),p(1.2,2.18,-7.22),p(-1.16,3.10,-6.48),p(1.16,3.10,-6.48));b.glass.tintSince(glass,[.40,.57,.66,1]);
    for(let i=glass*2;i<b.glass.uvs.length;i+=2){b.glass.uvs[i]=.25;b.glass.uvs[i+1]=.5;}
    for(const side of [-1,1]){
      box(b.roof,x+side*.95,y+1.16,z-7.25,.47,.22,.035,white);
      for(const axle of [-5.8,-2.4,5.6,7]){
        const f=b.roof.positions.length/3;
        for(let i=0;i<12;i++){const a=i/12*Math.PI*2,c=(i+1)/12*Math.PI*2,point=(angle:number,out:number)=>({x:x+side*out,y:y+.55+Math.cos(angle)*.50,z:z+axle+Math.sin(angle)*.50});b.roof.quad(point(a,1.22),point(a,1.48),point(c,1.22),point(c,1.48));b.roof.polygon([{x:x+side*1.485,y:y+.55,z:z+axle},point(c,1.485),point(a,1.485)]);}
        b.roof.tintSince(f,[.07,.08,.085,1]);
      }
    }
    // Open-sided pit-team awning has posts, pitched roof and benches below.
    const ax=x+7;for(const dx of [-3.5,3.5])for(const dz of [-4,4])box(b.roof,ax+dx,y,z+dz,.075,2.85,.075,steel);
    const roof=b.roof.positions.length/3;for(const side of [-1,1]){const a={x:ax,y:y+3.6,z:z-4.5},c={x:ax+side*4,y:y+2.8,z:z-4.5},d={x:ax,y:y+3.6,z:z+4.5},e={x:ax+side*4,y:y+2.8,z:z+4.5};if(side>0)b.roof.quad(a,c,d,e);else b.roof.quad(a,d,c,e);}b.roof.tintSince(roof,accent);
    box(b.wall,ax,y+.7,z,3,.1,.7,stone);for(const dz of [-1.1,1.1])box(b.roof,ax,y+.42,z+dz,3,.12,.35,steel);
    for(const px of [x-3,x+12])box(paint,px,17.045,z,.08,.004,22,white);
  }
  // Back fence, occasional lamp standards and three marshaling shelters.
  for(let x=544;x<=1296;x+=8){
    if(!owns(x,-1332))continue;const y=terrainHeight(x,-1332);
    box(b.roof,x,y,-1332,.07,2.3,.07,steel);
    for(const h of [.65,1.4,2.18])box(b.roof,x+4,y+h,-1332,8,.022,.022,steel);
  }
  for(const x of [550,750,950,1150,1290])if(owns(x,-1403)){
    box(b.roof,x,17,-1403,.14,8,.14,steel);box(b.roof,x,24.8,-1404.5,.13,.15,3.2,steel);box(b.roof,x,24.67,-1405.9,.65,.15,1.05,white);
  }
  for(const s of [1150,1950,2780]){
    const p=pointAt(CIRCUIT,s,31);if(!owns(p.x,p.z))continue;const y=terrainHeight(p.x,p.z);
    box(b.wall,p.x,y,p.z,4,1.1,3,stone,p.yaw);box(b.roof,p.x,y+3.2,p.z,4.4,.16,3.5,blue,p.yaw);
    for(const side of [-1,1])box(b.roof,p.x+Math.cos(p.yaw)*side*1.8,y+1.1,p.z-Math.sin(p.yaw)*side*1.8,.10,2.1,.10,steel);
  }
  // Track perimeter sections stay well beyond runoff, with entry/exit left open.
  for(let s=1020;s<3320;s+=12){
    const p=pointAt(CIRCUIT,s,23);if(!owns(p.x,p.z))continue;
    const near=nearestRoad(p.x,p.z,undefined,2);if(near.distance<near.road.width/2+12)continue;
    const y=terrainHeight(p.x,p.z);box(b.wall,p.x,y,p.z,.32,.6,12.1,stone,p.yaw);
    box(b.roof,p.x,y+.6,p.z,.055,1.8,.055,steel,p.yaw);
    for(const h of [1.1,1.75,2.4])box(b.roof,p.x,y+h,p.z,.025,.022,12.1,steel,p.yaw);
  }
}
