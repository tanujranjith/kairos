import {Color3,type PBRMaterial} from '@babylonjs/core';

/** Shared opaque glazing for streamed architecture. The shell behind each
 * pane substitutes for an interior, so restrained dielectric reflections read
 * more naturally than a metallic mirror. The raster bias is visual only: it
 * prevents the shell and its recessed pane from sharing a distant depth step. */
export function configureArchitecturalGlass(material:PBRMaterial){
  material.albedoColor=Color3.FromHexString('#2d4149').toLinearSpace();
  material.metallic=0;material.roughness=.27;material.environmentIntensity=.62;
  material.clearCoat.isEnabled=true;material.clearCoat.intensity=.48;material.clearCoat.roughness=.18;
  material.zOffset=-6;material.zOffsetUnits=-6;
}
