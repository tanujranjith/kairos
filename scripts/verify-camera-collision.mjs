import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const output='output/camera-collision';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[],external=[],failed=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('response',response=>{if(response.status()>=400)failed.push({url:response.url(),status:response.status()});});
await context.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1'){external.push(url);return route.abort();}return route.continue();});
await page.goto('http://127.0.0.1:5187/?renderer=webgl');
await page.waitForFunction(()=>window.kairos?.ui,{timeout:60000});
await page.evaluate(()=>{const g=window.kairos;g.save.settings.traffic=0;g.save.settings.timeRate=0;g.save.settings.volume=0;});
await page.click('#start-drive');await page.waitForSelector('#speed');
await page.evaluate(async()=>{const g=window.kairos;g.save.settings.camera=0;g.teleport(-380,100,'lakeshore');await g.world.loadAround(g.player.node.position,true);await g.advanceTime(1000);});

const clear=JSON.parse(await page.evaluate(()=>window.render_game_to_text())).camera;
assert.equal(clear.mode,0);assert.equal(clear.obstructed,false);assert.ok(clear.requestedDistance>6&&Math.abs(clear.currentDistance-clear.requestedDistance)<.08);

const installWall=async mode=>page.evaluate(async mode=>{
  const g=window.kairos,{MeshBuilder,StandardMaterial,Color3,Vector3,Quaternion}=await import('/node_modules/@babylonjs/core/index.js');g.save.settings.camera=mode;await g.advanceTime(400);
  const p=g.visual.root.position,yaw=g.player.state.yaw,forward=new Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const wall=MeshBuilder.CreateBox(`camera-obstruction-${mode}`,{width:8,height:4,depth:.45},g.renderer.scene);wall.position.copyFrom(p.subtract(forward.scale(mode===0?3.2:2.5))).addInPlace(new Vector3(0,1.3,0));wall.rotationQuaternion=Quaternion.RotationYawPitchRoll(yaw,0,0);
  const material=new StandardMaterial(`camera-obstruction-material-${mode}`,g.renderer.scene);material.diffuseColor=new Color3(.22,.27,.31);material.specularColor=new Color3(.04,.04,.04);wall.material=material;
  const collider=g.physics.addBox(wall,new Vector3(8,4,.45));window.cameraCollisionFixture={wall,material,collider};await g.advanceTime(20);
  return JSON.parse(window.render_game_to_text()).camera;
},mode);
const clearWall=async()=>page.evaluate(async()=>{const g=window.kairos,fixture=window.cameraCollisionFixture;fixture.collider.body.dispose();fixture.collider.shape.dispose();fixture.wall.dispose();fixture.material.dispose();delete window.cameraCollisionFixture;await g.advanceTime(100);return JSON.parse(window.render_game_to_text()).camera;});

const modes=[];
for(const mode of [0,1]){
  const blocked=await installWall(mode);
  assert.equal(blocked.mode,mode);assert.equal(blocked.obstructed,true);assert.ok(blocked.resolvedDistance<blocked.requestedDistance-1);assert.ok(Math.abs(blocked.currentDistance-blocked.resolvedDistance)<.04,'obstruction must pull the camera inside immediately');
  await page.screenshot({path:`${output}/mode-${mode}-blocked.png`});
  const early=await clearWall();assert.equal(early.obstructed,false);assert.ok(early.currentDistance>blocked.currentDistance);assert.ok(early.currentDistance<early.requestedDistance-.15,'camera release should not pop instantly');
  await page.evaluate(()=>window.advanceTime(1200));const released=JSON.parse(await page.evaluate(()=>window.render_game_to_text())).camera;
  assert.equal(released.obstructed,false);assert.ok(Math.abs(released.currentDistance-released.requestedDistance)<.08);
  await page.screenshot({path:`${output}/mode-${mode}-released.png`});modes.push({mode,blocked,early,released});
}

for(const mode of [2,3,4]){await page.evaluate(async mode=>{const g=window.kairos;g.save.settings.camera=mode;await g.advanceTime(100);},mode);const state=JSON.parse(await page.evaluate(()=>window.render_game_to_text()).catch(()=>''));assert.equal(state.camera.mode,mode);assert.equal(state.camera.obstructed,false);}
assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);
const report={clear,modes,errors,failed,external,scope:'Installed Edge-compatible Chromium/WebGL2 development build. A temporary collision-group-1 wall is inserted on each chase-camera ray, then removed. The production renderer, Havok raycast, fixed-step hook and rendered gameplay camera are otherwise unchanged.'};
await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();
console.log('Camera collision checks passed',JSON.stringify(modes.map(({mode,blocked,early,released})=>({mode,blocked:blocked.currentDistance,requested:blocked.requestedDistance,early:early.currentDistance,released:released.currentDistance}))));
