import {describe,expect,it} from 'vitest';
import {AdaptiveQuality,benchmarkQuality,qualityBenchmarkActive,type AdaptiveGraphicsDecision} from '../src/render/adaptive-quality';

const context=(automaticQuality=true,benchmarkActive=false,adaptationActive=false,quality='Low' as const)=>({automaticQuality,benchmarkActive,adaptationActive,quality});
const feed=(policy:AdaptiveQuality,count:number,ms:number,c=context())=>{let last:AdaptiveGraphicsDecision={};for(let i=0;i<count;i++)last=policy.sample(ms,c);return last;};

describe('adaptive render quality',()=>{
  it('maps representative p95 frame time to bounded presets',()=>{
    expect(benchmarkQuality(9)).toBe('Ultra');expect(benchmarkQuality(16)).toBe('High');expect(benchmarkQuality(24)).toBe('Medium');expect(benchmarkQuality(33)).toBe('Low');
  });
  it('only admits loaded, grounded, moving gameplay to the preset benchmark',()=>{
    for(const screen of ['home','garage','settings','pause','map','results'] as const)expect(qualityBenchmarkActive(screen,20,true,true)).toBe(false);
    expect(qualityBenchmarkActive('drive',20,true,true)).toBe(true);
    expect(qualityBenchmarkActive('drive',-8,true,true)).toBe(true);
    expect(qualityBenchmarkActive('drive',4,true,true)).toBe(false);
    expect(qualityBenchmarkActive('drive',20,false,true)).toBe(false);
    expect(qualityBenchmarkActive('drive',20,true,false)).toBe(false);
  });
  it('warms up then completes one automatic moving-gameplay benchmark',()=>{
    const policy=new AdaptiveQuality();policy.reset(true);
    const result=feed(policy,150,16,context(true,true,false));
    expect(result).toEqual({quality:'High',dynamicScale:1,benchmarkComplete:true});
    expect(policy.state()).toMatchObject({phase:'complete',benchmarkP95:16,benchmarkSamples:120,dynamicScale:1});
    expect(feed(policy,200,9,context(true,true,false))).toEqual({});
  });
  it('never changes the preset in manual mode',()=>{
    const policy=new AdaptiveQuality();policy.reset(false);
    expect(feed(policy,500,9,context(false,true,false,'Low'))).toEqual({});
    expect(policy.state().phase).toBe('manual');
  });
  it('restores a reduced parked resolution before warming up the moving benchmark',()=>{
    const policy=new AdaptiveQuality();policy.reset(true);
    feed(policy,720,45,context(true,false,true));expect(policy.state().dynamicScale).toBe(.7);
    expect(policy.sample(16,context(true,true,true))).toEqual({dynamicScale:1});
    expect(feed(policy,149,16,context(true,true,true))).toEqual({quality:'High',dynamicScale:1,benchmarkComplete:true});
  });
  it('keeps benchmark resolution fixed and resumes adaptation after selecting the preset',()=>{
    const policy=new AdaptiveQuality();policy.reset(true);
    expect(feed(policy,120,45,context(true,true,true))).toEqual({});expect(policy.state().dynamicScale).toBe(1);
    feed(policy,240,45,context(true,false,true));expect(policy.state().dynamicScale).toBe(1);
    expect(feed(policy,30,45,context(true,true,true))).toEqual({quality:'Low',dynamicScale:1,benchmarkComplete:true});
    expect(feed(policy,120,45,context(true,false,true))).toEqual({dynamicScale:.95});
  });
  it('reduces displayed resolution after sustained overload and stops at 70 percent',()=>{
    const policy=new AdaptiveQuality();policy.reset(false);const changes:number[]=[];
    for(let window=0;window<9;window++){const decision=feed(policy,120,45,context(false,false,true));if('dynamicScale' in decision)changes.push(decision.dynamicScale!);}
    expect(changes).toEqual([.95,.9,.85,.8,.75,.7]);expect(policy.state().dynamicScale).toBe(.7);expect(policy.state().recentP95).toBe(45);
  });
  it('uses three healthy windows per recovery step to avoid oscillation',()=>{
    const policy=new AdaptiveQuality();policy.reset(false);feed(policy,120,50,context(false,false,true));expect(policy.state().dynamicScale).toBe(.95);
    expect(feed(policy,240,20,context(false,false,true))).toEqual({});expect(feed(policy,120,20,context(false,false,true))).toEqual({dynamicScale:1});
  });
  it('ignores loading stalls and inactive gameplay',()=>{
    const policy=new AdaptiveQuality();policy.reset(true);feed(policy,400,250,context(true,true,true));expect(policy.state()).toMatchObject({phase:'waiting',benchmarkSamples:0,dynamicScale:1});
    feed(policy,500,45,context(true,false,false));expect(policy.state().dynamicScale).toBe(1);
  });
});
