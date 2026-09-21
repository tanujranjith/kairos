import { CELL_SIZE,ROADS,LANDMARKS,CIRCUIT,PIT,pointAt,terrainHeight,nearestRoad,inLake,JUNCTIONS,junctionRadius } from '../content/world';
import { inHandlingCourse } from '../content/handling-course';
import { buildTerrainMesh } from './terrain-mesh';
import { TUNNELS } from '../content/structures';
import { hash,rng } from '../core/math';
import type { Quality,V3,WorldCellManifest,ContactSurface,ContactRange } from '../core/types';
import { roadSpanAt,roadLayerAt } from '../content/road-layers';
import { MeshDataBuilder,meshBytes,type MeshData } from './mesh-data';
import { cellManifest,cellKey } from './cell-manifest';
import { applyGroundChannels,smoothGroundNormals,GRAVEL_TINT } from './ground-cover';
import { buildArchitecture,type BuildingStyle } from './architecture';
import { buildServicePavilion } from './service-pavilion';
import { buildPitGarage } from './pit-garage';
import { buildGrandstand } from './grandstand';
import {buildCircuitSetting} from './circuit-setting';
import {buildPitForecourt} from './pit-forecourt';
import {buildStreetscape} from './streetscape';
import {ruralDressing} from './rural-dressing';
import {buildRuralInfrastructure} from './rural-infrastructure';
import {roadsideGuidance} from './roadside-guidance';
import {buildIndustrialSetting,industrialReserved} from './industrial-setting';
import {PIT_BOX_LENGTH,PIT_BOX_WIDTH,PIT_SERVICE_BOXES} from '../content/pit-plan';

export type CellMaterial='terrain'|'road'|'shoulder'|'marking'|'yellow'|'curb'|'wall'|'roof'|'glass'|'trunk';
export interface CellMesh {name:string;material:CellMaterial;collision:boolean;data:MeshData;contactSurface?:ContactSurface;contactRanges?:ContactRange[]}
export interface CellInstance {kind:'pine'|'oak'|'trunk'|'oakTrunk'|'rock'|'grass';position:V3;scale:V3;yaw:number}
export interface CellSign {id:string;name:string;position:V3;yaw:number;width?:number;height?:number;mounted?:boolean}
export interface CellBlueprint {manifest:WorldCellManifest;meshes:CellMesh[];instances:CellInstance[];signs:CellSign[];bytes:number}
const roadCells=new Map<string,{road:typeof ROADS[number];index:number}[]>();
for(const road of ROADS)for(let index=0;index<road.points.length-1;index++){const p=road.points[index],q=road.points[index+1],key=cellKey(Math.floor((p.x+q.x)/2/CELL_SIZE),Math.floor((p.z+q.z)/2/CELL_SIZE)),list=roadCells.get(key)??[];list.push({road,index});roadCells.set(key,list);}
const atJunction=(x:number,z:number,roadId?:string)=>JUNCTIONS.some(j=>(!roadId||j.roads.includes(roadId))&&Math.hypot(x-j.x,z-j.z)<(roadId?(j.control==='turnaround'?16:j.radius+5):junctionRadius(j)+8));

