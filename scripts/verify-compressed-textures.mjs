import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const output='output/compressed-textures';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const inspect=page=>page.evaluate(()=>window.kairos.renderer.scene.textures.filter(texture=>texture.metadata?.kairosCompressedSource).map(texture=>{const internal=texture.getInternalTexture();return {name:texture.name,url:texture.metadata.kairosCompressedSource,ready:texture.isReady(),fallback:texture.metadata.kairosFallback,reason:texture.metadata.fallbackReason??'',width:texture.getSize().width,height:texture.getSize().height,extension:internal?._extension??'',format:internal?.format??null,mipmaps:internal?.generateMipMaps??false};}));

async function run(renderer){
  const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[],warnings=[],failed=[],external=[],requests=[];
  page.setDefaultTimeout(90000);page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());else if(message.type()==='warning')warnings.push(message.text());});
  page.on('requestfailed',request=>failed.push({url:request.url(),error:request.failure()?.errorText??''}));page.on('request',request=>{const url=request.url();requests.push(url);if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1')external.push(url);});
  try{
    await page.goto(`http://127.0.0.1:5187/${renderer==='webgl'?'?renderer=webgl':''}`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.kairos?.ui&&!document.querySelector('#loading'));
    await page.evaluate(async()=>{const game=window.kairos;game.save.settings.automaticQuality=false;game.save.settings.quality='Low';game.save.settings.timeRate=0;game.save.settings.traffic=0;game.applySettings(true);await game.startDrive();await game.advanceTime(1000);await game.renderer.scene.whenReadyAsync();for(let i=0;i<3;i++)await game.advanceTime(0);});
    const textures=await inspect(page),state=await page.evaluate(()=>window.kairos.snapshot()),caps=await page.evaluate(()=>{const caps=window.kairos.renderer.engine.getCaps();return {astc:!!caps.astc,bptc:!!caps.bptc,s3tc:!!caps.s3tc,etc2:!!caps.etc2};});
    assert.ok(textures.length>=17,`expected at least 17 compressed textures, saw ${textures.length}`);assert.ok(textures.every(texture=>texture.ready));assert.ok(textures.every(texture=>!texture.fallback));assert.ok(textures.every(texture=>texture.extension==='.ktx2'));assert.ok(textures.every(texture=>texture.mipmaps));assert.equal(state.player.grounded,true);assert.equal(state.player.wheels.filter(wheel=>wheel.contact).length,4);
    const textureRequests=requests.filter(url=>new URL(url).pathname.endsWith('.ktx2'));assert.ok(textureRequests.length>0);assert.ok(textureRequests.every(url=>new URL(url).searchParams.has('v')));assert.ok(requests.some(url=>/uastc_|msc_basis_transcoder|zstddec/.test(url)));assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);assert.deepEqual(warnings.filter(message=>!message.includes('powerPreference option is currently ignored')),[]);
    await page.screenshot({path:`${output}/${renderer}-drive.png`});return {renderer:state.renderer,caps,textures,requestCount:requests.length,textureRequests:textureRequests.length,textureVersion:new URL(textureRequests[0]).searchParams.get('v'),decoderRequests:requests.filter(url=>/uastc_|msc_basis_transcoder|zstddec/.test(url)),errors,warnings,failed,external};
  }finally{await context.close();}
}

async function runFallback(){
  const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[],warnings=[],failed=[],external=[];
  let aborted=0;
  page.setDefaultTimeout(90000);await page.route('**/textures/surface/asphalt-albedo.ktx2*',route=>{aborted++;return route.abort('failed');});
  page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());else if(message.type()==='warning')warnings.push(message.text());});page.on('requestfailed',request=>failed.push({url:request.url(),error:request.failure()?.errorText??''}));page.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).hostname!=='127.0.0.1')external.push(request.url());});
  try{
    await page.goto('http://127.0.0.1:5187/?renderer=webgl',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.kairos?.ui&&!document.querySelector('#loading'));
    await page.evaluate(async()=>{const game=window.kairos;game.save.settings.automaticQuality=false;game.save.settings.quality='Low';game.save.settings.timeRate=0;game.save.settings.traffic=0;game.applySettings(true);await game.startDrive();await game.advanceTime(1000);await game.renderer.scene.whenReadyAsync();for(let i=0;i<3;i++)await game.advanceTime(0);});
    const textures=await inspect(page),asphalt=textures.find(texture=>texture.name==='original-asphalt-albedo'),state=await page.evaluate(()=>window.kairos.snapshot());
    const resourceErrors=errors.filter(message=>message==='Failed to load resource: net::ERR_FAILED');
    const unexpectedErrors=errors.filter(message=>message!=='Failed to load resource: net::ERR_FAILED');
    const unexpectedWarnings=warnings.filter(message=>!message.includes('Kairos texture fallback')&&!message.includes('powerPreference option is currently ignored'));
    assert.ok(asphalt);assert.equal(asphalt.fallback,true);assert.equal(asphalt.ready,true);assert.notEqual(asphalt.extension,'.ktx2');assert.match(asphalt.reason,/ERR_FAILED|Failed to load|Error/i);assert.equal(state.player.grounded,true);assert.equal(state.player.wheels.filter(wheel=>wheel.contact).length,4);assert.ok(warnings.some(message=>message.includes('Kairos texture fallback')));
    assert.ok(aborted>0,'expected at least one deliberately aborted asphalt texture request');assert.equal(failed.length,aborted);assert.ok(failed.every(request=>new URL(request.url).pathname==='/textures/surface/asphalt-albedo.ktx2'));assert.ok(failed.every(request=>request.error==='net::ERR_FAILED'));assert.equal(resourceErrors.length,failed.length);assert.deepEqual(unexpectedErrors,[]);assert.deepEqual(unexpectedWarnings,[]);assert.deepEqual(external,[]);
    await page.screenshot({path:`${output}/fallback-drive.png`});return {asphalt,state:{renderer:state.renderer,grounded:state.player.grounded,contacts:state.player.wheels.filter(wheel=>wheel.contact).length},aborted,failed,resourceErrors,unexpectedErrors,warnings,external};
  }finally{await context.close();}
}

try{const webgl=await run('webgl'),webgpu=await run('auto'),fallback=await runFallback();const report={environment:'Installed Edge development server. Native WebGL2 and automatic WebGPU use local KTX2/decoder assets; the fallback case deliberately aborts asphalt albedo and rebuilds its exact procedural pixels.',webgl,webgpu,fallback};await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log('Compressed texture verification passed',JSON.stringify({webgl:webgl.textures.length,webgpu:webgpu.textures.length,webglFormats:[...new Set(webgl.textures.map(texture=>texture.format))],webgpuFormats:[...new Set(webgpu.textures.map(texture=>texture.format))],fallback:fallback.asphalt}));}
finally{await browser.close();}
