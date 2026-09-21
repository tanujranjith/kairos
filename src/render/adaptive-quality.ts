import type {Quality} from '../core/types';

export type AdaptiveQualityPhase='waiting'|'benchmarking'|'complete'|'manual';
export interface AdaptiveGraphicsState {
  phase:AdaptiveQualityPhase;
  benchmarkP95:number;
  dynamicScale:number;
  recentP95:number;
  benchmarkSamples:number;
}
export interface AdaptiveGraphicsContext {
  automaticQuality:boolean;
  benchmarkActive:boolean;
  adaptationActive:boolean;
  quality:Quality;
}
export interface AdaptiveGraphicsDecision {quality?:Quality;dynamicScale?:number;benchmarkComplete?:boolean}

const percentile=(values:number[],p:number)=>{
  if(!values.length)return 0;
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*p)-1))];
};
export const benchmarkQuality=(p95:number):Quality=>p95<=10?'Ultra':p95<=16.5?'High':p95<=25?'Medium':'Low';

/**
 * Render-only adaptive policy. It deliberately knows nothing about simulation time:
 * callers submit displayed-frame intervals, and controlled-time physics never reaches it.
 */
export class AdaptiveQuality {
  private phase:AdaptiveQualityPhase='waiting';
  private benchmark:number[]=[];
  private adaptation:number[]=[];
  private warmup=30;
  private healthyWindows=0;
  private benchmarkP95=0;
  private recentP95=0;
  private dynamicScale=1;

  reset(automaticQuality:boolean){
    this.phase=automaticQuality?'waiting':'manual';this.benchmark=[];this.adaptation=[];this.warmup=30;this.healthyWindows=0;this.benchmarkP95=0;this.recentP95=0;this.dynamicScale=1;
  }
  state():AdaptiveGraphicsState{return {phase:this.phase,benchmarkP95:this.benchmarkP95,dynamicScale:this.dynamicScale,recentP95:this.recentP95,benchmarkSamples:this.benchmark.length};}
  sample(frameMs:number,context:AdaptiveGraphicsContext):AdaptiveGraphicsDecision {
    if(!Number.isFinite(frameMs)||frameMs<1||frameMs>100)return {};
    if(!context.automaticQuality&&this.phase!=='manual')this.reset(false);
    if(context.automaticQuality&&this.phase==='manual')this.reset(true);
    if(context.automaticQuality&&(this.phase==='waiting'||this.phase==='benchmarking')&&context.benchmarkActive){
      this.phase='benchmarking';
      if(this.warmup>0)this.warmup--;
      else this.benchmark.push(frameMs);
      if(this.benchmark.length>=120){
        this.benchmarkP95=percentile(this.benchmark,.95);this.phase='complete';this.adaptation=[];this.healthyWindows=0;this.dynamicScale=1;
        return {quality:benchmarkQuality(this.benchmarkP95),dynamicScale:1,benchmarkComplete:true};
      }
    }
    if(!context.adaptationActive)return {};
    this.adaptation.push(frameMs);
    if(this.adaptation.length<120)return {};
    this.recentP95=percentile(this.adaptation,.95);this.adaptation=[];
    if(this.recentP95>40){
      this.healthyWindows=0;const next=Math.max(.7,Math.round((this.dynamicScale-.05)*100)/100);
      if(next!==this.dynamicScale){this.dynamicScale=next;return {dynamicScale:next};}
    }else if(this.recentP95<28&&this.dynamicScale<1){
      this.healthyWindows++;
      if(this.healthyWindows>=3){this.healthyWindows=0;const next=Math.min(1,Math.round((this.dynamicScale+.05)*100)/100);this.dynamicScale=next;return {dynamicScale:next};}
    }else this.healthyWindows=0;
    return {};
  }
}
