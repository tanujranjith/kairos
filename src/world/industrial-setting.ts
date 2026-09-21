import {CELL_SIZE,ROADS,pointAt,terrainHeight} from '../content/world';
import {INDUSTRIAL_SITE_DEFINITIONS} from '../content/industrial-setting';
import type {ArchitectureBuffers} from './architecture';
import {buildArchitecture} from './architecture';
import type {MeshDataBuilder} from './mesh-data';

export type IndustrialKind='containers'|'tanks'|'plant';
export interface IndustrialSite {id:string;kind:IndustrialKind;seed:number;x:number;y:number;z:number;yaw:number;width:number;depth:number;cell:string}

const road=ROADS.find(road=>road.id==='industrial');if(!road)throw new Error('Missing Foundry Avenue');
export const INDUSTRIAL_SITES:readonly IndustrialSite[]=INDUSTRIAL_SITE_DEFINITIONS.map(definition=>{
  const p=pointAt(road,road.length*definition.at,definition.offset),yaw=p.yaw+definition.yaw,width=definition.kind==='containers'?84:definition.kind==='tanks'?70:78,depth=definition.kind==='containers'?58:definition.kind==='tanks'?56:64;
  return {...definition,x:p.x,y:terrainHeight(p.x,p.z),z:p.z,yaw,width,depth,cell:`${Math.floor(p.x/CELL_SIZE)},${Math.floor(p.z/CELL_SIZE)}`};
});

export function industrialReserved(x:number,z:number,padding=0){return INDUSTRIAL_SITES.some(site=>{const dx=x-site.x,dz=z-site.z,c=Math.cos(site.yaw),s=Math.sin(site.yaw),across=dx*c-dz*s,forward=dx*s+dz*c;return Math.abs(across)<site.width*.5+padding&&Math.abs(forward)<site.depth*.5+padding;});}

function tintBox(g:MeshDataBuilder,x:number,y:number,z:number,width:number,height:number,depth:number,yaw:number,color:readonly number[]){const first=g.positions.length/3;g.box(x,y,z,width,height,depth,yaw);g.tintSince(first,color);}
function local(site:IndustrialSite,across:number,forward:number){const c=Math.cos(site.yaw),s=Math.sin(site.yaw),x=site.x+across*c+forward*s,z=site.z-across*s+forward*c;return {x,y:terrainHeight(x,z),z};}
function localBox(g:MeshDataBuilder,site:IndustrialSite,across:number,y:number,forward:number,width:number,height:number,depth:number,color:readonly number[],yawOffset=0){const p=local(site,across,forward);tintBox(g,p.x,p.y+y,p.z,width,height,depth,site.yaw+yawOffset,color);}
function yardPad(g:MeshDataBuilder,site:IndustrialSite,color:readonly number[]){
  const first=g.positions.length/3,columns=Math.ceil(site.width/8),rows=Math.ceil(site.depth/8),x0=-site.width/2,z0=-site.depth/2;
  // A visible separation is required because each pad quad and the independently
  // triangulated terrain interpolate the same height field differently.
  const point=(column:number,row:number)=>{const p=local(site,x0+site.width*column/columns,z0+site.depth*row/rows);return {...p,y:p.y+.09};};
  for(let column=0;column<columns;column++)for(let row=0;row<rows;row++)g.quad(point(column,row),point(column+1,row),point(column,row+1),point(column+1,row+1));
  g.tintSince(first,color);
}
function cylinder(g:MeshDataBuilder,x:number,y:number,z:number,radius:number,height:number,color:readonly number[],segments=12){
  const first=g.positions.length/3,at=(index:number,top=false)=>{const angle=index/segments*Math.PI*2;return {x:x+Math.cos(angle)*radius,y:y+(top?height:0),z:z+Math.sin(angle)*radius};};
  for(let index=0;index<segments;index++)g.quad(at(index),at(index+1),at(index,true),at(index+1,true));
  g.polygon(Array.from({length:segments},(_,index)=>at(index,true)));g.polygon(Array.from({length:segments},(_,index)=>at(segments-1-index)));g.tintSince(first,color);
}
function cone(g:MeshDataBuilder,x:number,y:number,z:number,radius:number,height:number,color:readonly number[],segments=12){
  const first=g.positions.length/3,ring=(index:number)=>{const angle=index/segments*Math.PI*2;return {x:x+Math.cos(angle)*radius,y,z:z+Math.sin(angle)*radius};},tip={x,y:y+height,z};
  for(let index=0;index<segments;index++)g.polygon([ring(index),ring(index+1),tip]);g.polygon(Array.from({length:segments},(_,index)=>ring(segments-1-index)));g.tintSince(first,color);
}

