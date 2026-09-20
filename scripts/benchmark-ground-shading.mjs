import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'output/ground-cover/gpu';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],report={errors,scenes:[]};
page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.traffic=12;g.save.settings.timeRate=0;g.save.settings.time=16;await g.startDrive();});
  for(const [name,x,z,road]of [['mountain',1130,320,'pass'],['lakeshore',-380,100,'lakeshore'],['city',-1340,-980,'city3']]){
    await page.evaluate(async({x,z,road})=>{const g=window.kairos;g.teleport(x,z,road);await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);await g.renderer.scene.whenReadyAsync();for(let i=0;i<10;i++)await g.advanceTime(0);},{x,z,road});
    if(name==='mountain'&&process.argv.includes('--study')){
      await page.screenshot({path:`${output}/study-normal.png`});
      await page.evaluate(async()=>{const g=window.kairos;g.world.backdrop.setEnabled(false);await g.advanceTime(0);});await page.screenshot({path:`${output}/study-without-backdrop.png`});
      await page.evaluate(async()=>{const g=window.kairos;g.world.backdrop.setEnabled(true);g.renderer.scene.shadowsEnabled=false;await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();await g.advanceTime(0);});await page.screenshot({path:`${output}/study-without-shadows.png`});
      await page.evaluate(async()=>{const g=window.kairos;g.renderer.scene.shadowsEnabled=true;g.renderer.scene.getMaterialByName('meadow').bumpTexture.level=0;await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();await g.advanceTime(0);});await page.screenshot({path:`${output}/study-without-bump.png`});
      await page.evaluate(()=>{window.kairos.renderer.scene.getMaterialByName('meadow').bumpTexture.level=.55;});
    }
    const sample=await page.evaluate(async()=>{
      const {EngineInstrumentation,Material}=await import('/node_modules/@babylonjs/core/index.js');
      const g=window.kairos,engine=g.renderer.engine,scene=g.renderer.scene,loops=[...engine.activeRenderLoops],instrument=new EngineInstrumentation(engine),counter=instrument.gpuFrameTimeCounter;
      const materials=['meadow','atmospheric-ridges'].map(name=>scene.getMaterialByName(name)),original=materials.map(m=>m.pluginManager.getPlugin('KairosGround').prepareDefines.bind(m.pluginManager.getPlugin('KairosGround'))),modes=[];
      engine.stopRenderLoop();instrument.captureGPUFrameTime=true;
      const frame=async()=>{await new Promise(resolve=>requestAnimationFrame(resolve));await g.advanceTime(0);};
      try{
        for(const enabled of [true,false,true]){
          materials.forEach((m,i)=>{m.pluginManager.getPlugin('KairosGround').prepareDefines=defines=>{original[i](defines);defines.KAIROS_GROUND=enabled;};m.markAsDirty(Material.AllDirtyFlag);});
          await frame();await scene.whenReadyAsync();for(let i=0;i<16;i++)await frame();
          const gpuMs=[],submitMs=[];let count=counter.count;
          for(let i=0;i<90;i++){await new Promise(resolve=>requestAnimationFrame(resolve));const start=performance.now();await g.advanceTime(0);submitMs.push(performance.now()-start);if(counter.count>count){if(counter.current>0)gpuMs.push(counter.current/1e6);count=counter.count;}}
          const percentile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))]:null;
          modes.push({enabled,gpuMs,submitMs,gpuMedian:percentile(gpuMs,.5),gpuP95:percentile(gpuMs,.95),submitMedian:percentile(submitMs,.5)});
        }
      }finally{
        materials.forEach((m,i)=>{m.pluginManager.getPlugin('KairosGround').prepareDefines=original[i];m.markAsDirty(Material.AllDirtyFlag);});instrument.captureGPUFrameTime=false;instrument.dispose();loops.forEach(loop=>engine.runRenderLoop(loop));
      }
      return {adapter:engine.getGlInfo(),quality:g.save.settings.quality,resolution:[engine.getRenderWidth(),engine.getRenderHeight()],timerAvailable:!!engine.getCaps().timerQuery,modes};
    });report.scenes.push({name,...sample});console.log(JSON.stringify({name,timerAvailable:sample.timerAvailable,modes:sample.modes.map(({gpuMs,submitMs,...m})=>({...m,samples:gpuMs.length}))}));
  }
  assert.deepEqual(errors,[]);report.scope='Static same-view GPU timing with simulation held, 90 displayed samples per on/off/on mode, 16 warmup frames. Off is a shader-cost diagnostic using packed terrain controls, not the old visual build. RTX development host, not target laptop or moving-route FPS. Null GPU values mean timing unavailable.';
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
}catch(error){report.failure=String(error);await fs.writeFile(`${output}/failure.json`,JSON.stringify(report,null,2));throw error;}finally{await browser.close();}
