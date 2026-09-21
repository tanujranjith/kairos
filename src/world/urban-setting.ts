import {CELL_SIZE,terrainHeight} from '../content/world';
import {URBAN_PARK_DEFINITIONS,URBAN_SITE_DEFINITIONS,type UrbanSiteKind} from '../content/urban-setting';
import {buildArchitecture,buildBandArchitecture,type ArchitectureBuffers} from './architecture';
import type {CellInstance} from './cell-blueprint';
import type {MeshDataBuilder} from './mesh-data';

export interface UrbanSite {
  id:string;
  kind:UrbanSiteKind;
  seed:number;
  x:number;
  y:number;
  z:number;
  yaw:number;
  width:number;
  depth:number;
  cell:string;
  testSpot:{across:number;forward:number};
}

export interface UrbanPark {
  id:string;
  seed:number;
  x:number;
  y:number;
  z:number;
  yaw:number;
  width:number;
  depth:number;
  cell:string;
  testSpot:{across:number;forward:number};
}

type UrbanFootprint=Pick<UrbanSite,'seed'|'x'|'z'|'yaw'|'width'|'depth'>;

export const URBAN_SITES:readonly UrbanSite[]=URBAN_SITE_DEFINITIONS.map(site=>({
  ...site,
  y:terrainHeight(site.x,site.z),
  cell:`${Math.floor(site.x/CELL_SIZE)},${Math.floor(site.z/CELL_SIZE)}`,
}));
export const URBAN_PARKS:readonly UrbanPark[]=URBAN_PARK_DEFINITIONS.map(park=>({
  ...park,
  y:terrainHeight(park.x,park.z),
  cell:`${Math.floor(park.x/CELL_SIZE)},${Math.floor(park.z/CELL_SIZE)}`,
}));

export function urbanReserved(x:number,z:number,padding=0){
  return [...URBAN_SITES,...URBAN_PARKS].some(site=>{
    const dx=x-site.x,dz=z-site.z,c=Math.cos(site.yaw),s=Math.sin(site.yaw),across=dx*c-dz*s,forward=dx*s+dz*c;
    return Math.abs(across)<site.width*.5+padding&&Math.abs(forward)<site.depth*.5+padding;
  });
}

function local(site:UrbanFootprint,across:number,forward:number){
  const c=Math.cos(site.yaw),s=Math.sin(site.yaw),x=site.x+across*c+forward*s,z=site.z-across*s+forward*c;
  return {x,y:terrainHeight(x,z),z};
}

function tintBox(g:MeshDataBuilder,site:UrbanFootprint,across:number,rise:number,forward:number,width:number,height:number,depth:number,color:readonly number[],yawOffset=0){
  const p=local(site,across,forward),first=g.positions.length/3;g.box(p.x,p.y+rise,p.z,width,height,depth,site.yaw+yawOffset);g.tintSince(first,color);
}

function plazaPad(g:MeshDataBuilder,site:UrbanSite){
  const first=g.positions.length/3,columns=Math.ceil(site.width/8),rows=Math.ceil(site.depth/8),x0=-site.width/2,z0=-site.depth/2;
  // A small separation prevents independently triangulated grass from showing
  // through while the eight-metre grid still follows the physical terrain.
  const point=(column:number,row:number)=>{const p=local(site,x0+site.width*column/columns,z0+site.depth*row/rows);return {...p,y:p.y+.09};};
  for(let column=0;column<columns;column++)for(let row=0;row<rows;row++)g.quad(point(column,row),point(column+1,row),point(column,row+1),point(column+1,row+1));
  g.tintSince(first,[.43,.45,.43,1]);
}

function architecture(b:ArchitectureBuffers,site:UrbanSite,across:number,forward:number,width:number,depth:number,height:number,style:'brick'|'limestone'|'office',seed:number){
  const p=local(site,across,forward);buildArchitecture(b,{x:p.x,y:p.y+.095,z:p.z,width,depth,height,yaw:site.yaw,style,seed});
}

function simpleBuilding(b:ArchitectureBuffers,site:UrbanSite,across:number,forward:number,width:number,depth:number,height:number,style:'brick'|'limestone'|'office',seed:number){
  const p=local(site,across,forward);buildBandArchitecture(b,{x:p.x,y:p.y+.095,z:p.z,width,depth,height,yaw:site.yaw,style,seed});
}

function tree(instances:CellInstance[],site:UrbanFootprint,across:number,forward:number,scale=.34){
  const p=local(site,across,forward);instances.push(
    {kind:'oak',position:{x:p.x,y:p.y+8*scale+.10,z:p.z},scale:{x:scale,y:scale,z:scale},yaw:site.seed+across},
    {kind:'oakTrunk',position:{x:p.x,y:p.y+6*scale+.10,z:p.z},scale:{x:scale,y:scale,z:scale},yaw:site.seed+across},
  );
}

