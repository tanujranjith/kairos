import {describe,expect,it} from 'vitest';
import {JUNCTIONS,ROADS,junctionRadius,nearestRoad,terrainHeight} from '../src/content/world';
import {MeshDataBuilder} from '../src/world/mesh-data';
import {buildUrbanSetting,URBAN_SITES,urbanReserved} from '../src/world/urban-setting';

describe('authored urban blocks',()=>{
  it('places four unique, road-clear and uniquely owned sites inside Westbrook',()=>{
    expect(URBAN_SITES).toHaveLength(4);expect(new Set(URBAN_SITES.map(site=>site.id)).size).toBe(4);expect(new Set(URBAN_SITES.map(site=>site.kind)).size).toBe(4);
    for(const site of URBAN_SITES){
      expect(site.x).toBeLessThan(-650);expect(site.z).toBeLessThan(-650);expect(site.cell).toBe(`${Math.floor(site.x/256)},${Math.floor(site.z/256)}`);expect(site.y).toBe(terrainHeight(site.x,site.z));
      const c=Math.cos(site.yaw),s=Math.sin(site.yaw);
      for(const across of [-site.width/2,site.width/2])for(const forward of [-site.depth/2,site.depth/2]){
        const x=site.x+across*c+forward*s,z=site.z-across*s+forward*c,n=nearestRoad(x,z,road=>ROADS.includes(road),1);
        expect(n.distance,`${site.id} corner approaches ${n.road.id}`).toBeGreaterThan(n.road.width/2+13);
      }
      expect(JUNCTIONS.every(junction=>Math.hypot(site.x-junction.x,site.z-junction.z)>junctionRadius(junction)+Math.hypot(site.width,site.depth)/2+8),`${site.id} blocks a junction`).toBe(true);
      expect(urbanReserved(site.x,site.z)).toBe(true);expect(urbanReserved(site.x+site.width,site.z)).toBe(false);
    }
  });

  it('builds bounded finite merged geometry, concrete pads and planted courtyards',()=>{
    let total=0;const rows:{id:string;triangles:number}[]=[];
    for(const site of URBAN_SITES){
      const b={wall:new MeshDataBuilder(),roof:new MeshDataBuilder(),glass:new MeshDataBuilder()},paint=new MeshDataBuilder(),instances=[] as Parameters<typeof buildUrbanSetting>[4];
      buildUrbanSetting(Number(site.cell.split(',')[0]),Number(site.cell.split(',')[1]),b,paint,instances);
      const data=[...Object.values(b).map(builder=>builder.finish()),paint.finish()],triangles=data.reduce((sum,mesh)=>sum+mesh.indices.length/3,0);total+=triangles;
      rows.push({id:site.id,triangles});expect(triangles,site.id).toBeGreaterThan(2000);expect(triangles,site.id).toBeLessThan(15000);expect(instances.filter(instance=>instance.kind==='oak').length,site.id).toBeGreaterThanOrEqual(3);
      expect(data.every(mesh=>[...mesh.positions,...mesh.normals,...(mesh.colors??[])].every(Number.isFinite))).toBe(true);
      const wall=data[0],padVertices=Math.ceil(site.width/8)*Math.ceil(site.depth/8)*4;
      for(let vertex=0;vertex<padVertices;vertex++){const offset=vertex*3;expect(wall.positions[offset+1],`${site.id} pad vertex ${vertex}`).toBeCloseTo(terrainHeight(wall.positions[offset],wall.positions[offset+2])+.09,4);}
      expect(paint.indices.length).toBeGreaterThanOrEqual(108);
    }
    expect(total,JSON.stringify(rows)).toBeLessThan(42000);
  });
});
