import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const option=name=>process.argv.find(v=>v.startsWith(`--${name}=`))?.slice(name.length+3),renderer=option('renderer')??'webgl',output=option('output')??'output/terrain-seams/live';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),report={errors:[],warnings:[],sites:[]};page.setDefaultTimeout(90000);
page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))report.warnings.push(m.text());});
const capture=async name=>{await page.evaluate(async()=>{const g=window.kairos;await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();for(let i=0;i<10;i++)await g.advanceTime(0);});await page.screenshot({path:`${output}/${name}.png`});};
const sites=[
  {name:'mountain',x:1033.66333,z:288,nx:0,nz:1,road:'pass',view:[1130,320]},
  {name:'lakeshore',x:-392.75082,z:30.47911,nx:0,nz:1,road:'lakeshore',view:[-380,100]},
  {name:'forest',x:133.88518,z:1229.92505,nx:.518,nz:.855,road:'forest',view:[100,1150]},
];
try{
  await page.goto(`http://127.0.0.1:5187/${renderer==='webgl'?'?renderer=webgl':''}`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
  report.renderer=await page.evaluate(()=>window.kairos.renderer.rendererName);assert.equal(report.renderer,renderer==='webgl'?'WebGL2':'WebGPU');
  await page.evaluate(async()=>{const g=window.kairos;g.save.settings.traffic=0;g.save.settings.timeRate=0;g.save.settings.time=16;g.save.settings.weather='Clear';g.wetness=0;await g.startDrive();});
  for(const site of sites){
    await page.evaluate(async site=>{const g=window.kairos;g.teleport(...site.view,site.road);await g.advanceTime(1000);await g.world.streamer.waitFor([...g.world.streamer.records.keys()]);},site);
    await capture(site.name);
    await page.evaluate(()=>window.kairos.world.backdrop.setEnabled(false));await capture(`${site.name}-no-backdrop`);await page.evaluate(()=>window.kairos.world.backdrop.setEnabled(true));
    const probes=await page.evaluate(async site=>{
      const {PhysicsRaycastResult,Vector3}=await import('/node_modules/@babylonjs/core/index.js'),{terrainHeight}=await import('/src/content/world.ts'),{contactForTriangle}=await import('/src/sim/contacts.ts');
      const g=window.kairos,pairs=[];g.world.ensure({x:site.x,y:terrainHeight(site.x,site.z),z:site.z});g.physics.step();
      for(const along of [-.5,-.1,0,.1,.5]){
        const hits=[];
        for(const offset of [-.02,.02]){
          const x=site.x+site.nx*offset+site.nz*along,z=site.z+site.nz*offset-site.nx*along,y=terrainHeight(x,z),hit=new PhysicsRaycastResult();
          g.physics.engine.raycastToRef(new Vector3(x,y+3,z),new Vector3(x,y-5,z),hit,{collideWith:1,ignoreBody:g.player.body});
          hits.push({x,z,hit:hit.hasHit,y:hit.hasHit?hit.hitPointWorld.y:null,normalY:hit.hasHit?hit.hitNormalWorld.y:null,material:hit.hasHit?contactForTriangle(hit.body?.transformNode.metadata,hit.triangleIndex):null});
        }
        pairs.push({along,hits,jump:hits.every(h=>h.hit)?Math.abs(hits[0].y-hits[1].y):null});
      }
      return pairs;
    },site);
    for(const pair of probes){assert.ok(pair.hits.every(h=>h.hit&&h.normalY>.1),site.name+' unsupported seam');assert.ok(pair.jump<.04,`${site.name} discontinuity ${pair.jump}`);}
    const initial=await page.evaluate(async site=>{
      const {PhysicsRaycastResult,Vector3}=await import('/node_modules/@babylonjs/core/index.js'),{terrainHeight}=await import('/src/content/world.ts');
      const g=window.kairos,x=site.x-site.nx*5,z=site.z-site.nz*5,y=terrainHeight(x,z),hit=new PhysicsRaycastResult(),yaw=Math.atan2(site.nx,site.nz);
      g.physics.engine.raycastToRef(new Vector3(x,y+3,z),new Vector3(x,y-5,z),hit,{collideWith:1,ignoreBody:g.player.body});if(!hit.hasHit)throw new Error('Missing off-road spawn');
      g.input.clear();g.player.reset({x,y:hit.hitPointWorld.y,z},yaw);await g.advanceTime(1500);
      const v=g.player,speed=7,d=v.definition,velocity=new Vector3(Math.sin(yaw)*speed,0,Math.cos(yaw)*speed);v.body.setLinearVelocity(velocity);v.state.speed=speed;v.state.velocity={x:velocity.x,y:0,z:velocity.z};v.state.gear=2;v.state.wheels.forEach(w=>w.omega=speed/d.wheelRadius);v.state.rpm=speed/d.wheelRadius*d.gears[1]*d.finalDrive*60/(2*Math.PI);return {yaw,state:structuredClone(v.state)};
    },site);
    const trace=[];
    for(let i=0;i<160;i++){
      if(i===24)await page.keyboard.down('ArrowDown');
      const row=await page.evaluate(async()=>{
        await window.advanceTime(50);const {PhysicsRaycastResult,Vector3}=await import('/node_modules/@babylonjs/core/index.js'),{contactForTriangle}=await import('/src/sim/contacts.ts');
        const g=window.kairos,s=g.player.state,lateral=s.velocity.x*Math.cos(s.yaw)-s.velocity.z*Math.sin(s.yaw),p=s.position,hit=new PhysicsRaycastResult();
        g.physics.engine.raycastToRef(new Vector3(p.x,p.y+1,p.z),new Vector3(p.x,p.y-5,p.z),hit,{collideWith:1,ignoreBody:g.player.body});
        return {state:structuredClone(s),groundBelow:hit.hasHit?{height:hit.hitPointWorld.y,clearance:p.y-hit.hitPointWorld.y,material:contactForTriangle(hit.body?.transformNode.metadata,hit.triangleIndex)}:null,magnitude:g.player.body.getLinearVelocity().length(),beta:Math.atan2(lateral,Math.max(.5,Math.abs(s.speed)))*180/Math.PI,message:g.snapshot().message};
      });trace.push(row);if(i>24&&row.magnitude<.5)break;
    }
    await page.keyboard.up('ArrowDown');await capture(`${site.name}-crossing`);
    const final=trace.at(-1),crossed=(final.state.position.x-site.x)*site.nx+(final.state.position.z-site.z)*site.nz,peakSlip=Math.max(...trace.filter(r=>r.state.speed>3).map(r=>Math.abs(r.beta)));
    let airborne=0,maxAirborne=0;for(const row of trace){airborne=row.state.grounded?0:airborne+.05;maxAirborne=Math.max(maxAirborne,airborne);}
    const result={site,probes,initial,final,crossed,peakSlip,maxAirborne,trace};report.sites.push(result);console.log(JSON.stringify({name:site.name,crossed,peakSlip,maxAirborne,damage:final.state.damage,probeMax:Math.max(...probes.map(p=>p.jump))}));
    assert.ok(crossed>0,site.name+' did not cross seam');assert.ok(peakSlip<12,site.name+' unstable');assert.equal(final.state.damage,0);assert.ok(final.magnitude<.6);
    assert.ok(trace.every(r=>r.groundBelow&&r.groundBelow.clearance>.1&&r.groundBelow.clearance<2.5&&r.message!=='Back on the road.'),site.name+' unsupported surface/fall/reset');
    assert.ok(maxAirborne<.5,site.name+' prolonged loss of tire contact');assert.ok(final.state.grounded&&final.state.wheels.every(w=>w.contact),site.name+' did not settle on four tires');
  }
  await page.evaluate(async()=>{await window.kairos.action('home');await window.advanceTime(0);});assert.equal(await page.evaluate(()=>window.kairos.world.cells.size),0);
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.warnings.filter(w=>!w.includes('The powerPreference option is currently ignored when calling requestAdapter() on Windows')),[]);
  report.scope='Real streamed terrain, Havok seam rays and three controlled initial 7m/s grass/road-edge traversals followed by normal keyboard braking/game stepping. Body-downward rays distinguish missing surfaces from bounded off-road hops; airborne duration is retained, not hidden. No pose correction after initial setup. Both normal and backdrop-hidden views are captured. Not all vehicle setups, all off-road routes, off-road comfort or runtime FPS.';
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
}catch(error){report.failure=String(error);await fs.writeFile(`${output}/failure.json`,JSON.stringify(report,null,2));await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}finally{await browser.close();}
