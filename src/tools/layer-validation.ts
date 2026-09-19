import type {Kairos} from '../app';
import {ROADS,nearestRoad,pointAt,terrainHeight} from '../content/world';
import {OVERPASS_CROSSING} from '../content/road-layers';
import {DEFAULT_SETTINGS,vehicleById} from '../content/vehicles';
import {FIXED_DT,Vehicle,neutralInput} from '../sim/physics';
import {clamp,wrap} from '../core/math';
import type {V3} from '../core/types';

/** Real Havok contact/traversal rig: no force, speed or pose correction during each run. */
export async function validateLayers(g:Kairos){
  await g.advanceTime(0);g.save.settings.traffic=0;g.save.settings.timeRate=0;await g.startDrive();
  const settings={...DEFAULT_SETTINGS,traffic:0,volume:0},states:Record<string,unknown>={},cross=OVERPASS_CROSSING;
  let v=g.player;
  const step=(input=neutralInput())=>{v.preStep(input,settings,0,FIXED_DT);g.physics.step();v.postStep(FIXED_DT);};
  const prepare=(p:V3,yaw:number)=>{g.world.ensure(p);g.player.dispose();v=g.player=new Vehicle(g.physics,vehicleById('velara'),'player',p,yaw);for(let i=0;i<240;i++)step({...neutralInput(),brake:1});};
  const state=()=>structuredClone(v.state);
  for(const [name,id,specialS] of [['upper','pass',null],['lower','ring',null],['lake','northbridge',650],['tunnel','pass',2470]] as const){
    const road=ROADS.find(r=>r.id===id)!,s=specialS??nearestRoad(cross.x,cross.z,r=>r.id===id).progress,p=pointAt(road,s,2);prepare(p,p.yaw);states[name]=state();
    if(name==='upper'||name==='lower'){await g.action('reset');for(let i=0;i<180;i++)step({...neutralInput(),brake:1});states[name+'Reset']=state();}
  }
  const road=ROADS.find(r=>r.id==='pass')!,s=nearestRoad(cross.x,cross.z,r=>r.id==='pass').progress,p=pointAt(road,s-90);prepare({...p,y:terrainHeight(p.x,p.z)},p.yaw);states.underBridgeGrass=state();
  const lakeshore=ROADS.find(r=>r.id==='lakeshore')!,roadS=nearestRoad(-380,-18,r=>r.id==='lakeshore').progress,edge=pointAt(lakeshore,roadS,lakeshore.width/2-.18);prepare(edge,edge.yaw);states.splitSurface=state();
  const traversals=[];
  for(const id of ['pass','ring']){
    const road=ROADS.find(r=>r.id===id)!,center=nearestRoad(cross.x,cross.z,r=>r.id===id).progress,start=center-205,end=center+205,p=pointAt(road,start,2);
    for(let s=start;s<=end+30;s+=80)g.world.ensure(pointAt(road,s));prepare(p,p.yaw);
    let maxLateral=0,air=0,elapsed=0;const layers=new Set<string>(),wrongContacts:unknown[]=[];
    for(let i=0;i<7200;i++){
      const n=nearestRoad(v.state.position.x,v.state.position.z,r=>r.id===id),aim=pointAt(road,n.progress+10+Math.abs(v.state.speed)*.4,2),delta=wrap(Math.atan2(aim.x-v.state.position.x,aim.z-v.state.position.z)-v.state.yaw);
      step({...neutralInput(),throttle:clamp((12-v.state.speed)*.22,0,.65),brake:clamp((v.state.speed-12)*.18,0,.8),steer:clamp(delta*3.2,-1,1)});
      maxLateral=Math.max(maxLateral,Math.abs(n.lateral-2));if(!v.state.grounded)air+=FIXED_DT;v.state.wheels.forEach(w=>{if(w.contact)layers.add(w.layer!);});if(v.state.wheels.some(w=>w.contact&&w.surface!=='Asphalt')&&wrongContacts.length<12)wrongContacts.push({s:n.progress,position:{...v.state.position},wheels:v.state.wheels.map(w=>({contact:w.contact,surface:w.surface,road:w.roadId}))});elapsed+=FIXED_DT;if(n.progress>=end)break;
    }
    traversals.push({road:id,elapsed,maxLateral,air,layers:[...layers],wrongContacts,progress:nearestRoad(v.state.position.x,v.state.position.z,r=>r.id===id).progress,end,state:state()});
  }
  return {states,traversals};
}
