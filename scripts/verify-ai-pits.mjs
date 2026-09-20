import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const entrants=Number(process.argv.find(v=>v.startsWith('--entrants='))?.split('=')[1]??8),fault=process.argv.find(v=>v.startsWith('--fault='))?.split('=')[1]??'tires',classes=process.argv.includes('--formula')?['FORMULA']:['GT','FORMULA'],output=`output/ai-pits-${entrants}${fault==='tires'?'':'-'+fault}${process.argv.includes('--formula')?'-formula':''}`,reports=[],errors=[];
await fs.mkdir(output,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  for(const vehicleClass of classes){
    await page.evaluate(async({vehicleClass,entrants,fault})=>{const g=window.kairos;Object.assign(g.raceConfig,{kind:'Practice',vehicleClass,entrants,position:1});g.save.settings.volume=0;g.save.settings.timeRate=0;await g.startRace();g.setAutopilot(true);await g.advanceTime(1000);const v=g.opponents[0].vehicle;if(fault==='fuel')v.state.fuel=6;else v.state.wheels.forEach(w=>w.wear=.5);}, {vehicleClass,entrants,fault});
    const trace=[],captures=new Set(),report={vehicleClass,trace};reports.push(report);let final;
    for(let i=0;i<120;i++){
      final=await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(5000);const o=g.opponents[0],v=o.vehicle,s=v.state;return {elapsed:g.race.state.elapsed,pit:o.pitDriver.snapshot(),race:structuredClone(g.race.state.entrants[1]),vehicle:structuredClone(s),input:o.input,others:g.opponents.slice(1).map(o=>({id:o.vehicle.id,position:o.vehicle.state.position,speed:o.vehicle.state.speed,input:o.input,pit:o.pitDriver.snapshot(),stuck:o.stuck})),separation:Math.min(...[g.player,...g.opponents.slice(1).map(o=>o.vehicle)].map(v=>Math.hypot(v.state.position.x-s.position.x,v.state.position.z-s.position.z)))};});
      trace.push(final);report.final=final;report.captures=[...captures];
      if(i%10===0)await fs.writeFile(`${output}/report.json`,JSON.stringify({entrants,reports,errors},null,2));
      if(['approach','service','yield','rejoin'].includes(final.pit.phase)&&!captures.has(final.pit.phase)){
        captures.add(final.pit.phase);await page.evaluate(async()=>{const g=window.kairos,o=g.opponents[0],p=o.vehicle.node.position;await g.world.loadAround(p,true);o.visual.root.setEnabled(true);g.renderer.camera.position.set(p.x-10,p.y+6,p.z-10);g.renderer.camera.setTarget(p);document.querySelector('#ui').style.visibility='hidden';await g.renderer.scene.whenReadyAsync();g.renderer.scene.render();});await page.screenshot({path:`${output}/${vehicleClass}-${final.pit.phase}.png`});await page.evaluate(()=>document.querySelector('#ui').style.visibility='');
      }
      if(i%10===0)console.log(vehicleClass,final.elapsed.toFixed(1),final.pit.phase,final.pit.reason,'lap',final.race.lap,'s',final.race.progress.toFixed(0),'speed',final.vehicle.speed.toFixed(1),'damage',final.vehicle.damage.toFixed(3));
      if(final.pit.stops===1&&final.pit.phase==='circuit'&&final.race.lap>=3)break;
    }
    report.captures=[...captures];await fs.writeFile(`${output}/report.json`,JSON.stringify({entrants,fault,environment:'Installed Edge/WebGL2 controlled time; one AI fuel/wear fault at the normal grid, then unmodified runtime inputs/strategy/service. No position or velocity corrections.',reports,errors},null,2));
    assert.equal(final.pit.stops,1);assert.equal(final.pit.phase,'circuit');assert.ok(final.race.lap>=3);assert.equal(final.race.pitCheckpoint,24);assert.equal(final.race.pitValid,true);assert.equal(final.race.pitRoute,false);assert.equal(final.race.penalty,0);assert.equal(final.race.warnings,0);assert.ok(final.vehicle.damage<.01);assert.ok(final.vehicle.wheels.every(w=>w.wear>.99));assert.ok(final.vehicle.fuel>80);assert.ok(captures.has('service'));assert.ok(trace.every(t=>t.race.valid&&t.race.penalty===0&&t.race.warnings===0&&t.vehicle.damage<.01));
  }assert.deepEqual(errors,[]);
}catch(error){await fs.writeFile(`${output}/failure.json`,JSON.stringify({error:String(error),reports,errors},null,2));throw error;}finally{await browser.close();}
