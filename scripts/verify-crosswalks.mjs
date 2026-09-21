import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const output=process.argv.find(value=>value.startsWith('--output='))?.slice(9)??'output/crosswalks';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),report={runs:[],errors:[],warnings:[],external:[]};
for(const requested of ['webgl','webgpu']){
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(90000);
  page.on('pageerror',error=>report.errors.push(String(error)));page.on('console',message=>{if(['error','warning'].includes(message.type()))report.warnings.push(message.text());});page.on('request',request=>{if(!/^(http:\/\/127\.0\.0\.1:5187|data:|blob:)/.test(request.url()))report.external.push(request.url());});
  try{
    await page.goto(`http://127.0.0.1:5187/${requested==='webgl'?'?renderer=webgl':''}`);await page.waitForSelector('#loading',{state:'detached'});
    const result=await page.evaluate(async()=>{
      const g=window.kairos,{TRAFFIC_GRAPH}=await import('/src/content/traffic-network.ts'),{samplePath}=await import('/src/sim/lane-graph.ts'),{signalCrosswalk}=await import('/src/render/traffic.ts');
      g.save.settings.timeRate=0;g.save.settings.time=16;g.save.settings.weather='Clear';g.save.settings.traffic=0;g.save.settings.camera=0;await g.startDrive();g.trafficSystem.clear();
      const junction=TRAFFIC_GRAPH.junctions.get('westbrook-cedar'),lane=[...TRAFFIC_GRAPH.paths.values()].find(path=>path.kind==='lane'&&path.roadId==='city3'&&path.to===junction.id&&path.direction===1),position=samplePath(lane,lane.length-7);
      g.world.ensure(position);g.player.reset(position,position.yaw);await g.advanceTime(800);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);await g.renderer.scene.whenReadyAsync();for(let frame=0;frame<12;frame++)await g.advanceTime(0);
      const approaches=junction.incoming.map(id=>signalCrosswalk(id)).filter(bands=>bands.length),paint=g.renderer.scene.meshes.filter(mesh=>mesh.name.startsWith('stop-bars-')&&mesh.getBoundingInfo().boundingBox.minimumWorld.x<junction.x&&mesh.getBoundingInfo().boundingBox.maximumWorld.x>junction.x);
      return {renderer:g.renderer.rendererName,approaches:approaches.length,bands:approaches.reduce((sum,value)=>sum+value.length,0),paintMeshes:paint.length,paintTriangles:paint.reduce((sum,mesh)=>sum+mesh.getTotalIndices()/3,0),player:g.snapshot().player,streaming:g.world.snapshot()};
    });
    assert.equal(result.renderer,requested==='webgl'?'WebGL2':'WebGPU');assert.equal(result.approaches,4);assert.equal(result.bands,24);assert.ok(result.paintMeshes>=1);assert.ok(result.paintTriangles>=300);assert.equal(result.player.wheels.filter(wheel=>wheel.contact).length,4);assert.equal(result.player.damage,0);
    await page.screenshot({path:`${output}/${requested}-driver.png`});
    await page.evaluate(async()=>{const g=window.kairos,{Vector3}=await import('/node_modules/@babylonjs/core/Maths/math.vector.js');document.querySelector('#ui').style.visibility='hidden';g.renderer.camera.position.set(-1390,58,-995);g.renderer.camera.setTarget(new Vector3(-1340,3,-940));g.renderer.camera.fov=.67;for(let frame=0;frame<12;frame++){g.renderer.engine.beginFrame();try{g.renderer.scene.render();}finally{g.renderer.engine.endFrame();}}});
    await page.screenshot({path:`${output}/${requested}-overview.png`});report.runs.push(result);
  }finally{await page.close();}
}
await browser.close();
const ignored='The powerPreference option is currently ignored when calling requestAdapter() on Windows';
assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);assert.deepEqual(report.warnings.filter(value=>!value.includes(ignored)),[]);
await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report.runs,null,2));
