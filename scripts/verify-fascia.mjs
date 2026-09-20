import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const label=process.argv.find(a=>a.startsWith('--label='))?.split('=')[1]??'after',fallback=process.argv.includes('--fallback'),output=`output/fascia/${label}`;
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],rows=[];
page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));
try{
  if(fallback)await page.route('**/models/*.glb',r=>r.abort());
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  for(const id of ['aeris','velara','crest','nova','gtx']){
    await page.evaluate(async id=>{const g=window.kairos;await g.action('select-car',id);g.setScreen('garage');g.save.settings.timeRate=0;await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();for(let n=0;n<12;n++)await g.advanceTime(0);},id);
    for(const [name,position]of [['rear',[2.8,-997.95,-5.0]],['front',[-2.8,-997.95,5.0]]]){
      await page.evaluate(async position=>{const g=window.kairos,{Vector3}=await import('/node_modules/@babylonjs/core/Maths/math.vector.js');document.querySelector('#ui').style.visibility='hidden';g.renderer.camera.position.set(...position);g.renderer.camera.setTarget(new Vector3(0,-999.06,0));g.renderer.camera.fov=.60;g.renderer.scene.render();},position);
      await page.screenshot({path:`${output}/${id}-${name}.png`});
    }
    const row=await page.evaluate(()=>{const v=window.kairos.visual,trim=v.parts.find(m=>m.material?.name.includes('carbon')).material;return {triangles:v.parts.reduce((s,m)=>s+m.getTotalIndices()/3,0),wheels:v.wheels.length,asset:v.parts.some(m=>m.name.includes('instance')),trim:{roughness:trim.roughness,direct:trim.directIntensity,specular:trim.specularIntensity,environment:trim.environmentIntensity}};});rows.push({id,...row});assert.equal(row.wheels,4);assert.ok(row.triangles<40000);
    if(label!=='before'){assert.equal(row.trim.direct,.75);assert.equal(row.trim.specular,.30);assert.equal(row.trim.environment,.35);assert.ok(Math.abs(row.trim.roughness-.82)<.0001);}
  }
  await page.evaluate(async()=>{const g=window.kairos;document.querySelector('#ui').style.visibility='';await g.action('select-car','velara');g.save.settings.traffic=0;g.save.settings.timeRate=0;await g.startDrive(true);await g.advanceTime(1000);});
  for(const weather of ['Clear','Cloudy','Rain']){
    const state=await page.evaluate(async weather=>{const g=window.kairos;g.save.settings.weather=weather;g.save.settings.time=17.4;await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();await g.advanceTime(0);return g.snapshot();},weather);
    await page.screenshot({path:`${output}/drive-${weather}.png`});assert.equal(state.player.wheels.filter(w=>w.contact).length,4);
  }
  await fs.writeFile(`${output}/report.json`,JSON.stringify({rows,errors},null,2));console.log(rows);assert.deepEqual(errors,[]);
}finally{await browser.close();}
