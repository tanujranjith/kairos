import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const option=name=>process.argv.find(v=>v.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const channel=option('channel'),repeats=Number(option('repeats')??1),output=option('output')??'output/startup-delivery',reports=[];
assert.ok(Number.isInteger(repeats)&&repeats>=1&&repeats<=10);await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch(channel?{channel,headless:true}:{headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  for(let run=1;run<=repeats;run++)for(const renderer of ['webgl','auto']){
    const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[],external=[],failed=[],warnings=[];
    page.setDefaultTimeout(60000);
    const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Performance.enable');
    let bytes=0;const pending=new Map();cdp.on('Network.requestWillBeSent',e=>pending.set(e.requestId,e.request.url));cdp.on('Network.loadingFinished',e=>{bytes+=e.encodedDataLength;pending.delete(e.requestId);});cdp.on('Network.loadingFailed',e=>{failed.push({url:pending.get(e.requestId),reason:e.errorText});pending.delete(e.requestId);});
    await page.addInitScript(()=>performance.setResourceTimingBufferSize(3000));
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:40,downloadThroughput:25_000_000/8,uploadThroughput:5_000_000/8,connectionType:'ethernet'});
    await context.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1'){external.push(url);return route.abort();}return route.continue();});
    page.on('pageerror',e=>errors.push(String(e)));page.on('crash',()=>errors.push('Browser page crashed'));page.on('console',m=>{if(['error','warning'].includes(m.type()))warnings.push(m.text());});page.on('response',r=>{if(r.status()>=400)failed.push({url:r.url(),status:r.status()});});
    const prefix=`${output}/${run}-${renderer}`,report={run,rendererRequest:renderer,channel:channel??'Chromium/SwiftShader',errors,external,failed,warnings};
    try{
      const start=Date.now();await page.goto(`http://127.0.0.1:5192/${renderer==='webgl'?'?renderer=webgl':''}`,{waitUntil:'domcontentloaded'});
      await page.waitForSelector('#start-drive');await page.waitForSelector('#loading',{state:'detached'});
      Object.assign(report,{readyMs:Date.now()-start,initialBytes:bytes,phases:await page.evaluate(()=>performance.getEntriesByType('measure').filter(e=>e.name.startsWith('kairos:startup:')).map(e=>({name:e.name,start:e.startTime,duration:e.duration}))),initialResourceCount:await page.evaluate(()=>performance.getEntriesByType('resource').length)});
      assert.equal(report.phases.filter(p=>p.name==='kairos:startup:presentation'&&p.duration>0).length,1);
      assert.equal(await page.evaluate(()=>typeof window.advanceTime),'undefined');assert.equal(await page.evaluate(()=>typeof window.kairos),'undefined');
      await page.screenshot({path:`${prefix}-showroom.png`});console.log(`${channel??'Chromium'} ${renderer}: menu ready and showroom captured`);
      const driveStart=Date.now();await page.click('#start-drive');await page.waitForSelector('#speed');await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>Number(document.querySelector('#speed')?.textContent)>5);await page.keyboard.up('ArrowUp');
      Object.assign(report,{driveInputToMotionMs:Date.now()-driveStart,renderer:(await page.locator('#telemetry').textContent()).split(' · ')[0],speed:await page.locator('#speed').textContent()});await page.screenshot({path:`${prefix}.png`});console.log(`${channel??'Chromium'} ${renderer}: Free Drive motion verified`);
      await page.keyboard.press('Escape');await page.click('[data-action="home"]');await page.click('#start-handling');
      await page.waitForFunction(()=>document.querySelector('#region')?.textContent==='NORTHSTAR HANDLING GROUNDS');assert.equal(await page.locator('#minimap [data-map-layer="handling"]').count(),1);
      await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>Number(document.querySelector('#speed')?.textContent)>5);await page.keyboard.up('ArrowUp');await page.screenshot({path:`${prefix}-handling.png`});report.handlingCourse=true;
      if(process.argv.includes('--race')){
        await page.keyboard.press('Escape');await page.click('[data-action="home"]');await page.click('[data-action="screen"][data-value="motorsport"]');
        if(process.argv.includes('--formula'))await page.selectOption('[data-race="vehicleClass"]','FORMULA');
        report.raceClass=await page.locator('[data-race="vehicleClass"]').inputValue();
        await page.click('#start-race');await page.waitForSelector('#speed');
        await page.waitForFunction(()=>/^\d+$/.test(document.querySelector('#countdown')?.textContent??''));
        assert.match(await page.locator('.race-position small').textContent(),/\/ 8/);
        await page.waitForFunction(()=>document.querySelector('#countdown')?.textContent==='');
        await page.waitForFunction(()=>{const flag=document.querySelector('#race-flag');return !!flag&&!flag.textContent?.includes('GET READY');});
        await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>Number(document.querySelector('#speed')?.textContent)>5);await page.keyboard.up('ArrowUp');
        report.raceHud=await page.locator('#race-hud').textContent();assert.doesNotMatch(report.raceHud,/GET READY|\+\d+s/);
        await page.screenshot({path:`${prefix}-race.png`});await page.keyboard.press('Escape');await page.click('[data-action="home"]');await page.waitForSelector('#start-drive');report.raceEntryAndReturn=true;report.cleanCountdownLaunch=true;
      }
      const metrics=await cdp.send('Performance.getMetrics');Object.assign(report,{bytes,jsHeapBytes:metrics.metrics.find(m=>m.name==='JSHeapUsedSize')?.value,network:{downloadMbps:25,uploadMbps:5,latencyMs:40},environment:'Local development host, cold browser cache. Input-to-motion includes streaming and acceleration. Not target-laptop, HTTPS, FPS or whole-process-memory certification.'});
      assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(failed,[]);
      // WebGPU validation failures arrive as console messages, not pageerror.
      assert.deepEqual(warnings.filter(w=>!w.includes('The powerPreference option is currently ignored when calling requestAdapter() on Windows')),[]);
    }catch(error){Object.assign(report,{failure:String(error),pending:[...pending.values()]});await page.screenshot({path:`${prefix}-failure.png`,timeout:10000}).catch(()=>{});throw error;}
    finally{reports.push(report);await fs.writeFile(`${output}/report.json`,JSON.stringify(reports,null,2));console.log(JSON.stringify(report,null,2));await context.close();}
  }
}finally{await browser.close();}
