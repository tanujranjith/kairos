import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const renderer=process.argv.find(value=>value.startsWith('--renderer='))?.slice(11)??'webgl';
const output=process.argv.find(value=>value.startsWith('--output='))?.slice(9)??`output/pit-overshoot-${renderer}`;
const errors=[],requests=[],trace=[];
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});
page.setDefaultTimeout(90000);
page.on('pageerror',error=>errors.push(String(error)));
page.on('requestfailed',request=>requests.push(`${request.url()} ${request.failure()?.errorText??''}`));
try{
  await page.goto(`http://127.0.0.1:5187/?renderer=${renderer}`);
  await page.waitForFunction(()=>window.kairos?.ui);
  await page.evaluate(()=>window.advanceTime(0));
  const injected=await page.evaluate(async()=>{
    const g=window.kairos;
    Object.assign(g.raceConfig,{kind:'Practice',vehicleClass:'GT',entrants:2,position:1});
    g.save.settings.volume=0;g.save.settings.timeRate=0;
    await g.startRace();g.setAutopilot(true);await g.advanceTime(1000);
    const opponent=g.opponents[0],vehicle=opponent.vehicle,box=opponent.pitDriver.snapshot().serviceBox,p=box.position;
    const target={x:p.x+Math.sin(p.yaw)*7,y:p.y,z:p.z+Math.cos(p.yaw)*7};
    await g.world.loadAround(target,true);vehicle.reset(target,p.yaw);await g.advanceTime(100);
    const velocity=vehicle.node.position.clone();velocity.set(Math.sin(p.yaw)*8,0,Math.cos(p.yaw)*8);
    vehicle.body.setLinearVelocity(velocity);vehicle.state.speed=8;vehicle.state.velocity={x:velocity.x,y:0,z:velocity.z};vehicle.state.gear=1;
    vehicle.state.wheels.forEach(w=>w.omega=8/vehicle.definition.wheelRadius);vehicle.state.fuel=3;
    const racer=g.race.state.entrants.find(r=>r.id===vehicle.id);racer.lap=1;
    opponent.pitDriver.phase='approach';opponent.pitDriver.reason='fuel';opponent.stuck=0;
    g.__pitOvershootResets=0;const reset=vehicle.reset.bind(vehicle);vehicle.reset=(...args)=>{g.__pitOvershootResets++;return reset(...args);};
    return {id:vehicle.id,box,target};
  });
  let sawExit=false,sawYield=false,sawRejoin=false,finished;
  for(let step=0;step<240;step++){
    const sample=await page.evaluate(async()=>{
      const g=window.kairos;await g.advanceTime(500);const o=g.opponents[0],v=o.vehicle,p=o.pitDriver.snapshot();
      return {elapsed:g.race.state.elapsed,phase:p.phase,reason:p.reason,routeProgress:p.routeProgress,missedStops:p.missedStops,retryPending:p.retryPending,stops:p.stops,position:{...v.state.position},speed:v.state.speed,input:{...o.input},damage:v.state.damage,grounded:v.state.grounded,resets:g.__pitOvershootResets,renderer:g.renderer.rendererName};
    });
    trace.push(sample);sawExit||=sample.phase==='exit';sawYield||=sample.phase==='yield';sawRejoin||=sample.phase==='rejoin';finished=sample;
    if(step===1){
      await page.evaluate(async()=>{const g=window.kairos,o=g.opponents[0],p=o.vehicle.node.position;await g.world.loadAround(p,true);document.querySelector('#ui').style.visibility='hidden';g.renderer.camera.position.set(p.x-12,p.y+7,p.z-13);g.renderer.camera.setTarget(p);await g.renderer.scene.whenReadyAsync();g.renderer.scene.render();});
      await page.screenshot({path:`${output}/forward-exit.png`});
      await page.evaluate(()=>document.querySelector('#ui').style.visibility='');
    }
    if(sample.resets||sample.damage>.01)break;
    if(sample.missedStops===1&&sample.retryPending&&sample.phase==='requested'){finished=sample;break;}
  }
  await page.evaluate(async()=>{const g=window.kairos,o=g.opponents[0],p=o.vehicle.node.position;await g.world.loadAround(p,true);document.querySelector('#ui').style.visibility='hidden';g.renderer.camera.position.set(p.x-14,p.y+8,p.z-14);g.renderer.camera.setTarget(p);await g.renderer.scene.whenReadyAsync();g.renderer.scene.render();});
  await page.screenshot({path:`${output}/rejoined-request.png`});
  await page.evaluate(()=>document.querySelector('#ui').style.visibility='');
  const inRecovery=trace.filter(sample=>['exit','yield','rejoin'].includes(sample.phase));
  assert.equal(finished.missedStops,1);assert.equal(finished.stops,0);assert.equal(finished.retryPending,true);assert.equal(finished.phase,'requested');
  assert.equal(finished.resets,0,'recovery must not teleport/reset the vehicle');assert.ok(finished.damage<.01);assert.ok(sawExit&&sawYield&&sawRejoin,'forward recovery must traverse exit, yield, and rejoin phases');
  assert.ok(inRecovery.length>5);assert.ok(inRecovery.every(sample=>sample.input.reverse===false));assert.ok(Math.min(...inRecovery.map(sample=>sample.speed))>-.75,'vehicle must not reverse toward the missed box');
  assert.ok(inRecovery.every(sample=>Number.isFinite(sample.position.x)&&Number.isFinite(sample.position.y)&&Number.isFinite(sample.position.z)&&Number.isFinite(sample.input.steer)));
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  await fs.writeFile(`${output}/report.json`,JSON.stringify({environment:`Installed Edge/${renderer}; a moving GT opponent is injected seven metres beyond its assigned box once, then uses ordinary PitDriver inputs, Havok vehicle physics, pit-exit yield and circuit rejoin without reset or position correction.`,injected,sawExit,sawYield,sawRejoin,finished,trace,errors,requests},null,2));
  console.log(JSON.stringify({renderer:finished.renderer,elapsed:finished.elapsed,phase:finished.phase,missedStops:finished.missedStops,retryPending:finished.retryPending,resets:finished.resets,damage:finished.damage,sawExit,sawYield,sawRejoin}));
}catch(error){
  await fs.writeFile(`${output}/failure.json`,JSON.stringify({error:String(error),trace,errors,requests},null,2));throw error;
}finally{await browser.close();}
