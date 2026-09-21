import {CELL_SIZE,JUNCTIONS,ROADS,inLake,junctionRadius,pointAt,terrainHeight} from '../content/world';
import {RURAL_FARM_SITES,RURAL_FENCE_RUNS,RURAL_UTILITY_RUNS} from '../content/rural-infrastructure';
import {buildArchitecture,type ArchitectureBuffers} from './architecture';
import type {MeshDataBuilder} from './mesh-data';

export type RuralPropKind='utility-pole'|'crossarm'|'insulator'|'wire'|'fence-post'|'fence-rail';
export interface RuralProp {kind:RuralPropKind;x:number;y:number;z:number;width:number;height:number;depth:number;yaw:number;color:readonly [number,number,number,number]}
export interface RuralFarm {x:number;y:number;z:number;yaw:number;seed:number}
export interface FarmSilo {x:number;y:number;z:number;radius:number;height:number}
interface RuralCell {props:RuralProp[];farms:RuralFarm[]}

const cells=new Map<string,RuralCell>(),wood=[.46,.31,.18,1] as const,dark=[.10,.12,.12,1] as const,ceramic=[.63,.67,.62,1] as const;
const cell=(x:number,z:number)=>{const key=`${Math.floor(x/CELL_SIZE)},${Math.floor(z/CELL_SIZE)}`,entry=cells.get(key)??{props:[],farms:[]};cells.set(key,entry);return entry;};
const clear=(x:number,z:number)=>!inLake(x,z)&&!JUNCTIONS.some(j=>Math.hypot(j.x-x,j.z-z)<junctionRadius(j)+13);
const prop=(value:RuralProp)=>{if(clear(value.x,value.z))cell(value.x,value.z).props.push(value);};

for(const run of RURAL_UTILITY_RUNS){
  const road=ROADS.find(r=>r.id===run.road)!;let index=0;
  for(let s=road.length*run.start;s<=road.length*run.end;s+=run.spacing,index++){
    const p=pointAt(road,s,run.offset),ground=terrainHeight(p.x,p.z);if(p.layer&&p.layer!=='surface'||!clear(p.x,p.z))continue;
    prop({kind:'utility-pole',x:p.x,y:ground,z:p.z,width:.20,height:7.25,depth:.20,yaw:p.yaw,color:wood});
    prop({kind:'crossarm',x:p.x,y:ground+6.72,z:p.z,width:3.05,height:.13,depth:.14,yaw:p.yaw,color:wood});
    for(const offset of [-1.18,0,1.18]){const x=p.x+Math.cos(p.yaw)*offset,z=p.z-Math.sin(p.yaw)*offset;prop({kind:'insulator',x,y:ground+6.84,z,width:.09,height:.20,depth:.09,yaw:p.yaw,color:ceramic});}
    if(index%4===2){const x=p.x+Math.cos(p.yaw)*.31,z=p.z-Math.sin(p.yaw)*.31;prop({kind:'crossarm',x,y:ground+4.75,z,width:.48,height:.80,depth:.42,yaw:p.yaw,color:dark});}
  }
  // Short road-following wire segments retain the curve and avoid long chords.
  for(let s=road.length*run.start;s<road.length*run.end;s+=20){
    const end=Math.min(s+20,road.length*run.end),a=pointAt(road,s,run.offset),b=pointAt(road,end,run.offset);if(!clear(a.x,a.z)||!clear(b.x,b.z))continue;
    for(const lateral of [-1.18,0,1.18]){
      const ax=a.x+Math.cos(a.yaw)*lateral,az=a.z-Math.sin(a.yaw)*lateral,bx=b.x+Math.cos(b.yaw)*lateral,bz=b.z-Math.sin(b.yaw)*lateral,x=(ax+bx)/2,z=(az+bz)/2,y=(terrainHeight(ax,az)+terrainHeight(bx,bz))/2+7.01;
      prop({kind:'wire',x,y,z,width:.032,height:.032,depth:Math.hypot(bx-ax,bz-az)+.08,yaw:Math.atan2(bx-ax,bz-az),color:dark});
    }
  }
}

for(const run of RURAL_FENCE_RUNS){
  const road=ROADS.find(r=>r.id===run.road)!;
  for(const sideOffset of run.offsets)for(let s=road.length*run.start,index=0;s<=road.length*run.end;s+=run.spacing,index++){
    const p=pointAt(road,s,sideOffset),ground=terrainHeight(p.x,p.z);if(!clear(p.x,p.z))continue;
    prop({kind:'fence-post',x:p.x,y:ground,z:p.z,width:.13,height:1.42,depth:.13,yaw:p.yaw,color:wood});
    const end=Math.min(s+run.spacing,road.length*run.end);if(end<=s||index%20===10||index%20===11)continue;
    const q=pointAt(road,end,sideOffset);if(!clear(q.x,q.z))continue;const qGround=terrainHeight(q.x,q.z),x=(p.x+q.x)/2,z=(p.z+q.z)/2,y=(ground+qGround)/2,yaw=Math.atan2(q.x-p.x,q.z-p.z),length=Math.hypot(q.x-p.x,q.z-p.z)+.10;
    for(const height of [.48,1.02])prop({kind:'fence-rail',x,y:y+height,z,width:.10,height:.10,depth:length,yaw,color:wood});
  }
}