/** No Babylon/DOM references: deterministic data can be generated in a module worker. */
export function buildCellBlueprint(cx:number,cz:number,quality:Quality):CellBlueprint{
  const manifest=cellManifest(cx,cz),key=manifest.id,[x0,z0]=manifest.bounds,meshes:CellMesh[]=[],instances:CellInstance[]=[],signs:CellSign[]=[];
  const add=(name:string,g:MeshDataBuilder,material:CellMaterial,collision=false,contactSurface?:ContactSurface,contactRanges?:ContactRange[])=>{if(!g.positions.length)return;const data=g.finish();if(material==='terrain'){applyGroundChannels(data);smoothGroundNormals(data);}meshes.push({name:`${name}-${key}`,material,collision,data,contactSurface:contactSurface??(collision?{surface:'Concrete',layer:'structure'}:undefined),contactRanges});};
  const terrain=buildTerrainMesh(cx,cz);
  add('terrain',terrain,'terrain',true,{surface:'Grass',layer:'terrain'});
  const asphalt=new MeshDataBuilder(),verge=new MeshDataBuilder(),white=new MeshDataBuilder(),yellow=new MeshDataBuilder(),curbs=new MeshDataBuilder(),rails=new MeshDataBuilder(),buildings=new MeshDataBuilder(),roofs=new MeshDataBuilder(),windows=new MeshDataBuilder(),pavement=new MeshDataBuilder(),rural=new MeshDataBuilder();
  const roadContacts:ContactRange[]=[],vergeContacts:ContactRange[]=[];
  // Paint comes from the same authored finish/grid positions as session spawns.
  const finish=pointAt(CIRCUIT,0);
  if(Math.floor(finish.x/CELL_SIZE)===cx&&Math.floor(finish.z/CELL_SIZE)===cz){
    const p=(s:number,o:number)=>{const a=pointAt(CIRCUIT,s,o);return {x:a.x,y:a.y+.048,z:a.z};};
    for(let row=0;row<2;row++)for(let col=0;col<20;col++)if((row+col)%2===0)white.quad(p(row*.7,col*.7-7),p(row*.7,col*.7-6.3),p((row+1)*.7,col*.7-7),p((row+1)*.7,col*.7-6.3));
  }
  for(let slot=0;slot<16;slot++){
    const s=CIRCUIT.length-18-Math.floor(slot/2)*14,o=(slot%2===0?-1:1)*3,a=pointAt(CIRCUIT,s,o);
    if(Math.floor(a.x/CELL_SIZE)!==cx||Math.floor(a.z/CELL_SIZE)!==cz)continue;
    white.box(a.x,a.y+.05,a.z,2.5,.004,.10,a.yaw);
    for(const side of [-1,1])white.box(a.x+Math.cos(a.yaw)*side*1.25-Math.sin(a.yaw)*.7,a.y+.05,a.z-Math.sin(a.yaw)*side*1.25-Math.cos(a.yaw)*.7,.10,.004,1.4,a.yaw);
  }
  for(const {road,index}of roadCells.get(key)??[]){
    const a=road.points[index],b=road.points[index+1],span=roadSpanAt(road,(a.s+b.s)/2);if(road.kind==='test'&&inHandlingCourse(a.x,a.z))continue;
    const strip=(g:MeshDataBuilder,offset:number,width:number,y=0)=>{const p=(v:typeof a,o:number)=>({x:v.x+Math.cos(v.yaw)*o,y:v.y+y,z:v.z-Math.sin(v.yaw)*o});g.quad(p(a,offset-width/2),p(a,offset+width/2),p(b,offset-width/2),p(b,offset+width/2));};
    const junction=atJunction((a.x+b.x)/2,(a.z+b.z)/2,road.id);
    if(!junction&&span?.kind!=='bridge'&&road.kind==='road'&&index%2===0&&!inLake(a.x,a.z)&&!(a.x<-650&&a.z<-300)){
      const decoration=rng(hash(index,road.id.length*17));
      for(const side of [-1,1])for(let clump=0;clump<4;clump++){const offset=side*(road.width/2+2.3+decoration()*5),along=decoration()*8,x=a.x+Math.cos(a.yaw)*offset+Math.sin(a.yaw)*along,z=a.z-Math.sin(a.yaw)*offset+Math.cos(a.yaw)*along;if(inLake(x,z)||inHandlingCourse(x,z,12)||atJunction(x,z))continue;const s=.45+decoration()*.7;instances.push({kind:'grass',position:{x,y:terrainHeight(x,z)-.035,z},scale:{x:s,y:.55+decoration()*.45,z:s},yaw:decoration()*Math.PI});}
    }
    if(!junction){const start=asphalt.indices.length/3,layer=roadLayerAt(road,(a.s+b.s)/2);strip(asphalt,0,road.width,.025);roadContacts.push({start,end:asphalt.indices.length/3,surface:'Asphalt',layer,roadId:road.id});
      const vergeStart=verge.indices.length/3,vergeVertex=verge.positions.length/3,surface=span?.kind==='bridge'||road.id.startsWith('city')?'Concrete':'Gravel';strip(verge,0,road.width+3,-.015);verge.tintSince(vergeVertex,surface==='Concrete'?[1,1,1,1]:GRAVEL_TINT);vergeContacts.push({start:vergeStart,end:verge.indices.length/3,surface,layer,roadId:road.id});
      for(const side of [-1,1])strip(white,side*(road.width*.5-.22),.13,.046);}
    if(!junction&&road.id.startsWith('city'))for(const side of [-1,1]){
      // Flush visual paving leaves suspension/contact behaviour unchanged.
      const start=pavement.positions.length/3;strip(pavement,side*(road.width/2+1.45),2.7,.030);pavement.tintSince(start,[.69,.71,.69,1]);
      strip(white,side*(road.width/2+.12),.17,.037);
      if(index%2===0){const begin=pavement.positions.length/3,offset=side*(road.width/2+1.45),px=a.x+Math.cos(a.yaw)*offset,pz=a.z-Math.sin(a.yaw)*offset;pavement.box(px,a.y+.035,pz,2.7,.005,.032,a.yaw);pavement.tintSince(begin,[.36,.38,.37,1]);}
    }
    if(road.kind==='circuit'){if(index%2===0)for(const side of [-1,1])strip(curbs,side*(road.width*.5+.4),.85,.045);}
    else if(!junction&&road.kind!=='pit'&&road.kind!=='test'){if(index%3!==0)strip(road.kind==='highway'?white:yellow,0,.12,.046);if(road.lanes===4&&index%3!==0)for(const side of [-1,1])strip(white,side*road.width*.25,.12,.046);}
    if(!junction&&(road.kind==='highway'||a.z>950||inLake(a.x,a.z))&&index%2===0)for(const side of [-1,1]){const offset=side*(road.width*.5+1),x=a.x+Math.cos(a.yaw)*offset,z=a.z-Math.sin(a.yaw)*offset;rails.box(x,a.y+.65,z,.13,.30,16,a.yaw);rails.box(x,a.y,z,.13,.95,.13,a.yaw);}
    if(span?.kind==='bridge'){
      // A continuous deck underside; support piers never occupy another road's clearance.
      const mx=(a.x+b.x)/2,mz=(a.z+b.z)/2,my=(a.y+b.y)/2,ground=terrainHeight(mx,mz);
      if(my-ground>1.1){const p=(v:typeof a,side:number,dy:number)=>({x:v.x+Math.cos(v.yaw)*side*(road.width/2+.15),y:v.y+dy,z:v.z-Math.sin(v.yaw)*side*(road.width/2+.15)}),al=p(a,-1,-.1),ar=p(a,1,-.1),bl=p(b,-1,-.1),br=p(b,1,-.1),ad=p(a,-1,-.75),ae=p(a,1,-.75),bd=p(b,-1,-.75),be=p(b,1,-.75);rails.quad(al,ar,bl,br);rails.quad(ad,bd,ae,be);rails.quad(ad,al,bd,bl);rails.quad(ae,be,ar,br);rails.quad(ad,ae,al,ar);rails.quad(bd,bl,be,br);}
      if(index%5===0&&my-ground>1.7){const lower=nearestRoad(mx,mz,r=>r.id!==road.id,1);if(lower.distance>lower.road.width/2+5)buildings.box(mx,ground-.15,mz,1.5,my-ground-.6,2.4,a.yaw);}
    }
    for(const tunnel of TUNNELS)if(road.id===tunnel.roadId&&a.s>tunnel.start&&a.s<tunnel.end&&index%3===0){const sideOffset=tunnel.innerWidth/2+.5;for(const side of [-1,1])buildings.box(a.x+Math.cos(a.yaw)*side*sideOffset,a.y,a.z-Math.sin(a.yaw)*side*sideOffset,1,tunnel.height,25,a.yaw);roofs.box(a.x,a.y+tunnel.height,a.z,tunnel.innerWidth+2,1,25,a.yaw);}
  }
  if(cx>=2&&cx<=4&&cz===-6){
    const x=x0+128,start=asphalt.indices.length/3;
    // The garage fronts open onto a level working apron, not a strip of lawn.
    asphalt.quad({x:x-115,y:17.025,z:-1456.5},{x:x+115,y:17.025,z:-1456.5},{x:x-115,y:17.025,z:-1444.5},{x:x+115,y:17.025,z:-1444.5});
    roadContacts.push({start,end:asphalt.indices.length/3,surface:'Asphalt',layer:'surface',roadId:'pit'});
    // These markings come from the same sixteen assigned boxes used by race AI.
    // The upstream end remains open so each car can drive through and rejoin.
    for(const box of PIT_SERVICE_BOXES){const p=box.position;if(Math.floor(p.x/CELL_SIZE)!==cx||Math.floor(p.z/CELL_SIZE)!==cz)continue;
      for(const side of [-1,1]){const edge=pointAt(PIT,box.progress,box.lateral+side*PIT_BOX_WIDTH/2);white.box(edge.x,edge.y+.05,edge.z,.10,.004,PIT_BOX_LENGTH,edge.yaw);}
      const stop=pointAt(PIT,box.progress+PIT_BOX_LENGTH/2,box.lateral);white.box(stop.x,stop.y+.05,stop.z,PIT_BOX_WIDTH,.004,.10,stop.yaw);
    }
  }
  const settingStart=asphalt.indices.length/3;
  buildCircuitSetting(cx,cz,{wall:buildings,roof:roofs,glass:windows},asphalt,white);
  buildPitForecourt(cx,cz,{wall:buildings,roof:roofs,glass:windows},asphalt,white);
  // Rural delineators share the existing paint batches: better depth and wet-
  // night road guidance with no extra material, draw call or collision shape.
  for(const post of roadsideGuidance(cx,cz).delineators){
    const whiteStart=white.positions.length/3;
    white.box(post.x,post.y,post.z,.12,.86,.10,post.yaw);
    white.tintSince(whiteStart,[.92,.94,.88,1]);
    const bandStart=white.positions.length/3;
    white.box(post.x,post.y+.47,post.z,.145,.23,.108,post.yaw);
    white.tintSince(bandStart,[.055,.075,.07,1]);
    // Two lenses sit proud of the road-facing surfaces, so the marker reads
    // from either direction instead of disappearing inside the post volume.
    for(const facing of [-1,1]){
      const amberStart=yellow.positions.length/3,offset=facing*.066;
      yellow.box(post.x+Math.sin(post.yaw)*offset,post.y+.535,post.z+Math.cos(post.yaw)*offset,.11,.10,.024,post.yaw);
      yellow.tintSince(amberStart,[1,.63,.12,1]);
    }
  }
  for(const sign of roadsideGuidance(cx,cz).chevrons){
    const darkStart=white.positions.length/3,c=Math.cos(sign.yaw),s=Math.sin(sign.yaw);
    for(const lateral of [-.43,.43])white.box(sign.x+c*lateral,sign.y,sign.z-s*lateral,.075,.80,.075,sign.yaw);
    white.box(sign.x,sign.y+.72,sign.z,1.34,.67,.09,sign.yaw);
    white.tintSince(darkStart,[.045,.06,.055,1]);
    const amberStart=yellow.positions.length/3,direction=-sign.side,tail=-direction*.38,tip=direction*.38;
    const vertex=(u:number,v:number,face:number)=>({x:sign.x+c*u+Math.sin(sign.yaw)*face*.052,y:sign.y+1.055+v,z:sign.z-s*u+Math.cos(sign.yaw)*face*.052});
    const bar=(au:number,av:number,bu:number,bv:number,face:number)=>{const du=bu-au,dv=bv-av,length=Math.hypot(du,dv),ou=-dv/length*.055,ov=du/length*.055,a=vertex(au+ou,av+ov,face),b=vertex(au-ou,av-ov,face),d=vertex(bu+ou,bv+ov,face),e=vertex(bu-ou,bv-ov,face);yellow.quad(a,b,d,e);yellow.quad(b,a,e,d);};
    for(const face of [-1,1]){bar(tail,.22,tip,0,face);bar(tail,-.22,tip,0,face);}
    yellow.tintSince(amberStart,[1,.63,.12,1]);
  }
  if(asphalt.indices.length/3>settingStart)roadContacts.push({start:settingStart,end:asphalt.indices.length/3,surface:'Asphalt',layer:'surface'});
  add('verge',verge,'shoulder',true,{surface:'Gravel',layer:'surface'},vergeContacts);add('roads',asphalt,'road',true,{surface:'Asphalt',layer:'surface'},roadContacts);add('paint',white,'marking');add('center',yellow,'yellow');add('curbs',curbs,'curb');add('guardrails',rails,'roof',true);
  const random=rng(hash(cx,cz)),urban=x0<-650&&z0<-300,count=quality==='Low'&&urban?32:{Low:44,Medium:60,High:80,Ultra:105}[quality];
  for(let i=0;i<count;i++){
    const x=x0+random()*CELL_SIZE,z=z0+random()*CELL_SIZE,near=nearestRoad(x,z,undefined,1);if(inHandlingCourse(x,z,12)||inLake(x,z)||atJunction(x,z)||near.distance<near.road.width*.5+5)continue;const y=terrainHeight(x,z),city=x<-650&&z<-650,industrial=x<-850&&z<-300&&z>-780,circuit=x>300&&z<-450;
    if((city||industrial)&&near.distance<95&&i%2===0){
      const h=industrial?8+random()*9:7+random()*30,w=12+random()*13,l=12+random()*16;
      // Set buildings back by their full footprint, not just their centre point.
      if(near.distance<near.road.width/2+Math.hypot(w,l)/2+3||industrialReserved(x,z,Math.hypot(w,l)/2+3))continue;
      const style:BuildingStyle=industrial?'factory':z< -1280?'house':(['brick','limestone','office'] as const)[i%3];
      buildArchitecture({wall:buildings,roof:roofs,glass:windows},{x,y,z,width:w,depth:l,height:h,yaw:near.point.yaw,style,seed:hash(cx+i,cz)});
    }
    else if(!circuit&&!industrial){
      // Preserve RNG consumption and every urban building/plant placement.
      // Only rural scatter is replaced by the authored grouped landscape.
      const s=.65+random()*.72,yaw=random()*Math.PI,pine=z>900||i%4===0;
      if(city||x< -650&&z< -250) {instances.push({kind:pine?'pine':'oak',position:{x,y:y+8*s,z},scale:{x:s,y:s,z:s},yaw},{kind:pine?'trunk':'oakTrunk',position:{x,y:y+6*s,z},scale:{x:s,y:s,z:s},yaw});if(i%5===0)instances.push({kind:'rock',position:{x:x+5,y:y+.5,z:z+3},scale:{x:s*1.5,y:s*.7,z:s},yaw});}
    }
  }
  instances.push(...ruralDressing(cx,cz,quality));
  for(const landmark of LANDMARKS){if(Math.floor(landmark.x/CELL_SIZE)!==cx||Math.floor(landmark.z/CELL_SIZE)!==cz)continue;const n=nearestRoad(landmark.x,landmark.z,landmark.roadId?r=>r.id===landmark.roadId:undefined),x=n.point.x+Math.cos(n.point.yaw)*(n.road.width*.5+7),z=n.point.z-Math.sin(n.point.yaw)*(n.road.width*.5+7),y=terrainHeight(x,z);
    if(landmark.type==='service'||landmark.type==='garage'){const px=n.point.x+Math.cos(n.point.yaw)*(n.road.width*.5+17),pz=n.point.z-Math.sin(n.point.yaw)*(n.road.width*.5+17);buildServicePavilion({wall:buildings,roof:roofs,glass:windows},pavement,{x:px,y:terrainHeight(px,pz),z:pz,yaw:n.point.yaw+Math.PI/2});}if(landmark.type!=='trial'&&landmark.type!=='drift')signs.push({id:landmark.id,name:landmark.name,position:{x,y,z},yaw:n.point.yaw});
  }
  if(cx>=2&&cx<=4&&cz===-6)buildPitGarage({wall:buildings,roof:roofs,glass:windows},x0+128,17,-1436);
  if(cx===3&&cz===-7){const detail=new MeshDataBuilder();buildGrandstand({wall:buildings,roof:roofs,glass:windows},detail);add('circuit-detail',detail,'roof');}
  if(cx===2&&cz===-6){
    for(const z of [-1512,-1488])buildings.box(680,17,z,.65,7,.65);roofs.box(680,23.6,-1500,1.2,1.4,25);
    signs.push({id:'aster-gantry',name:'K A I R O S    /    ASTER INTERNATIONAL',position:{x:679.35,y:24.3,z:-1500},yaw:Math.PI/2,width:23,height:1.05,mounted:true});
    signs.push({id:'aster-paddock',name:'ASTER  /  TEAM PADDOCK',position:{x:540,y:20,z:-1415.5},yaw:0,width:7,height:1.15,mounted:true});
    for(const x of [536.6,543.4])roofs.box(x,17,-1415.5,.12,3.65,.12);
  }
  if(cx===3&&cz===-6)signs.push({id:'aster-control',name:'ASTER   /   RACE CONTROL',position:{x:768,y:34.12,z:-1443.94},yaw:0,width:14.5,height:.38,mounted:true});
  buildStreetscape(cx,cz,{wall:buildings,roof:roofs,glass:windows},instances);
  buildRuralInfrastructure(cx,cz,{wall:buildings,roof:roofs,glass:windows},rural);
  buildIndustrialSetting(cx,cz,{wall:buildings,roof:roofs,glass:windows});
  add('structures',buildings,'wall',true);add('roofs',roofs,'roof',true);add('windows',windows,'glass');add('city-pavement',pavement,'wall');add('rural-infrastructure',rural,'trunk');
  return {manifest,meshes,instances,signs,bytes:meshes.reduce((sum,m)=>sum+meshBytes(m.data),0)};
}
export function blueprintTransfers(blueprint:CellBlueprint):ArrayBuffer[]{return blueprint.meshes.flatMap(m=>[m.data.positions.buffer,m.data.indices.buffer,m.data.uvs.buffer,m.data.normals.buffer,...(m.data.colors?[m.data.colors.buffer]:[])] as ArrayBuffer[]);}
