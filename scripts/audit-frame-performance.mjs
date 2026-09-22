import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const output=process.argv.find(value=>value.startsWith('--output='))?.slice(9)??'output/frame-performance';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],failed=[],external=[],scenes=[];
page.setDefaultTimeout(90000);
page.on('pageerror',error=>errors.push(String(error)));
page.on('response',response=>{if(response.status()>=400)failed.push({url:response.url(),status:response.status()});});
await page.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1'){external.push(url);return route.abort();}return route.continue();});

const percentile=(values,p)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];};
const settle=()=>page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);await g.advanceTime(1500);});
const moveWithTraffic=({x,z,road})=>page.evaluate(async target=>{const g=window.kairos;g.teleport(target.x,target.z,target.road);await g.advanceTime(100);await g.action('setting',JSON.stringify({key:'traffic',value:12}));g.setAutopilot(true,target.road);},{x,z,road});
const sample=async(name,frames=240)=>{
  await settle();
  const result=await page.evaluate(async({frames})=>{
    const {EngineInstrumentation}=await import('/node_modules/@babylonjs/core/index.js');
    const g=window.kairos,engine=g.renderer.engine,instrument=new EngineInstrumentation(engine),gpu=instrument.gpuFrameTimeCounter,rows=[];
    instrument.captureGPUFrameTime=true;let previous=performance.now(),gpuCount=gpu.count;
    const displayed=()=>new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
    g.resumeRealTime();
    try{
      for(let frame=0;frame<frames;frame++){
        await displayed();const now=performance.now(),state=g.snapshot(),gpuMs=gpu.count>gpuCount&&gpu.current>0?gpu.current/1e6:null;gpuCount=gpu.count;
        if(frame>=30)rows.push({frameMs:now-previous,cpuMs:state.cpuMs,stepLoopMs:state.physicsMs,simulationMs:state.simulationMs,aiMs:state.aiMs,gpuMs,speed:Math.abs(state.player.speed),contacts:state.player.wheels.filter(wheel=>wheel.contact).length});previous=now;
      }
    }finally{await g.advanceTime(0);g.setAutopilot(false);instrument.captureGPUFrameTime=false;instrument.dispose();}
    return {adapter:engine.getGlInfo(),timerAvailable:!!engine.getCaps().timerQuery,resolution:[engine.getRenderWidth(),engine.getRenderHeight()],quality:g.save.settings.quality,rows};
  },{frames});
  const gpuRows=result.rows.map(row=>row.gpuMs).filter(value=>value!==null),metrics={
    frameP95:percentile(result.rows.map(row=>row.frameMs),.95),
    cpuP95:percentile(result.rows.map(row=>row.cpuMs),.95),
    stepLoopP95:percentile(result.rows.map(row=>row.stepLoopMs),.95),
    simulationP95:percentile(result.rows.map(row=>row.simulationMs),.95),
    aiP95:percentile(result.rows.map(row=>row.aiMs),.95),
    gpuP95:gpuRows.length?percentile(gpuRows,.95):null,
    gpuSamples:gpuRows.length,
    maxSpeed:Math.max(...result.rows.map(row=>row.speed)),
    minContacts:Math.min(...result.rows.map(row=>row.contacts)),
  };
  await page.screenshot({path:`${output}/${name}.png`});scenes.push({name,...result,metrics});
  console.log(name,JSON.stringify(metrics));
};

try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.automaticQuality=false;g.save.settings.quality='Low';g.save.settings.resolution=1;g.save.settings.timeRate=0;await g.startDrive();});
  await moveWithTraffic({x:-1340,z:-980,road:'city3'});await sample('city-traffic');
  await moveWithTraffic({x:1130,z:320,road:'pass'});await sample('mountain-pass');
  await moveWithTraffic({x:340,z:-350,road:'crossway'});await sample('highway');
  await moveWithTraffic({x:-1340,z:-980,road:'city3'});await page.evaluate(()=>{const g=window.kairos;g.save.settings.time=22;g.save.settings.weather='Rain';g.wetness=.85;});await sample('wet-night');
  await page.evaluate(async()=>{const g=window.kairos;await g.action('home');g.save.settings.time=17.4;g.save.settings.weather='Clear';g.wetness=0;g.raceConfig.entrants=8;g.raceConfig.vehicleClass='GT';await g.startRace();g.setAutopilot(true,'circuit');});await sample('eight-car-race',420);
  const budgets={frameP95:40,cpuP95:12,simulationP95:5,aiP95:2,gpuP95:28};
  const report={description:'Development RTX/Windows host, installed Edge/WebGL2, Low 1280x720. Thirty displayed warmup frames followed by moving real-time samples. CPU is complete Kairos render-loop callback; step loop is all 120Hz simulation work; simulation isolates vehicle force/Havok/post-step work; AI includes traffic/opponent decisions and controller input. GPU uses native timer queries where available. This is not target-laptop certification.',budgets,scenes:scenes.map(scene=>({...scene,passes:{frame:scene.metrics.frameP95<=budgets.frameP95,cpu:scene.metrics.cpuP95<=budgets.cpuP95,simulation:scene.metrics.simulationP95<=budgets.simulationP95,ai:scene.metrics.aiP95<=budgets.aiP95,gpu:!scene.timerAvailable||scene.metrics.gpuP95<=budgets.gpuP95}})),errors,failed,external};
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  for(const scene of scenes){const m=scene.metrics;assert.ok(m.frameP95<=budgets.frameP95,`${scene.name} frame p95 ${m.frameP95}`);assert.ok(m.cpuP95<=budgets.cpuP95,`${scene.name} CPU p95 ${m.cpuP95}`);assert.ok(m.simulationP95<=budgets.simulationP95,`${scene.name} simulation p95 ${m.simulationP95}`);assert.ok(m.aiP95<=budgets.aiP95,`${scene.name} AI p95 ${m.aiP95}`);if(scene.timerAvailable){assert.ok(m.gpuSamples>=Math.floor(scene.rows.length*.45),`${scene.name} has only ${m.gpuSamples} GPU samples`);assert.ok(m.gpuP95<=budgets.gpuP95,`${scene.name} GPU p95 ${m.gpuP95}`);}assert.ok(m.minContacts>=2,`${scene.name} lost road support`);}
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);
}catch(error){await fs.writeFile(`${output}/failure.json`,JSON.stringify({failure:String(error),scenes,errors,failed,external},null,2));throw error;}finally{await browser.close();}
