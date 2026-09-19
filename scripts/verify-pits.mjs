import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage(),errors=[],reports=[];
page.setDefaultTimeout(90000);page.on('pageerror',error=>errors.push(String(error)));
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  for(const vehicleClass of ['GT','FORMULA']){
    const result=await page.evaluate(async vehicleClass=>{const g=window.kairos;Object.assign(g.raceConfig,{kind:'Race Weekend',vehicleClass});await g.startRace();g.teleport(960,-1460,'pit');await g.advanceTime(1000);g.player.state.fuel=5;g.player.state.wheels.forEach(w=>w.wear=.4);const before=structuredClone(g.player.state);await g.action('service');const message=g.message;await g.advanceTime(6100);return {before,message,after:structuredClone(g.player.state),tank:g.player.definition.tank};},vehicleClass);
    reports.push({vehicleClass,...result});assert.equal(result.before.grounded,true);assert.match(result.message,/Service in progress/);assert.ok(result.after.fuel>result.tank*.95);assert.ok(result.after.wheels.every(w=>w.wear>.99));assert.equal(result.after.grounded,true);
    console.log(JSON.stringify({vehicleClass,grounded:result.after.grounded,fuel:result.after.fuel,wear:result.after.wheels.map(w=>w.wear)}));
  }
  assert.deepEqual(errors,[]);await fs.mkdir('output/pits',{recursive:true});await fs.writeFile('output/pits/report.json',JSON.stringify({environment:'Installed Edge / WebGL2, controlled time. Starts in the service area; not a full pit approach/rejoin test.',reports,errors},null,2));
}finally{await browser.close();}
