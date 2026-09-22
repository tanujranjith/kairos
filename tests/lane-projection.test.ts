import {describe,expect,it} from 'vitest';
import {TRAFFIC_GRAPH} from '../src/content/traffic-network';
import {projectPath,projectPathWindow,samplePath} from '../src/sim/lane-graph';

describe('bounded lane projection',()=>{
  it('matches full projection throughout every authored traffic path',()=>{
    for(const path of TRAFFIC_GRAPH.paths.values())for(let progress=0;progress<=path.length;progress+=Math.max(3,path.length/17)){
      const point=samplePath(path,progress),position={x:point.x+Math.cos(point.yaw)*1.7,y:point.y,z:point.z-Math.sin(point.yaw)*1.7};
      const full=projectPath(path,position,true),bounded=projectPathWindow(path,position,progress,60,true);
      expect(bounded.progress).toBeCloseTo(full.progress,5);expect(bounded.distance).toBeCloseTo(full.distance,5);expect(bounded.lateral).toBeCloseTo(full.lateral,5);
    }
  });

  it('keeps out-of-window traffic outside the local following corridor',()=>{
    const path=[...TRAFFIC_GRAPH.paths.values()].find(candidate=>candidate.length>300)!;
    const center=120,far=samplePath(path,290),bounded=projectPathWindow(path,far,center,130);
    expect(bounded.progress).toBeLessThanOrEqual(center+136);
    expect(bounded.distance).toBeGreaterThan(20);
  });
});
