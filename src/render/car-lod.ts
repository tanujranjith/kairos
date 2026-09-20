import { TransformNode, type Scene } from '@babylonjs/core';
import type { Customization, VehicleDefinition } from '../core/types';
import { createCar, type CarVisual } from './car';
import { carDetail } from './detail-policy';

/** Two persistent visual rigs share a stable world root; neither owns a physics body. */
export function createLodCar(scene:Scene,d:VehicleDefinition,setup?:Customization):CarVisual {
  const root=new TransformNode(`lod-${d.id}`,scene),rigs=[createCar(scene,d,setup),createCar(scene,d,setup,true)];
  root.metadata={kairosCar:true};let level:0|1=1,disposed=false;
  // NPC rigs have no player cockpit: omit tiny dashboard screens from submission
  // and texture uploads. Exterior geometry, tire animation and physics are intact.
  rigs.forEach((rig,i)=>{rig.root.parent=root;rig.root.setEnabled(i===level);for(const p of rig.parts)if(p.material?.name.includes(`${d.id}-instruments`))p.isVisible=false;});
  return {
    root,groundOffset:rigs[0].groundOffset,parts:rigs.flatMap(r=>r.parts),get lod(){return level;},
    get wheels(){return rigs[level].wheels;},get paint(){return rigs[level].paint;},get glass(){return rigs[level].glass;},get lights(){return rigs[level].lights;},get tail(){return rigs[level].tail;},
    selectDetail(distance,quality){const next=carDetail(level,distance,quality);if(next===level)return;rigs[level].root.setEnabled(false);level=next;rigs[level].root.setEnabled(true);},
    // Updating both tiny pivot sets avoids one-frame wheel snapping on a detail change.
    update(state){for(const rig of rigs)rig.update(state);},
    dispose(){if(disposed)return;disposed=true;for(const rig of rigs)rig.dispose();root.dispose();},
  };
}
