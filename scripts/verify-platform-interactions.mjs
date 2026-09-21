import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const output=process.argv.find(v=>v.startsWith('--output='))?.slice(9)??'output/platform-interactions';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],warnings=[],external=[],checks=[];
page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))warnings.push(m.text());});
page.on('request',r=>{if(!/^(http:\/\/127\.0\.0\.1:5187|data:|blob:)/.test(r.url()))external.push(r.url());});
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForSelector('#loading',{state:'detached'});
  await page.evaluate(()=>{window.fullscreenTransitions=[];document.addEventListener('fullscreenchange',()=>window.fullscreenTransitions.push(document.fullscreenElement?.tagName??null));});
  assert.equal(await page.evaluate(()=>document.fullscreenEnabled),true);await page.keyboard.press('KeyF');await page.waitForFunction(()=>document.fullscreenElement!==null);
  const fullscreen=await page.evaluate(()=>{const g=window.kairos,rect=document.querySelector('#game').getBoundingClientRect();return {element:document.fullscreenElement?.tagName,rect:{width:rect.width,height:rect.height},graphics:g.snapshot().graphics};});
  assert.equal(fullscreen.element,'HTML');assert.ok(fullscreen.rect.width>0&&fullscreen.rect.height>0);assert.ok(fullscreen.graphics.width>0&&fullscreen.graphics.height>0);await page.screenshot({path:`${output}/fullscreen.png`});
  await page.keyboard.press('KeyF');await page.waitForFunction(()=>document.fullscreenElement===null);await page.waitForFunction(()=>window.fullscreenTransitions.length===2);assert.deepEqual(await page.evaluate(()=>window.fullscreenTransitions),['HTML',null]);checks.push('F enters/exits real browser fullscreen and retains a sized gameplay canvas');
  await page.click('#start-drive');await page.evaluate(()=>window.advanceTime(1000));
  const rumble=await page.evaluate(async()=>{
    const g=window.kairos;window.rumbleCalls=[];window.rejectRumble=false;window.virtualPadConnected=true;
    const actuator={type:'dual-rumble',playEffect:(effect,options)=>{window.rumbleCalls.push({effect,options});return window.rejectRumble?Promise.reject(new Error('simulated actuator rejection')):Promise.resolve('complete');}};
    Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>window.virtualPadConnected?[{connected:true,index:0,id:'virtual-rumble-pad',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0,touched:false})),vibrationActuator:actuator}]:[]});
    g.player.state.damage+=.12;await g.advanceTime(0);g.input.rumble(4);await Promise.resolve();window.rejectRumble=true;g.input.rumble(.4);await Promise.resolve();await Promise.resolve();return structuredClone(window.rumbleCalls);
  });
  assert.equal(rumble.length,3);assert.deepEqual(rumble[0],{effect:'dual-rumble',options:{duration:120,strongMagnitude:.96,weakMagnitude:.48}});assert.equal(rumble[1].options.strongMagnitude,1);assert.equal(rumble[1].options.weakMagnitude,1);checks.push('damage feedback reaches dual-rumble, clamps magnitudes and swallows an unavailable-actuator rejection');
  const disconnected=await page.evaluate(async()=>{const g=window.kairos;g.input.keys.add('ArrowUp');window.virtualPadConnected=false;window.dispatchEvent(new Event('gamepaddisconnected'));const before=g.clock;await g.advanceTime(1000);return {screen:g.screen,pausedFromDrive:g.pausedFromDrive,message:g.message,keys:g.input.keys.size,before,after:g.clock};});
  assert.equal(disconnected.screen,'pause');assert.equal(disconnected.pausedFromDrive,true);assert.match(disconnected.message,/Controller disconnected/);assert.equal(disconnected.keys,0);assert.equal(disconnected.after,disconnected.before);await page.screenshot({path:`${output}/controller-disconnected.png`});checks.push('disconnect clears held input, pauses driving, explains recovery and freezes the simulation clock');
  await page.click('[data-action="resume"]');assert.equal(await page.evaluate(()=>window.kairos.screen),'drive');await page.screenshot({path:`${output}/resumed.png`});checks.push('keyboard resume remains available after controller loss');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(warnings.filter(w=>!w.includes('The powerPreference option is currently ignored when calling requestAdapter() on Windows')),[]);
  const report={checks,fullscreen,rumble,disconnected,errors,warnings,external,scope:'Installed Edge/WebGL2 development build with a synthetic standards-shaped vibration actuator; real Fullscreen API. Physical gamepad motor strength and OS overlays remain hardware-dependent.'};await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({checks,fullscreen:{element:fullscreen.element,rect:fullscreen.rect,render:[fullscreen.graphics.width,fullscreen.graphics.height]},rumble,disconnected,errors},null,2));
}catch(error){await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}finally{await browser.close();}
