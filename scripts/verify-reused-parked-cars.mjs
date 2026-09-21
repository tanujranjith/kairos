import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const output=process.argv.find(value=>value.startsWith('--output='))?.slice(9)??'output/reused-parked-cars';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),report={runs:[],errors:[],warnings:[],external:[]};
for(const renderer of ['webgl','webgpu']){
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(90000);
  page.on('pageerror',error=>report.errors.push(String(error)));page.on('console',message=>{if(['error','warning'].includes(message.type()))report.warnings.push(message.text());});page.on('request',request=>{if(!/^(http:\/\/127\.0\.0\.1:5187|data:|blob:)/.test(request.url()))report.external.push(request.url());});
  try{
    await page.goto(`http://127.0.0.1:5187/${renderer==='webgl'?'?renderer=webgl':''}`);await page.waitForSelector('#loading',{state:'detached'});
    const result=await page.evaluate(async()=>{
      const g=window.kairos;g.save.settings.timeRate=0;g.save.settings.time=16;g.save.settings.weather='Clear';g.save.settings.traffic=0;await g.startDrive();g.teleport(-1340,-980,'city3');await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);await g.renderer.scene.whenReadyAsync();
      const roots=g.renderer.scene.transformNodes.filter(node=>node.name.startsWith('parked-velara-')),parts=roots.flatMap(root=>root.getChildMeshes()),geometries=new Set(parts.map(part=>part.geometry?.uniqueId).filter(Boolean)),materials=new Set(parts.map(part=>part.material?.uniqueId).filter(Boolean)),classes=[...new Set(parts.map(part=>part.getClassName()))];
      const target=roots.sort((a,b)=>Math.hypot(a.position.x+1340,a.position.z+980)-Math.hypot(b.position.x+1340,b.position.z+980))[0],{Vector3}=await import('/node_modules/@babylonjs/core/Maths/math.vector.js'),{terrainHeight}=await import('/src/content/world.ts'),ground=terrainHeight(target.position.x,target.position.z),ray=g.physics.engine.raycast(new Vector3(target.position.x,ground+5,target.position.z),new Vector3(target.position.x,ground-.2,target.position.z),{collideWith:1});
      const camera=g.renderer.camera,yaw=target.rotationQuaternion.toEulerAngles().y,forward=new Vector3(Math.sin(yaw),0,Math.cos(yaw)),right=new Vector3(Math.cos(yaw),0,-Math.sin(yaw));camera.position.copyFrom(target.position.subtract(forward.scale(8)).add(right.scale(5)).add(new Vector3(0,3.2,0)));camera.setTarget(target.position.add(new Vector3(0,.15,0)));camera.fov=.62;document.querySelector('#ui').style.visibility='hidden';for(let frame=0;frame<12;frame++){g.renderer.engine.beginFrame();try{g.renderer.scene.render();}finally{g.renderer.engine.endFrame();}}
      return {renderer:g.renderer.rendererName,cars:roots.length,parts:parts.length,geometries:geometries.size,materials:materials.size,classes,position:{x:target.position.x,y:target.position.y,z:target.position.z},ground,ray:{hasHit:ray.hasHit,y:ray.hitPointWorld.y,distance:ray.hitDistance},stream:g.world.snapshot()};
    });
    assert.equal(result.renderer,renderer==='webgl'?'WebGL2':'WebGPU');assert.ok(result.cars>=4,`expected reused parked models, saw ${result.cars}`);assert.ok(result.geometries<result.parts/2,`expected shared source geometry: ${JSON.stringify(result)}`);assert.ok(result.materials<result.parts/2,`expected shared source materials: ${JSON.stringify(result)}`);assert.equal(result.ray.hasHit,true);assert.ok(result.ray.y>result.ground+.45,`parked collider ray ${JSON.stringify(result.ray)}`);await page.screenshot({path:`${output}/${renderer}-close.png`});
    await page.evaluate(async()=>{const g=window.kairos,{Vector3}=await import('/node_modules/@babylonjs/core/Maths/math.vector.js');g.renderer.camera.position.set(-1285,52,-900);g.renderer.camera.setTarget(new Vector3(-1340,10,-980));g.renderer.camera.fov=.72;for(let frame=0;frame<12;frame++){g.renderer.engine.beginFrame();try{g.renderer.scene.render();}finally{g.renderer.engine.endFrame();}}});await page.screenshot({path:`${output}/${renderer}-overview.png`});report.runs.push(result);
  }finally{await page.close();}
}
await browser.close();
const ignored='The powerPreference option is currently ignored when calling requestAdapter() on Windows';
assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);assert.deepEqual(report.warnings.filter(value=>!value.includes(ignored)),[]);
await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report.runs.map(({renderer,cars,parts,geometries,materials,classes,ray})=>({renderer,cars,parts,geometries,materials,classes,ray})),null,2));
