import {describe,it,expect} from 'vitest';
import {preparePresentation,renderPreparationFrame,waitForPresentationReady} from '../src/core/presentation-ready';

describe('initial presentation readiness',()=>{
  it('submits each standalone engine frame before yielding, including failed draws',()=>{
    const events:string[]=[],engine={beginFrame:()=>{events.push('begin');},endFrame:()=>{events.push('end');}};
    renderPreparationFrame(engine,()=>{events.push('draw');});expect(events).toEqual(['begin','draw','end']);
    expect(()=>renderPreparationFrame(engine,()=>{events.push('failed');throw new Error('render failed');})).toThrow('render failed');
    expect(events).toEqual(['begin','draw','end','begin','failed','end']);
  });
  it('draws through capture and binding without using a fixed sleep as readiness',async()=>{
    let draws=0,clock=0;
    const states=[false,false,true,false,true,true];
    await preparePresentation(()=>draws++,()=>states[draws-1],{now:()=>clock,yieldFrame:async()=>{clock++;}});
    expect(draws).toBe(6);expect(clock).toBe(5);
  });
  it('bounds resource failure and preserves the loading error path',async()=>{
    let clock=0,draws=0;
    await expect(preparePresentation(()=>draws++,()=>false,{now:()=>clock,yieldFrame:async()=>{clock+=10;},timeoutMs:30})).rejects.toThrow('Graphics preparation timed out');
    expect(draws).toBe(3);
  });
  it('does not swallow render errors',async()=>{
    await expect(preparePresentation(()=>{throw new Error('device lost');},()=>true)).rejects.toThrow('device lost');
  });
  it('waits for rebuilt resources without submitting premature frames',async()=>{
    let clock=0,checks=0;
    await waitForPresentationReady(()=>++checks===4,{now:()=>clock,yieldFrame:async()=>{clock+=5;}});
    expect(checks).toBe(4);expect(clock).toBe(15);
  });
});
