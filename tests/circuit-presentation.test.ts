import {describe,it,expect} from 'vitest';
import {buildGrandstand} from '../src/world/grandstand';
import {MeshDataBuilder} from '../src/world/mesh-data';
import {buildCellBlueprint} from '../src/world/cell-blueprint';
import {mountainHeight,MOUNTAIN_MASSIFS} from '../src/world/landscape';

describe('original circuit presentation and depth',()=>{
  it('builds supported seating/canopy inside a bounded off-track footprint',()=>{
    const b={wall:new MeshDataBuilder(),roof:new MeshDataBuilder(),glass:new MeshDataBuilder()},detail=new MeshDataBuilder(),stand=buildGrandstand(b,detail);let triangles=0;
    expect(stand.seats).toBeGreaterThan(1800);
    for(const g of [b.wall,b.roof,detail]){const mesh=g.finish();triangles+=mesh.indices.length/3;expect(mesh.positions.every(Number.isFinite)).toBe(true);expect(mesh.normals.every(Number.isFinite)).toBe(true);expect(mesh.colors?.length).toBe(mesh.positions.length/3*4);
      for(let i=0;i<mesh.positions.length;i+=3){expect(mesh.positions[i]).toBeGreaterThanOrEqual(806.9);expect(mesh.positions[i]).toBeLessThanOrEqual(993.1);expect(mesh.positions[i+1]).toBeGreaterThanOrEqual(16.84);expect(mesh.positions[i+1]).toBeLessThan(27);expect(mesh.positions[i+2]).toBeLessThan(-1527);}
    }
    expect(triangles).toBeLessThan(19000);expect(b.wall.positions.some((v,i)=>i%3===1&&v>22)).toBe(true);
  });
  it('keeps seat/rail dressing nonphysical and places the mounted gantry in its actual cell',()=>{
    const stand=buildCellBlueprint(3,-7,'Low'),grid=buildCellBlueprint(2,-6,'Low');
    expect(stand.meshes.find(m=>m.name.startsWith('circuit-detail'))?.collision).toBe(false);
    expect(grid.signs.find(s=>s.id==='aster-gantry')).toMatchObject({mounted:true,width:23,height:1.05});
    expect(stand.signs.some(s=>s.id==='aster-gantry')).toBe(false);
  });
  it('retains valley clearance and a lower foothill belt in front of the main range',()=>{
    for(let a=0;a<Math.PI*2;a+=.2)expect(mountainHeight(Math.cos(a)*2000,Math.sin(a)*2000)).toBe(-14);
    for(const p of MOUNTAIN_MASSIFS){const r=Math.hypot(p.x,p.z);expect(mountainHeight(p.x,p.z)).toBeGreaterThan(mountainHeight(p.x/r*3000,p.z/r*3000)+150);}
    expect(mountainHeight(0,4600)).toBeLessThan(200);
    for(let x=-6000;x<=6000;x+=120)for(let z=-6000;z<=6000;z+=120)expect(Math.abs(mountainHeight(x+5,z)-mountainHeight(x-5,z))).toBeLessThan(20);
  });
});
