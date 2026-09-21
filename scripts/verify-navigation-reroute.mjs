import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const output='output/navigation-reroute';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[],external=[],failed=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('response',response=>{if(response.status()>=400)failed.push({url:response.url(),status:response.status()});});
await context.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1'){external.push(url);return route.abort();}return route.continue();});
await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui,{timeout:60000});
await page.evaluate(()=>{const g=window.kairos;g.save.settings.traffic=0;g.save.settings.timeRate=0;g.save.settings.volume=0;g.save.discovered=[];g.save.visits=[];});
await page.click('#start-drive');await page.waitForSelector('#speed');
await page.keyboard.press('KeyM');await page.waitForSelector('.map-container');
await page.locator('[data-action="map-select"][data-value="vista"]').click();await page.locator('[data-action="navigate"][data-value="vista"]').click();
await page.keyboard.press('KeyM');await page.waitForSelector('#nav-distance');

const readRoute=()=>page.evaluate(()=>{const g=window.kairos,state=JSON.parse(window.render_game_to_text()),first=g.route[0],last=g.route.at(-1),p=state.player.position;return {state,first,last,startGap:first?Math.hypot(first.x-p.x,first.z-p.z):Infinity,label:document.querySelector('#nav-distance')?.textContent,discovered:[...g.save.discovered]};});
const initial=await readRoute();assert.equal(initial.state.destination,'vista');assert.ok(initial.state.routePoints>0);assert.ok(initial.state.routeDistance>0);assert.equal(initial.label,`${(initial.state.routeDistance/1000).toFixed(1)} km by road`);

await page.evaluate(async()=>{const g=window.kairos;g.teleport(-1280,-630,'industrial');await g.world.loadAround(g.player.node.position,true);await g.advanceTime(3400);});
const rerouted=await readRoute(),direct=Math.hypot(650-rerouted.state.player.position.x,1480-rerouted.state.player.position.z);
assert.equal(rerouted.state.destination,'vista');assert.ok(rerouted.state.routePoints>0);assert.ok(rerouted.startGap<60);assert.ok(rerouted.state.routeDistance>=direct);assert.equal(rerouted.label,`${(rerouted.state.routeDistance/1000).toFixed(1)} km by road`);assert.ok(rerouted.discovered.includes('industrial'));assert.notDeepEqual(rerouted.first,initial.first);
assert.equal(await page.locator('#minimap polyline[stroke="#79c8ed"]').count(),1);
await page.screenshot({path:`${output}/rerouted-hud.png`});

await page.keyboard.press('KeyM');await page.waitForSelector('.map-container');await page.screenshot({path:`${output}/rerouted-map.png`});await page.keyboard.press('KeyM');
await page.evaluate(async()=>{const g=window.kairos,{LANDMARKS}=await import('/src/content/world.ts'),target=LANDMARKS.find(landmark=>landmark.id==='vista');g.teleport(target.x,target.z,target.roadId);await g.world.loadAround(g.player.node.position,true);await g.advanceTime(3400);await g.store.write(g.save);});
const arrived=await readRoute();assert.equal(arrived.state.destination,null);assert.equal(arrived.state.routePoints,0);assert.equal(arrived.state.routeDistance,0);assert.equal(arrived.label,'Explore. Drive. Discover.');assert.ok(arrived.state.message.includes('Arrived'));assert.ok(await page.evaluate(()=>window.kairos.save.visits.includes('vista')));
assert.equal(await page.locator('#minimap polyline[stroke="#79c8ed"]').count(),0);
await page.screenshot({path:`${output}/arrival.png`});

await page.reload();await page.waitForFunction(()=>window.kairos?.ui,{timeout:60000});const persisted=await page.evaluate(()=>({discovered:window.kairos.save.discovered,visits:window.kairos.save.visits}));assert.ok(persisted.discovered.includes('industrial'));assert.ok(persisted.visits.includes('vista'));
assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);
const report={initial,rerouted,direct,arrived:{state:arrived.state,label:arrived.label},persisted,errors,failed,external,scope:'Installed Edge-compatible Chromium/WebGL2 development build. Destination selection uses rendered map controls; the off-route move uses the development teleport hook, then ordinary three-second navigation/discovery updates, route graph, HUD, arrival and IndexedDB persistence.'};
await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();
console.log('Navigation reroute checks passed',JSON.stringify({initialKm:initial.state.routeDistance/1000,reroutedKm:rerouted.state.routeDistance/1000,directKm:direct/1000,discovered:rerouted.discovered,visits:persisted.visits}));
