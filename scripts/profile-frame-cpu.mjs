import {chromium} from 'playwright';
import fs from 'node:fs/promises';

const output=process.argv.find(value=>value.startsWith('--output='))?.slice(9)??'output/frame-cpu-profile';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:720}});
const page=await context.newPage(),errors=[],failed=[],external=[];
page.setDefaultTimeout(90000);
page.on('pageerror',error=>errors.push(String(error)));
page.on('response',response=>{if(response.status()>=400)failed.push({url:response.url(),status:response.status()});});
await page.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1'){external.push(url);return route.abort();}return route.continue();});

try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');
  await page.waitForFunction(()=>window.kairos?.ui);
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.automaticQuality=false;g.save.settings.quality='Low';g.save.settings.resolution=1;g.save.settings.timeRate=0;await g.startDrive();g.teleport(-1340,-980,'city3');await g.advanceTime(100);await g.action('setting',JSON.stringify({key:'traffic',value:12}));g.setAutopilot(true,'city3');await g.advanceTime(1500);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);await g.advanceTime(1500);});
  const session=await context.newCDPSession(page);
  await session.send('Profiler.enable');
  await session.send('Profiler.setSamplingInterval',{interval:100});
  await session.send('Profiler.start');
  await page.evaluate(()=>window.kairos.resumeRealTime());
  await page.waitForTimeout(8000);
  const {profile}=await session.send('Profiler.stop');
  await page.evaluate(()=>window.kairos.advanceTime(0));
  const state=await page.evaluate(()=>window.kairos.snapshot());
  const nodes=new Map(profile.nodes.map(node=>[node.id,node])),self=new Map();
  for(let i=0;i<(profile.samples?.length??0);i++){const id=profile.samples[i],micros=profile.timeDeltas?.[i]??0;self.set(id,(self.get(id)??0)+micros);}
  const top=[...self].map(([id,micros])=>{const node=nodes.get(id),frame=node?.callFrame;return {milliseconds:micros/1000,samples:node?.hitCount??0,function:frame?.functionName||'(anonymous)',url:frame?.url??'',line:(frame?.lineNumber??-1)+1};}).sort((a,b)=>b.milliseconds-a.milliseconds).slice(0,80);
  const report={description:'Eight seconds of real-time Low 1280x720 Westbrook driving with twelve physical traffic cars. CDP sampling interval 100us. Development RTX/Edge/WebGL2 only.',durationMs:(profile.endTime-profile.startTime)/1000,state:{cpuMs:state.cpuMs,physicsMs:state.physicsMs,simulationMs:state.simulationMs,aiMs:state.aiMs,frameTimeP95:state.frameTimeP95,speed:state.player.speed,contacts:state.player.wheels.filter(wheel=>wheel.contact).length,streaming:state.streaming},top,errors,failed,external};
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  await page.screenshot({path:`${output}/city.png`});
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
