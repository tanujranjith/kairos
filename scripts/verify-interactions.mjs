import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[],external=[];
page.on('pageerror',e=>errors.push(String(e)));
await context.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1'){external.push(url);return route.abort();}return route.continue();});
await fs.mkdir('output/interaction',{recursive:true});
const capture=async name=>{await page.evaluate(async()=>{const g=window.kairos;await g.renderer.scene.whenReadyAsync();g.advanceTime(0);});await page.screenshot({path:`output/interaction/${name}.png`});};
await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui,null,{timeout:60000});await page.evaluate(()=>window.advanceTime(0));await capture('home');
await page.click('[data-action="screen"][data-value="garage"]');
for(const id of ['aeris','velara','crest','nova','gtx','apex']){await page.click(`[data-action="select-car"][data-value="${id}"]`);assert.equal(await page.evaluate(()=>window.kairos.save.selected),id);}
await capture('formula-garage');await page.click('[data-action="select-car"][data-value="velara"]');await capture('garage');
await page.click('[data-action="screen"][data-value="customize"]');await page.locator('[data-custom="paint"]').fill('#215e89');await page.locator('[data-custom="paint"]').dispatchEvent('change');await capture('customize');
await page.click('[data-action="screen"][data-value="settings"]');await page.selectOption('[data-setting="units"]','km/h');await page.selectOption('[data-setting="weather"]','Rain');await page.locator('[data-setting="traffic"]').fill('4');await page.locator('[data-setting="traffic"]').dispatchEvent('change');await capture('settings');
await page.click('[data-action="screen"][data-value="map"]');await page.locator('[data-action="map-select"][data-value="vista"]').click();await page.click('[data-action="navigate"]');assert.ok(await page.evaluate(()=>window.kairos.route.length)>0);await capture('map');
await page.click('[data-action="screen"][data-value="home"]');await page.click('#start-drive');await page.evaluate(()=>window.advanceTime(1000));
await page.keyboard.down('ArrowUp');await page.evaluate(()=>window.advanceTime(3000));await page.keyboard.up('ArrowUp');assert.ok(await page.evaluate(()=>window.kairos.player.state.speed)>5);await capture('wet-drive');
await page.keyboard.press('Escape');const before=await page.evaluate(()=>window.kairos.clock);await page.evaluate(()=>window.advanceTime(3000));assert.equal(await page.evaluate(()=>window.kairos.clock),before);await capture('pause');await page.click('[data-action="resume"]');
for(let i=0;i<5;i++){await page.keyboard.press('KeyC');await capture(`camera-${i}`);}
await page.keyboard.press('KeyR');await page.evaluate(()=>window.advanceTime(1000));assert.ok(Math.abs(await page.evaluate(()=>window.kairos.player.state.speed))<1);
await page.keyboard.down('ArrowDown');await page.evaluate(()=>window.advanceTime(3000));await page.keyboard.up('ArrowDown');assert.ok(await page.evaluate(()=>window.kairos.player.state.speed)<-1);
await page.keyboard.press('Escape');await page.click('[data-action="screen"][data-value="settings"]');
await page.selectOption('[data-setting="weather"]','Clear');await page.locator('[data-setting="time"]').fill('22');await page.locator('[data-setting="time"]').dispatchEvent('change');await page.click('[data-action="resume"]');await capture('night');
await page.evaluate(async()=>{const g=window.kairos;await g.store.write(g.save);});await page.reload();await page.waitForFunction(()=>window.kairos?.ui,null,{timeout:60000});
const saved=await page.evaluate(()=>({car:window.kairos.save.selected,paint:window.kairos.save.customization.velara.paint,units:window.kairos.save.settings.units}));assert.deepEqual(saved,{car:'velara',paint:'#215e89',units:'km/h'});
assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await fs.writeFile('output/interaction/report.json',JSON.stringify({checks:['six cars','customization','settings','map routing','acceleration','pause clock','five cameras','reset','reverse','night','save reload','external hosts blocked'],saved,errors,external},null,2));await browser.close();console.log('Interaction checks passed');
