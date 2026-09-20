import {STREET_FIXTURES} from '../content/streetscape';
import type {ArchitectureBuffers} from './architecture';
import type {CellInstance} from './cell-blueprint';
import type {MeshDataBuilder} from './mesh-data';

/** Existing wall/roof/glass batches own every fixture; no per-prop draw or
 * separate material. Raised beds use the existing original oak leaf atlas. */
export function buildStreetscape(cx:number,cz:number,b:ArchitectureBuffers,instances:CellInstance[]){
  const dark=[.18,.24,.26,1],stone=[.61,.64,.61,1],wood=[.46,.30,.16,1];
  for(const f of STREET_FIXTURES.filter(f=>f.cell===`${cx},${cz}`)){
    const box=(g:MeshDataBuilder,x:number,y:number,z:number,w:number,h:number,d:number,color:number[])=>{
      const c=Math.cos(f.yaw),s=Math.sin(f.yaw),first=g.positions.length/3;
      g.box(f.x+x*c+z*s,f.y+y,f.z-x*s+z*c,w,h,d,f.yaw);g.tintSince(first,color);
      if(g===b.glass)for(let i=first*2;i<g.uvs.length;i+=2){g.uvs[i]=.75;g.uvs[i+1]=.5;}
    };
    const bench=()=>{
      for(const z of [-.83,.83]){box(b.roof,0,.06,z,.44,.40,.07,dark);box(b.roof,f.side*.22,.42,z,.055,.43,.065,dark);}
      for(let n=0;n<4;n++)box(b.wall,-.22+n*.145,.47,0,.11,.055,2.05,wood);
      for(let n=0;n<3;n++)box(b.wall,f.side*.24,.59+n*.10,0,.06,.068,2.05,wood);
      for(const z of [-.82,.82])box(b.roof,0,.66,z,.50,.04,.045,dark);
    };
    if(f.kind==='lamp'){
      box(b.wall,0,0,0,.34,.14,.34,stone);box(b.roof,0,.14,0,.14,7.22,.14,dark);
      box(b.roof,-f.side*.90,7.28,0,1.93,.11,.12,dark);
      box(b.roof,-f.side*1.80,7.20,0,.92,.12,.35,dark);
      box(b.glass,-f.side*1.80,7.18,0,.79,.015,.26,[1,1,1,1]);
    }else if(f.kind==='bench')bench();
    else if(f.kind==='bin'){
      box(b.roof,0,0,0,.45,.76,.45,dark);box(b.wall,0,.76,0,.49,.06,.49,stone);
      box(b.roof,-f.side*.23,.54,0,.012,.14,.26,[.06,.07,.07,1]);
      for(const z of [-.13,0,.13])box(b.roof,-f.side*.238,.10,z,.014,.34,.018,[.32,.38,.37,1]);
    }else if(f.kind==='planter'){
      box(b.wall,0,0,0,1.05,.44,2.75,stone);
      box(b.roof,0,.44,0,.88,.026,2.55,[.16,.13,.085,1]);
      for(const z of [-.70,.70]){
        const c=Math.cos(f.yaw),s=Math.sin(f.yaw);
        instances.push({kind:'oak',position:{x:f.x+z*s,y:f.y+.62,z:f.z+z*c},scale:{x:.115,y:.12,z:.15},yaw:f.yaw+z});
      }
    }else{
      bench();
      for(const z of [-1.7,1.7])for(const x of [-.64,.64])box(b.roof,x,0,z,.055,2.45,.055,dark);
      box(b.roof,0,2.43,0,1.55,.13,3.8,dark);
      // A solid perforated-style timber windbreak avoids glowing window glass.
      for(let z=-1.6;z<=1.6;z+=.2)box(b.wall,f.side*.66,.38,z,.038,1.85,.065,wood);
      box(b.wall,f.side*.66,1.05,1.15,.04,.87,.51,stone);
      for(let n=0;n<5;n++)box(b.roof,f.side*.686,1.19+n*.105,1.15,.014,.022,.38,dark);
    }
  }
}
