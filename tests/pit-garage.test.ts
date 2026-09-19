import {describe,it,expect} from 'vitest';
import {buildPitGarage} from '../src/world/pit-garage';
import {MeshDataBuilder} from '../src/world/mesh-data';

describe('original batched Aster garage',()=>{
  it('has finite architectural detail within a bounded triangle count and pit clearance',()=>{
    const buffers={wall:new MeshDataBuilder(),roof:new MeshDataBuilder(),glass:new MeshDataBuilder()};
    buildPitGarage(buffers,640,17,-1436);let triangles=0;
    for(const geometry of Object.values(buffers)){
      const mesh=geometry.finish();triangles+=mesh.indices.length/3;
      expect(mesh.positions.every(Number.isFinite)).toBe(true);expect(mesh.normals.every(Number.isFinite)).toBe(true);
      expect(mesh.colors!.length).toBe(mesh.positions.length/3*4);
      for(let i=0;i<mesh.positions.length;i+=3){expect(mesh.positions[i]).toBeGreaterThanOrEqual(523);expect(mesh.positions[i]).toBeLessThanOrEqual(757);expect(mesh.positions[i+2]).toBeGreaterThan(-1449);}
    }
    expect(triangles).toBeGreaterThan(1500);expect(triangles).toBeLessThan(4000);
    expect(buffers.glass.uvs.every((v,i)=>v===(i%2?.5:.75))).toBe(true);
  });
});
