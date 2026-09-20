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
    if(stage<2){
      const expected=stage===1?await page.evaluate(()=>window.kairos.race.order().map(r=>r.id)):final.race.grid;
      await page.click('[data-action="next-session"]');
      const nextGrid=await page.evaluate(async()=>{
        const g=window.kairos;await g.transitionPromise;await g.advanceTime(0);
        const {CIRCUIT,pointAt}=await import('/src/content/world.ts');
        const cars=[g.player,...g.opponents.map(o=>o.vehicle)];
        const physical=Array.from({length:cars.length},(_,i)=>{const p=pointAt(CIRCUIT,CIRCUIT.length-18-Math.floor(i/2)*14,(i%2===0?-1:1)*3);const car=cars.find(v=>Math.hypot(v.node.position.x-p.x,v.node.position.z-p.z)<.01);return car?.id;});
        g.setAutopilot(true);return {stage:g.race.stage,stored:g.race.state.grid,physical,loading:g.loading,loadError:g.loadError};
      });
      reports.at(-1).nextGrid={expected,...nextGrid};
      await fs.writeFile(`${output}/report.json`,JSON.stringify({environment:'Installed Edge/WebGL2, controlled time; natural qualifying laps, physical AI practice service and actual UI transitions. Not laptop FPS or wall-clock endurance.',errors,reports},null,2));
      assert.equal(nextGrid.stage,stage+1);assert.equal(nextGrid.loading,false);assert.equal(nextGrid.loadError,'');
      assert.deepEqual(nextGrid.stored,expected);assert.deepEqual(nextGrid.physical,expected);
    }
  }
}
assert.deepEqual(errors,[]);console.log('Both race weekends and physical AI pit-service flows completed');
}finally{await browser.close();}
