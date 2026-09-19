import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],reports=[];
page.on('pageerror',e=>errors.push(String(e)));await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui,null,{timeout:60000});await page.evaluate(()=>window.advanceTime(0));
for(const vehicleClass of ['GT','FORMULA']){
  await page.evaluate(async vehicleClass=>{const g=window.kairos;Object.assign(g.raceConfig,{kind:'Race Weekend',vehicleClass,laps:3,entrants:8,position:4});await g.startRace();g.setAutopilot(true);},vehicleClass);
  for(let stage=0;stage<3;stage++){
    let pitService=null;
    if(stage===0){
      pitService=await page.evaluate(async()=>{const g=window.kairos;g.setAutopilot(false);g.teleport(960,-1460,'pit');g.advanceTime(1000);g.player.state.fuel=5;g.player.state.wheels.forEach(w=>w.wear=.4);await g.action('service');g.advanceTime(6100);const result={fuel:g.player.state.fuel,tire:g.player.state.wheels[0].wear,message:g.message};await g.action('reset');g.setAutopilot(true);return result;});
      assert.ok(pitService.fuel>90);assert.ok(pitService.tire>.99);
    }
    const samples=[];
    for(let i=0;i<42;i++){
      const sample=await page.evaluate(()=>{const g=window.kairos;g.advanceTime(15000);return {screen:g.screen,phase:g.race.state.phase,time:g.race.state.elapsed,player:g.race.player,cells:g.world.cells.size,meshes:g.renderer.scene.meshes.length,materials:g.renderer.scene.materials.length,textures:g.renderer.scene.textures.length,physicsBatchMs:g.snapshot().physicsMs};});samples.push(sample);
      if(i%10===0||sample.screen==='results')console.log(vehicleClass,'stage',stage,Math.round(sample.time),'lap',sample.player.lap,sample.screen);
      if(sample.screen==='results')break;
    }
    const final=await page.evaluate(()=>window.kairos.snapshot());assert.equal(final.screen,'results');if(stage===1)assert.ok(final.race.entrants[0].best>0&&final.race.entrants[0].best<300);reports.push({vehicleClass,stage,pitService,final,samples});
    if(stage<2){await page.click('[data-action="next-session"]');await page.evaluate(()=>window.kairos.setAutopilot(true));assert.equal(await page.evaluate(()=>window.kairos.race.stage),stage+1);}
  }
}
await fs.mkdir('output/weekends',{recursive:true});await fs.writeFile('output/weekends/report.json',JSON.stringify({environment:'Controlled simulation time, development host / Chromium SwiftShader. This is not a real-time laptop endurance or FPS test.',errors,reports},null,2));await browser.close();assert.deepEqual(errors,[]);console.log('Both race weekends and pit-service flows completed');
