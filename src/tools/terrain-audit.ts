type AuditMesh={positions:ArrayLike<number>;indices:ArrayLike<number>;sourcePositions?:ArrayLike<number>};

/** Independent float-buffer audit, deliberately unaware of the mesh generator.
 * A vertex on a triangle edge must agree with its interpolated height. */
export function auditTerrainSeams(meshes:AuditMesh[]){
  type Point={x:number;y:number;z:number};
  const buckets=new Map<string,Map<string,Point>>(),edges=new Map<string,[Point,Point]>();
  const key=(p:Point)=>`${p.x},${p.z}`,triangleKey=(points:Point[])=>points.map(key).sort().join('|'),incidentFaces=new Set<string>();let worst=0,count=0,nearbyFaceCorners=0;const examples:unknown[]=[];
  for(const mesh of meshes){
    const points:Point[]=[];
    for(let i=0;i<mesh.positions.length;i+=3){
      const [x,y,z]=[mesh.positions[i],mesh.positions[i+1],mesh.positions[i+2]],p={x,y,z},b=`${Math.floor(x/16)},${Math.floor(z/16)}`;points.push(p);if(!buckets.has(b))buckets.set(b,new Map());
      const previous=buckets.get(b)!.get(key(p));if(previous&&Math.abs(previous.y-y)>.002){const gap=Math.abs(previous.y-y);count++;worst=Math.max(worst,gap);if(examples.length<5)examples.push({previous,p,gap});}buckets.get(b)!.set(key(p),p);
    }
    for(let i=0;i<mesh.indices.length;i+=3){
      const ids=[mesh.indices[i],mesh.indices[i+1],mesh.indices[i+2]],face=ids.map(id=>points[id]),source=mesh.sourcePositions??mesh.positions;
      const [a,b,c]=ids.map(id=>({x:source[id*3],z:source[id*3+2]})),area=Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x)),length=Math.max(Math.hypot(b.x-a.x,b.z-a.z),Math.hypot(c.x-a.x,c.z-a.z),Math.hypot(c.x-b.x,c.z-b.z));
      // A narrow but real adjacent triangle is not a T-junction. Check its
      // pre-Float32 coordinates when available; never excuse a vertical face
      // created by a corner fan over truly collinear boundary vertices.
      if(area>length*(mesh.sourcePositions?3e-6:.0003))incidentFaces.add(triangleKey(face));
      for(let j=0;j<3;j++){const a=face[j],b=face[(j+1)%3],k=[key(a),key(b)].sort().join('|');edges.set(k,[a,b]);}
    }
  }
  for(const [a,b]of edges.values()){
    const dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz;if(l2<1e-10)continue;
    for(let cx=Math.floor((Math.min(a.x,b.x)-.001)/16);cx<=Math.floor((Math.max(a.x,b.x)+.001)/16);cx++)for(let cz=Math.floor((Math.min(a.z,b.z)-.001)/16);cz<=Math.floor((Math.max(a.z,b.z)+.001)/16);cz++)for(const p of buckets.get(`${cx},${cz}`)?.values()??[]){
      const t=((p.x-a.x)*dx+(p.z-a.z)*dz)/l2;if(t<.0001||t>.9999||Math.abs((p.x-a.x)*dz-(p.z-a.z)*dx)/Math.sqrt(l2)>.0003)continue;
      const gap=Math.abs(p.y-(a.y+(b.y-a.y)*t));if(gap>.002){if(incidentFaces.has(triangleKey([a,b,p]))){nearbyFaceCorners++;continue;}count++;worst=Math.max(worst,gap);if(examples.length<5)examples.push({a,b,p,gap});}
    }
  }
  return {count,worst,examples,nearbyFaceCorners,edges:edges.size,vertices:[...buckets.values()].reduce((sum,b)=>sum+b.size,0)};
}
