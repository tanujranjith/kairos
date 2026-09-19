import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));await fs.mkdir('output/traffic',{recursive:true});
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui,null,{timeout:60000});
  const reports=[];
  for(const name of ['signal','left','right','uturn','following','lane-change','merge','recovery']){
    const report=await page.evaluate(async name=>{const {runTrafficCase}=await import('/src/tools/traffic-validation.ts');return await runTrafficCase(window.kairos,name);},name);reports.push(report);
    await page.evaluate(async()=>{const g=window.kairos;await g.renderer.scene.whenReadyAsync();g.advanceTime(0);});await page.screenshot({path:`output/traffic/${name}.png`});
    console.log(name,JSON.stringify({...report,trace:undefined}));
  }
  const [signal,left,right,uturn,following,passing,merge,recovery]=reports;
  const runtime=await page.evaluate(async()=>{
    const g=window.kairos;g.save.selected='aeris';g.save.settings.traffic=12;g.save.settings.time=15;await g.startDrive();
    const initial=g.trafficSystem.snapshot(),samples=[];await g.advanceTime(1000);
    for(const [x,z,road] of [[-1340,-980,'city3'],[-900,-930,'city1'],[-380,100,'lakeshore']]){
      g.teleport(x,z,road);for(let i=0;i<14;i++)await g.advanceTime(500);const s=g.trafficSystem.snapshot();samples.push({...s,agents:undefined,cells:g.world.cells.size,finite:s.agents.every(a=>Number.isFinite(a.speed)&&Number.isFinite(a.position.y)),maxDamage:Math.max(0,...g.traffic.map(t=>t.vehicle.state.damage))});
    }
    await g.advanceTime(3000);const replenished=g.trafficSystem.snapshot();return {initial:{...initial,agents:undefined},samples,replenished:{...replenished,agents:undefined}};
  });
  // Capture the actual controlled signal state from a driver's viewpoint.
  const lights=await page.evaluate(async()=>{
    const g=window.kairos,{TRAFFIC_GRAPH}=await import('/src/content/traffic-network.ts'),{samplePath}=await import('/src/sim/lane-graph.ts');
    g.trafficSystem.clear();const lane=[...TRAFFIC_GRAPH.paths.values()].find(p=>p.kind==='lane'&&p.roadId==='city3'&&p.to==='westbrook-cedar'&&p.direction===1),p=samplePath(lane,lane.length-7);
    g.world.ensure(p);g.player.reset(p,p.yaw);g.clock=0;await g.advanceTime(8000);g.message='';g.advanceTime(0);await g.renderer.scene.whenReadyAsync();g.advanceTime(0);
    return g.renderer.scene.meshes.filter(m=>m.name.startsWith('signal-westbrook-cedar-')&&m.isVisible).map(m=>m.name);
  });
  await page.screenshot({path:'output/traffic/red-light.png'});
  const checks=[
    {name:'red stop then green departure',pass:signal.stoppedAtRed&&signal.redMaxProgress<signal.sourceLength-2&&signal.visited.includes(signal.initialNext)},
    ...[left,right,uturn,merge].map(r=>({name:`${r.name} connector and exit`,pass:r.visited.includes(r.initialNext)&&r.visited.includes(r.turnTarget)&&r.maxError<4&&r.maxDamage<.03})),
    {name:'stationary player queue without contact',pass:following.minGap>1&&Math.abs(following.finalSpeed)<.5&&following.maxDamage<.03},
    {name:'lane change clears stationary vehicle',pass:passing.laneChanges>0&&passing.distance>110&&passing.maxDamage<.03&&passing.minBodyClearance>.1},
    {name:'stopped queue resumes after obstruction removal',pass:recovery.stoppedForObstacle&&recovery.finalSpeed>5&&recovery.distance>80&&recovery.minBodyClearance>1},
    // The narrow lakeshore has fewer safely spaced off-camera spawn points than
    // the city. Require no empty population and ongoing replenishment, not an
    // artificial instantaneous density floor that encourages unsafe visible spawns.
    {name:'physical/distant population and safe tier transitions',pass:runtime.initial.physical===12&&runtime.initial.distant===12&&runtime.samples.every(s=>s.finite&&s.physical>0&&s.physical+s.distant===24&&s.maxDamage<.03)&&runtime.samples.at(-1).promotions>12&&runtime.samples.at(-1).demotions>0&&runtime.replenished.physical>=runtime.samples.at(-1).physical&&runtime.replenished.promotions>runtime.samples.at(-1).promotions&&runtime.samples.every(s=>s.maxDecisionsPerStep<=2)},
    {name:'visible red and green match the active signal groups',pass:lights.includes('signal-westbrook-cedar-0-green')&&lights.includes('signal-westbrook-cedar-1-red')&&lights.length===2},
    {name:'no browser exceptions',pass:errors.length===0},
  ];
  await fs.writeFile('output/traffic/report.json',JSON.stringify({reports,runtime,lights,checks,errors},null,2));console.log(JSON.stringify({checks,runtime,lights},null,2));assert.ok(checks.every(c=>c.pass),'Traffic physics acceptance failed');
}finally{await browser.close();}
