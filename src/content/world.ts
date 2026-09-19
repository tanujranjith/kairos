import type { Road, RoadPoint, NearestRoad, Landmark, V3 } from '../core/types';
import { clamp, distance, lerp, smooth, wrap } from '../core/math';
import { HANDLING, handlingTerrainBlend, inHandlingCourse } from './handling-course';
import { LaneGraph, samplePath, projectPath } from '../sim/lane-graph';
import { resolveJunctions, PRIVATE_TRAFFIC_ROADS } from './junctions';

export const CELL_SIZE=256;
export const WORLD_SIZE=4096;
export const LAKE={x:-1070,z:730,rx:615,rz:650,level:10};
export const inLake=(x:number,z:number)=>((x-LAKE.x)/LAKE.rx)**2+((z-LAKE.z)/LAKE.rz)**2<1;
export function landHeight(x:number,z:number) {
  const hills=smooth((z-100)/1000)*smooth((x+450)/1400);
  return 13+2.5*Math.sin(x/330)*Math.cos(z/440)+hills*(35+52*Math.sin(x/600)**2+38*Math.sin(z/720)**2);
}
type Anchor=[number,number,number?];
function catmull(a:number,b:number,c:number,d:number,t:number) {return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);}
export function makeRoad(id:string,name:string,anchors:Anchor[],width:number,kind:Road['kind']='road',loop=false,lanes=2,speed=22):Road {
  const raw:V3[]=[];
  const get=(i:number)=>anchors[loop?(i+anchors.length)%anchors.length:clamp(i,0,anchors.length-1)];
  const count=loop?anchors.length:anchors.length-1;
  for(let i=0;i<count;i++) {
    const a=get(i-1),b=get(i),c=get(i+1),d=get(i+2);
    const steps=Math.max(4,Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/8));
    for(let j=0;j<steps;j++) {const t=j/steps,x=catmull(a[0],b[0],c[0],d[0],t),z=catmull(a[1],b[1],c[1],d[1],t);const y=b[2]!==undefined&&c[2]!==undefined?lerp(b[2],c[2],smooth(t)):landHeight(x,z)+.13;raw.push({x,y,z});}
  }
  const end=loop?anchors[0]:anchors[anchors.length-1];raw.push({x:end[0],z:end[1],y:end[2]??landHeight(end[0],end[1])+.13});
  let s=0;
  const points:RoadPoint[]=raw.map((p,i)=>{if(i)s+=distance(p,raw[i-1]);const n=raw[Math.min(i+1,raw.length-1)],prev=raw[Math.max(0,i-1)];return {...p,s,yaw:Math.atan2(n.x-prev.x,n.z-prev.z),curvature:0};});
  for(let i=1;i<points.length-1;i++) points[i].curvature=wrap(points[i+1].yaw-points[i-1].yaw)/Math.max(1,points[i+1].s-points[i-1].s);
  return {id,name,points,width,kind,loop,lanes,speed,length:s};
}
export const ROADS:Road[]=[
  makeRoad('ring','Valley Parkway',[[-1520,-1450],[-1790,-700],[-1750,350],[-1510,1250],[-650,1660],[380,1690],[1310,1340],[1790,620],[1790,-350],[1710,-1420],[650,-1750],[-580,-1720]],15,'highway',true,4,36),
  makeRoad('lakeshore','Lakeshore Drive',[[-850,-1730],[-650,-1120],[-410,-480],[-380,100],[-350,650],[-410,1120],[-650,1660]],9,'road',false,2,23),
  makeRoad('crossway','Cross Valley Expressway',[[-1780,-400],[-1120,-370],[-410,-480],[340,-350],[1050,-210],[1790,-350]],19,'highway',false,4,36),
  makeRoad('northbridge','Lake Crossing',[[-1750,350],[-1480,470,15],[-1070,530,15],[-650,570,15],[-350,650],[220,760],[800,920],[1310,1340]],10,'road',false,2,25),
  makeRoad('pass','Ridgeway Pass',[[340,-350],[570,100],[1130,320],[1430,650],[1140,950],[650,1200],[650,1480],[1110,1540],[1310,1340]],9,'road',false,2,20),
  makeRoad('forest','Pinecrest Road',[[-350,650],[100,1150],[380,1690]],8,'road',false,2,20),
  makeRoad('south','Orchard Way',[[-1520,-1450],[-1160,-1320],[-650,-1120],[-130,-1270],[300,-1540],[650,-1750]],9,'road',false,2,22),
  makeRoad('industrial','Foundry Avenue',[[-1780,-400],[-1280,-630],[-960,-840],[-410,-480]],10,'road',false,2,17),
  makeRoad('city1','Westbrook Boulevard',[[-1710,-920],[-1340,-940],[-960,-940],[-600,-940]],12,'road',false,2,15),
  makeRoad('city2','Market Street',[[-1610,-1210],[-1290,-1200],[-980,-1190],[-690,-1180]],10,'road',false,2,14),
  makeRoad('city3','Cedar Street',[[-1430,-1470],[-1400,-1200],[-1340,-940],[-1300,-620],[-1250,-370]],9,'road',false,2,14),
  makeRoad('city4','Harbor Street',[[-1070,-1650],[-1020,-1320],[-980,-1190],[-960,-940],[-960,-840],[-900,-370]],9,'road',false,2,14),
  makeRoad('circuitlink','Aster Circuit Access',[[1050,-210],[900,-360],[720,-470],[500,-650],[470,-1050]],9,'road',false,2,17),
  makeRoad('circuit','Aster International',[[680,-1500,17],[1260,-1500,17],[1550,-1350,19],[1590,-950,24],[1470,-620,27],[1200,-490,26],[1000,-650,23],[1160,-920,23],[900,-1130,20],[570,-940,18],[400,-1140,17],[470,-1410,17]],14,'circuit',true,2,75),
  makeRoad('pit','Aster Pit Lane',[[510,-1450,17],[660,-1460,17],[960,-1460,17],[1260,-1460,17],[1390,-1410,18]],7,'pit',false,1,16.67),
  makeRoad('testaccess','Northstar Access',[[-650,1660,landHeight(-650,1660)+.13],[-840,1690,HANDLING.height],[-1010,1740,HANDLING.height]],8,'road',false,2,14),
  makeRoad('test','Northstar Skidpad',Array.from({length:24},(_,i):Anchor=>{const a=i/24*Math.PI*2;return [HANDLING.skidpad.x+Math.sin(a)*HANDLING.skidpad.radius,HANDLING.skidpad.z+Math.cos(a)*HANDLING.skidpad.radius,HANDLING.height];}),14,'test',true,2,20)
];
export const CIRCUIT=ROADS.find(r=>r.id==='circuit')!;
export const PIT=ROADS.find(r=>r.id==='pit')!;
export const PUBLIC_ROADS=ROADS.filter(r=>r.kind==='road'||r.kind==='highway');
export const JUNCTIONS=resolveJunctions(PUBLIC_ROADS);
export const LANE_GRAPH=new LaneGraph(PUBLIC_ROADS,JUNCTIONS,PRIVATE_TRAFFIC_ROADS);
export function junctionRadius(junction:{control:string;radius:number}){return junction.control==='turnaround'?18:junction.radius+12;}
export function onJunctionSurface(position:V3){return [...LANE_GRAPH.junctions.values()].some(j=>Math.abs(position.y-j.y)<3&&Math.hypot(position.x-j.x,position.z-j.z)<junctionRadius(j));}
const buckets=new Map<string,{road:Road,index:number}[]>();
for(const road of ROADS) for(let i=0;i<road.points.length-1;i++){const p=road.points[i],key=`${Math.floor(p.x/64)},${Math.floor(p.z/64)}`;const list=buckets.get(key)??[];list.push({road,index:i});buckets.set(key,list);}
export function nearestRoad(x:number,z:number,filter?:(r:Road)=>boolean,maxRadius=3):NearestRoad {
  let best:NearestRoad|undefined;const cx=Math.floor(x/64),cz=Math.floor(z/64);
  const examine=(road:Road,index:number)=>{if(filter&&!filter(road))return;const a=road.points[index],b=road.points[index+1];const dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz;const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/l2,0,1);const px=a.x+dx*t,pz=a.z+dz*t,d=Math.hypot(x-px,z-pz);if(best&&d>=best.distance)return;const yaw=Math.atan2(dx,dz);best={road,index,point:{x:px,z:pz,y:lerp(a.y,b.y,t),s:lerp(a.s,b.s,t),yaw,curvature:lerp(a.curvature,b.curvature,t)},distance:d,lateral:(x-px)*Math.cos(yaw)-(z-pz)*Math.sin(yaw),progress:lerp(a.s,b.s,t)};};
  for(let r=0;r<=maxRadius;r++){for(let i=-r;i<=r;i++)for(let j=-r;j<=r;j++){if(r&&Math.abs(i)!==r&&Math.abs(j)!==r)continue;for(const entry of buckets.get(`${cx+i},${cz+j}`)??[])examine(entry.road,entry.index);}if(best&&(best as NearestRoad).distance<(r-1)*64)break;}
  if(!best) for(const road of ROADS)for(let i=0;i<road.points.length-1;i++)examine(road,i);
  return best!;
}
export function pointAt(road:Road,s:number,offset=0):RoadPoint {
  s=road.loop?((s%road.length)+road.length)%road.length:clamp(s,0,road.length-.001);
  let lo=0,hi=road.points.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(road.points[mid].s<s)lo=mid;else hi=mid;}
  const a=road.points[lo],b=road.points[hi],t=(s-a.s)/Math.max(.001,b.s-a.s),yaw=a.yaw+wrap(b.yaw-a.yaw)*t;
  return {x:lerp(a.x,b.x,t)+Math.cos(yaw)*offset,y:lerp(a.y,b.y,t),z:lerp(a.z,b.z,t)-Math.sin(yaw)*offset,s,yaw,curvature:lerp(a.curvature,b.curvature,t)};
}
export function terrainHeight(x:number,z:number) {
  if(inLake(x,z))return 2.5;
  const near=nearestRoad(x,z,undefined,1),blend=1-smooth((near.distance-near.road.width*.5-2)/20);
  const natural=lerp(landHeight(x,z)+Math.sin(x*.017)*Math.sin(z*.019)*1.3,near.point.y-.16,blend);
  return lerp(natural,HANDLING.height-.16,handlingTerrainBlend(x,z));
}
export const LANDMARKS:Landmark[]=[
  {id:'home',name:'The Lakeside House',type:'garage',x:-380,z:110,description:'Your starting point. A space to make every car yours.'},
  {id:'handling',name:HANDLING.name,type:'handling',x:-1010,z:1740,description:'A flat proving ground with skidpad, slalom, braking lane, ride bumps, banking, gradient, curb and launch ramp.'},
  {id:'aster',name:'Aster International',type:'circuit',x:960,z:-1460,description:'A flowing technical circuit beneath the mountains.'},
  {id:'westbrook',name:'Westbrook Service',type:'service',x:-960,z:-940,description:'Refuel and restore your vehicle.'},
  {id:'summitservice',name:'Summit Service',type:'service',x:650,z:1480,description:'A welcome stop above the valley.'},
  {id:'vista',name:'Ridgeway Overlook',type:'scenic',x:1110,z:1540,description:'One road. The whole valley.'},
  {id:'lakeside',name:'Lake Aurelia',type:'scenic',x:-1480,z:470,description:'Watch the light change over the water.'},
  {id:'pines',name:'Pinecrest Lookout',type:'scenic',x:100,z:1150,description:'A quiet moment among the pines.'},
  {id:'speed1',name:'Cross Valley Sprint',type:'speed',x:340,z:-350,target:145,description:'Speed trap · target 145 km/h'},
  {id:'speed2',name:'Lake Crossing',type:'speed',x:-1070,z:530,target:110,description:'Speed trap · target 110 km/h'},
  {id:'speed3',name:'Ridgeway Speed',type:'speed',x:1430,z:650,target:105,description:'Speed trap · target 105 km/h'},
  {id:'speed4',name:'South Parkway',type:'speed',x:650,z:-1750,target:180,description:'Speed trap · target 180 km/h'},
  {id:'trial1',name:'Lake to Summit',type:'trial',x:-380,z:100,end:{x:1110,z:1540},description:'Point-to-point · climb above the valley'},
  {id:'trial2',name:'The Long Way',type:'trial',x:-1520,z:-1450,end:{x:-1510,z:1250},description:'Point-to-point · the western parkway'},
  {id:'trial3',name:'Forest Run',type:'trial',x:-350,z:650,end:{x:380,z:1690},description:'Point-to-point · through Pinecrest'},
  {id:'drift1',name:'Ridgeway Drift',type:'drift',x:1140,z:950,description:'Drift zone · link the mountain bends'},
  {id:'drift2',name:'Foundry Drift',type:'drift',x:-1280,z:-630,description:'Drift zone · keep the car in balance'}
];
export function regionAt(x:number,z:number) { if(inHandlingCourse(x,z,32))return 'NORTHSTAR HANDLING GROUNDS';if(x>300&&z<-460)return 'ASTER MOTORSPORT PARK';if(z>1000&&x>300)return 'RIDGEWAY PASS';if(x<-700&&z<-750)return 'WESTBROOK';if(x<-650&&z<-250)return 'THE FOUNDRY';if(z>600&&x>-350&&x<600)return 'PINECREST FOREST';if(x<0&&z>-200)return 'LAKE AURELIA';return 'REDWOOD VALLEY'; }