function containerYard(site:IndustrialSite,b:ArchitectureBuffers){
  yardPad(b.wall,site,[.28,.31,.30,1]);
  const colors=[[.54,.17,.11,1],[.16,.34,.40,1],[.57,.43,.13,1],[.35,.39,.36,1]] as const;
  let index=0;
  for(const across of [-27,-18,-9,0,9,18,27])for(const forward of [-15,0,15]){
    if((index+site.seed)%5===0){index++;continue;}const levels=(index+site.seed)%4===0?2:1,color=colors[(index+site.seed)%colors.length];
    for(let level=0;level<levels;level++){
      localBox(b.wall,site,across,level*2.68+.04,forward,2.55,2.58,6.12,color);
      for(const rib of [-2.25,-.75,.75,2.25])localBox(b.roof,site,across,level*2.68+.18,forward+rib,2.61,2.16,.045,[.16,.19,.19,1]);
      localBox(b.roof,site,across,level*2.68+.14,forward+3.08,2.38,2.28,.05,[.24,.27,.26,1]);
    }index++;
  }
  for(const across of [-site.width*.5+3,site.width*.5-3])for(const forward of [-site.depth*.5+3,site.depth*.5-3])localBox(b.roof,site,across,.02,forward,.22,6.5,.22,[.22,.25,.24,1]);
  for(const forward of [-site.depth*.5+3,site.depth*.5-3])localBox(b.roof,site,0,6.25,forward,site.width-6,.20,.20,[.22,.25,.24,1]);
}

function tankFarm(site:IndustrialSite,b:ArchitectureBuffers){
  yardPad(b.wall,site,[.34,.35,.32,1]);
  for(const [across,forward] of [[-13,-10],[13,-10],[-13,11],[13,11]] as const){const p=local(site,across,forward),height=7.4+((across+forward+site.seed)%3)*.45;cylinder(b.wall,p.x,p.y+.02,p.z,4.4,height,[.57,.61,.59,1]);cone(b.roof,p.x,p.y+height+.02,p.z,4.55,1.25,[.38,.42,.41,1]);for(const level of [2.1,4.4,6.7])cylinder(b.roof,p.x,p.y+level,p.z,4.46,.10,[.28,.31,.31,1]);}
  for(const across of [-20,0,20]){localBox(b.roof,site,across,1.05,0,.28,.28,42,[.27,.31,.31,1]);localBox(b.roof,site,across,.02,-21,.20,3.2,.20,[.27,.31,.31,1]);}
}

function processPlant(site:IndustrialSite,b:ArchitectureBuffers){
  yardPad(b.wall,site,[.29,.31,.29,1]);
  const base=local(site,8,4);buildArchitecture(b,{x:base.x,y:base.y,z:base.z,width:31,depth:24,height:10.5,yaw:site.yaw,style:'factory',seed:site.seed});
  for(const [across,forward,radius,height] of [[-19,-9,2.2,28],[-12,-13,1.65,21]] as const){const p=local(site,across,forward);cylinder(b.wall,p.x,p.y,p.z,radius,height,[.39,.43,.42,1],14);for(let level=4;level<height;level+=5)cylinder(b.roof,p.x,p.y+level,p.z,radius+.06,.24,[.67,.28,.20,1],14);}
  for(const across of [-27,-9,9,27]){localBox(b.roof,site,across,.02,22,.26,7.2,.26,[.22,.26,.26,1]);localBox(b.roof,site,across,6.8,22,.38,.35,18,[.22,.26,.26,1]);}
  localBox(b.roof,site,0,5.2,22,55,.30,.30,[.31,.35,.34,1]);
}

/** All solids merge into the ordinary collision-bearing structure batches. */
export function buildIndustrialSetting(cx:number,cz:number,b:ArchitectureBuffers){
  for(const site of INDUSTRIAL_SITES.filter(site=>site.cell===`${cx},${cz}`)){
    if(site.kind==='containers')containerYard(site,b);else if(site.kind==='tanks')tankFarm(site,b);else processPlant(site,b);
  }
}
