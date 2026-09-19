import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await fs.mkdir('output/visuals',{recursive:true});
await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui,null,{timeout:60000});await page.evaluate(()=>window.advanceTime(0));
const capture=async name=>{await page.evaluate(async()=>{const g=window.kairos;g.advanceTime(0);await Promise.race([g.renderer.scene.whenReadyAsync(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Scene readiness timed out')),20000))]);g.advanceTime(0);});await page.screenshot({path:`output/visuals/${name}.png`});};
for(const id of ['velara','gtx','apex'])for(const livery of [0,1,2]){
  await page.evaluate(async({id,livery})=>{const g=window.kairos;await g.action('select-car',id);await g.action('custom',JSON.stringify({key:'livery',value:livery}));g.setScreen('customize');},{id,livery});
  assert.equal(await page.evaluate(id=>window.kairos.save.customization[id].livery,id),livery);await capture(`${id}-livery-${livery}`);
}
await page.evaluate(async()=>{const g=window.kairos;g.save.selected='velara';g.save.settings.time=17.4;await g.startDrive();await g.advanceTime(1000);});await capture('day');
await page.evaluate(()=>{window.kairos.renderer.scene.shadowsEnabled=false;});await capture('day-no-shadows');
await page.evaluate(()=>{window.kairos.renderer.scene.shadowsEnabled=true;});
await page.evaluate(()=>{const s=window.kairos.renderer.scene;s.getMaterialByName('meadow').albedoTexture=null;s.getMaterialByName('asphalt').albedoTexture=null;});await capture('day-no-ground-textures');
assert.deepEqual(errors,[]);await browser.close();console.log('Visual variants captured without page errors.');
