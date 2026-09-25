import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'output/render-visibility';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),report={runs:[],errors:[]};
try{
  for(const renderer of ['webgl','auto']){
    const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(90000);
    page.on('pageerror',e=>report.errors.push(String(e)));
    await page.goto(`http://127.0.0.1:5187/?renderer=${renderer}`);await page.waitForSelector('#loading',{state:'detached'});
    await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(0);g.save.settings.timeRate=0;g.save.settings.automaticQuality=false;g.raceConfig.entrants=8;g.raceConfig.position=4;await g.startRace();await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);await g.renderer.scene.whenReadyAsync();for(let i=0;i<10;i++)await g.advanceTime(0);});
    const samples=[];
    for(const direction of [0,Math.PI,Math.PI/2,0]){
      const sample=await page.evaluate(async({direction,refresh})=>{
        const g=window.kairos,r=g.renderer,s=r.scene,{renderPreparationFrame}=await import('/src/core/presentation-ready.ts');
        // Move only the camera. No mesh-count, streaming or LOD changes may
        // accidentally repair a stale active list during this regression.
        const p=g.visual.root.position,target=p.clone();target.y+=.3;r.camera.position.set(p.x+Math.sin(direction)*7,p.y+2,p.z+Math.cos(direction)*7);r.camera.setTarget(target);s.updateTransformMatrix();
        if(!Array.from(r.camera.getViewMatrix().asArray()).every(Number.isFinite))throw new Error('Non-finite test camera');
        if(refresh)r.invalidateActiveMeshes();
        const drawn=new Set(),watched=g.opponents.flatMap(o=>o.visual.parts).map(mesh=>({mesh,observer:mesh.onBeforeRenderObservable.add(()=>{if(!s._isInIntermediateRendering()&&s.activeCamera===r.camera)drawn.add(mesh);})}));
        try{for(let i=0;i<4;i++){await new Promise(resolve=>requestAnimationFrame(resolve));drawn.clear();renderPreparationFrame(r.engine,()=>r.render());}}
        finally{for(const {mesh,observer}of watched)mesh.onBeforeRenderObservable.remove(observer);}
        const active=new Set(s.getActiveMeshes().data.slice(0,s.getActiveMeshes().length));
        const expected=s.meshes.filter(m=>m.isEnabled()&&m.isVisible&&m.visibility>0&&!m.isBlocked&&m.subMeshes?.length&&m.isReady()&&(m.layerMask&r.camera.layerMask)&&m.isInFrustum(s.frustumPlanes));
        const missing=expected.filter(m=>!active.has(m));
        return {direction,renderer:r.rendererName,position:p.asArray(),camera:r.camera.position.asArray(),cache:r.activeMeshState(),expected:expected.length,active:active.size,missing:missing.map(m=>m.name),cars:g.opponents.map(o=>({id:o.vehicle.id,expected:o.visual.parts.filter(m=>expected.includes(m)).length,active:o.visual.parts.filter(m=>active.has(m)).length,drawn:o.visual.parts.filter(m=>drawn.has(m)).length,missingDraws:o.visual.parts.filter(m=>expected.includes(m)&&!drawn.has(m)).map(m=>m.name)}))};
      },{direction,refresh:samples.length===0});
      samples.push(sample);await page.screenshot({path:`${output}/${renderer}-${samples.length}.png`});
    }
    report.runs.push({renderer,samples});await page.close();
  }
}finally{await browser.close();await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));}
assert.deepEqual(report.errors,[]);
for(const run of report.runs)for(const sample of run.samples){assert.deepEqual(sample.missing,[],`Invisible in-frustum meshes after camera turn (${run.renderer}, ${sample.direction})`);for(const car of sample.cars)assert.deepEqual(car.missingDraws,[],`Missing opponent draw submissions: ${car.id}`);}
console.log('WebGL2 and WebGPU retain scenery and opponents after camera turns.');
