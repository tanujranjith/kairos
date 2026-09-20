import {describe,it,expect} from 'vitest';
import {buildCellBlueprint} from '../src/world/cell-blueprint';
import {conformTerrain,terrainTriangles} from '../src/world/terrain-mesh';
import {auditTerrainSeams as seamAudit} from '../src/tools/terrain-audit';
import {MeshDataBuilder} from '../src/world/mesh-data';

describe('terrain geometry continuity',()=>{
  it.each([['mountain',[[4,1],[4,2]]],['lakeshore',[[-2,0],[-2,-1]]],['forest',[[0,4],[1,4]]],['city',[[-6,-4],[-5,-4]]]] as const)('has no height cracks at clipped edges or adjacent %s cells',(_name,cells)=>{
      const data=cells.map(([x,z])=>buildCellBlueprint(x,z,'Low').meshes.find(m=>m.material==='terrain')!.data),audit=seamAudit(data);
      console.log('terrain seam audit',cells,JSON.stringify(audit));
      expect(audit.worst,JSON.stringify({cells,...audit})).toBeLessThan(.002);
  });
  it('preserves boundary segments when a corner fan would skip a collinear point',()=>{
    const points=[{x:0,z:0},{x:4,z:0},{x:8,z:0},{x:8,z:8},{x:0,z:8}],indices=terrainTriangles(points),edges=new Set<string>();
    for(let i=0;i<indices.length;i+=3)for(let j=0;j<3;j++)edges.add([indices[i+j],indices[i+(j+1)%3]].sort().join(','));
    expect(indices).toHaveLength(9);for(let i=0;i<points.length;i++)expect(edges.has([i,(i+1)%points.length].sort().join(','))).toBe(true);
    expect(edges.has('0,2')).toBe(false);
  });
  it('shares inserted edge heights with a halo while emitting only owned faces',()=>{
    const left=[{x:0,z:0},{x:16,z:0},{x:16,z:16},{x:0,z:16}],right=[{x:16,z:0},{x:32,z:0},{x:32,z:16},{x:16,z:16},{x:16,z:8}];
    const height=(x:number,z:number)=>x*.01+Math.sin(z/5),a=conformTerrain([left],[right],height).finish(),b=conformTerrain([right],[left],height).finish();
    expect(seamAudit([a,b]).worst).toBe(0);expect([...a.positions].filter((_,i)=>i%3===0).every(x=>x<=16)).toBe(true);
    expect([...a.positions].filter((_,i)=>i%3===2)).toContain(8);
  });
  it('distinguishes a real thin face from an unstitched vertical boundary fan',()=>{
    const sourcePositions=[.04,0,0,0,3,14,0,3,13.98,-1,3,14],positions=new Float32Array(sourcePositions),indices=new Uint32Array([0,1,2,1,3,2]);
    const thin=seamAudit([{positions,indices,sourcePositions}]);expect(thin.count).toBe(0);expect(thin.nearbyFaceCorners).toBeGreaterThan(0);
    const g=new MeshDataBuilder();g.polygon([{x:0,y:0,z:0},{x:16,y:0,z:0},{x:16,y:0,z:16},{x:0,y:0,z:16}]);
    g.polygon([{x:16,y:0,z:0},{x:32,y:0,z:0},{x:32,y:0,z:16},{x:16,y:0,z:16},{x:16,y:1,z:8}]);
    expect(seamAudit([{...g.finish(),sourcePositions:g.positions}]).worst).toBeGreaterThan(.5);
  });
});
