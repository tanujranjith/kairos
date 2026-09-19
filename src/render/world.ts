import { Scene,Mesh,MeshBuilder,VertexData,StandardMaterial,PBRMaterial,Color3,Vector3,Matrix,Quaternion,Material,DynamicTexture,TransformNode } from '@babylonjs/core';
import type { PhysicsBody,PhysicsShape } from '@babylonjs/core';
import { CELL_SIZE,landHeight,LAKE } from '../content/world';
import { createVegetation } from './vegetation';
import { surfaceTextures } from './surface-textures';
import type { PhysicsWorld } from '../sim/physics';
import type { V3,Quality } from '../core/types';
import { createHandlingCell } from './handling-course';
import { Geometry } from './geometry';
import { TrafficScenery,type SignalMesh } from './traffic';
import { buildCellBlueprint,type CellBlueprint,type CellMesh } from '../world/cell-blueprint';
import { CellStreamer } from '../world/cell-streamer';
import { CellWorkerClient } from '../world/worker-client';
import { cellCoordinates,cellKey,planCells,type CellDemand,type StreamActor,type StreamingProfile } from '../world/cell-manifest';
import { ResourcePool } from '../world/resource-pool';

interface Cell {key:string;cx:number;cz:number;meshes:Mesh[];collisionMeshes:Mesh[];detailMeshes:Mesh[];colliders:{body:PhysicsBody;shape:PhysicsShape}[];signals:SignalMesh[];collision:boolean;detail:boolean;leases:Map<Mesh,{release:()=>void}>}
export class WorldRenderer {
  cells=new Map<string,Cell>();root:TransformNode;backdrop:Mesh;water:Mesh;
  private terrain:PBRMaterial;private road:PBRMaterial;private shoulder:PBRMaterial;private marking:PBRMaterial;private yellow:PBRMaterial;private curb:PBRMaterial;private wall:PBRMaterial;private roof:PBRMaterial;private glass:PBRMaterial;private foliage:PBRMaterial;private trunk:PBRMaterial;
  private treeMesh:Mesh;private oakMesh:Mesh;private trunkMesh:Mesh;private boulders:Mesh;
  private quality:Quality='Low';private enabled=true;private trafficScenery:TrafficScenery;
  private worker=new CellWorkerClient();streamer:CellStreamer<CellBlueprint,Cell>;
  private materialPool=new ResourcePool<Material>(m=>m.dispose(false,true));private rootLeases=new Map<number,{release:()=>void}>();
  private warm=new Map<string,{demand:CellDemand;until:number}>();private demand=new Map<string,CellDemand>();private profile:StreamingProfile='exploration';
  constructor(public scene:Scene,public physics:PhysicsWorld){
    this.root=new TransformNode('world',scene);
    this.streamer=new CellStreamer({load:(d,signal)=>this.worker.build(d.cx,d.cz,this.quality,signal),install:(b,d)=>this.installCell(b,d),mode:(cell,b,d)=>this.setCellMode(cell,b,d),dispose:cell=>this.disposeCell(cell)});
    this.trafficScenery=new TrafficScenery(scene);
    const mat=(name:string,hex:string)=>{const m=new PBRMaterial(name,scene);m.albedoColor=Color3.FromHexString(hex);m.roughness=.97;m.metallic=0;return m;};
    this.terrain=mat('meadow','#777c48');this.shoulder=mat('gravel','#9f967a');this.marking=mat('road-paint','#e8e4d1');this.yellow=mat('centerline','#d6b96d');this.curb=mat('red-curbs','#a94435');this.wall=mat('stone-buildings','#c2ba9f');this.roof=mat('roof-metal','#555b59');this.glass=mat('architectural-glass','#344c54');this.foliage=mat('pine-needles','#344b2f');this.trunk=mat('tree-bark','#594939');
    // A millimetric physical separation alone loses depth precision at long range.
    // Raster bias keeps paint above the asphalt without moving contact geometry.
    for(const paint of [this.marking,this.yellow,this.curb]){paint.zOffset=-2;paint.zOffsetUnits=-2;}
    this.road=mat('asphalt','#ffffff');
    for(const [material,kind,scale] of [[this.road,'asphalt',3],[this.terrain,'meadow',1],[this.shoulder,'gravel',4],[this.wall,'concrete',1],[this.roof,'stone',1]] as const){
      const maps=surfaceTextures(scene,kind,scale);material.albedoColor=Color3.White();material.albedoTexture=maps.albedo;material.bumpTexture=maps.normal;material.bumpTexture.level=kind==='meadow'?.55:.35;
    }
    this.road.roughness=.94;this.road.metallic=0;this.glass.albedoColor=Color3.FromHexString('#223840').toLinearSpace();this.glass.metallic=.35;this.glass.roughness=.19;
    const vegetation=createVegetation(scene);this.treeMesh=vegetation.tree;this.oakMesh=vegetation.oak;this.trunkMesh=vegetation.trunk;this.foliage=vegetation.foliage;this.trunk=vegetation.bark;
    const rockMat=mat('weathered-rock','#ffffff'),rockMaps=surfaceTextures(scene,'concrete');rockMat.albedoTexture=rockMaps.albedo;rockMat.bumpTexture=rockMaps.normal;
    this.boulders=MeshBuilder.CreateSphere('rock-source',{diameter:5,segments:8},scene);const rockPos=this.boulders.getVerticesData('position')!;
    for(let i=0;i<rockPos.length;i+=3){const x=rockPos[i],y=rockPos[i+1],z=rockPos[i+2],n=1+.17*Math.sin(x*2.1+z*.7)*Math.cos(y*1.9);rockPos[i]*=n;rockPos[i+1]*=n*.65;rockPos[i+2]*=n;}this.boulders.updateVerticesData('position',rockPos);this.boulders.material=rockMat;this.boulders.isVisible=false;
    const geom=new Geometry(),step=60;for(let x=-5000;x<5000;x+=step)for(let z=-5000;z<5000;z+=step){const height=(xx:number,zz:number)=>{if(Math.abs(xx)<2100&&Math.abs(zz)<2100)return landHeight(xx,zz)-8;const rim=Math.max(Math.abs(xx),Math.abs(zz));const mountains=(Math.sin(xx*.0021)*Math.cos(zz*.0018)+1.3)*Math.max(0,rim-2000)*.09;return landHeight(xx,zz)+mountains-10;};geom.quad({x,y:height(x,z),z},{x:x+step,y:height(x+step,z),z},{x,y:height(x,z+step),z:z+step},{x:x+step,y:height(x+step,z+step),z:z+step});}const ridgeMat=mat('atmospheric-ridges','#607280');ridgeMat.albedoColor=ridgeMat.albedoColor.toLinearSpace();this.backdrop=geom.mesh('valley-horizon',scene,ridgeMat)!;this.backdrop.parent=this.root;
    this.water=MeshBuilder.CreateGround('lake',{width:LAKE.rx*2.06,height:LAKE.rz*2.06,subdivisions:1},scene);this.water.position.set(LAKE.x,LAKE.level,LAKE.z);this.water.parent=this.root;const water=new PBRMaterial('lake-water',scene);water.albedoColor=new Color3(.15,.29,.32);water.metallic=.6;water.roughness=.19;this.water.material=water;
  }

