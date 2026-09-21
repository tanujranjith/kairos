import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const output='output/visibility-pause';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[],external=[],failed=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('response',response=>{if(response.status()>=400)failed.push({url:response.url(),status:response.status()});});
await context.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1'){external.push(url);return route.abort();}return route.continue();});
await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui,{timeout:60000});
await page.evaluate(()=>{const g=window.kairos;g.save.settings.traffic=0;g.save.settings.timeRate=0;g.save.settings.volume=0;});await page.click('#start-drive');await page.waitForSelector('#speed');
await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>Math.abs(window.kairos.player.state.speed)>3,null,{timeout:10000});
const before=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;delete document.visibilityState;});
await page.waitForFunction(()=>window.kairos.screen==='pause',null,{timeout:5000});
const hidden=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));assert.equal(hidden.screen,'pause');assert.equal(hidden.pausedFromDrive,true);assert.match(hidden.pauseReason,/background/);assert.match(hidden.pauseReason,/controls were released/);assert.equal(await page.evaluate(()=>window.kairos.input.keys.size),0);
const backgroundAdvance=hidden.clock-before.clock;assert.ok(backgroundAdvance>=0&&backgroundAdvance<.2,`background interval advanced ${backgroundAdvance}s`);await page.waitForTimeout(600);const frozen=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));assert.equal(frozen.clock,hidden.clock);assert.deepEqual(frozen.player.position,hidden.player.position);

await page.screenshot({path:`${output}/background-pause.png`});assert.match(await page.locator('.pause-panel p').textContent(),/background/);assert.match(await page.locator('.pause-panel p').textContent(),/controls were released/);
await page.click('[data-action="resume"]');await page.waitForSelector('#speed');const resumed=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));assert.equal(resumed.screen,'drive');assert.equal(resumed.pausedFromDrive,false);assert.equal(resumed.pauseReason,'');
await page.waitForTimeout(500);const after=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));assert.ok(after.clock>resumed.clock);assert.ok(Math.abs(after.player.speed)<Math.abs(before.player.speed)+.5,'released throttle must not continue accelerating');await page.screenshot({path:`${output}/resumed.png`});

await page.keyboard.press('Escape');await page.waitForSelector('.pause-panel');const manual=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));assert.equal(manual.pauseReason,'Drive paused.');assert.equal(await page.locator('.pause-panel p').textContent(),'Drive paused.');
assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);
const report={before:{clock:before.clock,speed:before.player.speed},hidden:{clock:hidden.clock,position:hidden.player.position,reason:hidden.pauseReason},frozen:{clock:frozen.clock,position:frozen.player.position},resumed:{clock:resumed.clock,afterClock:after.clock,speed:after.player.speed,reason:resumed.pauseReason},manual:{reason:manual.pauseReason},errors,failed,external,scope:'Installed Edge/WebGL2 development build with a controlled hidden document state and a real visibilitychange event. Real-time clock/pose freeze, held-key clearing, explanatory pause UI, explicit resume and manual pause reason are verified.'};
await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();console.log('Visibility pause checks passed',JSON.stringify(report));
