import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const output='output/art-pass';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch(process.env.KAIROS_BROWSER==='msedge'?{channel:'msedge',headless:true}:{headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],failed=[],checks=[],cars=[];
page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>failed.push(r.url()));
const capture=async name=>{await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();for(let i=0;i<12;i++)await g.advanceTime(0);});await page.screenshot({path:`${output}/${name}.png`});};
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  for(const id of ['velara','aeris','crest','nova','gtx','apex']){
    await page.evaluate(async id=>{const g=window.kairos;await g.action('select-car',id);g.setScreen('garage');},id);await capture(id);
    cars.push(await page.evaluate(()=>{const g=window.kairos,car=g.visual,mirror=g.renderer.scene.getTextureByName('gallery-floor-reflection');return {id:g.save.selected,triangles:car.parts.reduce((s,m)=>s+m.getTotalIndices()/3,0),glass:car.glass.alpha,pivots:car.wheels.length,mirrorCars:car.parts.some(m=>mirror.renderList.includes(m)),mirrorFeedback:mirror.renderList.some(m=>m.name==='showroom-floor'||m.name==='turntable')};}));
  }
  assert.ok(cars.every(c=>c.pivots===4&&c.mirrorCars&&!c.mirrorFeedback));checks.push('six car selections retain wheel pivots and appear in the bounded nonrecursive gallery reflection');
  for(const id of ['velara','gtx'])for(const livery of [1,2]){await page.evaluate(async({id,livery})=>{const g=window.kairos;await g.action('select-car',id);await g.action('custom',JSON.stringify({key:'livery',value:livery}));g.setScreen('customize');},{id,livery});await capture(`${id}-livery-${livery}`);}
  await page.evaluate(async()=>{const g=window.kairos;await g.action('select-car','velara');await g.action('custom',JSON.stringify({key:'livery',value:0}));g.setScreen('home');});await capture('home');
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.timeRate=0;g.save.settings.traffic=0;await g.startDrive();await g.advanceTime(1000);});
  for(let camera=0;camera<5;camera++){await page.evaluate(camera=>window.kairos.save.settings.camera=camera,camera);await capture('camera-'+camera);}
  assert.equal(await page.evaluate(()=>window.kairos.renderer.scene.getTextureByName('gallery-floor-reflection').renderList.length),0);checks.push('all five driving cameras render; gallery reflection excludes all cars outside the showroom');
  const environment=await page.evaluate(async()=>{const g=window.kairos;g.save.settings.camera=0;const texture=g.world.water.material.bumpTexture,before=[texture.uOffset,texture.vOffset];await g.advanceTime(1000);return {before,after:[texture.uOffset,texture.vOffset],grass:g.renderer.scene.meshes.filter(m=>m.name.startsWith('grass-')&&m.isVisible&&m.isEnabled()).length,grounded:g.player.state.grounded};});
  assert.notDeepEqual(environment.before,environment.after);assert.ok(environment.grass>0);assert.equal(environment.grounded,true);checks.push('lake ripples advance with simulation time and streamed roadside grass is visible');await capture('roadside');
  await page.evaluate(async()=>{const g=window.kairos;g.teleport(-1070,530,'northbridge');await g.advanceTime(1000);});await capture('bridge-water');
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.time=22;g.save.settings.weather='Rain';g.wetness=.8;await g.advanceTime(0);});await capture('wet-night');
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  const fallbackPage=await browser.newPage({viewport:{width:1280,height:720}}),fallbackErrors=[];fallbackPage.on('pageerror',e=>fallbackErrors.push(String(e)));await fallbackPage.route('**/fish-eagle-hill.env*',route=>route.abort());await fallbackPage.goto('http://127.0.0.1:5187/?renderer=webgl');await fallbackPage.waitForFunction(()=>window.kairos?.ui,null,{timeout:90000});
  assert.equal(await fallbackPage.evaluate(async()=>{const g=window.kairos;await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();for(let i=0;i<12;i++)await g.advanceTime(0);const active=g.renderer.scene.getActiveMeshes();return g.renderer.scene.getTransformNodeByName('gallery-vista-fallback').isEnabled()&&active.data.slice(0,active.length).some(m=>g.visual.parts.includes(m));}),true);await fallbackPage.screenshot({path:`output/art-pass/environment-fallback.png`});await fallbackPage.evaluate(async()=>{const g=window.kairos;g.save.settings.traffic=0;await g.startDrive();await g.advanceTime(1000);});assert.equal(await fallbackPage.evaluate(()=>window.kairos.player.state.grounded),true);assert.deepEqual(fallbackErrors,[]);await fallbackPage.close();checks.push('blocked optional HDR visibly renders the generated gallery/car after shader readiness and still enters grounded Free Drive');
  await fs.writeFile(`${output}/report.json`,JSON.stringify({checks,cars,environment,errors,failed,fallbackErrors},null,2));console.log(JSON.stringify({checks,cars,environment,errors,failed,fallbackErrors},null,2));
}finally{await browser.close();}
