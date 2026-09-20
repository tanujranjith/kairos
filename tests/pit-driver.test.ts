import {describe,it,expect} from 'vitest';
import {PIT_VISIT,pitBox} from '../src/content/pit-plan';
import {PitDriver,pitMergeBlocker,serviceReason} from '../src/sim/pit-driver';
import {RaceManager} from '../src/sim/race';
import {CIRCUIT,PIT,pointAt} from '../src/content/world';
import {vehicleById} from '../src/content/vehicles';
import {distance} from '../src/core/math';
import type {VehicleState} from '../src/core/types';
import type {Vehicle} from '../src/sim/physics';
import {racingInput} from '../src/sim/ai';
const state=(id='test',road=CIRCUIT,s=0,speed=0):VehicleState=>({id,position:pointAt(road,s),velocity:{x:0,y:0,z:0},yaw:pointAt(road,s).yaw,speed,rpm:1000,gear:1,steer:0,fuel:100,wheels:Array.from({length:4},()=>({load:2000,compression:.05,slip:0,angle:0,omega:0,temperature:65,wear:1,contact:true})),grounded:true,surface:'Asphalt',damage:0,absActive:false,tcActive:false,distance:0});
const session=()=>{const r=new RaceManager();r.start({kind:'Practice',laps:5,entrants:2,position:1,difficulty:.65,vehicleClass:'GT'});return r;};
describe('AI pit strategy and physical route',()=>{
  it('steers away from an alongside car, not toward it based on its own track half',()=>{
    const s=state('self',CIRCUIT,120,18),v={state:s,definition:vehicleById('apex')} as Vehicle,otherState=state('left',CIRCUIT,120,18),other={state:otherState,definition:vehicleById('apex')} as Vehicle;
    s.position=pointAt(CIRCUIT,120,-.1);otherState.position=pointAt(CIRCUIT,120,-3.5);const baseline=racingInput(v,[v],.65,0,0);
    expect(racingInput(v,[v,other],.65,0,0).steer).toBeGreaterThan(baseline.steer);
  });
  it('brakes early for a much slower car but does not brake for a safely separate lane',()=>{
    const s=state('fast',CIRCUIT,120,50),v={state:s,definition:vehicleById('apex')} as Vehicle,leadState=state('slow',CIRCUIT,190,12),lead={state:leadState,definition:vehicleById('apex')} as Vehicle;
    leadState.velocity={x:Math.sin(leadState.yaw)*12,y:0,z:Math.cos(leadState.yaw)*12};
    const clear=racingInput(v,[v],.65,0,0),following=racingInput(v,[v,lead],.65,0,0);expect(following.brake).toBeGreaterThan(.5);expect(following.throttle).toBe(0);expect(following.brake).toBeGreaterThan(clear.brake);
    leadState.position=pointAt(CIRCUIT,190,5);expect(racingInput(v,[v,lead],.65,0,0).brake).toBe(clear.brake);
  });
  it('reduces planned corner pace for worn tires without changing physical grip or power',()=>{
    const s=state('test',CIRCUIT,1700,35),v={state:s,definition:vehicleById('gtx')} as Vehicle;
    const fresh=racingInput(v,[v],.65,0,0);s.wheels.forEach(w=>w.wear=.3);const worn=racingInput(v,[v],.65,0,0);
    expect(worn.throttle).toBeLessThanOrEqual(fresh.throttle);expect(worn.brake).toBeGreaterThanOrEqual(fresh.brake);expect(worn.brake>worn.throttle||worn.throttle<fresh.throttle).toBe(true);
  });
  it('ignores same-road cars behind around a bend and slowly steers around a stopped obstacle',()=>{
    const s=state('self',CIRCUIT,3214,0),v={state:s,definition:vehicleById('apex')} as Vehicle;s.distance=5000;
    const behind={state:state('behind',CIRCUIT,3190,0),definition:v.definition} as Vehicle;
    expect(racingInput(v,[v,behind],.65,0,0)).toEqual(racingInput(v,[v],.65,0,0));
    const p=pointAt(CIRCUIT,120);s.position=p;s.yaw=p.yaw;const obstacle={state:state('stopped',CIRCUIT,145,0),definition:v.definition} as Vehicle;
    expect(Math.abs(racingInput(v,[v,obstacle],.65,0,0).steer)).toBeGreaterThan(Math.abs(racingInput(v,[v],.65,0,0).steer));
  });
  it('uses a continuous forward connector route and sixteen separated legal boxes',()=>{
    const p=PIT_VISIT.road.points;expect(p.every(v=>Object.values(v).every(x=>typeof x!=='number'||Number.isFinite(x)))).toBe(true);
    for(let i=1;i<p.length;i++){expect(p[i].s).toBeGreaterThan(p[i-1].s);expect(distance(p[i],p[i-1])).toBeLessThan(12);}
    expect(distance(p[0],pointAt(CIRCUIT,PIT_VISIT.start))).toBeLessThan(.01);expect(PIT_VISIT.hold).toBeLessThan(PIT_VISIT.road.length-100);
    expect(new Set(Array.from({length:16},(_,i)=>pitBox(i))).size).toBe(16);expect(pitBox(15)).toBeLessThan(PIT.length-170);
  });
  it('requests fuel/tires from actual state, but no unnecessary last-lap tire stop or finished/grid stop',()=>{
    const race=session(),s=state(),d=vehicleById('gtx');expect(serviceReason(s,d,race.player,race.state)).toBe('');
    s.fuel=3;expect(serviceReason(s,d,race.player,race.state)).toBe('fuel');s.fuel=100;s.wheels[0].wear=.4;expect(serviceReason(s,d,race.player,race.state)).toBe('tires');
    race.state.phase='racing';race.player.lap=5;race.player.progress=CIRCUIT.length-500;expect(serviceReason(s,d,race.player,race.state)).toBe('');
    race.player.finished=true;s.fuel=0;expect(serviceReason(s,d,race.player,race.state)).toBe('');race.player.finished=false;race.state.phase='countdown';expect(serviceReason(s,d,race.player,race.state)).toBe('');
  });
  it('yields to fast arriving or stopped main-track cars, excluding pit/height-separated and distant cars',()=>{
    const s=state('pit',PIT,PIT.length-70),merge=PIT_VISIT.mergeCircuit;
    expect(pitMergeBlocker(s,[state('fast',CIRCUIT,merge-200,40)])).toBe('fast');
    expect(pitMergeBlocker(s,[state('stopped',CIRCUIT,merge+10)])).toBe('stopped');
    expect(pitMergeBlocker(s,[state('far',CIRCUIT,merge-650,40),state('pit-other',PIT,PIT.length-100,12)])).toBeNull();
    const above=state('above',CIRCUIT,merge-10);above.position.y+=5;expect(pitMergeBlocker(s,[above,s])).toBeNull();
  });
  it('requires a stopped grounded car in its own box for a contiguous six seconds and services only once',()=>{
    const race=session(),s=state('racer-1',PIT,pitBox(0)),driver=new PitDriver(0),v={state:s,definition:vehicleById('gtx')} as Vehicle;
    driver.phase='approach';s.fuel=3;s.grounded=false;expect(driver.update(.1,v,[v],race.state,0).serviceComplete).toBe(false);expect(driver.phase).toBe('approach');
    s.grounded=true;for(let i=0;i<30;i++)expect(driver.update(.1,v,[v],race.state,0).serviceComplete).toBe(false);
    s.speed=1;driver.update(.1,v,[v],race.state,0);expect(driver.serviceElapsed).toBe(0);s.speed=0;
    let services=0;for(let i=0;i<61;i++)services+=Number(driver.update(.1,v,[v],race.state,0).serviceComplete);
    expect(services).toBe(1);expect(driver.stops).toBe(1);expect(driver.phase).toBe('exit');expect(s.fuel).toBe(3); // Controller requests service; runtime owns replenishment.
    for(let i=0;i<70;i++)expect(driver.update(.1,v,[v],race.state,0).serviceComplete).toBe(false);
  });
  it('does not turn back into a missed pit approach or service from a wrong position',()=>{
    const race=session(),s=state('racer-1',CIRCUIT,PIT_VISIT.start+80,20),driver=new PitDriver(0),v={state:s,definition:vehicleById('gtx')} as Vehicle;
    race.state.entrants[1].lap=1;s.fuel=3;driver.update(.1,v,[v],race.state,0);expect(driver.phase).toBe('requested');
    s.position=pointAt(PIT,pitBox(0)+12);s.speed=0;driver.phase='approach';for(let i=0;i<80;i++)expect(driver.update(.1,v,[v],race.state,0).serviceComplete).toBe(false);expect(driver.stops).toBe(0);
    driver.reset();expect(driver.active).toBe(false);expect(driver.waitingFor).toBeNull();
  });
});
