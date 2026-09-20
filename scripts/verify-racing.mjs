import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'output/racing',entrants=Number(process.argv.find(a=>a.startsWith('--entrants='))?.split('=')[1]??8);
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.setDefaultTimeout(90000);
try{
page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);
await page.evaluate(()=>window.advanceTime(0));
const reports=[];
for(const vehicleClass of ['GT','FORMULA']){
  await page.evaluate(async({vehicleClass,entrants})=>{const g=window.kairos;Object.assign(g.raceConfig,{vehicleClass,laps:3,entrants,position:4,kind:'Quick Race'});await g.startRace();g.setAutopilot(true);},{vehicleClass,entrants});
  const trace=[];
  for(let i=0;i<50;i++){
    const s=await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(15000);return g.snapshot();});
    trace.push({t:s.race.elapsed,player:s.race.entrants[0],positions:s.opponents.map(o=>({id:o.id,speed:o.speed})),cells:s.cells});
    if(i%5===0||s.screen==='results')console.log(vehicleClass,Math.round(s.race.elapsed),'lap',s.race.entrants[0].lap,'progress',Math.round(s.race.entrants[0].progress),'valid',s.race.entrants[0].valid,s.screen);
    if(s.screen==='results')break;
  }
  await page.evaluate(async()=>{const g=window.kairos;await g.renderer.scene.whenReadyAsync();await g.advanceTime(0);});
  await fs.mkdir(output,{recursive:true});await page.screenshot({path:`${output}/${vehicleClass}.png`});
  const final=await page.evaluate(()=>window.kairos.snapshot()),damage=await page.evaluate(()=>[window.kairos.player,...window.kairos.opponents.map(o=>o.vehicle)].map(v=>({id:v.id,damage:v.state.damage})));
  reports.push({vehicleClass,final,damage,trace});
  await fs.writeFile(`${output}/report.json`,JSON.stringify({environment:'Installed Edge/WebGL2, controlled time. Actual grid and input-driven three-lap races; not laptop FPS or real-time endurance evidence.',errors,reports},null,2));
}
if(errors.length||reports.some(r=>r.final.screen!=='results'||r.final.race.entrants.some(e=>!e.finished||e.warnings||e.penalty)||r.damage.some(v=>v.damage>=.01)))process.exitCode=1;
}finally{await browser.close();}
