import {Mesh,VertexData,type Material,type Scene} from '@babylonjs/core';
import type {VehicleDefinition} from '../core/types';
import {lerp} from '../core/math';
import {roadDesign} from './road-design';

type Point=[number,number,number];
/** Sculpted bumper surrounding a real recessed opening, not a flat end cap
 * covered by a floating grille. The outer boundary exactly matches the body. */
export function fascia(scene:Scene,d:VehicleDefinition,edge:Point[],front:boolean,lite:boolean,paint:Material,dark:Material){
  const sign=front?1:-1,plane=edge[0][2],style=roadDesign(d),cy=front?-.205:-.275;
  const openingW=front?style.grille:d.width*.34,openingH=front?(d.id==='crest'?.135:.115):.105;
  const boundary=[...edge,[0,-.445,plane] as Point],outer:Point[]=[];
  // Keep every original edge vertex so the loft and bumper cannot open a seam.
  for(let i=0;i<boundary.length;i++)for(let j=0;j<(lite?2:4);j++){
    const a=boundary[i],b=boundary[(i+1)%boundary.length],t=j/(lite?2:4);
    outer.push([lerp(a[0],b[0],t),lerp(a[1],b[1],t),plane]);
  }
  const opening=outer.map(([x,y])=>{
    const angle=Math.atan2((y+.10)/.30,x/(d.width*.5)),c=Math.cos(angle),s=Math.sin(angle);
    return [Math.sign(c)*Math.pow(Math.abs(c),front?.48:.36)*openingW*(front?1:1+.10*s),cy+Math.sign(s)*Math.pow(Math.abs(s),.55)*openingH,plane+sign*.035] as Point;
  });
  const build=(name:string,rings:Point[][],material:Material,fill=false)=>{
    const positions=rings.flat(2),indices:number[]=[],normals:number[]=[],uvs:number[]=[];
    const count=rings[0].length;
    for(let ring=0;ring<rings.length-1;ring++)for(let j=0;j<count;j++){
      const a=ring*count+j,b=ring*count+(j+1)%count,c=a+count,e=b+count;indices.push(a,b,c,b,e,c);
    }
    if(fill){const center=positions.length/3;positions.push(0,cy,rings.at(-1)![0][2]);const start=(rings.length-1)*count;for(let j=0;j<count;j++)indices.push(center,start+j,start+(j+1)%count);}
    // Babylon's generated normals use its left-handed surface convention.
    VertexData.ComputeNormals(positions,indices,normals);
    const averageZ=normals.reduce((n,v,i)=>n+(i%3===2?v:0),0);
    if(averageZ*sign<0){for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];VertexData.ComputeNormals(positions,indices,normals);}
    for(let i=0;i<positions.length;i+=3)uvs.push(positions[i],positions[i+1]);
    const data=new VertexData();data.positions=positions;data.indices=indices;data.normals=normals;data.uvs=uvs;
    const mesh=new Mesh(name,scene);data.applyToMesh(mesh);mesh.material=material;return mesh;
  };
  const rings:Point[][]=[];
  for(const t of (lite?[0,.46,1]:[0,.20,.46,.72,.90,1]))rings.push(outer.map((p,i)=>{
    const q=opening[i],shoulder=Math.sin(t*Math.PI)*(front?.070:.095);
    return [lerp(p[0],q[0],t),lerp(p[1],q[1],t),lerp(p[2],q[2],t)+sign*shoulder] as Point;
  }));
  const panel=build(front?'sculpted-front-bumper':'sculpted-rear-bumper',rings,paint);
  const parts=[panel];
  // Rear lower valance is a dark aero surface, not a painted loop around a mouth.
  // It shares the existing trim batch; no new draw material or overlapping faces.
  if(!front||d.class==='GT'){
    const data=VertexData.ExtractFromMesh(panel),indices=Array.from(data.indices!),positions=data.positions!,lower:number[]=[],upper:number[]=[];
    for(let i=0;i<indices.length;i+=3){const face=indices.slice(i,i+3),meanY=face.reduce((s,v)=>s+positions[v*3+1],0)/3;(meanY<-.355?lower:upper).push(...face);}
    panel.setIndices(upper);data.indices=lower;const blade=new Mesh(front?'carbon-front-lip':'carbon-rear-valance',scene);data.applyToMesh(blade);blade.material=dark;parts.push(blade);
  }
  const inset=opening.map(([x,y,z])=>[x*.97,cy+(y-cy)*.88,z-sign*(front?.14:.05)] as Point);
  const throat=build(front?'recessed-intake-throat':'recessed-rear-valance',[opening,inset],dark,true);
  parts.push(throat);return {panel,throat,parts,openingW,openingH,cy,plane,sign};
}

/** Project small fascia trim onto the actual XY surface, avoiding buried badges. */
export function fasciaDepth(panel:Mesh,x:number,y:number,sign:number){
  const p=panel.getVerticesData('position')!,f=panel.getIndices()!;let depth=-Infinity;
  for(let k=0;k<f.length;k+=3){const a=f[k]*3,b=f[k+1]*3,c=f[k+2]*3;
    const den=(p[b+1]-p[c+1])*(p[a]-p[c])+(p[c]-p[b])*(p[a+1]-p[c+1]);if(Math.abs(den)<1e-10)continue;
    const u=((p[b+1]-p[c+1])*(x-p[c])+(p[c]-p[b])*(y-p[c+1]))/den,v=((p[c+1]-p[a+1])*(x-p[c])+(p[a]-p[c])*(y-p[c+1]))/den;
    if(u>=-1e-6&&v>=-1e-6&&u+v<=1+1e-6)depth=Math.max(depth,sign*(u*p[a+2]+v*p[b+2]+(1-u-v)*p[c+2]));
  }return Number.isFinite(depth)?depth*sign:undefined;
}
