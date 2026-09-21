import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const option=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const minutes=Number(option('minutes')??30),sampleMs=Number(option('sample-ms')??30_000),renderer=option('renderer')??'webgl',output=option('output')??'output/endurance';
assert.ok(Number.isFinite(minutes)&&minutes>0&&minutes<=60,'minutes must be in (0, 60]');
assert.ok(Number.isFinite(sampleMs)&&sampleMs>=5_000&&sampleMs<=60_000,'sample-ms must be 5–60 seconds');
assert.ok(renderer==='webgl'||renderer==='auto','renderer must be webgl or auto');
await fs.mkdir(output,{recursive:true});

const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),cdp=await context.newCDPSession(page);
page.setDefaultTimeout(90_000);await cdp.send('Performance.enable');
const errors=[],warnings=[],failed=[],external=[],samples=[],homes=[],cycles=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());else if(message.type()==='warning')warnings.push(message.text());});
page.on('requestfailed',request=>failed.push({url:request.url(),error:request.failure()?.errorText??''}));
page.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).hostname!=='127.0.0.1')external.push(request.url());});

const config={kind:'Quick Race',laps:3,entrants:8,difficulty:.65,position:4,vehicleClass:'GT'};
const startSession=()=>page.evaluate(async config=>{
  const game=window.kairos;game.save.settings.automaticQuality=false;game.save.settings.quality='Low';game.save.settings.resolution=1;game.save.settings.volume=0;game.save.settings.timeRate=0;game.save.settings.traffic=0;game.applySettings(true);
  await game.startRace({config,stage:0});game.setAutopilot(true);game.resumeRealTime();
},config);
const inspect=async elapsedMs=>{
  const state=await page.evaluate(()=>{const game=window.kairos,snapshot=game.snapshot(),scene=game.renderer.scene;return {snapshot,fps:game.renderer.engine.getFps(),resources:{meshes:scene.meshes.length,materials:scene.materials.length,textures:scene.textures.length,lights:scene.lights.length,transformNodes:scene.transformNodes.length,geometries:scene.geometries.length,activeMeshes:scene.getActiveMeshes().length,activeTriangles:scene.getActiveIndices()/3}};});
  const metrics=await cdp.send('Performance.getMetrics'),metric=name=>metrics.metrics.find(row=>row.name===name)?.value??null;
  return {elapsedMs,wallTime:new Date().toISOString(),screen:state.snapshot.screen,racePhase:state.snapshot.race.phase,lap:state.snapshot.race.entrants.find(row=>row.id==='player')?.lap??0,speed:state.snapshot.player.speed,grounded:state.snapshot.player.grounded,damage:state.snapshot.player.damage,contacts:state.snapshot.player.wheels.filter(wheel=>wheel.contact).length,frameTimeP95:state.snapshot.frameTimeP95,physicsMs:state.snapshot.physicsMs,streaming:state.snapshot.streaming,graphics:state.snapshot.graphics,fps:state.fps,resources:state.resources,jsHeapUsed:metric('JSHeapUsedSize'),jsHeapTotal:metric('JSHeapTotalSize'),nodes:metric('Nodes'),documents:metric('Documents')};
};
const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted.length?sorted[Math.floor(sorted.length/2)]:0;};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

