import {describe,it,expect} from 'vitest';
import {ASTER_GROVES,circuitBankHeight,paddockBlend} from '../src/content/circuit-landscape';
import {circuitWoodland,buildCircuitSetting} from '../src/world/circuit-setting';
import {ROADS,nearestRoad,terrainHeight,CIRCUIT,pointAt,inLake} from '../src/content/world';
import {inHandlingCourse} from '../src/content/handling-course';
import {MeshDataBuilder} from '../src/world/mesh-data';

describe('authored Aster setting',()=>{
  it('keeps bounded deterministic tree belts clear of every driving surface and paddock',()=>{
    const trees=circuitWoodland();expect(trees).toEqual(circuitWoodland());expect(trees.length).toBeGreaterThan(300);expect(trees.length).toBeLessThan(700);
    for(const t of trees){const n=nearestRoad(t.position.x,t.position.z,undefined,2);expect(n.distance).toBeGreaterThanOrEqual(n.road.width/2+27);expect(t.position.y).toBe(terrainHeight(t.position.x,t.position.z));}
    for(const grove of ASTER_GROVES)expect(trees.some(t=>Math.hypot((t.position.x-grove.x)/grove.rx,(t.position.z-grove.z)/grove.rz)<1.2)).toBe(true);
  });
  it('leaves road elevation/near-road terrain intact while grading only the paddock and distant banks',()=>{
    for(const road of ROADS)for(const p of road.points.filter((_,i)=>i%8===0)){
      if(road.kind==='test'||inLake(p.x,p.z)||inHandlingCourse(p.x,p.z,30))continue;
      const n=nearestRoad(p.x,p.z,undefined,1);if(n.road.id!==road.id)continue;
      expect(Math.abs(terrainHeight(p.x,p.z)-(n.point.terrainY??n.point.y)+.16)).toBeLessThan(.01);
    }
    expect(paddockBlend(900,-1380)).toBe(1);expect(terrainHeight(900,-1380)).toBeCloseTo(16.84,3);
    expect(circuitBankHeight(1110,-1270)).toBeGreaterThan(6);expect(circuitBankHeight(-1000,1000)).toBe(0);
    expect(pointAt(CIRCUIT,0).y).toBe(17);
  });
  it('batches finite original paddock geometry with collision-scale clearance and a modest triangle cost',()=>{
    let triangles=0;
    for(let cx=1;cx<=6;cx++)for(let cz=-7;cz<=-2;cz++){
      const b={wall:new MeshDataBuilder(),roof:new MeshDataBuilder(),glass:new MeshDataBuilder()},paving=new MeshDataBuilder(),paint=new MeshDataBuilder();buildCircuitSetting(cx,cz,b,paving,paint);
      for(const g of [b.wall,b.roof,b.glass,paving,paint]){const d=g.finish();triangles+=d.indices.length/3;expect(d.positions.every(Number.isFinite)).toBe(true);expect(d.normals.every(Number.isFinite)).toBe(true);expect(d.colors?.length??0).toBe(d.positions.length/3*4);}
      for(let i=0;i<b.wall.positions.length;i+=3){const [x,y,z]=b.wall.positions.slice(i,i+3);if(Math.abs(z+1472)<.3&&y<17.8)expect(y).toBeLessThan(terrainHeight(x,z));}
    }
    expect(triangles).toBeGreaterThan(10000);expect(triangles).toBeLessThan(26000);
  });
});
