import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
page.on('pageerror',e=>console.log('ERROR',String(e)));
await page.goto('http://127.0.0.1:5187/?renderer=webgl');
await page.waitForFunction(()=>window.kairos?.ui);
await page.evaluate(async vehicleClass=>{const g=window.kairos;g.advanceTime(0);g.raceConfig.vehicleClass=vehicleClass;g.raceConfig.entrants=1;g.raceConfig.position=1;await g.startRace();g.setAutopilot(true);},process.argv[2]??'GT');
const trace=[];
for(let i=0;i<150;i++){
  const s=await page.evaluate(async()=>{const g=window.kairos;g.advanceTime(1000);const {nearestRoad,CIRCUIT,pointAt}=await import('/src/content/world.ts');const v=g.player,n=nearestRoad(v.state.position.x,v.state.position.z,r=>r.id==='circuit');return {t:g.clock,speed:v.state.speed,yaw:v.state.yaw,pathYaw:n.point.yaw,lateral:n.lateral,progress:n.progress,steer:v.state.steer,input:g.lastInput,angular:v.body.getAngularVelocity().asArray(),ground:v.state.surface,wheels:v.state.wheels.map(w=>({load:w.load,slip:w.slip,omega:w.omega})),position:v.state.position};});
  trace.push(s);if(i<15||i%10===0)console.log(JSON.stringify(s));
}
console.log('GEOMETRY',await page.evaluate(()=>{const s=window.kairos.renderer.scene;return s.meshes.filter(m=>m.name.startsWith('pines')||m.name==='terrain-3,-6'||m.name==='roads-3,-6').map(m=>({name:m.name,enabled:m.isEnabled(),visible:m.isVisible,thin:m.thinInstanceCount,bounds:m.getBoundingInfo().boundingBox.centerWorld.asArray(),normal:m.getVerticesData('normal')?.slice(0,9)}));}));
await page.evaluate(async()=>{const g=window.kairos;await g.renderer.scene.whenReadyAsync();g.advanceTime(0);});
await fs.mkdir('output/diagnostics',{recursive:true});await fs.writeFile('output/diagnostics/driving-trace.json',JSON.stringify(trace,null,2));await page.screenshot({path:'output/diagnostics/driving.png'});await browser.close();
