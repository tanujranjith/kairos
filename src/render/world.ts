import { Scene, Mesh, MeshBuilder, VertexData, StandardMaterial, PBRMaterial, Color3, Vector3, Matrix, Quaternion, Material, DynamicTexture, TransformNode, Texture } from '@babylonjs/core';
import { CELL_SIZE, ROADS, LANDMARKS, terrainHeight, landHeight, nearestRoad, inLake, LAKE } from '../content/world';
import { hash, rng, clamp } from '../core/math';
import type { PhysicsWorld } from '../sim/physics';
import type { PhysicsBody, PhysicsShape } from '@babylonjs/core';
import type { V3, Quality } from '../core/types';

class Geometry {
  positions:number[]=[];indices:number[]=[];uvs:number[]=[];colors:number[]=[];
  quad(a:V3,b:V3,c:V3,d:V3,color?:number[]){const n=this.positions.length/3;for(const p of [a,b,c,d]){this.positions.push(p.x,p.y,p.z);this.uvs.push(p.x/12,p.z/12);if(color)this.colors.push(...color);}this.indices.push(n,n+2,n+1,n+1,n+2,n+3);}
  box(x:number,y:number,z:number,w:number,h:number,l:number,yaw=0){const n=this.positions.length/3,cos=Math.cos(yaw),sin=Math.sin(yaw);for(const [dx,dy,dz]of [[-w/2,0,-l/2],[w/2,0,-l/2],[-w/2,h,-l/2],[w/2,h,-l/2],[-w/2,0,l/2],[w/2,0,l/2],[-w/2,h,l/2],[w/2,h,l/2]]){this.positions.push(x+dx*cos+dz*sin,y+dy,z-dx*sin+dz*cos);this.uvs.push(dx/5,dy/5);}for(const face of [[0,2,1,1,2,3],[4,5,6,5,7,6],[0,4,2,4,6,2],[1,3,5,3,7,5],[2,6,3,3,6,7],[0,1,4,1,5,4]])for(const i of face)this.indices.push(n+i);}
  mesh(name:string,scene:Scene,mat:Material){if(!this.positions.length)return null;for(let i=0;i<this.indices.length;i+=3){const swap=this.indices[i+1];this.indices[i+1]=this.indices[i+2];this.indices[i+2]=swap;}const mesh=new Mesh(name,scene),data=new VertexData(),normals:number[]=[];VertexData.ComputeNormals(this.positions,this.indices,normals);data.positions=this.positions;data.indices=this.indices;data.normals=normals;data.uvs=this.uvs;if(this.colors.length)data.colors=this.colors;data.applyToMesh(mesh);mesh.material=mat;mesh.receiveShadows=true;mesh.isPickable=false;return mesh;}
}
interface Cell {key:string;cx:number;cz:number;meshes:Mesh[];colliders:{body:PhysicsBody;shape:PhysicsShape}[]}
export class WorldRenderer {
  cells=new Map<string,Cell>();root:TransformNode;backdrop:Mesh;water:Mesh;
  private terrain:PBRMaterial;private road:PBRMaterial;private shoulder:PBRMaterial;private marking:PBRMaterial;private yellow:PBRMaterial;private curb:PBRMaterial;private wall:PBRMaterial;private roof:PBRMaterial;private glass:PBRMaterial;private foliage:PBRMaterial;private trunk:PBRMaterial;
  private treeMesh:Mesh;private trunkMesh:Mesh;private boulders:Mesh;private queue:{cx:number;cz:number;priority:number}[]=[];private center='';
  private roadCells=new Map<string,{road:typeof ROADS[number];index:number}[]>();
  private quality:Quality='Low';private enabled=true;
  constructor(public scene:Scene,public physics:PhysicsWorld){
    this.root=new TransformNode('world',scene);
    const mat=(name:string,hex:string)=>{const m=new PBRMaterial(name,scene);m.albedoColor=Color3.FromHexString(hex);m.roughness=.97;m.metallic=0;return m;};
    this.terrain=mat('meadow','#777c48');this.shoulder=mat('gravel','#9f967a');this.marking=mat('road-paint','#e8e4d1');this.yellow=mat('centerline','#d6b96d');this.curb=mat('red-curbs','#a94435');this.wall=mat('stone-buildings','#c2ba9f');this.roof=mat('roof-metal','#555b59');this.glass=mat('architectural-glass','#344c54');this.foliage=mat('pine-needles','#344b2f');this.trunk=mat('tree-bark','#594939');
    const tex=new DynamicTexture('asphalt-noise',256,scene,true),ctx=tex.getContext(),random=rng(18);ctx.fillStyle='#777777';ctx.fillRect(0,0,256,256);for(let i=0;i<22000;i++){const v=90+random()*70;ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.fillRect(random()*256,random()*256,1,1);}tex.update();tex.uScale=1;tex.vScale=1;tex.anisotropicFilteringLevel=8;
    tex.wrapU=tex.wrapV=Texture.WRAP_ADDRESSMODE;
    this.road=new PBRMaterial('asphalt',scene);this.road.albedoColor=new Color3(.31,.33,.32);this.road.albedoTexture=tex;this.road.roughness=.92;this.road.metallic=.04;
    const grass=new DynamicTexture('meadow-detail',256,scene,true),gctx=grass.getContext(),grassRandom=rng(19);gctx.fillStyle='#9ba374';gctx.fillRect(0,0,256,256);for(let i=0;i<18000;i++){const green=95+grassRandom()*85;gctx.fillStyle=`rgba(${green*.9},${green},${green*.63},.4)`;gctx.fillRect(grassRandom()*256,grassRandom()*256,1,1+grassRandom()*3);}grass.update();grass.anisotropicFilteringLevel=8;this.terrain.albedoTexture=grass;this.terrain.albedoColor=Color3.FromHexString('#b2bda0');
    grass.wrapU=grass.wrapV=Texture.WRAP_ADDRESSMODE;
    const crowns:Mesh[]=[];for(let layer=0;layer<4;layer++){const crown=MeshBuilder.CreateCylinder('pine-crown',{diameterTop:0,diameterBottom:7-layer*1.35,height:7-layer*.8,tessellation:10},scene);crown.position.y=-3+layer*2.5;crown.material=this.foliage;crowns.push(crown);}this.treeMesh=Mesh.MergeMeshes(crowns,true,true)!;this.treeMesh.name='pine-source';this.treeMesh.material=this.foliage;this.treeMesh.isVisible=false;
    this.trunkMesh=MeshBuilder.CreateCylinder('trunk-source',{diameter:.55,height:7,tessellation:5},scene);this.trunkMesh.material=this.trunk;this.trunkMesh.isVisible=false;
    this.boulders=MeshBuilder.CreateIcoSphere('rock-source',{radius:3,subdivisions:1},scene);this.boulders.material=this.shoulder;this.boulders.isVisible=false;
    for(const road of ROADS)for(let i=0;i<road.points.length-1;i++){const p=road.points[i],q=road.points[i+1];const key=this.key(Math.floor((p.x+q.x)*.5/CELL_SIZE),Math.floor((p.z+q.z)*.5/CELL_SIZE));const entries=this.roadCells.get(key)??[];entries.push({road,index:i});this.roadCells.set(key,entries);}
    const geom=new Geometry(),step=100;for(let x=-5000;x<5000;x+=step)for(let z=-5000;z<5000;z+=step){const height=(xx:number,zz:number)=>{if(Math.abs(xx)<2100&&Math.abs(zz)<2100)return landHeight(xx,zz)-8;const rim=Math.max(Math.abs(xx),Math.abs(zz));const mountains=(Math.sin(xx*.0021)*Math.cos(zz*.0018)+1.3)*Math.max(0,rim-2000)*.16;return landHeight(xx,zz)+mountains-10;};geom.quad({x,y:height(x,z),z},{x:x+step,y:height(x+step,z),z},{x,y:height(x,z+step),z:z+step},{x:x+step,y:height(x+step,z+step),z:z+step});}this.backdrop=geom.mesh('valley-horizon',scene,this.terrain)!;this.backdrop.parent=this.root;
    this.water=MeshBuilder.CreateGround('lake',{width:LAKE.rx*2.06,height:LAKE.rz*2.06,subdivisions:1},scene);this.water.position.set(LAKE.x,LAKE.level,LAKE.z);this.water.parent=this.root;const water=new PBRMaterial('lake-water',scene);water.albedoColor=new Color3(.15,.29,.32);water.metallic=.6;water.roughness=.19;this.water.material=water;
  }
  private key(cx:number,cz:number){return `${cx},${cz}`;}
  setEnabled(v:boolean){this.enabled=v;this.root.setEnabled(v);}
  setQuality(q:Quality){if(q===this.quality)return;this.clear();this.quality=q;this.center='';}
  setWetness(v:number){this.road.roughness=.92-v*.72;this.road.albedoColor.set(.31-v*.12,.33-v*.12,.32-v*.11);}
  ensure(position:V3){const cx=Math.floor(position.x/CELL_SIZE),cz=Math.floor(position.z/CELL_SIZE);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)this.createCell(cx+dx,cz+dz);}
  update(position:V3,velocity:V3,protectedPositions:V3[]=[]){
    if(!this.enabled)return;
    const cx=Math.floor(position.x/CELL_SIZE),cz=Math.floor(position.z/CELL_SIZE),center=this.key(cx,cz);const radius=this.quality==='Low'?2:this.quality==='Ultra'?4:3;
    if(center!==this.center){this.center=center;this.queue=[];
      for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){const xx=cx+dx,zz=cz+dz;if(!this.cells.has(this.key(xx,zz)))this.queue.push({cx:xx,cz:zz,priority:dx*dx+dz*dz-(dx*velocity.x+dz*velocity.z)*.02});}
      this.queue.sort((a,b)=>a.priority-b.priority);
      for(const [key,cell]of this.cells)if((Math.abs(cell.cx-cx)>radius+1||Math.abs(cell.cz-cz)>radius+1)&&!protectedPositions.some(p=>Math.abs(Math.floor(p.x/CELL_SIZE)-cell.cx)<=1&&Math.abs(Math.floor(p.z/CELL_SIZE)-cell.cz)<=1)){this.disposeCell(cell);this.cells.delete(key);}
    }
    const forward={x:position.x+velocity.x*6,y:0,z:position.z+velocity.z*6};const fx=Math.floor(forward.x/CELL_SIZE),fz=Math.floor(forward.z/CELL_SIZE);
    if(!this.cells.has(this.key(fx,fz)))this.createCell(fx,fz);
    const next=this.queue.shift();if(next)this.createCell(next.cx,next.cz);
  }
  hasSurface(position:V3){return this.cells.has(this.key(Math.floor(position.x/CELL_SIZE),Math.floor(position.z/CELL_SIZE)));}
  private createCell(cx:number,cz:number){
    const key=this.key(cx,cz);if(this.cells.has(key)||cx< -9||cx>8||cz< -9||cz>8)return;
    const cell:Cell={key,cx,cz,meshes:[],colliders:[]},x0=cx*CELL_SIZE,z0=cz*CELL_SIZE;this.cells.set(key,cell);
    const attach=(mesh:Mesh|null,collision=false)=>{if(!mesh)return;mesh.parent=this.root;cell.meshes.push(mesh);if(collision)cell.colliders.push(this.physics.addStaticMesh(mesh));};
    const terrain=new Geometry(),step=16;
    for(let x=x0;x<x0+CELL_SIZE;x+=step)for(let z=z0;z<z0+CELL_SIZE;z+=step)terrain.quad({x,y:terrainHeight(x,z),z},{x:x+step,y:terrainHeight(x+step,z),z},{x,y:terrainHeight(x,z+step),z:z+step},{x:x+step,y:terrainHeight(x+step,z+step),z:z+step});
    attach(terrain.mesh(`terrain-${key}`,this.scene,this.terrain),true);
    const asphalt=new Geometry(),verge=new Geometry(),white=new Geometry(),yellow=new Geometry(),curbs=new Geometry(),rails=new Geometry(),buildings=new Geometry(),roofs=new Geometry(),windows=new Geometry();
    for(const {road,index}of this.roadCells.get(key)??[]){const a=road.points[index],b=road.points[index+1];const strip=(g:Geometry,offset:number,width:number,y=.0)=>{const p=(v:typeof a,o:number)=>({x:v.x+Math.cos(v.yaw)*o,y:v.y+y,z:v.z-Math.sin(v.yaw)*o});g.quad(p(a,offset-width/2),p(a,offset+width/2),p(b,offset-width/2),p(b,offset+width/2));};
      strip(asphalt,0,road.width,.025);strip(verge,0,road.width+3,-.015);
      for(const side of [-1,1])strip(white,side*(road.width*.5-.22),.13,.046);
      if(road.kind==='circuit'){if(index%2===0)for(const side of [-1,1])strip(curbs,side*(road.width*.5+.4),.85,.045);}
      else if(road.kind!=='pit'&&road.kind!=='test'){
        if(index%3!==0)strip(road.kind==='highway'?white:yellow,0,.12,.046);
        if(road.lanes===4&&index%3!==0)for(const side of [-1,1])strip(white,side*road.width*.25,.12,.046);
      }
      if((road.kind==='highway'||a.z>950||inLake(a.x,a.z))&&index%2===0){for(const side of [-1,1]){const offset=side*(road.width*.5+1);const x=a.x+Math.cos(a.yaw)*offset,z=a.z-Math.sin(a.yaw)*offset;rails.box(x,a.y+.65,z,.13,.30,16,a.yaw);rails.box(x,a.y,z,.13,.95,.13,a.yaw);}}
      // Lake crossing is a real elevated deck with piers over lower terrain.
      if(inLake(a.x,a.z)&&index%5===0){rails.box(a.x,a.y-1,a.z,road.width,.85,9,a.yaw);buildings.box(a.x,2,a.z,2,a.y-3,3,a.yaw);}
      if(road.id==='pass'&&a.s>2350&&a.s<2630&&index%3===0){for(const side of [-1,1])buildings.box(a.x+Math.cos(a.yaw)*side*6,a.y,a.z-Math.sin(a.yaw)*side*6,1,6,25,a.yaw);roofs.box(a.x,a.y+6,a.z,13,1,25,a.yaw);}
    }
    attach(verge.mesh(`verge-${key}`,this.scene,this.shoulder));attach(asphalt.mesh(`roads-${key}`,this.scene,this.road),true);attach(white.mesh(`paint-${key}`,this.scene,this.marking));attach(yellow.mesh(`center-${key}`,this.scene,this.yellow));attach(curbs.mesh(`curbs-${key}`,this.scene,this.curb));attach(rails.mesh(`guardrails-${key}`,this.scene,this.roof),true);
    const random=rng(hash(cx,cz)),trees:Matrix[]=[],trunks:Matrix[]=[],rocks:Matrix[]=[];
    const count={Low:32,Medium:48,High:65,Ultra:90}[this.quality];
    for(let i=0;i<count;i++){
      const x=x0+random()*CELL_SIZE,z=z0+random()*CELL_SIZE,near=nearestRoad(x,z,undefined,1);if(inLake(x,z)||near.distance<near.road.width*.5+5)continue;const y=terrainHeight(x,z);
      const city=x< -650&&z< -650,industrial=x< -850&&z< -300&&z> -780,circuit=x>300&&z< -450;
      if((city||industrial)&&near.distance<95&&i%2===0){const h=city?7+random()*30:8+random()*9,w=12+random()*13,l=12+random()*16;buildings.box(x,y,z,w,h,l);roofs.box(x,y+h,z,w+1,.6,l+1);for(let level=4;level<h-1;level+=3.3){windows.box(x,y+level,z-l*.5-.025,w*.83,1.35,.05);windows.box(x-w*.5-.025,y+level,z,.05,1.35,l*.82);}}
      else if(!circuit&&!industrial){const s=.6+random()*.95,yaw=random()*Math.PI;trees.push(Matrix.Compose(new Vector3(s,s,s),Quaternion.RotationYawPitchRoll(yaw,0,0),new Vector3(x,y+8*s,z)));trunks.push(Matrix.Compose(new Vector3(s,s,s),Quaternion.Identity(),new Vector3(x,y+3.5*s,z)));if(i%5===0)rocks.push(Matrix.Compose(new Vector3(s*1.5,s*.7,s),Quaternion.RotationYawPitchRoll(yaw,0,0),new Vector3(x+5,y+.5,z+3)));}
    }
    const instance=(source:Mesh,matrices:Matrix[],label:string)=>{if(!matrices.length)return;const m=source.clone(`${label}-${key}`,this.root)!;m.makeGeometryUnique();m.isVisible=true;const buffer=new Float32Array(matrices.length*16);matrices.forEach((v,i)=>v.copyToArray(buffer,i*16));m.thinInstanceSetBuffer('matrix',buffer,16,true);m.thinInstanceRefreshBoundingInfo(true);m.isPickable=false;cell.meshes.push(m);};instance(this.treeMesh,trees,'pines');instance(this.trunkMesh,trunks,'trunks');instance(this.boulders,rocks,'rocks');
    for(const landmark of LANDMARKS){if(Math.floor(landmark.x/CELL_SIZE)!==cx||Math.floor(landmark.z/CELL_SIZE)!==cz)continue;const n=nearestRoad(landmark.x,landmark.z),x=n.point.x+Math.cos(n.point.yaw)*(n.road.width*.5+7),z=n.point.z-Math.sin(n.point.yaw)*(n.road.width*.5+7),y=terrainHeight(x,z);
      if(landmark.type==='service'||landmark.type==='garage'){buildings.box(x,y,z,12,4,8);roofs.box(x,y+4,z,16,.4,12);}
      const pole=MeshBuilder.CreateCylinder(`signpost-${landmark.id}`,{diameter:.12,height:3.4,tessellation:6},this.scene);pole.position.set(x,y+1.7,z);pole.material=this.roof;attach(pole);
      const sign=MeshBuilder.CreatePlane(`sign-${landmark.id}`,{width:5.5,height:1.45,sideOrientation:Mesh.DOUBLESIDE},this.scene);sign.position.set(x,y+3.05,z);sign.rotation.y=n.point.yaw;const sm=new StandardMaterial(`signmat-${landmark.id}`,this.scene),st=new DynamicTexture(`signtext-${landmark.id}`,{width:512,height:128},this.scene,false);st.drawText(landmark.name.toUpperCase(),null,77,'bold 30px sans-serif','#e4ede0','#28443e',true);sm.diffuseTexture=st;sm.emissiveColor=new Color3(.12,.12,.12);sign.material=sm;sign.metadata={ownedMaterial:true};attach(sign);
    }
    // Motorsport complex: garages, grandstand, pit boxes, and a timing gantry.
    if(cx>=2&&cx<=4&&cz===-6){const x=x0+128,y=17;buildings.box(x,y,-1436,230,9,19);windows.box(x,y+5,-1445.6,224,2.2,.06);roofs.box(x,y+9,-1436,236,.4,23);for(let i=0;i<12;i++){windows.box(x-110+i*19,y,-1445.7,12,3.8,.06);}}
    if(cx===3&&cz===-7){buildings.box(900,17,-1540,190,3,28);for(let i=0;i<6;i++)roofs.box(900,20+i*.9,-1533-i*3,185,.6,2.6);for(const z of [-1512,-1488])buildings.box(680,17,z,1,8,1);roofs.box(680,25,-1500,1.5,1,25);}
    attach(buildings.mesh(`structures-${key}`,this.scene,this.wall),true);attach(roofs.mesh(`roofs-${key}`,this.scene,this.roof),true);attach(windows.mesh(`windows-${key}`,this.scene,this.glass));
  }
  private disposeCell(cell:Cell){cell.colliders.forEach(c=>{c.body.dispose();c.shape.dispose();});cell.meshes.forEach(m=>{if(m.metadata?.ownedMaterial)m.material?.dispose(false,true);m.dispose();});}
  clear(){for(const c of this.cells.values())this.disposeCell(c);this.cells.clear();this.queue=[];this.center='';}
}
