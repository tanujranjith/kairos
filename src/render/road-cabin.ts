import {Mesh,MeshBuilder,Vector3,VertexData,type PBRMaterial,type Scene} from '@babylonjs/core';
import type {VehicleDefinition} from '../core/types';
import {roadDesign} from './road-design';
import {panelHeight} from './panel-stripe';

type Point=[number,number,number];
type Materials={paint:PBRMaterial;glass:PBRMaterial;dark:PBRMaterial;chrome:PBRMaterial;accent?:PBRMaterial};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;

/** One shared passenger-cell surface drives the glass, pillars, seals and roof.
 * Values are metres in the chassis frame. No physical/camera dimensions change. */
export function cabinSurfaces(d:VehicleDefinition){
  const [rear,back,front,base,ratio]=roadDesign(d).cabin,W=d.width/2;
  const roof=d.height-(.32+d.wheelRadius),belt=d.id==='crest'?.30:.245,bottom=W*(d.id==='crest'?.82:.78),top=W*ratio;
  const screen=(rearward:boolean,u:number,t:number):Point=>{
    const y=rearward?mix(roof-.026,belt,t):mix(belt,roof-.026,t),w=rearward?mix(top,bottom,t):mix(bottom,top,t);
    const z=rearward?mix(back,rear,t):mix(base,front,t);
    return [u*w,y+.034*(1-u*u)+Math.sin(t*Math.PI)*.014,z+(rearward?-1:1)*.055*(1-u*u)*Math.sin(t*Math.PI)];
  };
  const cap=(u:number,t:number):Point=>[u*(top+.018*Math.sin(t*Math.PI)),roof-.026+.034*(1-u*u)+.016*Math.sin(t*Math.PI),mix(back,front,t)];
  const side=(sign:number,u:number,t:number):Point=>{
    const z=mix(mix(rear,base,u),mix(back,front,u),t);
    return [sign*(mix(bottom,top,t)+.021*Math.sin(t*Math.PI)*Math.sin(u*Math.PI)),mix(belt,roof-.026,t)+.016*Math.sin(u*Math.PI)*t,z];
  };
  return {roof,belt,rear,back,front,base,bottom,top,screen,cap,side};
}

