import {describe,it,expect} from 'vitest';
import {NullEngine,Scene} from '@babylonjs/core';
import {ruralDressing,ruralPlantAllowed} from '../src/world/rural-dressing';
import {boulderGeometry,createBoulders} from '../src/render/boulders';
import {surfacePixels} from '../src/render/surface-textures';
import {terrainHeight,CELL_SIZE} from '../src/content/world';

describe('grouped original roadside landscape',()=>{
  it('generates deterministic native boulders with finite unit normals after shaping',()=>{
    const a=boulderGeometry(),b=boulderGeometry();expect(a.positions).toEqual(b.positions);expect(a.indices!.length/3).toBeLessThanOrEqual(200);
    expect([...a.positions!,...a.normals!,...a.colors!].every(Number.isFinite)).toBe(true);expect(a.colors!.length).toBe(a.positions!.length/3*4);
    for(let i=0;i<a.normals!.length;i+=3){expect(Math.hypot(...Array.from(a.normals!).slice(i,i+3))).toBeCloseTo(1,6);expect(Math.abs(a.positions![i])).toBeLessThan(3);expect(Math.abs(a.positions![i+2])).toBeLessThan(3);}
    // All source points are transformed inside an approximately 5m envelope.
    expect(Math.max(...Array.from(a.positions!).filter((_,i)=>i%3===1))).toBeLessThan(1.7);
  });
  it('uses mineral texture and height-dependent coloration instead of white concrete',()=>{
    const data=surfacePixels('boulder',64),concrete=surfacePixels('concrete',64),mean=(v:Uint8Array)=>v.filter((_,i)=>i%4!==3).reduce((sum,n)=>sum+n,0)/(v.length*.75);
    expect(mean(data.color)).toBeLessThan(mean(concrete.color)*.75);expect(mean(data.color)).toBeGreaterThan(85);
    const engine=new NullEngine(),scene=new Scene(engine);try{const m=createBoulders(scene);expect(m.isPickable).toBe(false);expect(scene.materials.find(m=>m.name==='weathered-rock')?.getActiveTextures().map(t=>t.name)).toContain('original-boulder-albedo');expect(m.isVerticesDataPresent('color')).toBe(true);}finally{scene.dispose();engine.dispose();}
  });
  it('keeps every generated plant within one owning cell and clear of protected ground',()=>{
    let plants=0,shrubs=0,trees=0;
    for(let cx=-9;cx<=8;cx++)for(let cz=-9;cz<=8;cz++)for(const p of ruralDressing(cx,cz,'Low')){
      expect(Math.floor(p.position.x/CELL_SIZE)).toBe(cx);expect(Math.floor(p.position.z/CELL_SIZE)).toBe(cz);
      expect(ruralPlantAllowed(p.position.x,p.position.z,0)).toBe(true);expect(Object.values(p.position).every(Number.isFinite)).toBe(true);plants++;
      const floor=terrainHeight(p.position.x,p.position.z);if(p.kind==='rock')expect(p.position.y-floor).toBeCloseTo(.4*p.scale.y,7);
      if(p.kind==='oak'&&p.scale.y<.4){shrubs++;expect(p.position.y-floor).toBeCloseTo(1.15*p.scale.y/.85,7);}else if(p.kind==='pine'||p.kind==='oak')trees++;
    }
    expect(plants).toBeGreaterThan(2500);expect(shrubs).toBeGreaterThan(500);expect(trees).toBeGreaterThan(1000);
  });
  it('keeps Low placements stable when scenery density is increased',()=>{
    for(const [cx,cz] of [[-2,0],[0,4],[4,2],[-6,-4],[3,-6]]){
      const low=ruralDressing(cx,cz,'Low');expect(low).toEqual(ruralDressing(cx,cz,'Low'));
      for(const quality of ['Medium','High','Ultra'] as const){const high=new Set(ruralDressing(cx,cz,quality).map(p=>JSON.stringify(p)));for(const p of low)expect(high.has(JSON.stringify(p))).toBe(true);}
    }
  });
  it('omits rural planting from the circuit paddock, industrial district and water',()=>{
    expect(ruralDressing(3,-6,'Low')).toHaveLength(0);expect(ruralDressing(-5,-3,'Low')).toHaveLength(0);
    expect(ruralPlantAllowed(-1070,730,2)).toBe(false);expect(ruralPlantAllowed(-380,100,2)).toBe(false);
  });
});