  setEnabled(v:boolean){this.enabled=v;this.root.setEnabled(v);}
  setQuality(q:Quality){if(q===this.quality)return;this.clear();this.quality=q;}
  setWetness(v:number){this.road.roughness=.94-v*.70;this.road.albedoColor.set(1-v*.40,1-v*.40,1-v*.40);}
  updateSignals(clock:number){for(const cell of this.cells.values()){if(cell.detail)this.trafficScenery.update(cell.signals,clock);else for(const signal of cell.signals)signal.mesh.isVisible=false;}}
  private around(position:V3,detail=true){const {cx,cz}=cellCoordinates(position),result:CellDemand[]=[];for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){const x=cx+dx,z=cz+dz;if(x< -9||x>8||z< -9||z>8)continue;result.push({id:cellKey(x,z),cx:x,cz:z,priority:-1200+dx*dx+dz*dz,collision:true,detail,owners:new Set(['warmup'])});}return result;}
  private commitDemand(){
    const combined=new Map<string,CellDemand>();for(const [key,d]of this.demand)combined.set(key,{...d,owners:new Set(d.owners)});
    for(const [key,w]of this.warm){if(w.until<Date.now()){this.warm.delete(key);continue;}const d=combined.get(key);if(d){d.collision=true;d.detail ||= w.demand.detail;d.priority=Math.min(d.priority,w.demand.priority);d.owners.add('warmup');}else combined.set(key,w.demand);}
    this.streamer.setDemand(combined);
  }
  requestAround(position:V3,detail=false){const entries=this.around(position,detail);for(const d of entries)this.warm.set(d.id,{demand:d,until:Date.now()+3000});this.commitDemand();return entries.map(d=>d.id);}
  async loadAround(position:V3,detail=true){const keys=this.requestAround(position,detail);await this.streamer.waitFor(keys);}
  async prepare(profile:StreamingProfile,positions:V3[]){
    this.profile=profile;const first=positions[0],zero={x:0,y:0,z:0};
    this.demand=planCells({id:'player',position:first,velocity:zero},positions.slice(1).map((position,i)=>({id:'spawn-'+i,position,velocity:zero})),this.quality,profile);this.commitDemand();
    await this.streamer.waitFor([...this.demand.values()].filter(d=>d.collision).map(d=>d.id));
  }
  /** Only validation rigs use immediate construction; live gameplay uses worker requests and readiness gates. */
  ensure(position:V3){for(const d of this.around(position)){this.warm.set(d.id,{demand:d,until:Date.now()+3000});if(!this.streamer.has(d.id,true))this.streamer.adopt(d,buildCellBlueprint(d.cx,d.cz,this.quality));}}
  update(position:V3,velocity:V3,protectedActors:(V3|StreamActor)[]=[]){
    if(!this.enabled)return;
    const others=protectedActors.map((p,i)=>'position' in p?p:{id:'actor-'+i,position:p,velocity:{x:0,y:0,z:0}});
    this.demand=planCells({id:'player',position,velocity},others,this.quality,this.profile);this.commitDemand();
  }
  hasSurface(position:V3){const c=cellCoordinates(position);return this.streamer.has(cellKey(c.cx,c.cz),true);}
  readyAround(position:V3){return this.around(position,false).every(d=>this.streamer.has(d.id,true));}
  readyFor(positions:V3[]){let ready=true;for(const p of positions)if(!this.readyAround(p)){ready=false;this.requestAround(p,false);}return ready;}
  async waitForSurfaces(positions:V3[]){const keys=new Set<string>();for(const p of positions)for(const key of this.requestAround(p,false))keys.add(key);await this.streamer.waitFor([...keys]);}
  retry(){this.streamer.retry();}
  private register(cell:Cell,mesh:Mesh|null,collision=false,detail=false){
    if(!mesh)return;mesh.parent=this.root;cell.meshes.push(mesh);if(collision)cell.collisionMeshes.push(mesh);if(detail)cell.detailMeshes.push(mesh);
    if(mesh.material&&!mesh.metadata?.ownedMaterial){const material=mesh.material,key='material-'+material.uniqueId;if(!this.rootLeases.has(material.uniqueId))this.rootLeases.set(material.uniqueId,this.materialPool.acquire(key,()=>material));cell.leases.set(mesh,this.materialPool.acquire(key,()=>material));}
  }
  private fromData(part:CellMesh){const mesh=new Mesh(part.name,this.scene),data=new VertexData();data.positions=part.data.positions;data.indices=part.data.indices;data.normals=part.data.normals;data.uvs=part.data.uvs;if(part.data.colors)data.colors=part.data.colors;data.applyToMesh(mesh);mesh.material=this[part.material];mesh.receiveShadows=true;mesh.isPickable=false;mesh.metadata={worldCaster:part.name.startsWith('structures')||part.name.startsWith('roofs')};return mesh;}
  private installCell(blueprint:CellBlueprint,demand:CellDemand){
    const {id:key,cx,cz,bounds}=blueprint.manifest,cell:Cell={key,cx,cz,meshes:[],collisionMeshes:[],detailMeshes:[],colliders:[],signals:[],collision:false,detail:false,leases:new Map()};
    try{
      for(const part of blueprint.meshes)if(part.collision)this.register(cell,this.fromData(part),true);
      const attach=(mesh:Mesh|null,collision=false)=>this.register(cell,mesh,collision);
      createHandlingCell(this.scene,bounds,{road:this.road,white:this.marking,red:this.curb,dark:this.roof},attach);
      cell.signals=this.trafficScenery.createCell(cx,cz,{road:this.road,white:this.marking,dark:this.roof},attach);
      this.setCellMode(cell,blueprint,demand);this.cells.set(key,cell);return cell;
    }catch(error){this.disposeCell(cell);throw error;}
  }
  private setCellMode(cell:Cell,blueprint:CellBlueprint,demand:CellDemand){
    if(demand.collision&&!cell.collision){for(const mesh of cell.collisionMeshes)cell.colliders.push(this.physics.addStaticMesh(mesh));cell.collision=true;}
    else if(!demand.collision&&cell.collision){for(const c of cell.colliders){c.body.dispose();c.shape.dispose();}cell.colliders=[];cell.collision=false;}
    if(demand.detail&&!cell.detail){
      for(const part of blueprint.meshes)if(!part.collision)this.register(cell,this.fromData(part),false,true);
      for(const kind of ['pine','oak','trunk','rock'] as const){const entries=blueprint.instances.filter(i=>i.kind===kind);if(!entries.length)continue;const source=kind==='pine'?this.treeMesh:kind==='oak'?this.oakMesh:kind==='trunk'?this.trunkMesh:this.boulders,mesh=source.clone(kind+'-'+cell.key,this.root)!;mesh.makeGeometryUnique();const buffer=new Float32Array(entries.length*16);entries.forEach((entry,i)=>Matrix.Compose(new Vector3(entry.scale.x,entry.scale.y,entry.scale.z),Quaternion.RotationYawPitchRoll(entry.yaw,0,0),new Vector3(entry.position.x,entry.position.y,entry.position.z)).copyToArray(buffer,i*16));mesh.thinInstanceSetBuffer('matrix',buffer,16,true);mesh.thinInstanceRefreshBoundingInfo(true);mesh.isPickable=false;mesh.receiveShadows=true;mesh.metadata={worldCaster:kind!=='trunk'};this.register(cell,mesh,false,true);}
      for(const entry of blueprint.signs){const {x,y,z}=entry.position,pole=MeshBuilder.CreateCylinder('signpost-'+entry.id,{diameter:.12,height:3.4,tessellation:6},this.scene);pole.position.set(x,y+1.7,z);pole.material=this.roof;this.register(cell,pole,false,true);
        const sign=MeshBuilder.CreatePlane('sign-'+entry.id,{width:5.5,height:1.45,sideOrientation:Mesh.DOUBLESIDE},this.scene);sign.position.set(x,y+3.05,z);sign.rotation.y=entry.yaw;const material=new StandardMaterial('signmat-'+entry.id,this.scene),texture=new DynamicTexture('signtext-'+entry.id,{width:512,height:128},this.scene,false);texture.drawText(entry.name.toUpperCase(),null,77,'bold 30px sans-serif','#e4ede0','#28443e',true);material.diffuseTexture=texture;material.emissiveColor.set(.12,.12,.12);sign.material=material;sign.metadata={ownedMaterial:true};this.register(cell,sign,false,true);}
    }else if(!demand.detail&&cell.detail){for(const mesh of [...cell.detailMeshes])this.disposeMesh(cell,mesh);cell.detailMeshes=[];}
    cell.detail=demand.detail;for(const mesh of cell.meshes)mesh.isVisible=demand.detail;
    // Signal aspects, not the general visibility switch, decide which lens is lit.
    for(const signal of cell.signals)signal.mesh.isVisible=false;
  }
  private disposeMesh(cell:Cell,mesh:Mesh){if(mesh.metadata?.ownedMaterial)mesh.material?.dispose(false,true);cell.leases.get(mesh)?.release();cell.leases.delete(mesh);mesh.dispose();const index=cell.meshes.indexOf(mesh);if(index>=0)cell.meshes.splice(index,1);}
  private disposeCell(cell:Cell){for(const c of cell.colliders){c.body.dispose();c.shape.dispose();}cell.colliders=[];for(const mesh of [...cell.meshes])this.disposeMesh(cell,mesh);if(this.cells.get(cell.key)===cell)this.cells.delete(cell.key);}
  clear(){this.warm.clear();this.demand.clear();this.streamer.clear();this.worker.close();}
  snapshot(){return {...this.streamer.snapshot(),profile:this.profile,collisionCells:[...this.cells.values()].filter(c=>c.collision).length,detailCells:[...this.cells.values()].filter(c=>c.detail).length,blueprintBytes:[...this.streamer.records.values()].reduce((sum,r)=>sum+(r.blueprint?.bytes??0),0),materials:this.materialPool.snapshot()};}
}
