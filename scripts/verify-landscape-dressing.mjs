import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const option=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3),renderer=option('renderer')??'webgl',output=option('output')??'output/landscape-dressing/live';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),report={renderer,scenes:[],errors:[],warnings:[],external:[]};
page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))report.warnings.push(m.text());});
page.on('request',r=>{if(!/^(http:\/\/127\.0\.0\.1:5187|data:|blob:)/.test(r.url()))report.external.push(r.url());});
const settle=()=>page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();for(let i=0;i<8;i++)await g.advanceTime(0);});
try{
  await page.goto(`http://127.0.0.1:5187/${renderer==='webgl'?'?renderer=webgl':''}`);await page.waitForSelector('#loading',{state:'detached'});
  await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(0);g.save.settings.timeRate=0;g.save.settings.traffic=0;await g.startDrive();});
  report.actualRenderer=await page.evaluate(()=>window.kairos.renderer.rendererName);assert.equal(report.actualRenderer,renderer==='webgl'?'WebGL2':'WebGPU');
  for(const [name,x,z,road,time,weather] of [['lake-noon',-380,100,'lakeshore',12,'Clear'],['lake-dusk',-380,100,'lakeshore',17.4,'Clear'],['forest',250,1200,'forest',12,'Clear'],['forest-lower',25,1050,'forest',16,'Clear'],['forest-upper',350,1580,'forest',17.4,'Clear'],['mountain',1130,320,'pass',16,'Clear'],['rain',-380,100,'lakeshore',15,'Rain']]){
    await page.evaluate(async args=>{const [x,z,road,time,weather]=args,g=window.kairos;g.save.settings.time=time;g.save.settings.weather=weather;g.wetness=weather==='Rain'?.8:0;g.teleport(x,z,road);await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);},[x,z,road,time,weather]);
    const before=await page.evaluate(()=>({player:window.kairos.snapshot().player,clock:window.kairos.clock}));await settle();
    assert.deepEqual(await page.evaluate(()=>({player:window.kairos.snapshot().player,clock:window.kairos.clock})),before);
    assert.equal(before.player.wheels.filter(w=>w.contact).length,4);assert.equal(before.player.damage,0);
    await page.screenshot({path:`${output}/${name}.png`});
    report.scenes.push(await page.evaluate(name=>{const g=window.kairos,s=g.renderer.scene,rocks=s.getMeshByName('rock-source'),mat=s.getMaterialByName('weathered-rock'),instances=[...g.world.streamer.records.values()].flatMap(r=>r.blueprint?.instances??[]),counts=Object.fromEntries(['pine','oak','trunk','oakTrunk','rock','grass'].map(kind=>[kind,instances.filter(i=>i.kind===kind).length]));return {name,player:g.snapshot().player,clock:g.clock,resources:[s.meshes.length,s.materials.length,s.textures.length],counts,rocks:{triangles:rocks.getTotalIndices()/3,texture:mat.albedoTexture?.name,instances:counts.rock}};},name));
    if(name==='lake-noon'){
      report.rockStudy=await page.evaluate(async()=>{const g=window.kairos,{Vector3}=await import('/node_modules/@babylonjs/core/Maths/math.vector.js'),p=g.snapshot().player.position,rock=[...g.world.streamer.records.values()].flatMap(r=>r.blueprint?.instances??[]).filter(i=>i.kind==='rock').sort((a,b)=>Math.hypot(a.position.x-p.x,a.position.z-p.z)-Math.hypot(b.position.x-p.x,b.position.z-p.z))[0];if(!rock)throw new Error('No rock in loaded cells');const r=g.renderer,c=r.camera;c.position.set(rock.position.x+7,rock.position.y+3,rock.position.z-9);c.setTarget(new Vector3(rock.position.x,rock.position.y+.4,rock.position.z));r.engine.beginFrame();try{r.scene.render();}finally{r.engine.endFrame();}return rock;});
      await page.locator('#ui').evaluate(el=>el.style.visibility='hidden');await page.screenshot({path:`${output}/rock-study.png`});await page.locator('#ui').evaluate(el=>el.style.visibility='');
    }
  }
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.weather='Clear';g.wetness=0;g.teleport(-380,100,'lakeshore');await g.advanceTime(1000);});
  await page.keyboard.down('ArrowUp');for(let i=0;i<6;i++)await page.evaluate(()=>window.advanceTime(500));await page.keyboard.up('ArrowUp');await settle();report.drive=await page.evaluate(()=>window.kairos.snapshot().player);await page.screenshot({path:`${output}/driving.png`});assert.ok(report.drive.speed>5);assert.ok(report.drive.wheels.every(w=>w.contact));assert.equal(report.drive.damage,0);
  await page.evaluate(async()=>{await window.kairos.action('home');await window.advanceTime(0);});assert.equal(await page.evaluate(()=>window.kairos.world.cells.size),0);
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);assert.deepEqual(report.warnings.filter(w=>!w.includes('The powerPreference option is currently ignored when calling requestAdapter() on Windows')),[]);
  report.scope='Development-host native browser, matched regions/weather, held-state screenshots, normal keyboard driving and home cleanup. Not target-laptop or final art acceptance.';
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({renderer:report.actualRenderer,scenes:report.scenes.map(s=>({name:s.name,resources:s.resources,rocks:s.rocks})),drive:report.drive.speed,errors:report.errors}));
}catch(error){report.failure=String(error);await fs.writeFile(`${output}/failure.json`,JSON.stringify(report,null,2));await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}finally{await browser.close();}
