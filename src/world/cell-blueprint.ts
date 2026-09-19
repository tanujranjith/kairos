import { CELL_SIZE,ROADS,LANDMARKS,terrainHeight,nearestRoad,inLake,JUNCTIONS,junctionRadius } from '../content/world';
import { inHandlingCourse,terrainOutsideHandling } from '../content/handling-course';
import { terrainOutsideJunctions } from '../content/terrain-clipping';
import { TUNNELS } from '../content/structures';
import { hash,rng } from '../core/math';
import type { Quality,V3,WorldCellManifest } from '../core/types';
import { MeshDataBuilder,meshBytes,type MeshData } from './mesh-data';
import { cellManifest,cellKey } from './cell-manifest';
import { meadowColor } from './landscape';
import { buildArchitecture,type BuildingStyle } from './architecture';

export type CellMaterial='terrain'|'road'|'shoulder'|'marking'|'yellow'|'curb'|'wall'|'roof'|'glass';
export interface CellMesh {name:string;material:CellMaterial;collision:boolean;data:MeshData}
export interface CellInstance {kind:'pine'|'oak'|'trunk'|'oakTrunk'|'rock'|'grass';position:V3;scale:V3;yaw:number}
export interface CellSign {id:string;name:string;position:V3;yaw:number}
export interface CellBlueprint {manifest:WorldCellManifest;meshes:CellMesh[];instances:CellInstance[];signs:CellSign[];bytes:number}
const roadCells=new Map<string,{road:typeof ROADS[number];index:number}[]>();
for(const road of ROADS)for(let index=0;index<road.points.length-1;index++){const p=road.points[index],q=road.points[index+1],key=cellKey(Math.floor((p.x+q.x)/2/CELL_SIZE),Math.floor((p.z+q.z)/2/CELL_SIZE)),list=roadCells.get(key)??[];list.push({road,index});roadCells.set(key,list);}
const atJunction=(x:number,z:number,roadId?:string)=>JUNCTIONS.some(j=>(!roadId||j.roads.includes(roadId))&&Math.hypot(x-j.x,z-j.z)<(roadId?(j.control==='turnaround'?16:j.radius+5):junctionRadius(j)+8));

