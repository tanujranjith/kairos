import {AbstractEngine,DracoDecoder,KhronosTextureContainer2,MeshoptCompression} from '@babylonjs/core';
import * as KTX2DecoderModule from '@babylonjs/ktx2decoder';
import {LiteTranscoder_UASTC_ASTC,LiteTranscoder_UASTC_BC7,LiteTranscoder_UASTC_R8_UNORM,LiteTranscoder_UASTC_RG8_UNORM,LiteTranscoder_UASTC_RGBA_SRGB,LiteTranscoder_UASTC_RGBA_UNORM,MSCTranscoder,Transcoder,WASMMemoryManager,ZSTDDecoder} from '@babylonjs/ktx2decoder';
import glslangJs from '@babylonjs/core/assets/glslang/glslang.js?url';
import glslangWasm from '@babylonjs/core/assets/glslang/glslang.wasm?url';
import twgslJs from '@babylonjs/core/assets/twgsl/twgsl.js?url';
import twgslWasm from '@babylonjs/core/assets/twgsl/twgsl.wasm?url';
import dracoJs from '@babylonjs/core/assets/Draco/draco_wasm_wrapper_gltf.js?url';
import dracoWasm from '@babylonjs/core/assets/Draco/draco_decoder_gltf.wasm?url';
import dracoFallback from '@babylonjs/core/assets/Draco/draco_decoder_gltf.js?url';
import meshopt from '@babylonjs/core/assets/meshopt/meshopt_decoder.js?url';

const ktxAstc=new URL('../../node_modules/@babylonjs/ktx2decoder/wasm/uastc_astc.wasm',import.meta.url).href;
const ktxBc7=new URL('../../node_modules/@babylonjs/ktx2decoder/wasm/uastc_bc7.wasm',import.meta.url).href;
const ktxR8=new URL('../../node_modules/@babylonjs/ktx2decoder/wasm/uastc_r8_unorm.wasm',import.meta.url).href;
const ktxRg8=new URL('../../node_modules/@babylonjs/ktx2decoder/wasm/uastc_rg8_unorm.wasm',import.meta.url).href;
const ktxRgbaSrgb=new URL('../../node_modules/@babylonjs/ktx2decoder/wasm/uastc_rgba8_srgb_v2.wasm',import.meta.url).href;
const ktxRgbaUnorm=new URL('../../node_modules/@babylonjs/ktx2decoder/wasm/uastc_rgba8_unorm_v2.wasm',import.meta.url).href;
const ktxMscJs=new URL('../../node_modules/@babylonjs/ktx2decoder/wasm/msc_basis_transcoder.js',import.meta.url).href;
const ktxMscWasm=new URL('../../node_modules/@babylonjs/ktx2decoder/wasm/msc_basis_transcoder.wasm',import.meta.url).href;
const ktxZstd=new URL('../../node_modules/@babylonjs/ktx2decoder/wasm/zstddec.wasm',import.meta.url).href;

export const localShaderOptions={glslangOptions:{jsPath:glslangJs,wasmPath:glslangWasm},twgslOptions:{jsPath:twgslJs,wasmPath:twgslWasm}};
export function configureLocalResources(){
  DracoDecoder.DefaultConfiguration={wasmUrl:dracoJs,wasmBinaryUrl:dracoWasm,fallbackUrl:dracoFallback,numWorkers:2};
  MeshoptCompression.Configuration={decoder:{url:meshopt}};
  KhronosTextureContainer2.URLConfig={jsDecoderModule:'',wasmUASTCToASTC:ktxAstc,wasmUASTCToBC7:ktxBc7,wasmUASTCToRGBA_UNORM:ktxRgbaUnorm,wasmUASTCToRGBA_SRGB:ktxRgbaSrgb,wasmUASTCToR8_UNORM:ktxR8,wasmUASTCToRG8_UNORM:ktxRg8,jsMSCTranscoder:ktxMscJs,wasmMSCTranscoder:ktxMscWasm,wasmZSTDDecoder:ktxZstd};
}

/** Babylon's generic KTX loader normally fetches a global decoder script. The
 * ES-module decoder is pinned with the engine and initialized on the main
 * thread so every JS/WASM dependency remains a hashed same-origin asset. */
export function initializeLocalTextureDecoder(engine:AbstractEngine){
  Transcoder.WasmBaseUrl='';
  LiteTranscoder_UASTC_ASTC.WasmModuleURL=ktxAstc;LiteTranscoder_UASTC_BC7.WasmModuleURL=ktxBc7;
  LiteTranscoder_UASTC_R8_UNORM.WasmModuleURL=ktxR8;LiteTranscoder_UASTC_RG8_UNORM.WasmModuleURL=ktxRg8;
  LiteTranscoder_UASTC_RGBA_SRGB.WasmModuleURL=ktxRgbaSrgb;LiteTranscoder_UASTC_RGBA_UNORM.WasmModuleURL=ktxRgbaUnorm;
  MSCTranscoder.JSModuleURL=ktxMscJs;MSCTranscoder.WasmModuleURL=ktxMscWasm;MSCTranscoder.UseFromWorkerThread=false;
  ZSTDDecoder.WasmModuleURL=ktxZstd;WASMMemoryManager.LoadBinariesFromCurrentThread=true;
  KhronosTextureContainer2.DefaultNumWorkers=0;
  new KhronosTextureContainer2(engine,{numWorkers:0,binariesAndModulesContainer:{jsDecoderModule:KTX2DecoderModule}});
}
