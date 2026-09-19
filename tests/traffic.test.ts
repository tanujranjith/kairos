import { describe,expect,it } from 'vitest';
import { TRAFFIC_GRAPH } from '../src/content/traffic-network';
import { LaneGraph, signalAspect, samplePath } from '../src/sim/lane-graph';
import { makeRoad, RoadGraph, PUBLIC_ROADS } from '../src/content/world';
import { TrafficController, type TrafficObservation } from '../src/sim/traffic';
import type { LanePath } from '../src/sim/lane-graph';
import { subtractConvex, terrainOutsideJunctions } from '../src/content/terrain-clipping';

const observed=(path:LanePath,s:number,id='car',speed=0):TrafficObservation=>{const p=samplePath(path,s);return {id,position:{x:p.x,y:p.y+.7,z:p.z},yaw:p.yaw,speed,length:4.4,width:1.8};};

describe('authored directed traffic lanes',()=>{
  it('clips terrain away from paved aprons without discarding the surrounding ground',()=>{
    const square=[{x:0,z:0},{x:10,z:0},{x:10,z:10},{x:0,z:10}],cut=[{x:3,z:3},{x:7,z:3},{x:7,z:7},{x:3,z:7}];
    const area=(p:{x:number;z:number}[])=>Math.abs(p.reduce((sum,v,i)=>{const n=p[(i+1)%p.length];return sum+v.x*n.z-v.z*n.x;},0))/2;
    expect(subtractConvex(square,cut).reduce((sum,p)=>sum+area(p),0)).toBeCloseTo(84,8);
    expect(terrainOutsideJunctions([-1345,-945,-1335,-935])).toEqual([]);
    expect(terrainOutsideJunctions([0,0,16,16]).reduce((sum,p)=>sum+area(p),0)).toBe(256);
  });
  it('resolves only explicitly authored, elevation-compatible junctions',()=>{
    expect(TRAFFIC_GRAPH.issues).toEqual([]);
    expect(TRAFFIC_GRAPH.junctions.size).toBeGreaterThan(20);
  });
  it('keeps every ambient lane connected and on the right side of its travel direction',()=>{
    for(const path of TRAFFIC_GRAPH.paths.values()){
      expect(path.points.length).toBeGreaterThan(1);
      expect(path.length).toBeGreaterThan(0);
      if(path.trafficAllowed)expect(path.next.length,path.id).toBeGreaterThan(0);
      for(const next of path.next){const target=TRAFFIC_GRAPH.paths.get(next)!;expect(target,next).toBeDefined();const a=samplePath(path,path.length),b=samplePath(target,0);expect(Math.hypot(a.x-b.x,a.z-b.z),path.id).toBeLessThan(.001);}
      for(const adjacent of path.adjacent){const other=TRAFFIC_GRAPH.paths.get(adjacent)!;expect(other.direction).toBe(path.direction);expect(other.roadId).toBe(path.roadId);}
    }
  });
  it('does not infer a connection at crossing roads, including overpasses',()=>{
    const lower=makeRoad('lower','Lower',[[-100,0,0],[100,0,0]],9),upper=makeRoad('upper','Upper',[[0,-100,8],[0,100,8]],9);
    const graph=new LaneGraph([lower,upper],[]);
    expect([...graph.paths.values()].every(p=>p.next.length===0)).toBe(true);
    const invalid=new LaneGraph([lower,upper],[{id:'invalid',x:0,z:0,roads:['lower','upper'],control:'priority',priority:[],radius:15,layer:'surface'}]);
    expect(invalid.issues).toContain('invalid: incompatible surface elevations');
    expect([...invalid.paths.values()].every(p=>p.next.length===0)).toBe(true);
  });
  it('has no conflicting signal greens and includes amber and all-red clearance',()=>{
    const junction=TRAFFIC_GRAPH.junctions.get('westbrook-cedar')!;
    for(let time=0;time<64;time+=.1)expect(signalAspect(junction,0,time)==='green'&&signalAspect(junction,1,time)==='green').toBe(false);
    expect(signalAspect(junction,0,13)).toBe('amber');
    expect(signalAspect(junction,0,15.5)).toBe('red');expect(signalAspect(junction,1,15.5)).toBe('red');
    expect(signalAspect(junction,1,17)).toBe('green');
  });
  it('reaches every ambient path through legal turns and same-direction lane changes',()=>{
    const paths=[...TRAFFIC_GRAPH.paths.values()].filter(p=>p.trafficAllowed),seen=new Set<string>(),queue=[paths[0].id];
    while(queue.length){const id=queue.pop()!;if(seen.has(id))continue;seen.add(id);const path=TRAFFIC_GRAPH.paths.get(id)!;queue.push(...[...path.next,...path.adjacent].filter(id=>TRAFFIC_GRAPH.paths.get(id)!.trafficAllowed));}
    expect(paths.filter(p=>!seen.has(p.id)).map(p=>p.id)).toEqual([]);
  });
  it('navigation never uses an unauthored cross-road edge or reverse lane change',()=>{
    const navigation=new RoadGraph();
    for(const node of navigation.nodes)for(const edge of node.edges){const target=navigation.nodes[edge.to],path=TRAFFIC_GRAPH.paths.get(node.path)!;
      expect(target.path===path.id||path.next.includes(target.path)||path.adjacent.includes(target.path)).toBe(true);
      if(target.path===path.id)expect(target.s).toBeGreaterThan(node.s);
    }
  });
  it('authors every same-height public-road centerline crossing',()=>{
    const missing:unknown[]=[];
    for(let i=0;i<PUBLIC_ROADS.length;i++)for(let j=i+1;j<PUBLIC_ROADS.length;j++){
      const a=PUBLIC_ROADS[i],b=PUBLIC_ROADS[j];
      for(let n=1;n<a.points.length;n++)for(let m=1;m<b.points.length;m++){
        const p=a.points[n-1],q=a.points[n],r=b.points[m-1],s=b.points[m];
        if(Math.max(p.x,q.x)<Math.min(r.x,s.x)||Math.min(p.x,q.x)>Math.max(r.x,s.x)||Math.max(p.z,q.z)<Math.min(r.z,s.z)||Math.min(p.z,q.z)>Math.max(r.z,s.z))continue;
        const dx=q.x-p.x,dz=q.z-p.z,ex=s.x-r.x,ez=s.z-r.z,den=dx*ez-dz*ex;if(Math.abs(den)<1e-8)continue;
        const t=((r.x-p.x)*ez-(r.z-p.z)*ex)/den,u=((r.x-p.x)*dz-(r.z-p.z)*dx)/den;if(t<0||t>1||u<0||u>1)continue;
        const x=p.x+dx*t,z=p.z+dz*t,y=p.y+(q.y-p.y)*t,otherY=r.y+(s.y-r.y)*u;if(Math.abs(y-otherY)>2)continue;
        if(![...TRAFFIC_GRAPH.junctions.values()].some(j=>j.roads.includes(a.id)&&j.roads.includes(b.id)&&Math.hypot(j.x-x,j.z-z)<45))missing.push({roads:[a.id,b.id],x:Math.round(x),z:Math.round(z)});
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('traffic rules and distant simulation',()=>{
  const lane=[...TRAFFIC_GRAPH.paths.values()].find(p=>p.kind==='lane'&&p.roadId==='city3'&&p.to==='westbrook-cedar'&&p.direction===1)!;
  it('brakes at red, allows green and never treats an indefinite red queue as stranded',()=>{
    const controller=new TrafficController(TRAFFIC_GRAPH),car=controller.add('car',0,lane.id,lane.length-5),o=observed(lane,lane.length-5);
    for(let i=0;i<100;i++){const decision=controller.decide(car,o,[o],i*.1);expect(decision.input.throttle).toBe(0);expect(decision.input.brake).toBeGreaterThan(0);expect(car.permitted).toBe(false);}
    expect(car.blockedFor).toBe(0);expect(controller.decide(car,o,[o],17).targetSpeed).toBeGreaterThan(0);expect(car.permitted).toBe(true);
  });
  it('reserves conflicting turns and releases them when their owner is removed',()=>{
    const junction=TRAFFIC_GRAPH.junctions.get('westbrook-cedar')!,a=TRAFFIC_GRAPH.paths.get(junction.incoming.find(id=>TRAFFIC_GRAPH.paths.get(id)!.roadId==='city1')!)!,b=TRAFFIC_GRAPH.paths.get(junction.incoming.find(id=>TRAFFIC_GRAPH.paths.get(id)!.roadId==='city1'&&id!==a.id)!)!;
    const controller=new TrafficController(TRAFFIC_GRAPH),first=controller.add('first',0,a.id,a.length-5),second=controller.add('second',1,b.id,b.length-5);
    first.nextId=a.next.find(id=>TRAFFIC_GRAPH.paths.get(id)!.turn==='left')!;second.nextId=b.next.find(id=>TRAFFIC_GRAPH.paths.get(id)!.turn==='straight')!;
    const oa=observed(a,a.length-5,'first'),ob=observed(b,b.length-5,'second');
    controller.decide(first,oa,[oa],2);expect(first.permitted).toBe(true);controller.decide(second,ob,[oa,ob],2);expect(second.permitted).toBe(false);
    controller.remove('first');controller.decide(second,ob,[ob],2.2);expect(second.permitted).toBe(true);
  });
  it('left turns yield to conflicting through traffic and entry waits for a clear exit',()=>{
    const junction=TRAFFIC_GRAPH.junctions.get('westbrook-cedar')!,a=TRAFFIC_GRAPH.paths.get(junction.incoming.find(id=>TRAFFIC_GRAPH.paths.get(id)!.roadId==='city1')!)!,b=TRAFFIC_GRAPH.paths.get(junction.incoming.find(id=>TRAFFIC_GRAPH.paths.get(id)!.roadId==='city1'&&id!==a.id)!)!;
    const controller=new TrafficController(TRAFFIC_GRAPH),left=controller.add('left',0,a.id,a.length-5),through=controller.add('through',1,b.id,b.length-8);
    left.nextId=a.next.find(id=>TRAFFIC_GRAPH.paths.get(id)!.turn==='left')!;through.nextId=b.next.find(id=>TRAFFIC_GRAPH.paths.get(id)!.turn==='straight')!;
    const oa=observed(a,a.length-5,'left'),ob=observed(b,b.length-8,'through',4);controller.decide(left,oa,[oa,ob],2);expect(left.permitted).toBe(false);
    controller.remove('through');const exit=TRAFFIC_GRAPH.paths.get(TRAFFIC_GRAPH.paths.get(left.nextId)!.targetLane!)!,block=observed(exit,7,'player');controller.decide(left,oa,[oa,block],2.1);expect(left.permitted).toBe(false);
    controller.decide(left,oa,[oa],2.2);expect(left.permitted).toBe(true);
  });
  it('stops for player obstruction, ignores opposing traffic and checks rear closing speed before changing lanes',()=>{
    const graph=new LaneGraph([makeRoad('straight','Straight',[[0,0,0],[0,1000,0]],16,'highway',false,4,30)],[]),path=[...graph.paths.values()].find(p=>p.direction===1&&p.laneIndex===0)!;
    const controller=new TrafficController(graph),agent=controller.add('car',0,path.id,100),car=observed(path,100,'car',15),lead=observed(path,109,'player');
    const stop=controller.decide(agent,car,[car,lead],1);expect(stop.input.brake).toBe(1);expect(stop.input.throttle).toBe(0);
    const target=graph.paths.get(path.adjacent[0])!,rear=observed(target,80,'rear',30);expect(controller.adjacentClear(agent,target,car,[car,rear])).toBe(false);
    const opposing=[...graph.paths.values()].find(p=>p.direction===-1)!;expect(controller.decide(agent,car,[car,observed(opposing,880,'opposing',20)],2).reason).toBe('cruise');
    controller.decide(agent,car,[car,lead],5);expect(agent.laneChange?.to).toBe(target.id);
  });
  it('staggered 10Hz schedules stay bounded and distant cars obey stop lines',()=>{
    const controller=new TrafficController(TRAFFIC_GRAPH),agents=Array.from({length:24},(_,i)=>controller.add(`car-${i}`,i,lane.id,lane.length-5));
    let max=0;
    for(let tick=0;tick<120;tick++){const time=tick/120;let decisions=0;for(const a of agents)if(time+1e-8>=a.decisionAt){controller.decide(a,observed(lane,a.progress,a.id),[],time);decisions++;}max=Math.max(max,decisions);}
    expect(max).toBeLessThanOrEqual(2);expect(agents.every(a=>a.decisions>=9&&a.decisions<=11)).toBe(true);
    let o=observed(lane,lane.length-5,agents[0].id);for(let i=0;i<1200;i++)o=controller.advanceDistant(agents[0],o,1/120,i/120);
    expect(agents[0].pathId).toBe(lane.id);expect(agents[0].progress).toBeLessThan(lane.length-3);
  });
  it('recycling at arbitrary ticks preserves the global decision phases',()=>{
    const controller=new TrafficController(TRAFFIC_GRAPH),agents=Array.from({length:24},(_,i)=>controller.add(`car-${i}`,i,lane.id,50));let max=0;
    for(let tick=0;tick<240;tick++){
      const time=tick/120;if(tick===37||tick===81){for(const i of [3,6,15,18]){controller.remove(agents[i].id);agents[i]=controller.add(`car-${i}`,i,lane.id,50,time);}}
      let count=0;for(const a of agents)if(time+1e-8>=a.decisionAt){controller.decide(a,observed(lane,50,a.id),[],time);count++;}max=Math.max(max,count);
    }
    expect(max).toBeLessThanOrEqual(2);
  });
});
