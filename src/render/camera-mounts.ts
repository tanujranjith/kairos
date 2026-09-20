import type { VehicleDefinition,V3 } from '../core/types';

/** Visual mount coordinates are shared by live cameras and exported GLB markers. */
export function cameraMounts(d:VehicleDefinition):{cockpit:V3;hood:V3;bumper:V3}{
  return {
    cockpit:{x:d.class==='FORMULA'?0:-.34,y:d.class==='FORMULA'?.175:d.height-(.32+d.wheelRadius)-.17,z:-.32},
    hood:{x:0,y:d.id==='crest'?.37:.28,z:d.length*.31},
    bumper:{x:0,y:-.12,z:d.length*.5+.26},
  };
}
