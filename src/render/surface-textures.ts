import type {Scene} from '@babylonjs/core';
import {compressedTexture} from './compressed-texture';
import {periodicNoise, surfacePixels as generatedSurfacePixels} from './texture-fields.mjs';
import {textureAssetUrl} from './texture-version';

export type SurfaceKind='asphalt'|'meadow'|'gravel'|'concrete'|'stone'|'bark'|'water'|'cliff'|'boulder';
export const noise=periodicNoise;
/** Original, periodic material fields: no photo licensing or third-party runtime downloads. */
export function surfacePixels(kind:SurfaceKind,size=256){return generatedSurfacePixels(kind,size);}
export function surfaceTexture(scene:Scene,kind:SurfaceKind,variant:'albedo'|'normal',scale=1){
  const size=256;return compressedTexture(scene,textureAssetUrl(`/textures/surface/${kind}-${variant}.ktx2`),`original-${kind}-${variant}`,size,size,()=>surfacePixels(kind,size)[variant==='albedo'?'color':'normal'],variant==='albedo',scale);
}
export function surfaceTextures(scene:Scene,kind:SurfaceKind,scale=1){return {albedo:surfaceTexture(scene,kind,'albedo',scale),normal:surfaceTexture(scene,kind,'normal',scale)};}
