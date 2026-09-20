import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const option=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3),renderer=option('renderer')??'webgl',output=option('output')??'output/atmosphere/live',baseline=process.argv.includes('--baseline');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),report={renderer,baseline,scenes:[],errors:[],warnings:[],external:[]};
page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))report.warnings.push(m.text());});
page.on('request',r=>{if(!/^(http:\/\/127\.0\.0\.1:5187|data:|blob:)/.test(r.url()))report.external.push(r.url());});
const capture=async name=>{await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();for(let i=0;i<8;i++)await g.advanceTime(0);});await page.screenshot({path:`${output}/${name}.png`});};
try{
  await page.goto(`http://127.0.0.1:5187/${renderer==='webgl'?'?renderer=webgl':''}`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  report.actualRenderer=await page.evaluate(()=>window.kairos.renderer.rendererName);assert.equal(report.actualRenderer,renderer==='webgl'?'WebGL2':'WebGPU');
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.timeRate=0;g.save.settings.traffic=0;await g.startDrive();g.teleport(-380,100,'lakeshore');await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);});
  const original=await page.evaluate(()=>({clock:window.kairos.clock,player:structuredClone(window.kairos.player.state)}));
  for(const [name,time,weather] of [['dawn',6.6,'Clear'],['noon',12,'Clear'],['golden',17.4,'Clear'],['cloudy',16,'Cloudy'],['overcast',15,'Overcast'],['rain',15,'Rain'],['night',0,'Clear'],['wet-night',22,'Rain']]){
    await page.evaluate(({time,weather})=>{const g=window.kairos;g.save.settings.time=time;g.save.settings.weather=weather;g.wetness=weather==='Rain'?.8:0;},{time,weather});await capture(name);
    const state=await page.evaluate(()=>{const g=window.kairos,s=g.renderer.scene;return {clock:g.clock,player:structuredClone(g.player.state),resources:{meshes:s.meshes.length,materials:s.materials.length,textures:s.textures.length},sky:{ready:g.renderer.sky.isReady(true),triangles:g.renderer.sky.getTotalIndices()/3,material:g.renderer.sky.material.getClassName(),atlas:g.renderer.atmosphere?.atlas.getSize()}};});
    assert.equal(state.clock,original.clock);assert.deepEqual(state.player,original.player);assert.ok(state.sky.ready);if(!baseline){assert.equal(state.sky.material,'ShaderMaterial');assert.deepEqual(state.sky.atlas,{width:512,height:512});}
    report.scenes.push({name,time,weather,...state});
    if(name==='night'){
      await page.evaluate(async()=>{const {Vector3}=await import('/node_modules/@babylonjs/core/Maths/math.vector.js'),g=window.kairos,r=g.renderer;r.camera.setTarget(r.camera.position.add(new Vector3(.3,.72,-1)));for(let i=0;i<3;i++){r.engine.beginFrame();try{r.scene.render();}finally{r.engine.endFrame();}}});await page.screenshot({path:`${output}/night-sky.png`});
      if(!baseline){
        report.moon=await page.evaluate(async()=>{
          const {Vector3}=await import('/node_modules/@babylonjs/core/Maths/math.vector.js'),{solarLighting}=await import('/src/render/atmosphere.ts'),g=window.kairos,r=g.renderer,moon=solarLighting(0).direction;
          r.camera.setTarget(r.camera.position.subtract(new Vector3(moon.x,moon.y,moon.z).scale(100)));
          for(let i=0;i<3;i++){r.engine.beginFrame();try{r.scene.render();}finally{r.engine.endFrame();}}
          const width=r.engine.getRenderWidth(),height=r.engine.getRenderHeight(),pixels=await r.engine.readPixels(Math.floor(width/2)-8,Math.floor(height/2)-8,16,16),values=Array.from(pixels).filter((_,i)=>i%4!==3);
          return {max:Math.max(...values),mean:values.reduce((s,v)=>s+v,0)/values.length};
        });assert.ok(report.moon.max>100,'moon missing at shared solar direction');await page.screenshot({path:`${output}/moon-direction.png`});
      }
    }
  }
  assert.ok(report.scenes.every(s=>JSON.stringify(s.resources)===JSON.stringify(report.scenes[0].resources)),'weather changes allocate resources');
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.weather='Clear';g.save.settings.time=16;g.wetness=0;await g.advanceTime(0);});
  await page.keyboard.down('ArrowUp');for(let i=0;i<6;i++)await page.evaluate(()=>window.advanceTime(500));await page.keyboard.up('ArrowUp');await capture('driving');report.drive=await page.evaluate(()=>window.kairos.snapshot());
  assert.ok(report.drive.player.speed>5);assert.equal(report.drive.player.damage,0);assert.ok(report.drive.player.wheels.every(w=>w.contact));
  await page.evaluate(async()=>{await window.kairos.action('home');await window.advanceTime(0);});assert.equal(await page.evaluate(()=>window.kairos.world.cells.size),0);
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);assert.deepEqual(report.warnings.filter(w=>!w.includes('The powerPreference option is currently ignored when calling requestAdapter() on Windows')),[]);
  report.scope='Installed Edge on development PC; eight fixed-clock lighting/weather views, actual screenshot review, resource stability, normal keyboard driving and home cleanup. Not target-laptop FPS or full art acceptance.';
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({renderer:report.actualRenderer,scenes:report.scenes.map(s=>s.name),drive:report.drive.player.speed,resources:report.scenes[0].resources,errors:report.errors}));
}catch(error){report.failure=String(error);await fs.writeFile(`${output}/failure.json`,JSON.stringify(report,null,2));await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}finally{await browser.close();}
