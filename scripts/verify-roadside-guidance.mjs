import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const output=process.argv.find(v=>v.startsWith('--output='))?.slice(9)??'output/roadside-guidance/curves';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],warnings=[],external=[],scenes=[];
page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))warnings.push(m.text());});
page.on('request',r=>{if(!/^(http:\/\/127\.0\.0\.1:5187|data:|blob:)/.test(r.url()))external.push(r.url());});
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForSelector('#loading',{state:'detached'});
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.timeRate=0;g.save.settings.traffic=0;await g.startDrive();});
  const inventory=await page.evaluate(async()=>{const {roadsideGuidance}=await import('/src/world/roadside-guidance.ts');const delineators=[],chevrons=[];for(let cx=-9;cx<=8;cx++)for(let cz=-9;cz<=8;cz++){const data=roadsideGuidance(cx,cz);delineators.push(...data.delineators);chevrons.push(...data.chevrons);}return {delineators:delineators.length,chevrons};});
  assert.ok(inventory.delineators>300);assert.ok(inventory.chevrons.length>=4&&inventory.chevrons.length<20);
  for(const [name,x,z,time,weather] of [['western-hairpin',1430,650,16,'Clear'],['summit-hairpin',650,1480,20.5,'Rain']]){
    const row=await page.evaluate(async({x,z,time,weather})=>{const g=window.kairos;g.save.settings.time=time;g.save.settings.weather=weather;g.wetness=weather==='Rain'?.8:0;g.teleport(x,z,'pass');await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);for(let i=0;i<10;i++)await g.advanceTime(0);const {roadsideGuidance}=await import('/src/world/roadside-guidance.ts'),loaded=[...g.world.cells.values()].flatMap(c=>roadsideGuidance(c.cx,c.cz).chevrons);return {player:g.snapshot().player,loaded:loaded.length,resources:[g.renderer.scene.meshes.length,g.renderer.scene.materials.length,g.renderer.scene.textures.length],streaming:g.snapshot().streaming};},{x,z,time,weather});
    assert.equal(row.player.wheels.filter(w=>w.contact).length,4);assert.equal(row.player.damage,0);assert.ok(row.loaded>0);assert.equal(row.streaming.errors.length,0);scenes.push({name,...row});await page.screenshot({path:`${output}/${name}.png`});
  }
  await page.keyboard.down('ArrowUp');for(let i=0;i<6;i++)await page.evaluate(()=>window.advanceTime(500));await page.keyboard.up('ArrowUp');for(let i=0;i<8;i++)await page.evaluate(()=>window.advanceTime(0));
  const drive=await page.evaluate(()=>window.kairos.snapshot().player);assert.ok(drive.speed>5);assert.equal(drive.wheels.filter(w=>w.contact).length,4);assert.equal(drive.damage,0);await page.screenshot({path:`${output}/rain-driving.png`});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(warnings.filter(w=>!w.includes('The powerPreference option is currently ignored when calling requestAdapter() on Windows')),[]);
  const report={inventory,scenes,drive,errors,warnings,external,scope:'Installed Edge/WebGL2 on development host; authored curve views and normal keyboard input. Not target-laptop FPS or final world-art acceptance.'};await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({delineators:inventory.delineators,chevrons:inventory.chevrons.length,scenes:scenes.map(s=>({name:s.name,loaded:s.loaded,resources:s.resources})),drive:drive.speed,errors},null,2));
}catch(error){await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}finally{await browser.close();}
