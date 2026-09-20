import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'output/atmosphere/gpu';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),report={errors:[],scenes:[]};
page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.traffic=12;g.save.settings.timeRate=0;await g.startDrive();g.teleport(-380,100,'lakeshore');await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);});
  for(const [name,time,weather,skyOnly]of [['day-road',12,'Clear',false],['cloud-ceiling',12,'Cloudy',true],['night-road',22,'Rain',false]]){
    await page.evaluate(async({time,weather})=>{const g=window.kairos;g.save.settings.time=time;g.save.settings.weather=weather;g.wetness=weather==='Rain'?.8:0;await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();},{time,weather});
    const result=await page.evaluate(async skyOnly=>{
      const {EngineInstrumentation,Vector3}=await import('/node_modules/@babylonjs/core/index.js'),g=window.kairos,engine=g.renderer.engine,scene=g.renderer.scene,loops=[...engine.activeRenderLoops],instrument=new EngineInstrumentation(engine),counter=instrument.gpuFrameTimeCounter,modes=[];
      const observer=skyOnly?scene.onBeforeRenderObservable.add(()=>{const c=g.renderer.camera;c.setTarget(c.position.add(new Vector3(.2,1,.1)));}):null;
      engine.stopRenderLoop();instrument.captureGPUFrameTime=true;
      const frame=async()=>{await new Promise(resolve=>requestAnimationFrame(resolve));await g.advanceTime(0);};
      try{
        for(const enabled of [true,false,true]){
          g.renderer.sky.setEnabled(enabled);for(let i=0;i<18;i++)await frame();const gpuMs=[],submitMs=[];let count=counter.count;
          for(let i=0;i<90;i++){await new Promise(resolve=>requestAnimationFrame(resolve));const t=performance.now();await g.advanceTime(0);submitMs.push(performance.now()-t);if(counter.count>count){if(counter.current>0)gpuMs.push(counter.current/1e6);count=counter.count;}}
          const percentile=(a,p)=>a.length?[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))]:null;
          modes.push({enabled,gpuMs,submitMs,gpuMedian:percentile(gpuMs,.5),gpuP95:percentile(gpuMs,.95),submitMedian:percentile(submitMs,.5)});
        }
      }finally{g.renderer.sky.setEnabled(true);if(observer)scene.onBeforeRenderObservable.remove(observer);instrument.captureGPUFrameTime=false;instrument.dispose();loops.forEach(loop=>engine.runRenderLoop(loop));}
      return {adapter:engine.getGlInfo(),quality:g.save.settings.quality,resolution:[engine.getRenderWidth(),engine.getRenderHeight()],timerAvailable:!!engine.getCaps().timerQuery,modes};
    },skyOnly);report.scenes.push({name,...result});console.log(JSON.stringify({name,modes:result.modes.map(({gpuMs,submitMs,...m})=>({...m,samples:gpuMs.length}))}));
  }
  assert.deepEqual(report.errors,[]);report.scope='Static Edge/WebGL2 720p Low on development host, 12 traffic, physics clock held. GPU timer queries, 90 samples after 18 warmups per on/off/on group. Sky off is a diagnostic, not the old sky. Includes near-full-screen cloud ceiling. Not moving-route, target-laptop FPS or a precise marginal cost claim.';
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
}catch(error){report.failure=String(error);await fs.writeFile(`${output}/failure.json`,JSON.stringify(report,null,2));throw error;}finally{await browser.close();}
