import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const output='output/render-detail';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],external=[],checks=[];
page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:5187'))external.push(r.url());});
const capture=async name=>{await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();for(let i=0;i<10;i++)await g.advanceTime(0);});await page.screenshot({path:`${output}/${name}.png`});};
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));await capture('showroom');
  const lods=await page.evaluate(async()=>{
    const g=window.kairos,{createLodCar}=await import('/src/render/car-lod.ts'),{VEHICLES}=await import('/src/content/vehicles.ts');
    const scene=g.renderer.scene,baseline={meshes:scene.meshes.length,materials:scene.materials.length,nodes:scene.transformNodes.length},rows=[];
    for(const d of VEHICLES)for(const livery of [0,1]){
      const car=createLodCar(scene,d,{paint:'#bc4321',wheels:'#718595',livery,brakeBias:.6,aero:1});g.renderer.registerCar(car);
      const root=car.root,parts=car.parts.length,paint=car.paint.albedoColor.asArray();
      const count=()=>car.parts.filter(m=>m.isEnabled()).reduce((n,m)=>n+m.getTotalIndices()/3,0);
      car.selectDetail(10,'Low');car.update(g.player.state);const near=count(),nearPaint=car.paint.albedoColor.asArray();
      car.selectDetail(70,'Low');car.update(g.player.state);const far=count(),farPaint=car.paint.albedoColor.asArray();
      for(let i=0;i<30;i++){car.selectDetail(i%2?10:70,'Low');car.update(g.player.state);g.renderer.registerCar(car);}
      rows.push({id:d.id,livery,near,far,paint,nearPaint,farPaint,stableRoot:root===car.root,partsStable:car.parts.length===parts,pivots:car.wheels.length,finite:car.wheels.every(w=>w.position.asArray().every(Number.isFinite)),contacts:car.root.getChildMeshes().filter(m=>m.name==='car-contact-shadow').length});
      car.dispose();car.dispose();
    }
    return {rows,baseline,after:{meshes:scene.meshes.length,materials:scene.materials.length,nodes:scene.transformNodes.length}};
  });
  for(const row of lods.rows){assert.ok(row.far<row.near*.72,JSON.stringify(row));assert.equal(row.stableRoot,true);assert.equal(row.partsStable,true);assert.equal(row.pivots,4);assert.equal(row.finite,true);assert.equal(row.contacts,1);assert.deepEqual(row.nearPaint,row.farPaint);}
  assert.deepEqual(lods.after,lods.baseline);checks.push('six GLB and six livery rigs switch detail, preserve paint/pivots, reduce geometry and dispose without resource growth');
  const probes=await page.evaluate(async()=>{
    const g=window.kairos,r=g.renderer;await g.advanceTime(0);const first=r.reflections.snapshot();
    for(let i=0;i<20;i++)await g.advanceTime(0);
    const idle=r.reflections.snapshot();
    const probe=r.reflections.probe;
    return {first,idle,capturedNames:probe.renderList.map(m=>m.name),probes:r.scene.reflectionProbes.length,targets:r.scene.customRenderTargets.filter(t=>t===probe.cubeTexture).length,local:g.visual.paint.reflectionTexture===probe.cubeTexture,feedback:probe.renderList.some(m=>{let n=m;while(n){if(n.metadata?.kairosCar)return true;n=n.parent;}return false;})};
  });
  assert.equal(probes.first.captures,probes.idle.captures);assert.equal(probes.probes,2);assert.equal(probes.targets,0);assert.equal(probes.local,true);assert.equal(probes.feedback,false);assert.ok(probes.idle.meshes>6&&probes.idle.meshes<=16);assert.ok(probes.capturedNames.includes('showroom-floor'));assert.ok(probes.idle.trianglesPerFace<=16000);checks.push('static showroom caches a double-buffered local probe containing actual architecture, with cars excluded from capture feedback');
  const presets=await page.evaluate(async()=>{
    const g=window.kairos,result=[];
    for(const quality of ['High','Low','Ultra','Low']){g.save.settings.quality=quality;g.renderer.applySettings(g.save.settings);await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();for(let i=0;i<10;i++)await g.advanceTime(0);result.push({quality,...g.renderer.reflections.snapshot(),probes:g.renderer.scene.reflectionProbes.length,targets:g.renderer.scene.customRenderTargets.filter(t=>t.name.startsWith('kairos-local-reflection')).length});}
    return result;
  });
  for(const row of presets){assert.equal(row.probes,2);assert.equal(row.targets,0);assert.equal(row.size,row.quality==='Low'?128:256);}checks.push('preset switches release obsolete cubemaps');
  const incremental=await page.evaluate(async()=>{
    const g=window.kairos,r=g.renderer.reflections,old=g.visual.paint.reflectionTexture,rows=[];g.cameraClock+=3;g.save.settings.weather='Cloudy';
    for(let i=0;i<8;i++){const before=r.snapshot();await g.advanceTime(0);const after=r.snapshot();rows.push({before,after,retained:g.visual.paint.reflectionTexture===old});}return rows;
  });
  assert.ok(incremental.every(r=>r.after.faceSubmissions-r.before.faceSubmissions<=1));assert.ok(incremental.slice(0,5).every(r=>r.retained));assert.equal(incremental.at(-1).retained,false);checks.push('one face per displayed frame and old complete cube retained until the new six-face capture is ready');
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.timeRate=0;g.save.settings.traffic=12;await g.startDrive();await g.advanceTime(1000);});await capture('lakeshore');
  const traffic=await page.evaluate(()=>{const g=window.kairos;return {rows:g.traffic.map(t=>({lod:t.visual.lod,distance:t.visual.root.position.subtract(g.renderer.camera.position).length()})),probe:g.renderer.reflections.snapshot()};});
  assert.ok(traffic.rows.some(t=>t.lod===1));assert.ok(traffic.probe.captures>probes.idle.captures);checks.push('live traffic uses distance-based LOD and the outdoor probe refreshes after leaving the garage');
  await page.keyboard.down('ArrowUp');await page.evaluate(()=>window.advanceTime(2000));await page.keyboard.up('ArrowUp');assert.ok(await page.evaluate(()=>window.kairos.player.state.speed)>5);await capture('driving');
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.time=22;g.save.settings.weather='Rain';g.wetness=.8;await g.advanceTime(2100);});await capture('wet-night');
  await page.evaluate(async()=>{const g=window.kairos;await g.action('home');g.save.settings.time=17.4;g.save.settings.weather='Clear';g.raceConfig.entrants=8;await g.startRace();await g.advanceTime(1000);});await capture('race-grid');
  const grid=await page.evaluate(()=>window.kairos.opponents.map(o=>({lod:o.visual.lod,triangles:o.visual.parts.filter(m=>m.isEnabled()).reduce((n,m)=>n+m.getTotalIndices()/3,0)})));
  assert.ok(grid.some(r=>r.lod===0));assert.ok(grid.some(r=>r.lod===1));
  const distantRace=await page.evaluate(async()=>{const g=window.kairos;g.renderer.camera.position.z+=160;for(const o of g.opponents)o.visual.selectDetail(o.visual.root.position.subtract(g.renderer.camera.position).length(),'Low');return g.opponents.map(o=>o.visual.lod);});
  assert.ok(distantRace.every(lod=>lod===1));checks.push('compact eight-car grid keeps nearby detail; distant racing rigs switch to low detail');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  const report={checks,lods,probes,presets,traffic,grid,errors,external};await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
