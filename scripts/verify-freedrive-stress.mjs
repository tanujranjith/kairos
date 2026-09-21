import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const origin='http://127.0.0.1:5187',output='output/freedrive-stress';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
const errors=[],failed=[],external=[];page.setDefaultTimeout(120000);
page.on('pageerror',error=>errors.push(String(error)));
page.on('requestfailed',request=>failed.push({url:request.url(),error:request.failure()?.errorText??''}));
page.on('request',request=>{const url=request.url();if(/^https?:/.test(url)&&new URL(url).origin!==origin)external.push(url);});

const capture=async name=>{await page.evaluate(async()=>{const game=window.kairos;await game.advanceTime(0);await game.renderer.scene.whenReadyAsync();await game.advanceTime(0);});await page.screenshot({path:`${output}/${name}.png`});};

try{
  await page.goto(`${origin}/?renderer=webgl`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.kairos?.ui&&!document.querySelector('#loading'));
  const baseline=await page.evaluate(()=>{const scene=window.kairos.renderer.scene;return {meshes:scene.meshes.length,materials:scene.materials.length,textures:scene.textures.length};});
  await page.evaluate(async()=>{
    const game=window.kairos;game.save.selected='velara';Object.assign(game.save.settings,{automaticQuality:false,quality:'Low',resolution:1,traffic:12,volume:0,timeRate:0,weather:'Clear'});game.applySettings(true);await game.startDrive();game.race.state.session.difficulty=1;await game.advanceTime(1000);
  });

  const runLeg=async({name,roadId,progress,seconds,initialSpeed})=>page.evaluate(async({name,roadId,progress,seconds,initialSpeed})=>{
    const game=window.kairos,{ROADS,pointAt,nearestRoadAt}=await import('/src/content/world.ts'),road=ROADS.find(item=>item.id===roadId);
    if(!road)throw new Error(`Missing road ${roadId}`);
    const laneWidth=road.width/road.lanes,offset=road.width/2-laneWidth*.5,p=pointAt(road,progress,offset);
    game.setAutopilot(false);await game.world.loadAround(p,true);game.player.reset(p,p.yaw);await game.advanceTime(1200);
    const direction=game.player.node.forward.scale(initialSpeed);game.player.body.setLinearVelocity(direction);game.player.state.velocity={x:direction.x,y:direction.y,z:direction.z};game.player.state.speed=initialSpeed;game.player.state.gear=4;game.player.state.wheels.forEach(wheel=>wheel.omega=initialSpeed/game.player.definition.wheelRadius);
    game.world.update(game.player.state.position,game.player.state.velocity,game.traffic.map(item=>({id:item.vehicle.id,position:item.vehicle.state.position,velocity:item.vehicle.state.velocity})));
    await game.world.streamer.waitFor([...game.world.streamer.records.values()].filter(record=>record.demand.collision).map(record=>record.demand.id));
    const originalReady=game.world.readyFor.bind(game.world),originalReset=game.player.reset.bind(game.player);let readinessPauses=0,playerSurfaceMisses=0,actorSurfaceMisses=0,resets=0;
    game.world.readyFor=positions=>{const playerReady=game.world.readyAround(positions[0]),missingActors=positions.slice(1).filter(position=>!game.world.readyAround(position)).length,ready=originalReady(positions);if(!ready)readinessPauses++;if(!playerReady)playerSurfaceMisses++;if(missingActors)actorSurfaceMisses+=missingActors;return ready;};
    game.player.reset=(...args)=>{resets++;return originalReset(...args);};game.setAutopilot(true,roadId,offset);
    const samples=[];try{
      for(let elapsed=0;elapsed<seconds;elapsed+=.5){await game.advanceTime(500);const state=game.player.state,near=nearestRoadAt(state.position,item=>item.id===roadId),stream=game.world.snapshot(),traffic=game.trafficSystem.snapshot();samples.push({t:elapsed+.5,speed:Math.abs(state.speed),grounded:state.grounded,contacts:state.wheels.filter(wheel=>wheel.contact).length,lateral:near.lateral,roadDistance:near.distance,progress:near.progress,damage:state.damage,cells:game.world.cells.size,queued:stream.queued,loading:stream.loading,failed:stream.failed,traffic:traffic.physical+traffic.distant,maxDecisionsPerStep:traffic.maxDecisionsPerStep});}
    }finally{game.setAutopilot(false);game.world.readyFor=originalReady;game.player.reset=originalReset;}
    const high=samples.filter(sample=>sample.t>3),stream=game.world.snapshot(),traffic=game.trafficSystem.snapshot();
    return {name,roadId,seconds,initialSpeed,offset,readinessPauses,playerSurfaceMisses,actorSurfaceMisses,resets,stream,traffic:{...traffic,agents:undefined},maxSpeed:Math.max(...samples.map(sample=>sample.speed)),minHighSpeed:Math.min(...high.map(sample=>sample.speed)),meanHighSpeed:high.reduce((sum,sample)=>sum+sample.speed,0)/high.length,firstSevenSecondMean:samples.filter(sample=>sample.t<=7).reduce((sum,sample)=>sum+sample.speed,0)/samples.filter(sample=>sample.t<=7).length,groundedFraction:high.filter(sample=>sample.grounded).length/high.length,fourContactFraction:high.filter(sample=>sample.contacts===4).length/high.length,maxRoadDistance:Math.max(...high.map(sample=>sample.roadDistance)),maxLateral:Math.max(...high.map(sample=>Math.abs(sample.lateral))),maxDamage:Math.max(...samples.map(sample=>sample.damage)),minTraffic:Math.min(...samples.map(sample=>sample.traffic)),maxCells:Math.max(...samples.map(sample=>sample.cells)),samples};
  },{name,roadId,progress,seconds,initialSpeed});

  const crossway=await runLeg({name:'crossway-eastbound',roadId:'crossway',progress:420,seconds:34,initialSpeed:74});await capture('crossway-eastbound');
  // This is intentionally a sharp, distant route change while the previous
  // corridor may still have queued detail work. Stale loads must cancel cleanly.
  const ring=await runLeg({name:'ring-remote',roadId:'ring',progress:6400,seconds:44,initialSpeed:70});await capture('ring-remote');
  const beforeHome=await page.evaluate(()=>{const game=window.kairos,scene=game.renderer.scene;return {stream:game.world.snapshot(),traffic:game.trafficSystem.snapshot(),meshes:scene.meshes.length,materials:scene.materials.length,textures:scene.textures.length};});
  await page.evaluate(async()=>{await window.kairos.action('home');await window.advanceTime(0);});await capture('home-cleanup');
  const afterHome=await page.evaluate(()=>{const game=window.kairos,scene=game.renderer.scene;return {cells:game.world.cells.size,stream:game.world.snapshot(),traffic:game.trafficSystem.snapshot(),meshes:scene.meshes.length,materials:scene.materials.length,textures:scene.textures.length};});
  const legs=[crossway,ring],checks=[
    {name:'both legs exercise top-speed load and maintain highway pace',pass:legs.every(leg=>leg.maxSpeed>=65&&leg.firstSevenSecondMean>=65&&leg.meanHighSpeed>=38)},
    {name:'no player recovery/reset at speed',pass:legs.every(leg=>leg.resets===0)},
    {name:'any player-corridor miss is gated before unsupported motion',pass:legs.every(leg=>leg.playerSurfaceMisses<=leg.readinessPauses&&leg.groundedFraction===1&&leg.fourContactFraction===1)},
    {name:'player remains supported by authored road collision',pass:legs.every(leg=>leg.groundedFraction>=.98&&leg.fourContactFraction>=.90&&leg.maxRoadDistance<(leg.roadId==='crossway'?9.5:7.5))},
    {name:'high-speed traversal avoids meaningful collision damage',pass:legs.every(leg=>leg.maxDamage<.03)},
    {name:'traffic remains finite, populated, and staggered',pass:legs.every(leg=>leg.minTraffic===24&&leg.traffic.maxDecisionsPerStep<=2&&leg.traffic.physical+leg.traffic.distant===24)},
    {name:'abrupt route change cancels/disposes stale cells without failures',pass:ring.stream.cancelled>crossway.stream.cancelled&&ring.stream.disposed>crossway.stream.disposed&&ring.stream.failed===0&&ring.stream.errors.length===0},
    {name:'home releases world and traffic resources',pass:afterHome.cells===0&&afterHome.traffic.physical===0&&afterHome.traffic.distant===0&&afterHome.stream.errors.length===0&&afterHome.meshes===baseline.meshes&&afterHome.materials===baseline.materials&&afterHome.textures===baseline.textures},
    {name:'no browser exceptions, failed requests, or external hosts',pass:errors.length===0&&failed.length===0&&external.length===0},
  ];
  const report={environment:'Installed Edge, native WebGL2, Low 720p. The default Velara S uses a diagnostic initial highway velocity followed by normal 120 Hz inputs, tires, drivetrain, traffic, collisions, AI, and six-second streaming look-ahead.',baseline,legs,beforeHome,afterHome,checks,errors,failed,external};
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({checks,legs:legs.map(({samples,...leg})=>leg),baseline,afterHome,errors,failed,external},null,2));assert.ok(checks.every(check=>check.pass),'Free Drive high-speed/streaming acceptance failed');
}catch(error){await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});await fs.writeFile(`${output}/failure.json`,JSON.stringify({error:String(error),errors,failed,external,url:page.url()},null,2));throw error;}
finally{await context.close();await browser.close();}
