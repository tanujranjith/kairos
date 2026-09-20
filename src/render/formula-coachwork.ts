import { Mesh,MeshBuilder,Vector3,VertexData,Curve3,type Scene,type PBRMaterial,type Material } from '@babylonjs/core';
import type {VehicleDefinition} from '../core/types';

type Point=[number,number,number];
type Station=[number,number,number,number]; // z, half width, lower/upper body surface
type Materials=Record<'paint'|'dark'|'chrome'|'light'|'tail'|'accent'|'instruments',PBRMaterial>;
const cubic=(a:number,b:number,c:number,d:number,t:number)=>.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;

/** Original single-seater: actual open cockpit, undercut pods and multi-element aero.
 * Coordinates share the physical wheel centres: axle X, nose +Z, tyre centre Y=-.32.
 * No forces/collision dimensions are authored here. Both GLB levels use this source. */
export function formulaCoachwork(scene:Scene,d:VehicleDefinition,m:Materials,lite=false,livery=0){
  const parts:Mesh[]=[],L=d.length/2;
  const add=(mesh:Mesh,material:Material)=>{mesh.material=material;parts.push(mesh);return mesh;};
  const mesh=(name:string,positions:number[],indices:number[],material:Material)=>{
    const normals:number[]=[],data=new VertexData();VertexData.ComputeNormals(positions,indices,normals);data.positions=positions;data.indices=indices;data.normals=normals;
    data.uvs=positions.flatMap((_,i)=>i%3===0?[positions[i],positions[i+2]]:[]);const result=new Mesh(name,scene);data.applyToMesh(result);return add(result,material);
  };
  const sheet=(name:string,rows:Point[][],material:Material,reverse=false)=>{
    const width=rows[0].length,indices:number[]=[];
    for(let j=0;j<rows.length-1;j++)for(let i=0;i<width-1;i++){const a=j*width+i;indices.push(a,a+1,a+width,a+1,a+width+1,a+width);}
    if(reverse)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
    return mesh(name,rows.flat(2),indices,material);
  };
  const tube=(name:string,path:Point[],radius:number,material:Material)=>{
    const points=path.map(p=>Vector3.FromArray(p)),smooth=path.length>2&&path.length<12?Curve3.CreateCatmullRomSpline(points,lite?3:6).getPoints():points;
    return add(MeshBuilder.CreateTube(name,{path:smooth,radius,tessellation:lite?4:6,cap:Mesh.CAP_ALL},scene),material);
  };
  const box=(name:string,w:number,h:number,depth:number,x:number,y:number,z:number,material:Material)=>{
    const part=MeshBuilder.CreateBox(name,{width:w,height:h,depth},scene);part.position.set(x,y,z);return add(part,material);
  };
  const loft=(name:string,stations:Station[],material:Material,x=0)=>{
    const positions:number[]=[],indices:number[]=[],rings:Station[]=[],steps=lite?3:5,segments=lite?12:20;
    for(let k=0;k<stations.length-1;k++)for(let j=0;j<steps;j++){
      const t=j/steps,a=stations[Math.max(0,k-1)],b=stations[k],c=stations[k+1],e=stations[Math.min(stations.length-1,k+2)];
      rings.push([lerp(b[0],c[0],t),...([1,2,3].map(n=>cubic(a[n],b[n],c[n],e[n],t)))] as Station);
    }rings.push(stations.at(-1)!);
    for(const [z,w,b,t]of rings)for(let i=0;i<segments;i++){
      const angle=i/segments*Math.PI*2,co=Math.cos(angle),si=Math.sin(angle);
      positions.push(x-Math.sign(co)*Math.pow(Math.abs(co),.70)*w,lerp(b,t,(1+Math.sign(si)*Math.pow(Math.abs(si),.80))*.5),z);
    }
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){const a=j*segments+i,b=j*segments+(i+1)%segments;indices.push(a,b,a+segments,b,b+segments,a+segments);}
    for(let i=1;i<segments-1;i++){indices.push(0,i+1,i);const end=(rings.length-1)*segments;indices.push(end,end+i,end+i+1);}
    return mesh(name,positions,indices,material);
  };
  const foil=(name:string,span:number,chord:number,y:number,z:number,camber:number,material:Material,sweep=0)=>{
    const positions:number[]=[],indices:number[]=[],sections=lite?8:14,around=lite?12:20;
    for(let k=0;k<=sections;k++){
      const x=(k/sections*2-1)*span/2,a=Math.abs(x)/(span/2),c=chord*(1-.14*a*a);
      for(let i=0;i<around;i++){
        const phase=i/around*Math.PI*2,u=(1-Math.cos(phase))*.5;
        const thickness=5*.11*c*(.2969*Math.sqrt(u)-.126*u-.3516*u*u+.2843*u*u*u-.1036*u*u*u*u);
        positions.push(x,y+camber*4*u*(1-u)+Math.sign(Math.sin(phase))*thickness+.026*a*a,z+(u-.5)*c+sweep*a*a);
      }
    }
    for(let k=0;k<sections;k++)for(let i=0;i<around;i++){const a=k*around+i,b=k*around+(i+1)%around;indices.push(a,a+around,b,b,a+around,b+around);}
    for(let i=1;i<around-1;i++){indices.push(0,i,i+1);const end=sections*around;indices.push(end,end+i+1,end+i);}
    return mesh(name,positions,indices,material);
  };

  // Structural hull sits below the cockpit opening, never over the driver's face.
  loft('formula-keel',[[-2.25,.10,-.50,-.34],[-1.35,.29,-.51,-.30],[-.35,.33,-.51,-.34],[.48,.28,-.43,.05],[1.15,.19,-.35,.015],[L-.12,.075,-.28,-.14]],m.paint);
  const nose=loft('tapered-nose',[[.42,.27,-.22,.055],[.95,.23,-.20,.025],[1.6,.14,-.25,-.03],[L-.27,.10,-.29,-.105],[L-.09,.065,-.27,-.16]],m.paint);
  const sidepods:Mesh[]=[];
  loft('contoured-floor',[[-2.36,.54,-.54,-.48],[-1.15,.76,-.54,-.50],[.5,.82,-.53,-.49],[.94,.52,-.50,-.47]],m.dark);
  for(const side of [-1,1]){
    const sidepod=loft('undercut-sidepod',[[-1.88,.10,-.40,-.16],[-1.31,.20,-.40,-.015],[-.66,.29,-.28,.10],[.15,.31,-.24,.125],[.49,.23,-.17,.065]],m.paint,side*.53);sidepod.metadata={formulaPanel:'sidepod'};
    sidepods.push(sidepod);
    loft('cockpit-shoulder',[[-.91,.045,-.21,.10],[-.52,.068,-.15,.11],[.07,.065,-.14,.07],[.46,.043,-.16,.04]],m.paint,side*.30);
    // A recessed intake and rolled lip make each pod read as hollow, not a solid box.
    const intake=loft('pod-intake-recess',[[.47,.195,-.13,.045],[.505,.184,-.118,.038]],m.dark,side*.53);intake.rotation.y=side*.08;
    tube('pod-intake-lip',[[side*.35,.058,.49],[side*.53,.072,.50],[side*.71,.033,.475]],.016,m.paint);
    tube('floor-edge',[[side*.53,-.474,-2.2],[side*.77,-.493,-.9],[side*.84,-.48,.4],[side*.58,-.45,.92]],.012,m.dark);
    for(let axle=0;axle<2;axle++){
      const z=(axle===0?1:-1)*d.wheelbase/2,hub=side*d.track/2;
      for(const h of [-.34,-.17])for(const dz of [-.27,.30])tube('carbon-wishbone',[[side*.23,h+.04,z+dz],[hub,h,z]],.014,m.dark);
      tube('pushrod',[[side*.30,.005,z-.1],[hub*.96,-.35,z+.035]],.012,m.chrome);
      tube('steering-link',[[side*.27,-.24,z+.13],[hub,-.26,z+.065]],.010,m.dark);
    }
    loft('front-sculpted-endplate',[[L-.58,.011,-.39,-.20],[L-.30,.013,-.40,-.16],[L-.05,.01,-.36,-.245]],m.paint,side*.97);
    loft('rear-sculpted-endplate',[[-L+.03,.011,-.22,.265],[-L+.27,.014,-.18,.27],[-L+.52,.009,-.11,.20]],m.paint,side*.81);
    tube('rear-wing-stay',[[side*.22,-.30,-2.0],[side*.23,.02,-2.27],[side*.24,.175,-2.36]],.023,m.dark);
    tube('mirror-stalk',[[side*.30,.065,.36],[side*.53,.16,.38]],.011,m.dark);
    const mirror=MeshBuilder.CreateSphere('formula-mirror',{diameter:1,segments:lite?6:12},scene);mirror.scaling.set(.15,.055,.10);mirror.position.set(side*.56,.16,.39);add(mirror,m.paint);
    box('formula-mirror-lens',.115,.035,.008,side*.56,.165,.336,m.chrome);
    if(!lite)for(let slot=0;slot<5;slot++)tube('cooling-louvre',[[side*.49,.076,-.42-slot*.10],[side*.72,.025,-.46-slot*.10]],.008,m.dark);
  }
  foil('front-mainplane',1.97,.37,-.32,L-.28,.018,m.dark,-.04);
  foil('front-flap',1.72,.24,-.24,L-.44,.026,m.paint,.07);
  foil('front-upper-flap',1.42,.15,-.185,L-.50,.020,m.dark,.10);
  foil('rear-mainplane',1.64,.38,.16,-L+.30,.025,m.dark);
  foil('rear-adjustable-flap',1.59,.20,.225,-L+.16,.019,m.paint);
  foil('rear-beam-wing',1.10,.18,-.31,-L+.35,.014,m.dark);
  for(const x of [-.55,-.28,0,.28,.55])sheet('diffuser-strake',[[[x,-.535,-2.23],[x,-.42,-2.31]],[[x,-.532,-1.68],[x,-.48,-1.70]]],m.dark);
  loft('engine-cover',[[-2.17,.06,-.24,-.12],[-1.5,.17,-.18,.02],[-.96,.205,-.10,.205],[-.76,.14,-.025,.28]],m.paint);
  loft('airbox',[[-1.01,.095,.15,.295],[-.74,.082,.16,.29]],m.dark);
  tube('roll-hoop',[[-.14,.06,-.78],[-.115,.25,-.80],[0,.31,-.80],[.115,.25,-.80],[.14,.06,-.78]],.020,m.dark);
  // Elliptic cockpit rim surrounds a genuinely recessed dark bathtub and seat.
  const rim:Point[]=[];for(let i=0;i<=32;i++){const a=i/32*Math.PI*2;rim.push([Math.cos(a)*.285,.083+Math.sin(a)*.018,-.26+Math.sin(a)*.55]);}
  tube('cockpit-rim',rim,.024,m.dark);
  loft('cockpit-bathtub',[[-.81,.20,-.30,-.22],[-.5,.25,-.34,-.24],[.14,.20,-.32,-.20],[.30,.12,-.27,-.20]],m.dark);
  const seat=box('reclined-seat',.35,.055,.62,0,-.20,-.37,m.dark);seat.rotation.x=-.12;
  const seatBack=box('seat-back',.34,.30,.065,0,-.06,-.71,m.dark);seatBack.rotation.x=-.28;
  for(const side of [-1,1])tube('harness',[[side*.085,.059,-.70],[side*.09,-.10,-.61],[side*.11,-.163,-.32]],.017,m.accent);
  tube('halo',[[ -.27,.085,-.72],[-.30,.205,-.34],[-.23,.245,.20],[0,.265,.39],[.23,.245,.20],[.30,.205,-.34],[.27,.085,-.72]],.025,m.dark);
  tube('halo-front-support',[[0,.025,.46],[0,.245,.40]],.018,m.dark);
  tube('steering-column',[[0,-.20,.43],[0,-.015,.23]],.018,m.dark);
  tube('formula-steering-yoke',[[-.13,.025,.23],[-.17,-.035,.22],[-.12,-.085,.21],[.12,-.085,.21],[.17,-.035,.22],[.13,.025,.23]],.022,m.dark);
  box('steering-centre',.17,.065,.04,0,-.025,.225,m.dark);box('steering-screen',.085,.043,.009,0,-.004,.199,m.instruments);
  for(const side of [-1,1])box('steering-button',.016,.016,.008,side*.12,-.017,.188,m.accent);
  box('rain-light',.095,.075,.028,0,-.28,-L+.16,m.tail);
  tube('exhaust-outlet',[[0,-.12,-2.13],[0,-.13,-2.37]],.033,m.chrome);
  box('exhaust-bore',.049,.049,.01,0,-.13,-2.409,m.dark);
  if(livery>0){
    // Clip the actual panel triangles: every decal is flush at either LOD, even
    // across curved longitudinal stations. No raised tubes or floating flat strips.
    const stripe=(name:string,panel:Mesh,x:number,width:number,z0:number,z1:number)=>{
      const p=panel.getVerticesData('position')!,n=panel.getVerticesData('normal')!,faces=panel.getIndices()!,positions:number[]=[],indices:number[]=[];
      for(let f=0;f<faces.length;f+=3){
        const ids=[faces[f],faces[f+1],faces[f+2]];
        if(ids.reduce((sum,i)=>sum+n[i*3+1],0)<1)continue;
        let poly=ids.map(i=>[p[i*3],p[i*3+1],p[i*3+2]] as Point);
        for(const [axis,bound,sign]of [[0,x-width/2,1],[0,x+width/2,-1],[2,z0,1],[2,z1,-1]]){
          const clipped:Point[]=[];
          for(let i=0;i<poly.length;i++){
            const a=poly[i],b=poly[(i+1)%poly.length],insideA=(a[axis]-bound)*sign>=0,insideB=(b[axis]-bound)*sign>=0;
            if(insideA)clipped.push(a);
            if(insideA!==insideB){const t=(bound-a[axis])/(b[axis]-a[axis]);clipped.push(a.map((v,k)=>lerp(v,b[k],t)) as Point);}
          }poly=clipped;
        }
        const start=positions.length/3;
        for(const [px,py,pz]of poly)positions.push(px,py+.0015,pz);
        for(let i=1;i<poly.length-1;i++)indices.push(start,start+i,start+i+1);
      }
      mesh(name,positions,indices,m.accent);
    };
    for(const x of livery===1?[-.057,.057]:[0])stripe('formula-nose-livery',nose,x,livery===1?.034:.13,.47,L-.095);
    sidepods.forEach((pod,i)=>stripe('formula-pod-livery',pod,(i===0?-1:1)*.53,livery===1?.024:.06,-1.32,.44));
  }
  return {parts};
}
