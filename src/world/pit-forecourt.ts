import {PIT_GARDENS} from '../content/circuit-landscape';
import {CELL_SIZE} from '../content/world';
import type {ArchitectureBuffers} from './architecture';
import type {MeshDataBuilder} from './mesh-data';

/** Original working-paddock architecture. Uses the cell's existing materials;
 * all solid props sit behind the lane and clear of the painted service boxes. */
export function buildPitForecourt(cx:number,cz:number,b:ArchitectureBuffers,paving:MeshDataBuilder,paint:MeshDataBuilder){
  const owns=(x:number,z:number)=>Math.floor(x/CELL_SIZE)===cx&&Math.floor(z/CELL_SIZE)===cz;
  const stone=[.73,.76,.74,1],dark=[.17,.23,.26,1],steel=[.53,.61,.63,1],blue=[.18,.44,.61,1],white=[.91,.91,.86,1];
  const box=(g:MeshDataBuilder,x:number,y:number,z:number,w:number,h:number,d:number,color:number[],yaw=0)=>{
    const first=g.positions.length/3;g.box(x,y,z,w,h,d,yaw);g.tintSince(first,color);
    if(g===b.glass)for(let i=first*2;i<g.uvs.length;i+=2){g.uvs[i]=.75;g.uvs[i+1]=.5;}
  };
  // Continuous forecourt links replace the bare rectangular gaps. The painted
  // lane and its shoulder are unchanged; these slabs begin behind the apron.
  for(const x of [768,1024,1280])if(owns(x,-1438)){
    const start=x===1280?-1448:-1456;
    box(paving,x,17.026,(start-1420)/2,26,.008,-1420-start,[.79,.80,.76,1]);
    for(let z=start+2;z<-1420;z+=3)box(paint,x,17.044,z,25,.002,.025,[.42,.46,.45,1]);
  }
  for(const p of PIT_GARDENS)if(owns(p.x,p.z)){
    for(const side of [-1,1]){
      box(b.wall,p.x,17,p.z+side*p.depth/2,p.width,.48,.16,stone);
      box(b.wall,p.x+side*p.width/2,17,p.z,.16,.48,p.depth,stone);
    }
    box(b.roof,p.x,17.42,p.z,p.width-.15,.025,p.depth-.15,[.18,.14,.10,1]);
  }
  // A glazed race-control cabin, external stair flights, balcony and mast give
  // the pit complex a recognizable vertical landmark, not another long shed.
  if(owns(768,-1435)){
    const x=768,z=-1435;
    box(b.wall,x,16.84,z,10,12.8,14,stone);
    for(const y of [20.6,24.3,28]){
      box(b.roof,x,y,z,10.5,.25,14.5,dark);
      box(b.glass,x,y-2.65,z-7.06,8.6,2.05,.055,[.65,.80,.83,1]);
      for(const dx of [-2.9,0,2.9])box(b.roof,x+dx,y-2.7,z-7.14,.08,2.17,.12,steel);
    }
    box(b.wall,x,29.15,z,16,.5,18,stone);
    box(b.roof,x,29.65,z,15.7,.12,17.7,dark);
    box(b.wall,x,29.77,z,13,1,15,[.53,.58,.57,1]);
    box(b.glass,x,30.77,z,13.1,2.75,15.1,[.62,.80,.87,1]);
    for(const dx of [-6.62,6.62])box(b.roof,x+dx,30.6,z,.16,3.2,15.25,steel);
    for(let dx=-6;dx<=6;dx+=2)for(const side of [-1,1])box(b.roof,x+dx,30.6,z+side*7.62,.11,3.2,.14,steel);
    box(b.roof,x,33.58,z,16,.34,18,dark);
    box(b.wall,x,33.92,z-8.85,15.5,.38,.15,white);
    for(const side of [-1,1]){
      for(let dx=-7.5;dx<=7.5;dx+=1.5)box(b.roof,x+dx,29.65,z+side*8.7,.045,1.05,.045,steel);
      box(b.roof,x,30.65,z+side*8.7,15.7,.055,.055,steel);
      box(b.roof,x+side*7.8,30.65,z,.055,.055,17.4,steel);
      box(b.roof,x+side*4.5,33.92,z,.09,4.4,.09,steel);
      for(const dy of [1.8,2.5,3.2])box(b.roof,x+side*4.5,33.92+dy,z,1.2,.035,.035,steel);
    }
    // Four alternating real stair flights, rather than a painted stair texture.
    for(let flight=0;flight<4;flight++){
      const y=17+flight*3.12,side=flight%2?1:-1;
      for(let step=0;step<16;step++)box(b.roof,x+6.4,y+step*.195,z+side*(-4.5+step*.54),1.5,.12,.56,steel);
      box(b.roof,x+6.4,y+3.12,z+side*4.7,2,.14,1.4,dark);
      for(const dx of [-.82,.82]){
        for(let step=0;step<=15;step+=3)box(b.roof,x+6.4+dx,y+step*.195,z+side*(-4.5+step*.54),.045,1.05,.045,steel);
        const first=b.roof.positions.length/3,p=(end:number,dy:number)=>({x:x+6.4+dx,y:y+1+end*2.925+dy,z:z+side*(-4.5+end*8.1)});
        b.roof.quad(p(0,0),p(1,0),p(0,.045),p(1,.045));b.roof.quad(p(1,0),p(0,0),p(1,.045),p(0,.045));b.roof.tintSince(first,steel);
      }
    }
    box(b.roof,x,17,z-7.13,2,2.7,.08,dark);
  }
  // Sheltered seating fills the next gap without obstructing its central walk.
  if(owns(1024,-1436)){
    for(const side of [-1,1]){
      for(const z of [-1441,-1432])box(b.roof,1024+side*8.5,17,z,.18,3.3,.18,dark);
      box(b.roof,1024+side*8.5,20.3,-1436.5,.25,.22,10,steel);
      for(let z=-1441;z<=-1432;z+=.7)box(b.roof,1024+side*6.9,20.52,z,3.6,.14,.16,steel);
      for(const z of [-1439,-1434]){
        box(b.roof,1024+side*6.9,17.45,z,3.2,.10,.55,[.66,.45,.25,1]);
        for(const dx of [-1.2,1.2])box(b.roof,1024+side*6.9+dx,17,z,.07,.47,.46,dark);
      }
    }
  }
  // Twelve wall-side equipment stations: rolling tool cabinets and wheel racks.
  // No new props occupy the center of a work box or the continuous fast lane.
  for(const center of [640,896,1152])for(let bay=0;bay<12;bay+=3){
    const x=center-105.6+(center===640&&bay===0?2:bay)*19.2+6.9,z=-1447.9;if(!owns(x,z))continue;
    box(b.roof,x,17.18,z,1.5,.86,.63,blue);box(b.roof,x,18.04,z,1.6,.075,.71,steel);
    for(let h=.38;h<.9;h+=.17)box(b.roof,x,17+h,z-.33,1.25,.025,.025,white);
    for(const dx of [-.58,.58])for(const dz of [-.22,.22])box(b.roof,x+dx,17.025,z+dz,.16,.16,.11,dark);
    const rx=x+2.2;
    for(const dx of [-.7,.7])box(b.roof,rx+dx,17,z,.06,1.9,.06,steel);
    for(const h of [.26,1.12,1.9])box(b.roof,rx,17+h,z,1.5,.06,.6,steel);
    // Faceted annular tires with open centers; merged in the existing trim batch.
    for(const dx of [-.39,.39])for(const h of [.67,1.52]){
      const first=b.roof.positions.length/3,p=(a:number,r:number,depth:number)=>({x:rx+dx+Math.sin(a)*r,y:17+h+Math.cos(a)*r,z:z+depth});
      for(let i=0;i<12;i++){const a=i/12*Math.PI*2,c=(i+1)/12*Math.PI*2;b.roof.quad(p(a,.34,-.19),p(c,.34,-.19),p(a,.34,.19),p(c,.34,.19));for(const side of [-1,1])b.roof.quad(p(a,.34,side*.19),p(a,.21,side*.19),p(c,.34,side*.19),p(c,.21,side*.19));}
      b.roof.tintSince(first,[.065,.073,.074,1]);
    }
  }
}
