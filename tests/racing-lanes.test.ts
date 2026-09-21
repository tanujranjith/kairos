import {describe,it,expect} from 'vitest';
import {racingInput,advanceLaneOffset} from '../src/sim/ai';
import {CIRCUIT,ROADS,pointAt} from '../src/content/world';
import {vehicleById} from '../src/content/vehicles';
import type {Vehicle} from '../src/sim/physics';
import type {VehicleState} from '../src/core/types';

function car(id:string,s:number,lateral:number,speed=35,distance=100){
  const p=pointAt(CIRCUIT,s,lateral),state:VehicleState={id,position:p,yaw:p.yaw,velocity:{x:Math.sin(p.yaw)*speed,y:0,z:Math.cos(p.yaw)*speed},speed,rpm:5000,gear:3,steer:0,fuel:100,wheels:Array.from({length:4},()=>({load:3500,compression:.05,slip:0,angle:0,omega:0,temperature:65,wear:1,contact:true})),grounded:true,surface:'Asphalt',damage:0,absActive:false,tcActive:false,distance};
  return {state,definition:vehicleById('gtx')} as Vehicle;
}
const drive=(self:Vehicle,others:Vehicle[])=>racingInput(self,[self,...others],.65,0,0);
const settled=(self:Vehicle,others:Vehicle[])=>{let input=drive(self,others);for(let i=0;i<80;i++)input=drive(self,others);return input;};

function roadCar(id:string,road:typeof CIRCUIT,s:number,lateral:number,speed=35){
  const result=car(id,0,0,speed,500),p=pointAt(road,s,lateral);
  Object.assign(result.state,{position:p,yaw:p.yaw,velocity:{x:Math.sin(p.yaw)*speed,y:0,z:Math.cos(p.yaw)*speed}});return result;
}

describe('predictive road-coordinate racing lane reservation',()=>{
  it('does not converge the six-metre grid lanes after the launch distance threshold',()=>{
    for(const side of [-1,1]){
      const self=car('self',120,3*side),alongside=car('other',123,-3*side),held=car('reference',120,3*side,35,0);
      expect(drive(self,[alongside]).steer).toBeCloseTo(drive(held,[]).steer,5);
      expect(Math.abs(settled(car('clear',120,3*side),[]).steer-drive(held,[]).steer)).toBeGreaterThan(.05);
    }
  });
  it('anchors the reserved lane rather than integrating tracking drift at every decision',()=>{
    const self=car('self',120,3),other=car('other',123,-3);drive(self,[other]);
    self.state.position=pointAt(CIRCUIT,120,3.8);
    const reference=car('reference',120,3.8,35,0);
    expect(drive(self,[other]).steer).toBeCloseTo(settled(reference,[]).steer,5);
    // Once longitudinal body clearance is restored, normal line selection resumes.
    other.state.position=pointAt(CIRCUIT,160,-3);
    expect(settled(self,[other]).steer).toBeCloseTo(settled(car('clear',120,3.8),[]).steer,5);
  });
  it('reserves against an approaching overlap, ignores height-separated cars, and is order independent',()=>{
    const self=car('self',120,3),closing=car('closing',105,-3,45),clear=car('clear',120,3);
    expect(drive(self,[closing]).steer).toBeCloseTo(drive(car('held',120,3,35,0),[]).steer,5);
    closing.state.position.y+=5;
    expect(drive(self,[closing]).steer).toBeCloseTo(drive(clear,[]).steer,5);
    const left=car('left',123,-3),lead=car('lead',145,3,20);
    expect(drive(self,[left,lead])).toEqual(drive(self,[lead,left]));
  });
  it('moves the target continuously and identically at AI and player-control cadences',()=>{
    for(const direction of [-1,1]){
      let coarse=-3*direction,fine=coarse;
      for(let step=0;step<20;step++)coarse=advanceLaneOffset(coarse,3*direction,.1);
      for(let step=0;step<240;step++)fine=advanceLaneOffset(fine,3*direction,1/120);
      expect(coarse).toBeCloseTo(-.6*direction,9);expect(fine).toBeCloseTo(coarse,9);
      expect(advanceLaneOffset(3*direction,3*direction,.1)).toBe(3*direction);
      expect(advanceLaneOffset(0,3*direction,0)).toBe(0);
    }
  });
  it('opposes excessive measured yaw rate without changing the vehicle state',()=>{
    const neutral=car('neutral',850,0,38,0),baseline=drive(neutral,[]);
    for(const side of [-1,1]){
      const self=car('yaw',850,0,38,0);
      Object.assign(self,{body:{getAngularVelocity:()=>({y:side*.35})}});
      const original=structuredClone(self.state),input=drive(self,[]);
      expect((input.steer-baseline.steer)*side).toBeLessThan(-.05);
      expect(self.state).toEqual(original);
    }
  });
  it('retains curb clearance instead of an outward lane reservation at the road edge',()=>{
    for(const side of [-1,1]){
      const self=car('edge',120,5*side,40),alongside=car('inner',121,2.2*side,40);
      expect(drive(self,[alongside]).steer*side).toBeLessThan(-.025);
    }
  });
  it('can target the authored right-hand lane for public-road verification without changing race defaults',()=>{
    const road=ROADS.find(candidate=>candidate.id==='crossway')!,offset=road.width/2-road.width/road.lanes*.5;
    const centered=roadCar('public-lane',road,600,0),defaultLine=roadCar('default-line',road,600,0);let laneInput,defaultInput;
    for(let i=0;i<80;i++){laneInput=racingInput(centered,[centered],1,0,0,road,.1,offset);defaultInput=racingInput(defaultLine,[defaultLine],1,0,0,road,.1);}
    expect(laneInput!.steer).toBeGreaterThan(defaultInput!.steer+.05);expect(defaultInput!.steer).toBeCloseTo(0,1);
  });
  it('creeps the head of a stopped queue around a stationary race car',()=>{
    const self=car('self',120,0,0,500),stopped=car('stopped',123,0,0,500),trailing=car('trailing',113,0,0,500);
    const input=drive(self,[stopped,trailing]);
    expect(input.throttle).toBeGreaterThan(.2);expect(input.brake).toBe(0);expect(Math.abs(input.steer)).toBeGreaterThan(.01);
  });
});