/** Sculpted greenhouse and trim-batched interior using existing car materials. */
export function roadCabin(scene:Scene,d:VehicleDefinition,m:Materials,lite:boolean,body:Mesh){
  const parts:Mesh[]=[],c=cabinSurfaces(d),W=d.width/2,gt=d.class==='GT',nu=lite?8:16,nt=lite?4:8;
  const add=(mesh:Mesh,material:PBRMaterial)=>{mesh.material=material;parts.push(mesh);return mesh;};
  const patch=(name:string,sample:(u:number,t:number)=>Point,material:PBRMaterial,normal:Point,stepsU=nu,stepsT=nt,tint?:number)=>{
    const positions:number[]=[],indices:number[]=[],normals:number[]=[],uvs:number[]=[];
    for(let j=0;j<=stepsT;j++)for(let i=0;i<=stepsU;i++){positions.push(...sample(i/stepsU,j/stepsT));uvs.push(i/stepsU,j/stepsT);if(i<stepsU&&j<stepsT){const a=j*(stepsU+1)+i;indices.push(a,a+1,a+stepsU+1,a+1,a+stepsU+2,a+stepsU+1);}}
    VertexData.ComputeNormals(positions,indices,normals);
    const average=normals.reduce((sum,n,i)=>sum+n*normal[i%3],0);
    if(average<0){for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];VertexData.ComputeNormals(positions,indices,normals);}
    const data=new VertexData();data.positions=positions;data.indices=indices;data.normals=normals;data.uvs=uvs;
    if(tint!==undefined)data.colors=Array.from({length:positions.length/3},()=>[tint,tint,tint,1]).flat();
    const mesh=new Mesh(name,scene);data.applyToMesh(mesh);return add(mesh,material);
  };
  const tube=(name:string,path:Point[],radius:number,material=m.dark)=>add(MeshBuilder.CreateTube(name,{path:path.map(p=>Vector3.FromArray(p)),radius,tessellation:lite?4:6},scene),material);
  const box=(name:string,w:number,h:number,l:number,x:number,y:number,z:number,material=m.dark)=>{const mesh=MeshBuilder.CreateBox(name,{width:w,height:h,depth:l},scene);mesh.position.set(x,y,z);return add(mesh,material);};
  const curve=(sample:(t:number)=>Point,count=nt)=>Array.from({length:count+1},(_,i)=>sample(i/count));

  for(const rear of [false,true]){
    const normal:Point=[0,1,rear?-1:1],name=rear?'fastback-backlight':'panoramic-windscreen';
    patch(name,(u,t)=>c.screen(rear,mix(-.952,.952,u),mix(.035,.955,t)),m.glass,normal);
    // A recessed black frit border reads as bonded glazing, not a glass box.
    for(const sign of [-1,1])patch('screen-frit',(u,t)=>c.screen(rear,sign*mix(.952,1,u),t),m.dark,normal,1,nt);
    for(const end of [0,1])patch('screen-frit',(u,t)=>c.screen(rear,u*2-1,end===0?t*.035:.955+t*.045),m.dark,normal,nu,1);
    if(!rear&&!lite)for(const sign of [-1,1])tube('windscreen-wiper',curve(t=>{
      const p=c.screen(false,sign*.42+t*.27,.09+t*.025);return [p[0],p[1]+.006,p[2]+.008];
    },4),.005);
  }
  const roofPanel=patch('crowned-roof',(u,t)=>c.cap(u*2-1,t),m.paint,[0,1,0]);
  patch('interior-headliner',(u,t)=>{const p=c.cap(u*2-1,t);return [p[0],p[1]-.027,p[2]];},m.dark,[0,-1,0]);
  patch('windscreen-cowl',(u,t)=>{const edge=c.screen(false,u*2-1,0),z=c.base+.085;return [edge[0],mix(panelHeight(body,edge[0],z)??c.belt,edge[1],t),mix(z,edge[2],t)];},m.dark,[0,1,1],nu,1);

  for(const sign of [-1,1]){
    const sideNormal:Point=[sign,0,0];
    patch('curved-side-glazing',(u,t)=>c.side(sign,mix(.09,.955,u),mix(.07,.93,t)),m.glass,sideNormal,lite?4:10,lite?3:5);
    // Wider structural A/C pillars are panels of the same shared loft, with
    // shallow returns on the cabin side. They cannot float away from the glass.
    for(const [name,lo,hi]of [['a-pillar',.955,1.018],['c-pillar',-.045,.09]] as const){
      patch(name,(u,t)=>c.side(sign,mix(lo,hi,u),t),m.paint,sideNormal,2,nt);
      patch(name+'-inner',(u,t)=>{const p=c.side(sign,mix(lo,hi,u),t);return [p[0]-sign*.026,p[1]-.010,p[2]];},m.dark,[-sign,0,0],1,nt);
    }
    patch('roof-side-rail',(u,t)=>c.side(sign,u,mix(.93,1.015,t)),m.paint,sideNormal,nt,2);
    patch('window-belt-rail',(u,t)=>c.side(sign,u,t*.07),m.paint,sideNormal,nt,1);
    for(const level of [.07,.93])tube('window-weatherseal',curve(u=>c.side(sign,mix(.09,.955,u),level)),.005);
    for(const u of [.09,.955])tube('window-weatherseal',curve(t=>c.side(sign,u,mix(.07,.93,t))),.005);
    const pillar=d.id==='crest'?.42:.30;
    patch('b-pillar',(u,t)=>c.side(sign,pillar+(u-.5)*(d.id==='crest'?.058:.025),mix(.07,.93,t)),m.dark,sideNormal,1,nt);
    patch('rear-quarter-sail',(u,t)=>{const p=c.side(sign,.09*u,t),z=p[2]-.12*(1-u);const x=p[0]+sign*.07*(1-u);return [x,mix(panelHeight(body,x,z)??c.belt,p[1],t),z];},m.paint,sideNormal,3,nt);

    // A shaped door card, recessed armrest and discrete release/trim highlights.
    patch('molded-door-card',(u,t)=>[sign*(W*.75-.028*Math.sin(t*Math.PI)),mix(-.29,.21,t),mix(c.rear+.03,c.base-.045,u)],m.dark,[-sign,0,0],lite?3:6,4);
    tube('door-armrest',[[sign*W*.73,-.015,-.49],[sign*W*.69,.005,-.18],[sign*W*.70,.035,.20]],.026);
    box('door-release',.012,.019,.083,sign*W*.70,.105,.32,m.chrome);
  }

  box('cockpit-floor',W*1.66,.05,c.base-c.rear+.22,0,-.30,(c.base+c.rear)/2);
  box('footwell-firewall',W*1.66,.52,.065,0,-.075,c.base-.07);
  // Seal the passenger cell from rear wheels, diffuser and the outside ground.
  // The exterior body has outward faces; it is not an interior bulkhead.
  box('rear-cabin-bulkhead',W*1.56,c.belt+.30,.055,0,(c.belt-.30)/2,-.84);
  patch('rear-parcel-shelf',(u,t)=>[(u*2-1)*W*.78,c.belt-.005+.010*Math.sin(t*Math.PI),mix(-.84,c.rear-.035,t)],m.dark,[0,1,0],lite?4:8,3);
  const dashDrop=gt?.06:0;
  patch('molded-dashboard',(u,t)=>{
    const x=(u*2-1)*W*.81,z=mix(.49,c.base-.025,t),hood=Math.exp(-(((x+.34)/.24)**2))*.013;
    return [x,.195-dashDrop+.056*Math.sin(t*Math.PI*.85)+hood+.016*(1-(u*2-1)**2),z];
  },m.dark,[0,1,0],lite?6:12,5);
  patch('dashboard-front',(u,t)=>[(u*2-1)*W*.81,mix(.11,.218,t)-dashDrop,.49],m.dark,[0,0,-1],lite?6:12,1);
  tube('dashboard-trim',[[-W*.77,.209-dashDrop,.488],[-.49,.223-dashDrop,.483],[0,.216-dashDrop,.486],[W*.77,.209-dashDrop,.488]],.003,m.chrome);
  patch('centre-tunnel',(u,t)=>{const angle=(u-.5)*Math.PI;return [Math.sin(angle)*.105,-.17+Math.cos(angle)*.14,mix(-.59,.52,t)];},m.dark,[0,1,0],lite?4:8,4);
  if(!lite){box('gear-selector-base',.085,.025,.13,0,-.007,.17);tube('gear-selector',[[0,.005,.18],[0,.063,.145]],.016,m.chrome);for(const x of [-.039,.039])box('console-switch-bank',.019,.012,.13,x,.001,-.05,m.chrome);}

  // Molded bucket shells: compound curves and bolsters replace four stretched
  // spheres. Full and distant versions share exactly the same support profile.
  for(const sign of gt?[-1]:[-1,1]){
    const cx=sign*.36,top=Math.min(.37,c.roof-.16),back=(u:number,t:number):Point=>{
      const width=.20+.028*Math.sin(t*Math.PI)-.065*Math.pow(t,5),x=(u*2-1)*width;
      return [cx+x,mix(-.19,top,t),-.54-.17*t+.095*Math.pow(Math.abs(u*2-1),3)*Math.sin(Math.PI*(.1+t*.8))];
    };
    patch('bucket-seat-back',back,m.dark,[0,0,1],lite?6:12,lite?5:9);
    patch('bucket-seat-shell',(u,t)=>{const p=back(u,t);return [p[0],p[1],p[2]-.038];},m.dark,[0,0,-1],lite?6:12,lite?5:9,.65);
    for(const edge of [0,1])patch('seat-shell-return',(u,t)=>{const p=back(edge,t);return [p[0],p[1],p[2]-.038*u];},m.dark,[edge===0?-1:1,0,0],1,lite?5:9);
    patch('seat-cushion',(u,t)=>[cx+(u*2-1)*(.19+.018*Math.sin(t*Math.PI)),-.18+.035*Math.sin(t*Math.PI)+.055*Math.pow(Math.abs(u*2-1),4),mix(-.56,-.10,t)],m.dark,[0,1,0],lite?6:12,lite?4:7);
    if(!lite){
      for(const edge of [-1,1])tube('seat-stitched-edge',curve(t=>back(edge===-1?.16:.84,mix(.08,.88,t)),10),.0022,m.accent??m.chrome);
      for(const y of [.10,.23])tube('seat-panel-seam',curve(u=>{const p=back(mix(.18,.82,u),y/top);return [p[0],p[1],p[2]+.001];},6),.002);
      for(const rail of [-1,1])box('seat-runner',.035,.028,.46,cx+rail*.14,-.263,-.40,m.chrome);
    }
    const headY=Math.min(.45,c.roof-.095),head=(u:number,t:number):Point=>{
      const a=u*2-1,b=t*2-1;return [cx+a*.103*(1-.15*b*b),headY+b*.051,-.714+.031*Math.sqrt(Math.max(0,1-a*a))];
    };
    patch('seat-headrest',head,m.dark,[0,0,1],lite?4:8,4);
    patch('headrest-back',(u,t)=>{const p=head(u,t);return [p[0],p[1],-.748];},m.dark,[0,0,-1],lite?4:8,4);
    for(const edge of [0,1]){
      patch('headrest-side',(u,t)=>{const p=head(edge,t);return [p[0],p[1],mix(p[2],-.748,u)];},m.dark,[edge===0?-1:1,0,0],1,4);
      patch('headrest-cap',(u,t)=>{const p=head(u,edge);return [p[0],p[1],mix(p[2],-.748,t)];},m.dark,[0,edge===0?-1:1,0],lite?4:8,1);
      if(!lite)box('headrest-support',.010,.085,.010,cx+(edge===0?-1:1)*.052,headY-.073,-.719,m.chrome);
    }
  }
  if(gt){
    const cageY=c.roof-.15;
    tube('roll-cage-main',[[-W*.68,-.24,-.73],[-W*.57,cageY-.04,-.73],[-W*.43,cageY,-.73],[W*.43,cageY,-.73],[W*.57,cageY-.04,-.73],[W*.68,-.24,-.73]],.018,m.chrome);
    tube('roll-cage-diagonal',[[-W*.60,-.19,-.76],[W*.53,cageY-.025,-.76]],.015,m.chrome);
    for(const edge of [-1,1])patch('seat-harness',(u,t)=>[-.36+edge*mix(.065,.071,t)+(u-.5)*.034,mix(-.09,topSeat(c.roof),t),mix(-.47,-.685,t)],m.accent??m.chrome,[0,0,1],1,lite?3:6);
  }
  return {parts,roofPanel,roofHeight:c.roof};
}
const topSeat=(roof:number)=>Math.min(.36,roof-.20);
