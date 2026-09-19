import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=document-user-activation-required']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await fs.mkdir('output/audio',{recursive:true});
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');
  // Playwright's evaluate supplies userGesture:true. CDP must explicitly omit that
  // privilege to reproduce controller-only entry without accidentally unlocking sound.
  const cdp=await page.context().newCDPSession(page);
  const entry=await cdp.send('Runtime.evaluate',{expression:'(async()=>{for(let i=0;!window.kairos?.ui;i++){if(i>600)throw new Error("startup timeout");await new Promise(r=>setTimeout(r,100));}window.advanceTime(0);await window.kairos.startDrive(true);return {screen:window.kairos.screen,needsGesture:window.kairos.audio.needsGesture,activation:navigator.userActivation.hasBeenActive};})()',userGesture:false,awaitPromise:true,returnByValue:true});
  assert.equal(entry.result.value.activation,false,'Startup test must not grant synthetic user activation');
  assert.equal(entry.result.value.screen,'drive');
  assert.equal(entry.result.value.needsGesture,true,'Controller-style programmatic entry must not stall on blocked autoplay');
  await page.keyboard.press('KeyW');
  await page.waitForFunction(()=>window.kairos.audio.context.state==='running');
  const reports=await page.evaluate(async()=>{
    const {createDrivingAudioGraph}=await import('/src/core/audio-graph.ts');
    const {drivingMix}=await import('/src/core/audio-mix.ts');
    const {vehicleById}=await import('/src/content/vehicles.ts');
    const state=structuredClone(window.kairos.player.state);
    state.speed=30;state.rpm=4500;state.gear=3;state.wheels.forEach(w=>{w.contact=true;w.slip=.2;});
    const base=drivingMix(state,vehicleById('velara'),.7,{cockpit:false,rain:0,wetness:0,tunnel:0});
    const render=async(name,mix,volume=1,active=true,mutate)=>{
      const ctx=new OfflineAudioContext(1,72000,48000),graph=createDrivingAudioGraph(ctx);
      graph.update(mix,3,volume,active,0);mutate?.(graph,mix);
      const buffer=await ctx.startRendering(),data=buffer.getChannelData(0);
      const energy=(start=0,end=data.length)=>{let total=0;for(let i=start;i<end;i++)total+=data[i]*data[i];return Math.sqrt(total/(end-start));};
      let peak=0,finite=true;for(const sample of data){peak=Math.max(peak,Math.abs(sample));finite&&=Number.isFinite(sample);}
      const rms=energy(24000,48000),tailRms=energy(60000,72000);
      graph.dispose();return {name,rms,tailRms,peak,finite,samples:Array.from(data)};
    };
    const silent={...base,engineGain:0,whineGain:0,tireGain:0,roadGain:0,windGain:0,rainGain:0};
    const results=[];
    for(const [name,mix]of [['dry',base],['tunnel',{...base,tunnelGain:.38}],['cockpit',{...base,cabinCutoff:1800}],['rain',{...silent,rainGain:.12}],['transmission',{...silent,whineGain:.05}],['road',{...silent,roadGain:.2}],['wind',{...silent,windGain:.2}],['slip',{...silent,tireGain:.2}]])results.push(await render(name,mix));
    results.push(await render('muted',base,0),await render('paused',base,1,false));
    results.push(await render('pause-transition',base,1,true,(g,m)=>g.update(m,3,1,false,.7)));
    results.push(await render('shift', {...silent,engineGain:.3},1,true,(g,m)=>{g.update(m,4,1,true,.75);for(let t=.76;t<.85;t+=.01)g.update(m,4,1,true,t);}));
    results.push(await render('engine-only',{...silent,engineGain:.3}));
    return results;
  });
  const byName=Object.fromEntries(reports.map(r=>[r.name,r]));
  for(const name of ['dry','tunnel','cockpit','rain','transmission','road','wind','slip'])assert.ok(byName[name].rms>.0001,`${name} produces actual PCM output`);
  for(const report of reports){assert.ok(report.finite);assert.ok(report.peak<.98,`${report.name} does not clip`);}
  assert.equal(byName.muted.peak,0);assert.equal(byName.paused.peak,0);assert.ok(byName['pause-transition'].tailRms<.00001);
  const difference=(a,b,start=24000,end=48000)=>Math.sqrt(a.samples.slice(start,end).reduce((sum,v,i)=>sum+(v-b.samples[i+start])**2,0)/(end-start));
  assert.ok(difference(byName.dry,byName.tunnel)>.001,'Tunnel processing changes rendered PCM');
  assert.ok(difference(byName.dry,byName.cockpit)>.001,'Cockpit filtering changes rendered PCM');
  assert.ok(difference(byName.shift,byName['engine-only'],36000,40500)>.001,'Shift cut survives subsequent audio updates');
  const wav=Buffer.alloc(44+byName.tunnel.samples.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(48000,24);wav.writeUInt32LE(96000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);byName.tunnel.samples.forEach((v,i)=>wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));await fs.writeFile('output/audio/tunnel-sample.wav',wav);
  await page.evaluate(()=>window.advanceTime(1000));await page.screenshot({path:'output/audio/drive.png'});
  assert.deepEqual(errors,[]);
  await fs.writeFile('output/audio/report.json',JSON.stringify({checks:['blocked autoplay does not block driving','trusted keyboard input unlocks sound','eight audible PCM layers/scenes','finite unclipped PCM','muted and paused silence','pause transition settles','tunnel changes PCM','cockpit changes PCM','shift envelope survives render updates'],renders:reports.map(({samples,...r})=>r),errors,limitations:['Original synthesized timbres; PCM checks do not certify subjective realism or hardware output.']},null,2));
  console.log('Audio checks passed',reports.map(({samples,...r})=>r));
}finally{await browser.close();}
