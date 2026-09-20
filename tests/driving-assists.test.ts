import {afterEach,describe,expect,it,vi} from 'vitest';
import {keyboardSteeringScale,steeringLock} from '../src/core/steering';
import {tractionTorque} from '../src/sim/tire';
import {Input} from '../src/core/input';
import {DEFAULT_SETTINGS} from '../src/content/vehicles';
import {compressionSpeed} from '../src/sim/suspension';

describe('surface-relative suspension damping',()=>{
  it('does not treat horizontal travel as compression on a pitched or banked car',()=>{
    expect(compressionSpeed({x:25,y:0,z:0},{x:0,y:1,z:0},{x:-.1,y:.995,z:0})).toBeCloseTo(0);
    expect(compressionSpeed({x:0,y:0,z:25},{x:0,y:1,z:0},{x:0,y:.995,z:.1})).toBeCloseTo(0);
  });
  it('responds to actual surface-normal travel and remains finite on steep contacts',()=>{
    expect(compressionSpeed({x:20,y:-1,z:0},{x:0,y:1,z:0},{x:0,y:1,z:0})).toBe(1);
    expect(compressionSpeed({x:20,y:2,z:0},{x:-.1,y:1,z:0},{x:0,y:1,z:0})).toBeCloseTo(0);
    expect(Number.isFinite(compressionSpeed({x:1,y:-1,z:0},{x:1,y:0,z:0},{x:0,y:1,z:0}))).toBe(true);
  });
});

describe('keyboard road-speed steering',()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it('preserves parking lock and bounds 40mph cornering demand without modifying grip',()=>{
    expect(keyboardSteeringScale(0)).toBe(1);expect(keyboardSteeringScale(-2)).toBe(1);
    for(const speed of [10,17.8816,30,60])for(const wb of [2.48,2.65,3.3]){
      const angle=keyboardSteeringScale(speed,wb)*steeringLock(speed);
      expect(Math.tan(angle)*speed*speed/wb).toBeLessThanOrEqual(8.00001);
      expect(keyboardSteeringScale(-speed,wb)).toBe(keyboardSteeringScale(speed,wb));
      expect(keyboardSteeringScale(speed,wb,1)).toBeLessThan(keyboardSteeringScale(speed,wb,0));
    }
  });
  it('smooths taps, recenters, reverses and clears; analog input keeps its full range',()=>{
    vi.stubGlobal('window',new EventTarget());let pads:unknown[]=[];vi.stubGlobal('navigator',{getGamepads:()=>pads});
    const input=new Input(()=>DEFAULT_SETTINGS);input.keys.add('ArrowRight');
    let frame=input.poll(1/120,17.8816);expect(frame.steer).toBeGreaterThan(0);
    for(let n=0;n<60;n++)frame=input.poll(1/120,17.8816);
    expect(frame.steer).toBeLessThan(.21);
    input.keys.clear();for(let n=0;n<60;n++)frame=input.poll(1/120,17.8816);expect(frame.steer).toBeLessThan(.002);
    input.keys.add('ArrowLeft');for(let n=0;n<60;n++)frame=input.poll(1/120,17.8816);expect(frame.steer).toBeLessThan(-.1);
    input.clear();expect(input.poll(1/120,17.8816).steer).toBe(0);
    pads=[{connected:true,index:0,id:'pad',axes:[1],buttons:[]}];
    for(let n=0;n<120;n++)frame=input.poll(1/120,17.8816);expect(frame.steer).toBeGreaterThan(.8);
  });
});
describe('combined-slip traction control',()=>{
  const torque=(angle=0,load=3500,mu=1,omega=60,direction=1)=>tractionTorque(2000*direction,omega*direction,18*direction,angle,load,mu,.34,1.8,1/120,direction);
  it('reserves cornering capacity and responds to available load and wet grip',()=>{
    expect(torque(.15)).toBeLessThan(torque(0));expect(torque(0,1500)).toBeLessThan(torque());expect(torque(0,3500,.6)).toBeLessThan(torque());
    expect(torque(0,3500,1,100)).toBe(0);expect(torque(0,3500,1,60,-1)).toBe(-torque(0));
  });
  it('does not add engine torque or alter passive engine braking',()=>{
    expect(tractionTorque(20,0,0,0,3500,1,.34,1.8,1/120,1)).toBe(20);
    expect(tractionTorque(-65,60,18,0,3500,1,.34,1.8,1/120,1)).toBe(-65);
  });
});
