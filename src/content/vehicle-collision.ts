import type {VehicleDefinition,V3} from '../core/types';

export interface VehicleCollisionShape {kind:'box';center:V3;size:V3}

/** Shared chassis contract for Havok and exported GLB authoring metadata. */
export const vehicleCollisionShape=(definition:VehicleDefinition):VehicleCollisionShape=>({
  kind:'box',
  center:{x:0,y:.05,z:0},
  size:{x:definition.width*.86,y:.38,z:definition.length*.87},
});
