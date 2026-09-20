import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const output=process.argv.find(v=>v.startsWith('--output='))?.slice(9)??'output/terrain-seams/atlas',legacy=process.argv.includes('--legacy');await fs.mkdir(output,{recursive:true});
const server=await createServer({server:{middlewareMode:true},appType:'custom'}),report={legacy,cells:[]};
try{
  const {buildTerrainMesh}=await server.ssrLoadModule('/src/world/terrain-mesh.ts'),{auditTerrainSeams}=await server.ssrLoadModule('/src/tools/terrain-audit.ts');
  const {MeshDataBuilder}=await server.ssrLoadModule('/src/world/mesh-data.ts'),{terrainHeight}=await server.ssrLoadModule('/src/content/world.ts');
  const {terrainOutsideHandling}=await server.ssrLoadModule('/src/content/handling-course.ts'),{terrainOutsideJunctions}=await server.ssrLoadModule('/src/content/terrain-clipping.ts'),{terrainOutsideRoads}=await server.ssrLoadModule('/src/content/road-terrain-clipping.ts');
  const oldMesh=(cx,cz,height)=>{const g=new MeshDataBuilder();for(let x=cx*256;x<(cx+1)*256;x+=16)for(let z=cz*256;z<(cz+1)*256;z+=16)for(const bounds of terrainOutsideHandling([x,z,x+16,z+16]))for(const polygon of terrainOutsideRoads(terrainOutsideJunctions(bounds),bounds))g.polygon(polygon.map(p=>({...p,y:height(p.x,p.z)})));return g;};
  const area=g=>{let sum=0;for(let i=0;i<g.indices.length;i+=3){const a=g.indices[i]*3,b=g.indices[i+1]*3,c=g.indices[i+2]*3,p=g.positions;sum+=Math.abs((p[b]-p[a])*(p[c+2]-p[a+2])-(p[b+2]-p[a+2])*(p[c]-p[a]))/2;}return sum;};
  const meshes=[],start=performance.now();
  for(let cx=-9;cx<=8;cx++){
    for(let cz=-9;cz<=8;cz++){
      let geometry;
      if(legacy)geometry=oldMesh(cx,cz,terrainHeight);
      else geometry=buildTerrainMesh(cx,cz);
      const data=geometry.finish(),areaDelta=legacy?0:Math.abs(area(geometry)-area(oldMesh(cx,cz,()=>0)));meshes.push({...data,sourcePositions:geometry.positions});report.cells.push({cx,cz,vertices:data.positions.length/3,triangles:data.indices.length/3,areaDelta});
      assert.ok([...data.positions].every(Number.isFinite),`${cx},${cz} finite positions`);
      assert.ok(areaDelta<.025,`${cx},${cz} changed ground footprint by ${areaDelta}m²`);
      for(let i=0;i<data.positions.length;i+=3)assert.ok(data.positions[i]>=cx*256-.001&&data.positions[i]<=(cx+1)*256+.001&&data.positions[i+2]>=cz*256-.001&&data.positions[i+2]<=(cz+1)*256+.001,`${cx},${cz} emitted halo faces`);
    }
    console.log(JSON.stringify({legacy,column:cx,cells:report.cells.length}));
  }
  report.elapsedMs=performance.now()-start;report.audit=auditTerrainSeams(meshes);report.triangles=report.cells.reduce((sum,c)=>sum+c.triangles,0);report.maxAreaDelta=Math.max(...report.cells.map(c=>c.areaDelta));
  report.scope='All 324 allowed streamed cells, including shared borders. Independent float-buffer T-junction/duplicate-height audit with 0.3mm horizontal and 2mm vertical tolerances; connected thin faces classified using pre-quantization coordinates. Projected footprint retained within 0.025m² per 65536m² cell; no halo faces. Not a runtime performance or complete physical contact test.';
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({legacy,elapsedMs:report.elapsedMs,triangles:report.triangles,audit:report.audit}));if(!legacy)assert.equal(report.audit.count,0);
}catch(error){report.failure=String(error);await fs.writeFile(`${output}/failure.json`,JSON.stringify(report,null,2));throw error;}finally{await server.close();}
