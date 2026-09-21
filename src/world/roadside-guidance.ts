import {CELL_SIZE,JUNCTIONS,ROADS,inLake,junctionRadius,pointAt,terrainHeight} from '../content/world';
import {roadSpanAt} from '../content/road-layers';

export interface RoadsideDelineator {
  roadId:string;
  progress:number;
  side:-1|1;
  x:number;
  y:number;
  z:number;
  yaw:number;
}
export interface RoadsideChevron extends RoadsideDelineator {curvature:number}

interface GuidanceCell {delineators:RoadsideDelineator[];chevrons:RoadsideChevron[]}

// These are the authored two-lane scenic routes. Urban streets have their own
// furniture, while highways, private access roads and the circuit use barriers.
const GUIDED_ROADS=new Set(['lakeshore','northbridge','pass','forest','south']);
const cells=new Map<string,GuidanceCell>();
const cell=(x:number,z:number)=>{
  const key=`${Math.floor(x/CELL_SIZE)},${Math.floor(z/CELL_SIZE)}`,entry=cells.get(key)??{delineators:[],chevrons:[]};
  cells.set(key,entry);return entry;
};
const clear=(x:number,z:number)=>!inLake(x,z)&&!JUNCTIONS.some(j=>Math.hypot(j.x-x,j.z-z)<junctionRadius(j)+10);

for(const road of ROADS){
  if(!GUIDED_ROADS.has(road.id))continue;
  // A regular road-distance cadence remains continuous across streamed cells.
  // The offset leaves the gravel shoulder clear for recoverable excursions.
  for(let s=48;s<road.length-48;s+=42){
    if(roadSpanAt(road,s))continue;
    for(const side of [-1,1] as const){
      const p=pointAt(road,s,side*(road.width/2+2.05));
      if(!clear(p.x,p.z))continue;
      cell(p.x,p.z).delineators.push({roadId:road.id,progress:s,side,x:p.x,y:terrainHeight(p.x,p.z),z:p.z,yaw:p.yaw});
    }
  }
  if(road.id==='pass'){
    let last=-Infinity;
    for(const sample of road.points){
      if(sample.s<80||sample.s>road.length-80||Math.abs(sample.curvature)<.0065||sample.s-last<28||roadSpanAt(road,sample.s))continue;
      const side:1|-1=sample.curvature>0?-1:1,p=pointAt(road,sample.s,side*(road.width/2+3.05));
      if(!clear(p.x,p.z))continue;
      cell(p.x,p.z).chevrons.push({roadId:road.id,progress:sample.s,side,x:p.x,y:terrainHeight(p.x,p.z),z:p.z,yaw:p.yaw,curvature:sample.curvature});
      last=sample.s;
    }
  }
}

export function roadsideGuidance(cx:number,cz:number):Readonly<GuidanceCell>{
  return cells.get(`${cx},${cz}`)??{delineators:[],chevrons:[]};
}
