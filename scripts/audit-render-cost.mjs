import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const output='output/render-cost';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],results=[];
page.setDefaultTimeout(90000);page.on('pageerror',error=>errors.push(String(error)));
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  const sample=async name=>{const data=await page.evaluate(async()=>{const {auditRendering}=await import('/src/tools/render-audit.ts');return auditRendering(66);});results.push({name,...data});console.log(JSON.stringify({name,adapter:data.adapter,quality:data.quality,maxDrawCalls:Math.max(...data.rows.map(r=>r.drawCalls)),maxActiveTriangles:Math.max(...data.rows.map(r=>r.activeTriangles)),captures:data.rows.filter(r=>r.probeCaptured).length,sceneSubmitMedian:data.rows.map(r=>r.sceneMs).sort((a,b)=>a-b)[Math.floor(data.rows.length/2)]}));};
  await sample('showroom');
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.timeRate=0;await g.startDrive();await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);});await sample('lakeshore-traffic');
  await page.evaluate(async()=>{const g=window.kairos;g.teleport(-1340,-980,'city3');await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);});await sample('city-traffic');
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.time=22;g.save.settings.weather='Rain';g.wetness=.8;await g.advanceTime(1000);});await sample('wet-night');
  await page.evaluate(async()=>{const g=window.kairos;await g.action('home');g.save.settings.time=17.4;g.save.settings.weather='Clear';g.wetness=0;g.raceConfig.entrants=8;await g.startRace();await g.advanceTime(1000);});await sample('eight-car-grid');
  await fs.writeFile(`${output}/report.json`,JSON.stringify({description:'Development host, installed Edge WebGL2, 66 controlled 30Hz steps per scene, submission timing includes driver synchronization; not a target laptop FPS result.',results,errors},null,2));if(errors.length)throw new Error(errors.join('\n'));
}finally{await browser.close();}
