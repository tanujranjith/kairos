import type {V3} from '../core/types';
import {distance} from '../core/math';

/** Remaining horizontal road-route length, including the short joins from the
 * live vehicle position and to the selected landmark. */
export function routeDistance(from:Pick<V3,'x'|'z'>,route:Pick<V3,'x'|'z'>[],destination?:Pick<V3,'x'|'z'>){
  if(!route.length)return destination?distance(from,destination):0;
  let total=distance(from,route[0]);
  for(let index=1;index<route.length;index++)total+=distance(route[index-1],route[index]);
  if(destination)total+=distance(route.at(-1)!,destination);
  return total;
}