// Directed navigation uses the same legal lanes/turns as traffic. Lane changes
// move forward along an adjacent lane; proximity never creates a junction.
export interface NavNode { x:number;z:number;y:number;edges:{to:number;cost:number}[];road:string;path:string;s:number }
export class RoadGraph {
  nodes:NavNode[]=[];
  private pathNodes=new Map<string,number[]>();
  constructor() {
    for(const path of LANE_GRAPH.paths.values()){
      const ids:number[]=[],count=Math.ceil(path.length/16);
      for(let i=0;i<=count;i++){const p=samplePath(path,i/count*path.length),id=this.nodes.length;this.nodes.push({...p,road:path.roadId,path:path.id,edges:[]});if(i)this.link(ids[i-1],id);ids.push(id);}
      this.pathNodes.set(path.id,ids);
    }
    for(const path of LANE_GRAPH.paths.values()){
      const ids=this.pathNodes.get(path.id)!;
      for(const next of path.next)this.link(ids.at(-1)!,this.pathNodes.get(next)![0]);
      for(const id of ids){const node=this.nodes[id];if(node.s<24||path.length-node.s<64||Math.abs(samplePath(path,node.s).curvature)>.007)continue;
        for(const adjacent of path.adjacent){const other=LANE_GRAPH.paths.get(adjacent)!,progress=projectPath(other,node).progress+24,target=this.pathNodes.get(adjacent)!.find(n=>this.nodes[n].s>=progress);if(target!==undefined)this.link(id,target,8);}
      }
    }
  }
  private link(a:number,b:number,penalty=0){this.nodes[a].edges.push({to:b,cost:Math.max(.01,distance(this.nodes[a],this.nodes[b]))+penalty});}
  closest(x:number,z:number){let best=0,d=Infinity;this.nodes.forEach((n,i)=>{const nd=Math.hypot(n.x-x,n.z-z);if(nd<d){d=nd;best=i;}});return best;}
  route(from:{x:number;z:number;y?:number;yaw?:number},to:{x:number;z:number;y?:number}):V3[]{
    const source=LANE_GRAPH.nearest(from,from.yaw),goal=LANE_GRAPH.nearest(to),sourceIds=this.pathNodes.get(source.path.id)!,goalIds=this.pathNodes.get(goal.path.id)!;
    const a=sourceIds.find(id=>this.nodes[id].s>=source.progress)??sourceIds.at(-1)!,b=goalIds.reduce((best,id)=>Math.abs(this.nodes[id].s-goal.progress)<Math.abs(this.nodes[best].s-goal.progress)?id:best,goalIds[0]);
    const dist=new Float64Array(this.nodes.length).fill(Infinity),prev=new Int32Array(this.nodes.length).fill(-1),open=new Set<number>([a]);dist[a]=0;
    while(open.size){let current=-1,score=Infinity;for(const n of open){const f=dist[n]+distance(this.nodes[n],this.nodes[b]);if(f<score){score=f;current=n;}}if(current===b)break;open.delete(current);for(const edge of this.nodes[current].edges){const nd=dist[current]+edge.cost;if(nd<dist[edge.to]){dist[edge.to]=nd;prev[edge.to]=current;open.add(edge.to);}}}
    if(!Number.isFinite(dist[b]))return [];const result:V3[]=[];for(let n=b;n!==-1;n=prev[n])result.unshift({x:this.nodes[n].x,y:this.nodes[n].y,z:this.nodes[n].z});return result;
  }
}
