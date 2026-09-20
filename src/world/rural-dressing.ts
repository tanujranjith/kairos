import {CELL_SIZE,ROADS,LANDMARKS,JUNCTIONS,LAKE,junctionRadius,nearestRoad,pointAt,terrainHeight} from '../content/world';
import {inHandlingCourse} from '../content/handling-course';
import {RURAL_CORRIDORS} from '../content/rural-landscape';
import {hash,rng} from '../core/math';
import type {Quality} from '../core/types';
import type {CellInstance} from './cell-blueprint';

interface Grove {x:number;z:number;radius:number;trees:number;shrubs:number;seed:number;pine:boolean}
const groves:Grove[]=[];
for(const layout of RURAL_CORRIDORS){
  const road=ROADS.find(r=>r.id===layout.road)!;
  for(let i=0,s=layout.spacing*.45;s<road.length;s+=layout.spacing,i++)for(const side of [-1,1]){
    const random=rng(hash(layout.seed+i,side)),p=pointAt(road,s+(random()-.5)*layout.spacing*.26,side*(layout.setback+random()*10));
    groves.push({x:p.x,z:p.z,radius:layout.radius,trees:layout.trees,shrubs:layout.shrubs,seed:hash(layout.seed+i*97,side*19),pine:layout.road==='forest'||p.z>900&&p.x>300});
  }
}
// Small, irregular background copses connect the roadside groups across fields.
// A world-space seed, not the streamed cell, owns each grove.
for(let gx=-9;gx<=8;gx++)for(let gz=-9;gz<=8;gz++){
  const random=rng(hash(gx+410,gz-770));if(random()>.58)continue;
  groves.push({x:gx*224+55+random()*112,z:gz*224+55+random()*112,radius:33,trees:4,shrubs:3,seed:hash(gx+620,gz+540),pine:gz*224>900});
}
const services=LANDMARKS.filter(l=>l.type==='garage'||l.type==='service').map(l=>{
  const road=ROADS.find(r=>r.id===l.roadId)!,near=nearestRoad(l.x,l.z,r=>r===road),p=pointAt(road,near.progress,road.width/2+17);return {x:p.x,z:p.z};
});
/** Keep full crowns/rocks off roads, junction sightlines, water and service plots.
 * There are no added colliders, and planting never changes a driving surface. */
export function ruralPlantAllowed(x:number,z:number,radius:number){
  if(Math.max(Math.abs(x),Math.abs(z))>2008-radius||x< -650&&z< -250||x>300&&z< -450||inHandlingCourse(x,z,20+radius))return false;
  // Conservative full-crown ellipse clearance, including diagonal shorelines.
  if(Math.hypot((x-LAKE.x)/LAKE.rx,(z-LAKE.z)/LAKE.rz)<1+radius/Math.min(LAKE.rx,LAKE.rz))return false;
  if(services.some(p=>Math.hypot(p.x-x,p.z-z)<29+radius))return false;
  if(JUNCTIONS.some(j=>Math.hypot(j.x-x,j.z-z)<junctionRadius(j)+10+radius))return false;
  const near=nearestRoad(x,z,undefined,1);return near.distance>near.road.width/2+4+radius;
}
const cache=new Map<Quality,Map<string,CellInstance[]>>();
function generate(quality:Quality){
  const cells=new Map<string,CellInstance[]>(),factor={Low:1,Medium:1.25,High:1.55,Ultra:1.9}[quality];
  const add=(entry:CellInstance)=>{const key=`${Math.floor(entry.position.x/CELL_SIZE)},${Math.floor(entry.position.z/CELL_SIZE)}`,list=cells.get(key)??[];list.push(entry);cells.set(key,list);};
  for(const g of groves){
    for(const kind of ['tree','shrub','rock'] as const){
      const count=kind==='tree'?Math.ceil(g.trees*factor):kind==='shrub'?Math.ceil(g.shrubs*factor):g.seed%3===0?2:0;
      for(let i=0;i<count;i++){
        // Per-plant seeds make Low plants a stable subset of higher presets.
        const random=rng(hash(g.seed+i*23,{tree:71,shrub:97,rock:131}[kind])),a=random()*Math.PI*2,r=Math.sqrt(random())*g.radius;
        const x=g.x+Math.sin(a)*r,z=g.z+Math.cos(a)*r,s=kind==='tree'?.70+random()*.55:kind==='shrub'?.16+random()*.14:.38+random()*.40;
        if(!ruralPlantAllowed(x,z,kind==='tree'?s*5:kind==='shrub'?s*6:s*3))continue;
        const y=terrainHeight(x,z),yaw=random()*Math.PI*2;
        if(kind==='tree'){
          const pine=g.pine||random()<.16;
          add({kind:pine?'pine':'oak',position:{x,y:y+8*s,z},scale:{x:s,y:s,z:s},yaw});
          add({kind:pine?'trunk':'oakTrunk',position:{x,y:y+6*s,z},scale:{x:s,y:s,z:s},yaw});
        }else if(kind==='shrub'){
          // Reuse the actual leafy canopy at shrub scale, slightly sunk into
          // its terrain sample. No new alpha material, texture or draw batch.
          add({kind:'oak',position:{x,y:y+1.15*s,z},scale:{x:s*1.45,y:s*.85,z:s*1.20},yaw});
        }else add({kind:'rock',position:{x,y:y+.40*s,z},scale:{x:s*1.25,y:s,z:s},yaw});
      }
    }
  }
  cache.set(quality,cells);return cells;
}
/** Shared read-only definitions: each plant has exactly one streaming owner. */
export function ruralDressing(cx:number,cz:number,quality:Quality):readonly CellInstance[]{return (cache.get(quality)??generate(quality)).get(`${cx},${cz}`)??[];}
