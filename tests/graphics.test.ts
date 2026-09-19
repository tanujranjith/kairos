import { describe,it,expect } from 'vitest';
import { NullEngine,Scene } from '@babylonjs/core';
import { surfacePixels } from '../src/render/surface-textures';
import { createCar } from '../src/render/car';
import { VEHICLES } from '../src/content/vehicles';
import { buildCellBlueprint,blueprintTransfers } from '../src/world/cell-blueprint';

describe('original graphics assets',()=>{
  it('generates reproducible albedo and finite normalized normal maps',()=>{
    for(const kind of ['asphalt','meadow','concrete','stone','bark','gravel'] as const){const a=surfacePixels(kind,32),b=surfacePixels(kind,32);expect(a).toEqual(b);expect(a.color.length).toBe(32*32*4);expect(new Set(a.color).size).toBeGreaterThan(12);for(let i=0;i<a.normal.length;i+=4){const n=[0,1,2].map(c=>a.normal[i+c]/255*2-1);expect(Math.hypot(...n)).toBeCloseTo(1,1);expect(a.normal[i+3]).toBe(255);}}
  });
  it('six car generators preserve wheel pivots and finite mesh data at both detail levels',()=>{
    const engine=new NullEngine(),scene=new Scene(engine);
    try{for(const definition of VEHICLES){const counts:number[]=[];for(const lite of [false,true]){const car=createCar(scene,definition,undefined,lite);expect(car.wheels).toHaveLength(4);expect(car.wheels.every(w=>w.parent===car.root)).toBe(true);let vertices=0;for(const mesh of car.parts){const p=mesh.getVerticesData('position')!;expect(p.length%3).toBe(0);expect(p.every(Number.isFinite)).toBe(true);vertices+=mesh.getTotalVertices();}counts.push(vertices);car.dispose();}expect(counts[0]).toBeGreaterThan(counts[1]);expect(counts[0]).toBeLessThan(40000);}}
    finally{scene.dispose();engine.dispose();}
  });
  it('streams all colored terrain buffers by transfer without duplicate ownership',()=>{
    const blueprint=buildCellBlueprint(-2,0,'Low'),transfers=blueprintTransfers(blueprint);expect(new Set(transfers).size).toBe(transfers.length);expect(transfers.reduce((sum,b)=>sum+b.byteLength,0)).toBe(blueprint.bytes);const terrain=blueprint.meshes.find(m=>m.material==='terrain')!;expect(terrain.data.colors?.length).toBe(terrain.data.positions.length/3*4);expect(blueprint.instances.some(i=>i.kind==='oak')).toBe(true);
  });
});
