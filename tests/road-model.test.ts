import {describe,it,expect} from 'vitest';
import {NullEngine,Scene,PBRMaterial} from '@babylonjs/core';
import {VEHICLES} from '../src/content/vehicles';
import {roadDesign} from '../src/render/road-design';
import {roadCoachwork} from '../src/render/coachwork';
import {wheelModel,wheelStyle} from '../src/render/wheel-model';
import {panelHeight} from '../src/render/panel-stripe';
import {createCar} from '../src/render/car';
import {cameraMounts} from '../src/render/camera-mounts';
import {fasciaDepth} from '../src/render/fascia';
import type {VehicleState} from '../src/core/types';

describe('distinct original vehicle models',()=>{
  it('replaces flat caps with finite outward sculpted bumpers and real recessed openings',()=>{
    const engine=new NullEngine(),scene=new Scene(engine),m=Object.fromEntries(['paint','glass','dark','chrome','light','tail'].map(k=>[k,new PBRMaterial(k,scene)])) as Record<'paint'|'glass'|'dark'|'chrome'|'light'|'tail',PBRMaterial>;
    try{for(const d of VEHICLES.filter(d=>d.class!=='FORMULA'))for(const lite of [false,true]){
      const car=roadCoachwork(scene,d,m,lite);expect(car.parts.some(p=>p.name==='bumper-cap')).toBe(false);
      for(const front of [false,true]){
        const sign=front?1:-1,panel=car.parts.find(p=>p.name===`sculpted-${front?'front':'rear'}-bumper`)!,throat=car.parts.find(p=>p.name===(front?'recessed-intake-throat':'recessed-rear-valance'))!;
        const pos=panel.getVerticesData('position')!,normals=Array.from(panel.getVerticesData('normal')!);expect(pos.every(Number.isFinite)).toBe(true);expect(normals.every(Number.isFinite)).toBe(true);
        expect(normals.filter((_,i)=>i%3===2).reduce((s,n)=>s+n,0)*sign).toBeGreaterThan(0);
        const depths=Array.from(pos).filter((_,i)=>i%3===2).map(v=>v*sign);expect(Math.max(...depths)-Math.min(...depths)).toBeGreaterThan(.07);expect(Math.max(...depths)).toBeLessThan(d.length/2+.15);
        expect(fasciaDepth(panel,0,front?-.205:-.275,sign)).toBeUndefined();
        expect(fasciaDepth(throat,0,front?-.205:-.275,sign)!*sign).toBeCloseTo(d.length/2+(front?-.105:-.015),5);
        const backNormals=throat.getVerticesData('normal')!;expect(backNormals[backNormals.length-1]*sign).toBeGreaterThan(.99);
      }
      car.parts.forEach(p=>p.dispose());
    }}finally{scene.dispose();engine.dispose();}
  });
  it('authors five separate cabin, body and frontal identities without altering physical definitions',()=>{
    const roads=VEHICLES.filter(d=>d.class!=='FORMULA'),styles=roads.map(roadDesign);
    expect(new Set(styles.map(s=>JSON.stringify(s.cabin))).size).toBe(5);expect(new Set(styles.map(s=>JSON.stringify(s.widths))).size).toBe(5);expect(new Set(styles.map(s=>s.lamp)).size).toBe(5);
    for(const s of styles)expect(s.stations.every((r,i)=>i===0||r[0]>s.stations[i-1][0])).toBe(true);
    expect(new Set(VEHICLES.map(d=>JSON.stringify(wheelStyle(d.id)))).size).toBe(6);
  });
  it('leaves a genuinely open passenger cell and conforms road liveries to both panel detail levels',()=>{
    const engine=new NullEngine(),scene=new Scene(engine),m=Object.fromEntries(['paint','glass','dark','chrome','light','tail','accent','instruments'].map(k=>[k,new PBRMaterial(k,scene)])) as Record<'paint'|'glass'|'dark'|'chrome'|'light'|'tail'|'accent'|'instruments',PBRMaterial>;
    try{for(const d of VEHICLES.filter(d=>d.class!=='FORMULA'))for(const lite of [false,true]){
      const car=roadCoachwork(scene,d,m,lite,1),roof=car.parts.find(p=>p.name==='crowned-roof')!;
      const skin=car.body.getVerticesData('position')!,normals=car.body.getVerticesData('normal')!;
      expect(normals).toHaveLength(skin.length);
      for(let v=0;v<normals.length;v+=3){expect(Math.hypot(...normals.slice(v,v+3))).toBeCloseTo(1,5);if(Math.abs(skin[v])<.35)expect(normals[v+1]).toBeGreaterThan(.5);}
      expect(panelHeight(car.body,0,-.1)).toBeUndefined();expect(panelHeight(car.body,0,d.length/2-.12)).toBeTypeOf('number');expect(car.parts.some(p=>p.name==='driver-instruments'&&p.material===m.instruments)).toBe(true);
      for(const headrest of car.parts.filter(p=>p.name==='seat-headrest')){headrest.computeWorldMatrix(true);expect(headrest.getBoundingInfo().boundingBox.maximumWorld.y).toBeLessThan(car.roofHeight-.03);}
      expect(car.parts.some(p=>p.name==='footwell-firewall')).toBe(true);
      const steering=car.parts.find(p=>p.name==='steering-wheel')!;steering.computeWorldMatrix(true);expect(steering.getBoundingInfo().boundingBox.maximumWorld.y).toBeLessThan(car.roofHeight-.03);
      const boss=car.parts.find(p=>p.name==='steering-boss')!,display=car.parts.find(p=>p.name==='driver-instruments')!,eye=cameraMounts(d).cockpit;boss.computeWorldMatrix(true);display.computeWorldMatrix(true);
      expect((boss.getBoundingInfo().boundingBox.maximumWorld.y-eye.y)/(boss.position.z-eye.z)).toBeLessThan((display.getBoundingInfo().boundingBox.minimumWorld.y-eye.y)/(display.position.z-eye.z));
      for(const decal of car.parts.filter(p=>p.name.endsWith('-livery'))){const p=decal.getVerticesData('position')!,panel=decal.name.startsWith('roof')?roof:car.body;expect(p.length).toBeGreaterThan(0);for(let i=0;i<p.length;i+=3)expect(p[i+1]-panelHeight(panel,p[i],p[i+2])!).toBeCloseTo(.0015,4);}
      car.parts.forEach(p=>p.dispose());
    }}finally{scene.dispose();engine.dispose();}
  });
  it('builds finite concave wheels, outward tyre/spoke faces and lower-detail geometry',()=>{
    const engine=new NullEngine(),scene=new Scene(engine),m={rubber:new PBRMaterial('rubber',scene),alloy:new PBRMaterial('alloy',scene),brake:new PBRMaterial('brake',scene),accent:new PBRMaterial('accent',scene)};
    try{for(const d of VEHICLES)for(const side of [0,1]){const counts=[];
      for(const lite of [false,true]){const w=wheelModel(scene,d,side,m,lite);let triangles=0;
        for(const p of w.parts){expect(p.getVerticesData('position')!.every(Number.isFinite)).toBe(true);expect(p.getVerticesData('normal')!.every(Number.isFinite)).toBe(true);triangles+=p.getTotalIndices()/3;}
        const spoke=w.parts.find(p=>p.name==='sculpted-forged-spokes')!,normals=Array.from(spoke.getVerticesData('normal')!);expect(normals.slice(0,12).filter((_,i)=>i%3===0).reduce((s,x)=>s+x,0)*(side===0?-1:1)).toBeGreaterThan(2);
        const tyre=w.parts.find(p=>p.name==='profiled-tire')!,p=tyre.getVerticesData('position')!,n=tyre.getVerticesData('normal')!;let radial=0;for(let k=0;k<p.length;k+=3)radial+=p[k]*n[k]+p[k+2]*n[k+2];expect(radial).toBeGreaterThan(0);
        expect(!!w.caliper).toBe(!lite);counts.push(triangles);w.parts.forEach(p=>p.dispose());w.caliper?.dispose();
      }expect(counts[0]).toBeLessThan(6000);expect(counts[1]).toBeLessThan(counts[0]*.5);
    }}finally{scene.dispose();engine.dispose();}
  });
  it('keeps calipers fixed in wheel roll while following steering and suspension',()=>{
    const engine=new NullEngine(),scene=new Scene(engine);
    const state:VehicleState={id:'test',position:{x:0,y:0,z:0},velocity:{x:0,y:0,z:0},yaw:0,speed:12,rpm:3000,gear:2,steer:.23,fuel:50,wheels:Array.from({length:4},(_,i)=>({load:2000,compression:.03+i*.01,slip:0,angle:7+i,omega:10,temperature:30,wear:1,contact:true})),grounded:true,surface:'Asphalt',damage:0,absActive:false,tcActive:false,distance:5};
    try{for(const d of VEHICLES){const car=createCar(scene,d);car.update(state);const brakes=car.root.getChildTransformNodes().filter(n=>/^brake-\d$/.test(n.name));expect(brakes.length).toBe(4);
      for(let i=0;i<4;i++){const b=brakes.find(n=>n.name===`brake-${i}`)!,w=car.wheels[i];expect(b.position.equals(w.position)).toBe(true);expect(b.rotation.x).toBe(0);expect(b.rotation.y).toBe(w.rotation.y);expect(w.rotation.x).toBe(state.wheels[i].angle);}
      car.dispose();
    }}finally{scene.dispose();engine.dispose();}
  });
});
