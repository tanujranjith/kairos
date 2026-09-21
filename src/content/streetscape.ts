import {ROADS,CELL_SIZE,JUNCTIONS,junctionRadius,pointAt,nearestRoad} from './world';
import type {V3} from '../core/types';

export type StreetFixtureKind='lamp'|'bench'|'bin'|'planter'|'shelter';
export interface StreetFixture extends V3 {id:string;cell:string;roadId:string;s:number;yaw:number;side:number;kind:StreetFixtureKind}
export type StreetPedestrianPose='standing'|'seated';
export interface StreetPedestrian extends V3 {id:string;cell:string;roadId:string;yaw:number;pose:StreetPedestrianPose;variant:number}

/** Authored city-road corridors; fixtures share road-distance stations across
 * cells and graphics presets. Their solids stay outside the usable shoulder. */
function fixtures():StreetFixture[]{
  const result:StreetFixture[]=[];
  for(const road of ROADS.filter(r=>r.id.startsWith('city'))){
    const put=(s:number,side:number,kind:StreetFixtureKind)=>{
      if(s>road.length-22)return;
      const p=pointAt(road,s,side*(road.width/2+(kind==='lamp'?2.3:2.0)));
      if(JUNCTIONS.some(j=>Math.hypot(p.x-j.x,p.z-j.z)<junctionRadius(j)+13))return;
      const other=nearestRoad(p.x,p.z,r=>r.id!==road.id,1);
      if(other.distance<other.road.width/2+8)return;
      result.push({id:`${road.id}-${Math.round(s)}-${kind}`,cell:`${Math.floor(p.x/CELL_SIZE)},${Math.floor(p.z/CELL_SIZE)}`,roadId:road.id,s,x:p.x,y:p.y+.035,z:p.z,yaw:p.yaw,side,kind});
    };
    for(let station=0,s=26;s<road.length-22;s+=36,station++){
      const side=station%2===0?1:-1;put(s,side,'lamp');
      if(station%3===0){put(s+11,side,station%9===0?'shelter':'bench');put(s+15,side,'bin');}
      put(s+23,side,'planter');
    }
  }
  return result;
}
export const STREET_FIXTURES:readonly StreetFixture[]=fixtures();
export const STREET_LAMPS=STREET_FIXTURES.filter(f=>f.kind==='lamp');
/** Two calm, static figures give each shelter human scale without adding AI,
 * collision bodies or a separate downloaded character asset. Their actual
 * transformed positions own the stream cell, including near cell borders. */
export const STREET_PEDESTRIANS:readonly StreetPedestrian[]=STREET_FIXTURES.filter(f=>f.kind==='shelter').flatMap((f,index)=>{
  const place=(id:string,across:number,forward:number,pose:StreetPedestrianPose,variant:number,yaw:number):StreetPedestrian=>{
    const c=Math.cos(f.yaw),s=Math.sin(f.yaw),x=f.x+across*c+forward*s,z=f.z-across*s+forward*c;
    return {id:`${f.id}-${id}`,cell:`${Math.floor(x/CELL_SIZE)},${Math.floor(z/CELL_SIZE)}`,roadId:f.roadId,x,y:f.y,z,yaw,pose,variant};
  };
  return [
    place('seated',-.03,-.58,'seated',index*2,f.yaw-f.side*Math.PI/2),
    place('waiting',-f.side*.42,1.45,'standing',index*2+1,f.yaw+Math.PI),
  ];
});
export function lampPosition(f:StreetFixture):V3{return {x:f.x-Math.cos(f.yaw)*f.side*1.8,y:f.y+7.18,z:f.z+Math.sin(f.yaw)*f.side*1.8};}
export function nearbyStreetLamps(position:V3,loaded:(cell:string)=>boolean,previous:readonly string[]=[]){
  return STREET_LAMPS.filter(f=>loaded(f.cell)&&Math.hypot(f.x-position.x,f.z-position.z)<52&&Math.abs(f.y-position.y)<9)
    .map(f=>({f,rank:Math.hypot(f.x-position.x,f.z-position.z)-(previous.includes(f.id)?7:0)}))
    .sort((a,b)=>a.rank-b.rank||a.f.id.localeCompare(b.f.id)).slice(0,2).map(({f})=>f);
}
