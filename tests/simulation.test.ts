import { describe, it, expect } from 'vitest';
import { ROADS, CIRCUIT, RoadGraph, pointAt, nearestRoad, LANDMARKS } from '../src/content/world';
import { tireForces } from '../src/sim/tire';
import { RaceManager, insidePitLane, validatedRaceDistance } from '../src/sim/race';
import { defaultSave } from '../src/content/vehicles';
import { validateSave } from '../src/core/storage';

describe('authored world',()=>{
  it('has a four kilometre circuit and 35–45 km of public roads',()=>{expect(CIRCUIT.length).toBeGreaterThan(3800);expect(CIRCUIT.length).toBeLessThan(4500);const length=ROADS.filter(r=>r.kind!=='circuit'&&r.kind!=='pit'&&r.kind!=='test').reduce((s,r)=>s+r.length,0);expect(length).toBeGreaterThan(35000);expect(length).toBeLessThan(45000);});
  it('keeps sampled paths and nearest-road positions consistent',()=>{for(const road of ROADS)for(const ratio of [.02,.2,.5,.8,.98]){const p=pointAt(road,road.length*ratio);const near=nearestRoad(p.x,p.z,r=>r.id===road.id);expect(near.distance).toBeLessThan(.01);expect(Math.abs(near.progress-p.s)).toBeLessThan(.1);expect(Number.isFinite(p.yaw)).toBe(true);}});
  it('routes from the garage to every public destination without cutting across the lake',()=>{const graph=new RoadGraph(),home=LANDMARKS[0];for(const landmark of LANDMARKS){const route=graph.route(home,landmark);expect(route.length,landmark.name).toBeGreaterThan(0);for(let i=1;i<route.length;i++)expect(Math.hypot(route[i].x-route[i-1].x,route[i].z-route[i-1].z)).toBeLessThan(45);}});
});
describe('tire force model',()=>{
  it('produces no grip in the air and no force without slip',()=>{expect(tireForces(.2,.2,0,1)).toEqual({longitudinal:0,lateral:0});expect(tireForces(0,0,3500,1)).toEqual({longitudinal:0,lateral:0});});
  it('shares one friction limit between cornering and acceleration',()=>{const f=tireForces(.25,.2,3500,1.2);expect(Math.hypot(f.longitudinal,f.lateral)).toBeLessThanOrEqual(4200.01);expect(f.longitudinal).toBeGreaterThan(0);expect(f.lateral).toBeLessThan(0);});
  it('reduces available grip on a wet surface and transitions progressively',()=>{const dry=tireForces(.1,.05,3500,1.2),wet=tireForces(.1,.05,3500,.8);expect(Math.hypot(wet.longitudinal,wet.lateral)).toBeLessThan(Math.hypot(dry.longitudinal,dry.lateral));const a=tireForces(.1,.1,3500,1),b=tireForces(.1001,.1,3500,1);expect(Math.abs(a.longitudinal-b.longitudinal)).toBeLessThan(10);});
});
describe('race timing',()=>{
  const create=()=>{const race=new RaceManager();race.start({kind:'Quick Race',laps:3,entrants:4,difficulty:.65,position:1,vehicleClass:'GT'});race.update(3.1,[]);return race;};
  const sample=(race:RaceManager,progress:number,dt=.1,lateral=0)=>race.update(dt,[{id:'player',position:pointAt(CIRCUIT,progress,lateral),grounded:true,speed:40}]);
  const driveLap=(race:RaceManager)=>{for(let s=0;s<CIRCUIT.length;s+=4)sample(race,s);sample(race,0);};
  it('requires an initial forward line crossing and all ordered checkpoints',()=>{const race=create();sample(race,CIRCUIT.length-2);sample(race,1);expect(race.player.lap).toBe(1);expect(race.player.checkpoint).toBe(1);driveLap(race);expect(race.player.lap).toBe(2);expect(race.player.best).toBeGreaterThan(10);expect(race.player.sectors).toEqual([]);});
  it('does not count shortcuts or backwards start crossings',()=>{const race=create();sample(race,CIRCUIT.length-2);sample(race,1);sample(race,CIRCUIT.length-2);sample(race,1);expect(race.player.lap).toBe(1);sample(race,CIRCUIT.length*.6);expect(race.player.valid).toBe(false);expect(race.player.lap).toBe(1);});
  it('invalidates off-track laps and resets',()=>{const race=create();for(let i=0;i<10;i++)sample(race,1,.1,12);expect(race.player.valid).toBe(false);expect(race.player.warnings).toBe(1);race.player.valid=true;race.resetLap('player');expect(race.player.valid).toBe(false);});
  it('finishes the configured race, includes penalties, and gives other cars time to finish',()=>{const race=create();sample(race,CIRCUIT.length-2);sample(race,1);race.player.penalty=5;for(let i=0;i<3;i++)driveLap(race);expect(race.player.finished).toBe(true);expect(race.player.finishTime).toBeCloseTo(race.state.elapsed+5);expect(race.state.flag).toBe('CHECKERED');race.update(121,[]);expect(race.state.phase).toBe('finished');});
  it('ends timed qualifying and progresses race weekends',()=>{const race=new RaceManager();race.start({kind:'Race Weekend',laps:5,entrants:8,difficulty:.65,position:4,vehicleClass:'FORMULA'});race.update(300,[]);expect(race.state.phase).toBe('finished');expect(race.nextStage()).toBe(true);expect(race.state.phase).toBe('qualifying');race.end();expect(race.nextStage()).toBe(true);expect(race.state.phase).toBe('countdown');expect(race.nextStage()).toBe(false);});
  it('never mistakes a main-track point for pit lane',()=>{for(let s=0;s<CIRCUIT.length;s+=5){const p=pointAt(CIRCUIT,s),pit=nearestRoad(p.x,p.z,r=>r.id==='pit');expect(insidePitLane(pit.progress,pit.distance,0)).toBe(false);}expect(insidePitLane(300,1,40)).toBe(true);expect(insidePitLane(0,1,40)).toBe(false);});
  it('ranks completed laps ahead of a lapped car finishing earlier',()=>{const race=create();Object.assign(race.state.entrants[0],{finished:true,lap:3,finishTime:120});Object.assign(race.state.entrants[1],{finished:true,lap:2,finishTime:115});expect(race.order()[0].id).toBe('player');});
  it('does not credit shortcut distance past an unvisited checkpoint',()=>{const race=create();Object.assign(race.player,{lap:1,checkpoint:1,progress:CIRCUIT.length*.6});expect(validatedRaceDistance(race.player)).toBeCloseTo(CIRCUIT.length/12);});
  it('applies a false-start penalty once, then resets the rule book on restart',()=>{const race=new RaceManager(),config={kind:'Quick Race' as const,laps:3 as const,entrants:4,difficulty:.5,position:1,vehicleClass:'GT' as const};race.start(config);for(const progress of [4000,4002,4004])race.update(.1,[{id:'player',position:pointAt(CIRCUIT,progress),grounded:true,speed:3}]);expect(race.player.penalty).toBe(10);race.start(config);expect(race.player.penalty).toBe(0);});
});
describe('save handling',()=>{
  it('round-trips settings and records',()=>{const save=defaultSave();save.records['lap-gtx']=93.4;save.settings.weather='Rain';save.discovered=['lakeshore'];expect(validateSave(JSON.parse(JSON.stringify(save)))).toEqual(save);});
  it('rejects unsupported formats and sanitizes corrupt fields',()=>{expect(()=>validateSave({version:2})).toThrow();expect(()=>validateSave(null)).toThrow();const save=defaultSave();save.settings.volume=99;save.settings.time=NaN;save.selected='missing';save.records.x=Infinity;const clean=validateSave(save);expect(clean.settings.volume).toBe(1);expect(clean.settings.time).toBe(17.4);expect(clean.selected).toBe('velara');expect(clean.records.x).toBeUndefined();});
});
