import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log(m.type(),m.text());});
page.on('pageerror',e=>console.log('PAGEERROR',String(e)));
page.on('requestfailed',r=>console.log('REQUESTFAILED',r.url(),r.failure()));
await page.goto(process.argv[2]??'http://127.0.0.1:5187/?renderer=webgl',{waitUntil:'networkidle'});
await page.waitForFunction(()=>!document.querySelector('#loading'),{timeout:45000}).catch(()=>{});
const mode=process.argv[3];
if(mode==='drive'){
  await page.click('#start-drive');await page.waitForFunction(()=>window.kairos?.screen==='drive');
  await page.evaluate(()=>window.advanceTime(1000));await page.keyboard.down('ArrowUp');
  for(let i=0;i<4;i++)await page.evaluate(()=>window.advanceTime(1000));
  await page.keyboard.up('ArrowUp');
}
if(mode==='garage')await page.click('[data-action="screen"][data-value="garage"]');
if(mode==='race'){
  await page.click('[data-action="screen"][data-value="motorsport"]');await page.click('#start-race');
  await page.waitForFunction(()=>window.kairos?.screen==='drive');
  await page.evaluate(()=>{window.kairos.setAutopilot(true);window.advanceTime(5000);});
  for(let i=0;i<6;i++)await page.evaluate(()=>window.advanceTime(10000));
}
if(mode==='map')await page.click('[data-action="screen"][data-value="map"]');
await page.evaluate(async()=>{const game=window.kairos;if(game){await game.renderer.scene.whenReadyAsync();game.advanceTime(0);}});
console.log('RENDER',await page.evaluate(()=>{const g=window.kairos;if(!g)return null;const s=g.renderer.scene,c=g.renderer.camera;return {camera:c.position.asArray(),target:c.getTarget().asArray(),playerVisual:g.visual.root.position.asArray(),active:s.getActiveMeshes().data.slice(0,s.getActiveMeshes().length).map(m=>m.name),terrain:s.getMeshByName('terrain--2,0')?.getBoundingInfo().boundingBox.minimumWorld.asArray()};}));
console.log('BODY',await page.locator('body').innerText());
console.log('STATE',await page.evaluate(()=>window.render_game_to_text?.()));
await fs.mkdir('output/inspect',{recursive:true});await page.screenshot({path:`output/inspect/${mode??'screen'}.png`});
await fs.writeFile(`output/inspect/${mode??'screen'}.json`,await page.evaluate(()=>window.render_game_to_text?.()??'{}'));
await browser.close();
