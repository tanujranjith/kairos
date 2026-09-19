import type { VehicleState, VehicleDefinition } from './types';
import { clamp } from './math';
export class DrivingAudio {
  private context:AudioContext|null=null;private master:GainNode|null=null;private engine:OscillatorNode[]=[];private engineGain:GainNode|null=null;private tireGain:GainNode|null=null;private windGain:GainNode|null=null;private engineFilter:BiquadFilterNode|null=null;private lastGear=1;
  async start(){if(this.context){await this.context.resume();return;}const ctx=new AudioContext();this.context=ctx;this.master=ctx.createGain();this.master.connect(ctx.destination);this.master.gain.value=0;
    this.engineGain=ctx.createGain();this.engineFilter=ctx.createBiquadFilter();this.engineFilter.type='lowpass';this.engineFilter.frequency.value=1100;this.engineGain.connect(this.engineFilter);this.engineFilter.connect(this.master);
    for(let i=0;i<3;i++){const o=ctx.createOscillator();o.type=i===0?'sawtooth':'triangle';const g=ctx.createGain();g.gain.value=[.24,.14,.09][i];o.connect(g);g.connect(this.engineGain);o.start();this.engine.push(o);}
    const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),samples=buffer.getChannelData(0);let previous=0;for(let i=0;i<samples.length;i++){previous=.94*previous+.06*(Math.random()*2-1);samples[i]=previous*3;}
    const noise=(freq:number)=>{const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=freq;const gain=ctx.createGain();gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(this.master!);source.start();return gain;};this.tireGain=noise(1850);this.windGain=noise(420);await ctx.resume();
  }
  update(s:VehicleState,d:VehicleDefinition,throttle:number,volume:number,active:boolean,cockpit:boolean,rain:number){const ctx=this.context;if(!ctx||!this.master||!this.engineGain)return;const t=ctx.currentTime;this.master.gain.setTargetAtTime(active?volume*.35:0,t,.1);const cylinders=d.class==='FORMULA'?6:d.id==='nova'?8:4;
    this.engine.forEach((o,i)=>o.frequency.setTargetAtTime(Math.max(25,s.rpm/60*cylinders/2)*[.5,1,2.015][i],t,.03));this.engineGain.gain.setTargetAtTime(.11+throttle*.2+s.rpm/d.redline*.1,t,.03);this.engineFilter!.frequency.setTargetAtTime((cockpit?500:850)+throttle*1700+s.rpm*.12,t,.05);
    const slip=Math.max(...s.wheels.map(w=>w.slip));this.tireGain!.gain.setTargetAtTime(clamp((slip-.10)*Math.abs(s.speed)*.12,0,.65),t,.08);this.windGain!.gain.setTargetAtTime(clamp(Math.abs(s.speed)/110,0,.45)+rain*.15,t,.1);
    if(s.gear!==this.lastGear){this.engineGain.gain.setValueAtTime(.025,t);this.lastGear=s.gear;}
  }
  impact(strength:number){const ctx=this.context;if(!ctx||!this.master)return;const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.setValueAtTime(90,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(30,ctx.currentTime+.12);g.gain.setValueAtTime(clamp(strength,0,.35),ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.18);o.connect(g);g.connect(this.master);o.start();o.stop(ctx.currentTime+.2);}
  pause(){this.master?.gain.setTargetAtTime(0,this.context!.currentTime,.03);}
}
