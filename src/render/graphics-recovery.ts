export type GraphicsRecoveryPhase='ready'|'recovering'|'failed';
export interface GraphicsRecoverySnapshot {phase:GraphicsRecoveryPhase;attempts:number;resumeRequested:boolean;durationMs:number;message:string}

export function isExpectedGraphicsCancellation(reason:unknown,recovering:boolean){
  if(!recovering||typeof reason!=='object'||reason===null)return false;const error=reason as {name?:unknown;message?:unknown};return error.name==='AbortError'&&typeof error.message==='string'&&/mapAsync.*GPUBuffer|GPUBuffer.*unmapped/i.test(error.message);
}

/** Tokened state keeps late timeout/restore callbacks from changing a newer recovery. */
export class GraphicsRecovery {
  private token=0;private phase:GraphicsRecoveryPhase='ready';private attempts=0;private resumeRequested=false;private started=0;private durationMs=0;private message='';
  begin(now:number,resumeRequested:boolean){this.token++;this.phase='recovering';this.attempts++;this.resumeRequested=resumeRequested;this.started=now;this.durationMs=0;this.message='Graphics device interrupted. Rebuilding local rendering resources…';return this.token;}
  activeToken(){return this.token;}
  isReady(){return this.phase==='ready';}
  isCurrent(token:number){return token===this.token;}
  private isPending(token:number){return this.isCurrent(token)&&this.phase==='recovering';}
  fail(token:number,now:number,message:string){if(!this.isPending(token))return false;this.phase='failed';this.durationMs=Math.max(0,now-this.started);this.message=message;return true;}
  succeed(token:number,now:number){if(!this.isPending(token))return false;this.phase='ready';this.durationMs=Math.max(0,now-this.started);this.message='';return true;}
  snapshot():GraphicsRecoverySnapshot{return {phase:this.phase,attempts:this.attempts,resumeRequested:this.resumeRequested,durationMs:this.durationMs,message:this.message};}
}
