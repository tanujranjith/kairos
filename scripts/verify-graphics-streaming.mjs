import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'output/graphics-streaming';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],external=[];
page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:5187')&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
const capture=async name=>{await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();await g.advanceTime(0);});await page.screenshot({path:`${output}/${name}.png`});};
const checks=[];
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));await capture('showroom');
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.timeRate=0;g.save.settings.traffic=0;await g.startDrive();await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);});
  await capture('lakeshore-day');
  const initial=await page.evaluate(()=>window.kairos.snapshot());assert.equal(initial.player.grounded,true);assert.equal(initial.loading,false);checks.push('asynchronous session entry is grounded');
  const hold=await page.evaluate(async()=>{
    const g=window.kairos,worker=g.world.worker,original=worker.build.bind(worker);window.releaseCellBuild=null;window.restoreBuild=()=>worker.build=original;
    const gate=new Promise(resolve=>window.releaseCellBuild=resolve);worker.build=async(...args)=>{await gate;return original(...args);};
    g.world.clear();g.teleport(-1340,-980,'city3');const clock=g.clock,position={...g.player.node.position};const stepped=g.step();await g.advanceTime(0);return {stepped,clock,now:g.clock,position,loading:g.loading};
  });assert.equal(hold.stepped,false);assert.equal(hold.clock,hold.now);assert.equal(hold.loading,true);assert.equal(await page.locator('#world-loading').isVisible(),true);await page.screenshot({path:`${output}/loading-pause.png`});checks.push('missing collisions freeze simulation and show overlay');
  await page.evaluate(async()=>{window.restoreBuild();window.releaseCellBuild();await window.advanceTime(1000);});assert.equal(await page.locator('#world-loading').isVisible(),false);checks.push('deferred worker resumes controlled time safely');
  await page.evaluate(()=>{const g=window.kairos;g.world.clear();g.world.worker.build=async()=>{throw new Error('Injected recoverable world-generation failure');};g.teleport(400,1300);});
  const failure=await page.evaluate(async()=>{try{await window.advanceTime(1000);return 'unexpected success';}catch(error){window.kairos.step();return String(error);}});assert.match(failure,/Injected/);assert.equal(await page.locator('#world-retry').isVisible(),true);assert.equal(await page.evaluate(()=>document.activeElement.id),'world-retry');
  const failedClock=await page.evaluate(()=>window.kairos.clock);await page.evaluate(()=>window.restoreBuild());await page.click('#world-retry');await page.evaluate(()=>window.advanceTime(1000));assert.equal(await page.locator('#world-loading').isVisible(),false);assert.ok(Math.abs(await page.evaluate(()=>window.kairos.clock)-failedClock-1)<1e-6);checks.push('failed cell load exposes focused retry and recovers without replaying rejected time');
  await page.evaluate(async()=>{const g=window.kairos;g.teleport(-380,100,'lakeshore');await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);});await capture('lakeshore-recovered');
  const resources=await page.evaluate(async()=>{
    const g=window.kairos,samples=[];const draw=g.renderer.render;g.renderer.render=()=>{};
    try{for(let lap=0;lap<3;lap++)for(const [x,z,road]of [[-1340,-980,'city3'],[400,1300,undefined],[-380,100,'lakeshore']]){
      g.teleport(x,z,road);await g.advanceTime(1000);g.world.warm.clear();g.world.update(g.player.state.position,g.player.state.velocity,[]);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);samples.push({lap,x,z,stream:g.world.snapshot(),meshes:g.renderer.scene.meshes.length,materials:g.renderer.scene.materials.length,textures:g.renderer.scene.textures.length});
    }}finally{g.renderer.render=draw;}return samples;
  });
  const end=resources.filter(r=>r.x===-380);assert.equal(end[0].meshes,end[2].meshes);assert.equal(end[0].materials,end[2].materials);assert.equal(end[0].textures,end[2].textures);checks.push('three region circuits release obsolete resources without mesh/material/texture growth');
  await page.evaluate(async()=>{const g=window.kairos;g.teleport(-1340,-980,'city3');await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);});await capture('city-day');
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.time=22;g.save.settings.weather='Rain';g.wetness=.85;await g.advanceTime(0);});await capture('wet-night');
  const race=await page.evaluate(async()=>{const g=window.kairos;g.save.settings.time=16;g.save.settings.weather='Clear';g.raceConfig.entrants=8;await g.startRace();await g.advanceTime(1000);const {CIRCUIT,PIT}=await import('/src/content/world.ts');return {snapshot:g.snapshot(),allReserved:[...CIRCUIT.points,...PIT.points].every(p=>g.world.hasSurface(p)),sceneMeshes:g.renderer.scene.meshes.length};});assert.ok(race.allReserved);assert.equal(race.snapshot.streaming.profile,'racing');assert.equal(race.snapshot.opponents.length,7);checks.push('eight-car race reserves circuit and pit collision resources');await capture('race-grid');
  await page.evaluate(async()=>{await window.kairos.action('home');await window.advanceTime(0);});checks.push('return-to-showroom releases world cells');assert.equal(await page.evaluate(()=>window.kairos.world.cells.size),0);
  const raceResources=await page.evaluate(async()=>{
    const g=window.kairos,s=g.renderer.scene,samples=[];
    for(let cycle=0;cycle<3;cycle++){
      await g.startRace();await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);
      const gantry=s.getMeshByName('sign-aster-gantry')?.isVisible===true,stand=s.meshes.some(m=>m.name.startsWith('circuit-detail'));
      await g.action('home');await g.advanceTime(0);
      samples.push({cycle,gantry,stand,cells:g.world.cells.size,meshes:s.meshes.length,materials:s.materials.length,textures:s.textures.length,signRetained:s.materials.some(m=>m.name==='signmat-aster-gantry'),detailRetained:s.meshes.some(m=>m.name.startsWith('circuit-detail'))});
    }return samples;
  });
  for(const sample of raceResources){assert.equal(sample.gantry,true);assert.equal(sample.stand,true);assert.equal(sample.cells,0);assert.equal(sample.signRetained,false);assert.equal(sample.detailRetained,false);for(const key of ['meshes','materials','textures'])assert.equal(sample[key],raceResources[0][key]);}checks.push('three race/home cycles dispose mounted-sign and grandstand resources without count growth');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);checks.push('no page errors or external requests');
  await fs.writeFile(`${output}/report.json`,JSON.stringify({checks,initial,hold,resources,race,raceResources,errors,external},null,2));console.log(JSON.stringify({checks,resources:resources.map(({stream,...r})=>({...r,cells:stream.ready})),raceResources,errors,external},null,2));
}catch(error){
  await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});
  await fs.writeFile(`${output}/failure.json`,JSON.stringify({error:String(error),errors,external,url:page.url(),loading:await page.locator('#loading-message').textContent({timeout:1000}).catch(()=>null)},null,2));throw error;
}finally{await browser.close();}
