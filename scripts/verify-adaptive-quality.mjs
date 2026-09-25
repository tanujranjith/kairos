import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'output/adaptive-quality';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
const errors=[],external=[];page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!/^(http:\/\/127\.0\.0\.1:5187|data:|blob:)/.test(r.url()))external.push(r.url());});
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.kairos?.ui);
  const showroom=await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(0);await g.action('screen','settings');g.save.settings.automaticQuality=true;g.adaptiveQuality.reset(true);g.applySettings(true);for(let i=0;i<200;i++)g.updateAdaptiveGraphics(8);return g.snapshot().graphics;});
  assert.equal(showroom.phase,'waiting');assert.equal(showroom.benchmarkSamples,0);
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.timeRate=0;await g.startDrive();await g.advanceTime(1000);});
  const parked=await page.evaluate(()=>{const g=window.kairos;for(let i=0;i<200;i++)g.updateAdaptiveGraphics(8);return g.snapshot().graphics;});assert.equal(parked.benchmarkSamples,0);
  const preBenchmarkFloor=await page.evaluate(()=>{const g=window.kairos;for(let i=0;i<840;i++)g.updateAdaptiveGraphics(45);return g.snapshot().graphics;});assert.equal(preBenchmarkFloor.dynamicScale,.7);assert.equal(preBenchmarkFloor.benchmarkSamples,0);
  await page.keyboard.down('ArrowUp');await page.evaluate(()=>window.advanceTime(3000));await page.keyboard.up('ArrowUp');
  const moving=await page.evaluate(()=>{const g=window.kairos;return {speed:g.player.state.speed,grounded:g.player.state.grounded,cells:g.world.cells.size,traffic:g.traffic.length};});assert.ok(moving.speed>5);assert.equal(moving.grounded,true);assert.ok(moving.traffic>0);assert.ok(moving.cells>8);
  const restoredBaseline=await page.evaluate(()=>{const g=window.kairos;g.updateAdaptiveGraphics(16);return g.snapshot().graphics;});assert.equal(restoredBaseline.dynamicScale,1);assert.equal(restoredBaseline.width,parked.width);assert.equal(restoredBaseline.height,parked.height);
  await page.evaluate(()=>{const g=window.kairos;for(let i=0;i<149;i++)g.updateAdaptiveGraphics(16);});
  const firstPending=await page.evaluate(()=>window.kairos.snapshot().graphics);assert.equal(firstPending.pendingQuality,'High');
  await page.evaluate(async()=>{const g=window.kairos;await g.action('home');await g.action('screen','settings');await g.renderer.scene.whenReadyAsync();});
  const automatic=await page.evaluate(()=>window.kairos.snapshot().graphics);assert.equal(automatic.phase,'complete');assert.equal(automatic.quality,'High');assert.equal(automatic.benchmarkP95,16);assert.equal(automatic.dynamicScale,1);
  assert.equal(await page.locator('[data-setting="automaticQuality"]').isChecked(),true);assert.match(await page.locator('.settings-card').first().innerText(),/Auto selected High/);await page.screenshot({path:`${output}/automatic-settings.png`});

  await page.selectOption('[data-setting="quality"]','Medium');const manual=await page.evaluate(()=>window.kairos.snapshot().graphics);assert.equal(manual.automaticQuality,false);assert.equal(manual.phase,'manual');assert.equal(manual.quality,'Medium');assert.equal(await page.locator('[data-setting="automaticQuality"]').isChecked(),false);
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.traffic=0;g.save.settings.timeRate=0;g.save.settings.showTelemetry=true;await g.startDrive();await g.advanceTime(1000);});
  const before=await page.evaluate(()=>({player:structuredClone(window.kairos.player.state),graphics:window.kairos.snapshot().graphics}));
  await page.evaluate(async()=>{const g=window.kairos;for(let i=0;i<720;i++)g.updateAdaptiveGraphics(45);await g.advanceTime(0);});
  const floor=await page.evaluate(()=>({player:structuredClone(window.kairos.player.state),graphics:window.kairos.snapshot().graphics}));assert.deepEqual(floor.player,before.player);assert.equal(floor.graphics.quality,'Medium');assert.equal(floor.graphics.dynamicScale,.7);assert.ok(floor.graphics.width<before.graphics.width);assert.ok(floor.graphics.height<before.graphics.height);
  await page.evaluate(async()=>{const g=window.kairos;for(let i=0;i<360;i++)g.updateAdaptiveGraphics(20);await g.advanceTime(0);g.ui.update();});
  const recovered=await page.evaluate(()=>window.kairos.snapshot().graphics);assert.equal(recovered.dynamicScale,.75);assert.match(await page.locator('#telemetry').innerText(),/Medium · 75% dynamic/);await page.screenshot({path:`${output}/dynamic-drive.png`});
  await page.keyboard.down('ArrowUp');await page.evaluate(()=>window.advanceTime(3000));await page.keyboard.up('ArrowUp');
  const pending=await page.evaluate(async()=>{const g=window.kairos;await g.action('setting',JSON.stringify({key:'automaticQuality',value:true}));for(let i=0;i<150;i++)g.updateAdaptiveGraphics(16);return g.snapshot().graphics;});assert.equal(pending.phase,'complete');assert.equal(pending.quality,'Medium');assert.equal(pending.pendingQuality,'High');
  await page.evaluate(()=>window.kairos.action('home'));const applied=await page.evaluate(()=>window.kairos.snapshot());assert.equal(applied.graphics.quality,'High');assert.equal(applied.graphics.pendingQuality,null);assert.equal(applied.cells,0);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await fs.writeFile(`${output}/report.json`,JSON.stringify({environment:'Installed Edge/WebGL2 development build. Real keyboard acceleration enables representative gameplay sampling; frame intervals are injected through the real policy integration. Not target-laptop performance.',showroom,parked,preBenchmarkFloor,restoredBaseline,moving,firstPending,automatic,manual,before,floor,recovered,pending,applied:applied.graphics,errors,external},null,2));
  console.log('Adaptive quality integration passed',JSON.stringify({automatic,manual,floor:floor.graphics,recovered,pending,applied:applied.graphics}));
}finally{await browser.close();}
