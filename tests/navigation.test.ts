import {describe,expect,it} from 'vitest';
import {routeDistance} from '../src/sim/navigation';

describe('navigation distance',()=>{
  it('measures the routed road path including vehicle and landmark joins',()=>{
    const from={x:0,z:0},route=[{x:10,z:0},{x:10,z:20},{x:30,z:20}],destination={x:35,z:20};
    expect(routeDistance(from,route,destination)).toBe(55);
    expect(routeDistance(from,route,destination)).toBeGreaterThan(Math.hypot(35,20));
  });
  it('handles missing and direct-only routes without mutating input',()=>{
    const route=[{x:3,z:4}],copy=structuredClone(route);
    expect(routeDistance({x:0,z:0},[],{x:3,z:4})).toBe(5);
    expect(routeDistance({x:0,z:0},[])).toBe(0);
    routeDistance({x:0,z:0},route,{x:6,z:8});expect(route).toEqual(copy);
  });
});
