import type { VehicleState, VehicleDefinition } from './types';
import { drivingMix, tunnelEnclosure } from './audio-mix';
import { createDrivingAudioGraph } from './audio-graph';
export class DrivingAudio {
  private context:AudioContext|null=null;
  private graph:ReturnType<typeof createDrivingAudioGraph>|null=null;
  private unlock=(event:Event)=>{if(event.isTrusted&&this.context?.state==='suspended')void this.context.resume().catch(()=>{});};
  constructor(){window.addEventListener('pointerdown',this.unlock,{capture:true,passive:true});window.addEventListener('keydown',this.unlock,true);}
  get needsGesture(){return this.context?.state==='suspended';}
  async start(){
    if(!this.context){this.context=new AudioContext();this.graph=createDrivingAudioGraph(this.context);}
    // A controller has no browser user-activation privilege. The caller must not await this.
    await this.context.resume();
  }
  update(s:VehicleState,d:VehicleDefinition,throttle:number,volume:number,active:boolean,cockpit:boolean,wetness:number,raining=false){
    if(!this.graph)return;
    this.graph.update(drivingMix(s,d,throttle,{cockpit,wetness,rain:raining?1:0,tunnel:active?tunnelEnclosure(s.position):0}),s.gear,volume,active);
  }
  impact(strength:number){this.graph?.impact(strength);}
  pause(){this.graph?.pause();}
  async dispose(){window.removeEventListener('pointerdown',this.unlock,true);window.removeEventListener('keydown',this.unlock,true);this.graph?.dispose();await this.context?.close();this.graph=null;this.context=null;}
}
