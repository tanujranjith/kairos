import type { V3 } from '../core/types';
import { MeshDataBuilder } from './mesh-data';

export type BuildingStyle='brick'|'limestone'|'office'|'factory'|'house';
export interface BuildingSpec {x:number;y:number;z:number;width:number;depth:number;height:number;yaw:number;style:BuildingStyle;seed:number}
export interface ArchitectureBuffers {wall:MeshDataBuilder;roof:MeshDataBuilder;glass:MeshDataBuilder}
const palettes={brick:[.64,.36,.24,1],limestone:[.94,.89,.74,1],office:[.73,.78,.79,1],factory:[.59,.66,.68,1],house:[.84,.81,.68,1]} as const;

/** Original modular architecture, merged per material/cell rather than one draw per window. */
export function buildArchitecture(b:ArchitectureBuffers,s:BuildingSpec){
  const {x,y,z,width:w,depth:d,yaw,style}=s,h=style==='house'?5.1:style==='brick'?Math.min(s.height,19):s.height,cos=Math.cos(yaw),sin=Math.sin(yaw);
  const point=(px:number,py:number,pz:number):V3=>({x:x+px*cos+pz*sin,y:y+py,z:z-px*sin+pz*cos});
  const box=(g:MeshDataBuilder,px:number,py:number,pz:number,width:number,height:number,depth:number,color:readonly number[])=>{const first=g.positions.length/3,p=point(px,py,pz);g.box(p.x,p.y,p.z,width,height,depth,yaw);g.tintSince(first,color);
    if(g===b.glass){const occupied=Math.abs(Math.round(px*31+pz*13+py*7)+s.seed)%5<2;for(let i=first*2;i<g.uvs.length;i+=2){g.uvs[i]=occupied?.75:.25;g.uvs[i+1]=.5;}}
  };
  const pane=(front:boolean,side:number,offset:number,bottom:number,width:number,height:number,plane:number,color:readonly number[])=>{
    const first=b.glass.positions.length/3,left=offset-width/2,right=offset+width/2,top=bottom+height;
    const points=front
      ?side<0?[point(left,bottom,plane),point(right,bottom,plane),point(left,top,plane),point(right,top,plane)]:[point(right,bottom,plane),point(left,bottom,plane),point(right,top,plane),point(left,top,plane)]
      :side<0?[point(plane,bottom,right),point(plane,bottom,left),point(plane,top,right),point(plane,top,left)]:[point(plane,bottom,left),point(plane,bottom,right),point(plane,top,left),point(plane,top,right)];
    b.glass.quad(points[0],points[1],points[2],points[3]);b.glass.tintSince(first,color);
    const occupied=Math.abs(Math.round((front?offset:plane)*31+(front?plane:offset)*13+bottom*7)+s.seed)%5<2;
    for(let i=first*2;i<b.glass.uvs.length;i+=2){b.glass.uvs[i]=occupied?.75:.25;b.glass.uvs[i+1]=.5;}
  };
  const wall=palettes[style],trim=[.86,.83,.73,1],metal=[.59,.65,.67,1],glass=[.55,.77,.88,1];
  const office=style==='office',factory=style==='factory',house=style==='house',setback=office?1.2:0;
  box(b.wall,0,0,0,w,office?4.3:h,d,wall);
  if(office)box(b.wall,0,4.3,0,w-setback*2,h-4.3,d-setback*2,wall);
  box(b.wall,0,0,0,w+.35,.48,d+.35,[.50,.49,.45,1]);
  const corniceY=h-.36;
  if(!factory&&!house){
    box(b.wall,0,corniceY,0,w-setback*2+.55,.40,d-setback*2+.55,trim);
    for(const side of [-1,1]){box(b.wall,0,h,side*(d/2-setback),w-setback*2+.3,.72,.22,wall);box(b.wall,side*(w/2-setback),h,0,.22,.72,d-setback*2,wall);}
    box(b.roof,0,h+.02,0,w-setback*2-.1,.12,d-setback*2-.1,metal);
    box(b.roof,w*.18,h+.15,0,2,1.1,2.5,[.72,.73,.69,1]);
    box(b.roof,-w*.22,h+.15,d*.16,1.5,.7,1.8,metal);
  }else{
    const eave=h,rise=house?2.7:2.1,first=b.roof.positions.length/3;
    b.roof.quad(point(-w/2-.55,eave,-d/2-.55),point(0,eave+rise,-d/2-.55),point(-w/2-.55,eave,d/2+.55),point(0,eave+rise,d/2+.55));
    b.roof.quad(point(0,eave+rise,-d/2-.55),point(w/2+.55,eave,-d/2-.55),point(0,eave+rise,d/2+.55),point(w/2+.55,eave,d/2+.55));
    b.roof.tintSince(first,house?[.82,.49,.35,1]:[.74,.77,.76,1]);
    for(const side of [-1,1]){const begin=b.wall.positions.length/3,pts=[point(-w/2,eave,side*d/2),point(w/2,eave,side*d/2),point(0,eave+rise,side*d/2)];b.wall.polygon(side===-1?pts:pts.reverse());b.wall.tintSince(begin,wall);}
    box(b.wall,-w*.23,h,0,.7,rise+1,.8,[.60,.39,.29,1]);
  }
  // Four distinct elevations share geometry helpers but not a wall of identical black holes.
  for(let floor=0,level=factory?4.4:house?1.2:4.7;level+(house?1.45:office?2.4:1.9)<h-.45;floor++,level+=house?3.0:3.2){
    // Office modules need a readable pier between panes. The old 2.30 m
    // cadence left only 25 cm of wall, which became a subpixel moiré pattern
    // across skyline buildings even though the close geometry was sound.
    const halfW=w/2-(office?setback:0),halfD=d/2-(office?setback:0),spacing=3.1,paneH=house?1.45:office?2.4:1.9;
    for(let face=0;face<4;face++){
      const side=face%2===0?-1:1,front=face<2,span=front?halfW:halfD;
      for(let offset=-span+1.7,index=0;offset<span-1;offset+=spacing,index++){
        const px=front?offset:side*(halfW+.027),pz=front?side*(halfD+.027):offset,paneW=office?2.55:1.6,shade=.7+(Math.abs(index*7+floor*3+s.seed)%9)/30;
        pane(front,side,offset,level,paneW,paneH,side*((front?halfD:halfW)+.065),glass.map((v,c)=>c===3?1:v*shade));
        // Proud frames and sills read as recesses without hollow, expensive wall topology.
        box(b.wall,px,level-.12,pz,front?paneW+.27:.16,.12,front?.16:paneW+.27,trim);
        if(!office)box(b.wall,px,level+paneH,pz,front?paneW+.2:.14,.13,front?.14:paneW+.2,trim);
        if(front&&style==='brick'&&floor%2===0&&index%2===0){box(b.roof,px,level-.22,pz+side*.50,1.95,.12,1.10,metal);box(b.roof,px,level+.28,pz+side*.98,1.9,.48,.045,metal);}
      }
      if(office)box(b.roof,front?0:side*(halfW+.07),level+paneH,front?side*(halfD+.07):0,front?halfW*2+.1:.14,.16,front?.14:halfD*2+.1,metal);
    }
    if(factory)break;
  }
  if(house){box(b.roof,0,2.65,-d/2-.9,w*.60,.18,2.1,[.77,.56,.40,1]);for(const side of [-1,1])box(b.wall,side*w*.27,0,-d/2-1.6,.18,2.65,.18,trim);box(b.glass,0,.35,-d/2-.055,1.15,2.1,.08,glass);}
  else if(factory){
    for(let offset=-w/2+3;offset<w/2-2;offset+=5.5){box(b.roof,offset,.35,-d/2-.06,4.4,3.5,.16,metal);for(let rib=.9;rib<3.7;rib+=.55)box(b.roof,offset,rib,-d/2-.16,4.4,.045,.065,[.38,.43,.43,1]);}
    box(b.roof,0,4.0,-d/2-.65,w+.6,.18,1.4,metal);
  }else{
    for(const side of [-1,1])for(let offset=-w/2+2.2;offset<w/2-1.5;offset+=3.8){
      box(b.glass,offset,.55,side*(d/2+.035),2.8,2.65,.06,glass);
      box(b.wall,offset-1.55,.45,side*(d/2+.10),.23,3.1,.27,trim);
      box(b.roof,offset,3.27,side*(d/2+.60),3.15,.16,1.35,style==='brick'?[.35,.62,.53,1]:metal);
    }
    box(b.wall,0,3.6,0,w+.35,.33,d+.35,trim);
  }
  return {height:h+(house?3.7:factory?3.1:1.25),style};
}

