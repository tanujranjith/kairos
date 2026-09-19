import { describe,it,expect } from 'vitest';
import { NullEngine,Scene,PBRMaterial } from '@babylonjs/core';
import { surfacePixels } from '../src/render/surface-textures';
import { createCar } from '../src/render/car';
import { VEHICLES } from '../src/content/vehicles';
import { buildCellBlueprint,blueprintTransfers } from '../src/world/cell-blueprint';
import { roadCoachwork } from '../src/render/coachwork';
import { cameraMounts } from '../src/render/camera-mounts';
import { mountainMesh,mountainHeight,meadowColor } from '../src/world/landscape';
import { buildArchitecture,type BuildingStyle } from '../src/world/architecture';
import { MeshDataBuilder } from '../src/world/mesh-data';
import { cloudField,skyPixels,solarLighting,windowLighting } from '../src/render/atmosphere';
import { buildServicePavilion } from '../src/world/service-pavilion';

describe('original graphics assets',()=>{
  it('shares a lower warm evening sun and turns direct sunlight off at night',()=>{
    const noon=solarLighting(12),evening=solarLighting(17.4),night=solarLighting(0);expect(evening.elevation).toBeLessThan(noon.elevation*.25);expect(evening.golden).toBeGreaterThan(.5);expect(noon.golden).toBe(0);expect(night.daylight).toBe(0);
    for(const t of [0,6,12,17.4,22,24]){const s=solarLighting(t);expect(Math.hypot(s.direction.x,s.direction.y,s.direction.z)).toBeCloseTo(1,8);expect(s.daylight).toBeGreaterThanOrEqual(0);expect(s.daylight).toBeLessThanOrEqual(1);}
  });
  it('batches detailed service pavilions and their terrace with bounded original geometry',()=>{
    const b={wall:new MeshDataBuilder(),roof:new MeshDataBuilder(),glass:new MeshDataBuilder()},paving=new MeshDataBuilder();buildServicePavilion(b,paving,{x:0,y:12,z:0,yaw:0});let total=0;
    for(const g of [...Object.values(b),paving]){const data=g.finish();total+=data.indices.length/3;expect([...data.positions,...data.normals,...data.colors!].every(Number.isFinite)).toBe(true);expect(data.colors?.length).toBe(data.positions.length/3*4);for(let i=0;i<data.positions.length;i+=3){expect(Math.abs(data.positions[i])).toBeLessThanOrEqual(13.01);expect(Math.abs(data.positions[i+2])).toBeLessThanOrEqual(12.51);}}
    expect(total).toBeLessThan(2200);expect(b.glass.uvs.filter((_,i)=>i%2===0).every(u=>u===.75)).toBe(true);expect(paving.indices.length).toBeGreaterThan(0);
  });
  it('generates reproducible albedo and finite normalized normal maps',()=>{
    for(const kind of ['asphalt','meadow','concrete','stone','bark','gravel','water','cliff'] as const){const a=surfacePixels(kind,32),b=surfacePixels(kind,32);expect(a).toEqual(b);expect(a.color.length).toBe(32*32*4);expect(new Set(a.color).size).toBeGreaterThan(kind==='stone'?5:12);for(let i=0;i<a.normal.length;i+=4){const n=[0,1,2].map(c=>a.normal[i+c]/255*2-1);expect(Math.hypot(...n)).toBeCloseTo(1,1);expect(a.normal[i+3]).toBe(255);}}
  });
  it('six car generators preserve wheel pivots and finite mesh data at both detail levels',()=>{
    const engine=new NullEngine(),scene=new Scene(engine);
    try{for(const definition of VEHICLES){const counts:number[]=[];for(const lite of [false,true]){const car=createCar(scene,definition,undefined,lite);expect(car.wheels).toHaveLength(4);expect(car.wheels.every(w=>w.parent===car.root)).toBe(true);let vertices=0;for(const mesh of car.parts){const p=mesh.getVerticesData('position')!;expect(p.length%3).toBe(0);expect(p.every(Number.isFinite)).toBe(true);vertices+=mesh.getTotalVertices();}counts.push(vertices);car.dispose();}expect(counts[0]).toBeGreaterThan(counts[1]);expect(counts[0]).toBeLessThan(40000);}}
    finally{scene.dispose();engine.dispose();}
  });
  it('streams all colored terrain buffers by transfer without duplicate ownership',()=>{
    const blueprint=buildCellBlueprint(-2,0,'Low'),transfers=blueprintTransfers(blueprint);expect(new Set(transfers).size).toBe(transfers.length);expect(transfers.reduce((sum,b)=>sum+b.byteLength,0)).toBe(blueprint.bytes);const terrain=blueprint.meshes.find(m=>m.material==='terrain')!;expect(terrain.data.colors?.length).toBe(terrain.data.positions.length/3*4);expect(blueprint.instances.some(i=>i.kind==='oak')).toBe(true);
  });
  it('keeps body and roof normals outward, glazing separate, and silhouette at vehicle scale',()=>{
    const engine=new NullEngine(),scene=new Scene(engine),m=Object.fromEntries(['paint','glass','dark','chrome','light','tail'].map(k=>[k,new PBRMaterial(k,scene)])) as Record<'paint'|'glass'|'dark'|'chrome'|'light'|'tail',PBRMaterial>;
    try{for(const d of VEHICLES.filter(v=>v.class!=='FORMULA'))for(const lite of [false,true]){
      const car=roadCoachwork(scene,d,m,lite);for(const name of ['sculpted-coachwork','crowned-roof']){const mesh=car.parts.find(p=>p.name===name)!,p=mesh.getVerticesData('position')!,n=mesh.getVerticesData('normal')!;for(let i=0;i<p.length;i+=3)if(Math.abs(p[i])<.001)expect(n[i+1]).toBeGreaterThan(.70);}
      const roof=car.parts.find(p=>p.name==='crowned-roof')!,positions=roof.getVerticesData('position')!;const maxY=Math.max(...positions.filter((_,i)=>i%3===1));expect(Math.abs(maxY+.32+d.wheelRadius-d.height)).toBeLessThan(.025);
      expect(car.parts.some(p=>p.name==='panoramic-windscreen'&&p.material===m.glass)).toBe(true);expect(m.glass.alpha).toBeLessThan(1);car.parts.forEach(p=>p.dispose());
    }}finally{scene.dispose();engine.dispose();}
  });
  it('adds deterministic lightweight roadside dressing without adding collision geometry',()=>{
    const a=buildCellBlueprint(-2,0,'Low'),b=buildCellBlueprint(-2,0,'Low'),grass=a.instances.filter(i=>i.kind==='grass');expect(grass.length).toBeGreaterThan(0);expect(grass).toEqual(b.instances.filter(i=>i.kind==='grass'));expect(a.meshes.some(m=>m.name.includes('grass')&&m.collision)).toBe(false);
  });
  it('places enclosed cockpit eyes below the roof and hood/bumper cameras outside body panels',()=>{
    for(const d of VEHICLES){const mounts=cameraMounts(d);expect(mounts.hood.y).toBeGreaterThan(.24);expect(mounts.bumper.z).toBeGreaterThan(d.length/2+.20);if(d.class!=='FORMULA'){expect(mounts.cockpit.y).toBeLessThan(d.height-(.32+d.wheelRadius)-.10);expect(mounts.cockpit.y).toBeGreaterThan(.25);}}
  });
  it('keeps distant mountain geometry outside drivable terrain, upward facing and within its budget',()=>{
    const data=mountainMesh();expect(data.indices.length/3).toBeLessThanOrEqual(32000);expect(data.colors?.length).toBe(data.positions.length/3*4);
    for(let i=0;i<data.positions.length;i+=3){const x=data.positions[i],z=data.positions[i+2];expect(Math.max(Math.abs(x),Math.abs(z))).toBeGreaterThanOrEqual(2009.99);expect(data.normals[i+1]).toBeGreaterThan(0);expect(Number.isFinite(data.positions[i+1])).toBe(true);}
    expect(mountainHeight(2000,0)).toBeLessThan(0);expect(mountainHeight(0,2000)).toBeLessThan(0);
  });
  it('uses continuous nonrepeating meadow colours at cell boundaries',()=>{
    expect(meadowColor(256,100)).toEqual(meadowColor(256,100));expect(meadowColor(256,100)).not.toEqual(meadowColor(268,100));
    const a=meadowColor(255.999,100),b=meadowColor(256.001,100);expect(Math.max(...a.map((c,i)=>Math.abs(c-b[i])))).toBeLessThan(.001);
  });
  it('retains a recessed coarse valley floor beyond streamed cells without another render pass',()=>{
    const data=mountainMesh(()=>13);expect(data.indices.length/3).toBeLessThan(34000);let floor=0;for(let i=0;i<data.positions.length;i+=3)if(Math.abs(data.positions[i])<1900&&Math.abs(data.positions[i+2])<1900){expect(data.positions[i+1]).toBe(5);floor++;}expect(floor).toBeGreaterThan(1000);
  });
  it('produces five bounded architectural styles with complete finite transferable colour buffers',()=>{
    const counts=new Set<number>();for(const style of ['brick','limestone','office','factory','house'] as BuildingStyle[]){const b={wall:new MeshDataBuilder(),roof:new MeshDataBuilder(),glass:new MeshDataBuilder()},result=buildArchitecture(b,{x:10,y:12,z:10,width:21,depth:16,height:28,yaw:.4,style,seed:4});let total=0;
      for(const g of Object.values(b)){const d=g.finish();total+=d.indices.length/3;expect(d.colors?.length).toBe(d.positions.length/3*4);expect([...d.positions,...d.normals,...d.colors!].every(Number.isFinite)).toBe(true);expect(Math.max(...d.positions.filter((_,i)=>i%3===1))).toBeLessThanOrEqual(12+result.height+.001);}counts.add(total);expect(total).toBeLessThan(7000);
      const eave=style==='house'?5.1:style==='brick'?19:28;expect(Math.max(...b.glass.positions.filter((_,i)=>i%3===1))).toBeLessThan(12+eave-.4);
    }expect(counts.size).toBeGreaterThanOrEqual(4);
  });
  it('produces a distinct warm sunset, blue daytime sky, dark night and cloud cover',()=>{
    const field=cloudField(64,32),clear=skyPixels(12,'Clear',field,64,32),sunset=skyPixels(17.4,'Clear',field,64,32),rain=skyPixels(12,'Rain',field,64,32),night=skyPixels(0,'Clear',field,64,32);
    expect(clear).not.toEqual(sunset);expect(clear).not.toEqual(rain);const sum=(v:Uint8Array)=>v.reduce((s,n,i)=>i%4===3?s:s+n,0);expect(sum(night)).toBeLessThan(sum(clear)*.1);const top=(31*64+20)*4;expect(clear[top+2]).toBeGreaterThan(clear[top]*2);expect(field).toEqual(cloudField(64,32));
  });
  it('batches lit and unlit panes in one glass material and fades occupancy lighting at dusk',()=>{
    const b={wall:new MeshDataBuilder(),roof:new MeshDataBuilder(),glass:new MeshDataBuilder()};buildArchitecture(b,{x:0,y:0,z:0,width:21,depth:16,height:24,yaw:0,style:'office',seed:5});const slots=new Set(b.glass.uvs.filter((_,i)=>i%2===0));expect(slots).toEqual(new Set([.25,.75]));expect(windowLighting(12)).toBe(0);expect(windowLighting(22)).toBe(1);expect(windowLighting(18)).toBeCloseTo(.5);expect(windowLighting(24)).toEqual(windowLighting(0));
  });
});
