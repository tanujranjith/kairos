// Original mesh authoring lives in src/render/car.ts. Rebuild exports through Vite.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();
await page.goto(process.env.KAIROS_URL??'http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui);await page.evaluate(()=>window.advanceTime(0));
await fs.mkdir('public/models',{recursive:true});const inventory=[],files=[];
for(const id of ['aeris','velara','crest','nova','gtx','apex'])for(const lod of [0,1]){
  const bytes=await page.evaluate(async({id,lod})=>{
    const {exportVehicle}=await import('/src/tools/export-assets.ts');return exportVehicle(id,lod);
  },{id,lod});
  const file=`${id}-lod${lod}.glb`;files.push({file,bytes});inventory.push({id,lod,file,bytes:bytes.length});console.log(file,bytes.length);
}
await browser.close();for(const {file,bytes}of files)await fs.writeFile(`public/models/${file}`,Buffer.from(bytes));await fs.writeFile('public/models/manifest.json',JSON.stringify({version:3,license:'Original Kairos content',features:['named wheel pivots','camera mounts','animated steering pivot','layered wheel openings','authored exterior panel detail'],models:inventory},null,2));
