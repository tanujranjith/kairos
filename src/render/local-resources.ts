import { DracoDecoder, MeshoptCompression } from '@babylonjs/core';
import glslangJs from '@babylonjs/core/assets/glslang/glslang.js?url';
import glslangWasm from '@babylonjs/core/assets/glslang/glslang.wasm?url';
import twgslJs from '@babylonjs/core/assets/twgsl/twgsl.js?url';
import twgslWasm from '@babylonjs/core/assets/twgsl/twgsl.wasm?url';
import dracoJs from '@babylonjs/core/assets/Draco/draco_wasm_wrapper_gltf.js?url';
import dracoWasm from '@babylonjs/core/assets/Draco/draco_decoder_gltf.wasm?url';
import dracoFallback from '@babylonjs/core/assets/Draco/draco_decoder_gltf.js?url';
import meshopt from '@babylonjs/core/assets/meshopt/meshopt_decoder.js?url';

export const localShaderOptions={glslangOptions:{jsPath:glslangJs,wasmPath:glslangWasm},twgslOptions:{jsPath:twgslJs,wasmPath:twgslWasm}};
export function configureLocalResources(){
  DracoDecoder.DefaultConfiguration={wasmUrl:dracoJs,wasmBinaryUrl:dracoWasm,fallbackUrl:dracoFallback,numWorkers:2};
  MeshoptCompression.Configuration={decoder:{url:meshopt}};
}