function planter(b:ArchitectureBuffers,instances:CellInstance[],site:UrbanSite,across:number,forward:number,long=false){
  tintBox(b.wall,site,across,.10,forward,long?7.5:2.6,.42,long?2.2:2.6,[.57,.59,.55,1]);
  tintBox(b.roof,site,across,.52,forward,long?7.0:2.2,.05,long?1.7:2.2,[.15,.12,.075,1]);
  if(long){tree(instances,site,across-2.4,forward,.30);tree(instances,site,across+2.4,forward,.30);}else tree(instances,site,across,forward,.34);
}

function paintLine(paint:MeshDataBuilder,site:UrbanSite,across:number,forward:number,width:number,depth:number,color:readonly number[]=[.84,.86,.79,1]){
  const p=local(site,across,forward),first=paint.positions.length/3;paint.box(p.x,p.y+.195,p.z,width,.008,depth,site.yaw);paint.tintSince(first,color);
}

function plazaInlays(paint:MeshDataBuilder,site:UrbanSite){
  const dark=[.20,.24,.23,1],edge=3.2;
  for(const forward of [-site.depth/2+edge,site.depth/2-edge])paintLine(paint,site,0,forward,site.width-edge*2,.22,dark);
  for(const across of [-site.width/2+edge,site.width/2-edge])paintLine(paint,site,across,0,.22,site.depth-edge*2,dark);
  paintLine(paint,site,0,0,site.width*.42,.13,[.60,.63,.59,1]);
  paintLine(paint,site,0,0,.13,site.depth*.42,[.60,.63,.59,1]);
}

function square(site:UrbanSite,b:ArchitectureBuffers,paint:MeshDataBuilder,instances:CellInstance[]){
  architecture(b,site,0,30,42,22,16,'limestone',site.seed);
  simpleBuilding(b,site,-34,-22,22,31,18,'brick',site.seed+1);
  simpleBuilding(b,site,34,-22,22,31,20,'brick',site.seed+2);
  for(const across of [-17,17])planter(b,instances,site,across,0,true);
  for(const across of [-34,34])planter(b,instances,site,across,20);
  tintBox(b.roof,site,0,.10,4,8,.55,8,[.28,.34,.34,1]);
  tintBox(b.wall,site,0,.65,4,1.35,4.8,1.35,[.77,.74,.63,1]);
  for(const offset of [-10,10])paintLine(paint,site,offset,-40,.11,15);
}

function court(site:UrbanSite,b:ArchitectureBuffers,paint:MeshDataBuilder,instances:CellInstance[]){
  simpleBuilding(b,site,-39,4,25,58,18,'brick',site.seed);
  simpleBuilding(b,site,39,4,25,58,19,'limestone',site.seed+1);
  architecture(b,site,0,37,52,20,24,'office',site.seed+2);
  for(const across of [-18,0,18])planter(b,instances,site,across,5);
  for(const across of [-18,18])planter(b,instances,site,across,-20);
  for(let across=-23;across<=23;across+=9.2)paintLine(paint,site,across,-41,.10,13);
  paintLine(paint,site,0,-34,48,.10);
}

function exchange(site:UrbanSite,b:ArchitectureBuffers,paint:MeshDataBuilder,instances:CellInstance[]){
  architecture(b,site,0,12,31,31,36,'office',site.seed);
  simpleBuilding(b,site,-30,27,24,23,13,'limestone',site.seed+1);
  simpleBuilding(b,site,-31,-25,22,28,17,'brick',site.seed+2);
  for(const forward of [-18,0,18])planter(b,instances,site,31,forward);
  for(let across=10;across<=43;across+=8)paintLine(paint,site,across,-37,.10,13);
  tintBox(b.roof,site,0,37.35,12,.22,6,.22,[.20,.25,.26,1]);
}

function campus(site:UrbanSite,b:ArchitectureBuffers,paint:MeshDataBuilder,instances:CellInstance[]){
  architecture(b,site,-31,17,28,35,23,'office',site.seed);
  simpleBuilding(b,site,31,17,28,35,29,'office',site.seed+1);
  simpleBuilding(b,site,0,-34,56,20,11,'limestone',site.seed+2);
  for(const across of [-19,0,19])planter(b,instances,site,across,-6);
  for(const across of [-47,47]){paintLine(paint,site,across,8,.10,48);paintLine(paint,site,across*.82,31,8,.10);}
}

function terrainPad(g:MeshDataBuilder,site:UrbanFootprint,across:number,forward:number,width:number,depth:number,color:readonly number[],lift=.085){
  const columns=Math.max(1,Math.ceil(width/5)),rows=Math.max(1,Math.ceil(depth/5)),first=g.positions.length/3;
  const point=(column:number,row:number)=>{const p=local(site,across-width/2+width*column/columns,forward-depth/2+depth*row/rows);return {...p,y:p.y+lift};};
  for(let column=0;column<columns;column++)for(let row=0;row<rows;row++)g.quad(point(column,row),point(column+1,row),point(column,row+1),point(column+1,row+1));
  g.tintSince(first,color);
}

