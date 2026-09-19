import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const output='output/road-layers';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);
  const report=await page.evaluate(async()=>{const {validateLayers}=await import('/src/tools/layer-validation.ts');return validateLayers(window.kairos);});
  await fs.writeFile(`${output}/report.json`,JSON.stringify({...report,errors},null,2));
  for(const [key,layer,road] of [['upper','ridgeway-overpass','pass'],['upperReset','ridgeway-overpass','pass'],['lower','surface','ring'],['lowerReset','surface','ring'],['lake','aurelia-bridge','northbridge'],['tunnel','ridgeway-tunnel','pass']]){const s=report.states[key];assert.equal(s.grounded,true,key);assert.equal(s.wheels.filter(w=>w.contact).length,4,key);assert.ok(s.wheels.every(w=>w.surface==='Asphalt'&&w.layer===layer&&w.roadId===road),`${key}: ${JSON.stringify(s.wheels)}`);}
  assert.equal(report.states.underBridgeGrass.surface,'Grass');assert.equal(report.states.underBridgeGrass.layer,'terrain');assert.equal(report.states.splitSurface.surface,'Mixed');assert.deepEqual([...new Set(report.states.splitSurface.wheels.map(w=>w.surface))].sort(),['Asphalt','Grass']);
  for(const t of report.traversals){assert.ok(t.progress>=t.end,t.road+' failed to cross');assert.ok(t.maxLateral<1.5,`${t.road} lateral ${t.maxLateral}`);assert.ok(t.air<.1,`${t.road} airborne ${t.air}`);assert.ok(t.state.damage<.01,t.road+' damage');assert.deepEqual(t.wrongContacts,[],t.road+' unexpected contact material');}
  for(const [name,id,x,z] of [['overpass-upper','pass',924.026,1545.379],['overpass-lower','ring',924.026,1545.379],['workshop','lakeshore',-380,70]]){
    await page.evaluate(async({id,x,z})=>{const g=window.kairos;await g.startDrive();g.teleport(x,z,id);await g.advanceTime(1500);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);await g.renderer.scene.whenReadyAsync();for(let i=0;i<10;i++)await g.advanceTime(0);},{id,x,z});await page.screenshot({path:`${output}/${name}.png`});
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({states:Object.fromEntries(Object.entries(report.states).map(([k,s])=>[k,{surface:s.surface,layer:s.layer,contacts:s.wheels.filter(w=>w.contact).length}])),traversals:report.traversals.map(({state,...t})=>({...t,damage:state.damage})),errors},null,2));
}finally{await browser.close();}
