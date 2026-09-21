import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'output/streetscape/live';await fs.mkdir(output,{recursive:true});
const renderer=process.argv.find(a=>a.startsWith('--renderer='))?.slice(11)??'webgl';assert.ok(['webgl','auto'].includes(renderer));
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],warnings=[],report={errors,warnings,checks:[]};
page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(['error','warning'].includes(m.type()))warnings.push(m.text());});
const warm=()=>page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();for(let i=0;i<12;i++)await g.advanceTime(0);});
try{
  await page.goto(`http://127.0.0.1:5187/${renderer==='webgl'?'?renderer=webgl':''}`);await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  report.renderer=await page.evaluate(()=>window.kairos.renderer.rendererName);assert.equal(report.renderer,renderer==='webgl'?'WebGL2':'WebGPU');
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.traffic=0;g.save.settings.timeRate=0;await g.startDrive();
    const {STREET_LAMPS,STREET_PEDESTRIANS}=await import('/src/content/streetscape.ts'),{ROADS,pointAt}=await import('/src/content/world.ts');
    const lamp=STREET_LAMPS.find(f=>f.roadId==='city3'&&f.s>230&&f.s<400),p=pointAt(ROADS.find(r=>r.id==='city3'),lamp.s-5,2.1);
    g.teleport(p.x,p.z,'city3');await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);window.streetLamp=lamp;window.streetPeople=STREET_PEDESTRIANS.filter(person=>Math.hypot(person.x-lamp.x,person.z-lamp.z)<35);
  });
  for(const [name,time,weather]of [['day',15,'Clear'],['dusk',18.5,'Cloudy'],['night',22,'Clear'],['wet-night',22,'Rain']]){
    await page.evaluate(async({time,weather})=>{const g=window.kairos;g.save.settings.time=time;g.save.settings.weather=weather;g.wetness=weather==='Rain'?.8:0;await g.advanceTime(1000);},{time,weather});await warm();await page.screenshot({path:`${output}/${name}.png`});
    const s=await page.evaluate(()=>({state:window.kairos.snapshot(),lights:window.kairos.world.streetLighting.snapshot()}));
    assert.equal(s.state.player.damage,0);assert.equal(s.state.player.wheels.filter(w=>w.contact).length,4);assert.ok(s.lights.filter(l=>l.enabled).length<3);
    if(time===15)assert.ok(s.lights.every(l=>!l.enabled));else assert.ok(s.lights.some(l=>l.enabled));report.checks.push({name,position:s.state.player.position,lights:s.lights});
  }
  report.illumination=await page.evaluate(async()=>{
    const g=window.kairos,engine=g.renderer.engine;
    const render=()=>{engine.beginFrame();try{g.renderer.scene.render();}finally{engine.endFrame();}};
    const measure=async()=>{const w=engine.getRenderWidth(),h=engine.getRenderHeight();let pixels;engine.beginFrame();try{g.renderer.scene.render();pixels=engine.readPixels(0,0,w,h);}finally{engine.endFrame();}
      const bytes=await pixels,p=new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(p.length!==w*h*4)throw new Error('Incomplete framebuffer readback');let sum=0,count=0;
      const bottom=engine.isWebGPU?.54:.12,top=engine.isWebGPU?.88:.46;
      for(let y=Math.round(h*bottom);y<h*top;y++)for(let x=Math.round(w*.35);x<w*.65;x++){const i=(y*w+x)*4;sum+=(p[i]+p[i+1]+p[i+2])/3;count++;}return sum/count;
    };
    const on=await measure();g.world.streetLighting.disable();render();await g.renderer.scene.whenReadyAsync();render();const off=await measure();return {on,off};
  });await page.screenshot({path:`${output}/street-lights-disabled-comparison.png`});
  assert.ok(report.illumination.on>report.illumination.off+1,JSON.stringify(report.illumination));
  report.people=await page.evaluate(async()=>{
    const g=window.kairos,people=window.streetPeople,meshes=g.renderer.scene.meshes.filter(mesh=>mesh.name.startsWith('street-life-')&&mesh.isVisible),standing=people.find(person=>person.pose==='standing'),seated=people.find(person=>person.pose==='seated'),focus=seated??standing;
    if(!focus)throw new Error('No authored shelter pedestrians near the verification road');
    g.save.settings.time=15;g.save.settings.weather='Clear';g.wetness=0;await g.advanceTime(1000);await g.world.loadAround(focus,true);document.querySelector('#ui').style.visibility='hidden';
    const direction={x:Math.sin(focus.yaw),z:Math.cos(focus.yaw)},target=g.renderer.camera.position.clone();g.renderer.camera.position.set(focus.x+direction.x*4+direction.z*1.4,focus.y+2.25,focus.z+direction.z*4-direction.x*1.4);target.set(focus.x,focus.y+.85,focus.z);g.renderer.camera.setTarget(target);
    await g.renderer.scene.whenReadyAsync();g.renderer.scene.render();
    return {authored:people.length,poses:[...new Set(people.map(person=>person.pose))],meshes:meshes.length,triangles:meshes.reduce((sum,mesh)=>sum+mesh.getTotalIndices()/3,0),focus};
  });await page.screenshot({path:`${output}/street-life.png`});await page.evaluate(()=>document.querySelector('#ui').style.visibility='');
  assert.ok(report.people.authored>=2);assert.deepEqual(report.people.poses.sort(),['seated','standing']);assert.ok(report.people.meshes>0);assert.ok(report.people.triangles>0);
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.weather='Clear';g.wetness=0;await g.advanceTime(1000);});
  await page.keyboard.down('ArrowUp');for(let i=0;i<8;i++)await page.evaluate(()=>window.advanceTime(500));await page.keyboard.up('ArrowUp');await warm();await page.screenshot({path:`${output}/driving.png`});
  report.drive=await page.evaluate(()=>({state:window.kairos.snapshot(),lights:window.kairos.world.streetLighting.snapshot()}));assert.ok(report.drive.state.player.speed>5);assert.equal(report.drive.state.player.damage,0);assert.equal(report.drive.state.player.wheels.filter(w=>w.contact).length,4);
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.time=22;await g.advanceTime(1000);});
  report.streaming=await page.evaluate(async()=>{
    const g=window.kairos,{STREET_FIXTURES,STREET_PEDESTRIANS}=await import('/src/content/streetscape.ts'),samples=[];
    for(let cycle=0;cycle<3;cycle++)for(const destination of ['lake','city']){
      if(destination==='lake')g.teleport(-380,100,'lakeshore');else g.teleport(window.streetLamp.x,window.streetLamp.z,'city3');
      await g.advanceTime(1000);g.world.warm.clear();g.world.update(g.player.state.position,g.player.state.velocity,[]);
      await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);await g.advanceTime(0);
      const lights=g.world.streetLighting.snapshot();
      samples.push({cycle,destination,lights,owned:lights.every(l=>!l.enabled||g.world.cells.get(l.cell)?.detail===true),pool:g.renderer.scene.lights.filter(l=>l.name.startsWith('street-light-pool')).length,meshes:g.renderer.scene.meshes.length,materials:g.renderer.scene.materials.length,textures:g.renderer.scene.textures.length});
    }
    return {fixtures:Object.fromEntries(['lamp','bench','bin','planter','shelter'].map(kind=>[kind,STREET_FIXTURES.filter(f=>f.kind===kind).length])),pedestrians:STREET_PEDESTRIANS.length,samples};
  });
  for(const sample of report.streaming.samples){
    assert.equal(sample.owned,true);assert.equal(sample.pool,2);
    if(sample.destination==='lake')assert.ok(sample.lights.every(l=>!l.enabled&&l.id===null));else assert.ok(sample.lights.some(l=>l.enabled));
    const first=report.streaming.samples.find(s=>s.destination===sample.destination);
    for(const key of ['meshes','materials','textures'])assert.equal(sample[key],first[key]);
  }
  await page.evaluate(async()=>{const g=window.kairos;await g.action('home');await g.advanceTime(0);});
  assert.ok(await page.evaluate(()=>window.kairos.world.streetLighting.snapshot().every(l=>!l.enabled&&l.id===null)));
  assert.equal(await page.evaluate(()=>window.kairos.renderer.scene.lights.filter(l=>l.name.startsWith('street-light-pool')).length),2);
  assert.deepEqual(errors,[]);assert.deepEqual(warnings.filter(w=>!w.includes('The powerPreference option is currently ignored when calling requestAdapter() on Windows')),[]);
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({renderer:report.renderer,checks:report.checks,illumination:report.illumination,speed:report.drive.state.player.speed,streaming:report.streaming,errors,warnings},null,2));
}catch(error){report.failure=String(error);await fs.writeFile(`${output}/failure.json`,JSON.stringify(report,null,2));await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}finally{await browser.close();}
