import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const option=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3),renderer=option('renderer')??'webgl',output=option('output')??'output/industrial-setting';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),report={renderer,sites:[],errors:[],warnings:[],external:[]};
page.setDefaultTimeout(90000);page.on('pageerror',error=>report.errors.push(String(error)));page.on('console',message=>{if(['error','warning'].includes(message.type()))report.warnings.push(message.text());});page.on('request',request=>{if(!/^(http:\/\/127\.0\.0\.1:5187|data:|blob:)/.test(request.url()))report.external.push(request.url());});

try{
  await page.goto(`http://127.0.0.1:5187/${renderer==='webgl'?'?renderer=webgl':''}`);await page.waitForSelector('#loading',{state:'detached'});
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.timeRate=0;g.save.settings.time=16;g.save.settings.weather='Clear';g.save.settings.traffic=0;await g.startDrive();});
  report.actualRenderer=await page.evaluate(()=>window.kairos.renderer.rendererName);assert.equal(report.actualRenderer,renderer==='webgl'?'WebGL2':'WebGPU');
  const sites=await page.evaluate(async()=>{const module=await import('/src/world/industrial-setting.ts');return structuredClone(module.INDUSTRIAL_SITES);});assert.equal(sites.length,4);
  await page.locator('#ui').evaluate(element=>element.style.visibility='hidden');
  for(let index=0;index<sites.length;index++){
    const site=sites[index],overview=await page.evaluate(async({site,index})=>{
      const g=window.kairos,{Vector3}=await import('/node_modules/@babylonjs/core/Maths/math.vector.js');g.teleport(site.x,site.z,'industrial');await g.advanceTime(600);await g.world.loadAround({x:site.x,y:site.y,z:site.z},true);await g.renderer.scene.whenReadyAsync();
      const camera=g.renderer.camera,side=index%2===0?1:-1,c=Math.cos(site.yaw),s=Math.sin(site.yaw);camera.position.set(site.x+c*side*96-s*88,site.y+48,site.z-s*side*96-c*88);camera.setTarget(new Vector3(site.x,site.y+4,site.z));
      for(let frame=0;frame<8;frame++){g.renderer.engine.beginFrame();try{g.renderer.scene.render();}finally{g.renderer.engine.endFrame();}}
      const cell=g.world.cells.get(site.cell),structure=cell?.meshes.filter(mesh=>mesh.name.startsWith('structures-')||mesh.name.startsWith('roofs-'))??[];
      return {id:site.id,kind:site.kind,cell:site.cell,structures:structure.length,triangles:structure.reduce((sum,mesh)=>sum+mesh.getTotalIndices()/3,0),resources:[g.renderer.scene.meshes.length,g.renderer.scene.materials.length,g.renderer.scene.textures.length]};
    },{site,index});
    assert.ok(overview.structures>=2);assert.ok(overview.triangles>1000);await page.screenshot({path:`${output}/${site.id}.png`});
    const contact=await page.evaluate(async site=>{
      const g=window.kairos,c=Math.cos(site.yaw),s=Math.sin(site.yaw),spot=site.kind==='containers'?{a:35,f:0}:site.kind==='tanks'?{a:0,f:23}:{a:28,f:-22},x=site.x+spot.a*c+spot.f*s,z=site.z-spot.a*s+spot.f*c;
      const world=await import('/src/content/world.ts'),position={x,y:world.terrainHeight(x,z)+1.1,z};await g.world.loadAround(position,true);g.player.reset(position,site.yaw);await g.advanceTime(1200);return g.snapshot().player;
    },site);
    assert.equal(contact.damage,0);assert.equal(contact.wheels.filter(wheel=>wheel.contact).length,4);assert.ok(contact.wheels.every(wheel=>wheel.surface==='Concrete'),`${site.id}: ${contact.wheels.map(wheel=>wheel.surface)}`);report.sites.push({...overview,contact:contact.wheels.map(wheel=>wheel.surface)});
  }
  await page.locator('#ui').evaluate(element=>element.style.visibility='');
  await page.evaluate(async()=>{const g=window.kairos;g.teleport(-1450,-550,'industrial');await g.advanceTime(1000);});await page.keyboard.down('ArrowUp');for(let step=0;step<7;step++)await page.evaluate(()=>window.advanceTime(500));await page.keyboard.up('ArrowUp');report.drive=await page.evaluate(()=>window.kairos.snapshot().player);assert.ok(report.drive.speed>5);assert.equal(report.drive.wheels.filter(wheel=>wheel.contact).length,4);assert.equal(report.drive.damage,0);await page.screenshot({path:`${output}/driving.png`});
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);assert.deepEqual(report.warnings.filter(value=>!value.includes('The powerPreference option is currently ignored when calling requestAdapter() on Windows')),[]);
  report.scope='Four authored industrial compounds in installed Edge, direct overview renders, concrete pad contacts and normal keyboard road driving. Development-host evidence, not target-laptop performance or final art acceptance.';
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({renderer:report.actualRenderer,sites:report.sites,drive:report.drive.speed,errors:report.errors},null,2));
}catch(error){report.failure=String(error);await fs.writeFile(`${output}/failure.json`,JSON.stringify(report,null,2));await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}finally{await browser.close();}
