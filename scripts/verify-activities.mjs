import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const output='output/free-drive-activities';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[],external=[],failed=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('response',response=>{if(response.status()>=400)failed.push({url:response.url(),status:response.status()});});
await context.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1'){external.push(url);return route.abort();}return route.continue();});
await page.goto('http://127.0.0.1:5187/?renderer=webgl');
await page.waitForFunction(()=>window.kairos?.ui,{timeout:60000});
await page.evaluate(()=>{const g=window.kairos;g.save.settings.traffic=0;g.save.settings.timeRate=0;g.save.records={};g.save.visits=[];});
await page.click('#start-drive');
await page.waitForSelector('#speed');

const report=await page.evaluate(async()=>{
  const g=window.kairos,{LANDMARKS}=await import('/src/content/world.ts');
  const place=async target=>{g.teleport(target.x,target.z,target.roadId);await g.world.loadAround(g.player.node.position,true);await g.advanceTime(500);};
  const setForwardSpeed=async speed=>{const velocity=g.player.node.forward.scale(speed);g.player.body.setLinearVelocity(velocity);g.player.state.speed=speed;g.player.state.velocity={x:velocity.x,y:velocity.y,z:velocity.z};await g.advanceTime(120);};
  const counts=Object.fromEntries(['speed','trial','drift','scenic'].map(type=>[type,LANDMARKS.filter(l=>l.type===type).length]));
  const speed=[];
  for(const landmark of LANDMARKS.filter(l=>l.type==='speed')){
    await g.action('activity',landmark.id);await place(landmark);
    if(!g.activity?.started)throw new Error(`${landmark.id} did not arm while stationary`);
    if(!g.message.includes('accelerate through'))throw new Error(`${landmark.id} lost its armed instruction`);
    await setForwardSpeed((landmark.target+12)/3.6);
    speed.push({id:landmark.id,target:landmark.target,record:g.save.records[landmark.id],message:g.message,visited:g.save.visits.includes(landmark.id)});
    if(g.activity)throw new Error(`${landmark.id} stayed active after crossing`);
  }
  const speedFirst={...speed[0]};
  await g.action('home');await g.startDrive();
  const first=LANDMARKS.find(l=>l.id==='speed1');await g.action('activity',first.id);await place(first);await setForwardSpeed((first.target+20)/3.6);
  const restarted={record:g.save.records[first.id],message:g.message,activity:g.activity};
  const trials=[];
  for(const landmark of LANDMARKS.filter(l=>l.type==='trial')){
    await g.action('activity',landmark.id);await place(landmark);
    if(!g.activity?.started||!g.route.length)throw new Error(`${landmark.id} did not start with an end route`);
    await place(landmark.end);
    trials.push({id:landmark.id,record:g.save.records[landmark.id],complete:g.activity===null,routePoints:g.route.length});
  }
  const scenic=[];
  for(const landmark of LANDMARKS.filter(l=>l.type==='scenic')){
    await g.action('activity',landmark.id);await place(landmark);
    scenic.push({id:landmark.id,visited:g.save.visits.includes(landmark.id),complete:g.activity===null,message:g.message});
  }
  const drifts=[];
  const {Vector3}=await import('/node_modules/@babylonjs/core/Maths/math.vector.js');
  for(const landmark of LANDMARKS.filter(l=>l.type==='drift')){
    await g.action('activity',landmark.id);await place(landmark);
    if(!g.activity?.started)throw new Error(`${landmark.id} did not start`);
    for(let i=0;i<12;i++){const yaw=g.player.state.yaw+.48,velocity=new Vector3(Math.sin(yaw)*18,0,Math.cos(yaw)*18);g.player.body.setLinearVelocity(velocity);g.player.state.speed=18;g.player.state.velocity={x:velocity.x,y:0,z:velocity.z};await g.advanceTime(50);}
    const liveScore=g.activity?.score??0;
    g.teleport(-380,100,'lakeshore');await g.world.loadAround(g.player.node.position,true);await g.advanceTime(500);
    drifts.push({id:landmark.id,liveScore,record:g.save.records[landmark.id],complete:g.activity===null});
  }
  await g.store.write(g.save);
  return {counts,speed,speedFirst,restarted,trials,scenic,drifts,records:{...g.save.records},visits:[...g.save.visits]};
});

assert.deepEqual(report.counts,{speed:4,trial:3,drift:2,scenic:3});
for(const row of report.speed){assert.ok(row.record>=row.target);assert.equal(row.visited,true);assert.match(row.message,/PERSONAL BEST/);assert.match(row.message,/TARGET REACHED/);}
assert.ok(report.restarted.record>report.speedFirst.record);assert.equal(report.restarted.activity,null);assert.match(report.restarted.message,/TARGET REACHED/);
for(const row of report.trials){assert.ok(row.record>0);assert.equal(row.complete,true);assert.equal(row.routePoints,0);}
for(const row of report.scenic){assert.equal(row.visited,true);assert.equal(row.complete,true);assert.match(row.message,/Discovered/);}
for(const row of report.drifts){assert.ok(row.liveScore>0);assert.ok(row.record>0);assert.equal(row.complete,true);}

await page.evaluate(()=>{const g=window.kairos;g.mapSelection='speed1';g.setScreen('map');g.ui.render(true);});
await page.waitForSelector('.activity-record');
assert.match(await page.locator('.activity-record').textContent(),/PERSONAL BEST/);
await page.screenshot({path:`${output}/speed-record-map.png`});
await page.evaluate(async()=>{const g=window.kairos;await g.startDrive();const {LANDMARKS}=await import('/src/content/world.ts'),landmark=LANDMARKS.find(l=>l.id==='speed1');await g.action('activity',landmark.id);g.teleport(landmark.x,landmark.z,landmark.roadId);await g.world.loadAround(g.player.node.position,true);await g.advanceTime(500);});
await page.screenshot({path:`${output}/speed-trap-armed.png`});
const state=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
assert.equal(state.activity.id,'speed1');assert.equal(state.activity.started,true);assert.match(state.message,/accelerate through/);
await page.reload();await page.waitForFunction(()=>window.kairos?.ui,{timeout:60000});
const persisted=await page.evaluate(()=>({records:window.kairos.save.records,visits:window.kairos.save.visits}));
for(const id of ['speed1','speed2','speed3','speed4','trial1','trial2','trial3','drift1','drift2'])assert.ok(persisted.records[id]>0,`${id} record was not persisted`);
for(const id of ['speed1','speed2','speed3','speed4','vista','lakeside','pines'])assert.ok(persisted.visits.includes(id),`${id} visit was not persisted`);
assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);
await fs.writeFile(`${output}/report.json`,JSON.stringify({...report,persisted,state,errors,failed,external},null,2));
await browser.close();
console.log('Free Drive activity checks passed');
