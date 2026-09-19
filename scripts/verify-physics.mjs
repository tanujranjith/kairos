import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui,null,{timeout:60000});await page.evaluate(()=>window.advanceTime(0));
const report=await page.evaluate(async()=>{
  const g=window.kairos,draw=g.renderer.render.bind(g.renderer);g.renderer.render=()=>{};g.save.settings.traffic=0;g.save.settings.weather='Clear';g.save.settings.timeRate=0;
  const cases=[];
  for(const cadence of [1000/60,1000/30,50]){
    await g.startDrive();g.advanceTime(1000);g.input.keys.add('ArrowUp');let elapsed=0;
    while(elapsed<4000-1e-6){const step=Math.min(cadence,4000-elapsed);g.advanceTime(step);elapsed+=step;}g.input.keys.delete('ArrowUp');
    const accelerated=structuredClone(g.player.state);g.input.keys.add('ArrowDown');const startDistance=g.player.state.distance;
    while(g.player.state.speed>1&&elapsed<14000){g.advanceTime(cadence);elapsed+=cadence;}g.input.keys.delete('ArrowDown');
    cases.push({cadence,accelerated,brakingDistance:g.player.state.distance-startDistance,stoppedSpeed:g.player.state.speed});
  }
  const cars=[];
  for(const id of ['aeris','velara','crest','nova','gtx','apex']){g.save.selected=id;await g.startDrive();g.advanceTime(1000);g.input.keys.add('ArrowUp');g.advanceTime(4000);g.input.clear();cars.push({id,speed:g.player.state.speed,fuel:g.player.state.fuel,grounded:g.player.state.grounded});}
  g.renderer.render=draw;return {environment:'Controlled physics traces; render disabled during numerical checks. Not an FPS benchmark.',cases,cars};
});
for(const c of report.cases){assert.ok(c.accelerated.speed>10);assert.ok(c.brakingDistance>5&&c.brakingDistance<130);assert.ok(Math.abs(c.accelerated.speed-report.cases[0].accelerated.speed)<.15);assert.ok(Math.hypot(c.accelerated.position.x-report.cases[0].accelerated.position.x,c.accelerated.position.z-report.cases[0].accelerated.position.z)<.3);}
assert.ok(report.cars.every(c=>c.speed>5&&c.grounded));assert.deepEqual(errors,[]);await fs.mkdir('output/physics',{recursive:true});await fs.writeFile('output/physics/report.json',JSON.stringify({...report,errors},null,2));console.log(report.cases.map(c=>({cadence:c.cadence,speed:c.accelerated.speed,brakingDistance:c.brakingDistance})),report.cars);await browser.close();
