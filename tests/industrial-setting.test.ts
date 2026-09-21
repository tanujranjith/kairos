import {describe,it,expect} from 'vitest';
import {nearestRoad,terrainHeight,JUNCTIONS,junctionRadius} from '../src/content/world';
import {INDUSTRIAL_SITES,buildIndustrialSetting,industrialReserved} from '../src/world/industrial-setting';
import {MeshDataBuilder} from '../src/world/mesh-data';

describe('authored industrial compounds',()=>{
  it('owns four finite road-clear compounds outside junction sightlines',()=>{
    expect(INDUSTRIAL_SITES).toHaveLength(4);expect(new Set(INDUSTRIAL_SITES.map(site=>site.id)).size).toBe(4);expect(new Set(INDUSTRIAL_SITES.map(site=>site.kind))).toEqual(new Set(['containers','tanks','plant']));
    for(const site of INDUSTRIAL_SITES){
      expect([site.x,site.y,site.z,site.yaw,site.width,site.depth].every(Number.isFinite),site.id).toBe(true);
      expect(Math.abs(site.y-terrainHeight(site.x,site.z)),site.id).toBeLessThan(1e-8);
      expect(nearestRoad(site.x,site.z,r=>r.id==='industrial').distance,site.id).toBeGreaterThan(65);
      expect(JUNCTIONS.every(j=>Math.hypot(j.x-site.x,j.z-site.z)>junctionRadius(j)+34),site.id).toBe(true);
      expect(site.cell,site.id).toBe(`${Math.floor(site.x/256)},${Math.floor(site.z/256)}`);expect(industrialReserved(site.x,site.z),site.id).toBe(true);
    }
    expect(industrialReserved(0,0)).toBe(false);
  });
  it('merges detailed finite collision-ready geometry into existing structure buffers',()=>{
    let triangles=0;
    for(const site of INDUSTRIAL_SITES){const [cx,cz]=site.cell.split(',').map(Number),b={wall:new MeshDataBuilder(),roof:new MeshDataBuilder(),glass:new MeshDataBuilder()};buildIndustrialSetting(cx,cz,b);const data=Object.values(b).map(builder=>builder.finish());expect(data.some(mesh=>mesh.positions.length>0)).toBe(true);for(const mesh of data){expect([...mesh.positions,...mesh.normals,...mesh.colors??[]].every(Number.isFinite)).toBe(true);triangles+=mesh.indices.length/3;}}
    expect(triangles).toBeGreaterThan(2500);expect(triangles).toBeLessThan(12000);
  });
});
