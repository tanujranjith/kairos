import type {Road,RoadPoint,V3} from '../core/types';
import {CIRCUIT,PIT,LANE_GRAPH,pointAt} from './world';
import {distance,smooth,wrap} from '../core/math';
import {projectPath} from '../sim/lane-graph';

export const PIT_POLICY={speed:12,braking:2.5,serviceSeconds:6,stopTolerance:2.5,stoppedSpeed:.5,wearThreshold:.55,fuelReserve:2,initialFuelPerMetre:.0013,mergeGap:9,mergeClearSeconds:.6} as const;
export const pitBox=(index:number)=>260+Math.min(15,Math.max(0,index))*25;

/** Shared authored connectors: the pit controller never steers across the
 * intervening grass from a nearest point on the unrelated pit spline. */
function buildVisit(){
  const entry=[...LANE_GRAPH.paths.values()].find(p=>p.junction==='aster-paddock-gate'&&p.sourceLane?.startsWith('circuit:')&&p.targetLane?.startsWith('pit:'))!;
  const exit=[...LANE_GRAPH.paths.values()].find(p=>p.junction==='aster-pit-exit'&&p.sourceLane?.startsWith('pit:'))!;
  const source=LANE_GRAPH.paths.get(entry.sourceLane!)!,lane=LANE_GRAPH.paths.get(entry.targetLane!)!,target=LANE_GRAPH.paths.get(exit.targetLane!)!;
  const start=source.roadEnd-180,raw:V3[]=[];
  for(let s=start;s<source.roadEnd;s+=3)raw.push(pointAt(CIRCUIT,s,-3.5*smooth((s-start)/70)));
  raw.push(...entry.points,...lane.points,...exit.points);
  for(let s=target.roadStart+3;s<target.roadStart+140;s+=3)raw.push(pointAt(CIRCUIT,s,-3.5*(1-smooth((s-target.roadStart)/90))));
  const unique=raw.filter((p,i)=>!i||distance(p,raw[i-1])>.01);let length=0;
  const points:RoadPoint[]=unique.map((p,i)=>{if(i)length+=distance(p,unique[i-1]);const a=unique[Math.max(0,i-1)],b=unique[Math.min(unique.length-1,i+1)];return {...p,s:length,yaw:Math.atan2(b.x-a.x,b.z-a.z),curvature:0};});
  for(let i=1;i<points.length-1;i++)points[i].curvature=wrap(points[i+1].yaw-points[i-1].yaw)/Math.max(.1,points[i+1].s-points[i-1].s);
  const road:Road={id:'pit-visit',name:'Aster pit approach and rejoin',points,length,width:PIT.width,kind:'pit',loop:false,lanes:1,speed:PIT_POLICY.speed};
  return {start,road,hold:projectPath(road,pointAt(PIT,PIT.length-70)).progress,mergeCircuit:target.roadStart};
}
export const PIT_VISIT=buildVisit();
