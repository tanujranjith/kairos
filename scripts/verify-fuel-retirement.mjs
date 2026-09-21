import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const output=process.argv.find(v=>v.startsWith('--output='))?.slice(9)??'output/fuel-retirement';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],reports=[];
page.setDefaultTimeout(90000);page.on('pageerror',error=>errors.push(String(error)));await fs.mkdir(output,{recursive:true});
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  const classes=process.argv.includes('--gt')?['GT']:process.argv.includes('--formula')?['FORMULA']:['GT','FORMULA'];
  for(const vehicleClass of classes){
    await page.evaluate(async vehicleClass=>{const g=window.kairos;Object.assign(g.raceConfig,{kind:'Quick Race',vehicleClass,laps:3,entrants:4,position:1});g.save.settings.volume=0;g.save.settings.timeRate=0;await g.startRace();g.setAutopilot(true);},vehicleClass);
    let running;
    for(let i=0;i<180;i++){
      running=await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(1000);const r=g.race.state.entrants[1],o=g.opponents[0];return {phase:g.race.state.phase,lap:r.lap,progress:r.progress,speed:o.vehicle.state.speed,pit:o.pitDriver.snapshot().phase};});
      if(running.phase==='racing'&&running.lap>=1&&running.progress>500&&running.progress<2600&&Math.abs(running.speed)>12&&!['approach','service','exit','yield','rejoin'].includes(running.pit))break;
    }
    assert.equal(running.phase,'racing');assert.ok(running.progress>500);assert.ok(Math.abs(running.speed)>12);
    const fault=await page.evaluate(()=>{const g=window.kairos,o=g.opponents[0],v=o.vehicle,r=g.race.state.entrants[1];g.__fuelRetirementResets=0;const reset=v.reset.bind(v);v.reset=(...args)=>{g.__fuelRetirementResets++;return reset(...args);};v.state.fuel=0;return {time:g.race.state.elapsed,position:{...v.state.position},speed:v.state.speed,distance:v.state.distance,race:structuredClone(r),pit:o.pitDriver.snapshot()};});
    const coast=[];let retired;
    for(let i=0;i<160;i++){
      retired=await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(500);const o=g.opponents[0],v=o.vehicle,r=g.race.state.entrants[1];return {time:g.race.state.elapsed,position:{...v.state.position},speed:v.state.speed,distance:v.state.distance,fuel:v.state.fuel,damage:v.state.damage,grounded:v.state.grounded,retired:o.retired,depleted:o.depleted,race:structuredClone(r),resets:g.__fuelRetirementResets,pit:o.pitDriver.snapshot()};});coast.push(retired);if(retired.retired)break;
    }
    assert.equal(retired.retired,true);assert.equal(retired.race.retired,true);assert.equal(retired.race.retirementReason,'OUT OF FUEL');assert.equal(retired.race.finished,false);assert.equal(retired.fuel,0);assert.equal(retired.resets,0);assert.ok(Math.abs(retired.speed)<.85);assert.ok(retired.damage<.01);
    for(let i=1;i<coast.length;i++)assert.ok(Math.hypot(coast[i].position.x-coast[i-1].position.x,coast[i].position.z-coast[i-1].position.z)<35,'depleted car teleported during coast-down');
    const stopped=await page.evaluate(async()=>{const g=window.kairos,o=g.opponents[0],before={...o.vehicle.state.position};await g.advanceTime(3000);const after={...o.vehicle.state.position};return {before,after,moved:Math.hypot(after.x-before.x,after.z-before.z),speed:o.vehicle.state.speed,retired:o.retired,resets:g.__fuelRetirementResets};});
    assert.equal(stopped.retired,true);assert.equal(stopped.resets,0);assert.ok(stopped.moved<1.5);assert.ok(Math.abs(stopped.speed)<.5);
    let yellow;
    for(let i=0;i<320;i++){yellow=await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(500);return {time:g.race.state.elapsed,flag:g.race.state.flag,reason:g.race.state.flagReason,player:structuredClone(g.race.player),hazard:structuredClone(g.race.state.entrants[1])};});if(yellow.flag==='YELLOW'&&yellow.reason==='STOPPED CAR AHEAD')break;}
    assert.equal(yellow.flag,'YELLOW');assert.equal(yellow.reason,'STOPPED CAR AHEAD');const flagText=await page.locator('#race-flag').innerText();assert.match(flagText,/YELLOW · STOPPED CAR AHEAD/);await page.screenshot({path:`${output}/${vehicleClass}-yellow.png`});
    await page.evaluate(async()=>{const g=window.kairos,o=g.opponents[0],p=o.vehicle.node.position;document.querySelector('#ui').style.visibility='hidden';g.renderer.camera.position.set(p.x-11,p.y+5,p.z-11);g.renderer.camera.setTarget(p);await g.renderer.scene.whenReadyAsync();g.renderer.scene.render();});
    await page.screenshot({path:`${output}/${vehicleClass}-retired-car.png`});await page.evaluate(()=>document.querySelector('#ui').style.visibility='');
    const report={vehicleClass,running,fault,coast,retired,stopped,yellow,flagText,final:null,row:''};reports.push(report);let final;
    for(let i=0;i<60;i++){final=await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(15000);return g.snapshot();});report.final=final;if(i%10===0)await fs.writeFile(`${output}/report.json`,JSON.stringify({environment:'Installed Edge/WebGL2 controlled time. Fuel is faulted to zero at racing speed away from pit entry; all motion thereafter is normal physics and runtime AI input. Reset calls are instrumented but retain original behavior.',reports,errors},null,2));if(final.screen==='results')break;}
    assert.equal(final.screen,'results');const entry=final.race.entrants[1];assert.equal(entry.retired,true);assert.equal(entry.retirementReason,'OUT OF FUEL');assert.equal(entry.finished,false);assert.ok(final.race.entrants.filter(r=>r.id!=='racer-1').every(r=>r.finished));
    const row=await page.locator('[data-racer-id="racer-1"]').innerText();report.row=row;assert.match(row,/DNF · OUT OF FUEL/);await page.screenshot({path:`${output}/${vehicleClass}-results.png`});
    await fs.writeFile(`${output}/report.json`,JSON.stringify({environment:'Installed Edge/WebGL2 controlled time. Fuel is faulted to zero at racing speed away from pit entry; all motion thereafter is normal physics and runtime AI input. Reset calls are instrumented but retain original behavior.',reports,errors},null,2));
  }
  assert.deepEqual(errors,[]);
}catch(error){await fs.writeFile(`${output}/failure.json`,JSON.stringify({error:String(error),reports,errors},null,2));throw error;}finally{await browser.close();}
