import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const output='output/player-service';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[],external=[],failed=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('response',response=>{if(response.status()>=400)failed.push({url:response.url(),status:response.status()});});
await context.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1'){external.push(url);return route.abort();}return route.continue();});
await page.goto('http://127.0.0.1:5187/?renderer=webgl');
await page.waitForFunction(()=>window.kairos?.ui,{timeout:60000});
await page.evaluate(()=>{const g=window.kairos;g.save.settings.traffic=0;g.save.settings.timeRate=0;g.save.settings.volume=0;});
await page.click('#start-drive');
await page.waitForSelector('#service-control');

const placeAtLandmark=async id=>page.evaluate(async id=>{
  const g=window.kairos,{LANDMARKS}=await import('/src/content/world.ts'),landmark=LANDMARKS.find(entry=>entry.id===id);
  if(!landmark)throw new Error(`Unknown service landmark ${id}`);
  g.teleport(landmark.x,landmark.z,landmark.roadId);await g.world.loadAround(g.player.node.position,true);await g.advanceTime(750);
  g.player.state.fuel=7;g.player.state.damage=.35;g.player.state.wheels.forEach((wheel,index)=>{wheel.wear=.42+index*.03;wheel.temperature=112;});g.ui.update();
  return {id,name:landmark.name,position:{...g.player.state.position},grounded:g.player.state.grounded,speed:g.player.state.speed};
},id);

const verifyService=async(id,label)=>{
  const placed=await placeAtLandmark(id);assert.equal(placed.grounded,true);assert.ok(Math.abs(placed.speed)<1);
  await page.click('#service-control');
  await page.evaluate(()=>window.advanceTime(2800));
  const active=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
  const button={text:await page.locator('#service-control').textContent(),disabled:await page.locator('#service-control').isDisabled(),active:await page.locator('#service-control').evaluate(node=>node.classList.contains('active'))};
  assert.ok(active.serviceRemaining>3&&active.serviceRemaining<3.3,`${id} service countdown ${active.serviceRemaining}`);
  assert.equal(button.disabled,true);assert.equal(button.active,true);assert.match(button.text,/SERVICING/);
  await page.screenshot({path:`${output}/${label}-active.png`});
  await page.evaluate(()=>window.advanceTime(3400));
  const complete=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
  const definition=await page.evaluate(()=>window.kairos.player.definition);
  assert.equal(complete.serviceRemaining,0);assert.ok(complete.player.fuel>definition.tank-.01&&complete.player.fuel<=definition.tank);assert.equal(complete.player.damage,0);
  assert.ok(complete.player.wheels.every(wheel=>wheel.wear>.999&&wheel.temperature>64&&wheel.temperature<66));
  assert.equal(await page.locator('#service-control').isDisabled(),false);assert.equal(await page.locator('#service-control').textContent(),'SERVICE / PIT');assert.match(complete.message,/Service complete/);
  return {placed,active:{remaining:active.serviceRemaining,button},complete:{fuel:complete.player.fuel,damage:complete.player.damage,wear:complete.player.wheels.map(wheel=>wheel.wear),message:complete.message}};
};

const services=[];
services.push(await verifyService('westbrook','westbrook'));
services.push(await verifyService('summitservice','summit'));

await placeAtLandmark('westbrook');
await page.evaluate(async()=>{const g=window.kairos,velocity=g.player.node.forward.scale(4);g.player.body.setLinearVelocity(velocity);g.player.state.speed=4;g.player.state.velocity={x:velocity.x,y:velocity.y,z:velocity.z};g.ui.update();});
await page.click('#service-control');
const moving=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
assert.equal(moving.serviceRemaining,0);assert.match(moving.message,/Come to a stop/);

await page.evaluate(async()=>{const g=window.kairos;await g.startRace({config:{kind:'Quick Race',laps:3,entrants:4,difficulty:.35,position:1,vehicleClass:'GT'},stage:0});const box=g.snapshot().playerPitBox.position;g.player.reset(box,box.yaw);await g.world.loadAround(g.player.node.position,true);await g.advanceTime(750);g.player.state.fuel=5;g.player.state.damage=.2;g.player.state.wheels.forEach(wheel=>{wheel.wear=.3;wheel.temperature=120;});g.ui.update();});
const pit=await verifyServiceBox();

async function verifyServiceBox(){
  await page.click('#service-control');await page.evaluate(()=>window.advanceTime(3000));
  const active=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
  assert.ok(active.serviceRemaining>2.8&&active.serviceRemaining<3.2);assert.equal(active.mode,'Quick Race');assert.equal(await page.locator('#service-control').isDisabled(),true);
  await page.screenshot({path:`${output}/aster-pit-active.png`});
  await page.evaluate(()=>window.advanceTime(3200));const complete=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
  const tank=await page.evaluate(()=>window.kairos.player.definition.tank);assert.equal(complete.serviceRemaining,0);assert.ok(complete.player.fuel>tank-.01&&complete.player.fuel<=tank);assert.equal(complete.player.damage,0);assert.ok(complete.player.wheels.every(wheel=>wheel.wear>.999));
  return {active:{remaining:active.serviceRemaining,mode:active.mode},complete:{fuel:complete.player.fuel,damage:complete.player.damage,wear:complete.player.wheels.map(wheel=>wheel.wear),message:complete.message}};
}

assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);
const report={services,moving:{remaining:moving.serviceRemaining,message:moving.message},pit,errors,failed,external,scope:'Installed Edge-compatible Chromium/WebGL2 development build. Controlled placement at both authored world stations and the assigned player pit box; service is initiated through the rendered HUD button and advances through the normal 120 Hz simulation.'};
await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
await browser.close();
console.log('Player service checks passed',JSON.stringify({world:services.map(row=>row.placed.name),moving:moving.message,pit:pit.complete}));
