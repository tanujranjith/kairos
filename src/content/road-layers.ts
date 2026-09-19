import type {Road,RoadPoint} from '../core/types';
import {lerp,smooth,wrap} from '../core/math';
import {TUNNELS} from './structures';

/** Metre-based authored structural spans. Ridgeway clears the parkway by eight metres. */
export const BRIDGES:readonly {id:string;roadId:string;start:number;end:number;rise:number;ramp:number;groundRamp?:number}[]=[
  {id:'aurelia-bridge',roadId:'northbridge',start:80,end:1430,rise:0,ramp:0},
  {id:'ridgeway-overpass',roadId:'pass',start:2944.683274852852,end:3364.683274852852,rise:8,ramp:145},
  {id:'aster-access-overpass',roadId:'circuit',start:3390,end:3505,rise:0,ramp:0,groundRamp:35},
] as const;
export const OVERPASS_CROSSING={x:924.026,z:1545.379,upper:'pass',lower:'ring'};
export function roadSpanAt(road:Road,s:number){const progress=road.loop?((s%road.length)+road.length)%road.length:s;return road.layers?.find(span=>progress>=span.start&&progress<span.end);}
export const roadLayerAt=(road:Road,s:number)=>roadSpanAt(road,s)?.id??'surface';
export function configureRoadLayers(road:Road,groundHeight?:(x:number,z:number)=>number){
  const bridges=BRIDGES.filter(b=>b.roadId===road.id),tunnels=TUNNELS.filter(t=>t.roadId===road.id);
  road.layers=[...bridges.map(b=>({id:b.id,start:b.start,end:b.end,kind:'bridge' as const})),...tunnels.map(t=>({id:t.id+'-tunnel',start:t.start,end:t.end,kind:'tunnel' as const}))].sort((a,b)=>a.start-b.start);
  const original=road.points;
  // Exact span endpoints prevent one road triangle or lane segment straddling two layers.
  const positions=[...new Set([...original.map(p=>p.s),...road.layers.flatMap(l=>[l.start,l.end])])].sort((a,b)=>a-b);
  let index=0;
  road.points=positions.map(s=>{
    while(index<original.length-2&&original[index+1].s<s)index++;
    const a=original[index],b=original[index+1],t=(s-a.s)/Math.max(.00001,b.s-a.s),terrainY=lerp(a.y,b.y,t);
    const p:RoadPoint={x:lerp(a.x,b.x,t),z:lerp(a.z,b.z,t),y:terrainY,s,yaw:a.yaw+wrap(b.yaw-a.yaw)*t,curvature:lerp(a.curvature,b.curvature,t),layer:roadLayerAt(road,s),terrainY};
    for(const bridge of bridges)if(bridge.rise&&s>=bridge.start&&s<=bridge.end)p.y+=bridge.rise*Math.min(smooth((s-bridge.start)/bridge.ramp),smooth((bridge.end-s)/bridge.ramp));
    for(const bridge of bridges)if(bridge.groundRamp&&groundHeight&&s>=bridge.start&&s<=bridge.end){
      const blend=Math.min(smooth((s-bridge.start)/bridge.groundRamp),smooth((bridge.end-s)/bridge.groundRamp));
      p.terrainY=lerp(terrainY,groundHeight(p.x,p.z),blend);
    }
    return p;
  });
}
