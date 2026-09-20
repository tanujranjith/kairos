import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'output/qualifying-grid';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),reports=[],errors=[];
page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));
const wait=()=>page.evaluate(async()=>{
  const g=window.kairos;await g.transitionPromise;
  // Keep physics frozen at the grid while new PBR effects compile. A single
  // controlled draw can capture wheels without the not-yet-ready body shader.
  for(let i=0;i<8;i++){await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();}
  await g.advanceTime(0);
});
async function setup(kind,vehicleClass,entrants,position){
  await page.evaluate(()=>window.kairos.action('home'));
  await page.click('[data-action="screen"][data-value="motorsport"]');
  for(const [key,value] of Object.entries({kind,vehicleClass,entrants,position,laps:3}))await page.selectOption(`[data-race="${key}"]`,String(value));
  await page.click('#start-race');await wait();
}
async function end(){await page.keyboard.press('Escape');await page.click('[data-action="end-session"]');}
async function next(){await page.click('[data-action="next-session"]');await wait();}
function seeded(entrants,position){const ids=Array.from({length:entrants-1},(_,i)=>`racer-${i+1}`);ids.splice(position-1,0,'player');return ids;}
async function grid(label,expected){
  const actual=await page.evaluate(async()=>{
    const g=window.kairos,{CIRCUIT,pointAt}=await import('/src/content/world.ts');
    const slots=Array.from({length:g.race.state.entrants.length},(_,i)=>pointAt(CIRCUIT,CIRCUIT.length-18-Math.floor(i/2)*14,(i%2===0?-1:1)*3));
    return {state:g.snapshot(),order:g.race.order().map(r=>r.id),setupPosition:g.raceConfig.position,
      cars:[g.player,...g.opponents.map(o=>o.vehicle)].map(v=>{
        const distances=slots.map(p=>Math.hypot(v.node.position.x-p.x,v.node.position.z-p.z)),slot=distances.indexOf(Math.min(...distances));
        return {id:v.id,slot,error:distances[slot],name:g.race.state.entrants.find(r=>r.id===v.id)?.name};
      }),pitAssignments:g.opponents.map(o=>({id:o.vehicle.id,box:o.pitDriver.snapshot().box}))};
  });
  reports.push({label,expected,actual});await fs.writeFile(`${output}/report.json`,JSON.stringify({note:'Synthetic qualifying times test session/grid identity, not lap timing or physical race reliability. Grid positions are read from actual Havok chassis nodes before stepping.',errors,reports},null,2));
  await page.screenshot({path:`${output}/${label}.png`});
  assert.equal(actual.state.loading,false);assert.equal(actual.state.loadError,'');
  assert.deepEqual(actual.cars.toSorted((a,b)=>a.slot-b.slot).map(v=>v.id),expected,`${label}: actual physical starting grid`);
  assert.ok(actual.cars.every(v=>v.error<.01),`${label}: spawn not on grid mark`);
  assert.deepEqual(actual.state.race.grid,expected,`${label}: snapshot grid`);
  if(actual.state.race.phase==='countdown'){
    assert.deepEqual(actual.order,expected);assert.match(await page.locator('.race-position b').first().textContent(),new RegExp(`^P${expected.indexOf('player')+1}\\b`));
  }
  console.log(label,'physical grid verified',expected.join(', '));return actual;
}
try{
  await fs.mkdir(output,{recursive:true});await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  for(const [vehicleClass,entrants]of [['GT',8],['FORMULA',16]]){
    const initial=seeded(entrants,4),earned=[...initial].reverse();
    await setup('Race Weekend',vehicleClass,entrants,4);
    await page.evaluate(()=>{window.kairos.race.player.best=80;});await end();await next();
    const qualifying=await grid(`${vehicleClass}-qualifying-start`,initial);
    const identity=await page.evaluate(()=>window.kairos.race.state.entrants.map(r=>({id:r.id,name:r.name})));
    await page.evaluate(ids=>{const g=window.kairos;ids.forEach((id,i)=>g.race.state.entrants.find(r=>r.id===id).best=100+i);},earned);
    await end();assert.deepEqual(await page.locator('.result-row:not(.table-heading) > span:first-of-type').allTextContents(),earned.map(id=>identity.find(r=>r.id===id).name));
    const layout=await page.evaluate(()=>{
      const bounds=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom};};
      return {heading:bounds('.results-layout > .eyebrow'),action:bounds('[data-action="next-session"]'),table:bounds('.results-table'),height:innerHeight,scroll:document.querySelector('.results-layout').scrollTop};
    });
    assert.equal(layout.scroll,0);assert.ok(layout.heading.top>=0&&layout.action.bottom<=layout.height);assert.ok(layout.table.bottom<=layout.action.top);
    await page.screenshot({path:`${output}/${vehicleClass}-qualifying-results.png`});
    if(entrants===16){
      // Reach and activate paging using real keyboard events, not scrollTop writes.
      for(let i=0;i<32&&!await page.locator('[data-results-scroll="1"]').evaluate(el=>el===document.activeElement);i++)await page.keyboard.press('ArrowDown');
      assert.equal(await page.locator('[data-results-scroll="1"]').evaluate(el=>el===document.activeElement),true);
      await page.keyboard.press('Enter');await page.keyboard.press('Enter');
      assert.ok(await page.locator('.results-table').evaluate(el=>el.scrollTop>0));
      await page.screenshot({path:`${output}/FORMULA-results-bottom.png`});
      await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');await page.keyboard.press('Enter');
      assert.equal(await page.locator('.results-table').evaluate(el=>el.scrollTop),0);
    }
    await next();
    const race=await grid(`${vehicleClass}-earned-grid`,earned);assert.equal(race.setupPosition,4);
    assert.deepEqual(race.cars.map(v=>({id:v.id,name:v.name})),identity);
    assert.deepEqual(race.pitAssignments,qualifying.pitAssignments);
    assert.equal(race.state.race.session.position,earned.indexOf('player')+1);
    await end();await page.click('[data-action="retry-race"]');await wait();
    const restarted=await grid(`${vehicleClass}-fresh-weekend`,initial);assert.equal(restarted.state.race.phase,'practice');
  }
  for(const noTimes of [false,true]){
    await setup('Race Weekend','GT',8,4);await end();await next();
    if(!noTimes)await page.evaluate(()=>{const r=window.kairos.race;r.player.best=100;r.state.entrants[2].best=100;r.state.entrants[5].best=95;r.player.valid=false;});
    await end();await next();await grid(noTimes?'no-times':'tied-times',noTimes?seeded(8,4):['racer-5','racer-2','player','racer-1','racer-3','racer-4','racer-6','racer-7']);
  }
  const earned=seeded(8,4).reverse();
  await setup('Race Weekend','GT',8,4);await end();await next();
  await page.evaluate(ids=>{ids.forEach((id,i)=>window.kairos.race.state.entrants.find(r=>r.id===id).best=100+i);},earned);await end();
  await page.evaluate(()=>{const w=window.kairos.world,prepare=w.prepare;w.prepare=async function(...args){w.prepare=prepare;throw new Error('Injected grid world-load failure');};});
  await next();assert.match(await page.locator('#world-loading').innerText(),/Injected grid world-load failure/);
  const failed=await page.evaluate(()=>window.kairos.snapshot());assert.equal(failed.loading,true);assert.equal(failed.race.elapsed,0);assert.deepEqual(failed.race.grid,earned);
  await page.screenshot({path:`${output}/load-failure.png`});
  // Changing the setup form's backing preferences must not rewrite a pending
  // session request. This is deliberate test-only state injection.
  await page.evaluate(()=>Object.assign(window.kairos.raceConfig,{kind:'Quick Race',entrants:4,position:1,vehicleClass:'FORMULA',laps:20}));
  await page.click('#world-retry');await wait();const recovered=await grid('retried-earned-grid',earned);
  assert.equal(recovered.state.race.session.kind,'Race Weekend');assert.equal(recovered.state.race.session.vehicleClass,'GT');assert.equal(recovered.state.race.session.laps,3);
  assert.match(await page.locator('.race-position > span').textContent(),/LAP 1 \/ 3/);
  // A repeated Continue action during countdown cannot advance/reset the race.
  await page.evaluate(()=>window.kairos.action('next-session'));await grid('duplicate-continue-ignored',earned);
  await setup('Quick Race','GT',4,4);await grid('resized-quick-race',seeded(4,4));
  await end();assert.equal(await page.locator('[data-action="next-session"]').count(),0);
  await setup('Qualifying','FORMULA',4,2);await end();assert.equal(await page.locator('[data-action="next-session"]').count(),0);
  assert.deepEqual(errors,[]);console.log('Qualifying order, identity, ties/no-times, restart, load retry, duplicate action, resized Quick Race and standalone results passed');
}catch(error){await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}
finally{await browser.close();}
