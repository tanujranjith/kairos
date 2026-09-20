import {describe,it,expect} from 'vitest';
import {NullEngine,Scene,PBRMaterial} from '@babylonjs/core';
import {VEHICLES} from '../src/content/vehicles';
import {cabinSurfaces} from '../src/render/road-cabin';
import {roadCoachwork} from '../src/render/coachwork';

const roads=VEHICLES.filter(d=>d.class!=='FORMULA');
describe('shared molded passenger cell',()=>{
  it('joins roof and screens and keeps side boundaries aligned to their structural frames',()=>{
    for(const d of roads){const c=cabinSurfaces(d);
      for(const u of [-1,-.5,0,.5,1])for(const rear of [false,true]){
        const a=c.screen(rear,u,rear?0:1),b=c.cap(u,rear?0:1);
        for(let axis=0;axis<3;axis++)expect(a[axis]).toBeCloseTo(b[axis],6);
      }
      for(const sign of [-1,1])for(const t of [0,.25,.5,.75,1])for(const rear of [false,true]){
        const a=c.side(sign,rear?0:1,t),b=c.screen(rear,sign,rear?1-t:t);
        // Screen bow is longitudinal; its boundary retains the exact pillar width.
        expect(a[0]).toBeCloseTo(b[0],6);expect(a[2]).toBeCloseTo(b[2],6);
        expect(Math.abs(a[1]-b[1])).toBeLessThan(.015);
      }
      expect(Math.abs(c.side(1,.5,.5)[0]-(c.bottom+c.top)/2)).toBeGreaterThan(.02);
    }
  });
  it('builds finite outward curved glass and lightweight bucket shells at both levels',()=>{
    const engine=new NullEngine(),scene=new Scene(engine),m={paint:new PBRMaterial('paint',scene),glass:new PBRMaterial('glass',scene),dark:new PBRMaterial('dark',scene),chrome:new PBRMaterial('chrome',scene),light:new PBRMaterial('light',scene),tail:new PBRMaterial('tail',scene)};
    try{for(const d of roads){const counts=[];
      for(const lite of [false,true]){const car=roadCoachwork(scene,d,m,lite),parts=car.parts;
        for(const p of parts){expect(p.getVerticesData('position')!.every(Number.isFinite)).toBe(true);expect(p.getVerticesData('normal')!.every(Number.isFinite)).toBe(true);}
        for(const glass of parts.filter(p=>p.name==='curved-side-glazing')){
          const positions=glass.getVerticesData('position')!,normals=Array.from(glass.getVerticesData('normal')!);
          expect(normals.filter((_,i)=>i%3===0).reduce((sum,n)=>sum+n,0)*Math.sign(positions[0])).toBeGreaterThan(1);
          expect(glass.getTotalVertices()).toBeGreaterThan(12);
        }
        expect(parts.filter(p=>p.name==='bucket-seat-back')).toHaveLength(d.class==='GT'?1:2);
        expect(parts.some(p=>p.name==='roll-cage-main')).toBe(d.class==='GT');
        expect(parts.some(p=>p.name==='rear-cabin-bulkhead')).toBe(true);expect(parts.some(p=>p.name==='rear-parcel-shelf')).toBe(true);
        expect(parts.filter(p=>p.name==='headrest-back')).toHaveLength(d.class==='GT'?1:2);
        for(const seat of parts.filter(p=>['bucket-seat-back','bucket-seat-shell','seat-cushion'].includes(p.name)))expect(seat.getTotalIndices()/3).toBeLessThan(250);
        counts.push(parts.reduce((sum,p)=>sum+p.getTotalIndices()/3,0));parts.forEach(p=>p.dispose());
      }expect(counts[1]).toBeLessThan(counts[0]*.65);
    }}finally{scene.dispose();engine.dispose();}
  });
});