try{
  await page.goto(`http://127.0.0.1:5187/${renderer==='webgl'?'?renderer=webgl':''}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.kairos?.ui&&!document.querySelector('#loading'));
  await startSession();await page.waitForFunction(()=>window.kairos?.screen==='drive'&&!window.kairos?.loading);
  await page.screenshot({path:`${output}/start.png`});
  const started=Date.now(),durationMs=minutes*60_000,midpoint=durationMs/2;let nextSample=0,midCaptured=false,cycleStarted=started;
  while(Date.now()-started<durationMs){
    const elapsed=Date.now()-started;
    if(elapsed>=nextSample){const sample=await inspect(elapsed);samples.push(sample);assert.equal(sample.streaming.errors.length,0);assert.ok(Number.isFinite(sample.speed)&&Number.isFinite(sample.physicsMs));assert.notEqual(sample.graphics.recovery.phase,'failed');console.log(JSON.stringify({minute:(elapsed/60_000).toFixed(1),screen:sample.screen,phase:sample.racePhase,lap:sample.lap,fps:Number(sample.fps.toFixed(1)),p95:Number(sample.frameTimeP95.toFixed(1)),heapMB:sample.jsHeapUsed===null?null:Number((sample.jsHeapUsed/1048576).toFixed(1)),meshes:sample.resources.meshes,textures:sample.resources.textures}));nextSample+=sampleMs;}
    if(!midCaptured&&elapsed>=midpoint){await page.screenshot({path:`${output}/mid.png`});midCaptured=true;}
    const phase=await page.evaluate(()=>({screen:window.kairos.screen,phase:window.kairos.race.state.phase}));
    if(phase.screen==='results'||phase.phase==='finished'){
      cycles.push({durationMs:Date.now()-cycleStarted,finishedAtMs:elapsed});await page.screenshot({path:`${output}/cycle-${cycles.length}-results.png`});
      await page.evaluate(()=>window.kairos.action('home'));await sleep(750);const home=await inspect(Date.now()-started);homes.push(home);assert.equal(home.screen,'home');assert.equal(home.streaming.collisionCells,0);assert.equal(home.streaming.detailCells,0);
      await startSession();cycleStarted=Date.now();
    }
    await sleep(Math.min(1000,Math.max(100,started+durationMs-Date.now())));
  }
  const final=await inspect(Date.now()-started);samples.push(final);await page.screenshot({path:`${output}/end.png`});
  const settled=samples.filter(sample=>sample.elapsedMs>=Math.min(durationMs*.2,5*60_000)&&sample.jsHeapUsed!==null),split=Math.max(1,Math.floor(settled.length*.25));
  const earlyHeap=median(settled.slice(0,split).map(sample=>sample.jsHeapUsed)),lateHeap=median(settled.slice(-split).map(sample=>sample.jsHeapUsed)),heapGrowth=lateHeap-earlyHeap;
  const p95Values=samples.filter(sample=>sample.frameTimeP95>0).map(sample=>sample.frameTimeP95),resourceSpread=key=>{const values=samples.filter(sample=>sample.screen==='drive').map(sample=>sample.resources[key]);return values.length?Math.max(...values)-Math.min(...values):0;};
  const report={environment:`Installed Edge/${renderer==='webgl'?'WebGL2':'automatic renderer'}, Low 1280×720, normal real-time render loop and 120Hz physics on the development host. Not target-laptop or whole-process/GPU-memory evidence.`,requestedMinutes:minutes,elapsedMs:final.elapsedMs,sampleMs,config,cycles,homes,samples,summary:{cycleCount:cycles.length,earlyHeap,lateHeap,heapGrowth,heapGrowthMB:heapGrowth/1048576,maxFrameTimeP95:Math.max(0,...p95Values),medianFrameTimeP95:median(p95Values),maxPhysicsMs:Math.max(...samples.map(sample=>sample.physicsMs)),minFps:Math.min(...samples.map(sample=>sample.fps)),resourceSpread:{meshes:resourceSpread('meshes'),materials:resourceSpread('materials'),textures:resourceSpread('textures'),transformNodes:resourceSpread('transformNodes')}},errors,warnings,failed,external};
  const requiredCycles=minutes>=25?3:0;assert.ok(cycles.length>=requiredCycles,`expected at least ${requiredCycles} completed races, saw ${cycles.length}`);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);assert.deepEqual(warnings.filter(message=>!message.includes('powerPreference option is currently ignored')),[]);
  if(minutes>=25){assert.ok(heapGrowth<=Math.max(32*1048576,earlyHeap*.35),`settled JS heap grew ${(heapGrowth/1048576).toFixed(1)} MB`);assert.ok(report.summary.resourceSpread.textures<=6,`texture spread ${report.summary.resourceSpread.textures} suggests retained session resources`);assert.ok(report.summary.maxFrameTimeP95<=80,`rolling frame p95 reached ${report.summary.maxFrameTimeP95.toFixed(1)} ms`);}
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log('Endurance passed',JSON.stringify(report.summary));
}catch(error){await fs.writeFile(`${output}/failure.json`,JSON.stringify({error:String(error),samples,homes,cycles,errors,warnings,failed,external,lastState:await inspect(0).catch(()=>null)},null,2));throw error;
}finally{await browser.close();}
