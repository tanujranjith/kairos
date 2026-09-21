import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const vehicleClass=process.argv.includes('--formula')?'FORMULA':'GT';
const output=process.argv.find(value=>value.startsWith('--output='))?.slice(9)??`output/dense-pits-${vehicleClass.toLowerCase()}`;
const errors=[],trace=[];
const serviceIds=new Set(),rejoinedIds=new Set(),phaseHistory={},captured=new Set();
let maxConcurrentApproach=0,maxConcurrentService=0,final;
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});
page.setDefaultTimeout(90000);
page.on('pageerror',error=>errors.push(String(error)));

try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');
  await page.waitForFunction(()=>window.kairos?.ui);
  await page.evaluate(()=>window.advanceTime(0));
  await page.evaluate(async vehicleClass=>{
    const game=window.kairos;
    Object.assign(game.raceConfig,{kind:'Practice',vehicleClass,entrants:16,position:1});
    game.save.settings.volume=0;
    game.save.settings.timeRate=0;
    await game.startRace();
    game.setAutopilot(true);
    game.__densePitResets={};
    for(const opponent of game.opponents){
      game.__densePitResets[opponent.vehicle.id]=0;
      const reset=opponent.vehicle.reset.bind(opponent.vehicle);
      opponent.vehicle.reset=(...args)=>{game.__densePitResets[opponent.vehicle.id]++;return reset(...args);};
    }
    await game.advanceTime(1000);
    for(const opponent of game.opponents)opponent.vehicle.state.wheels.forEach(wheel=>wheel.wear=.5);
  },vehicleClass);

  for(let sample=0;sample<450;sample++){
    final=await page.evaluate(async()=>{
      const game=window.kairos;
      await game.advanceTime(2000);
      return {
        elapsed:game.race.state.elapsed,
        resets:structuredClone(game.__densePitResets),
        cars:game.opponents.map(opponent=>{
          const vehicle=opponent.vehicle;
          return {id:vehicle.id,pit:opponent.pitDriver.snapshot(),race:structuredClone(game.race.state.entrants.find(racer=>racer.id===vehicle.id)),position:{...vehicle.state.position},speed:vehicle.state.speed,damage:vehicle.state.damage,fuel:vehicle.state.fuel,wear:vehicle.state.wheels.map(wheel=>wheel.wear),stuck:opponent.stuck,retired:opponent.retired};
        })
      };
    });
    const counts={};
    for(const car of final.cars){
      (phaseHistory[car.id]??=[]).push(car.pit.phase);
      counts[car.pit.phase]=(counts[car.pit.phase]??0)+1;
      if(car.pit.phase==='service')serviceIds.add(car.id);
      if(car.pit.stops===1&&car.pit.phase==='circuit')rejoinedIds.add(car.id);
    }
    maxConcurrentApproach=Math.max(maxConcurrentApproach,counts.approach??0);
    maxConcurrentService=Math.max(maxConcurrentService,counts.service??0);
    if(sample%5===0)trace.push({elapsed:final.elapsed,counts,cars:final.cars.map(car=>({id:car.id,phase:car.pit.phase,stops:car.pit.stops,missed:car.pit.missedStops,lap:car.race?.lap,progress:car.race?.progress,speed:car.speed,damage:car.damage,stuck:car.stuck,reset:final.resets[car.id]}))});
    if((counts.service??0)>=2&&!captured.has('service')){
      captured.add('service');
      await page.evaluate(async()=>{const game=window.kairos,p=game.opponents[7].vehicle.node.position;await game.world.loadAround(p,true);document.querySelector('#ui').style.visibility='hidden';game.renderer.camera.position.set(p.x-48,p.y+24,p.z-42);game.renderer.camera.setTarget(p);await game.renderer.scene.whenReadyAsync();game.renderer.scene.render();});
      await page.screenshot({path:`${output}/dense-service.png`});
      await page.evaluate(()=>document.querySelector('#ui').style.visibility='');
    }
    if(sample%15===0){
      console.log(vehicleClass,final.elapsed.toFixed(1),JSON.stringify(counts),'serviced',serviceIds.size,'rejoined',rejoinedIds.size,'resets',Object.values(final.resets).reduce((sum,value)=>sum+value,0));
      await fs.writeFile(`${output}/report.json`,JSON.stringify({environment:'Installed Edge/WebGL2 controlled time; all fifteen AI entrants receive equal tire wear after a normal sixteen-car start, then use unmodified runtime inputs, physics, assigned boxes, queueing and merge rules.',vehicleClass,maxConcurrentApproach,maxConcurrentService,serviceIds:[...serviceIds],rejoinedIds:[...rejoinedIds],phaseHistory,trace,final,errors},null,2));
    }
    if(final.cars.every(car=>car.pit.stops===1&&car.pit.phase==='circuit'&&car.race?.lap>=3))break;
  }

  assert.equal(final.cars.length,15);
  assert.equal(serviceIds.size,15,'every AI entrant must physically reach its service phase');
  assert.ok(maxConcurrentApproach>=12,'the scenario must exercise a genuinely dense pit-lane arrival');
  assert.ok(maxConcurrentService>=2,'independent neighboring boxes must permit overlapping service');
  for(const car of final.cars){
    assert.equal(car.pit.stops,1,`${car.id} service count`);
    assert.equal(car.pit.missedStops,0,`${car.id} must not overshoot its assigned box`);
    assert.equal(car.pit.phase,'circuit',`${car.id} must rejoin the circuit`);
    assert.ok(car.race.lap>=3,`${car.id} must complete a subsequent lap`);
    assert.equal(car.race.pitCheckpoint,24,`${car.id} pit timing coverage`);
    assert.equal(car.race.pitValid,true,`${car.id} pit timing validity`);
    assert.equal(car.race.pitRoute,false,`${car.id} must clear the pit route`);
    assert.equal(car.race.penalty,0,`${car.id} penalties`);
    assert.equal(car.race.warnings,0,`${car.id} warnings`);
    assert.equal(car.retired,false,`${car.id} retirement`);
    assert.equal(final.resets[car.id],0,`${car.id} recovery resets`);
    assert.ok(car.damage<.01,`${car.id} damage`);
    assert.ok(car.wear.every(value=>value>.99),`${car.id} tire restoration`);
    assert.ok(car.fuel>80,`${car.id} fuel restoration`);
  }
  assert.deepEqual(errors,[]);
  await fs.writeFile(`${output}/report.json`,JSON.stringify({environment:'Installed Edge/WebGL2 controlled time; all fifteen AI entrants receive equal tire wear after a normal sixteen-car start, then use unmodified runtime inputs, physics, assigned boxes, queueing and merge rules.',vehicleClass,maxConcurrentApproach,maxConcurrentService,serviceIds:[...serviceIds],rejoinedIds:[...rejoinedIds],phaseHistory,trace,final,errors},null,2));
}catch(error){
  await fs.writeFile(`${output}/failure.json`,JSON.stringify({error:String(error),vehicleClass,maxConcurrentApproach,maxConcurrentService,serviceIds:[...serviceIds],rejoinedIds:[...rejoinedIds],phaseHistory,trace,final,errors},null,2));
  throw error;
}finally{
  await browser.close();
}
