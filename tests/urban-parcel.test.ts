import {describe,expect,it} from 'vitest';
import {terrainHeight} from '../src/content/world';
import {MeshDataBuilder} from '../src/world/mesh-data';
import {buildUrbanForecourt,buildUrbanParcel} from '../src/world/urban-parcel';
import {buildCellBlueprint} from '../src/world/cell-blueprint';

describe('procedural urban parcels',()=>{
  it('builds finite terrain-following concrete inside a narrow rotated apron',()=>{
    const builder=new MeshDataBuilder(),spec={x:-1210,z:-1040,width:22,depth:18,yaw:.63};buildUrbanParcel(builder,spec);const mesh=builder.finish(),triangles=mesh.indices.length/3;
    expect(triangles).toBeGreaterThan(20);expect(triangles).toBeLessThan(90);expect([...mesh.positions,...mesh.normals,...(mesh.colors??[])].every(Number.isFinite)).toBe(true);
    for(let index=0;index<mesh.positions.length;index+=3){const x=mesh.positions[index],y=mesh.positions[index+1],z=mesh.positions[index+2];expect(y).toBeCloseTo(terrainHeight(x,z)+.075,4);const dx=x-spec.x,dz=z-spec.z,c=Math.cos(spec.yaw),s=Math.sin(spec.yaw),across=dx*c-dz*s,forward=dx*s+dz*c;expect(Math.abs(across)).toBeLessThanOrEqual(spec.width/2+2.001);expect(Math.abs(forward)).toBeLessThanOrEqual(spec.depth/2+2.001);}
    const colors=[...new Set(mesh.colors)].sort();expect(colors).toHaveLength(3);expect(colors[0]).toBeCloseTo(.4,5);expect(colors[1]).toBeCloseTo(.42,5);expect(colors[2]).toBe(1);
  });
  it('integrates aprons into the collision-bearing concrete structure batch',()=>{
    const blueprint=buildCellBlueprint(-5,-5,'Low'),structure=blueprint.meshes.find(mesh=>mesh.name.startsWith('structures-'));expect(structure?.collision).toBe(true);expect(structure?.contactSurface).toEqual({surface:'Concrete',layer:'structure'});const colors=structure?.data.colors??new Float32Array(),positions=structure?.data.positions??new Float32Array();let parcelVertices=0,forecourtVertices=0;
    for(let index=0;index<colors.length;index+=4){const parcel=Math.abs(colors[index]-.4)<1e-4&&Math.abs(colors[index+1]-.42)<1e-4&&Math.abs(colors[index+2]-.4)<1e-4,forecourt=Math.abs(colors[index]-.31)<1e-4&&Math.abs(colors[index+1]-.33)<1e-4&&Math.abs(colors[index+2]-.32)<1e-4;if(!parcel&&!forecourt)continue;const offset=index/4*3,x=positions[offset],y=positions[offset+1],z=positions[offset+2];expect(y).toBeCloseTo(terrainHeight(x,z)+.075,4);if(parcel)parcelVertices++;else forecourtVertices++;}
    const paint=blueprint.meshes.find(mesh=>mesh.name.startsWith('paint-'))?.data.positions??new Float32Array();let bayVertices=0;for(let index=0;index<paint.length;index+=3)if(Math.abs(paint[index+1]-terrainHeight(paint[index],paint[index+2])-.091)<1e-4)bayVertices++;
    expect(parcelVertices).toBeGreaterThan(20);expect(forecourtVertices).toBeGreaterThan(8);expect(bayVertices).toBeGreaterThan(8);
  });
  it('adds marked parking only where the road setback leaves physical room',()=>{
    const concrete=new MeshDataBuilder(),paint=new MeshDataBuilder(),spec={x:-1180,z:-1040,width:20,depth:18,yaw:.35,roadWidth:10,lateral:34};
    expect(buildUrbanForecourt(concrete,paint,spec)).toBe(true);const pad=concrete.finish(),lines=paint.finish();expect(pad.indices.length/3).toBeGreaterThan(4);expect(pad.indices.length/3).toBeLessThan(40);expect(lines.indices.length/3).toBeGreaterThanOrEqual(8);
    for(let index=0;index<pad.positions.length;index+=3)expect(pad.positions[index+1]).toBeCloseTo(terrainHeight(pad.positions[index],pad.positions[index+2])+.075,4);
    expect(buildUrbanForecourt(new MeshDataBuilder(),new MeshDataBuilder(),{...spec,lateral:19})).toBe(false);
  });
});
