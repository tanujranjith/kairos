import {describe,it,expect} from 'vitest';
import {RaceManager,DRIVER_NAMES} from '../src/sim/race';
import type {RaceSessionConfig} from '../src/core/types';

const config:RaceSessionConfig={kind:'Race Weekend',laps:3,entrants:8,difficulty:.65,position:4,vehicleClass:'GT'};
const initial=['racer-1','racer-2','racer-3','player','racer-4','racer-5','racer-6','racer-7'];
const earned=['racer-6','racer-3','player','racer-7','racer-2','racer-5','racer-1','racer-4'];
function qualify(){const race=new RaceManager();race.start(config,1);earned.forEach((id,i)=>{race.state.entrants.find(r=>r.id===id)!.best=100+i;});race.end();return race;}

describe('session grids and qualifying continuity',()=>{
  it('builds selected-position grids for one to sixteen cars without moving entrant identities',()=>{
    for(const entrants of [1,4,8,12,16])for(let position=1;position<=entrants;position++){
      const race=new RaceManager();race.start({...config,kind:'Quick Race',entrants,position});
      const ids=Array.from({length:entrants-1},(_,i)=>`racer-${i+1}`);ids.splice(position-1,0,'player');
      expect(race.state.grid).toEqual(ids);expect(race.order().map(r=>r.id)).toEqual(ids);
      expect(race.player.id).toBe('player');expect(race.state.entrants.map(r=>r.name)).toEqual(DRIVER_NAMES.slice(0,entrants));
    }
  });
  it('carries every earned position into a new manager and retains stable driver names',()=>{
    const race=qualify(),next=race.nextSession()!;
    expect(next.grid).toEqual(earned);expect(next.config.position).toBe(3);expect(next.stage).toBe(2);
    const replacement=new RaceManager();replacement.start(next.config,next.stage,next.grid);
    expect(replacement.state.grid).toEqual(earned);expect(replacement.order().map(r=>r.id)).toEqual(earned);
    expect(replacement.state.phase).toBe('countdown');expect(replacement.state.session.position).toBe(3);
    expect(replacement.state.entrants.map(r=>r.name)).toEqual(DRIVER_NAMES.slice(0,8));
    expect(replacement.state.entrants.every(r=>r.best===Infinity&&r.penalty===0&&r.lap===0)).toBe(true);
    expect(config.position).toBe(4);
  });
  it('uses the same transition for the manager helper and runtime descriptor',()=>{
    const race=qualify();expect(race.nextStage()).toBe(true);expect(race.state.grid).toEqual(earned);
    expect(race.nextSession()).toBeNull();expect(race.nextStage()).toBe(false);
  });
  it('keeps the qualifying starting order for ties and no-time drivers',()=>{
    const race=new RaceManager();race.start(config,1);
    race.state.entrants.find(r=>r.id==='player')!.best=100;
    race.state.entrants.find(r=>r.id==='racer-2')!.best=100;
    race.state.entrants.find(r=>r.id==='racer-5')!.best=95;
    // A later invalid lap must not discard an earlier valid best.
    race.player.valid=false;race.end();
    const expected=['racer-5','racer-2','player','racer-1','racer-3','racer-4','racer-6','racer-7'];
    expect(race.order().map(r=>r.id)).toEqual(expected);expect(race.nextSession()!.grid).toEqual(expected);
    const empty=new RaceManager();empty.start(config,1);empty.end();expect(empty.nextSession()!.grid).toEqual(initial);
  });
  it('ignores practice ranking and refuses unfinished or standalone transitions',()=>{
    const race=new RaceManager();race.start(config);race.player.best=80;expect(race.nextSession()).toBeNull();race.end();
    const next=race.nextSession()!;expect(next.stage).toBe(1);expect(next.grid).toEqual(initial);
    race.nextStage();expect(race.state.grid).toEqual(initial);expect(race.player.best).toBe(Infinity);
    for(const kind of ['Practice','Qualifying','Quick Race'] as const){race.start({...config,kind});race.end();expect(race.nextSession()).toBeNull();}
  });
  it('snapshots inputs and rejects duplicate, unknown and stale field grids before changing state',()=>{
    const race=qualify(),next=race.nextSession()!,original=race.state;
    for(const grid of [earned.slice(1),earned.map((id,i)=>i===0?'unknown':id),earned.map((id,i)=>i===0?'player':id)]){
      expect(()=>race.start(next.config,next.stage,grid)).toThrow(/grid/i);expect(race.state).toBe(original);
    }
    const mutable=[...earned],settings={...next.config};race.start(settings,2,mutable);mutable.reverse();settings.position=1;
    expect(race.state.grid).toEqual(earned);expect(race.state.session.position).toBe(3);
    next.config.position=8;next.grid!.reverse();expect(original.grid).toEqual(initial);
  });
  it('clears earned ordering for a fresh weekend and resized Quick Race',()=>{
    const race=qualify();race.nextStage();race.start(config);expect(race.stage).toBe(0);expect(race.state.grid).toEqual(initial);
    race.start({...config,kind:'Quick Race',entrants:4,position:4});expect(race.state.grid).toEqual(['racer-1','racer-2','racer-3','player']);
    expect(race.state.entrants.every(r=>r.best===Infinity&&r.penalty===0)).toBe(true);
  });
});