function parkBench(b:ArchitectureBuffers,site:UrbanFootprint,across:number,forward:number,yawOffset=0){
  const dark=[.16,.21,.22,1],wood=[.43,.27,.13,1];
  for(const offset of [-.72,.72])tintBox(b.roof,site,across+offset,.10,forward,.07,.38,.42,dark,yawOffset);
  for(let slat=-2;slat<=2;slat++)tintBox(b.wall,site,across,.45+slat*.075,forward,1.75,.055,.12,wood,yawOffset);
  tintBox(b.wall,site,across,.37,forward-.18,1.75,.09,.34,wood,yawOffset);
}

function parkLamp(b:ArchitectureBuffers,site:UrbanFootprint,across:number,forward:number){
  const dark=[.13,.18,.19,1],stone=[.56,.59,.56,1],lamp=[.92,.86,.66,1];
  tintBox(b.wall,site,across,.08,forward,.34,.14,.34,stone);
  tintBox(b.roof,site,across,.22,forward,.11,4.2,.11,dark);
  tintBox(b.roof,site,across,4.32,forward,.58,.10,.12,dark);
  tintBox(b.glass,site,across,4.24,forward,.42,.09,.22,lamp);
}

function parkFountain(site:UrbanPark,b:ArchitectureBuffers){
  const segments=16,radius=Math.min(site.width,site.depth)*.09,stone=[.56,.59,.57,1],water=[.20,.57,.68,.84];
  for(let index=0;index<segments;index++){
    const angle=(index+.5)/segments*Math.PI*2,p=local(site,Math.cos(angle)*radius,Math.sin(angle)*radius);
    const first=b.wall.positions.length/3;
    b.wall.box(p.x,p.y+.09,p.z,2*Math.PI*radius/segments+.08,.46,.52,site.yaw-angle-Math.PI/2);
    b.wall.tintSince(first,stone);
  }
  const waterFirst=b.glass.positions.length/3,waterPoints=Array.from({length:segments},(_,index)=>{
    const angle=index/segments*Math.PI*2,p=local(site,Math.cos(angle)*(radius-.42),Math.sin(angle)*(radius-.42));return {...p,y:p.y+.43};
  });
  b.glass.polygon(waterPoints);b.glass.tintSince(waterFirst,water);
  tintBox(b.roof,site,0,.50,0,.58,3.1,.58,[.27,.34,.35,1]);
  for(const height of [.9,1.7,2.5])tintBox(b.glass,site,0,height,0,.13,.23,.13,[.55,.84,.91,.9]);
}

export function buildUrbanPark(site:UrbanPark,b:ArchitectureBuffers,instances:CellInstance[]){
  const paving=[.48,.51,.48,1],halfWidth=site.width/2,halfDepth=site.depth/2,inner=6;
  terrainPad(b.wall,site,0,0,12,12,paving);
  for(const forward of [-(halfDepth+inner)/2,(halfDepth+inner)/2])terrainPad(b.wall,site,0,forward,4,halfDepth-inner,paving);
  for(const across of [-(halfWidth+inner)/2,(halfWidth+inner)/2])terrainPad(b.wall,site,across,0,halfWidth-inner,4,paving);
  parkFountain(site,b);
  parkBench(b,site,-8,-6);parkBench(b,site,8,6,Math.PI);parkBench(b,site,-8,6);parkBench(b,site,8,-6,Math.PI);
  for(const [across,forward] of [[-12,-27],[0,-27],[12,-27],[-12,27],[0,27],[12,27],[-16,-12],[-16,12],[16,-12],[16,12]] as const)tree(instances,site,across,forward,.32);
  for(const [across,forward] of [[-4,-17],[4,-17],[-4,17],[4,17]] as const)parkLamp(b,site,across,forward);
  for(const [across,forward] of [[-11,-13],[11,-13],[-11,13],[11,13]] as const){
    tintBox(b.wall,site,across,.08,forward,3.4,.34,1.7,[.54,.57,.53,1]);
    tintBox(b.roof,site,across,.42,forward,3.05,.04,1.35,[.13,.12,.07,1]);
    for(const offset of [-.85,0,.85]){const p=local(site,across+offset,forward);instances.push({kind:'grass',position:{x:p.x,y:p.y+.44,z:p.z},scale:{x:.38,y:.30,z:.38},yaw:site.seed+across+offset});}
  }
}

/** Site geometry merges into the ordinary structure/paint batches. The pad is
 * collision-bearing and therefore reports the existing Concrete identity. */
export function buildUrbanSetting(cx:number,cz:number,b:ArchitectureBuffers,paint:MeshDataBuilder,instances:CellInstance[]){
  for(const site of URBAN_SITES.filter(site=>site.cell===`${cx},${cz}`)){
    plazaPad(b.wall,site);
    plazaInlays(paint,site);
    if(site.kind==='square')square(site,b,paint,instances);
    else if(site.kind==='court')court(site,b,paint,instances);
    else if(site.kind==='exchange')exchange(site,b,paint,instances);
    else campus(site,b,paint,instances);
  }
  for(const site of URBAN_PARKS.filter(site=>site.cell===`${cx},${cz}`))buildUrbanPark(site,b,instances);
}
