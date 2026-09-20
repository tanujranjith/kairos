import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const fallback=process.argv.includes('--fallback'),output=`output/road-models${fallback?'-fallback':''}`;await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],external=[],rows=[];
page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:5187'))external.push(r.url());});
const warm=async()=>page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();for(let n=0;n<12;n++)await g.advanceTime(0);});
try{
  if(fallback)await page.route('**/models/*.glb',route=>route.abort());
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  for(const id of ['aeris','velara','crest','nova','gtx','apex']){
    await page.click('[data-action="screen"][data-value="garage"]');await page.click(`[data-action="select-car"][data-value="${id}"]`);
    for(const livery of [0,1,2]){
      await page.evaluate(async livery=>{const g=window.kairos;await g.action('custom',JSON.stringify({key:'livery',value:livery}));g.setScreen('garage');},livery);await warm();
      if(livery===0)await page.screenshot({path:`${output}/${id}-gallery.png`});
      for(const [name,position]of (livery===0?[['front',[-3.4,-997.8,5.1]],['rear',[3.4,-997.7,-5.1]]]:[['livery'+livery,[-3.0,-997.15,4.3]]])){
        await page.evaluate(async position=>{const g=window.kairos,{Vector3}=await import('/node_modules/@babylonjs/core/Maths/math.vector.js');document.querySelector('#ui').style.visibility='hidden';g.renderer.camera.position.set(...position);g.renderer.camera.setTarget(new Vector3(0,-999.0,0));g.renderer.camera.fov=.60;g.renderer.scene.render();},position);
        await page.screenshot({path:`${output}/${id}-${name}.png`});await page.evaluate(()=>document.querySelector('#ui').style.visibility='');
      }
      rows.push(await page.evaluate(({id,livery})=>{const v=window.kairos.visual,brakes=v.root.getChildTransformNodes().filter(n=>/brake-\d$/.test(n.name));return {id,livery,asset:v.parts.some(m=>m.name.includes('instance')),triangles:v.parts.reduce((n,m)=>n+m.getTotalIndices()/3,0),brakes:brakes.length,parkedBrakes:brakes.every(b=>b.position.y===-.32&&b.rotation.length()===0),wheels:v.wheels.length};},{id,livery}));
    }
    await page.evaluate(async()=>{const g=window.kairos;await g.action('custom',JSON.stringify({key:'livery',value:0}));g.save.settings.traffic=0;g.save.settings.timeRate=0;await g.startDrive();await g.advanceTime(1000);});
    await page.keyboard.down('ArrowUp');await page.evaluate(()=>window.advanceTime(1600));await page.keyboard.down('ArrowRight');await page.evaluate(()=>window.advanceTime(150));await page.keyboard.up('ArrowRight');await page.waitForTimeout(110);
    const steered=await page.evaluate(()=>{const v=window.kairos.visual;return v.wheels.slice(0,2).map((w,i)=>{const b=v.root.getChildTransformNodes().find(n=>n.name.endsWith('brake-'+i));return {steer:w.rotation.y,caliperSteer:b.rotation.y,caliperSpin:b.rotation.x,positionError:b.position.subtract(w.position).length()};});});
    for(const b of steered){assert.ok(Math.abs(b.steer)>.01);assert.equal(b.caliperSteer,b.steer);assert.equal(b.caliperSpin,0);assert.equal(b.positionError,0);}
    // Reset after the steering check: otherwise the uncorrected Formula heading
    // carries it off the road during the longer camera sequence.
    await page.keyboard.up('ArrowUp');await page.keyboard.press('KeyR');await page.evaluate(()=>window.advanceTime(600));await page.keyboard.down('ArrowUp');await page.evaluate(()=>window.advanceTime(1600));
    const cameras=[];for(const camera of [0,1,2,3,4]){await page.evaluate(async camera=>{const g=window.kairos;g.save.settings.camera=camera;await g.advanceTime(600);},camera);await page.waitForTimeout(110);await warm();await page.screenshot({path:`${output}/${id}-camera${camera}.png`});cameras.push(await page.evaluate(camera=>{const g=window.kairos;return {camera,distance:g.renderer.camera.position.subtract(g.visual.root.position).length()};},camera));}
    assert.ok(cameras[0].distance>4);assert.ok(cameras[1].distance<cameras[0].distance-.3);assert.ok(cameras[2].distance<1.1);
    await page.keyboard.up('ArrowUp');
    const state=await page.evaluate(()=>{const g=window.kairos,v=g.visual;return {speed:g.player.state.speed,damage:g.player.state.damage,contacts:g.player.state.wheels.filter(w=>w.contact).length,gear:g.player.state.gear,rpm:g.player.state.rpm,display:v.parts.map(p=>p.material?.metadata?.telemetry).find(Boolean),brakes:v.wheels.map((w,i)=>{const b=v.root.getChildTransformNodes().find(n=>n.name.endsWith('brake-'+i));return {spin:w.rotation.x,caliperSpin:b?.rotation.x,steer:w.rotation.y,caliperSteer:b?.rotation.y,positionError:b?.position.subtract(w.position).length()};})};});
    assert.ok(state.speed>5&&state.damage===0&&state.contacts===4,JSON.stringify({id,state}));assert.equal(state.display.speedKph,Math.round(state.speed*3.6));assert.equal(state.display.gear,String(state.gear));assert.equal(state.display.rpm,Math.round(state.rpm/100)*100);
    for(const b of state.brakes){assert.ok(Math.abs(b.spin)>1);assert.equal(b.caliperSpin,0);assert.equal(b.caliperSteer,b.steer);assert.equal(b.positionError,0);}
    rows.push({id,drive:state,cameras,steered});console.log(id,'showroom/liveries/cameras/contacts/fixed-calipers pass');await page.keyboard.press('Escape');await page.click('[data-action="home"]');
  }
  for(const r of rows.filter(r=>r.livery!==undefined)){assert.equal(r.asset,!fallback&&r.livery===0);assert.equal(r.brakes,4);assert.equal(r.parkedBrakes,true);assert.equal(r.wheels,4);assert.ok(r.triangles<40000,JSON.stringify(r));}
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await fs.writeFile(`${output}/report.json`,JSON.stringify({fallback,rows,errors,external},null,2));
}catch(error){await fs.writeFile(`${output}/failure.json`,JSON.stringify({error:String(error),rows,errors,external,state:await page.evaluate(()=>JSON.parse(window.render_game_to_text())).catch(()=>null)},null,2));throw error;}finally{await browser.close();}
