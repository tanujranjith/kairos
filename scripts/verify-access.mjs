import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const output='output/circuit-access';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],reports={};page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);
  for(const which of ['contacts','inbound','outbound']){reports[which]=await page.evaluate(async which=>{const {validateAccess}=await import('/src/tools/access-validation.ts');return validateAccess(window.kairos,which);},which);await fs.writeFile(`${output}/report.json`,JSON.stringify({reports,errors},null,2));const r=reports[which];console.log(which,JSON.stringify(which==='contacts'?{samples:Object.keys(r.states)}:{length:r.length,progress:r.progress,elapsed:r.elapsed,maxError:r.maxError,air:r.air,damage:r.state.damage,wrongContacts:r.wrongContacts.length}));}
  for(const [id,road,layer] of [['upper','circuit','aster-access-overpass'],['lower','circuitlink','surface'],['pit','pit','surface']])for(const key of [id,id+'Reset']){const s=reports.contacts.states[key];assert.equal(s.grounded,true,key);assert.ok(s.wheels.every(w=>w.contact&&w.surface==='Asphalt'&&w.roadId===road&&w.layer===layer),key);}
  for(const name of ['inbound','outbound']){const r=reports[name];assert.ok(r.progress>r.length-12,name+' incomplete');assert.ok(r.maxError<2,name+' lane error');assert.ok(r.air<.1,name+' airborne');assert.ok(r.state.damage<.01,name+' damage');assert.deepEqual(r.wrongContacts,[],name+' contact material');}
  assert.ok(reports.inbound.arrival.visits.includes('aster'));assert.equal(reports.inbound.arrival.destination,null);
  assert.ok(reports.outbound.state.wheels.every(w=>w.roadId==='crossway'),'return reaches the public expressway');
  for(const [name,road,x,z] of [['underpass','circuitlink',470,-975],['bridge','circuit',460,-1010],['paddock','circuitlink',494,-1370],['pit-exit','pit',1450,-1400],['garage-bays','pit',780,-1460]]){await page.evaluate(async({road,x,z})=>{const g=window.kairos;await g.startDrive();g.teleport(x,z,road);await g.advanceTime(1500);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);await g.renderer.scene.whenReadyAsync();for(let i=0;i<10;i++)await g.advanceTime(0);},{road,x,z});await page.screenshot({path:`${output}/${name}.png`});}
  assert.deepEqual(errors,[]);
}finally{await fs.writeFile(`${output}/report.json`,JSON.stringify({environment:'Installed Edge / WebGL2, controlled time. Input-only traversal with synchronous collision installation to isolate geometry; not live streaming or performance acceptance.',reports,errors},null,2));await browser.close();}
