import {Quaternion,Vector3} from '@babylonjs/core';
import type {VehicleDefinition} from '../core/types';
import {clamp} from '../core/math';

const ROAD_AXIS=new Vector3(0,Math.cos(Math.PI/2.5),Math.sin(Math.PI/2.5));
const FORMULA_AXIS=new Vector3(0,0,1);

/** Visual steering-wheel rotation only. Physical rack angle remains VehicleState.steer. */
export function updateSteeringVisual(d:VehicleDefinition,steer:number,target:Quaternion){
  const formula=d.class==='FORMULA',angle=clamp(steer*(formula?2.8:7.5),formula?-.95:-2.55,formula?.95:2.55);
  Quaternion.RotationAxisToRef(formula?FORMULA_AXIS:ROAD_AXIS,angle,target);return angle;
}
