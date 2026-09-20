import {describe,it,expect} from 'vitest';
import {PIT_GARDENS,pitGardenPlants} from '../src/content/circuit-landscape';
import {buildPitForecourt} from '../src/world/pit-forecourt';
import {MeshDataBuilder} from '../src/world/mesh-data';
import {nearestRoad} from '../src/content/world';
import {buildCellBlueprint} from '../src/world/cell-blueprint';
import {windowEmission} from '../src/render/atmosphere';

describe('authored working pit forecourt',()=>{
  it('keeps daytime glass dark and ramps occupied-window emission into the night',()=>{
    expect(windowEmission(12)).toBe(0);expect(windowEmission(17.4)).toBeLessThan(.02);
    expect(windowEmission(18)).toBeCloseTo(.275);expect(windowEmission(19)).toBe(1.1);
    expect(windowEmission(24)).toBe(windowEmission(0));
    for(let time=17;time<19;time+=.1)expect(windowEmission(time+.1)).toBeGreaterThanOrEqual(windowEmission(time));
  });
  it('places bounded planting within authored beds without obstructing the pit or access',()=>{
    const plants=pitGardenPlants();expect(plants).toEqual(pitGardenPlants());expect(plants).toHaveLength(48);
    for(const p of plants){
      expect(PIT_GARDENS.some(b=>Math.abs(p.x-b.x)<b.width/2&&Math.abs(p.z-b.z)<b.depth/2)).toBe(true);
      const near=nearestRoad(p.x,p.z,undefined,2);expect(near.distance,JSON.stringify({p,road:near.road.id,distance:near.distance})).toBeGreaterThan(near.road.width/2+4);
      expect(p.y).toBe(17.96);expect(Math.max(p.scale.x,p.scale.y,p.scale.z)).toBeLessThan(.3);
    }
  });
  it('keeps finite solid architecture outside the working lane with a bounded total cost',()=>{
    let triangles=0,maxY=0;
    for(let cx=1;cx<=6;cx++)for(let cz=-7;cz<=-5;cz++){
      const b={wall:new MeshDataBuilder(),roof:new MeshDataBuilder(),glass:new MeshDataBuilder()},paving=new MeshDataBuilder(),paint=new MeshDataBuilder();
      buildPitForecourt(cx,cz,b,paving,paint);
      for(const g of [...Object.values(b),paving,paint]){
        const d=g.finish();triangles+=d.indices.length/3;expect(d.positions.every(Number.isFinite)).toBe(true);expect(d.normals.every(Number.isFinite)).toBe(true);
        expect(d.colors?.length??0).toBe(d.positions.length/3*4);
      }
      for(const g of Object.values(b))for(let i=0;i<g.positions.length;i+=3){
        const [x,y,z]=g.positions.slice(i,i+3);maxY=Math.max(maxY,y);
        const near=nearestRoad(x,z,undefined,2);expect(near.distance,JSON.stringify({x,y,z,road:near.road.id,distance:near.distance})).toBeGreaterThan(near.road.width/2+3);
        expect(z).toBeGreaterThan(-1451);expect(y).toBeGreaterThanOrEqual(16.83);
      }
      for(let i=0;i<paving.positions.length;i+=3){const [x,,z]=paving.positions.slice(i,i+3),near=nearestRoad(x,z,undefined,2);expect(near.distance,JSON.stringify({x,z,road:near.road.id})).toBeGreaterThan(near.road.width/2+.5);}
    }
    expect(maxY).toBeGreaterThan(38);expect(maxY).toBeLessThan(40);
    expect(triangles).toBeGreaterThan(5000);expect(triangles).toBeLessThan(11000);
  });
  it('mounts the control sign in its owning cell and retains road collision identities',()=>{
    const c=buildCellBlueprint(3,-6,'Low'),adjacent=buildCellBlueprint(2,-6,'Low');
    expect(c.signs.find(s=>s.id==='aster-control')).toMatchObject({mounted:true,width:14.5});
    expect(adjacent.signs.some(s=>s.id==='aster-control')).toBe(false);
    expect(c.meshes.find(m=>m.name.startsWith('structures'))?.collision).toBe(true);
    const roads=c.meshes.find(m=>m.name.startsWith('roads'))!;
    expect(roads.collision).toBe(true);expect(roads.contactRanges?.some(r=>r.roadId==='pit'&&r.surface==='Asphalt')).toBe(true);
  });
});
