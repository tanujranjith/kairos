import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const output=process.argv.find(value=>value.startsWith('--output='))?.slice(9)??'output/wet-night-driving';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],warnings=[],external=[],failed=[];
page.setDefaultTimeout(90000);
page.on('pageerror',error=>errors.push(String(error)));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());if(message.type()==='warning')warnings.push(message.text());});
page.on('requestfailed',request=>failed.push({url:request.url(),error:request.failure()?.errorText}));
await page.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1'){external.push(url);return route.abort();}return route.continue();});

const snapshot=()=>page.evaluate(()=>window.kairos.snapshot());
const lighting=()=>page.evaluate(()=>{const g=window.kairos,s=g.renderer.scene;return {
  headlights:s.lights.filter(light=>light.name.startsWith('headlamp-')).map(light=>({name:light.name,intensity:light.intensity,enabled:light.isEnabled()})),
  rainEnabled:s.getMeshByName('rain')?.isEnabled()??false,
  rainVertices:s.getMeshByName('rain')?.getTotalVertices()??0,
  streetLights:g.world.streetLighting.snapshot(),
  resources:[s.meshes.length,s.materials.length,s.textures.length,s.lights.length]
};});
const step=async(keys,ms)=>{
  for(const key of keys)await page.keyboard.down(key);
  const rows=[];for(let elapsed=0;elapsed<ms;elapsed+=100){await page.evaluate(()=>window.advanceTime(100));rows.push(await page.evaluate(()=>{const s=window.kairos.snapshot().player,c=Math.cos(s.yaw),n=Math.sin(s.yaw),forward=s.velocity.x*n+s.velocity.z*c,lateral=s.velocity.x*c-s.velocity.z*n;return {speed:s.speed,sideslip:Math.atan2(Math.abs(lateral),Math.max(.25,Math.abs(forward)))*180/Math.PI,contacts:s.wheels.filter(w=>w.contact).length,damage:s.damage,surface:s.surface};}));}
  for(const key of keys)await page.keyboard.up(key);return rows;
};

try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');
  await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  await page.waitForSelector('#loading',{state:'detached'});await page.click('#start-drive');await page.waitForSelector('#speed');
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.time=22;g.save.settings.timeRate=0;g.save.settings.weather='Rain';g.save.settings.camera=3;g.wetness=.85;g.teleport(-1340,-980,'city3');for(let frame=0;frame<20;frame++)await g.advanceTime(250);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);await g.renderer.scene.whenReadyAsync();await g.advanceTime(0);});
  await page.screenshot({path:`${output}/headlights-on.png`});const on=await lighting(),start=await snapshot();
  assert.equal(start.weather,'Rain');assert.equal(start.time,22);assert.ok(start.wetness>=.85);assert.equal(start.player.wheels.filter(w=>w.contact).length,4);assert.equal(start.player.damage,0);
  assert.ok(on.rainEnabled&&on.rainVertices===500);assert.equal(on.headlights.length,2);assert.ok(on.headlights.every(light=>light.enabled&&light.intensity>=600));

  await page.keyboard.press('KeyL');await page.evaluate(()=>window.advanceTime(0));await page.screenshot({path:`${output}/headlights-off.png`});const off=await lighting();
  assert.ok(off.headlights.every(light=>light.enabled&&light.intensity===0));assert.deepEqual(off.resources.slice(1),on.resources.slice(1));
  await page.keyboard.press('KeyL');await page.evaluate(()=>window.advanceTime(0));const restored=await lighting();assert.ok(restored.headlights.every(light=>light.intensity>=600));
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.camera=0;for(let frame=0;frame<10;frame++)await g.advanceTime(100);});

  const traces=[];traces.push(...await step(['ArrowUp'],4500));traces.push(...await step(['ArrowUp','ArrowLeft'],650));traces.push(...await step(['ArrowUp'],900));const preBrake=(await snapshot()).player.speed;traces.push(...await step(['ArrowDown'],1800));const postBrake=await snapshot();
  assert.ok(preBrake>12);assert.ok(postBrake.player.speed<preBrake*.55);assert.equal(postBrake.player.damage,0);assert.ok(traces.every(row=>row.contacts>=3&&Number.isFinite(row.sideslip)));assert.ok(Math.max(...traces.map(row=>row.sideslip))<18);
  await page.screenshot({path:`${output}/wet-braking.png`});

  const cameras=[];for(let camera=0;camera<5;camera++){
    await page.evaluate(camera=>{const g=window.kairos;g.save.settings.camera=camera;},camera);await page.evaluate(()=>window.advanceTime(250));
    await page.screenshot({path:`${output}/camera-${camera}.png`});
    cameras.push(await page.evaluate(camera=>{const g=window.kairos,p=g.renderer.camera.position,v=g.visual.root.position;return {camera,index:g.save.settings.camera,distance:Math.hypot(p.x-v.x,p.y-v.y,p.z-v.z),contacts:g.snapshot().player.wheels.filter(w=>w.contact).length};},camera));
  }
  assert.deepEqual(cameras.map(row=>row.index),[0,1,2,3,4]);assert.ok(cameras.every(row=>row.contacts===4&&Number.isFinite(row.distance)&&row.distance<15));

  await page.keyboard.press('Escape');assert.equal((await snapshot()).screen,'pause');await page.click('[data-action="resume"]');assert.equal((await snapshot()).screen,'drive');
  const final=await snapshot(),finalLight=await lighting();
  assert.equal(final.player.damage,0);assert.equal(final.player.wheels.filter(w=>w.contact).length,4);assert.ok(final.trafficSystem.physical>=10);assert.equal(final.trafficSystem.physical+final.trafficSystem.distant,24);assert.deepEqual(final.streaming.errors,[]);assert.equal(final.streaming.failed,0);assert.ok(finalLight.streetLights.some(light=>light.enabled));
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(failed,[]);
  const report={scope:'Installed Edge/WebGL2 on the development PC. Real keyboard input in streamed rainy city traffic; not target-laptop FPS or every wet route.',start,on,off,restored,preBrake,postBrake:postBrake.player,traces:{samples:traces.length,maxSpeed:Math.max(...traces.map(row=>row.speed)),maxSideslip:Math.max(...traces.map(row=>row.sideslip)),minContacts:Math.min(...traces.map(row=>row.contacts))},cameras,final,finalLight,errors,warnings,external,failed};
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({preBrake,postBrake:postBrake.player.speed,traces:report.traces,cameras,traffic:[final.trafficSystem.physical,final.trafficSystem.distant],streetLights:finalLight.streetLights.filter(light=>light.enabled).length,errors,warnings,external,failed},null,2));
}finally{await browser.close();}
