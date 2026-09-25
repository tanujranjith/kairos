import {Mesh,VertexData,type Material,type Scene} from '@babylonjs/core';
/** Highest actual triangle at a projected X/Z point; undefined outside the panel. */
export function panelHeight(panel:Mesh,x:number,z:number):number|undefined{
  const p=panel.getVerticesData('position')!,f=panel.getIndices()!;let top=-Infinity;
  for(let i=0;i<f.length;i+=3){
    const a=f[i]*3,b=f[i+1]*3,c=f[i+2]*3,den=(p[b+2]-p[c+2])*(p[a]-p[c])+(p[c]-p[b])*(p[a+2]-p[c+2]);if(Math.abs(den)<1e-10)continue;
    const u=((p[b+2]-p[c+2])*(x-p[c])+(p[c]-p[b])*(z-p[c+2]))/den,v=((p[c+2]-p[a+2])*(x-p[c])+(p[a]-p[c])*(z-p[c+2]))/den;
    if(u>=-1e-6&&v>=-1e-6&&u+v<=1+1e-6)top=Math.max(top,u*p[a+1]+v*p[b+1]+(1-u-v)*p[c+1]);
  }return Number.isFinite(top)?top:undefined;
}
export function panelSide(panel:Mesh,y:number,z:number,side:number):number|undefined{
  const p=panel.getVerticesData('position')!,f=panel.getIndices()!;let outer=-Infinity;
  for(let i=0;i<f.length;i+=3){
    const a=f[i]*3,b=f[i+1]*3,c=f[i+2]*3,den=(p[b+2]-p[c+2])*(p[a+1]-p[c+1])+(p[c+1]-p[b+1])*(p[a+2]-p[c+2]);if(Math.abs(den)<1e-10)continue;
    const u=((p[b+2]-p[c+2])*(y-p[c+1])+(p[c+1]-p[b+1])*(z-p[c+2]))/den,v=((p[c+2]-p[a+2])*(y-p[c+1])+(p[a+1]-p[c+1])*(z-p[c+2]))/den;
    if(u>=-1e-6&&v>=-1e-6&&u+v<=1+1e-6)outer=Math.max(outer,side*(u*p[a]+v*p[b]+(1-u-v)*p[c]));
  }return Number.isFinite(outer)?outer*side:undefined;
}
/** A thin paint decal clipped to actual upper panel triangles, including LOD
 * topology. Offset is 1.5mm: stripes cannot hover over or cut through a curved skin. */
export function panelStripe(scene:Scene,name:string,panel:Mesh,material:Material,x:number,width:number,z0:number,z1:number){
  return panelDecal(scene,name,panel,material,[[x-width/2,z0],[x+width/2,z0],[x+width/2,z1],[x-width/2,z1]]);
}
export function panelDecal(scene:Scene,name:string,panel:Mesh,material:Material,footprint:[number,number][],offset=.0015,side=0){
  const p=panel.getVerticesData('position')!,n=panel.getVerticesData('normal')!,faces=panel.getIndices()!,positions:number[]=[],indices:number[]=[],normals:number[]=[];
  const normalAxis=side?0:1,projectAxis=side?1:0,direction=side||1;
  const sign=Math.sign(footprint.reduce((a,v,i)=>{const next=footprint[(i+1)%footprint.length];return a+v[0]*next[1]-next[0]*v[1];},0));
  for(let f=0;f<faces.length;f+=3){
    const ids=[faces[f],faces[f+1],faces[f+2]];if(ids.reduce((sum,i)=>sum+n[i*3+normalAxis]*direction,0)<1)continue;
    // Clip the interpolated skin normal alongside each vertex. Recomputing
    // flat normals per clipped triangle makes a clear lamp look like metal shards.
    let poly=ids.map(i=>[p[i*3],p[i*3+1],p[i*3+2],n[i*3],n[i*3+1],n[i*3+2]]);
    for(let edge=0;edge<footprint.length;edge++){
      const start=footprint[edge],end=footprint[(edge+1)%footprint.length];
      const distance=(v:number[])=>sign*((end[0]-start[0])*(v[2]-start[1])-(end[1]-start[1])*(v[projectAxis]-start[0]));
      const clipped:number[][]=[];
      for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a),db=distance(b),insideA=da>=0,insideB=db>=0;
        if(insideA)clipped.push(a);
        if(insideA!==insideB){const t=da/(da-db);clipped.push(a.map((v,k)=>v+(b[k]-v)*t));}
      }poly=clipped;
    }
    const start=positions.length/3;for(const vertex of poly){vertex[normalAxis]+=offset*direction;positions.push(...vertex.slice(0,3));const length=Math.hypot(...vertex.slice(3))||1;normals.push(...vertex.slice(3).map(v=>v/length));}
    for(let i=1;i<poly.length-1;i++)indices.push(start,start+i,start+i+1);
  }
  const data=new VertexData();data.positions=positions;data.indices=indices;data.normals=normals;data.uvs=positions.flatMap((_,i)=>i%3===0?[positions[i],positions[i+2]]:[]);
  const result=new Mesh(name,scene);data.applyToMesh(result);result.material=material;return result;
}
