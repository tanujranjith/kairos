import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'output/scenery';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],external=[],checks=[],scenes=[];
page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!/^(http:\/\/127\.0\.0\.1:5187|data:|blob:)/.test(r.url()))external.push(r.url());});
const capture=async name=>{await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();for(let i=0;i<10;i++)await g.advanceTime(0);});await page.screenshot({path:`${output}/${name}.png`});};
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.timeRate=0;g.save.settings.traffic=0;await g.startDrive();await g.advanceTime(1000);});
  for(const [name,x,z,road,time,weather] of [['lakeshore',-380,100,'lakeshore',17.4,'Clear'],['noon',-380,100,'lakeshore',12,'Clear'],['city',-1340,-980,'city3',16,'Clear'],['industrial',-1280,-630,'industrial',16,'Clear'],['mountain',1130,320,'pass',17.4,'Clear'],['lake-bridge',-1070,530,'northbridge',17.4,'Clear'],['wet-night',-1340,-980,'city3',22,'Rain']]){
    await page.evaluate(async({x,z,road,time,weather})=>{const g=window.kairos;g.save.settings.time=time;g.save.settings.weather=weather;g.wetness=weather==='Rain'?.8:0;g.teleport(x,z,road);await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);},{x,z,road,time,weather});
    await capture(name);const snapshot=await page.evaluate(()=>window.kairos.snapshot());assert.equal(snapshot.player.grounded,true);assert.equal(snapshot.player.wheels.filter(w=>w.contact).length,4);assert.equal(snapshot.loading,false);const glow=await page.evaluate(()=>window.kairos.renderer.scene.getMaterialByName('architectural-glass').emissiveColor.r);if(name==='noon')assert.equal(glow,0);if(name==='wet-night')assert.equal(glow,1.1);scenes.push({name,position:snapshot.player.position,grounded:snapshot.player.grounded,damage:snapshot.player.damage,glow});
  }
  checks.push('seven region/light/weather captures remain grounded on four contacts');
  const assets=await page.evaluate(()=>{const g=window.kairos,s=g.renderer.scene,m=g.world.backdrop,p=m.getVerticesData('position'),n=m.getVerticesData('normal');return {mountainTriangles:m.getTotalIndices()/3,maxHeight:Math.max(...p.filter((_,i)=>i%3===1)),upNormals:n.filter((_,i)=>i%3===1).every(v=>v>0),wallColors:s.meshes.filter(m=>m.name.startsWith('structures')).every(m=>m.isVerticesDataPresent('color')),sky:g.renderer.atmosphere.atlas.getSize()};});
  assert.ok(assets.upNormals);assert.ok(assets.mountainTriangles<=34000);assert.ok(assets.wallColors);checks.push('mountain winding/budget and per-building material colours survive worker transfer');
  for(const vehicleClass of ['GT','FORMULA']){
    await page.evaluate(async vehicleClass=>{const g=window.kairos;g.save.settings.time=17.4;g.save.settings.weather='Clear';g.wetness=0;Object.assign(g.raceConfig,{vehicleClass,entrants:8,kind:'Quick Race'});await g.startRace();await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);},vehicleClass);
    await capture(`circuit-${vehicleClass}`);const s=await page.evaluate(()=>window.kairos.snapshot());assert.equal(s.player.wheels.filter(w=>w.contact).length,4);assert.equal(s.player.damage,0);scenes.push({name:`circuit-${vehicleClass}`,position:s.player.position,grounded:s.player.grounded,damage:s.player.damage});
  }
  const stand=await page.evaluate(async()=>{const g=window.kairos,{Vector3}=await import('/node_modules/@babylonjs/core/Maths/math.vector.js');g.renderer.camera.position.set(876,22,-1506);g.renderer.camera.setTarget(new Vector3(910,22,-1544));g.renderer.scene.render();return {detail:g.renderer.scene.meshes.find(m=>m.name.startsWith('circuit-detail'))?.getTotalIndices(),gantry:g.renderer.scene.getMeshByName('sign-aster-gantry')?.isVisible};});
  await page.screenshot({path:`${output}/grandstand-study.png`});assert.ok(stand.detail>10000);assert.equal(stand.gantry,true);checks.push('GT/Formula grid contacts and actual grandstand/gantry inspection');
  // All five original styles in isolation, at an inspection camera (not gameplay telemetry).
  await page.evaluate(async()=>{const {inspectArchitecture}=await import('/src/tools/architecture-inspection.ts');await inspectArchitecture();});await page.screenshot({path:`${output}/architecture-study.png`});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await fs.writeFile(`${output}/report.json`,JSON.stringify({checks,scenes,assets,errors,external},null,2));console.log(JSON.stringify({checks,assets,errors,external},null,2));
}finally{await browser.close();}
