import {CELL_SIZE,terrainHeight} from '../content/world';
import {URBAN_SITE_DEFINITIONS,type UrbanSiteKind} from '../content/urban-setting';
import {buildArchitecture,type ArchitectureBuffers} from './architecture';
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

export const URBAN_SITES:readonly UrbanSite[]=URBAN_SITE_DEFINITIONS.map(site=>({
  ...site,
  y:terrainHeight(site.x,site.z),
  cell:`${Math.floor(site.x/CELL_SIZE)},${Math.floor(site.z/CELL_SIZE)}`,
}));

export function urbanReserved(x:number,z:number,padding=0){
  return URBAN_SITES.some(site=>{
    const dx=x-site.x,dz=z-site.z,c=Math.cos(site.yaw),s=Math.sin(site.yaw),across=dx*c-dz*s,forward=dx*s+dz*c;
    return Math.abs(across)<site.width*.5+padding&&Math.abs(forward)<site.depth*.5+padding;
  });
}

function local(site:UrbanSite,across:number,forward:number){
  const c=Math.cos(site.yaw),s=Math.sin(site.yaw),x=site.x+across*c+forward*s,z=site.z-across*s+forward*c;
  return {x,y:terrainHeight(x,z),z};
}

function tintBox(g:MeshDataBuilder,site:UrbanSite,across:number,rise:number,forward:number,width:number,height:number,depth:number,color:readonly number[],yawOffset=0){
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
  const wall=style==='brick'?[.58,.29,.19,1]:style==='limestone'?[.86,.82,.69,1]:[.64,.70,.72,1],trim=[.78,.78,.72,1],metal=[.28,.33,.34,1],glass=[.34,.56,.65,1];
  tintBox(b.wall,site,across,.095,forward,width,height,depth,wall);
  tintBox(b.wall,site,across,.095,forward,width+.45,.55,depth+.45,[.43,.43,.40,1]);
  tintBox(b.wall,site,across,height-.35,forward,width+.55,.42,depth+.55,trim);
  tintBox(b.roof,site,across,height+.07,forward,width-.35,.14,depth-.35,metal);
  tintBox(b.roof,site,across-width*.18,height+.20,forward+depth*.12,2.6,.85,2.1,[.50,.54,.53,1]);
  const glassBox=(a:number,rise:number,f:number,w:number,h:number,d:number)=>{const first=b.glass.positions.length/3;tintBox(b.glass,site,across+a,rise,forward+f,w,h,d,glass);const occupied=(Math.abs(Math.round(a*13+f*7+rise*5)+seed)%4)<2;for(let i=first*2;i<b.glass.uvs.length;i+=2){b.glass.uvs[i]=occupied?.75:.25;b.glass.uvs[i+1]=.5;}};
  for(let level=4.1;level+1.55<height-.6;level+=3.55){
    // Keep both faces clear of the opaque wall. Exact coplanarity was stable in
    // WebGL2 but produced severe depth streaks on the native WebGPU path.
    for(const side of [-1,1]){glassBox(0,level,side*(depth/2+.065),width-2.0,1.55,.06);glassBox(side*(width/2+.065),level,0,.06,1.55,depth-2.0);}
    tintBox(b.wall,site,across,level-.16,forward,width+.12,.12,depth+.12,trim);
  }
  // Sparse proud mullions retain a readable scale without rebuilding every pane.
  for(const side of [-1,1])for(const offset of [-width*.28,0,width*.28])tintBox(b.roof,site,across+offset,3.75,forward+side*(depth/2+.08),.10,Math.max(2,height-4.2),.12,metal);
  tintBox(b.roof,site,across,3.22,forward-depth/2-.54,width*.58,.15,1.15,style==='brick'?[.31,.52,.46,1]:metal);
}

function tree(instances:CellInstance[],site:UrbanSite,across:number,forward:number,scale=.34){
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
}
