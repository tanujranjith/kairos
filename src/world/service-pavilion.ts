import {MeshDataBuilder} from './mesh-data';
import type {ArchitectureBuffers} from './architecture';

/** Original roadside workshop. Geometry is shared by the three service locations. */
export function buildServicePavilion(b:ArchitectureBuffers,paving:MeshDataBuilder,s:{x:number;y:number;z:number;yaw:number}){
  const c=Math.cos(s.yaw),n=Math.sin(s.yaw),stone=[.85,.82,.74,1],timber=[.47,.28,.14,1],metal=[.35,.42,.43,1],trim=[.82,.87,.85,1];
  const box=(g:MeshDataBuilder,x:number,y:number,z:number,w:number,h:number,d:number,color:number[])=>{
    const first=g.positions.length/3;g.box(s.x+x*c+z*n,s.y+y,s.z-x*n+z*c,w,h,d,s.yaw);g.tintSince(first,color);
    if(g===b.glass)for(let i=first*2;i<g.uvs.length;i+=2){g.uvs[i]=.75;g.uvs[i+1]=.5;}
  };
  box(paving,0,-.08,-2,26,.09,21,[.60,.61,.58,1]);
  // Main masonry volume, clerestory and floating fascia/canopy.
  box(b.wall,0,0,1,18,4.5,10,stone);box(b.wall,0,0,1,18.25,.32,10.25,[.42,.43,.41,1]);
  box(b.roof,0,4.5,1,19,.22,11,metal);box(b.roof,0,3.78,-5.2,20,.22,3.7,metal);
  for(const x of [-9,9])box(b.roof,x,0,-6.5,.14,3.85,.14,metal);
  // Broad garage door with horizontal slats and glazed upper lights.
  for(const x of [-5.4,-.1]){box(b.roof,x,.18,-4.065,4.7,3.10,.13,[.58,.62,.59,1]);for(let y=.35;y<3.2;y+=.26)box(b.roof,x,y,-4.15,4.55,.025,.025,[.30,.35,.34,1]);box(b.glass,x,2.35,-4.16,4.1,.47,.035,[.71,.85,.89,1]);for(const offset of [-1.5,-.5,.5,1.5])box(b.roof,x+offset,2.35,-4.185,.05,.47,.04,metal);}
  // Warm timber reception frontage with real frames, not one blank dark rectangle.
  for(let x=3;x<8.9;x+=.20)box(b.wall,x,.40,-4.13,.12,3.25,.12,timber);
  box(b.glass,5.9,.48,-4.23,4.7,2.72,.06,[.68,.82,.87,1]);
  for(const x of [3.50,5.1,6.7,8.3])box(b.roof,x,.42,-4.28,.065,2.85,.09,trim);
  box(b.roof,5.9,.42,-4.27,4.85,.065,.09,trim);box(b.roof,5.9,3.23,-4.27,4.85,.065,.09,trim);
  for(let x=-8.5;x<9;x+=.45)box(b.wall,x,3.86,-5.4,.09,.075,2.9,[.71,.52,.32,1]);
  // Roof machinery, terrace joints, bollards and planted beds stay in existing batches.
  box(b.roof,3,4.7,2,2.2,.7,2.2,[.68,.70,.67,1]);
  for(const x of [-10.5,10.5]){box(b.wall,x,0,-5,1.5,.60,5,stone);box(b.wall,x,.6,-5,1.3,.30,4.8,[.26,.39,.20,1]);}
  for(const x of [-8,-2,3,8])box(b.roof,x,0,-8,.12,.85,.12,metal);
  for(let x=-12;x<=12;x+=3)box(paving,x,.018,-3,.027,.004,18,[.38,.40,.39,1]);
  return {width:26,depth:21,height:5.4};
}
