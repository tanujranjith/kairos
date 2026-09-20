import type {PBRMaterial} from '@babylonjs/core';
/** glTF doesn't carry Babylon's lighting-intensity controls. Apply the same
 * restrained plastic/carbon response to generated and imported car trim. */
export function finishCarTrim(material:PBRMaterial){
  material.indexOfRefraction=1.25;material.environmentIntensity=.35;
  material.specularIntensity=.30;material.directIntensity=.75;
}
