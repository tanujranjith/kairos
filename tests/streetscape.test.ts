import {describe,it,expect} from 'vitest';
import {NullEngine,Scene} from '@babylonjs/core';
import {STREET_FIXTURES,STREET_LAMPS,nearbyStreetLamps,lampPosition} from '../src/content/streetscape';
import {nearestRoad,terrainHeight} from '../src/content/world';
import {MeshDataBuilder} from '../src/world/mesh-data';
import {buildStreetscape} from '../src/world/streetscape';
import {StreetLighting} from '../src/render/street-lighting';
import type {CellInstance} from '../src/world/cell-blueprint';

describe('city streetscape ownership and clearance',()=>{
  it('has stable unique authored road stations, all fixture types and owner cells',()=>{
    expect(STREET_LAMPS.length).toBeGreaterThan(70);expect(STREET_FIXTURES.length).toBeLessThan(450);
    expect(STREET_FIXTURES.filter(f=>f.kind==='planter').length).toBeGreaterThan(70);
    expect(new Set(STREET_FIXTURES.map(f=>f.id)).size).toBe(STREET_FIXTURES.length);
    expect(new Set(STREET_FIXTURES.map(f=>f.kind)).size).toBe(5);
    for(const f of STREET_FIXTURES){expect(f.cell).toBe(`${Math.floor(f.x/256)},${Math.floor(f.z/256)}`);expect(f.roadId.startsWith('city')).toBe(true);}
  });
  it('keeps solid vertices outside every driving surface, with overhead lamp arms above vehicles',()=>{
    for(const cell of new Set(STREET_FIXTURES.map(f=>f.cell))){
      const [cx,cz]=cell.split(',').map(Number),b={wall:new MeshDataBuilder(),roof:new MeshDataBuilder(),glass:new MeshDataBuilder()},plants:CellInstance[]=[];
      buildStreetscape(cx,cz,b,plants);let triangles=0;
      for(const g of Object.values(b)){const data=g.finish();triangles+=data.indices.length/3;expect([...data.positions,...data.normals,...data.colors??[]].every(Number.isFinite)).toBe(true);
        for(let i=0;i<data.positions.length;i+=3){const [x,y,z]=data.positions.slice(i,i+3);if(y>terrainHeight(x,z)+4)continue;const n=nearestRoad(x,z,undefined,1);expect(n.distance-n.road.width/2,`${cell} vertex ${x},${z}`).toBeGreaterThan(.90);}
      }
      expect(triangles).toBeLessThan(5000);
      expect(plants.filter(p=>p.kind==='oakTrunk').length).toBe(STREET_FIXTURES.filter(f=>f.cell===cell&&f.kind==='planter').length);
      for(const p of plants){expect(['oak','oakTrunk','grass']).toContain(p.kind);expect(p.scale.x).toBeLessThan(.45);}
    }
  });
  it('selects at most two loaded, height-compatible lamps and owns only two real lights',()=>{
    const engine=new NullEngine(),scene=new Scene(engine),lights=new StreetLighting(scene),f=STREET_LAMPS[0];
    try{
      expect(nearbyStreetLamps(f,()=>false)).toEqual([]);expect(nearbyStreetLamps({...f,y:f.y+20},()=>true)).toEqual([]);
      lights.update(f,12,1,()=>true,true);expect(lights.snapshot().every(s=>!s.enabled)).toBe(true);
      for(const fixture of STREET_LAMPS){lights.update(fixture,22,1,cell=>cell===fixture.cell,true);const live=lights.snapshot().filter(s=>s.enabled);expect(live.length).toBeGreaterThan(0);expect(live.length).toBeLessThanOrEqual(2);for(const s of live){expect(s.cell).toBe(fixture.cell);const p=lampPosition(STREET_LAMPS.find(f=>f.id===s.id)!);expect(s.position).toEqual([p.x,p.y,p.z]);}}
      expect(scene.lights.length).toBe(2);lights.update(f,22,1,()=>false,true);expect(lights.snapshot().every(s=>!s.enabled)).toBe(true);
      lights.update(f,22,1,()=>true,false);expect(lights.snapshot().every(s=>!s.enabled)).toBe(true);
      lights.update(f,22,1,()=>true,true);lights.disable();expect(lights.snapshot().every(s=>!s.enabled&&s.id===null)).toBe(true);
    }finally{scene.dispose();engine.dispose();}
  });
  it('fades a replaced lamp in instead of flashing to full intensity at a rank change',()=>{
    const engine=new NullEngine(),scene=new Scene(engine),lights=new StreetLighting(scene),first=STREET_LAMPS[0];
    try{
      lights.update(first,22,1,()=>true,true);const previous=lights.snapshot().flatMap(s=>s.id?[s.id]:[]);
      const next=STREET_LAMPS.find(f=>Math.hypot(f.x-first.x,f.z-first.z)<90&&nearbyStreetLamps(f,()=>true,previous).some(n=>!previous.includes(n.id)))!;
      expect(next).toBeDefined();let switched=false;
      for(let frame=0;frame<50&&!switched;frame++){lights.update(next,22,1/60,()=>true,true);for(const s of lights.snapshot())if(s.id&&!previous.includes(s.id)){expect(s.intensity).toBeLessThan(500);switched=true;}}
      expect(switched).toBe(true);
    }finally{scene.dispose();engine.dispose();}
  });
});
