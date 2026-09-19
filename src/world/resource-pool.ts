/** Leases are idempotent; the final owner alone disposes a shared resource. */
export class ResourcePool<T>{
  private entries=new Map<string,{resource:T;references:number;bytes:number}>();
  constructor(private dispose:(resource:T)=>void){}
  acquire(key:string,create:()=>T,bytes=0){
    let entry=this.entries.get(key);if(!entry){entry={resource:create(),references:0,bytes};this.entries.set(key,entry);}entry.references++;let released=false;
    return {resource:entry.resource,release:()=>{if(released)return;released=true;const current=this.entries.get(key);if(!current)return;if(--current.references===0){this.entries.delete(key);this.dispose(current.resource);}}};
  }
  snapshot(){return {resources:this.entries.size,references:[...this.entries.values()].reduce((sum,e)=>sum+e.references,0),bytes:[...this.entries.values()].reduce((sum,e)=>sum+e.bytes,0)};}
}
