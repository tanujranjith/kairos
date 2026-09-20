import type {ContactSurface,ContactRange,SurfaceKind,WheelState} from '../core/types';

export const SURFACE_GRIP:Record<SurfaceKind,number>={Asphalt:1,Grass:.46,Gravel:.60,Concrete:.85,Water:.25};
/** Digital steering follows the weakest current contact; analog range is untouched. */
export const steeringContactGrip=(wheels:readonly Pick<WheelState,'contact'|'surface'>[])=>Math.min(1,...wheels.filter(w=>w.contact&&w.surface&&w.surface!=='Air').map(w=>SURFACE_GRIP[w.surface as SurfaceKind]));
export interface ContactMetadata {contactSurface?:ContactSurface;contactRanges?:ContactRange[]}
const unclassified:ContactSurface={surface:'Concrete',layer:'structure'};
/** Triangle ranges preserve road identity even when an entire cell shares one draw/collider. */
export function contactForTriangle(metadata:ContactMetadata|null|undefined,triangle:number):ContactSurface{
  const ranges=metadata?.contactRanges;
  if(ranges&&triangle>=0){let lo=0,hi=ranges.length;while(lo<hi){const mid=(lo+hi)>>1;if(ranges[mid].end<=triangle)lo=mid+1;else hi=mid;}const range=ranges[lo];if(range&&triangle>=range.start&&triangle<range.end)return range;}
  return metadata?.contactSurface??unclassified;
}