/** No Babylon/DOM references: deterministic data can be generated in a module worker. */
export function buildCellBlueprint(cx:number,cz:number,quality:Quality):CellBlueprint{
  const manifest=cellManifest(cx,cz),key=manifest.id,[x0,z0]=manifest.bounds,meshes:CellMesh[]=[],instances:CellInstance[]=[],signs:CellSign[]=[];
  const add=(name:string,g:MeshDataBuilder,material:CellMaterial,collision=false)=>{if(!g.positions.length)return;const data=g.finish();if(material==='terrain'){const colors=new Float32Array(data.positions.length/3*4);for(let i=0;i<data.positions.length;i+=3)colors.set(meadowColor(data.positions[i],data.positions[i+2]),i/3*4);data.colors=colors;}meshes.push({name:`${name}-${key}`,material,collision,data});};
  const terrain=new MeshDataBuilder();
  for(let x=x0;x<x0+CELL_SIZE;x+=16)for(let z=z0;z<z0+CELL_SIZE;z+=16)for(const bounds of terrainOutsideHandling([x,z,x+16,z+16]))for(const polygon of terrainOutsideJunctions(bounds))terrain.polygon(polygon.map(p=>({...p,y:terrainHeight(p.x,p.z)})));
  add('terrain',terrain,'terrain',true);
  const asphalt=new MeshDataBuilder(),verge=new MeshDataBuilder(),white=new MeshDataBuilder(),yellow=new MeshDataBuilder(),curbs=new MeshDataBuilder(),rails=new MeshDataBuilder(),buildings=new MeshDataBuilder(),roofs=new MeshDataBuilder(),windows=new MeshDataBuilder(),pavement=new MeshDataBuilder();
  const utilityWindow=(...args:Parameters<MeshDataBuilder['box']>)=>{const first=windows.uvs.length;windows.box(...args);for(let i=first;i<windows.uvs.length;i+=2){windows.uvs[i]=.25;windows.uvs[i+1]=.5;}};
  for(const {road,index}of roadCells.get(key)??[]){
    const a=road.points[index],b=road.points[index+1];if(road.kind==='test'&&inHandlingCourse(a.x,a.z))continue;
    const strip=(g:MeshDataBuilder,offset:number,width:number,y=0)=>{const p=(v:typeof a,o:number)=>({x:v.x+Math.cos(v.yaw)*o,y:v.y+y,z:v.z-Math.sin(v.yaw)*o});g.quad(p(a,offset-width/2),p(a,offset+width/2),p(b,offset-width/2),p(b,offset+width/2));};
    const junction=atJunction((a.x+b.x)/2,(a.z+b.z)/2,road.id);
    if(!junction&&road.kind==='road'&&index%2===0&&!inLake(a.x,a.z)&&!(a.x<-650&&a.z<-300)){
      const decoration=rng(hash(index,road.id.length*17));
      for(const side of [-1,1])for(let clump=0;clump<3;clump++){const offset=side*(road.width/2+2.3+decoration()*5),along=decoration()*8,x=a.x+Math.cos(a.yaw)*offset+Math.sin(a.yaw)*along,z=a.z-Math.sin(a.yaw)*offset+Math.cos(a.yaw)*along;if(inLake(x,z)||inHandlingCourse(x,z,12)||atJunction(x,z))continue;const s=.45+decoration()*.7;instances.push({kind:'grass',position:{x,y:terrainHeight(x,z)-.035,z},scale:{x:s,y:.35+decoration()*.3,z:s},yaw:decoration()*Math.PI});}
    }
    if(!junction){strip(asphalt,0,road.width,.025);strip(verge,0,road.width+3,-.015);for(const side of [-1,1])strip(white,side*(road.width*.5-.22),.13,.046);}
    if(!junction&&road.id.startsWith('city'))for(const side of [-1,1]){
      // Flush visual paving leaves suspension/contact behaviour unchanged.
      const start=pavement.positions.length/3;strip(pavement,side*(road.width/2+1.45),2.7,.030);pavement.tintSince(start,[.69,.71,.69,1]);
      strip(white,side*(road.width/2+.12),.17,.037);
      if(index%2===0){const begin=pavement.positions.length/3,offset=side*(road.width/2+1.45),px=a.x+Math.cos(a.yaw)*offset,pz=a.z-Math.sin(a.yaw)*offset;pavement.box(px,a.y+.035,pz,2.7,.005,.032,a.yaw);pavement.tintSince(begin,[.36,.38,.37,1]);}
    }
    if(road.kind==='circuit'){if(index%2===0)for(const side of [-1,1])strip(curbs,side*(road.width*.5+.4),.85,.045);}
    else if(!junction&&road.kind!=='pit'&&road.kind!=='test'){if(index%3!==0)strip(road.kind==='highway'?white:yellow,0,.12,.046);if(road.lanes===4&&index%3!==0)for(const side of [-1,1])strip(white,side*road.width*.25,.12,.046);}
    if(!junction&&(road.kind==='highway'||a.z>950||inLake(a.x,a.z))&&index%2===0)for(const side of [-1,1]){const offset=side*(road.width*.5+1),x=a.x+Math.cos(a.yaw)*offset,z=a.z-Math.sin(a.yaw)*offset;rails.box(x,a.y+.65,z,.13,.30,16,a.yaw);rails.box(x,a.y,z,.13,.95,.13,a.yaw);}
    if(inLake(a.x,a.z)&&index%5===0){rails.box(a.x,a.y-1,a.z,road.width,.85,9,a.yaw);buildings.box(a.x,2,a.z,2,a.y-3,3,a.yaw);}
    for(const tunnel of TUNNELS)if(road.id===tunnel.roadId&&a.s>tunnel.start&&a.s<tunnel.end&&index%3===0){const sideOffset=tunnel.innerWidth/2+.5;for(const side of [-1,1])buildings.box(a.x+Math.cos(a.yaw)*side*sideOffset,a.y,a.z-Math.sin(a.yaw)*side*sideOffset,1,tunnel.height,25,a.yaw);roofs.box(a.x,a.y+tunnel.height,a.z,tunnel.innerWidth+2,1,25,a.yaw);}
  }
  add('verge',verge,'shoulder');add('roads',asphalt,'road',true);add('paint',white,'marking');add('center',yellow,'yellow');add('curbs',curbs,'curb');add('guardrails',rails,'roof',true);add('city-pavement',pavement,'wall');
  const random=rng(hash(cx,cz)),count={Low:32,Medium:48,High:65,Ultra:90}[quality];
  for(let i=0;i<count;i++){
    const x=x0+random()*CELL_SIZE,z=z0+random()*CELL_SIZE,near=nearestRoad(x,z,undefined,1);if(inHandlingCourse(x,z,12)||inLake(x,z)||atJunction(x,z)||near.distance<near.road.width*.5+5)continue;const y=terrainHeight(x,z),city=x<-650&&z<-650,industrial=x<-850&&z<-300&&z>-780,circuit=x>300&&z<-450;
    if((city||industrial)&&near.distance<95&&i%2===0){
      const h=industrial?8+random()*9:7+random()*30,w=12+random()*13,l=12+random()*16;
      // Set buildings back by their full footprint, not just their centre point.
      if(near.distance<near.road.width/2+Math.hypot(w,l)/2+3)continue;
      const style:BuildingStyle=industrial?'factory':z< -1280?'house':(['brick','limestone','office'] as const)[i%3];
      buildArchitecture({wall:buildings,roof:roofs,glass:windows},{x,y,z,width:w,depth:l,height:h,yaw:near.point.yaw,style,seed:hash(cx+i,cz)});
    }
    else if(!circuit&&!industrial){const s=.65+random()*.72,yaw=random()*Math.PI,pine=z>900||i%4===0;instances.push({kind:pine?'pine':'oak',position:{x,y:y+8*s,z},scale:{x:s,y:s,z:s},yaw},{kind:pine?'trunk':'oakTrunk',position:{x,y:y+6*s,z},scale:{x:s,y:s,z:s},yaw});if(i%5===0)instances.push({kind:'rock',position:{x:x+5,y:y+.5,z:z+3},scale:{x:s*1.5,y:s*.7,z:s},yaw});}
  }
  for(const landmark of LANDMARKS){if(Math.floor(landmark.x/CELL_SIZE)!==cx||Math.floor(landmark.z/CELL_SIZE)!==cz)continue;const n=nearestRoad(landmark.x,landmark.z),x=n.point.x+Math.cos(n.point.yaw)*(n.road.width*.5+7),z=n.point.z-Math.sin(n.point.yaw)*(n.road.width*.5+7),y=terrainHeight(x,z);
    if(landmark.type==='service'||landmark.type==='garage'){buildings.box(x,y,z,12,4,8);roofs.box(x,y+4,z,16,.25,12);for(const side of [-1,1]){utilityWindow(x+side*3.2,y+.5,z-4.03,4.5,2.8,.06);roofs.box(x+side*6.7,y,z-4.8,.16,4.2,.16);}roofs.box(x,y+3.4,z-4.1,12,.22,.3);}signs.push({id:landmark.id,name:landmark.name,position:{x,y,z},yaw:n.point.yaw});
  }
  if(cx>=2&&cx<=4&&cz===-6){const x=x0+128,y=17;buildings.box(x,y,-1436,230,9,19);utilityWindow(x,y+5,-1445.6,224,2.2,.06);roofs.box(x,y+9,-1436,236,.4,23);for(let i=0;i<12;i++)utilityWindow(x-110+i*19,y,-1445.7,12,3.8,.06);}
  if(cx===3&&cz===-7){buildings.box(900,17,-1540,190,3,28);for(let i=0;i<6;i++)roofs.box(900,20+i*.9,-1533-i*3,185,.6,2.6);for(const z of [-1512,-1488])buildings.box(680,17,z,1,8,1);roofs.box(680,25,-1500,1.5,1,25);}
  add('structures',buildings,'wall',true);add('roofs',roofs,'roof',true);add('windows',windows,'glass');
  return {manifest,meshes,instances,signs,bytes:meshes.reduce((sum,m)=>sum+meshBytes(m.data),0)};
}
export function blueprintTransfers(blueprint:CellBlueprint):ArrayBuffer[]{return blueprint.meshes.flatMap(m=>[m.data.positions.buffer,m.data.indices.buffer,m.data.uvs.buffer,m.data.normals.buffer,...(m.data.colors?[m.data.colors.buffer]:[])] as ArrayBuffer[]);}
