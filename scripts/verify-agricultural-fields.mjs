import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const option=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const renderer=option('renderer')??'webgl',output=option('output')??'output/agricultural-fields';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}});
const report={renderer,fields:[],errors:[],warnings:[],external:[]};
page.setDefaultTimeout(90000);
page.on('pageerror',error=>report.errors.push(String(error)));
page.on('console',message=>{if(['error','warning'].includes(message.type()))report.warnings.push(message.text());});
page.on('request',request=>{if(!/^(http:\/\/127\.0\.0\.1:5187|data:|blob:)/.test(request.url()))report.external.push(request.url());});

try{
  await page.goto(`http://127.0.0.1:5187/${renderer==='webgl'?'?renderer=webgl':''}`);
  await page.waitForSelector('#loading',{state:'detached'});
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.timeRate=0;g.save.settings.time=16;g.save.settings.weather='Clear';g.save.settings.traffic=0;await g.startDrive();});
  report.actualRenderer=await page.evaluate(()=>window.kairos.renderer.rendererName);
  assert.equal(report.actualRenderer,renderer==='webgl'?'WebGL2':'WebGPU');
  const fields=await page.evaluate(async()=>{const ground=await import('/src/world/ground-cover.ts'),world=await import('/src/content/world.ts');return ground.AGRICULTURAL_FIELDS.map(field=>({...field,y:world.terrainHeight(field.x,field.z),weight:ground.agriculturalFieldWeight(field.x,field.z)}));});
  assert.equal(fields.length,5);
  await page.locator('#ui').evaluate(element=>element.style.visibility='hidden');
  for(let index=0;index<fields.length;index++){
    const field=fields[index];
    const row=await page.evaluate(async({field,index})=>{
      const g=window.kairos,{Vector3}=await import('/node_modules/@babylonjs/core/Maths/math.vector.js');
      g.teleport(field.x,field.z,field.road);await g.advanceTime(500);
      await g.world.loadAround({x:field.x,y:field.y,z:field.z},true);await g.renderer.scene.whenReadyAsync();
      const camera=g.renderer.camera,side=index%2===0?1:-1;
      camera.position.set(field.x+field.cos*side*112-field.sin*92,field.y+54,field.z-field.sin*side*112-field.cos*92);
      camera.setTarget(new Vector3(field.x,field.y+1,field.z));
      for(let frame=0;frame<8;frame++){g.renderer.engine.beginFrame();try{g.renderer.scene.render();}finally{g.renderer.engine.endFrame();}}
      const terrain=g.renderer.scene.meshes.filter(mesh=>mesh.name.startsWith('terrain-'));
      return {index,road:field.road,centre:[field.x,field.y,field.z],size:[field.width,field.length],weight:field.weight,terrainMeshes:terrain.length,fieldMeshes:g.renderer.scene.meshes.filter(mesh=>/field|crop/i.test(mesh.name)).length,resources:[g.renderer.scene.meshes.length,g.renderer.scene.materials.length,g.renderer.scene.textures.length],player:g.snapshot().player};
    },{field,index});
    assert.equal(row.weight,1);assert.ok(row.terrainMeshes>0);assert.equal(row.fieldMeshes,0);assert.equal(row.player.wheels.filter(wheel=>wheel.contact).length,4);assert.equal(row.player.damage,0);
    report.fields.push(row);await page.screenshot({path:`${output}/field-${index+1}.png`});
  }
  await page.locator('#ui').evaluate(element=>element.style.visibility='');
  await page.evaluate(async()=>{const g=window.kairos;g.teleport(-380,100,'lakeshore');await g.advanceTime(1000);});
  await page.keyboard.down('ArrowUp');for(let step=0;step<6;step++)await page.evaluate(()=>window.advanceTime(500));await page.keyboard.up('ArrowUp');
  report.drive=await page.evaluate(()=>window.kairos.snapshot().player);assert.ok(report.drive.speed>5);assert.equal(report.drive.wheels.filter(wheel=>wheel.contact).length,4);assert.equal(report.drive.damage,0);await page.screenshot({path:`${output}/driving.png`});
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);assert.deepEqual(report.warnings.filter(value=>!value.includes('The powerPreference option is currently ignored when calling requestAdapter() on Windows')),[]);
  report.scope='Five authored farm-field shader masks in installed Edge, with direct overview captures and normal keyboard driving. Development host, not target-laptop performance or final art acceptance.';
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({renderer:report.actualRenderer,fields:report.fields.map(field=>({road:field.road,size:field.size,resources:field.resources})),drive:report.drive.speed,errors:report.errors},null,2));
}catch(error){report.failure=String(error);await fs.writeFile(`${output}/failure.json`,JSON.stringify(report,null,2));await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}finally{await browser.close();}
