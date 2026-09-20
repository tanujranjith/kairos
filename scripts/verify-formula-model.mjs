import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const output='output/formula-model';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],external=[],models=[],cameras=[];
page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:5187'))external.push(r.url());});
const warm=async()=>page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();for(let i=0;i<12;i++)await g.advanceTime(0);});
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  await page.click('[data-action="screen"][data-value="garage"]');
  console.log('UI coordinates',JSON.stringify(await page.locator('[data-action="select-car"][data-value="apex"]').boundingBox()));
  await page.click('[data-action="select-car"][data-value="apex"]');
  for(const livery of [0,1,2]){
    await page.evaluate(async livery=>{const g=window.kairos;await g.action('custom',JSON.stringify({key:'livery',value:livery}));g.setScreen('garage');},livery);await warm();
    await page.screenshot({path:`${output}/gallery-${livery}.png`});
    models.push(await page.evaluate(livery=>{const g=window.kairos,v=g.visual;return {livery,asset:v.parts.some(p=>p.name.includes('instance')),parts:v.parts.length,triangles:v.parts.reduce((n,m)=>n+m.getTotalIndices()/3,0),pivots:v.wheels.map(w=>w.position.asArray()),materials:[...new Set(v.parts.map(p=>p.material).filter(Boolean))].map(m=>({name:m.name,color:m.albedoColor.asArray(),roughness:m.roughness,metallic:m.metallic}))};},livery));
    for(const [name,position]of [['front',[-3.6,-997.5,5.4]],['rear',[3.2,-997.4,-5.3]]]){
      await page.evaluate(async position=>{const g=window.kairos,{Vector3}=await import('/node_modules/@babylonjs/core/Maths/math.vector.js');document.querySelector('#ui').style.visibility='hidden';g.renderer.camera.position.set(...position);g.renderer.camera.setTarget(new Vector3(0,-999.05,0));g.renderer.camera.fov=.58;g.renderer.scene.render();},position);
      await page.screenshot({path:`${output}/${name}-${livery}.png`});await page.evaluate(()=>document.querySelector('#ui').style.visibility='');
    }
  }
  assert.equal(models[0].asset,true);assert.ok(models.slice(1).every(m=>!m.asset));assert.ok(models.every(m=>m.pivots.length===4&&m.triangles<40000));
  await page.evaluate(async()=>{const g=window.kairos;await g.action('custom',JSON.stringify({key:'livery',value:0}));g.save.settings.timeRate=0;g.save.settings.traffic=0;g.raceConfig.vehicleClass='FORMULA';g.raceConfig.entrants=8;await g.startRace();await g.advanceTime(4200);});
  await page.keyboard.down('ArrowUp');await page.evaluate(()=>window.advanceTime(2000));await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowUp');
  for(let camera=0;camera<5;camera++){
    await page.evaluate(async camera=>{const g=window.kairos;g.save.settings.camera=camera;await g.advanceTime(400);},camera);await page.waitForTimeout(110);await warm();await page.screenshot({path:`${output}/camera-${camera}.png`});
    cameras.push(await page.evaluate(camera=>{const g=window.kairos;return {camera,position:g.renderer.camera.position.asArray(),distance:g.renderer.camera.position.subtract(g.player.node.position).length(),speed:g.player.state.speed,gear:g.player.state.gear,rpm:g.player.state.rpm,display:g.visual.parts.map(p=>p.material?.metadata?.telemetry).find(Boolean),contacts:g.player.state.wheels.filter(w=>w.contact).length,damage:g.player.state.damage,opponents:g.opponents.length};},camera));
  }
  await page.keyboard.up('ArrowUp');
  assert.ok(cameras.every(c=>c.speed>10&&c.contacts===4&&c.damage===0&&c.opponents===7));
  assert.ok(cameras[1].distance<cameras[0].distance-.6);for(const c of cameras){assert.equal(c.display.speedKph,Math.round(c.speed*3.6));assert.equal(c.display.gear,String(c.gear));assert.equal(c.display.rpm,Math.round(c.rpm/100)*100);}
  await page.keyboard.press('Escape');assert.equal(await page.locator('.pause-panel [data-action="resume"]').count(),1);await page.click('[data-action="home"]');await page.waitForSelector('#start-drive');console.log('home button',JSON.stringify(await page.locator('#start-drive').boundingBox()));
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await fs.writeFile(`${output}/report.json`,JSON.stringify({models,cameras,errors,external},null,2));console.log(JSON.stringify({models,cameras,errors,external},null,2));
}finally{await browser.close();}
