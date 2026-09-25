import {ShaderStore} from '@babylonjs/core/Engines/shaderStore';
import {geometryPixelShaderWGSL} from '@babylonjs/core/ShadersWGSL/geometry.fragment';

/** Babylon 9.27.1's gamma-albedo geometry pass calls the vec4 helper with a
 * vec3. Keep the narrowly scoped correction in our bundle, not node_modules.
 * Safe to remove when the pinned upstream shader contains the vec3 call. */
export function correctGeometryShader(source:string){return source.replace('color=toLinearSpaceVec4(color);','color=toLinearSpaceVec3(color);');}
export function configureGeometryShader(){
  ShaderStore.ShadersStoreWGSL[geometryPixelShaderWGSL.name]=correctGeometryShader(geometryPixelShaderWGSL.shader);
}
