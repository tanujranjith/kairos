import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const output=process.argv.find(v=>v.startsWith('--output='))?.slice(9)??'output/surfaces/roads';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],cases=[];
page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));
try{
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);
  for(const id of ['velara','gtx'])for(const side of [-1,1])for(const kind of ['bridge','exit','entry','brake']){
    const scenario={id,road:kind==='bridge'?'northbridge':'lakeshore',s:kind==='bridge'?650:1700,offset:side*(kind==='bridge'?5.15:kind==='exit'?2.5:kind==='entry'?8:4.5),heading:side*(kind==='exit'?.22:kind==='entry'?-.28:0),mph:kind==='bridge'?10:kind==='exit'?40:kind==='entry'?20:70};
    const initial=await page.evaluate(async scenario=>{const m=await import('/src/tools/surface-validation.ts');return m.prepareRoadSurfaceScenario(window.kairos,scenario);},scenario);
    const trace=[];let braking=false;
    for(let step=0;step<240;step++){
      const time=step*.05,brakeAt=kind==='brake'?0:kind==='bridge'?2:kind==='exit'?1.5:2;
      if(!braking&&time>=brakeAt){await page.keyboard.down('ArrowDown');braking=true;}
      const row=await page.evaluate(async road=>{const m=await import('/src/tools/surface-validation.ts');await window.advanceTime(50);return m.roadSurfaceTelemetry(window.kairos,road);},scenario.road);
      trace.push({time:time+.05,...row});
      if(braking&&row.magnitude<.5)break;
    }
    await page.keyboard.up('ArrowDown');
    for(let n=0;n<8;n++)await page.evaluate(()=>window.advanceTime(0));
    const name=`${id}-${side===1?'right':'left'}-${kind}`;
    await page.screenshot({path:`${output}/${name}.png`});
    const final=trace.at(-1),surfaces=[...new Set(trace.flatMap(r=>r.surfaces))];
    const row={name,scenario,initial,final,surfaces,minContacts:Math.min(...trace.map(r=>r.contacts)),minRoadClearance:Math.min(...trace.map(r=>r.roadClearance)),peakSideslip:Math.max(...trace.filter(r=>r.speed>3).map(r=>Math.abs(r.beta))),trace};cases.push(row);
    await fs.writeFile(`${output}/report.json`,JSON.stringify({environment:'Real authored road geometry and normal 120Hz game/streaming/recovery; controlled initial speed/position, then browser keyboard brake. Not wall-clock performance.',errors,cases},null,2));
    console.log(JSON.stringify({...row,trace:undefined}));
    assert.equal(final.damage,0,name+' damage');assert.ok(row.peakSideslip<12,name+' unstable');
    assert.ok(row.minRoadClearance>-.5,name+' fell below surface');assert.ok(final.magnitude<.6,name+' did not stop');
    assert.ok(!trace.some(r=>r.message==='Back on the road.'),name+' auto-recovered');
    assert.ok(surfaces.includes(kind==='bridge'?'Concrete':'Gravel'),name+' missed shoulder');
    if(kind==='exit'||kind==='entry')assert.ok(surfaces.includes('Grass')&&surfaces.includes('Asphalt'),name+' incomplete transition');
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
