import type {V3} from '../core/types';
const dot=(a:V3,b:V3)=>a.x*b.x+a.y*b.y+a.z*b.z;
/** Rate of the suspension ray's intersection with the surface. Tangential road
 * travel must not pump the damper when the chassis pitches/rolls. */
export const compressionSpeed=(contactVelocity:V3,surfaceNormal:V3,suspensionUp:V3)=>
  -dot(contactVelocity,surfaceNormal)/Math.max(.25,dot(suspensionUp,surfaceNormal));
