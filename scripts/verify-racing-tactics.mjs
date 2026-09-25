import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const output='output/racing-tactics';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForSelector('#loading',{state:'detached'});
  const report=await page.evaluate(async()=>{
    const g=window.kairos,{CIRCUIT,pointAt,nearestRoad}=await import('/src/content/world.ts');
    // Reuse the app's exact Vite URL (including its HMR stamp) so the diagnostic
    // reads the same module-owned WeakMap as the live driver.
    const aiUrl=performance.getEntriesByType('resource').find(r=>new URL(r.name).pathname==='/src/sim/ai.ts')?.name;
    const {racingTactic}=await import(aiUrl??'/src/sim/ai.ts');
    await g.advanceTime(0);Object.assign(g.raceConfig,{kind:'Practice',vehicleClass:'GT',entrants:2});await g.startRace();g.setAutopilot(true);
    const lead=g.opponents[0].vehicle;
    // Scenario setup only: a worn-tire rival naturally uses the existing limp
    // pace. Neither car's velocity, steering nor position is corrected later.
    for(const [v,s]of [[g.player,160],[lead,190]]){const p=pointAt(CIRCUIT,s,0);v.reset(p,p.yaw);v.state.distance=500;}
    await g.advanceTime(1000);lead.state.wheels.forEach(w=>w.wear=.4);
    const rows=[];
    for(let i=0;i<175;i++){
      await g.advanceTime(200);
      const p=nearestRoad(g.player.state.position.x,g.player.state.position.z,r=>r.id==='circuit'),l=nearestRoad(lead.state.position.x,lead.state.position.z,r=>r.id==='circuit');
      rows.push({time:i*.2,gap:(l.progress-p.progress+CIRCUIT.length*1.5)%CIRCUIT.length-CIRCUIT.length*.5,offset:p.lateral,leadOffset:l.lateral,speed:g.player.state.speed,leadSpeed:lead.state.speed,tactic:racingTactic(g.player),damage:g.player.state.damage+lead.state.damage,contacts:g.player.state.wheels.filter(w=>w.contact).length});
    }
    return {rows,final:g.snapshot()};
  });
  await page.screenshot({path:`${output}/passing.png`});await fs.writeFile(`${output}/report.json`,JSON.stringify({errors,...report},null,2));
  assert.deepEqual(errors,[]);assert.ok(report.rows.some(r=>r.tactic.mode==='pass'),'physical approach initiates a passing decision');
  assert.ok(report.rows.some(r=>r.gap< -10),'player clears the slower car');assert.ok(report.rows.every(r=>r.damage<.01),'no contact damage');
  assert.ok(report.rows.every(r=>r.contacts===4),'maintains four contacts');console.log('Input-driven worn-tire overtake passes without damage.');
}finally{await browser.close();}
