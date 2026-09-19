import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage();
try{
  await page.goto(process.env.KAIROS_URL??'http://127.0.0.1:5187/?renderer=webgl');await page.waitForFunction(()=>window.kairos?.ui,null,{timeout:90000});await page.evaluate(()=>window.advanceTime(0));
  const bytes=await page.evaluate(async()=>{const {exportGalleryEnvironment}=await import('/src/tools/export-environment.ts');return exportGalleryEnvironment();});
  await fs.mkdir('public/environment',{recursive:true});await fs.writeFile('public/environment/fish-eagle-hill.env',Buffer.from(bytes));console.log('Prefiltered same-origin gallery environment:',bytes.length,'bytes');
}finally{await browser.close();}
