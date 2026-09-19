import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const results=[];await fs.mkdir('output/browsers',{recursive:true});
for(const channel of process.argv[2]?[process.argv[2]]:['chrome','msedge'])for(const renderer of ['auto','webgl']){
  const browser=await chromium.launch({channel,headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],external=[];
  page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',r=>{const url=r.request().url();if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1'){external.push(url);return r.abort();}return r.continue();});
  await page.goto(`http://127.0.0.1:5187/${renderer==='webgl'?'?renderer=webgl':''}`);await page.waitForFunction(()=>window.kairos?.ui,null,{timeout:90000});await page.evaluate(()=>window.advanceTime(0));await page.click('#start-drive');await page.waitForSelector('#speed');await page.keyboard.down('ArrowUp');await page.evaluate(()=>window.advanceTime(2000));await page.keyboard.up('ArrowUp');
  await page.evaluate(async()=>{const g=window.kairos;await g.renderer.scene.whenReadyAsync();g.advanceTime(0);});
  const result=await page.evaluate(()=>({renderer:window.kairos.renderer.rendererName,speed:window.kairos.player.state.speed,contacts:window.kairos.player.state.wheels.filter(w=>w.contact).length}));await page.screenshot({path:`output/browsers/${channel}-${renderer}.png`});results.push({channel,requested:renderer,...result,errors,external});console.log(results.at(-1));await browser.close();
}
await fs.writeFile('output/browsers/report.json',JSON.stringify(results,null,2));if(results.some(r=>r.errors.length||r.external.length||r.speed<2))process.exitCode=1;
