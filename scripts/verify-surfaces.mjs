import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const option=k=>process.argv.find(v=>v.startsWith(`--${k}=`))?.slice(k.length+3),output=option('output')??'output/surfaces',ids=(option('ids')??'velara,gtx').split(',');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);
  const report=await page.evaluate(async ids=>{const {runSurfaceValidation}=await import('/src/tools/surface-validation.ts');return runSurfaceValidation(window.kairos,ids);},ids);
  await fs.writeFile(`${output}/report.json`,JSON.stringify({...report,errors},null,2));
  console.log(JSON.stringify({rayCount:report.rays.length,missingRays:report.rays.filter(r=>!r.hit),cases:report.cases.map(({trace,...row})=>row),corners:report.corners.map(({trace,...row})=>row),errors},null,2));
  assert.deepEqual(errors,[]);
  if(!process.argv.includes('--baseline')){assert.ok(report.rays.every(r=>r.hit&&Math.abs(r.height-r.expectedHeight)<.08),'Visible shoulder has no matching physical surface');assert.ok(report.cases.every(r=>r.minContacts===4&&r.peakYawChange<15&&r.peakSideslip<12&&r.finalSpeedMagnitude<.6&&r.damage===0),'70mph braking loses stability');assert.ok(report.corners.every(r=>r.minContacts===4&&r.peakYawChange<75&&r.peakSideslip<12&&r.damage===0),'Off-road keyboard turn loses stability');}
}finally{await browser.close();}
