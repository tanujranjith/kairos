import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const output=process.env.KAIROS_PROFILE_OUTPUT??'output/startup-baseline';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[],external=[];
  await context.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1'){external.push(url);return route.abort();}return route.continue();});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{performance.setResourceTimingBufferSize(3000);window.__startupTasks=[];new PerformanceObserver(list=>{window.__startupTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})));}).observe({type:'longtask',buffered:true});});
  const cdp=await context.newCDPSession(page);
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  const pending=new Map();cdp.on('Network.requestWillBeSent',e=>pending.set(e.requestId,e.request.url));cdp.on('Network.loadingFinished',e=>pending.delete(e.requestId));cdp.on('Network.loadingFailed',e=>{errors.push(`${e.errorText}: ${pending.get(e.requestId)}`);pending.delete(e.requestId);});
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:40,downloadThroughput:25_000_000/8,uploadThroughput:5_000_000/8,connectionType:'ethernet'});
  await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
  let failure='';const start=Date.now();try{
    await page.goto('http://127.0.0.1:5192/?renderer=webgl',{waitUntil:'domcontentloaded',timeout:90000});
    await page.waitForSelector('#start-drive',{timeout:90000});await page.waitForSelector('#loading',{state:'detached'});
  }catch(error){failure=String(error);}
  const readyMs=Date.now()-start,{profile}=await cdp.send('Profiler.stop');
  const report=await page.evaluate(()=>({navigation:performance.getEntriesByType('navigation').map(e=>e.toJSON()),resources:performance.getEntriesByType('resource').map(e=>({name:e.name,start:e.startTime,responseStart:e.responseStart,end:e.responseEnd,duration:e.duration,bytes:e.transferSize})),measures:performance.getEntriesByType('measure').map(e=>e.toJSON()),longTasks:window.__startupTasks}));
  const samples=new Map();for(let i=0;i<(profile.samples?.length??0);i++){const id=profile.samples[i];samples.set(id,(samples.get(id)??0)+(profile.timeDeltas?.[i]??0));}
  report.cpu=profile.nodes.map(n=>({ms:(samples.get(n.id)??0)/1000,...n.callFrame})).sort((a,b)=>b.ms-a.ms).slice(0,40);
  Object.assign(report,{readyMs,failure,pending:[...pending.values()],errors,external,environment:'Cold Chromium/SwiftShader, local preview, 25Mbps down/5Mbps up/40ms; CPU profiler enabled. Not target hardware.'});
  await fs.writeFile(`${output}/cpu.json`,JSON.stringify(profile));await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  await page.screenshot({path:`${output}/showroom.png`});
  console.log(JSON.stringify({readyMs,failure,pending:report.pending,cpu:report.cpu.slice(0,8),resourceCount:report.resources.length,lastResources:report.resources.slice(-20).map(r=>({name:r.name.split('/').pop(),start:r.start,end:r.end,bytes:r.bytes})),measures:report.measures,errors,external},null,2));
  assert.equal(failure,'');assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
}finally{await browser.close();}
