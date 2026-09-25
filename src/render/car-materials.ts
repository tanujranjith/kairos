import type {PBRMaterial} from '@babylonjs/core';
/** Pigmented base coat under a smooth dielectric clear coat, not bare polished
 * metal. Apply runtime-only intensities equally to authored and imported cars. */
export function finishCarPaint(material:PBRMaterial){
  material.metallic=.24;material.roughness=.34;
  material.clearCoat.isEnabled=true;material.clearCoat.intensity=1;material.clearCoat.roughness=.20;
  material.environmentIntensity=.75;material.indexOfRefraction=1.5;
}
/** glTF doesn't carry Babylon's lighting-intensity controls. Apply the same
 * restrained plastic/carbon response to generated and imported car trim. */
export function finishCarTrim(material:PBRMaterial){
  material.indexOfRefraction=1.25;material.environmentIntensity=.35;
  material.specularIntensity=.30;material.directIntensity=.75;
}
/** A thin clear cover, not a second silver reflector. glTF omits these
 * intensity controls, so apply them to imports and procedural fallback alike. */
export function finishCarLens(material:PBRMaterial){
  material.albedoColor.set(.012,.019,.024);
  material.alpha=.12;material.metallic=0;material.roughness=.18;
  material.environmentIntensity=.18;material.specularIntensity=.20;
  material.useRadianceOverAlpha=false;material.useSpecularOverAlpha=false;
  material.clearCoat.isEnabled=false;material.indexOfRefraction=1.49;
}
