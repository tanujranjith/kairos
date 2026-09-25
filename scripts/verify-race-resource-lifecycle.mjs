import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'output/race-resource-lifecycle';await fs.mkdir(output,{recursive:true});
const requested=process.argv.includes('--webgpu')?'WebGPU':'WebGL2';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),report={requested,samples:[],errors:[]};
page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(String(e)));
try{
  await page.goto(`http://127.0.0.1:5187/${requested==='WebGL2'?'?renderer=webgl':''}`);await page.waitForSelector('#loading',{state:'detached'});await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(0);g.save.settings.automaticQuality=false;g.save.settings.timeRate=0;g.raceConfig.entrants=8;});
  report.actual=await page.evaluate(()=>window.kairos.renderer.rendererName);assert.equal(report.actual,requested);
  for(let cycle=0;cycle<4;cycle++){
    await page.evaluate(async()=>{const g=window.kairos;await g.startRace();await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);await g.action('home');await g.advanceTime(0);});
    const sample=await page.evaluate(cycle=>{const g=window.kairos,s=g.renderer.scene;return {cycle,cells:g.world.cells.size,meshes:s.meshes.map(m=>({name:m.name,id:m.uniqueId})),materials:s.materials.map(m=>({name:m.name,id:m.uniqueId})),textures:s.textures.map(t=>({name:t.name,id:t.uniqueId,users:s.materials.filter(m=>m.getActiveTextures().includes(t)).map(m=>m.name)}))};},cycle);
    report.samples.push(sample);console.log(cycle,sample.meshes.length,sample.materials.length,sample.textures.length);
  }
  await page.screenshot({path:`${output}/returned-home.png`});
}finally{await browser.close();await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));}
assert.deepEqual(report.errors,[]);
for(const sample of report.samples){assert.equal(sample.cells,0);for(const key of ['meshes','materials','textures'])assert.equal(sample[key].length,report.samples[0][key].length,`${key} grew after race cycle ${sample.cycle}`);}
