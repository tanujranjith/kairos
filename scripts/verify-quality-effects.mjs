import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'output/quality-effects';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),report={runs:[],errors:[],external:[],warnings:[]};
try{for(const renderer of ['webgl','auto']){
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());else if(m.type()==='warning')report.warnings.push(m.text());});
  await page.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1'){report.external.push(url);return route.abort();}return route.continue();});
  await page.goto(`http://127.0.0.1:5187/?renderer=${renderer}`);await page.waitForSelector('#loading',{state:'detached'});
  await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(0);g.save.settings.automaticQuality=false;g.save.settings.timeRate=0;g.save.settings.traffic=0;});
  const rows=[];
  for(const location of ['garage','wet-road']){
    if(location==='wet-road')await page.evaluate(async()=>{const g=window.kairos;await g.startDrive();g.teleport(-1340,-980,'city3');g.save.settings.weather='Rain';g.save.settings.time=17.4;g.wetness=.8;await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);});
    for(const quality of ['Low','High','Ultra','Low','Ultra','Low']){
      const row=await page.evaluate(async quality=>{
        const g=window.kairos;await g.action('setting',JSON.stringify({key:'quality',value:quality}));
        if(g.hasDrive){await g.world.loadAround(g.player.node.position,true);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);}
        for(let i=0;i<120;i++){await g.advanceTime(0);await new Promise(resolve=>requestAnimationFrame(resolve));if(i>=10&&g.renderer.scene.isReady(true)&&g.renderer.effects.snapshot().ready)break;}
        const s=g.renderer.scene;return {quality,renderer:g.renderer.rendererName,...g.renderer.effects.snapshot(),geometryBuffer:!!s.geometryBufferRenderer,transparentGeometry:s.geometryBufferRenderer?.renderTransparentMeshes??false,textures:s.textures.length,postProcesses:g.renderer.camera._postProcesses.filter(Boolean).map(p=>p.name),physics:structuredClone(g.player.state)};
      },quality);
      rows.push({location,...row});console.log(renderer,location,quality,row.ambientOcclusion,row.screenReflections,row.ready);
      await page.screenshot({path:`${output}/${renderer}-${location}-${rows.length}-${quality}.png`});
      assert.equal(row.ready,true);assert.equal(row.ambientOcclusion,quality==='High'||quality==='Ultra');assert.equal(row.screenReflections,quality==='Ultra'&&location!=='garage');assert.equal(row.geometryBuffer,quality==='High'||quality==='Ultra');assert.equal(row.transparentGeometry,false);assert.equal(new Set(row.postProcesses).size,row.postProcesses.length);
    }
    const lows=rows.filter(r=>r.location===location&&r.quality==='Low');assert.equal(lows.at(-1).textures,lows.at(-2).textures,'Preset cycling leaks textures');
  }
  report.runs.push({renderer,rows});await page.close();
}}finally{await browser.close();await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));}
assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);assert.deepEqual(report.warnings.filter(w=>!w.includes('powerPreference')),[]);console.log('Both renderers: optional effects, preset cycling, resource disposal and same-origin delivery pass.');
