import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const output=process.argv.find(v=>v.startsWith('--output='))?.slice(9)??'output/race-flags';
await fs.mkdir(output,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.setDefaultTimeout(90000);page.on('pageerror',error=>errors.push(String(error)));
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  await page.evaluate(async()=>{const g=window.kairos;Object.assign(g.raceConfig,{kind:'Quick Race',vehicleClass:'GT',laps:3,entrants:4,position:4});g.save.settings.volume=0;g.save.settings.timeRate=0;await g.startRace();});
  const trace=[];let blue;
  for(let i=0;i<720;i++){
    blue=await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(500);return {screen:g.screen,time:g.race.state.elapsed,flag:g.race.state.flag,reason:g.race.state.flagReason,player:structuredClone(g.race.player),entrants:g.race.state.entrants.map(r=>({id:r.id,lap:r.lap,progress:r.progress,finished:r.finished,retired:r.retired})),position:{...g.player.state.position},speed:g.player.state.speed,damage:g.player.state.damage};});
    if(i%20===0)trace.push(blue);if(blue.flag==='BLUE')break;
  }
  assert.equal(blue.screen,'drive');assert.equal(blue.flag,'BLUE');assert.equal(blue.reason,'FASTER CAR APPROACHING');assert.equal(blue.player.finished,false);assert.equal(blue.player.retired,false);assert.ok(blue.entrants.some(r=>r.id!=='player'&&!r.finished&&!r.retired&&r.lap>blue.player.lap));assert.ok(blue.damage<.01);
  const flagText=await page.locator('#race-flag').innerText();assert.match(flagText,/BLUE · FASTER CAR APPROACHING/);await page.screenshot({path:`${output}/blue.png`});const report={environment:'Installed Edge/WebGL2 controlled time. Player remains under neutral physical input at P4 while three normal AI entrants circulate; no position, velocity, timing or race-state correction.',blue,flagText,trace,errors};await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));assert.deepEqual(errors,[]);
}catch(error){await fs.writeFile(`${output}/failure.json`,JSON.stringify({error:String(error),errors},null,2));throw error;}finally{await browser.close();}
