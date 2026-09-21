import { Color3, StandardMaterial, type Material, type Mesh, type Scene } from '@babylonjs/core';
import { CELL_SIZE, terrainHeight, junctionRadius, nearestRoad } from '../content/world';
import { TRAFFIC_GRAPH } from '../content/traffic-network';
import { samplePath, signalAspect, type LaneJunction } from '../sim/lane-graph';
import { Geometry } from './geometry';

export interface SignalMesh {junction:LaneJunction;group:number;aspect:'red'|'amber'|'green';mesh:Mesh}
export interface CrosswalkBand {x:number;y:number;z:number;width:number;depth:number;yaw:number}
export interface CornerWalkQuad {innerA:{x:number;y:number;z:number};outerA:{x:number;y:number;z:number};innerB:{x:number;y:number;z:number};outerB:{x:number;y:number;z:number}}

/** Markings derive from the same incoming lane endpoint as the signal and stop
 * bar, so visual crossing geometry cannot drift away from traffic rules. */
export function signalCrosswalk(pathId:string):CrosswalkBand[]{
  const path=TRAFFIC_GRAPH.paths.get(pathId);if(!path||path.kind!=='lane'||path.laneIndex!==0)return [];
  const end=samplePath(path,path.length),road=TRAFFIC_GRAPH.roads.find(road=>road.id===path.roadId);if(!road)return [];
  const forward={x:Math.sin(end.yaw),z:Math.cos(end.yaw)};
  return Array.from({length:6},(_,index)=>{const distance=.4+index*.65;return {x:end.x-forward.x*distance,y:end.y+.047,z:end.z-forward.z*distance,width:road.width-.8,depth:.34,yaw:end.yaw};});
}
/** Concrete corner walks bridge the gap between road-parallel sidewalks while
 * leaving every authored approach open. They are visual pedestrian space over
 * the existing junction collision apron, so vehicle contacts/rules are unchanged. */
