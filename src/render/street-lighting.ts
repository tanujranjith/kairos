import {SpotLight,Vector3,Color3,Light,type Scene} from '@babylonjs/core';
import {nearbyStreetLamps,lampPosition,type StreetFixture} from '../content/streetscape';
import {windowLighting} from './atmosphere';
import type {V3} from '../core/types';

/** Two unshadowed real lights, not one GPU light per visible pole. Ownership
 * follows loaded detail cells. Hysteresis and fading avoid rank-switch flicker. */
export class StreetLighting {
  private slots:{light:SpotLight;fixture:StreetFixture|null;weight:number}[];
  constructor(scene:Scene){
    this.slots=Array.from({length:2},(_,i)=>{
      const light=new SpotLight(`street-light-pool-${i}`,Vector3.Zero(),new Vector3(0,-1,0),2.05,1,scene);
      light.diffuse=new Color3(1,.76,.48);light.falloffType=Light.FALLOFF_GLTF;light.range=32;light.intensity=0;light.setEnabled(false);
      return {light,fixture:null,weight:0};
    });
    scene.onDisposeObservable.addOnce(()=>this.slots.forEach(s=>s.light.dispose()));
  }
  update(position:V3,time:number,dt:number,loaded:(cell:string)=>boolean,enabled:boolean){
    const night=windowLighting(time)**2;
    const desired=enabled&&night>.002?nearbyStreetLamps(position,loaded,this.slots.flatMap(s=>s.fixture?[s.fixture.id]:[])):[];
    const occupied=new Set(this.slots.flatMap(s=>s.fixture?[s.fixture.id]:[]));
    for(const slot of this.slots){
      let fadingReplacement=false;
      if(slot.fixture&&(!loaded(slot.fixture.cell)||Math.hypot(slot.fixture.x-position.x,slot.fixture.z-position.z)>100)){occupied.delete(slot.fixture.id);slot.fixture=null;slot.weight=0;}
      const wanted=slot.fixture&&desired.some(f=>f.id===slot.fixture!.id);
      if(slot.fixture&&!wanted){slot.weight*=Math.exp(-9*Math.max(0,dt));if(slot.weight<.02||!enabled||night<=.002){occupied.delete(slot.fixture.id);slot.fixture=null;slot.weight=0;fadingReplacement=true;}}
      if(!slot.fixture){const next=desired.find(f=>!occupied.has(f.id));if(next){slot.fixture=next;occupied.add(next.id);slot.weight=fadingReplacement?0:1;}}
      if(slot.fixture&&desired.some(f=>f.id===slot.fixture!.id))slot.weight=1-(1-slot.weight)*Math.exp(-6*Math.max(0,dt));
      if(slot.fixture){const f=slot.fixture,p=lampPosition(f);slot.light.position.set(p.x,p.y,p.z);slot.light.direction.set(-Math.cos(f.yaw)*f.side*.20,-1,Math.sin(f.yaw)*f.side*.20).normalize();}
      slot.light.intensity=1600*night*slot.weight;slot.light.setEnabled(enabled&&!!slot.fixture&&slot.light.intensity>1);
    }
  }
  disable(){for(const s of this.slots){s.light.setEnabled(false);s.light.intensity=0;s.fixture=null;s.weight=0;}}
  snapshot(){return this.slots.map(s=>({id:s.fixture?.id??null,cell:s.fixture?.cell??null,enabled:s.light.isEnabled(),intensity:s.light.intensity,position:s.light.position.asArray()}));}
}
