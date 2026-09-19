import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];
let blocked=0;await context.route('**/cell-worker.ts*',route=>{if(blocked++===0)return route.abort('failed');return route.continue();});page.on('pageerror',e=>errors.push(String(e)));
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui,null,{timeout:90000});await page.evaluate(()=>window.advanceTime(0));
  await page.click('#start-drive');await page.waitForSelector('#world-retry',{timeout:45000});
  assert.match(await page.locator('#world-loading').innerText(),/worker failed/);assert.equal(await page.evaluate(()=>window.kairos.clock),0);
  await page.click('#world-retry');await page.waitForSelector('#speed',{timeout:90000});await page.evaluate(()=>window.advanceTime(1000));assert.equal(await page.evaluate(()=>window.kairos.player.state.grounded),true);
  const recovered=await page.evaluate(()=>window.kairos.snapshot());assert.equal(recovered.loading,false);assert.equal(recovered.loadError,'');
  await page.evaluate(()=>window.kairos.action('home'));await page.click('#start-handling');await page.keyboard.press('Escape');
  await page.evaluate(()=>window.kairos.transitionPromise);assert.equal(await page.evaluate(()=>window.kairos.screen),'home');assert.equal(await page.evaluate(()=>window.kairos.world.cells.size),0);assert.equal(await page.locator('#world-loading').isVisible(),false);
  assert.deepEqual(errors,[]);await fs.mkdir('output/worker-recovery',{recursive:true});await fs.writeFile('output/worker-recovery/report.json',JSON.stringify({workerRequests:blocked,blockedModuleRecovery:true,clockFrozen:true,cancelledSessionReleased:true,errors},null,2));console.log('Blocked worker module → retry → driving; cancelled load → clean home: passed.');
}finally{await browser.close();}
