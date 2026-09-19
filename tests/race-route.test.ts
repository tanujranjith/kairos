import {describe,it,expect} from 'vitest';
import {CIRCUIT,PIT,pointAt,nearestRoad} from '../src/content/world';
import {CIRCUIT_GATES,PIT_GATES,PIT_TIMING,pitRaceProgress,gateCrossing} from '../src/content/race-course';
import {RaceRouteTracker} from '../src/sim/race-route';
import {RaceManager,validatedRaceDistance} from '../src/sim/race';
import type {Road,V3} from '../src/core/types';

const observation=(position:V3,speed=10)=>({id:'player',position,grounded:true,speed});
const create=()=>{const r=new RaceManager();r.start({kind:'Practice',laps:3,entrants:2,difficulty:.65,position:1,vehicleClass:'GT'});return r;};
const sample=(r:RaceManager,road:Road,s:number,offset=0,speed=10)=>r.update(.2,[observation(pointAt(road,s,offset),speed)]);
const drive=(r:RaceManager,road:Road,start:number,end:number)=>{for(let s=start;s<end;s+=2)sample(r,road,s);sample(r,road,end);};
const beforePit=(r:RaceManager)=>{sample(r,CIRCUIT,CIRCUIT.length-2);sample(r,CIRCUIT,1);drive(r,CIRCUIT,2,PIT_TIMING.startCircuit);};

