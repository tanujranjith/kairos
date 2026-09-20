import {describe,it,expect} from 'vitest';
import {NullEngine,Scene,PBRMaterial} from '@babylonjs/core';
import {formulaCoachwork} from '../src/render/formula-coachwork';
import {vehicleById} from '../src/content/vehicles';
import {cameraMounts} from '../src/render/camera-mounts';

describe('Apex original model',()=>{
  it('authors finite curved aero, open cockpit and structural details at both geometry levels',()=>{
    const engine=new NullEngine(),scene=new Scene(engine),d=vehicleById('apex');
    const materials=Object.fromEntries(['paint','dark','chrome','light','tail','accent','instruments'].map(k=>[k,new PBRMaterial(k,scene)])) as Record<'paint'|'dark'|'chrome'|'light'|'tail'|'accent'|'instruments',PBRMaterial>;
    try{const counts=[];
      for(const lite of [false,true]){
        const car=formulaCoachwork(scene,d,materials,lite);let triangles=0;
        for(const part of car.parts){const p=part.getVerticesData('position')!,n=part.getVerticesData('normal')!;expect(p.every(Number.isFinite)).toBe(true);expect(n.every(Number.isFinite)).toBe(true);expect(n.length).toBe(p.length);triangles+=part.getTotalIndices()/3;}
        for(const name of ['cockpit-rim','cockpit-bathtub','halo','undercut-sidepod','carbon-wishbone','front-mainplane','front-upper-flap','rear-adjustable-flap','diffuser-strake','formula-steering-yoke'])expect(car.parts.some(p=>p.name===name),name).toBe(true);
        for(const name of ['tapered-nose','front-mainplane','rear-mainplane']){
          const part=car.parts.find(p=>p.name===name)!,p=part.getVerticesData('position')!,n=part.getVerticesData('normal')!;let index=-1,max=-Infinity;
          for(let i=0;i<p.length;i+=3)if(Math.abs(p[i])<.001&&p[i+1]>max){max=p[i+1];index=i;}
          expect(index).toBeGreaterThanOrEqual(0);expect(n[index+1],name).toBeGreaterThan(.65);
        }
        const cover=car.parts.find(p=>p.name==='engine-cover')!,top=Math.max(...cover.getVerticesData('position')!.filter((_,i)=>i%3===1));expect(top+.32+d.wheelRadius).toBeLessThan(d.height+.065);
        const rim=car.parts.find(p=>p.name==='cockpit-rim')!,tub=car.parts.find(p=>p.name==='cockpit-bathtub')!;
        const rimBottom=Math.min(...rim.getVerticesData('position')!.filter((_,i)=>i%3===1)),tubTop=Math.max(...tub.getVerticesData('position')!.filter((_,i)=>i%3===1));expect(rimBottom-tubTop).toBeGreaterThan(.20);
        counts.push(triangles);car.parts.forEach(p=>p.dispose());
      }
      expect(counts[1]).toBeLessThan(counts[0]*.5);expect(counts[0]).toBeLessThan(22000);
    }finally{scene.dispose();engine.dispose();}
  });
  it('places driver eyes inside the opening and below the halo',()=>{
    const eye=cameraMounts(vehicleById('apex')).cockpit;expect(eye.x).toBe(0);expect(eye.y).toBeGreaterThan(.11);expect(eye.y).toBeLessThan(.215);expect(eye.z).toBeGreaterThan(-.7);expect(eye.z).toBeLessThan(.1);
  });
  it('leaves real sidepod apertures with inward-facing recessed throats at both LODs',()=>{
    const engine=new NullEngine(),scene=new Scene(engine),d=vehicleById('apex');
    const materials=Object.fromEntries(['paint','dark','chrome','light','tail','accent','instruments'].map(k=>[k,new PBRMaterial(k,scene)])) as Record<'paint'|'dark'|'chrome'|'light'|'tail'|'accent'|'instruments',PBRMaterial>;
    try{for(const lite of [false,true]){
      const car=formulaCoachwork(scene,d,materials,lite);
      const pods=car.parts.filter(p=>p.name==='undercut-sidepod'),throats=car.parts.filter(p=>p.name==='pod-intake-recess');
      expect(pods).toHaveLength(2);expect(throats).toHaveLength(2);
      for(let side=0;side<2;side++){
        for(const part of [pods[side],throats[side]]){
          const p=part.getVerticesData('position')!,f=part.getIndices()!;
          expect(part.rotation.length()).toBe(0);
          for(let i=0;i<f.length;i+=3)expect([f[i],f[i+1],f[i+2]].every(v=>Math.abs(p[v*3+2]-.49)<1e-6),'no face seals intake mouth').toBe(false);
        }
        const throat=throats[side],p=throat.getVerticesData('position')!,n=throat.getVerticesData('normal')!;
        const z=p.filter((_,i)=>i%3===2);expect(Math.max(...z)-Math.min(...z)).toBeCloseTo(.15,5);
        expect(throat.material).toBe(materials.dark);
        // Back of the cavity must face the viewer looking into the nose (+Z).
        const backNormals=n.filter((_,i)=>i%3===2&&Math.abs(p[i]-.34)<1e-6);
        expect(backNormals.some(v=>v>.99)).toBe(true);
        const rim=(part:typeof throat)=>{const positions=part.getVerticesData('position')!;return Array.from({length:positions.length/3},(_,i)=>positions.slice(i*3,i*3+3)).filter(v=>Math.abs(v[2]-.49)<1e-6);};
        expect(rim(throat)).toEqual(rim(pods[side]));
      }
      car.parts.forEach(p=>p.dispose());
    }}finally{scene.dispose();engine.dispose();}
  });
  it('keeps both liveries flush with the actual panel triangles at both LODs',()=>{
    const engine=new NullEngine(),scene=new Scene(engine),d=vehicleById('apex');
    const materials=Object.fromEntries(['paint','dark','chrome','light','tail','accent','instruments'].map(k=>[k,new PBRMaterial(k,scene)])) as Record<'paint'|'dark'|'chrome'|'light'|'tail'|'accent'|'instruments',PBRMaterial>;
    try{for(const lite of [false,true])for(const livery of [1,2]){
      const car=formulaCoachwork(scene,d,materials,lite,livery),decals=car.parts.filter(p=>p.name.endsWith('-livery'));
      expect(decals.length).toBe(livery===1?4:3);
      for(const decal of decals){
        const panels=car.parts.filter(p=>p.name===(decal.name.includes('nose')?'tapered-nose':'undercut-sidepod'));
        const vertices=decal.getVerticesData('position')!;expect(vertices.length).toBeGreaterThan(0);
        for(let v=0;v<vertices.length;v+=3){const [x,y,z]=vertices.slice(v,v+3);let top=-Infinity;
          for(const panel of panels){const p=panel.getVerticesData('position')!,f=panel.getIndices()!;
            for(let i=0;i<f.length;i+=3){
              const a=f[i]*3,b=f[i+1]*3,c=f[i+2]*3,den=(p[b+2]-p[c+2])*(p[a]-p[c])+(p[c]-p[b])*(p[a+2]-p[c+2]);
              if(Math.abs(den)<1e-10)continue;
              const u=((p[b+2]-p[c+2])*(x-p[c])+(p[c]-p[b])*(z-p[c+2]))/den,w=((p[c+2]-p[a+2])*(x-p[c])+(p[a]-p[c])*(z-p[c+2]))/den;
              if(u>=-1e-5&&w>=-1e-5&&u+w<=1+1e-5)top=Math.max(top,u*p[a+1]+w*p[b+1]+(1-u-w)*p[c+1]);
            }
          }
          expect(y-top,decal.name).toBeCloseTo(.0015,4);
        }
      }car.parts.forEach(p=>p.dispose());
    }}finally{scene.dispose();engine.dispose();}
  });
});
