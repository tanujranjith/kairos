import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const option=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const renderer=option('renderer')??'webgl',output=option('output')??'output/ground-cover/live';assert.ok(['webgl','auto'].includes(renderer));await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),report={scenes:[],errors:[],warnings:[],external:[]};
page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))report.warnings.push(m.text());});
page.on('request',r=>{if(!/^(http:\/\/127\.0\.0\.1:5187|data:|blob:)/.test(r.url()))report.external.push(r.url());});
const capture=async name=>{await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();for(let i=0;i<10;i++)await g.advanceTime(0);});await page.screenshot({path:`${output}/${name}.png`});};
try{
  await page.goto(`http://127.0.0.1:5187/${renderer==='webgl'?'?renderer=webgl':''}`);await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  report.renderer=await page.evaluate(()=>window.kairos.renderer.rendererName);assert.equal(report.renderer,renderer==='webgl'?'WebGL2':'WebGPU');
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.timeRate=0;g.save.settings.traffic=0;await g.startDrive();await g.advanceTime(1000);});
  const heldClock=await page.evaluate(()=>window.kairos.clock);
  for(let i=0;i<16;i++)await page.evaluate(()=>window.advanceTime(0));
  assert.equal(await page.evaluate(()=>window.kairos.clock),heldClock);report.controlledFrames=16;
  for(const [name,x,z,road,time,weather]of [
    ['lakeshore',-380,100,'lakeshore',17.4,'Clear'],['noon',-380,100,'lakeshore',12,'Clear'],['city',-1340,-980,'city3',16,'Clear'],
    ['industrial',-1280,-630,'industrial',16,'Clear'],['mountain',1130,320,'pass',17.4,'Clear'],['lake-bridge',-1070,530,'northbridge',17.4,'Clear'],
    ['forest',100,1150,'forest',16,'Clear'],['wet-night',-1340,-980,'city3',22,'Rain']]){
    await page.evaluate(async({x,z,road,time,weather})=>{const g=window.kairos;g.save.settings.time=time;g.save.settings.weather=weather;g.wetness=weather==='Rain'?.8:0;g.teleport(x,z,road);await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);},{x,z,road,time,weather});
    await capture(name);
    const row=await page.evaluate(()=>{const g=window.kairos,s=g.renderer.scene;return {state:g.snapshot(),materials:['meadow','atmospheric-ridges'].map(name=>({name,plugin:!!s.getMaterialByName(name)?.pluginManager?.getPlugin('KairosGround')})),terrain:s.meshes.filter(m=>m.name.startsWith('terrain-')).map(m=>({name:m.name,triangles:m.getTotalIndices()/3,colors:m.isVerticesDataPresent('color'),ready:m.isReady(true)}))};});
    assert.equal(row.state.player.damage,0);assert.equal(row.state.player.wheels.filter(w=>w.contact).length,4);assert.ok(row.materials.every(m=>m.plugin));assert.ok(row.terrain.length>0&&row.terrain.every(m=>m.ready&&m.colors));report.scenes.push({name,...row});
  }
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.time=16;g.save.settings.weather='Clear';g.wetness=0;g.teleport(-380,100,'lakeshore');await g.advanceTime(1000);});
  await page.keyboard.down('ArrowUp');for(let i=0;i<6;i++)await page.evaluate(()=>window.advanceTime(500));await page.keyboard.up('ArrowUp');await capture('driving');
  report.drive=await page.evaluate(()=>window.kairos.snapshot());assert.ok(report.drive.player.speed>5);assert.equal(report.drive.player.wheels.filter(w=>w.contact).length,4);assert.equal(report.drive.player.damage,0);
  await page.evaluate(async()=>{await window.kairos.action('home');await window.advanceTime(0);});assert.equal(await page.evaluate(()=>window.kairos.world.cells.size),0);
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);assert.deepEqual(report.warnings.filter(w=>!w.includes('The powerPreference option is currently ignored when calling requestAdapter() on Windows')),[]);
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({renderer:report.renderer,scenes:report.scenes.map(s=>s.name),speed:report.drive.player.speed,errors:report.errors,warnings:report.warnings},null,2));
}catch(error){report.failure=String(error);await fs.writeFile(`${output}/failure.json`,JSON.stringify(report,null,2));await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}finally{await browser.close();}
