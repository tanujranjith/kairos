import type { VehicleDefinition, VehicleState, V3 } from './types';
import { clamp } from './math';
import { ROADS } from '../content/world';
import { TUNNELS } from '../content/structures';

const tunnelSegments=TUNNELS.flatMap(tunnel=>{
  const road=ROADS.find(r=>r.id===tunnel.roadId)!;
  return road.points.slice(0,-1).flatMap((a,i)=>{
    const b=road.points[i+1];
    return b.s>=tunnel.start&&a.s<=tunnel.end?[{a,b,tunnel}]:[];
  });
});

/** A roof above a car matters; a nearby road or a car above the tunnel does not. */
export function tunnelEnclosure(position:V3){
  let enclosure=0;
  for(const {a,b,tunnel} of tunnelSegments){
    if(position.x<Math.min(a.x,b.x)-7||position.x>Math.max(a.x,b.x)+7||position.z<Math.min(a.z,b.z)-7||position.z>Math.max(a.z,b.z)+7)continue;
    const dx=b.x-a.x,dz=b.z-a.z;
    const t=clamp(((position.x-a.x)*dx+(position.z-a.z)*dz)/(dx*dx+dz*dz),0,1);
    const lateral=Math.hypot(position.x-a.x-dx*t,position.z-a.z-dz*t),height=position.y-a.y-(b.y-a.y)*t;
    if(height<-.5||height>tunnel.height)continue;
    const progress=a.s+(b.s-a.s)*t,portal=clamp(Math.min(progress-tunnel.start,tunnel.end-progress)/12,0,1);
    enclosure=Math.max(enclosure,portal*clamp((tunnel.innerWidth/2-lateral)/.75,0,1));
  }
  return enclosure;
}

export interface AudioEnvironment { cockpit:boolean; rain:number; wetness:number; tunnel:number }
export function drivingMix(s:VehicleState,d:VehicleDefinition,throttle:number,env:AudioEnvironment){
  const speed=Math.abs(s.speed),load=clamp(throttle,0,1),rpm=clamp(s.rpm,0,d.redline*1.1);
  const cylinders=({aeris:4,velara:6,crest:4,nova:8,gtx:8,apex:6} as Record<string,number>)[d.id]??4;
  const slip=s.wheels.reduce((n,w)=>Math.max(n,w.contact?w.slip:0),0);
  const contact=s.wheels.filter(w=>w.contact).length/4;
  const rough=s.surface==='Asphalt'?1:s.surface==='Gravel'?2.2:1.65;
  const tunnel=clamp(env.tunnel,0,1),rain=clamp(env.rain,0,1),wet=clamp(env.wetness,0,1);
  const wheelHz=speed/(Math.PI*2*d.wheelRadius);
  return {
    engineHz:Math.max(20,rpm/60*cylinders/2),
    engineGain:s.fuel>0?.09+load*.22+rpm/d.redline*.08:.015*clamp(speed/10,0,1),
    engineCutoff:650+load*1800+rpm*.15,
    intakeGain:.08+load*.26,
    intakeHz:clamp(320+rpm*.065+load*180,320,1500),
    exhaustGain:.6+load*.35,
    exhaustHz:clamp(160+rpm*.03,160,650),
    overrunGain:(1-load)*clamp((rpm-2200)/3500,0,1)*.055,
    whineHz:clamp(100+wheelHz*42*Math.max(.8,d.gears[Math.max(0,s.gear-1)]??1),100,9000),
    whineGain:clamp(speed/15,0,1)*(d.class==='ROAD'?.018:.05)*(.3+load*.7),
    tireGain:clamp((slip-.10)*speed*.1,0,.45),
    roadGain:clamp(speed/160,0,.23)*contact*rough*(1+wet*.35),
    roadHz:clamp(180+speed*9,180,1600),
    windGain:clamp((speed/120)**2,0,.3),
    rainGain:rain*.12*(1-tunnel*.95),
    cabinCutoff:env.cockpit?1800:18000,
    tunnelGain:tunnel*.38,
  };
}
