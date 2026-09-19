import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const reports=[];await fs.mkdir('output/delivery',{recursive:true});
for(const renderer of ['webgl','auto']){
  const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[],external=[],failed=[];
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Performance.enable');let bytes=0;cdp.on('Network.loadingFinished',e=>bytes+=e.encodedDataLength);
  await context.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1'){external.push(url);return route.abort();}return route.continue();});
  page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)failed.push({url:r.url(),status:r.status()});});
  const start=Date.now();await page.goto(`http://127.0.0.1:5192/${renderer==='webgl'?'?renderer=webgl':''}`);
  await page.waitForSelector('#start-drive',{timeout:60000});const readyMs=Date.now()-start;
  assert.equal(await page.evaluate(()=>typeof window.advanceTime),'undefined');assert.equal(await page.evaluate(()=>typeof window.kairos),'undefined');
  await page.click('#start-drive');await page.waitForSelector('#speed',{timeout:45000});await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>Number(document.querySelector('#speed')?.textContent)>5,null,{timeout:45000});await page.keyboard.up('ArrowUp');
  await page.screenshot({path:`output/delivery/${renderer}.png`});const metrics=await cdp.send('Performance.getMetrics');const report={rendererRequest:renderer,readyMs,bytes,jsHeapBytes:metrics.metrics.find(m=>m.name==='JSHeapUsedSize')?.value,errors,external,failed,speed:await page.locator('#speed').textContent(),environment:'Local development machine; Chromium/SwiftShader; cold browser cache, unthrottled localhost. Not laptop, Internet cold-start or GPU performance certification.'};reports.push(report);console.log(report);await context.close();
}
await fs.writeFile('output/delivery/report.json',JSON.stringify(reports,null,2));await browser.close();assert.ok(reports.every(r=>!r.errors.length&&!r.external.length&&!r.failed.length));