for(const site of RURAL_FARM_SITES){
  const road=ROADS.find(r=>r.id===site.road)!,p=pointAt(road,road.length*site.at,site.offset);if(!clear(p.x,p.z))continue;
  cell(p.x,p.z).farms.push({x:p.x,y:terrainHeight(p.x,p.z),z:p.z,yaw:p.yaw+site.yaw,seed:site.seed});
}

export function ruralInfrastructure(cx:number,cz:number):Readonly<RuralCell>{return cells.get(`${cx},${cz}`)??{props:[],farms:[]};}

export function farmSilos(farm:RuralFarm):readonly FarmSilo[]{
  const c=Math.cos(farm.yaw),s=Math.sin(farm.yaw),place=(across:number,forward:number,radius:number,height:number)=>{
    const x=farm.x+across*c+forward*s,z=farm.z-across*s+forward*c;return {x,y:terrainHeight(x,z),z,radius,height};
  };
  return [place(-16,8,3.7,10.2),place(-24,9.5,2.65,7.4)];
}

function cylinder(g:MeshDataBuilder,x:number,y:number,z:number,radius:number,height:number,color:readonly number[],segments=12){
  const first=g.positions.length/3,at=(index:number,top=false)=>{const angle=index/segments*Math.PI*2;return {x:x+Math.cos(angle)*radius,y:y+(top?height:0),z:z+Math.sin(angle)*radius};};
  for(let index=0;index<segments;index++)g.quad(at(index),at(index+1),at(index,true),at(index+1,true));
  g.polygon(Array.from({length:segments},(_,index)=>at(index,true)));g.polygon(Array.from({length:segments},(_,index)=>at(segments-1-index)));
  g.tintSince(first,color);
}

function cone(g:MeshDataBuilder,x:number,y:number,z:number,radius:number,height:number,color:readonly number[],segments=12){
  const first=g.positions.length/3,ring=(index:number)=>{const angle=index/segments*Math.PI*2;return {x:x+Math.cos(angle)*radius,y,z:z+Math.sin(angle)*radius};},tip={x,y:y+height,z};
  for(let index=0;index<segments;index++)g.polygon([ring(index),ring(index+1),tip]);
  g.polygon(Array.from({length:segments},(_,index)=>ring(segments-1-index)));g.tintSince(first,color);
}

/** Original infrastructure uses one bark-material detail batch per occupied
 * cell; farm buildings reuse the existing wall/roof/glass batches. */
export function buildRuralInfrastructure(cx:number,cz:number,b:ArchitectureBuffers,rural:MeshDataBuilder){
  const data=ruralInfrastructure(cx,cz);
  for(const p of data.props){const first=rural.positions.length/3;rural.box(p.x,p.y,p.z,p.width,p.height,p.depth,p.yaw);rural.tintSince(first,p.color);}
  for(const farm of data.farms){
    buildArchitecture(b,{...farm,width:13.5,depth:10.5,height:5.1,style:'house'});
    const c=Math.cos(farm.yaw),s=Math.sin(farm.yaw),x=farm.x+19*c+7*s,z=farm.z-19*s+7*c,y=terrainHeight(x,z);
    buildArchitecture(b,{x,y,z,width:17,depth:13,height:7.2,yaw:farm.yaw+.06,style:'factory',seed:farm.seed+1});
    for(const [index,silo] of farmSilos(farm).entries()){
      cylinder(b.wall,silo.x,silo.y,silo.z,silo.radius,silo.height,index?[.54,.58,.55,1]:[.65,.68,.63,1]);
      cone(b.roof,silo.x,silo.y+silo.height,silo.z,silo.radius+.28,index?2.15:2.75,[.38,.42,.41,1]);
      for(let level=2.1;level<silo.height;level+=2.25)cylinder(b.roof,silo.x,silo.y+level,silo.z,silo.radius+.055,.10,[.31,.35,.34,1]);
    }
    // Repeated detail stays in the existing bark batch and remains visual-only.
    for(let bale=0;bale<8;bale++){
      const across=8+(bale%4)*1.85,forward=17+Math.floor(bale/4)*1.35,bx=farm.x+across*c+forward*s,bz=farm.z-across*s+forward*c,by=terrainHeight(bx,bz),first=rural.positions.length/3;
      rural.box(bx,by,bz,1.55,.78,1.08,farm.yaw+(bale%2)*.04);rural.tintSince(first,[.68,.51,.19,1]);
    }
  }
}
