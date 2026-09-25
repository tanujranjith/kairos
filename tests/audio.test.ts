import { describe, expect, it } from 'vitest';
import { drivingMix, tunnelEnclosure } from '../src/core/audio-mix';
import { vehicleById } from '../src/content/vehicles';
import { ROADS, pointAt } from '../src/content/world';
import { TUNNELS } from '../src/content/structures';
import type { VehicleState } from '../src/core/types';
import {combustionHarmonics} from '../src/core/engine-wave';

const state=(patch:Partial<VehicleState>={}):VehicleState=>({id:'player',position:{x:0,y:0,z:0},velocity:{x:0,y:0,z:20},yaw:0,speed:20,rpm:3000,gear:2,steer:0,fuel:20,wheels:Array.from({length:4},()=>({load:3000,compression:.1,slip:0,angle:0,omega:60,temperature:40,wear:1,contact:true})),grounded:true,surface:'Asphalt',damage:0,absActive:false,tcActive:false,distance:0,...patch});
const dry={cockpit:false,rain:0,wetness:0,tunnel:0};
const car=vehicleById('velara');

describe('original driving audio mix',()=>{
  it('builds a finite, zero-DC pressure waveform and distinct load/overrun layers',()=>{
    const wave=combustionHarmonics();expect(wave.real[0]).toBe(0);expect(wave.imag[0]).toBe(0);expect([...wave.real,...wave.imag].every(Number.isFinite)).toBe(true);
    expect(Math.hypot(wave.real[40],wave.imag[40])).toBeLessThan(Math.hypot(wave.real[1],wave.imag[1]));
    const loaded=drivingMix(state({rpm:5000}),car,1,dry),coast=drivingMix(state({rpm:5000}),car,0,dry);
    expect(loaded.intakeGain).toBeGreaterThan(coast.intakeGain);expect(loaded.exhaustGain).toBeGreaterThan(coast.exhaustGain);expect(coast.overrunGain).toBeGreaterThan(loaded.overrunGain);
  });
  it('follows engine speed and load without changing the simulation',()=>{
    const original=state(),before=structuredClone(original),idle=drivingMix(original,car,0,dry),loaded=drivingMix(original,car,1,dry);
    expect(loaded.engineHz).toBe(idle.engineHz);
    expect(loaded.engineGain).toBeGreaterThan(idle.engineGain);
    expect(loaded.engineCutoff).toBeGreaterThan(idle.engineCutoff);
    expect(drivingMix(state({rpm:6000}),car,1,dry).engineHz).toBe(loaded.engineHz*2);
    expect(original).toEqual(before);
  });
  it('separates road contact, slip, wheel-speed whine and aerodynamic noise',()=>{
    const rolling=drivingMix(state(),car,1,dry),stopped=drivingMix(state({speed:0}),car,1,dry);
    expect(stopped.roadGain).toBe(0);expect(stopped.windGain).toBe(0);expect(stopped.whineGain).toBe(0);
    expect(rolling.roadGain).toBeGreaterThan(0);expect(rolling.whineGain).toBeGreaterThan(0);
    expect(drivingMix(state({gear:3}),car,1,dry).whineHz).toBeLessThan(rolling.whineHz);
    const flying=state();flying.wheels.forEach(w=>{w.contact=false;w.slip=1;});
    const airborne=drivingMix(flying,car,1,dry);
    expect(airborne.roadGain).toBe(0);expect(airborne.tireGain).toBe(0);expect(airborne.windGain).toBeGreaterThan(0);
  });
  it('wet asphalt does not keep playing rain after the weather clears',()=>{
    const wet=drivingMix(state(),car,.5,{...dry,wetness:1}),rain=drivingMix(state(),car,.5,{...dry,rain:1});
    expect(wet.rainGain).toBe(0);expect(wet.roadGain).toBeGreaterThan(drivingMix(state(),car,.5,dry).roadGain);
    expect(rain.rainGain).toBeGreaterThan(0);
    expect(drivingMix(state(),car,.5,{...dry,rain:1,tunnel:1}).rainGain).toBeLessThan(rain.rainGain*.1);
  });
  it('muffles cockpit sound, adds tunnel reflections and quiets an empty engine',()=>{
    const normal=drivingMix(state(),car,1,dry),inside=drivingMix(state(),car,1,{...dry,cockpit:true,tunnel:1});
    expect(inside.cabinCutoff).toBeLessThan(normal.cabinCutoff);expect(inside.tunnelGain).toBeGreaterThan(0);
    expect(drivingMix(state({fuel:0,speed:0}),car,1,dry).engineGain).toBe(0);
  });
  it('uses finite bounded values for reverse, high speed and every car class',()=>{
    for(const id of ['aeris','velara','crest','nova','gtx','apex'])for(const speed of [-30,0,100]){
      const mix=drivingMix(state({speed,rpm:13000,gear:-1}),vehicleById(id),1,{cockpit:true,rain:1,wetness:1,tunnel:1});
      expect(Object.values(mix).every(Number.isFinite)).toBe(true);
      expect(mix.whineHz).toBeLessThanOrEqual(9000);expect(mix.windGain).toBeLessThanOrEqual(.3);
    }
  });
});

describe('shared tunnel acoustic volume',()=>{
  const tunnel=TUNNELS[0],road=ROADS.find(r=>r.id===tunnel.roadId)!;
  const position=(s:number,offset=0,height=1)=>{const p=pointAt(road,s,offset);return {...p,y:p.y+height};};
  it('detects the enclosed road, excluding adjacent lanes outside the walls and the roof',()=>{
    expect(tunnelEnclosure(position(2480))).toBeCloseTo(1);
    expect(tunnelEnclosure(position(2480,9))).toBe(0);
    expect(tunnelEnclosure(position(2480,0,8))).toBe(0);
    expect(tunnelEnclosure(position(2480,0,-3))).toBe(0);
  });
  it('fades smoothly across each portal',()=>{
    expect(tunnelEnclosure(position(tunnel.start-20))).toBe(0);
    expect(tunnelEnclosure(position(tunnel.start+6))).toBeCloseTo(.5,1);
    expect(tunnelEnclosure(position(tunnel.end-6))).toBeCloseTo(.5,1);
    expect(tunnelEnclosure(position(tunnel.end+20))).toBe(0);
  });
});
