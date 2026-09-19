import {describe,it,expect} from 'vitest';
import {ROADS,JUNCTIONS,LANE_GRAPH,nearestRoad,nearestRoadAt,pointAt,terrainHeight,RoadGraph,atDestination} from '../src/content/world';
import {BRIDGES,OVERPASS_CROSSING,roadLayerAt} from '../src/content/road-layers';
import {buildCellBlueprint} from '../src/world/cell-blueprint';
import {contactForTriangle} from '../src/sim/contacts';
import {samplePath,projectPath} from '../src/sim/lane-graph';
import {terrainOutsideRoads} from '../src/content/road-terrain-clipping';

describe('explicit road layers and actual contact materials',()=>{
  const crossing=OVERPASS_CROSSING,upper=nearestRoad(crossing.x,crossing.z,r=>r.id===crossing.upper),lower=nearestRoad(crossing.x,crossing.z,r=>r.id===crossing.lower);
  it('builds a real separated crossing without an impossible turn or raised lower terrain',()=>{
    expect(upper.point.y-lower.point.y).toBeCloseTo(8,1);
    expect(JUNCTIONS.some(j=>j.id==='ridgeway-parkway')).toBe(false);
    expect(terrainHeight(crossing.x,crossing.z)).toBeLessThan(lower.point.y);
    for(const n of [upper,lower]){const selected=nearestRoadAt({...crossing,y:n.point.y+.7});expect(selected.road.id).toBe(n.road.id);expect(LANE_GRAPH.nearest({...crossing,y:n.point.y+.7},n.point.yaw).path.roadId).toBe(n.road.id);}
  });
  it('keeps structural ramps continuous and inserts exact contact/lane boundaries',()=>{
    for(const b of BRIDGES){const road=ROADS.find(r=>r.id===b.roadId)!;for(const s of [b.start,b.end]){expect(road.points.some(p=>p.s===s)).toBe(true);expect(Math.abs(pointAt(road,s-.01).y-pointAt(road,s+.01).y)).toBeLessThan(.025);}expect(roadLayerAt(road,b.start+.001)).toBe(b.id);expect(roadLayerAt(road,b.end)).toBe('surface');}
    for(const road of ROADS.filter(r=>r.layers?.length))for(const path of LANE_GRAPH.paths.values())if(path.kind==='lane'&&path.roadId===road.id){
      for(let s=3;s<path.length-3;s+=7){const p=samplePath(path,s),roadS=projectPath(road,p,true).progress;expect(p.layer).toBe(roadLayerAt(road,roadS));}
    }
  });
  it('requires legal travel between stacked positions and rejects wrong-height arrivals',()=>{
    const a={...crossing,y:lower.point.y+.7,yaw:lower.point.yaw},b={...crossing,y:upper.point.y+.7,yaw:upper.point.yaw};
    const route=new RoadGraph().route(a,b);expect(route.length).toBeGreaterThan(40);let distance=0;for(let i=1;i<route.length;i++)distance+=Math.hypot(route[i].x-route[i-1].x,route[i].z-route[i-1].z);expect(distance).toBeGreaterThan(600);
    expect(atDestination(a,{...crossing,roadId:'pass'},30)).toBe(false);expect(atDestination(b,{...crossing,roadId:'pass'},30)).toBe(true);
  });
  it('retains per-road triangle tags through merged cell generation',()=>{
    const b=buildCellBlueprint(3,6,'Low'),roads=b.meshes.find(m=>m.name.startsWith('roads-'))!;expect(b.manifest.layers).toContain('ridgeway-overpass');
    expect(roads.contactRanges?.[0].start).toBe(0);let previous=0;for(const range of roads.contactRanges!){expect(range.start).toBe(previous);expect(contactForTriangle(roads,range.start)).toMatchObject({surface:'Asphalt',layer:range.layer,roadId:range.roadId});previous=range.end;}expect(previous).toBe(roads.data.indices.length/3);
    expect(new Set(roads.contactRanges!.map(r=>r.layer))).toContain('ridgeway-overpass');
    expect(contactForTriangle(b.meshes.find(m=>m.material==='terrain'),0)).toEqual({surface:'Grass',layer:'terrain'});
    expect(contactForTriangle(undefined,-1)).toEqual({surface:'Concrete',layer:'structure'});
  });
  it('clips ground polygons away from lower-road tires while retaining ground under the upper deck',()=>{
    const road=ROADS.find(r=>r.id==='ring')!,p=pointAt(road,5321,2),size=.25,bounds=[p.x-size,p.z-size,p.x+size,p.z+size] as const,quad=[{x:bounds[0],z:bounds[1]},{x:bounds[2],z:bounds[1]},{x:bounds[2],z:bounds[3]},{x:bounds[0],z:bounds[3]}];expect(terrainOutsideRoads([quad],bounds)).toEqual([]);
    const under=pointAt(upper.road,upper.progress-90),b=[under.x-size,under.z-size,under.x+size,under.z+size] as const,q=[{x:b[0],z:b[1]},{x:b[2],z:b[1]},{x:b[2],z:b[3]},{x:b[0],z:b[3]}];expect(terrainOutsideRoads([q],b)).toEqual([q]);
  });
});
