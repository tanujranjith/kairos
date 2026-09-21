import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const output=process.argv.find(value=>value.startsWith('--output='))?.slice(9)??'output/gpu-resources';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],failed=[],external=[],scenes=[];
page.setDefaultTimeout(90000);
page.on('pageerror',error=>errors.push(String(error)));
page.on('response',response=>{if(response.status()>=400)failed.push({url:response.url(),status:response.status()});});
await page.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1'){external.push(url);return route.abort();}return route.continue();});

const settle=()=>page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);await g.advanceTime(1500);});
const capture=async name=>{
  await settle();
  const resource=await page.evaluate(async()=>{const {auditGpuResources}=await import('/src/tools/gpu-resource-audit.ts');return auditGpuResources(window.kairos.renderer.scene);});
  const state=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
  assert.equal(state.loading,false,`${name} remained behind a loading gate`);
  assert.ok(resource.estimatedBytes<=resource.budgetBytes,`${name} estimated ${resource.estimatedMiB.toFixed(2)} MiB exceeds 256 MiB`);
  await page.screenshot({path:`${output}/${name}.png`});
  scenes.push({name,resource,state:{screen:state.screen,mode:state.mode,cells:state.cells,traffic:state.traffic.length,weather:state.weather,time:state.time}});
  console.log(`${name}: ${resource.estimatedMiB.toFixed(2)} MiB (${resource.headroomMiB.toFixed(2)} MiB headroom)`);
};
const moveWithTraffic=({x,z,road})=>page.evaluate(async target=>{const g=window.kairos;g.teleport(target.x,target.z,target.road);await g.advanceTime(100);await g.action('setting',JSON.stringify({key:'traffic',value:12}));},{x,z,road});

try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');
  await page.waitForFunction(()=>window.kairos?.ui);
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.automaticQuality=false;g.save.settings.quality='Low';g.save.settings.resolution=1;g.save.settings.timeRate=0;await g.startDrive();});
  await moveWithTraffic({x:-1340,z:-980,road:'city3'});await capture('city-traffic');assert.equal(scenes.at(-1).state.traffic,12,'Low city must contain twelve traffic vehicles');
  await moveWithTraffic({x:1130,z:320,road:'pass'});await capture('mountain-pass');
  await moveWithTraffic({x:340,z:-350,road:'crossway'});await capture('highway');
  await moveWithTraffic({x:-1340,z:-980,road:'city3'});await page.evaluate(()=>{const g=window.kairos;g.save.settings.time=22;g.save.settings.weather='Rain';g.wetness=.85;});await capture('wet-night');
  await page.evaluate(async()=>{const g=window.kairos;await g.action('home');g.save.settings.time=17.4;g.save.settings.weather='Clear';g.wetness=0;g.raceConfig.entrants=8;g.raceConfig.vehicleClass='GT';await g.startRace();});await capture('eight-car-race');
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);
  const report={description:'Conservative Low 1280x720 scene-resident GPU estimate. Counts unique Babylon DataBuffer capacities, all ready internal textures, instance transforms, browser-owned framebuffer allowance and a 25% untracked-resource contingency. This is not driver telemetry or target-laptop certification.',scenes,peakMiB:Math.max(...scenes.map(scene=>scene.resource.estimatedMiB)),errors,failed,external};
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  console.log(`Peak estimate: ${report.peakMiB.toFixed(2)} MiB`);
}finally{await browser.close();}
