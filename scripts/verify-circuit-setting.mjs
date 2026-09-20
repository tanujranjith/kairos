import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const before=process.argv.includes('--before'),output=`output/circuit-setting/${before?'before':'after'}`,errors=[],external=[],scenes=[];
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(90000);
page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!/^(http:\/\/127\.0\.0\.1:5187|data:|blob:)/.test(r.url()))external.push(r.url());});
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.timeRate=0;g.save.settings.traffic=0;g.save.settings.volume=0;Object.assign(g.raceConfig,{kind:'Practice',vehicleClass:'GT',entrants:1,position:1});await g.startRace();});
  for(const view of ['pit-match','pit-wide','paddock','back-straight','grid','wet-pit']){
    const result=await page.evaluate(async view=>{
      const g=window.kairos,{PIT,CIRCUIT,pointAt}=await import('/src/content/world.ts'),{Vector3}=await import('/node_modules/@babylonjs/core/Maths/math.vector.js');
      const p=view==='back-straight'?pointAt(CIRCUIT,1950):view==='grid'?pointAt(CIRCUIT,CIRCUIT.length-46,-3):pointAt(PIT,258);
      g.save.settings.time=view==='wet-pit'?20:17.4;g.save.settings.weather=view==='wet-pit'?'Rain':'Clear';g.wetness=view==='wet-pit'?.8:0;
      g.player.reset(p,p.yaw);await g.world.loadAround(p,true);await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);
      if(view==='paddock'){g.renderer.camera.position.set(800,43,-1466);g.renderer.camera.setTarget(new Vector3(850,20,-1365));}
      else if(view==='pit-wide'){const q=g.player.node.position;g.renderer.camera.position.set(q.x-16,q.y+8,q.z-17);g.renderer.camera.setTarget(q.add(new Vector3(0,2,0)));}
      else if(view==='pit-match'||view==='wet-pit'){const q=g.player.node.position;g.renderer.camera.position.set(q.x-10,q.y+6,q.z-10);g.renderer.camera.setTarget(q);}
      document.querySelector('#ui').style.visibility='hidden';await g.renderer.scene.whenReadyAsync();g.renderer.scene.render();
      const count=g.renderer.scene.getMeshByName('aster-woodland-leaves')?.thinInstanceCount??0;
      return {view,player:g.player.state,woodland:count,meshes:g.renderer.scene.meshes.length,materials:g.renderer.scene.materials.length};
    },view);
    await page.screenshot({path:`${output}/${view}.png`});scenes.push(result);
    assert.equal(result.player.grounded,true);assert.equal(result.player.wheels.filter(w=>w.contact).length,4);assert.equal(result.player.damage,0);
    if(!before)assert.ok(result.woodland>300);
  }
  if(!before){
    const levels=await page.evaluate(()=>{const g=window.kairos,rows=[];for(const quality of ['Low','Medium','High','Ultra','Low']){g.world.setQuality(quality);const m=g.renderer.scene.getMeshByName('aster-woodland-leaves');rows.push({quality,indices:m.getTotalIndices(),instances:m.thinInstanceCount,batches:g.renderer.scene.meshes.filter(m=>m.name.startsWith('aster-woodland-')).length});}return rows;});
    assert.ok(levels[0].indices<levels[1].indices&&levels[1].indices<levels[2].indices);assert.equal(levels[2].indices,levels[3].indices);assert.equal(levels[0].indices,levels[4].indices);assert.ok(levels.every(l=>l.instances===856&&l.batches===2));scenes.push({woodlandLevels:levels});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await fs.writeFile(`${output}/report.json`,JSON.stringify({environment:'Installed Edge/WebGL2 Low720p; fixed inspection views, not laptop performance certification.',scenes,errors,external},null,2));
  console.log(JSON.stringify({scenes:scenes.map(s=>s.player?{view:s.view,woodland:s.woodland,grounded:s.player.grounded}:s),errors,external}));
}finally{await browser.close();}
