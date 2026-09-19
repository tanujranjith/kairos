import { describe,it,expect } from 'vitest';
import { NullEngine,Scene,PBRMaterial } from '@babylonjs/core';
import { surfacePixels } from '../src/render/surface-textures';
import { createCar } from '../src/render/car';
import { VEHICLES } from '../src/content/vehicles';
import { buildCellBlueprint,blueprintTransfers } from '../src/world/cell-blueprint';
import { roadCoachwork } from '../src/render/coachwork';
import { cameraMounts } from '../src/render/camera-mounts';

describe('original graphics assets',()=>{
  it('generates reproducible albedo and finite normalized normal maps',()=>{
    for(const kind of ['asphalt','meadow','concrete','stone','bark','gravel','water'] as const){const a=surfacePixels(kind,32),b=surfacePixels(kind,32);expect(a).toEqual(b);expect(a.color.length).toBe(32*32*4);expect(new Set(a.color).size).toBeGreaterThan(kind==='stone'?5:12);for(let i=0;i<a.normal.length;i+=4){const n=[0,1,2].map(c=>a.normal[i+c]/255*2-1);expect(Math.hypot(...n)).toBeCloseTo(1,1);expect(a.normal[i+3]).toBe(255);}}
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
});