describe('directional circuit and ordered pit timing',()=>{
  it('clips crossings by direction, line width and height',()=>{
    const gate=CIRCUIT_GATES[0],a=pointAt(CIRCUIT,CIRCUIT.length-2),b=pointAt(CIRCUIT,2);
    expect(gateCrossing(a,b,gate)).not.toBeNull();expect(gateCrossing(b,a,gate)).toBeNull();
    expect(gateCrossing({...a,y:a.y+4},{...b,y:b.y+4},gate)).toBeNull();
    expect(gateCrossing(pointAt(CIRCUIT,CIRCUIT.length-2,20),pointAt(CIRCUIT,2,20),gate)).toBeNull();
  });
  it('anchors pit-equivalent distance at the actual finish plane and exit',()=>{
    expect(pitRaceProgress(PIT_TIMING.finish)).toBeCloseTo(CIRCUIT.length,8);
    expect(pitRaceProgress(PIT.length)).toBeCloseTo(CIRCUIT.length+840,5);
    expect(PIT_GATES.filter(g=>g.mainCheckpoint!==undefined).map(g=>g.mainCheckpoint)).toEqual([0,1,2]);
    for(let s=1;s<PIT.length;s++)expect(pitRaceProgress(s)).toBeGreaterThan(pitRaceProgress(s-1));
    for(const s of [PIT_TIMING.entry,PIT_TIMING.exit]){const p=pointAt(PIT,s);expect(pitRaceProgress(s)%CIRCUIT.length).toBeCloseTo(nearestRoad(p.x,p.z,r=>r.id===CIRCUIT.id).progress,6);}
  });
  it('counts the pit finish once, preserves order/ranking through service, and rejoins without a jump',()=>{
    const r=create();beforePit(r);expect(r.player.checkpoint).toBe(0);expect(r.player.lap).toBe(1);
    drive(r,PIT,0,450);expect(r.player.lap).toBe(2);expect(r.player.pitValid).toBe(true);expect(r.player.valid).toBe(true);expect(r.player.penalty).toBe(0);
    const progress=validatedRaceDistance(r.player),checkpoint=r.player.pitCheckpoint;for(let i=0;i<30;i++)sample(r,PIT,450,0,0);
    expect(validatedRaceDistance(r.player)).toBeCloseTo(progress,8);expect(r.player.pitCheckpoint).toBe(checkpoint);
    drive(r,PIT,452,PIT.length);expect(r.player.pitRoute).toBe(false);expect(r.player.checkpoint).toBe(3);expect(r.player.valid).toBe(true);
    drive(r,CIRCUIT,842,CIRCUIT.length-1);sample(r,CIRCUIT,1);expect(r.player.lap).toBe(3);expect(r.player.valid).toBe(true);expect(Number.isFinite(r.player.best)).toBe(true);
  });
  it('rejects a spawn/reset in the middle, skipped pit gates, and wrong-height shortcuts',()=>{
    for(const mode of ['middle','skip','height','reset']){
      const r=create();beforePit(r);drive(r,PIT,0,30);
      if(mode==='middle')r.resetLap('player');
      if(mode==='height'){for(let s=32;s<220;s+=2){const p=pointAt(PIT,s);r.update(.2,[observation({...p,y:p.y+4})]);}}
      else if(mode==='reset'){r.update(.2,[{...observation(pointAt(PIT,100)),reset:true}]);}
      else sample(r,PIT,220);
      drive(r,PIT,222,PIT.length);expect(r.player.lap,mode).toBe(1);expect(r.player.valid,mode).toBe(false);expect(r.player.checkpoint,mode).toBe(0);
    }
  });
  it('does not double-count reversing over the pit finish line',()=>{
    const tracker=new RaceRouteTracker();const events:number[]=[];
    for(let s=0;s<PIT_TIMING.finish+20;s+=2)events.push(...tracker.update(observation(pointAt(PIT,s)),.2).events.map(e=>e.checkpoint));
    for(let s=PIT_TIMING.finish+18;s>PIT_TIMING.finish-20;s-=2)events.push(...tracker.update(observation(pointAt(PIT,s)),.2).events.map(e=>e.checkpoint));
    for(let s=PIT_TIMING.finish-18;s<PIT_TIMING.finish+25;s+=2)events.push(...tracker.update(observation(pointAt(PIT,s)),.2).events.map(e=>e.checkpoint));
    expect(events).toEqual([0]);
  });
  it('penalizes pit speeding once per visit but never the adjacent circuit',()=>{
    const r=create();beforePit(r);for(let s=0;s<400;s+=2)sample(r,PIT,s,0,30);expect(r.player.penalty).toBe(5);
    // A brief lane departure cannot clear the visit's speed-penalty latch.
    sample(r,PIT,400,5,30);sample(r,PIT,402,0,30);expect(r.player.penalty).toBe(5);expect(r.player.valid).toBe(false);
    const edge=create();beforePit(edge);drive(edge,PIT,0,100);sample(edge,PIT,102,4,30);expect(edge.player.pit).toBe(false);expect(edge.player.pitRoute).toBe(true);expect(edge.player.penalty).toBe(5);
    const main=create();drive(main,CIRCUIT,CIRCUIT.length-200,CIRCUIT.length-1);drive(main,CIRCUIT,0,850);expect(main.player.penalty).toBe(0);
  });
  it('counts a low airborne crossing but rejects the same line on another elevation',()=>{
    for(const height of [1,4]){const tracker=new RaceRouteTracker(),a=pointAt(CIRCUIT,CIRCUIT.length-2),b=pointAt(CIRCUIT,2);
      tracker.update({...observation({...a,y:a.y+height}),grounded:false},.2);
      const result=tracker.update({...observation({...b,y:b.y+height}),grounded:false},.2);
      expect(result.events.map(e=>e.checkpoint)).toEqual(height===1?[0]:[]);expect(result.onTrack).toBe(height===1);
    }
  });
  it('invalidates sustained wrong-elevation travel even between timing lines',()=>{
    const r=create();sample(r,CIRCUIT,100);const p=pointAt(CIRCUIT,102);
    for(let i=0;i<5;i++)r.update(.2,[observation({...p,y:p.y-8})]);
    expect(r.player.valid).toBe(false);expect(r.player.warnings).toBe(1);expect(r.player.lap).toBe(0);
  });
  it('interpolates a physical crossing consistently at different observation cadences',()=>{
    const times:number[]=[];
    for(const dt of [.2,.1,1/30]){const tracker=new RaceRouteTracker();let time=0;const line=CIRCUIT_GATES[0];
      const position=(s:number)=>({x:line.position.x+Math.sin(line.yaw)*s,y:line.position.y,z:line.position.z+Math.cos(line.yaw)*s});
      tracker.update(observation(position(-3)),dt);
      while(time<1){const result=tracker.update(observation(position(-3+10*(time+dt))),dt);for(const e of result.events)times.push(time+e.fraction*dt);time+=dt;}
    }
    expect(times).toHaveLength(3);for(const time of times)expect(time).toBeCloseTo(.3,8);
  });
  it('clears route proof and penalties when restarting a session',()=>{
    const r=create();beforePit(r);drive(r,PIT,0,450);sample(r,PIT,452,0,30);expect(r.player.pitValid).toBe(true);expect(r.player.penalty).toBe(5);
    r.start({...r.state.session});expect(r.player.lap).toBe(0);expect(r.player.pitCheckpoint).toBe(0);expect(r.player.penalty).toBe(0);
    drive(r,PIT,454,600);expect(r.player.valid).toBe(false);expect(r.player.lap).toBe(0);expect(r.player.pitValid).toBe(false);
  });
});
