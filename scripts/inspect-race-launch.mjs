import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const option=(name,fallback)=>process.argv.find(v=>v.startsWith(`--${name}=`))?.split('=')[1]??fallback;
const output=`output/race-launch/${option('label','inspect')}`,entrants=Number(option('entrants',8)),vehicleClass=option('class','GT'),seconds=Number(option('seconds',25)),position=Number(option('position',1)),kind=option('kind','Practice'),fault=option('fault','fuel'),focus=option('focus','racer-1');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],trace=[];
page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  await page.evaluate(async({entrants,vehicleClass,position,kind,fault})=>{const g=window.kairos;Object.assign(g.raceConfig,{kind,vehicleClass,entrants,position});g.save.settings.volume=0;g.save.settings.timeRate=0;await g.startRace();g.setAutopilot(true);await g.advanceTime(1000);if(fault==='fuel')g.opponents[0].vehicle.state.fuel=6;}, {entrants,vehicleClass,position,kind,fault});
  for(let second=0;second<seconds;second++){
    trace.push(...await page.evaluate(async()=>{
      const {nearestRoad}=await import('/src/content/world.ts'),g=window.kairos,rows=[];
      for(let i=0;i<10;i++){
        await g.advanceTime(100);
        rows.push({time:g.race.state.elapsed,cars:[{vehicle:g.player,input:g.lastInput},...g.opponents].map(o=>{const v=o.vehicle,s=v.state,n=nearestRoad(s.position.x,s.position.z,r=>r.id==='circuit'),r=g.race.state.entrants.find(r=>r.id===v.id);return {id:v.id,s:n.progress,lateral:n.lateral,y:s.position.y,speed:s.speed,yaw:s.yaw,trackYaw:n.point.yaw,velocity:s.velocity,steer:s.steer,input:o.input,damage:s.damage,distance:s.distance,valid:r.valid,warnings:r.warnings,grounded:s.grounded,wheels:s.wheels.map(w=>({load:w.load,slip:w.slip,surface:w.surface,contact:w.contact}))};})});
      }return rows;
    }));
    if(second%25===0)console.log('Trace',second+2,'seconds',trace.at(-1).cars.filter(c=>c.warnings).map(c=>c.id+':'+c.warnings).join(','));
    const stop=process.argv.includes('--stop-on-warning')&&trace.at(-1).cars.some(c=>c.warnings);
    if([6,9,seconds-1].includes(second)||stop){
      await page.evaluate(async focus=>{const g=window.kairos,o=g.opponents.find(o=>o.vehicle.id===focus)??g.opponents[0],p=o.vehicle.node.position;await g.world.loadAround(p,true);o.visual.root.setEnabled(true);g.renderer.camera.position.set(p.x-15,p.y+10,p.z-16);g.renderer.camera.setTarget(p);await g.renderer.scene.whenReadyAsync();g.renderer.scene.render();},focus);
      await page.screenshot({path:`${output}/${second+2}s.png`});
    }
    if(stop)break;
  }
  await fs.writeFile(`${output}/report.json`,JSON.stringify({entrants,vehicleClass,position,kind,fault,errors,trace},null,2));
  console.log(JSON.stringify({errors,final:trace.at(-1).cars.map(c=>({id:c.id,s:c.s,lateral:c.lateral,warnings:c.warnings,damage:c.damage})),firstWarningTime:trace.find(t=>t.cars.some(c=>c.warnings))?.time??null},null,2));
  if(process.argv.includes('--verify')){
    assert.deepEqual(errors,[]);
    assert.ok(trace.every(t=>t.cars.every(c=>c.valid&&c.warnings===0&&c.damage<.01)),'Invalid lap, warning or damage in the sampled field; inspect retained trace');
  }
}finally{await browser.close();}
