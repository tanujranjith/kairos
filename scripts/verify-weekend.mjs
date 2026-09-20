import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'output/weekends';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],reports=[];
try{
await fs.mkdir(output,{recursive:true});page.setDefaultTimeout(90000);
page.on('pageerror',e=>errors.push(String(e)));await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui,null,{timeout:60000});await page.evaluate(()=>window.advanceTime(0));
for(const vehicleClass of ['GT','FORMULA']){
  await page.evaluate(async vehicleClass=>{const g=window.kairos;Object.assign(g.raceConfig,{kind:'Race Weekend',vehicleClass,laps:3,entrants:8,position:4});await g.startRace();g.setAutopilot(true);},vehicleClass);
  for(let stage=0;stage<3;stage++){
    let pitService=null;
    if(stage===0){
      // Fault injection changes fuel once on the actual grid; no teleport,
      // manual service, velocity correction, reset or skipped driving segment.
      await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(1000);g.opponents[0].vehicle.state.fuel=6;});
    }
    const samples=[];
    for(let i=0;i<42;i++){
      const sample=await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(15000);return {screen:g.screen,phase:g.race.state.phase,time:g.race.state.elapsed,player:g.race.player,cells:g.world.cells.size,meshes:g.renderer.scene.meshes.length,materials:g.renderer.scene.materials.length,textures:g.renderer.scene.textures.length,physicsBatchMs:g.snapshot().physicsMs};});samples.push(sample);
      if(i%10===0||sample.screen==='results')console.log(vehicleClass,'stage',stage,Math.round(sample.time),'lap',sample.player.lap,sample.screen);
      if(sample.screen==='results')break;
    }
    const final=await page.evaluate(()=>window.kairos.snapshot()),vehicleDamage=await page.evaluate(()=>[window.kairos.player,...window.kairos.opponents.map(o=>o.vehicle)].map(v=>({id:v.id,damage:v.state.damage})));
    if(stage===0)pitService=await page.evaluate(()=>{const o=window.kairos.opponents[0];return {pit:o.pitDriver.snapshot(),fuel:o.vehicle.state.fuel,tires:o.vehicle.state.wheels.map(w=>w.wear),race:window.kairos.race.state.entrants[1]};});
    reports.push({vehicleClass,stage,pitService,final,vehicleDamage,samples});await page.screenshot({path:`${output}/${vehicleClass}-${stage}.png`});
    await fs.writeFile(`${output}/report.json`,JSON.stringify({environment:'Installed Edge/WebGL2, controlled simulation time; physical AI pit strategy during practice and actual UI session transitions. Not laptop FPS or wall-clock endurance.',errors,reports},null,2));
    assert.equal(final.screen,'results');if(stage===1)assert.ok(final.race.entrants[0].best>0&&final.race.entrants[0].best<300);
    if(stage===0){assert.equal(pitService.pit.stops,1);assert.equal(pitService.pit.phase,'circuit');assert.ok(pitService.fuel>80);assert.ok(pitService.tires.every(w=>w>.99));assert.equal(pitService.race.pitCheckpoint,24);assert.equal(pitService.race.pitValid,true);}
    if(stage===2)assert.ok(final.race.entrants.every(r=>r.finished),'Not every entrant classified');
    assert.ok(final.race.entrants.every(r=>r.warnings===0&&r.penalty===0),'Warnings or penalties in the normal field');
    assert.ok(vehicleDamage.every(v=>v.damage<.01),'Damaged entrant');
    if(stage<2){await page.click('[data-action="next-session"]');await page.evaluate(()=>window.kairos.setAutopilot(true));assert.equal(await page.evaluate(()=>window.kairos.race.stage),stage+1);}
  }
}
assert.deepEqual(errors,[]);console.log('Both race weekends and physical AI pit-service flows completed');
}finally{await browser.close();}
