import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const output=process.argv.find(value=>value.startsWith('--output='))?.slice(9)??'output/shared-car-model';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),report={runs:[],errors:[],warnings:[],external:[]};
for(const requested of ['webgl','webgpu']){
  const page=await browser.newPage({viewport:{width:1280,height:720}}),modelRequests=[];page.setDefaultTimeout(90000);
  page.on('pageerror',error=>report.errors.push(String(error)));page.on('console',message=>{if(['error','warning'].includes(message.type()))report.warnings.push(message.text());});page.on('request',request=>{const url=request.url();if(url.includes('/models/'))modelRequests.push(new URL(url).pathname);if(!/^(http:\/\/127\.0\.0\.1:5187|data:|blob:)/.test(url))report.external.push(url);});
  try{
    await page.goto(`http://127.0.0.1:5187/${requested==='webgl'?'?renderer=webgl':''}`);await page.waitForSelector('#loading',{state:'detached'});
    const profiles=[];
    for(const [index,id] of ['aeris','velara','crest','nova','gtx','apex'].entries()){
      const row=await page.evaluate(async({id,index})=>{const g=window.kairos;await g.action('select-car',id);await g.action('custom',JSON.stringify({key:'livery',value:index%3}));g.setScreen('garage');await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();for(let frame=0;frame<10;frame++)await g.advanceTime(0);const rigs=[g.visual.root,...g.visual.root.getChildTransformNodes()].filter(node=>node.metadata?.visualModel);return {id,livery:index%3,renderer:g.renderer.rendererName,models:[...new Set(rigs.map(node=>node.metadata.visualModel))],profiles:[...new Set(rigs.map(node=>node.metadata.handlingProfile))],parts:g.visual.parts.length,triangles:g.visual.parts.reduce((sum,mesh)=>sum+mesh.getTotalIndices()/3,0),wheels:g.visual.wheels.length};},{id,index});
      profiles.push(row);if(id==='velara'||id==='apex')await page.screenshot({path:`${output}/${requested}-${id}.png`});
    }
    const live=await page.evaluate(async()=>{const g=window.kairos;g.save.settings.traffic=12;g.save.settings.timeRate=0;const visualModels=visual=>[...new Set([visual.root,...visual.root.getChildTransformNodes()].filter(node=>node.metadata?.visualModel).map(node=>node.metadata.visualModel))];await g.startDrive();g.teleport(-1340,-980,'city3');for(let step=0;step<10;step++)await g.advanceTime(500);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);const exploration={player:visualModels(g.visual),traffic:[...new Set(g.traffic.flatMap(car=>visualModels(car.visual)))],parked:[...new Set(g.renderer.scene.transformNodes.filter(node=>node.metadata?.parkedCar).map(node=>node.metadata.visualModel))],trafficCars:g.traffic.length,parkedCars:g.renderer.scene.transformNodes.filter(node=>node.metadata?.parkedCar).length,playerState:g.snapshot().player};g.raceConfig.vehicleClass='FORMULA';g.raceConfig.entrants=8;await g.startRace();await g.advanceTime(1200);return {...exploration,racePlayer:visualModels(g.visual),raceOpponents:[...new Set(g.opponents.flatMap(car=>visualModels(car.visual)))],raceCars:g.opponents.length};});
    await page.screenshot({path:`${output}/${requested}-formula-grid.png`});assert.equal(profiles[0].renderer,requested==='webgl'?'WebGL2':'WebGPU');assert.ok(profiles.every(row=>row.models.length===1&&row.models[0]==='velara'&&row.profiles.length===1&&row.profiles[0]===row.id&&row.wheels===4),JSON.stringify(profiles));assert.equal(new Set(profiles.map(row=>`${row.parts}:${row.triangles}`)).size,1);assert.deepEqual(live.player,['velara'],`player ${JSON.stringify(live)}`);assert.deepEqual(live.traffic,['velara'],`traffic ${JSON.stringify(live)}`);assert.deepEqual(live.parked,['velara'],`parked ${JSON.stringify(live)}`);assert.deepEqual(live.racePlayer,['velara']);assert.deepEqual(live.raceOpponents,['velara']);assert.equal(live.raceCars,7);assert.ok(live.trafficCars>0);assert.ok(live.parkedCars>0);assert.equal(live.playerState.wheels.filter(wheel=>wheel.contact).length,4);assert.equal(live.playerState.damage,0);
    const uniqueRequests=[...new Set(modelRequests)];assert.deepEqual(uniqueRequests.sort(),['/models/velara-lod0.glb','/models/velara-lod1.glb']);report.runs.push({requested,profiles,live:{...live,playerState:undefined},modelRequests:uniqueRequests});
  }finally{await page.close();}
}
{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.setDefaultTimeout(90000);page.on('pageerror',error=>errors.push(String(error)));await page.route('**/models/*.glb',route=>route.abort());
  try{
    await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForSelector('#loading',{state:'detached'});const profiles=[];
    for(const id of ['aeris','velara','crest','nova','gtx','apex'])profiles.push(await page.evaluate(async id=>{const g=window.kairos;await g.action('select-car',id);g.setScreen('garage');await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();for(let frame=0;frame<8;frame++)await g.advanceTime(0);return {id,asset:g.visual.parts.some(mesh=>mesh.name.includes('instance')),model:g.visual.root.metadata?.visualModel,profile:g.visual.root.metadata?.handlingProfile,fallback:g.visual.root.metadata?.fallback,parts:g.visual.parts.length,triangles:g.visual.parts.reduce((sum,mesh)=>sum+mesh.getTotalIndices()/3,0),wheels:g.visual.wheels.length};},id));
    assert.ok(profiles.every(row=>!row.asset&&row.model==='velara'&&row.profile===row.id&&row.fallback&&row.wheels===4),JSON.stringify(profiles));assert.equal(new Set(profiles.map(row=>`${row.parts}:${row.triangles}`)).size,1);assert.deepEqual(errors,[]);await page.screenshot({path:`${output}/fallback-apex.png`});report.fallback=profiles;
  }finally{await page.close();}
}
await browser.close();
const ignored='The powerPreference option is currently ignored when calling requestAdapter() on Windows';
assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);assert.deepEqual(report.warnings.filter(value=>!value.includes(ignored)),[]);
await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report.runs,null,2));
