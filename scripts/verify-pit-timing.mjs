import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const output='output/pit-timing';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],reports=[];page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);
  for(const vehicleClass of ['GT','FORMULA']){
    await page.evaluate(async vehicleClass=>{const {installPitTimingDriver}=await import('/src/tools/pit-timing-validation.ts');window.pitTimingCheck=await installPitTimingDriver(window.kairos,vehicleClass);},vehicleClass);
    const trace=[],captures=new Set();let final;
    for(let i=0;i<150;i++){
      final=await page.evaluate(async()=>{await window.advanceTime(5000);return window.pitTimingCheck.status();});
      trace.push({elapsed:final.elapsed,phase:final.phase,race:final.race,speed:final.vehicle.speed,position:final.vehicle.position,damage:final.vehicle.damage});
      const key=final.phase==='service'?'service':final.race.pit&&final.race.lap===2?'pit-timing':final.phase==='done'?'rejoined':null;
      if(key&&!captures.has(key)){captures.add(key);await page.screenshot({path:`${output}/${vehicleClass}-${key}.png`});if(key==='pit-timing'||key==='service')assert.match(await page.locator('#pit-limit').innerText(),/PIT LIMIT\s+37 mph/);}
      if(i%10===0)console.log(vehicleClass,final.elapsed.toFixed(1),final.phase,'lap',final.race.lap,'gate',final.race.checkpoint,'pitGate',final.race.pitCheckpoint,'valid',final.race.valid,'error',final.maxError.toFixed(2));
      if(final.race.lap>=3&&final.served)break;
    }
    reports.push({vehicleClass,final,trace});await fs.writeFile(`${output}/report.json`,JSON.stringify({environment:'Installed Edge/WebGL2, controlled time. Real session update, input-only entry/service/exit/full lap; fuel/wear faults injected at service, no position/velocity corrections.',reports,errors},null,2));
    assert.ok(final.served);assert.equal(final.phase,'done');assert.ok(final.race.lap>=3);assert.equal(final.race.valid,true);assert.equal(final.race.penalty,0);assert.ok(Number.isFinite(final.race.best));assert.ok(final.maxError<2);assert.ok(final.vehicle.damage<.01);assert.ok(final.service[1].fuel>90);assert.ok(final.service[1].wear.every(w=>w>.99));
    assert.ok(trace.every(t=>t.race.valid&&t.race.warnings===0&&t.race.penalty===0&&t.damage<.01));assert.equal(final.race.pitCheckpoint,24);assert.equal(final.race.pitValid,true);assert.equal(final.race.pitRoute,false);assert.deepEqual([...captures].sort(),['pit-timing','rejoined','service']);assert.equal(await page.locator('#pit-limit').count(),0);
    await page.evaluate(()=>window.pitTimingCheck.dispose());
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
