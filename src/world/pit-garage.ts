import type {ArchitectureBuffers} from './architecture';
import type {MeshDataBuilder} from './mesh-data';

/** Original Aster garage facade; three existing cell/material batches, no new textures. */
export function buildPitGarage(b:ArchitectureBuffers,x:number,y:number,z:number){
  const stone=[.82,.81,.76,1],metal=[.36,.43,.46,1],silver=[.73,.77,.78,1],blue=[.20,.44,.60,1];
  const box=(g:MeshDataBuilder,px:number,py:number,pz:number,w:number,h:number,d:number,color:number[])=>{
    const first=g.positions.length/3;g.box(x+px,y+py,z+pz,w,h,d);g.tintSince(first,color);
    if(g===b.glass)for(let i=first*2;i<g.uvs.length;i+=2){g.uvs[i]=.75;g.uvs[i+1]=.5;}
  };
  box(b.wall,0,0,0,230,9,19,stone);box(b.wall,0,0,0,230.25,.45,19.25,[.43,.46,.46,1]);
  box(b.roof,0,8.8,0,234,.36,22,metal);box(b.wall,0,8.5,-9.65,232,.30,.45,silver);
  // Recessed rolling shutters, deep columns, floating canopy and a glazed hospitality floor.
  box(b.roof,0,4.45,-10.4,232,.25,3.8,metal);box(b.wall,0,4.72,-10.55,231,.42,.28,blue);
  for(let bay=0;bay<12;bay++){
    const px=-105.6+bay*19.2;
    box(b.roof,px,.25,-9.59,15,3.9,.16,silver);
    for(let level=.55;level<3.9;level+=.42)box(b.roof,px,level,-9.7,14.8,.035,.03,metal);
    box(b.glass,px,2.65,-9.74,12.8,.58,.03,[.63,.80,.86,1]);
    box(b.glass,px,5.45,-9.54,17.3,2.55,.075,[.66,.80,.86,1]);
    for(const offset of [-8.7,-4.35,0,4.35,8.7])box(b.roof,px+offset,5.38,-9.65,.09,2.70,.17,metal);
    for(const side of [-1,1])box(b.wall,px+side*8.8,.45,-9.65,.55,3.95,.60,stone);
    box(b.roof,px,5.32,-9.67,17.65,.12,.25,silver);
    // Alternating sheltered side/rear windows avoid a featureless hangar silhouette.
    box(b.glass,px,5.6,9.55,15.4,2.25,.075,[.62,.76,.81,1]);
    if(bay%3===1){box(b.roof,px,9.16,2,3.2,.9,3,metal);box(b.roof,px,10.06,2,3.5,.10,3.3,silver);}
  }
  for(const side of [-1,1]){
    box(b.glass,side*115.05,5.45,0,.08,2.55,16.5,[.66,.80,.86,1]);
    for(let pz=-8;pz<=8;pz+=4)box(b.roof,side*115.14,5.32,pz,.19,2.83,.10,metal);
    box(b.wall,side*115.10,5.12,0,.25,.20,17,silver);
    box(b.roof,side*115.12,.45,2,.22,3.1,1.45,metal);
  }
  return {width:234,depth:24.6,height:10.16};
}
