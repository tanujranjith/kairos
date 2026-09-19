import type { Quality, V3 } from '../core/types';

/** Hysteresis prevents detail chatter when a following car sits on a threshold. */
export function carDetail(current:0|1,distance:number,quality:Quality):0|1 {
  const far={Low:18,Medium:60,High:80,Ultra:110}[quality];
  return current===0 ? distance>far?1:0 : distance<far*.8?0:1;
}

export const reflectionProfile=(quality:Quality)=>({
  size:quality==='High'||quality==='Ultra'?256:128,
  interval:quality==='Low'?2:quality==='Medium'?1.25:.75,
  meshes:quality==='Low'?16:quality==='Medium'?32:48,
  triangles:quality==='Low'?16000:quality==='Medium'?40000:70000,
});

export interface ReflectionSample {position:V3;garage:boolean;stamp:string;clock:number}
export function needsReflection(previous:ReflectionSample|undefined,next:ReflectionSample,quality:Quality) {
  if(!previous||previous.garage!==next.garage)return true;
  const distance=Math.hypot(next.position.x-previous.position.x,next.position.y-previous.position.y,next.position.z-previous.position.z);
  if(distance>128)return true; // Never reuse another district's reflection after reset/teleport.
  const elapsed=next.clock-previous.clock;
  if(elapsed<reflectionProfile(quality).interval)return false;
  return next.stamp!==previous.stamp||(!next.garage&&(distance>12||elapsed>12));
}
