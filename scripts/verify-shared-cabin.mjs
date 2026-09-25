import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'output/shared-cabin';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),report={runs:[],errors:[]};
try{
  for(const fallback of [false,true]){
    const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(String(e)));
    if(fallback)await page.route('**/models/*.glb*',route=>route.abort());
    await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForSelector('#loading',{state:'detached'});
    await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(0);g.save.settings.traffic=0;g.save.settings.timeRate=0;});
    const rows=[];
    for(const id of ['aeris','velara','crest','nova','gtx','apex']){
      const row=await page.evaluate(async id=>{
        const g=window.kairos,{Quaternion,Vector3}=await import('/node_modules/@babylonjs/core/Maths/math.vector.js'),{vehicleById}=await import('/src/content/vehicles.ts'),{cameraMounts}=await import('/src/render/camera-mounts.ts'),{updateSteeringVisual}=await import('/src/render/car-steering.ts');
        await g.action('select-car',id);g.setScreen('garage');await g.advanceTime(0);const floor=g.visual.root.position.y-g.visual.groundOffset;
        await g.startDrive();await g.advanceTime(1000);
        const cameraErrors=[];
        for(const tilted of [false,true]){
          // Pose-only injection validates camera attachment, not driving physics.
          if(tilted){g.player.node.rotationQuaternion=Quaternion.RotationYawPitchRoll(g.player.state.yaw,.12,.08);g.player.previousRotation.copyFrom(g.player.node.rotationQuaternion);}
          for(const [camera,mountName]of [[2,'cockpit'],[3,'hood'],[4,'bumper']]){
            g.save.settings.camera=camera;await g.advanceTime(0);
            const local=Vector3.TransformCoordinates(g.renderer.camera.position,g.visual.root.computeWorldMatrix(true).clone().invert()),mount=cameraMounts(vehicleById('velara'))[mountName];
            cameraErrors.push({camera,tilted,error:Math.hypot(local.x-mount.x,local.y-mount.y,local.z-mount.z)});
          }
        }
        g.player.state.steer=.12;await g.advanceTime(0);const pivot=g.visual.root.getChildTransformNodes().find(n=>n.name.endsWith('steering-pivot')),expected=Quaternion.Identity();updateSteeringVisual(vehicleById('velara'),.12,expected);
        const steeringError=1-Math.abs(Quaternion.Dot(pivot.rotationQuaternion,expected));
        g.player.node.rotationQuaternion=Quaternion.RotationYawPitchRoll(g.player.state.yaw,0,0);g.player.previousRotation.copyFrom(g.player.node.rotationQuaternion);g.save.settings.camera=2;await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();for(let i=0;i<8;i++)await g.advanceTime(0);
        return {id,floor,cameraErrors,steeringError,model:g.visual.root.metadata.visualModel,fallback:!!g.visual.root.metadata.fallback};
      },id);
      rows.push(row);await page.screenshot({path:`${output}/${fallback?'fallback':'asset'}-${id}.png`});
    }
    report.runs.push({fallback,rows});await page.close();
  }
}finally{await browser.close();await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));}
assert.deepEqual(report.errors,[]);
for(const run of report.runs)for(const row of run.rows){assert.equal(row.model,'velara');assert.equal(row.fallback,run.fallback);assert.ok(Math.abs(row.floor-(-999.895))<1e-6);assert.ok(row.steeringError<1e-6);assert.ok(row.cameraErrors.every(c=>c.error<.0001),JSON.stringify(row));}
console.log('All six profiles: shared cockpit/hood/bumper mounts, pitch/roll attachment, steering and floor placement pass with GLBs and fallback.');
