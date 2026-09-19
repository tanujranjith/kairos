import {Mesh,VertexData,Vector3} from '@babylonjs/core';
import {buildArchitecture,type BuildingStyle} from '../world/architecture';
import {MeshDataBuilder} from '../world/mesh-data';

/** Test-only camera study; imported by the browser verifier, never by the production application. */
export async function inspectArchitecture(){
  const g=window.kairos!;await g.action('home');await g.startDrive();g.save.settings.time=15;g.save.settings.weather='Clear';g.wetness=0;await g.advanceTime(0);
  g.world.root.setEnabled(false);g.visual.root.setEnabled(false);const scene=g.renderer.scene;
  for(const [i,style]of (['brick','limestone','office','factory','house'] as BuildingStyle[]).entries()){
    const b={wall:new MeshDataBuilder(),roof:new MeshDataBuilder(),glass:new MeshDataBuilder()};buildArchitecture(b,{x:(i-2)*32,y:0,z:0,width:21,depth:16,height:style==='factory'?8:style==='office'?28:17,yaw:0,style,seed:i});
    for(const [kind,data]of Object.entries(b)){const mesh=new Mesh('architecture-study-'+i+'-'+kind,scene),v=new VertexData();Object.assign(v,data.finish());v.applyToMesh(mesh);mesh.material=scene.getMaterialByName(kind==='wall'?'stone-buildings':kind==='roof'?'roof-metal':'architectural-glass');}
  }
  const camera=g.renderer.camera;camera.position.set(78,35,-105);camera.setTarget(new Vector3(0,9,0));camera.fov=.95;await scene.whenReadyAsync();for(let i=0;i<12;i++)scene.render();
}
