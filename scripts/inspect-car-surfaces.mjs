import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const option=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const output=option('output')??'output/car-surfaces',ids=(option('ids')??'velara,gtx,apex').split(','),fallback=process.argv.includes('--fallback');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],rows=[];
page.setDefaultTimeout(90000);page.on('pageerror',error=>errors.push(String(error)));
try{
  if(fallback)await page.route('**/models/*.glb',route=>route.abort());
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  for(const id of ids){
    await page.evaluate(async id=>{const g=window.kairos;await g.action('select-car',id);g.setScreen('garage');g.cameraClock=0;g.save.settings.time=17.4;g.save.settings.timeRate=0;g.save.settings.volume=0;for(let n=0;n<12;n++){await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();}},id);
    for(const [view,position]of [['front',[-3.4,-997.8,5.1]],['rear',[3.4,-997.7,-5.1]],['side',[-5.8,-998.25,.4]]]){
      await page.evaluate(async position=>{const g=window.kairos,{Vector3}=await import('/node_modules/@babylonjs/core/Maths/math.vector.js');document.querySelector('#ui').style.visibility='hidden';g.renderer.camera.position.set(...position);g.renderer.camera.setTarget(new Vector3(0,-999,0));g.renderer.camera.fov=.60;g.renderer.scene.render();await g.renderer.scene.whenReadyAsync();g.renderer.scene.render();},position);
      await page.screenshot({path:`${output}/${id}-${view}.png`});
    }
    rows.push(await page.evaluate(id=>{const v=window.kairos.visual;return {id,asset:v.parts.some(p=>p.name.includes('instance')),triangles:v.parts.reduce((n,p)=>n+p.getTotalIndices()/3,0),parts:v.parts.length,paint:{metallic:v.paint.metallic,roughness:v.paint.roughness,coat:v.paint.clearCoat.roughness,environment:v.paint.environmentIntensity},finite:v.parts.filter(p=>p.getTotalVertices()>0).every(p=>p.getVerticesData('normal')?.every(Number.isFinite))};},id));
    await page.evaluate(()=>document.querySelector('#ui').style.visibility='');console.log(id,'matched body views captured');
  }
  assert.deepEqual(errors,[]);assert.ok(rows.every(r=>r.finite));
  await fs.writeFile(`${output}/report.json`,JSON.stringify({fallback,rows,errors},null,2));
}finally{await browser.close();}
