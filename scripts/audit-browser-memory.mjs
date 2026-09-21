import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const run=promisify(execFile),MIB=1024*1024,BUDGET=1.5*1024*1024*1024;
const output=process.argv.find(value=>value.startsWith('--output='))?.slice(9)??'output/browser-memory';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],failed=[],external=[],scenes=[];
page.setDefaultTimeout(90000);
page.on('pageerror',error=>errors.push(String(error)));
page.on('response',response=>{if(response.status()>=400)failed.push({url:response.url(),status:response.status()});});
await page.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1'){external.push(url);return route.abort();}return route.continue();});
const cdp=await browser.newBrowserCDPSession();
const pageCdp=await page.context().newCDPSession(page);

const processMemory=async()=>{
  const {processInfo}=await cdp.send('SystemInfo.getProcessInfo');
  const processes=processInfo.map(process=>({id:Math.trunc(process.id),type:process.type,cpuTime:process.cpuTime})).filter(process=>process.id>0);
  const ids=[...new Set(processes.map(process=>process.id))];
  assert.ok(ids.length>0,'CDP returned no Edge process ids');
  const command=`Get-Process -Id @(${ids.join(',')}) -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,@{N='WorkingSetBytes';E={$_.WorkingSet64}},@{N='PrivateBytes';E={$_.PrivateMemorySize64}} | ConvertTo-Json -Compress`;
  let stdout='';try{stdout=(await run('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-Command',command],{windowsHide:true,maxBuffer:1024*1024})).stdout;}catch(error){if(typeof error?.stdout==='string'&&error.stdout.trim())stdout=error.stdout;else throw error;}
  const parsed=JSON.parse(stdout.trim()),rows=(Array.isArray(parsed)?parsed:[parsed]).map(row=>({id:Number(row.Id),name:String(row.ProcessName),workingSetBytes:Number(row.WorkingSetBytes),privateBytes:Number(row.PrivateBytes)}));
  const byId=new Map(processes.map(process=>[process.id,process]));
  const detailed=rows.map(row=>({...row,type:byId.get(row.id)?.type??'unknown'}));
  const workingSetBytes=detailed.reduce((sum,row)=>sum+row.workingSetBytes,0),privateBytes=detailed.reduce((sum,row)=>sum+row.privateBytes,0);
  return {budgetBytes:BUDGET,workingSetBytes,workingSetMiB:workingSetBytes/MIB,privateBytes,privateMiB:privateBytes/MIB,headroomMiB:(BUDGET-workingSetBytes)/MIB,processes:detailed.sort((a,b)=>b.workingSetBytes-a.workingSetBytes)};
};

const settle=()=>page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);await g.advanceTime(1500);});
const moveWithTraffic=({x,z,road})=>page.evaluate(async target=>{const g=window.kairos;g.teleport(target.x,target.z,target.road);await g.advanceTime(100);await g.action('setting',JSON.stringify({key:'traffic',value:12}));},{x,z,road});
const capture=async name=>{
  await settle();
  await pageCdp.send('HeapProfiler.collectGarbage');await new Promise(resolve=>setTimeout(resolve,250));
  const state=JSON.parse(await page.evaluate(()=>window.render_game_to_text())),memory=await processMemory();
  assert.equal(state.loading,false,`${name} remained behind a loading gate`);
  await page.screenshot({path:`${output}/${name}.png`});
  scenes.push({name,withinBudget:memory.workingSetBytes<=memory.budgetBytes,memory,state:{screen:state.screen,pausedFromDrive:state.pausedFromDrive,mode:state.mode,cells:state.cells,traffic:state.traffic.length,weather:state.weather,time:state.time}});
  console.log(`${name}: ${memory.workingSetMiB.toFixed(2)} MiB working set / ${memory.privateMiB.toFixed(2)} MiB private (${memory.headroomMiB.toFixed(2)} MiB headroom)`);
};

try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');
  await page.waitForFunction(()=>window.kairos?.ui);
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.automaticQuality=false;g.save.settings.quality='Low';g.save.settings.resolution=1;g.save.settings.timeRate=0;await g.startDrive();});
  await moveWithTraffic({x:-1340,z:-980,road:'city3'});await capture('city-traffic');assert.equal(scenes.at(-1).state.traffic,12);
  await moveWithTraffic({x:1130,z:320,road:'pass'});await capture('mountain-pass');
  await moveWithTraffic({x:340,z:-350,road:'crossway'});await capture('highway');
  await moveWithTraffic({x:-1340,z:-980,road:'city3'});await page.evaluate(()=>{const g=window.kairos;g.save.settings.time=22;g.save.settings.weather='Rain';g.wetness=.85;});await capture('wet-night');
  await page.evaluate(async()=>{const g=window.kairos;await g.action('home');g.save.settings.time=17.4;g.save.settings.weather='Clear';g.wetness=0;g.raceConfig.entrants=8;g.raceConfig.vehicleClass='GT';await g.startRace();});await capture('eight-car-race');
  await page.evaluate(()=>window.kairos.action('home'));await page.evaluate(()=>window.advanceTime(250));await capture('home-after-race');assert.equal(scenes.at(-1).state.pausedFromDrive,false,'Home must not advertise a destroyed drive as resumable');assert.equal(await page.locator('[data-action="resume"]').count(),0,'Home must not render Back to drive after ending a session');
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);
  const report={description:'Development Windows host, installed Edge/WebGL2, Low 1280x720. Each sample explicitly collects unreachable JavaScript allocations after the controlled-time region transition. CDP scopes this browser instance; Windows Get-Process sums its process working sets and private bytes. Summed working set is a conservative upper bound because shared pages may be counted in multiple processes. This is not target-laptop certification.',scenes,peakWorkingSetMiB:Math.max(...scenes.map(scene=>scene.memory.workingSetMiB)),peakPrivateMiB:Math.max(...scenes.map(scene=>scene.memory.privateMiB)),errors,failed,external};
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  console.log(`Peak browser working set: ${report.peakWorkingSetMiB.toFixed(2)} MiB`);
  assert.ok(scenes.every(scene=>scene.withinBudget),`Peak summed working set ${report.peakWorkingSetMiB.toFixed(2)} MiB exceeds 1.5 GiB`);
}finally{await pageCdp.detach().catch(()=>{});await cdp.detach().catch(()=>{});await browser.close();}
