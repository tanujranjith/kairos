import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const output=process.argv.find(v=>v.startsWith('--output='))?.slice(9)??'output/contested-pits',errors=[],trace=[];
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}});
page.setDefaultTimeout(90000);page.on('pageerror',error=>errors.push(String(error)));
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  await page.evaluate(async()=>{const g=window.kairos;Object.assign(g.raceConfig,{kind:'Practice',vehicleClass:'GT',entrants:8,position:1});g.save.settings.volume=0;g.save.settings.timeRate=0;await g.startRace();g.setAutopilot(true);await g.advanceTime(1000);for(const opponent of g.opponents.slice(0,2))opponent.vehicle.state.wheels.forEach(w=>w.wear=.5);});
  let overlap=false,captured=false,final;
  for(let second=0;second<650;second++){
    final=await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(1000);return g.opponents.slice(0,2).map(o=>({id:o.vehicle.id,phase:o.pitDriver.phase,pit:o.pitDriver.snapshot(),race:structuredClone(g.race.state.entrants.find(r=>r.id===o.vehicle.id)),position:structuredClone(o.vehicle.state.position),speed:o.vehicle.state.speed,damage:o.vehicle.state.damage,fuel:o.vehicle.state.fuel,wear:o.vehicle.state.wheels.map(w=>w.wear)}));});
    trace.push({second:second+1,cars:final});
    if(final.every(car=>car.phase==='service')){
      overlap=true;
      if(!captured){captured=true;await page.evaluate(async()=>{const g=window.kairos,a=g.opponents[0].vehicle.node.position,b=g.opponents[1].vehicle.node.position,p=a.add(b).scale(.5);await g.world.loadAround(p,true);document.querySelector('#ui').style.visibility='hidden';g.renderer.camera.position.set(p.x-13,p.y+10,p.z-18);g.renderer.camera.setTarget(p);await g.renderer.scene.whenReadyAsync();g.renderer.scene.render();});await page.screenshot({path:`${output}/simultaneous-service.png`});await page.evaluate(()=>document.querySelector('#ui').style.visibility='');}
    }
    if(second%30===0)console.log(second+1,final.map(car=>`${car.id}:${car.phase}:${car.pit.stops}`).join(' '));
    if(final.every(car=>car.pit.stops===1&&car.phase==='circuit'&&car.race.lap>=3))break;
  }
  assert.equal(overlap,true,'two neighboring assigned boxes must support overlapping service');
  for(const car of final){assert.equal(car.pit.stops,1);assert.equal(car.phase,'circuit');assert.ok(car.race.lap>=3);assert.equal(car.race.pitCheckpoint,24);assert.equal(car.race.pitValid,true);assert.equal(car.race.pitRoute,false);assert.equal(car.race.penalty,0);assert.equal(car.race.warnings,0);assert.ok(car.damage<.01);assert.ok(car.wear.every(w=>w>.99));assert.ok(car.fuel>80);}
  assert.deepEqual(errors,[]);
  await fs.writeFile(`${output}/report.json`,JSON.stringify({environment:'Installed Edge/WebGL2 controlled time; first two GT opponents receive equal tire wear after a normal start and drive unmodified physics/inputs through neighboring assigned boxes.',overlap,trace,final,errors},null,2));
}catch(error){await fs.writeFile(`${output}/failure.json`,JSON.stringify({error:String(error),trace,final,errors},null,2));throw error;}finally{await browser.close();}
