import {describe,expect,it} from 'vitest';
import {VEHICLES} from '../src/content/vehicles';
import {vehicleCollisionShape} from '../src/content/vehicle-collision';

describe('shared vehicle collision contract',()=>{
  it('defines a finite centered chassis box for every handling profile',()=>{
    for(const definition of VEHICLES){
      const collision=vehicleCollisionShape(definition);
      expect(collision.kind).toBe('box');
      expect(collision.center).toEqual({x:0,y:.05,z:0});
      expect(collision.size.x).toBeCloseTo(definition.width*.86,10);
      expect(collision.size.y).toBe(.38);
      expect(collision.size.z).toBeCloseTo(definition.length*.87,10);
      expect(Object.values(collision.size).every(value=>Number.isFinite(value)&&value>0)).toBe(true);
    }
  });
});
