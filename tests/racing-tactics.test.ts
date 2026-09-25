import {describe,it,expect} from 'vitest';
import {chooseRaceTactic,corridorClear,initialTactic,type RaceTacticsContext,type RaceNeighbour} from '../src/sim/racing-tactics';
const neighbour=(id:string,along:number,offset=0,speed=27):RaceNeighbour=>({id,along,offset,speed,width:2,length:4.5});
const context=(neighbours:RaceNeighbour[]):RaceTacticsContext=>({speed:30,freeSpeed:30,offset:0,width:2,length:4.5,limit:4,curvature:0,cornerAhead:.002,difficulty:.7,preferred:0,neighbours});
describe('gap-aware committed racing tactics',()=>{
  it('can pass after following has already matched the slower car',()=>{const c={...context([neighbour('lead',25,0,27)]),speed:27,freeSpeed:40};expect(chooseRaceTactic(c,initialTactic(),.1).mode).toBe('pass');});
  it('chooses the open side and is independent of neighbour iteration order',()=>{
    const c=context([neighbour('lead',30),neighbour('right',0,3,30)]),decision=chooseRaceTactic(c,initialTactic(),.1);
    expect(decision.mode).toBe('pass');expect(decision.offset).toBeLessThan(-2.6);
    expect(chooseRaceTactic({...c,neighbours:[...c.neighbours].reverse()},initialTactic(),.1)).toEqual(decision);
  });
  it('does not pass into occupied sides or a rapidly closing rear car',()=>{
    const c=context([neighbour('lead',30),neighbour('left',0,-3,30),neighbour('right',-20,3,45)]);
    expect(chooseRaceTactic(c,initialTactic(),.1).mode).toBe('line');expect(corridorClear(c,3)).toBe(false);
  });
  it('keeps its chosen side rather than oscillating and returns after clear passage',()=>{
    const c=context([neighbour('lead',30)]),first=chooseRaceTactic(c,initialTactic(),.1);
    const committed=chooseRaceTactic({...c,offset:first.offset,cornerAhead:-.002,neighbours:[neighbour('lead',0)]},first,.1);
    expect(committed.offset).toBe(first.offset);expect(committed.mode).toBe('pass');
    const complete=chooseRaceTactic({...c,offset:first.offset,neighbours:[neighbour('lead',-20)]},committed,.1);
    expect(complete.mode).toBe('line');expect(complete.offset).toBe(0);expect(complete.cooldown).toBeGreaterThan(0);
  });
  it('defends once early, but never blocks an overlapping or fast-closing rival',()=>{
    const c=context([neighbour('chaser',-30,0,33)]),first=chooseRaceTactic(c,initialTactic(),.1);
    expect(first.mode).toBe('defend');expect(first.offset).toBe(1.6);
    expect(chooseRaceTactic({...c,neighbours:[neighbour('overlap',-4,3,33)]},initialTactic(),.1).mode).toBe('line');
    expect(chooseRaceTactic({...c,neighbours:[neighbour('fast',-30,0,42)]},initialTactic(),.1).mode).toBe('line');
    const next=chooseRaceTactic({...c,cornerAhead:-.003},first,.1);expect(next.offset).toBe(first.offset);
  });
  it('holds its current lane if returning would cut across an overlap',()=>{
    const c={...context([neighbour('side',0,0,30)]),offset:3};
    expect(chooseRaceTactic(c,{mode:'pass',offset:3,opponent:'gone',age:3,cooldown:0},.1).offset).toBe(3);
  });
  it('does not initiate moves in corners or while stationary',()=>{
    const c=context([neighbour('lead',30)]);expect(chooseRaceTactic({...c,curvature:.02},initialTactic(),.1).mode).toBe('line');
    expect(chooseRaceTactic({...c,speed:0},initialTactic(),.1).mode).toBe('line');
  });
});
