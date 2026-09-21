import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root='public/textures',sha=data=>createHash('sha256').update(data).digest('hex'),magic=[0xab,0x4b,0x54,0x58,0x20,0x32,0x30,0xbb,0x0d,0x0a,0x1a,0x0a];
const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8')),generator=await fs.readFile(manifest.generator),builder=await fs.readFile(manifest.builder);
assert.equal(manifest.version,1);assert.equal(manifest.generatorSha256,sha(generator),'KTX2 source fields changed; run npm run build:textures');assert.equal(manifest.builderSha256,sha(builder),'KTX2 builder changed; run npm run build:textures');assert.equal(manifest.entries.length,19);
let total=0;
for(const entry of manifest.entries){
  if(entry.kind==='albedo')assert.equal(entry.encoding,'UASTC+Zstd',`${entry.file} must retain renderer-safe UASTC mip levels`);
  const data=await fs.readFile(path.join(root,entry.file));assert.deepEqual([...data.subarray(0,12)],magic,`${entry.file} is not KTX2`);assert.equal(data.readUInt32LE(20),entry.width,`${entry.file} width mismatch`);assert.equal(data.readUInt32LE(24),entry.height,`${entry.file} height mismatch`);assert.equal(data.byteLength,entry.bytes);assert.equal(sha(data),entry.sha256,`${entry.file} hash mismatch`);total+=data.byteLength;
}
async function filesBelow(directory,prefix=''){const files=[];for(const item of await fs.readdir(directory,{withFileTypes:true})){const relative=path.posix.join(prefix,item.name);if(item.isDirectory())files.push(...await filesBelow(path.join(directory,item.name),relative));else if(item.name.endsWith('.ktx2'))files.push(relative);}return files;}
assert.deepEqual((await filesBelow(root)).sort(),manifest.entries.map(entry=>entry.file).sort(),'Unexpected or missing KTX2 outputs');
const assetVersion=sha(manifest.entries.map(entry=>entry.sha256).join('\n')).slice(0,16),versionSource=await fs.readFile('src/render/texture-version.ts','utf8');
assert.equal(manifest.assetVersion,assetVersion,'KTX2 asset version is stale; run npm run build:textures');assert.match(versionSource,new RegExp(`TEXTURE_ASSET_VERSION='${assetVersion}'`),'runtime KTX2 version is stale; run npm run build:textures');
assert.equal(total,manifest.totalBytes);console.log(`Verified ${manifest.entries.length} KTX2 textures (${total} bytes, version ${assetVersion}).`);
