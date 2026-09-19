import { describe,expect,it } from 'vitest';
import { MeshDataBuilder } from '../src/world/mesh-data';
import { cellManifest,planCells,cellCoordinates,cellKey } from '../src/world/cell-manifest';
import { ResourcePool } from '../src/world/resource-pool';
import { CIRCUIT,PIT } from '../src/content/world';
import { CellStreamer } from '../src/world/cell-streamer';
import { buildCellBlueprint } from '../src/world/cell-blueprint';

describe('world streaming contracts',()=>{
  const player={id:'player',position:{x:0,y:10,z:0},velocity:{x:120,y:0,z:0}};
  it('covers every cell along six seconds of maximum-speed travel',()=>{
    const demand=planCells(player,[],'Low','exploration');
    for(let x=0;x<=720;x+=16){const c=cellCoordinates({x,z:0});expect(demand.get(cellKey(c.cx,c.cz))?.collision).toBe(true);}
    expect(demand.get('0,0')!.priority).toBeLessThan(demand.get('2,0')!.priority);
  });
  it('protects actor collision cells and reserves the entire circuit/pit lane in a race',()=>{
    const ai={id:'racer-1',position:CIRCUIT.points[200],velocity:{x:0,y:0,z:0}},demand=planCells(player,[ai],'Low','racing');
    for(const p of [...CIRCUIT.points,...PIT.points]){const c=cellCoordinates(p),entry=demand.get(cellKey(c.cx,c.cz))!;expect(entry.collision).toBe(true);expect(entry.owners.has('race-reservation')).toBe(true);}
    const c=cellCoordinates(ai.position);expect(demand.get(cellKey(c.cx,c.cz))!.owners.has(ai.id)).toBe(true);
  });
  it('new plans release obsolete directions and manifests expose stable authored dependencies',()=>{
    const a=planCells(player,[],'Low','exploration'),b=planCells({...player,position:{x:-1500,y:10,z:1500},velocity:{x:-100,y:0,z:0}},[],'Low','exploration');expect(a.has('3,0')).toBe(true);expect(b.has('3,0')).toBe(false);
    const manifest=cellManifest(0,-2);expect(manifest.bounds).toEqual([0,-512,256,-256]);expect(manifest.roadIds).toContain('crossway');expect(cellManifest(0,-2)).toEqual(manifest);
  });
  it('disposes shared resources only after the last idempotent lease release',()=>{
    let creates=0,disposals=0;const pool=new ResourcePool<{id:number}>(()=>disposals++),a=pool.acquire('road',()=>({id:++creates}),128),b=pool.acquire('road',()=>({id:++creates}),128);
    expect(a.resource).toBe(b.resource);expect(pool.snapshot()).toEqual({resources:1,references:2,bytes:128});a.release();a.release();expect(disposals).toBe(0);b.release();expect(disposals).toBe(1);expect(pool.snapshot().bytes).toBe(0);
  });
  it('worker mesh buffers have finite unit normals and preserve upward road winding',()=>{
    const mesh=new MeshDataBuilder();mesh.quad({x:0,y:0,z:0},{x:1,y:0,z:0},{x:0,y:0,z:1},{x:1,y:0,z:1});const data=mesh.finish();expect([...data.normals]).toEqual([0,1,0,0,1,0,0,1,0,0,1,0]);expect(data.indices).toHaveLength(6);
  });
  it('cell blueprints are deterministic and include collision geometry before any runtime resources exist',()=>{
    const a=buildCellBlueprint(-6,-4,'Low'),b=buildCellBlueprint(-6,-4,'Low');expect(a).toEqual(b);expect(a.bytes).toBeGreaterThan(0);expect(a.meshes.some(m=>m.collision&&m.name.startsWith('terrain'))).toBe(true);
    for(const m of a.meshes){expect(m.data.positions.length%3).toBe(0);expect([...m.data.positions,...m.data.normals].every(Number.isFinite)).toBe(true);expect([...m.data.indices].every(i=>i<m.data.positions.length/3)).toBe(true);}
  });
});

describe('asynchronous cell transactions',()=>{
  const demand=(id:string,priority=0)=>({id,cx:0,cz:0,priority,collision:true,detail:false,owners:new Set(['player'])});
  it('loads higher-priority collisions first, changes detail mode and releases obsolete resources',async()=>{
    const loaded:string[]=[],disposed:string[]=[],modes:boolean[]=[],stream=new CellStreamer<string,string>({load:async d=>{loaded.push(d.id);return d.id;},install:b=>b,mode:(_r,_b,d)=>modes.push(d.detail),dispose:r=>disposed.push(r)});
    stream.setDemand(new Map([['far',demand('far',10)],['near',demand('near',-1000)]]));await stream.waitFor(['far','near']);expect(loaded).toEqual(['near','far']);
    stream.setDemand(new Map([['near',{...demand('near'),detail:true}]]));expect(modes).toEqual([true]);expect(disposed).toEqual(['far']);stream.clear();expect(disposed).toEqual(['far','near']);
  });
  it('discards a stale completion after cancellation before allocating meshes',async()=>{
    let finish!:(value:string)=>void,installs=0;const stream=new CellStreamer<string,string>({load:()=>new Promise(resolve=>finish=resolve),install:b=>{installs++;return b;},mode:()=>{},dispose:()=>{}});
    stream.setDemand(new Map([['old',demand('old')]]));await Promise.resolve();stream.clear();finish('old');await new Promise(resolve=>setTimeout(resolve,0));expect(installs).toBe(0);expect(stream.snapshot().cancelled).toBe(1);
  });
  it('surfaces failed loads, supports explicit retry and does not drop a retained race owner',async()=>{
    let fail=true,disposals=0;const stream=new CellStreamer<string,string>({load:async d=>{if(fail)throw new Error('asset unavailable');return d.id;},install:b=>b,mode:()=>{},dispose:()=>disposals++});
    stream.setDemand(new Map([['track',{...demand('track'),owners:new Set(['player','race-reservation'])}]]));await expect(stream.waitFor(['track'])).rejects.toThrow('asset unavailable');fail=false;stream.retry();await stream.waitFor(['track']);
    stream.setDemand(new Map([['track',{...demand('track'),owners:new Set(['race-reservation'])}]]));expect(stream.has('track',true)).toBe(true);expect(disposals).toBe(0);stream.clear();expect(disposals).toBe(1);
  });
});
