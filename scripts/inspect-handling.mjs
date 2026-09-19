import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await fs.mkdir('output/handling-visuals',{recursive:true});
try {
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui,null,{timeout:60000});
  await page.evaluate(()=>window.advanceTime(0));await page.click('#start-handling');
  await page.evaluate(async()=>{
    const g=window.kairos;for(let x=-1950;x<-1000;x+=180)for(const z of [1750,1930])g.world.ensure({x,y:18,z});
    await g.advanceTime(1000);await g.renderer.scene.whenReadyAsync();g.advanceTime(0);
  });
  await page.screenshot({path:'output/handling-visuals/drive.png'});
  for(const [name,position,target]of [
    ['overview',[-1710,350,2160],[-1560,18,1840]],
    ['bank',[-1910,24,1764],[-1830,20,1752]],
    ['bumps',[-1874,21,1798],[-1845,18,1790]],
    ['slope',[-1750,30,1880],[-1640,25,1825]],
    ['skidpad',[-1170,90,1950],[-1140,18,1845]],
  ]){
    await page.evaluate(({position,target})=>{const g=window.kairos;g.renderer.camera.position.set(...position);g.renderer.camera.setTarget(g.renderer.camera.position.clone().set(...target));g.renderer.render();},{position,target});
    await page.screenshot({path:`output/handling-visuals/${name}.png`});
  }
  await fs.writeFile('output/handling-visuals/report.json',JSON.stringify({errors,note:'Drive view uses the gameplay camera; other views are explicitly positioned inspection cameras.'},null,2));
  if(errors.length)throw new Error(errors.join('\n'));
} finally {await browser.close();}
