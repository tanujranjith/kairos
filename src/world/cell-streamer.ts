import type { CellDemand } from './cell-manifest';

type Status='queued'|'loading'|'ready'|'failed';
export interface CellRecord<Blueprint,Resource>{demand:CellDemand;status:Status;controller:AbortController;blueprint?:Blueprint;resource?:Resource;error?:string}
export interface StreamAdapter<Blueprint,Resource>{
  load:(demand:CellDemand,signal:AbortSignal)=>Promise<Blueprint>;
  install:(blueprint:Blueprint,demand:CellDemand)=>Resource;
  mode:(resource:Resource,blueprint:Blueprint,demand:CellDemand)=>void;
  dispose:(resource:Resource)=>void;
}
/** Epoch-safe load transactions. Removed/cancelled completions cannot allocate resources. */
export class CellStreamer<Blueprint,Resource>{
  records=new Map<string,CellRecord<Blueprint,Resource>>();
  loaded=0;cancelled=0;failed=0;disposed=0;peak=0;private active=0;private listeners=new Set<()=>void>();
  constructor(private adapter:StreamAdapter<Blueprint,Resource>,private concurrency=1){}
  setDemand(demand:Map<string,CellDemand>){
    for(const [key,record]of this.records)if(!demand.has(key)){this.remove(record);this.records.delete(key);}
    for(const [key,next]of demand){const record=this.records.get(key);
      if(!record){this.records.set(key,{demand:next,status:'queued',controller:new AbortController()});continue;}
      const changed=record.demand.collision!==next.collision||record.demand.detail!==next.detail;record.demand=next;
      if(changed&&record.status==='ready')try{this.adapter.mode(record.resource!,record.blueprint!,next);}catch(error){this.fail(record,error);}
    }
    this.pump();this.notify();
  }
  private pump(){
    while(this.active<this.concurrency){
      const record=[...this.records.values()].filter(r=>r.status==='queued').sort((a,b)=>a.demand.priority-b.demand.priority)[0];if(!record)return;
      record.status='loading';this.active++;
      Promise.resolve().then(()=>this.adapter.load(record.demand,record.controller.signal)).then(blueprint=>{
        if(record.controller.signal.aborted||this.records.get(record.demand.id)!==record)return;
        record.blueprint=blueprint;record.resource=this.adapter.install(blueprint,record.demand);record.status='ready';this.loaded++;this.peak=Math.max(this.peak,[...this.records.values()].filter(r=>r.status==='ready').length);
      }).catch(error=>{if(!record.controller.signal.aborted&&this.records.get(record.demand.id)===record)this.fail(record,error);}).finally(()=>{this.active--;this.notify();this.pump();});
    }
  }
  private fail(record:CellRecord<Blueprint,Resource>,error:unknown){if(record.resource){this.adapter.dispose(record.resource);record.resource=undefined;this.disposed++;}record.status='failed';record.error=String(error);this.failed++;}
  private remove(record:CellRecord<Blueprint,Resource>){record.controller.abort();if(record.status==='queued'||record.status==='loading')this.cancelled++;if(record.resource){this.adapter.dispose(record.resource);this.disposed++;record.resource=undefined;}}
  private notify(){for(const listener of [...this.listeners])listener();}
  has(key:string,collision=false){const record=this.records.get(key);return record?.status==='ready'&&(!collision||record.demand.collision);}
  waitFor(keys:string[]){
    return new Promise<void>((resolve,reject)=>{
      const check=()=>{const records=keys.map(key=>this.records.get(key)),failed=records.find(r=>r?.status==='failed');if(failed){this.listeners.delete(check);reject(new Error(failed.error));}else if(records.some(r=>!r)){this.listeners.delete(check);reject(new DOMException('World load cancelled','AbortError'));}else if(records.every(r=>r?.status==='ready')){this.listeners.delete(check);resolve();}};
      this.listeners.add(check);check();
    });
  }
  retry(){for(const record of this.records.values())if(record.status==='failed'){record.controller=new AbortController();record.status='queued';record.error=undefined;}this.pump();this.notify();}
  /** Used only by deterministic physical rigs requiring immediate collision construction. */
  adopt(demand:CellDemand,blueprint:Blueprint){const previous=this.records.get(demand.id);if(previous)this.remove(previous);const resource=this.adapter.install(blueprint,demand);this.records.set(demand.id,{demand,blueprint,resource,status:'ready',controller:new AbortController()});this.loaded++;this.notify();return resource;}
  clear(){for(const record of this.records.values())this.remove(record);this.records.clear();this.notify();}
  snapshot(){return {queued:[...this.records.values()].filter(r=>r.status==='queued').length,loading:[...this.records.values()].filter(r=>r.status==='loading').length,ready:[...this.records.values()].filter(r=>r.status==='ready').length,errors:[...this.records.values()].filter(r=>r.status==='failed').map(r=>({cell:r.demand.id,error:r.error})),loaded:this.loaded,cancelled:this.cancelled,failed:this.failed,disposed:this.disposed,peak:this.peak};}
}
