import {describe,it,expect} from 'vitest';
import {ROADS,CIRCUIT,PIT,LANE_GRAPH,RoadGraph,pointAt,nearestRoad,nearestRoadAt,landmarkPosition,LANDMARKS} from '../src/content/world';
import {samplePath} from '../src/sim/lane-graph';

describe('connected Aster access and one-way navigation',()=>{
  const access=ROADS.find(r=>r.id==='circuitlink')!,destination=landmarkPosition(LANDMARKS.find(l=>l.id==='aster')!);
  it('routes to the actual pit destination and back through authored private links',()=>{
    const graph=new RoadGraph(),home={x:-380,y:14,z:110},inbound=graph.route(home,destination),outbound=graph.route({...destination,yaw:Math.PI/2},home);
    for(const [route,target] of [[inbound,destination],[outbound,home]] as const){expect(route.length).toBeGreaterThan(20);const end=route.at(-1)!;expect(Math.hypot(end.x-target.x,end.z-target.z)).toBeLessThan(20);}
    expect(inbound.some(p=>nearestRoadAt(p).road.id==='circuitlink')).toBe(true);
    expect(outbound.some(p=>nearestRoadAt(p).road.id==='circuit')).toBe(true);
    expect(LANE_GRAPH.issues).toEqual([]);
  });
  it('joins the pit exit to the circuit with no unpaved gap',()=>{
    const end=PIT.points.at(-1)!,track=nearestRoad(end.x,end.z,r=>r.id==='circuit');expect(track.distance).toBeLessThan(.001);expect(end.y).toBeCloseTo(track.point.y,8);
    const gate=LANE_GRAPH.junctions.get('aster-paddock-gate')!,exit=LANE_GRAPH.junctions.get('aster-pit-exit')!;
    expect(gate.roads).toEqual(['circuitlink','circuit','pit']);expect(exit.connectors.some(id=>LANE_GRAPH.paths.get(id)!.sourceLane?.startsWith('pit:'))).toBe(true);
    expect(LANE_GRAPH.junctions.has('terminal-circuitlink-end')).toBe(false);
    for(const id of exit.connectors){const p=LANE_GRAPH.paths.get(id)!;if(p.sourceLane?.startsWith('pit:'))expect(LANE_GRAPH.paths.get(p.targetLane!)!.laneIndex).toBe(1);}
  });
  it('retains tight connector curves in navigation instead of cutting coarse chords',()=>{
    const graph=new RoadGraph();
    for(const path of LANE_GRAPH.paths.values())if(path.kind==='connector'){
      const nodes=graph.nodes.filter(n=>n.path===path.id);
      for(let i=1;i<nodes.length;i++)expect(nodes[i].s-nodes[i-1].s).toBeLessThanOrEqual(2.000001);
    }
  });
  it('keeps Aster turns above a physically steerable six-metre radius',()=>{
    for(const p of LANE_GRAPH.paths.values())if(p.junction?.startsWith('aster'))for(const point of p.points)expect(Math.abs(point.curvature),p.id).toBeLessThan(1/6);
  });
  it('retains circuit length/elevation and gives the access crossing physical clearance',()=>{
    expect(CIRCUIT.length).toBeCloseTo(4121.644264590471,8);
    const top=pointAt(CIRCUIT,3441.3),lower=nearestRoad(top.x,top.z,r=>r.id===access.id);expect(lower.distance).toBeLessThan(2);expect(top.y-lower.point.y).toBeGreaterThan(5.5);expect(top.layer).toBe('aster-access-overpass');
    expect(nearestRoadAt({...lower.point,y:lower.point.y+.7}).road.id).toBe('circuitlink');expect(nearestRoadAt({...top,y:top.y+.7}).road.id).toBe('circuit');
    expect(LANE_GRAPH.junctions.has('aster-underpass')).toBe(false);
    for(let s=3380;s<3515;s++){const a=pointAt(CIRCUIT,s),b=pointAt(CIRCUIT,s+1);expect(Math.abs(a.terrainY!-b.terrainY!)).toBeLessThan(.4);}
  });
  it('keeps pit and circuit lanes one-way and excludes all private links from ambient traffic',()=>{
    const paths=[...LANE_GRAPH.paths.values()];for(const p of paths.filter(p=>['pit','circuit'].includes(p.roadId)&&p.kind==='lane')){expect(p.direction).toBe(1);expect(p.trafficAllowed).toBe(false);expect(p.next.length).toBeGreaterThan(0);}
    for(const p of paths.filter(p=>p.roadId==='circuitlink'))expect(p.trafficAllowed).toBe(false);
    for(const p of paths)for(const id of p.next){const end=samplePath(p,p.length),next=samplePath(LANE_GRAPH.paths.get(id)!,0);expect(Math.hypot(end.x-next.x,end.y-next.y,end.z-next.z)).toBeLessThan(.001);}
  });
});
