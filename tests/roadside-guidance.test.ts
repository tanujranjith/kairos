import {describe,it,expect} from 'vitest';
import {CELL_SIZE,JUNCTIONS,inLake,junctionRadius,nearestRoad,terrainHeight} from '../src/content/world';
import {buildCellBlueprint} from '../src/world/cell-blueprint';
import {roadsideGuidance} from '../src/world/roadside-guidance';

describe('streamed roadside guidance',()=>{
  it('owns regular finite delineators outside water, structures and junction sightlines',()=>{
    let count=0;
    const roads=new Set<string>();
    for(let cx=-9;cx<=8;cx++)for(let cz=-9;cz<=8;cz++){
      const data=roadsideGuidance(cx,cz);expect(data).toEqual(roadsideGuidance(cx,cz));
      for(const post of data.delineators){
        expect(Math.floor(post.x/CELL_SIZE)).toBe(cx);expect(Math.floor(post.z/CELL_SIZE)).toBe(cz);
        expect([post.x,post.y,post.z,post.yaw,post.progress].every(Number.isFinite)).toBe(true);
        expect(Math.abs(post.y-terrainHeight(post.x,post.z))).toBeLessThan(1e-8);
        expect(inLake(post.x,post.z)).toBe(false);
        expect(JUNCTIONS.every(j=>Math.hypot(j.x-post.x,j.z-post.z)>=junctionRadius(j)+10)).toBe(true);
        const near=nearestRoad(post.x,post.z,r=>r.id===post.roadId);
        expect(near.distance).toBeGreaterThan(near.road.width/2+1.8);
        expect(near.distance).toBeLessThan(near.road.width/2+2.3);
        roads.add(post.roadId);count++;
      }
    }
    expect(count).toBeGreaterThan(300);
    expect(roads).toEqual(new Set(['lakeshore','northbridge','pass','forest','south']));
  });

  it('merges white posts and amber reflectors into non-colliding paint batches',()=>{
    let checked=0;
    for(let cx=-9;cx<=8&&checked<8;cx++)for(let cz=-9;cz<=8&&checked<8;cz++){
      const posts=roadsideGuidance(cx,cz).delineators;if(!posts.length)continue;
      const blueprint=buildCellBlueprint(cx,cz,'Low'),paint=blueprint.meshes.find(m=>m.name.startsWith('paint-')),center=blueprint.meshes.find(m=>m.name.startsWith('center-'));
      expect(paint?.collision).toBe(false);expect(center?.collision).toBe(false);
      expect(paint?.material).toBe('marking');expect(center?.material).toBe('yellow');
      expect(paint!.data.positions.length).toBeGreaterThanOrEqual(posts.length*2*24*3);
      expect(center!.data.positions.length).toBeGreaterThanOrEqual(posts.length*2*24*3);
      expect(paint!.data.colors?.length).toBe(paint!.data.positions.length/3*4);
      expect(center!.data.colors?.length).toBe(center!.data.positions.length/3*4);
      expect([...paint!.data.colors!].some((value,index)=>index%4===0&&Math.abs(value-.055)<1e-6)).toBe(true);
      expect([...center!.data.colors!].some((value,index)=>index%4===1&&Math.abs(value-.63)<1e-6)).toBe(true);
      checked++;
    }
    expect(checked).toBe(8);
  });
});
