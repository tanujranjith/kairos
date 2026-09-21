import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const option=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const renderer=option('renderer')??'webgl',output=option('output')??'output/urban-park';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const report={renderer,errors:[],warnings:[],external:[]};
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
  report.park=await page.evaluate(async()=>{
    const g=window.kairos,{URBAN_PARKS,buildUrbanPark}=await import('/src/world/urban-setting.ts'),{buildCellBlueprint}=await import('/src/world/cell-blueprint.ts'),{MeshDataBuilder}=await import('/src/world/mesh-data.ts'),park=URBAN_PARKS[0];
    g.teleport(park.x,park.z,'city3');await g.advanceTime(500);await g.world.loadAround(park,true);await g.renderer.scene.whenReadyAsync();
    const blueprint=buildCellBlueprint(Number(park.cell.split(',')[0]),Number(park.cell.split(',')[1]),'Low');
    const buffers={wall:new MeshDataBuilder(),roof:new MeshDataBuilder(),glass:new MeshDataBuilder()},parkInstances=[];buildUrbanPark(park,buffers,parkInstances);
    const triangles=Object.values(buffers).reduce((sum,builder)=>sum+builder.indices.length/3,0);
    const cell=g.world.cells.get(park.cell);
    return {park,geometry:{triangles,oak:parkInstances.filter(instance=>instance.kind==='oak').length,grass:parkInstances.filter(instance=>instance.kind==='grass').length},cellInstances:{oak:blueprint.instances.filter(instance=>instance.kind==='oak').length,grass:blueprint.instances.filter(instance=>instance.kind==='grass').length},cellReady:!!cell?.collision&&!!cell?.detail,resources:[g.renderer.scene.meshes.length,g.renderer.scene.materials.length,g.renderer.scene.textures.length]};
  });
  assert.equal(report.park.cellReady,true);assert.ok(report.park.geometry.triangles<3500);assert.equal(report.park.geometry.oak,10);assert.equal(report.park.geometry.grass,12);assert.ok(report.park.cellInstances.oak>=10);assert.ok(report.park.cellInstances.grass>=12);

  await page.locator('#ui').evaluate(element=>element.style.visibility='hidden');
  for(const [name,camera] of Object.entries({
    overview:{x:report.park.park.x+102,y:report.park.park.y+66,z:report.park.park.z+112,targetY:4},
    detail:{x:report.park.park.x+35,y:report.park.park.y+10,z:report.park.park.z+31,targetY:1.2},
  })){
    await page.evaluate(async({camera,park})=>{const g=window.kairos,{Vector3}=await import('/node_modules/@babylonjs/core/Maths/math.vector.js');g.renderer.camera.position.set(camera.x,camera.y,camera.z);g.renderer.camera.setTarget(new Vector3(park.x,park.y+camera.targetY,park.z));for(let frame=0;frame<12;frame++){g.renderer.engine.beginFrame();try{g.renderer.scene.render();}finally{g.renderer.engine.endFrame();}}},{camera,park:report.park.park});
    await page.screenshot({path:`${output}/${name}.png`});
  }

  report.contact=await page.evaluate(async park=>{const g=window.kairos,c=Math.cos(park.yaw),s=Math.sin(park.yaw),x=park.x+park.testSpot.across*c+park.testSpot.forward*s,z=park.z-park.testSpot.across*s+park.testSpot.forward*c,{terrainHeight}=await import('/src/content/world.ts');g.player.reset({x,y:terrainHeight(x,z)+1.2,z},park.yaw);await g.advanceTime(1500);return g.snapshot().player;},report.park.park);
  assert.equal(report.contact.damage,0);assert.equal(report.contact.wheels.filter(wheel=>wheel.contact).length,4);assert.ok(report.contact.wheels.every(wheel=>wheel.surface==='Concrete'),JSON.stringify(report.contact.wheels));

  await page.locator('#ui').evaluate(element=>element.style.visibility='');
  report.drive=await page.evaluate(async park=>{const g=window.kairos,{nearestRoad,pointAt}=await import('/src/content/world.ts'),near=nearestRoad(park.x,park.z);const p=pointAt(near.road,near.progress);g.player.reset({x:p.x,y:p.y+1,z:p.z},p.yaw);await g.advanceTime(900);return {road:near.road.id,player:g.snapshot().player};},report.park.park);
  await page.keyboard.down('ArrowUp');for(let step=0;step<7;step++)await page.evaluate(()=>window.advanceTime(500));await page.keyboard.up('ArrowUp');
  report.drive.player=await page.evaluate(()=>window.kairos.snapshot().player);assert.ok(report.drive.player.speed>5);assert.equal(report.drive.player.wheels.filter(wheel=>wheel.contact).length,4);assert.equal(report.drive.player.damage,0);
  await page.screenshot({path:`${output}/driving.png`});

  assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);
  assert.deepEqual(report.warnings.filter(value=>!value.includes('The powerPreference option is currently ignored when calling requestAdapter() on Windows')),[]);
  report.scope='One cell-owned Westbrook civic park in installed Edge, direct overview/detail renders, physical concrete path contacts and normal keyboard driving. Development-host evidence, not target-laptop performance or final city-art acceptance.';
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({renderer:report.actualRenderer,park:report.park,contact:report.contact.wheels.map(wheel=>wheel.surface),drive:{road:report.drive.road,speed:report.drive.player.speed},errors:report.errors},null,2));
}catch(error){
  report.failure=String(error);await fs.writeFile(`${output}/failure.json`,JSON.stringify(report,null,2));await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;
}finally{await browser.close();}
