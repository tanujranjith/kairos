import type {V3} from '../core/types';
import type {ArchitectureBuffers} from './architecture';
import {MeshDataBuilder} from './mesh-data';

/** Original covered Aster stand. Structural batches collide; seats/rails do not. */
export function buildGrandstand(b:ArchitectureBuffers,detail:MeshDataBuilder,x=900,y=17,z=-1544){
  const concrete=[.72,.75,.74,1],steel=[.40,.48,.52,1],trim=[.77,.82,.83,1];
  const point=(px:number,py:number,pz:number):V3=>({x:x+px,y:y+py,z:z+pz});
  const box=(g:MeshDataBuilder,px:number,py:number,pz:number,w:number,h:number,d:number,c:number[])=>{const first=g.positions.length/3;g.box(x+px,y+py,z+pz,w,h,d);g.tintSince(first,c);};
  const beam=(g:MeshDataBuilder,a:V3,c:V3,width:number,color:number[])=>{
    const first=g.positions.length/3,dx=c.x-a.x,dy=c.y-a.y,dz=c.z-a.z,length=Math.hypot(dx,dy,dz),horizontal=Math.hypot(dx,dz);
    const f={x:dx/length,y:dy/length,z:dz/length},r=horizontal>1e-6?{x:dz/horizontal,y:0,z:-dx/horizontal}:{x:1,y:0,z:0},u={x:f.y*r.z-f.z*r.y,y:f.z*r.x-f.x*r.z,z:f.x*r.y-f.y*r.x};
    g.box(0,0,0,width,width,length);
    for(let i=first*3;i<g.positions.length;i+=3){const px=g.positions[i],py=g.positions[i+1]-width/2,pz=g.positions[i+2];g.positions[i]=(a.x+c.x)/2+r.x*px+u.x*py+f.x*pz;g.positions[i+1]=(a.y+c.y)/2+r.y*px+u.y*py+f.y*pz;g.positions[i+2]=(a.z+c.z)/2+r.z*px+u.z*py+f.z*pz;}
    g.tintSince(first,color);
  };
  box(b.wall,0,-.15,0,181,1.15,26,concrete);
  box(b.wall,0,0,-9.3,180,1.4,7.4,concrete);
  let seats=0;
  for(let row=0;row<9;row++){
    const level=1.4+row*.47,pz=10.5-row*1.36;
    // Every tier reaches its foundation: no floating strips above a low block.
    box(b.wall,0,1,pz,178,level-1+.18,1.37,concrete);
    for(let seat=0;seat<248;seat++){
      const px=-86.45+seat*.70;if([-84,-42,0,42,84].some(aisle=>Math.abs(px-aisle)<1))continue;
      const first=detail.positions.length/3,color=(Math.floor(seat/12)+row)%3===0?[.80,.85,.86,1]:[.25,.60,.83,1];
      detail.quad(point(px-.28,level+.48,pz-.3),point(px+.28,level+.48,pz-.3),point(px-.28,level+.48,pz+.2),point(px+.28,level+.48,pz+.2));
      detail.quad(point(px-.28,level+.47,pz-.3),point(px-.28,level+.91,pz-.43),point(px+.28,level+.47,pz-.3),point(px+.28,level+.91,pz-.43));
      detail.quad(point(px+.28,level+.47,pz-.3),point(px+.28,level+.91,pz-.43),point(px-.28,level+.47,pz-.3),point(px-.28,level+.91,pz-.43));
      detail.tintSince(first,color);seats++;
    }
  }
  // Rear columns, visible diagonal brackets, cross beams and a pitched canopy.
  for(let px=-84;px<=84;px+=14){
    box(b.wall,px,1,-10,.55,8.2,.55,concrete);
    beam(b.roof,point(px,6.5,-10),point(px,8.6,9),.30,steel);
    beam(b.roof,point(px,9.15,-13),point(px,8.3,13),.34,trim);
    beam(b.roof,point(px,6.6,-10),point(px,8.96,-7),.22,steel);
  }
  for(const pz of [-13,-6,1,8,13])beam(b.roof,point(-92,8.73-pz*.033,pz),point(92,8.73-pz*.033,pz),.20,steel);
  const roofFirst=b.roof.positions.length/3;box(b.roof,0,8.75,0,184,.17,28,trim);
  for(let i=roofFirst*3;i<b.roof.positions.length;i+=3)b.roof.positions[i+1]-=(b.roof.positions[i+2]-z)*.033;
  // Open-front balustrade and restrained wire catch fencing along the safety wall.
  box(b.wall,0,0,16.3,186,.95,.7,concrete);box(b.roof,0,.95,16.3,186,.11,.82,trim);
  for(let px=-92;px<=92;px+=4){box(detail,px,.95,16.3,.055,2.8,.055,steel);if(px%8===4)beam(detail,point(px,.98,16.3),point(Math.min(px+4,92),3.65,16.3),.015,steel);}
  for(const h of [1.6,2.3,3.0,3.65])box(detail,0,h,16.3,184,.025,.025,steel);
  for(const px of [-88,-42,0,42,88]){
    beam(detail,point(px,2.6,11.2),point(px,6.35,-1.0),.045,trim);
    for(let row=0;row<9;row+=2)box(detail,px,1.4+row*.47,10.5-row*1.36,.045,1.05,.045,trim);
  }
  // Enclosed end walls under the tier profile, with inset exit doors.
  for(const side of [-1,1]){box(b.wall,side*89.5,1,-3.6,.45,4.95,1.4,concrete);box(b.roof,side*89.76,1.15,-8,.06,2.1,1.3,steel);}
  return {width:186,depth:30.0,height:9.4,seats};
}