/** Lower-cost modern massing for background offices and authored secondary
 * wings. Continuous bands avoid thousands of tiny distant pane faces while
 * retaining real glazing, mullions, cornices, a canopy and roof machinery. */
export function buildBandArchitecture(b:ArchitectureBuffers,s:BuildingSpec){
  const {x,y,z,width:w,depth:d,height:h,yaw,style,seed}=s,cos=Math.cos(yaw),sin=Math.sin(yaw),point=(px:number,py:number,pz:number):V3=>({x:x+px*cos+pz*sin,y:y+py,z:z-px*sin+pz*cos});
  const box=(g:MeshDataBuilder,px:number,py:number,pz:number,width:number,height:number,depth:number,color:readonly number[])=>{const first=g.positions.length/3,p=point(px,py,pz);g.box(p.x,p.y,p.z,width,height,depth,yaw);g.tintSince(first,color);return first;};
  const wall=style==='brick'?[.58,.29,.19,1]:style==='limestone'?[.86,.82,.69,1]:[.58,.64,.65,1],trim=[.74,.75,.71,1],metal=[.28,.33,.34,1],glass=[.62,.76,.82,1];
  box(b.wall,0,0,0,w,h,d,wall);box(b.wall,0,0,0,w+.45,.55,d+.45,[.43,.43,.40,1]);box(b.wall,0,h-.45,0,w+.55,.42,d+.55,trim);
  box(b.roof,0,h-.02,0,w-.35,.14,d-.35,metal);box(b.roof,-w*.18,h+.11,d*.12,2.6,.85,2.1,[.50,.54,.53,1]);
  const glassBox=(px:number,py:number,pz:number,width:number,height:number,depth:number)=>{const first=box(b.glass,px,py,pz,width,height,depth,glass),occupied=(Math.abs(Math.round(px*13+pz*7+py*5)+seed)%4)<2;for(let i=first*2;i<b.glass.uvs.length;i+=2){b.glass.uvs[i]=occupied?.75:.25;b.glass.uvs[i+1]=.5;}};
  for(let level=4.1;level+1.55<h-.6;level+=3.55){
    // Both faces remain clear of the opaque shell on WebGL2 and WebGPU.
    for(const side of [-1,1]){glassBox(0,level,side*(d/2+.065),w-2,1.55,.06);glassBox(side*(w/2+.065),level,0,.06,1.55,d-2);}
    box(b.wall,0,level-.16,0,w+.12,.12,d+.12,trim);
  }
  for(const side of [-1,1])for(const offset of [-w*.28,0,w*.28])box(b.roof,offset,3.75,side*(d/2+.08),.10,Math.max(2,h-4.2),.12,metal);
  box(b.roof,0,3.22,-d/2-.54,w*.58,.15,1.15,style==='brick'?[.31,.52,.46,1]:metal);
  return {height:h+.96,style};
}
