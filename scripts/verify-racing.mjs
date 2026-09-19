import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);
await page.evaluate(()=>window.advanceTime(0));
const reports=[];
for(const vehicleClass of ['GT','FORMULA']){
  await page.evaluate(async vehicleClass=>{const g=window.kairos;Object.assign(g.raceConfig,{vehicleClass,laps:3,entrants:8,position:4,kind:'Quick Race'});await g.startRace();g.setAutopilot(true);},vehicleClass);
  const trace=[];
  for(let i=0;i<50;i++){
    const s=await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(15000);return g.snapshot();});
    trace.push({t:s.race.elapsed,player:s.race.entrants[0],positions:s.opponents.map(o=>({id:o.id,speed:o.speed})),cells:s.cells});
    if(i%5===0||s.screen==='results')console.log(vehicleClass,Math.round(s.race.elapsed),'lap',s.race.entrants[0].lap,'progress',Math.round(s.race.entrants[0].progress),'valid',s.race.entrants[0].valid,s.screen);
    if(s.screen==='results')break;
  }
  await page.evaluate(async()=>{const g=window.kairos;await g.renderer.scene.whenReadyAsync();g.advanceTime(0);});
  await fs.mkdir('output/racing',{recursive:true});await page.screenshot({path:`output/racing/${vehicleClass}.png`});
  const final=await page.evaluate(()=>window.kairos.snapshot());reports.push({vehicleClass,final,trace});
}
await fs.writeFile('output/racing/report.json',JSON.stringify({environment:'Development host / Chromium SwiftShader, controlled time; NOT laptop FPS evidence',errors,reports},null,2));await browser.close();if(errors.length||reports.some(r=>r.final.screen!=='results'||!r.final.race.entrants[0].finished))process.exitCode=1;
