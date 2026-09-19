import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}});await fs.mkdir('output/gallery-directions',{recursive:true});
try{await page.goto('http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui,null,{timeout:90000});await page.evaluate(()=>window.advanceTime(0));
  for(let angle=0;angle<6;angle++){await page.evaluate(async angle=>{const g=window.kairos;await g.renderer.scene.whenReadyAsync();g.renderer.scene.getTextureByName('CC0 Fish Eagle Hill / Greg Zaal').rotationY=angle;g.renderer.scene.getTextureByName('gallery-skybox-map').rotationY=angle;g.cameraClock+=3;g.setScreen('garage');for(let i=0;i<10;i++)await g.advanceTime(0);await g.renderer.scene.whenReadyAsync();await g.advanceTime(0);},angle);await page.screenshot({path:`output/gallery-directions/angle-${angle}.png`});}
}finally{await browser.close();}
