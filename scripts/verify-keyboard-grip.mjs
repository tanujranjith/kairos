import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const label=process.argv.find(a=>a.startsWith('--label='))?.split('=')[1]??'current';
const output=`output/keyboard-grip/${label}`;
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');
  await page.waitForFunction(()=>window.kairos?.ui,null,{timeout:90000});
  const report=await page.evaluate(async()=>{const {runKeyboardValidation}=await import('/src/tools/keyboard-validation.ts');return await runKeyboardValidation(window.kairos);});
  await page.keyboard.down('ArrowUp');
  let speed=0;for(let n=0;n<150&&speed<40*.44704;n++)speed=await page.evaluate(async()=>{await window.advanceTime(100);return window.kairos.player.state.speed;});
  assert.ok(speed>=40*.44704,'Natural keyboard acceleration did not reach 40 mph');
  await page.keyboard.down('ArrowRight');await page.evaluate(()=>window.advanceTime(500));await page.keyboard.up('ArrowRight');
  await page.evaluate(()=>window.advanceTime(1500));await page.keyboard.up('ArrowUp');await page.evaluate(()=>window.advanceTime(500));
  const gameplay=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));
  await page.screenshot({path:`${output}/40mph-gameplay.png`});
  await fs.writeFile(`${output}/gameplay.json`,JSON.stringify(gameplay,null,2));
  await fs.writeFile(`${output}/report.json`,JSON.stringify({...report,errors},null,2));
  for(const id of ['aeris','velara','crest','nova','gtx','apex']){const cases=report.cases.filter(c=>c.id===id);console.log(id,JSON.stringify({cases:cases.length,maxSideslip:Math.max(...cases.map(c=>c.peakSideslip)),minContacts:Math.min(...cases.map(c=>c.minContacts)),maxHeadingChange:Math.max(...cases.map(c=>Math.abs(c.yawChange)))}));}
  assert.equal(gameplay.screen,'drive');assert.equal(gameplay.player.damage,0);assert.equal(gameplay.player.wheels.filter(w=>w.contact).length,4);
  assert.ok(Math.abs(Math.atan2(Math.sin(gameplay.player.yaw-Math.PI/2),Math.cos(gameplay.player.yaw-Math.PI/2)))<Math.PI/3,'Natural keyboard flow spun out');
  await page.keyboard.down('ArrowDown');
  let reverseSpeed=gameplay.player.speed;for(let n=0;n<100&&reverseSpeed> -3;n++)reverseSpeed=await page.evaluate(async()=>{await window.advanceTime(100);return window.kairos.player.state.speed;});
  await page.keyboard.up('ArrowDown');assert.ok(reverseSpeed< -3,'Braking-to-reverse flow failed');
  await page.evaluate(async()=>{await window.kairos.action('reset');await window.advanceTime(1000);});
  const reset=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));
  assert.ok(Math.abs(reset.player.speed)<.1);assert.equal(reset.player.wheels.filter(w=>w.contact).length,4);
  await fs.writeFile(`${output}/interaction.json`,JSON.stringify({reverseSpeed,reset},null,2));
  assert.deepEqual(errors,[]);
  if(!process.argv.includes('--baseline'))assert.ok(report.cases.every(c=>c.peakSideslip<12&&c.minContacts===4&&c.damage===0&&Math.abs(c.yawChange)<75),'Keyboard maneuver lost stability; inspect full traces');
}finally{await browser.close();}
