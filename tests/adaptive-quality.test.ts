import {describe,expect,it} from 'vitest';
import {AdaptiveQuality,benchmarkQuality,type AdaptiveGraphicsDecision} from '../src/render/adaptive-quality';

const context=(automaticQuality=true,benchmarkActive=false,adaptationActive=false,quality='Low' as const)=>({automaticQuality,benchmarkActive,adaptationActive,quality});
const feed=(policy:AdaptiveQuality,count:number,ms:number,c=context())=>{let last:AdaptiveGraphicsDecision={};for(let i=0;i<count;i++)last=policy.sample(ms,c);return last;};

describe('adaptive render quality',()=>{
  it('maps representative p95 frame time to bounded presets',()=>{
    expect(benchmarkQuality(9)).toBe('Ultra');expect(benchmarkQuality(16)).toBe('High');expect(benchmarkQuality(24)).toBe('Medium');expect(benchmarkQuality(33)).toBe('Low');
  });
  it('warms up then completes one automatic showroom benchmark',()=>{
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
