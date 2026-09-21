import {describe,expect,it} from 'vitest';
import {LANDMARKS} from '../src/content/world';
import {defaultSave} from '../src/content/vehicles';
import {activityRecordText,evaluateSpeedTrap} from '../src/sim/activities';

describe('Free Drive activities',()=>{
  it('ships the required activity set',()=>{
    expect(LANDMARKS.filter(l=>l.type==='speed')).toHaveLength(4);
    expect(LANDMARKS.filter(l=>l.type==='trial')).toHaveLength(3);
    expect(LANDMARKS.filter(l=>l.type==='drift')).toHaveLength(2);
    expect(LANDMARKS.filter(l=>l.type==='scenic')).toHaveLength(3);
  });
  it('keeps a fastest speed record and reports target completion',()=>{
    expect(evaluateSpeedTrap(undefined,30,110)).toEqual({speedKph:108,bestKph:108,personalBest:true,targetReached:false});
    expect(evaluateSpeedTrap(108,-32,110)).toEqual({speedKph:115.2,bestKph:115.2,personalBest:true,targetReached:true});
    expect(evaluateSpeedTrap(120,25,110)).toEqual({speedKph:90,bestKph:120,personalBest:false,targetReached:false});
  });
  it('formats persistent activity and discovery records for the map',()=>{
    const save=defaultSave(),speed=LANDMARKS.find(l=>l.id==='speed1')!,trial=LANDMARKS.find(l=>l.id==='trial1')!,drift=LANDMARKS.find(l=>l.id==='drift1')!,scenic=LANDMARKS.find(l=>l.id==='vista')!,garage=LANDMARKS.find(l=>l.id==='home')!;
    expect(activityRecordText(speed,save)).toBe('NO PERSONAL BEST');
    expect(activityRecordText(garage,save)).toBe('');
    save.records[speed.id]=151.4;save.records[trial.id]=92.345;save.records[drift.id]=3210;save.visits.push(scenic.id);
    expect(activityRecordText(speed,save)).toBe('PERSONAL BEST · 151 KM/H');
    expect(activityRecordText(trial,save)).toBe('PERSONAL BEST · 1:32.345');
    expect(activityRecordText(drift,save)).toBe('PERSONAL BEST · 3210 PTS');
    expect(activityRecordText(scenic,save)).toBe('DISCOVERED');
  });
});
