import { describe,expect,it } from 'vitest';
import { carDetail,needsReflection,reflectionProfile } from '../src/render/detail-policy';

describe('render-only quality policies',()=>{
  it('keeps a stable hysteresis band on every preset',()=>{
    for(const [quality,limit]of [['Low',18],['Medium',60],['High',80],['Ultra',110]] as const){
      expect(carDetail(0,limit+1,quality)).toBe(1);
      expect(carDetail(1,limit*.9,quality)).toBe(1);
      expect(carDetail(0,limit*.9,quality)).toBe(0);
      expect(carDetail(1,limit*.79,quality)).toBe(0);
    }
  });
  it('caps reflection updates, refreshes region changes and holds a static showroom',()=>{
    const first={position:{x:0,y:2,z:0},garage:false,stamp:'sun',clock:0};
    expect(needsReflection(undefined,first,'Low')).toBe(true);
    expect(needsReflection(first,{...first,position:{x:40,y:2,z:0},clock:1},'Low')).toBe(false);
    expect(needsReflection(first,{...first,position:{x:40,y:2,z:0},clock:2},'Low')).toBe(true);
    expect(needsReflection(first,{...first,stamp:'night',clock:2},'Low')).toBe(true);
    expect(needsReflection(first,{...first,position:{x:200,y:2,z:0},clock:0},'Low')).toBe(true);
    expect(needsReflection({...first,garage:true},{...first,garage:true,clock:60},'Low')).toBe(false);
    expect(needsReflection({...first,garage:true},first,'Low')).toBe(true);
    expect(reflectionProfile('Low')).toEqual({size:128,interval:2,meshes:16,triangles:16000});
  });
});
