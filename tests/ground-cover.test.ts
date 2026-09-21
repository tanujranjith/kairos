import {describe,it,expect} from 'vitest';
import {NullEngine,Scene,PBRMaterial,ShaderLanguage,MaterialDefines} from '@babylonjs/core';
import {applyGroundChannels,smoothGroundNormals,groundChannels,GRAVEL_TINT,AGRICULTURAL_FIELDS,agriculturalFieldWeight} from '../src/world/ground-cover';
import {GroundMaterial,GROUND_PALETTE,groundShader} from '../src/render/ground-material';
import {MeshDataBuilder} from '../src/world/mesh-data';
import {ROADS,pointAt,terrainHeight} from '../src/content/world';
import {buildCellBlueprint,blueprintTransfers} from '../src/world/cell-blueprint';

describe('continuous ground cover',()=>{
  it('changes only material channels, never driving geometry, normals or triangle order',()=>{
    const g=new MeshDataBuilder();g.quad({x:-384,y:13,z:92},{x:-368,y:13,z:92},{x:-384,y:13,z:108},{x:-368,y:13,z:108});
    const data=g.finish(),original={positions:data.positions,indices:data.indices,normals:data.normals,uvs:data.uvs};
    const values=Object.fromEntries(Object.entries(original).map(([k,v])=>[k,Array.from(v)]));applyGroundChannels(data);
    for(const key of ['positions','indices','normals','uvs'] as const){expect(data[key]).toBe(original[key]);expect(Array.from(data[key])).toEqual(values[key]);}
    expect(data.colors).toHaveLength(data.positions.length/3*4);
    expect([...data.colors!].every(v=>Number.isFinite(v)&&v>=0&&v<=1)).toBe(true);
  });
  it('uses continuous world coordinates at cell edges and ignores raised bridge decks',()=>{
    for(const z of [-512,12,512,1200]){
      const a=groundChannels(255.999,terrainHeight(255.999,z),z),b=groundChannels(256.001,terrainHeight(256.001,z),z);
      expect(Math.max(...a.map((v,i)=>Math.abs(v-b[i])))).toBeLessThan(.001);
    }
    const bridge=pointAt(ROADS.find(r=>r.id==='northbridge')!,750);
    expect(bridge.y-terrainHeight(bridge.x,bridge.z)).toBeGreaterThan(2);
    expect(groundChannels(bridge.x,terrainHeight(bridge.x,bridge.z),bridge.z)[0]).toBe(1);
    const road=pointAt(ROADS.find(r=>r.id==='lakeshore')!,1790,6);
    expect(groundChannels(road.x,terrainHeight(road.x,road.z),road.z)[0]).toBeLessThan(.03);
  });
  it('adds five smooth farm-field masks without changing terrain ownership or contacts',()=>{
    expect(AGRICULTURAL_FIELDS).toHaveLength(5);
    for(const field of AGRICULTURAL_FIELDS){
      expect([field.x,field.z,field.yaw,field.width,field.length].every(Number.isFinite)).toBe(true);
      expect(agriculturalFieldWeight(field.x,field.z)).toBe(1);
      expect(agriculturalFieldWeight(field.x+field.cos*(field.width*.5+6),field.z-field.sin*(field.width*.5+6))).toBe(0);
      const channels=groundChannels(field.x,terrainHeight(field.x,field.z),field.z);expect(channels[2]).toBe(1);expect(channels[3]).toBe(1);
    }
    expect(agriculturalFieldWeight(0,0)).toBe(0);
  });
  it('shares unit visual normals across triangles/cells without altering collision geometry',()=>{
    const g=new MeshDataBuilder();for(const x of [240,256])g.quad({x,y:20,z:500},{x:x+16,y:22,z:500},{x,y:20,z:516},{x:x+16,y:22,z:516});
    const data=g.finish(),positions=Array.from(data.positions),indices=Array.from(data.indices);smoothGroundNormals(data);
    expect(Array.from(data.positions)).toEqual(positions);expect(Array.from(data.indices)).toEqual(indices);
    const edge:number[][]=[];
    for(let i=0;i<data.positions.length;i+=3){const n=Array.from(data.normals.slice(i,i+3));expect(Math.hypot(...n)).toBeCloseTo(1,6);expect(n[1]).toBeGreaterThan(0);if(data.positions[i]===256&&data.positions[i+2]===500)edge.push(n);}
    expect(edge).toHaveLength(2);expect(edge[0]).toEqual(edge[1]);
  });
  it('retains transferable channel ownership and bounded finite material weights',()=>{
    for(const [x,z]of [[-2,0],[-6,-4],[4,1],[0,4]]){
      const cell=buildCellBlueprint(x,z,'Low'),transfers=blueprintTransfers(cell),ground=cell.meshes.find(m=>m.material==='terrain')!;
      expect(new Set(transfers).size).toBe(transfers.length);expect(transfers.reduce((s,b)=>s+b.byteLength,0)).toBe(cell.bytes);
      expect(ground.collision).toBe(true);expect(ground.contactSurface).toEqual({surface:'Grass',layer:'terrain'});
      expect([...ground.data.colors!].every(v=>Number.isFinite(v)&&v>=0&&v<=1)).toBe(true);
    }
  });
  it('keeps native GLSL/WGSL PBR hooks and adds no texture, mesh or light resources',()=>{
    const engine=new NullEngine(),scene=new Scene(engine),material=new PBRMaterial('ground-test',scene);
    try{
      const before=[scene.textures.length,scene.meshes.length,scene.lights.length],ground=new GroundMaterial(material),defines=new MaterialDefines();ground.prepareDefines(defines);
      expect(defines.KAIROS_GROUND).toBe(true);expect(defines.KAIROS_GROUND_FLOOR).toBe(false);
      for(const language of [ShaderLanguage.GLSL,ShaderLanguage.WGSL]){expect(ground.isCompatible(language)).toBe(true);const code=groundShader(language);expect(code.CUSTOM_FRAGMENT_DEFINITIONS).toContain('kairosGroundNoise');expect(code.CUSTOM_FRAGMENT_BEFORE_LIGHTS).toContain('geometricNormalW');expect(code.CUSTOM_FRAGMENT_BEFORE_LIGHTS).toContain('kgField');expect(code.CUSTOM_FRAGMENT_BEFORE_LIGHTS).toContain('surfaceAlbedo=');}
      expect([scene.textures.length,scene.meshes.length,scene.lights.length]).toEqual(before);
      expect(Object.values(GROUND_PALETTE).flat().every(v=>v>0&&v<1)).toBe(true);
    }finally{scene.dispose();engine.dispose();}
  });
  it('tints gravel but keeps concrete shoulders distinct without changing their contacts',()=>{
    const surfaces=new Set<string>();
    for(const [x,z]of [[-2,0],[-6,-4],[-5,2]])for(const mesh of buildCellBlueprint(x,z,'Low').meshes.filter(m=>m.name.startsWith('verge-'))){
      for(const range of mesh.contactRanges??[]){surfaces.add(range.surface);const index=mesh.data.indices[range.start*3],color=Array.from(mesh.data.colors!.slice(index*4,index*4+4)),expected=range.surface==='Concrete'?[1,1,1,1]:GRAVEL_TINT;expected.forEach((v,i)=>expect(color[i]).toBeCloseTo(v,6));}
      expect(mesh.collision).toBe(true);
    }
    expect(surfaces).toEqual(new Set(['Gravel','Concrete']));
  });
});
