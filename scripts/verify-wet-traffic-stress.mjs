import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const origin='http://127.0.0.1:5187',output=process.argv.find(value=>value.startsWith('--output='))?.slice(9)??'output/wet-traffic-stress';
const errors=[],warnings=[],failed=[],external=[],samples=[],waiting=new Map(),maxWait=new Map(),paths=new Set(),reasons=new Set();
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
page.setDefaultTimeout(90000);
page.on('pageerror',error=>errors.push(String(error)));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());if(message.type()==='warning')warnings.push(message.text());});
page.on('requestfailed',request=>failed.push({url:request.url(),error:request.failure()?.errorText??''}));
await page.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)&&new URL(url).origin!==origin){external.push(url);return route.abort();}return route.continue();});

try{
  await page.goto(`${origin}/?renderer=webgl`);
  await page.waitForFunction(()=>window.kairos?.ui&&!document.querySelector('#loading'));
  await page.evaluate(async()=>{
    const game=window.kairos;
    Object.assign(game.save.settings,{automaticQuality:false,quality:'Low',resolution:1,traffic:12,volume:0,time:22,timeRate:0,weather:'Rain'});
    game.applySettings(true);await game.startDrive();game.wetness=.9;
    game.input.poll=()=>({throttle:0,brake:1,steer:0,handbrake:false,shift:0,reverse:false});
    await game.advanceTime(2000);
  });

  const phases=[
    {name:'westbrook-crossing',roadId:'city3',ratio:.50,seconds:90},
    {name:'civic-corridor',roadId:'city1',ratio:.56,seconds:90},
    {name:'orchard-merge',roadId:'south',ratio:.72,seconds:90},
  ];
  let captured=false,capturedCluster=0;
  for(const phase of phases){
    await page.evaluate(async phase=>{
      const game=window.kairos,{ROADS,pointAt}=await import('/src/content/world.ts'),road=ROADS.find(item=>item.id===phase.roadId);
      if(!road)throw new Error(`Missing road ${phase.roadId}`);
      const point=pointAt(road,road.length*phase.ratio,road.width/2+7);
      await game.world.loadAround(point,true);game.player.reset(point,point.yaw);await game.advanceTime(6000);
    },phase);
    for(let elapsed=0;elapsed<phase.seconds;elapsed+=2){
      const sample=await page.evaluate(async phase=>{
        const game=window.kairos;await game.advanceTime(2000);const traffic=game.trafficSystem.snapshot();
        const physical=game.trafficSystem.actors.flatMap(actor=>actor.physical?[{id:actor.agent.id,speed:actor.physical.vehicle.state.speed,damage:actor.physical.vehicle.state.damage,grounded:actor.physical.vehicle.state.grounded,contacts:actor.physical.vehicle.state.wheels.filter(wheel=>wheel.contact).length}]:[]);
        return {phase:phase.name,elapsed:game.clock,wetness:game.wetness,time:game.save.settings.time,weather:game.save.settings.weather,playerDamage:game.player.state.damage,streaming:game.world.snapshot(),traffic,physical};
      },phase);
      samples.push(sample);
      for(const agent of sample.traffic.agents){
        paths.add(agent.path);reasons.add(agent.reason);
        const blocked=agent.speed<.35&&['signal','yield','traffic','recovery'].includes(agent.reason),duration=blocked?(waiting.get(agent.id)??0)+2:0;
        waiting.set(agent.id,duration);maxWait.set(agent.id,Math.max(maxWait.get(agent.id)??0,duration));
      }
      const physicalAgents=sample.traffic.agents.filter(agent=>agent.tier==='physical'),clusterSize=Math.max(0,...physicalAgents.map(anchor=>physicalAgents.filter(other=>Math.hypot(other.position.x-anchor.position.x,other.position.z-anchor.position.z)<120).length));
      if(!captured&&clusterSize>=4&&physicalAgents.filter(agent=>agent.speed>2).length>=4){
        captured=true;
        capturedCluster=clusterSize;
        await page.evaluate(async()=>{const game=window.kairos,cars=game.trafficSystem.cars,anchor=[...cars].sort((a,b)=>{const near=car=>cars.filter(other=>Math.hypot(other.vehicle.node.position.x-car.vehicle.node.position.x,other.vehicle.node.position.z-car.vehicle.node.position.z)<120).length;return near(b)-near(a);})[0],group=cars.filter(car=>Math.hypot(car.vehicle.node.position.x-anchor.vehicle.node.position.x,car.vehicle.node.position.z-anchor.vehicle.node.position.z)<120),centre=anchor.vehicle.node.position.clone().scaleInPlace(0);for(const car of group)centre.addInPlace(car.vehicle.node.position);centre.scaleInPlace(1/group.length);document.querySelector('#ui').style.visibility='hidden';game.renderer.camera.position.set(centre.x+42,centre.y+26,centre.z+42);game.renderer.camera.setTarget(centre);await game.renderer.scene.whenReadyAsync();game.renderer.scene.render();});
        await page.screenshot({path:`${output}/wet-night-traffic.png`});
        await page.evaluate(()=>document.querySelector('#ui').style.visibility='');
      }
    }
    console.log(phase.name,JSON.stringify({physical:samples.at(-1).traffic.physical,distant:samples.at(-1).traffic.distant,promotions:samples.at(-1).traffic.promotions,demotions:samples.at(-1).traffic.demotions,maxDamage:Math.max(0,...samples.at(-1).physical.map(vehicle=>vehicle.damage))}));
  }

  const activeSamples=samples.filter(sample=>sample.traffic.physical>0),physicalStates=activeSamples.flatMap(sample=>sample.physical);
  const report={environment:'Installed Edge/WebGL2 controlled time at Low 720p. Three streamed districts, 270 seconds at night in heavy rain and 0.9 wetness; ordinary traffic inputs, Havok vehicles, collisions, promotion/demotion and rules. The player is parked seven metres beyond the road edge with the brake held.',phases,summary:{samples:samples.length,uniquePaths:paths.size,reasons:[...reasons],maxWait:Math.max(0,...maxWait.values()),maxTrafficDamage:Math.max(0,...physicalStates.map(vehicle=>vehicle.damage)),maxPlayerDamage:Math.max(...samples.map(sample=>sample.playerDamage)),groundedFraction:physicalStates.filter(vehicle=>vehicle.grounded&&vehicle.contacts>=3).length/physicalStates.length,minPhysical:Math.min(...activeSamples.map(sample=>sample.traffic.physical)),maxPhysical:Math.max(...activeSamples.map(sample=>sample.traffic.physical)),maxDecisionsPerStep:Math.max(...samples.map(sample=>sample.traffic.maxDecisionsPerStep)),maxRecoveries:Math.max(...samples.flatMap(sample=>sample.traffic.agents.map(agent=>agent.recoveries))),capturedCluster},samples,errors,warnings,failed,external};
  assert.ok(samples.every(sample=>sample.weather==='Rain'&&sample.time===22&&sample.wetness>=.9),'rain/night state must remain active');
  assert.ok(samples.every(sample=>sample.traffic.physical+sample.traffic.distant===24),'the full physical/distant population must remain present');
  assert.ok(report.summary.minPhysical>=6,'each district must retain a useful physical population');
  assert.ok(report.summary.uniquePaths>=10,'traffic must traverse a varied lane/connector set');
  assert.ok(report.summary.reasons.includes('signal')&&report.summary.reasons.includes('traffic'),'the stress run must exercise signals and following queues');
  assert.ok(report.summary.maxWait<=45,'no driver may starve indefinitely in a signal or traffic queue');
  assert.ok(report.summary.maxTrafficDamage<.03&&report.summary.maxPlayerDamage<.03,'wet traffic must avoid meaningful collision damage');
  assert.ok(report.summary.groundedFraction>=.98,'physical traffic must remain supported on the road network');
  assert.ok(report.summary.maxDecisionsPerStep<=2,'10Hz traffic decisions must remain staggered');
  assert.ok(report.summary.capturedCluster>=4,'the rendered evidence must target a populated moving cluster');
  assert.ok(samples.every(sample=>sample.streaming.failed===0&&sample.streaming.errors.length===0),'streaming must remain healthy');
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report.summary,null,2));
}catch(error){
  await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});
  await fs.writeFile(`${output}/failure.json`,JSON.stringify({error:String(error),samples,errors,warnings,failed,external},null,2));
  throw error;
}finally{
  await browser.close();
}
