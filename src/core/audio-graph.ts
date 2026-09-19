import { clamp, rng } from './math';
import type { drivingMix } from './audio-mix';

export type DrivingMix=ReturnType<typeof drivingMix>;

/** Same original synthesis graph in real-time playback and OfflineAudioContext tests. */
export function createDrivingAudioGraph(ctx:BaseAudioContext){
  const sources:AudioScheduledSourceNode[]=[],nodes:AudioNode[]=[];
  const track=<T extends AudioNode>(node:T)=>{nodes.push(node);return node;};
  const gain=(value=0)=>{const n=track(ctx.createGain());n.gain.value=value;return n;};
  const filter=(type:BiquadFilterType,hz:number,q=.7)=>{const n=track(ctx.createBiquadFilter());n.type=type;n.frequency.value=hz;n.Q.value=q;return n;};
  const bus=gain(1),cabin=filter('lowpass',18000),master=gain(),limiter=track(ctx.createDynamicsCompressor());
  limiter.threshold.value=-9;limiter.knee.value=6;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.12;
  bus.connect(cabin);cabin.connect(master);master.connect(limiter);limiter.connect(ctx.destination);
  const engineGain=gain(),engineFilter=filter('lowpass',1100);engineGain.connect(engineFilter);engineFilter.connect(bus);
  const oscillator=(type:OscillatorType,hz:number,level:number,target:AudioNode)=>{
    const o=track(ctx.createOscillator()),g=gain(level);o.type=type;o.frequency.value=hz;o.connect(g);g.connect(target);o.start();sources.push(o);return o;
  };
  const engine=[oscillator('sawtooth',40,.24,engineGain),oscillator('triangle',80,.14,engineGain),oscillator('triangle',160,.09,engineGain)];
  const whineGain=gain(),whine=oscillator('sine',100,1,whineGain);whineGain.connect(bus);
  const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),samples=buffer.getChannelData(0),random=rng(27183);
  for(let i=0;i<samples.length;i++)samples[i]=random()*2-1;
  const noise=(type:BiquadFilterType,hz:number,offset:number)=>{
    const source=track(ctx.createBufferSource()),f=filter(type,hz),g=gain();source.buffer=buffer;source.loop=true;source.connect(f);f.connect(g);g.connect(bus);source.start(0,offset);sources.push(source);return {gain:g,filter:f};
  };
  const tires=noise('bandpass',1850,0),road=noise('lowpass',500,.3),wind=noise('lowpass',420,.7),rain=noise('highpass',2400,1.1);
  const tunnelSend=gain(),delay=track(ctx.createDelay(.3)),echoFilter=filter('lowpass',2200),feedback=gain(.28);
  delay.delayTime.value=.087;bus.connect(tunnelSend);tunnelSend.connect(delay);delay.connect(echoFilter);echoFilter.connect(cabin);echoFilter.connect(feedback);feedback.connect(delay);
  const target=(param:AudioParam,value:number,time:number,tau=.045)=>param.setTargetAtTime(value,time,tau);
  let lastGear:number|undefined,shiftUntil=0;
  return {
    master,
    update(mix:DrivingMix,gear:number,volume:number,active:boolean,time=ctx.currentTime){
      target(master.gain,active?clamp(volume,0,1)*.7:0,time,.04);
      engine.forEach((o,i)=>target(o.frequency,mix.engineHz*[.5,1,2.015][i],time,.025));
      engineGain.gain.cancelScheduledValues(time);
      if(lastGear!==undefined&&gear!==lastGear){shiftUntil=time+.06;engineGain.gain.setValueAtTime(.012,time);}
      target(engineGain.gain,mix.engineGain,Math.max(time,shiftUntil),.035);
      lastGear=gear;
      target(engineFilter.frequency,mix.engineCutoff,time);
      target(whine.frequency,mix.whineHz,time);target(whineGain.gain,mix.whineGain,time);
      target(tires.gain.gain,mix.tireGain,time,.08);target(road.gain.gain,mix.roadGain,time,.1);target(road.filter.frequency,mix.roadHz,time,.1);
      target(wind.gain.gain,mix.windGain,time,.12);target(rain.gain.gain,mix.rainGain,time,.2);
      target(cabin.frequency,mix.cabinCutoff,time,.1);target(tunnelSend.gain,mix.tunnelGain,time,.12);
    },
    impact(strength:number){
      const t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.setValueAtTime(90,t);o.frequency.exponentialRampToValueAtTime(30,t+.12);g.gain.setValueAtTime(clamp(strength,0,.35),t);g.gain.exponentialRampToValueAtTime(.001,t+.18);o.connect(g);g.connect(bus);o.onended=()=>{o.disconnect();g.disconnect();};o.start();o.stop(t+.2);
    },
    pause(){target(master.gain,0,ctx.currentTime,.025);},
    dispose(){for(const source of sources)source.stop();for(const node of nodes)node.disconnect();},
  };
}
