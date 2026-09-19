import type { Quality } from '../core/types';
import type { CellBlueprint } from './cell-blueprint';
type Pending={resolve:(blueprint:CellBlueprint)=>void;reject:(error:Error)=>void;cleanup:()=>void};
export class CellWorkerClient {
  private worker:Worker|null=null;private nextId=0;private pending=new Map<number,Pending>();
  private open(){
    if(this.worker)return this.worker;
    const worker=new Worker(new URL('./cell-worker.ts',import.meta.url),{type:'module',name:'Kairos world generator'});
    worker.onmessage=(event:MessageEvent<{id:number;blueprint:CellBlueprint;error?:string}>)=>{const request=this.pending.get(event.data.id);if(!request)return;this.pending.delete(event.data.id);request.cleanup();if(event.data.error)request.reject(new Error(event.data.error));else request.resolve(event.data.blueprint);};
    worker.onerror=event=>{event.preventDefault();this.close(new Error('World-generation worker failed to load or execute. Retry the world load.'));};this.worker=worker;return worker;
  }
  build(cx:number,cz:number,quality:Quality,signal:AbortSignal):Promise<CellBlueprint>{
    return new Promise((resolve,reject)=>{
      if(signal.aborted){reject(new DOMException('Cell request cancelled','AbortError'));return;}
      let worker:Worker;try{worker=this.open();}catch(error){reject(error);return;}
      const id=++this.nextId,abort=()=>{this.pending.delete(id);clearTimeout(timeout);reject(new DOMException('Cell request cancelled','AbortError'));};
      const timeout=setTimeout(()=>this.close(new Error('World-generation request timed out. Retry the world load.')),30000);
      signal.addEventListener('abort',abort,{once:true});this.pending.set(id,{resolve,reject,cleanup:()=>{clearTimeout(timeout);signal.removeEventListener('abort',abort);}});
      try{worker.postMessage({id,cx,cz,quality});}catch(error){const request=this.pending.get(id);this.pending.delete(id);request?.cleanup();reject(error);}
    });
  }
  close(error=new Error('World generator closed')){this.worker?.terminate();this.worker=null;for(const request of this.pending.values()){request.cleanup();request.reject(error);}this.pending.clear();}
}