export function signalCornerWalks(junctionId:string):CornerWalkQuad[]{
  const junction=TRAFFIC_GRAPH.junctions.get(junctionId);if(!junction||junction.control!=='signal')return [];
  const radius=junctionRadius(junction),inner=radius-.12,outer=radius+2.58,segments=96,roads=new Set(junction.roads),result:CornerWalkQuad[]=[];
  const p=(r:number,a:number)=>{const x=junction.x+Math.cos(a)*r,z=junction.z+Math.sin(a)*r;return {x,y:terrainHeight(x,z)+.178,z};};
  for(let segment=0;segment<segments;segment++){
    const a=segment/segments*Math.PI*2,b=(segment+1)/segments*Math.PI*2,quad={innerA:p(inner,a),outerA:p(outer,a),innerB:p(inner,b),outerB:p(outer,b)};
    const encroaches=(vertex:CornerWalkQuad['innerA'],margin:number)=>{const near=nearestRoad(vertex.x,vertex.z,road=>roads.has(road.id),1);return near.distance<near.road.width/2+margin;};
    if(encroaches(quad.innerA,.28)||encroaches(quad.innerB,.28)||encroaches(quad.outerA,.02)||encroaches(quad.outerB,.02))continue;
    result.push(quad);
  }
  return result;
}
export class TrafficScenery {
  private lamps:Record<'red'|'amber'|'green',StandardMaterial>;
  constructor(private scene:Scene){
    const lamp=(name:string,color:string)=>{const m=new StandardMaterial(name,scene);m.diffuseColor=Color3.Black();m.emissiveColor=Color3.FromHexString(color);m.disableLighting=true;return m;};
    this.lamps={red:lamp('signal-red','#ff443c'),amber:lamp('signal-amber','#ffc247'),green:lamp('signal-green','#51e990')};
  }
  createCell(cx:number,cz:number,materials:{road:Material;white:Material;dark:Material;sidewalk:Material},attach:(mesh:Mesh|null,collision?:boolean)=>void):SignalMesh[]{
    const signals:SignalMesh[]=[],pavement=new Geometry(),sidewalk=new Geometry(),paint=new Geometry(),poles=new Geometry();
    for(const junction of TRAFFIC_GRAPH.junctions.values()){
      if(Math.floor(junction.x/CELL_SIZE)!==cx||Math.floor(junction.z/CELL_SIZE)!==cz)continue;
      // Grade-following radial rings make a smooth apron boundary, without
      // staircase tile edges or overlapping old shoulders through the junction.
      const radius=junctionRadius(junction),rings=Math.ceil(radius/2),segments=64;
      const p=(r:number,a:number)=>{const x=junction.x+Math.cos(a)*r,z=junction.z+Math.sin(a)*r;return {x,y:terrainHeight(x,z)+.16,z};};
      for(let ring=0;ring<rings;ring++)for(let segment=0;segment<segments;segment++){const r=ring/rings*radius,s=(ring+1)/rings*radius,a=segment/segments*Math.PI*2,b=(segment+1)/segments*Math.PI*2;pavement.quad(p(r,a),p(s,a),p(r,b),p(s,b));}
      if(junction.control==='turnaround')continue;
      for(const quad of signalCornerWalks(junction.id))sidewalk.quad(quad.innerA,quad.outerA,quad.innerB,quad.outerB);
      const groups=new Map<number,Record<'red'|'amber'|'green',Geometry>>();
      for(const id of junction.incoming){
        const path=TRAFFIC_GRAPH.paths.get(id)!;if(path.laneIndex!==0)continue;
        const end=samplePath(path,path.length),road=TRAFFIC_GRAPH.roads.find(r=>r.id===path.roadId)!,halfLane=road.width/road.lanes*.5;
        const right={x:Math.cos(end.yaw),z:-Math.sin(end.yaw)},forward={x:Math.sin(end.yaw),z:Math.cos(end.yaw)};
        const x=end.x+right.x*(halfLane+1.1),z=end.z+right.z*(halfLane+1.1),y=terrainHeight(x,z);
        if(junction.control!=='signal'){
          // Yield bars for minor approaches, not for the through-priority road.
          if(!junction.priority.includes(path.roadId))for(let side=-halfLane;side<halfLane;side+=.8)paint.box(end.x+right.x*side,end.y+.045,end.z+right.z*side,.45,.02,.5,end.yaw);
          continue;
        }
        paint.box(end.x-forward.x*4.65,end.y+.045,end.z-forward.z*4.65,halfLane*2-.5,.02,.4,end.yaw);
        for(const band of signalCrosswalk(id))paint.box(band.x,band.y,band.z,band.width,.018,band.depth,band.yaw);
        poles.box(x,y,z,.13,4.2,.13);poles.box(x,y+3,z,.6,1.55,.35,end.yaw);
        const group=junction.signalGroups!.findIndex(g=>g.includes(path.roadId));let geometry=groups.get(group);
        if(!geometry){geometry={red:new Geometry(),amber:new Geometry(),green:new Geometry()};groups.set(group,geometry);}
        for(const [i,aspect] of (['red','amber','green'] as const).entries())geometry[aspect].box(x-forward.x*.20,y+4.13-i*.45,z-forward.z*.20,.31,.31,.06,end.yaw);
      }
      for(const [group,geometry] of groups)for(const aspect of ['red','amber','green'] as const){const mesh=geometry[aspect].mesh(`signal-${junction.id}-${group}-${aspect}`,this.scene,this.lamps[aspect]);if(mesh){mesh.isVisible=false;attach(mesh);signals.push({junction,group,aspect,mesh});}}
    }
    attach(pavement.mesh(`junctions-${cx},${cz}`,this.scene,materials.road),true);attach(paint.mesh(`stop-bars-${cx},${cz}`,this.scene,materials.white));attach(poles.mesh(`signal-poles-${cx},${cz}`,this.scene,materials.dark),true);
    attach(sidewalk.mesh(`junction-sidewalks-${cx},${cz}`,this.scene,materials.sidewalk));
    return signals;
  }
  update(signals:SignalMesh[],clock:number){for(const s of signals)s.mesh.isVisible=signalAspect(s.junction,s.group,clock)===s.aspect;}
}

export function insideJunction(x:number,z:number,roadId?:string){return [...TRAFFIC_GRAPH.junctions.values()].some(j=>(!roadId||j.roads.includes(roadId))&&Math.hypot(x-j.x,z-j.z)<(j.control==='turnaround'?16:j.radius+5));}
