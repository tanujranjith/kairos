import fs from 'node:fs/promises';
await fs.mkdir('public/licenses',{recursive:true});
for(const [source,target]of [
  ['node_modules/@babylonjs/core/license.md','Babylon-Apache-2.0.md'],
  ['node_modules/@babylonjs/core/NOTICE.md','Babylon-NOTICE.md'],
  ['node_modules/@babylonjs/havok/LICENSE','Havok-MIT.txt'],
  ['node_modules/@babylonjs/core/assets/Draco/draco.license','Draco.txt'],
  ['node_modules/@babylonjs/core/assets/meshopt/meshopt.license','meshoptimizer-MIT.txt'],
  ['node_modules/@babylonjs/ktx2decoder/license.md','Babylon-KTX2-Apache-2.0.md'],
  ['node_modules/@babylonjs/ktx2decoder/NOTICE.md','Babylon-KTX2-NOTICE.md'],
  ['node_modules/ktx2-encoder/LICENSE','ktx2-encoder-MIT.txt'],
  ['node_modules/ktx2-encoder/THIRD_PARTY_NOTICES.md','ktx2-encoder-NOTICE.md'],
])await fs.copyFile(source,`public/licenses/${target}`);
console.log('Runtime license texts copied to public/licenses.');
