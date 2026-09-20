import {Mesh,MeshBuilder,Vector3,VertexData,type Scene,type PBRMaterial} from '@babylonjs/core';
import type {VehicleDefinition} from '../core/types';

export const wheelStyle=(id:string)=>({aeris:{spokes:5,split:false,sweep:.05},velara:{spokes:5,split:true,sweep:.09},crest:{spokes:6,split:false,sweep:0},nova:{spokes:10,split:false,sweep:.22},gtx:{spokes:6,split:true,sweep:0},apex:{spokes:8,split:false,sweep:.025}}[id]??{spokes:5,split:false,sweep:0});
export const tireWidth=(d:VehicleDefinition,i:number)=>d.class==='FORMULA'?(i<2?.30:.39):d.class==='GT'?.30:d.id==='aeris'?.205:d.id==='nova'?.265:.245;

/** Original concave forged wheels. Wheel axis X; only the separately returned
 * caliper is stationary relative to steering/suspension, not to wheel rotation. */
export function wheelModel(scene:Scene,d:VehicleDefinition,i:number,m:{rubber:PBRMaterial;alloy:PBRMaterial;brake:PBRMaterial;accent:PBRMaterial},lite=false){
  const parts:Mesh[]=[],r=d.wheelRadius,width=tireWidth(d,i),side=i%2===0?-1:1,style=wheelStyle(d.id),steps=lite?20:32;
  const add=(p:Mesh,material:PBRMaterial)=>{p.material=material;parts.push(p);return p;};
  const lathe=(name:string,profile:number[][],material:PBRMaterial)=>{
    const p=MeshBuilder.CreateLathe(name,{shape:profile.map(([x,y])=>new Vector3(x,y,0)),tessellation:steps,sideOrientation:name==='rim-barrel'?Mesh.DOUBLESIDE:Mesh.FRONTSIDE},scene);p.rotation.z=-Math.PI/2;return add(p,material);
  };
  const tireProfile=[[r*.70,-width*.5],[r*.87,-width*.5],[r*.97,-width*.46],[r,-width*.36]];
  if(d.class==='ROAD'&&!lite)for(const u of [-.23,0,.23])tireProfile.push([r,width*(u-.017)],[r*.984,width*(u-.010)],[r*.984,width*(u+.010)],[r,width*(u+.017)]);
  tireProfile.push([r,width*.36],[r*.97,width*.46],[r*.87,width*.5],[r*.70,width*.5]);lathe('profiled-tire',tireProfile,m.rubber);
  lathe('rim-barrel',[[r*.695,-width*.48],[r*.674,-width*.42],[r*.668,width*.39],[r*.695,width*.48]],m.alloy);
  const face=side*(width*.5+.005),discX=side*(width*.5-.048);
  const ring=(name:string,radius:number,thickness:number,x:number,material:PBRMaterial,micro=false)=>{
    const segments=micro?10:steps,path=Array.from({length:segments+1},(_,n)=>new Vector3(x,Math.cos(n/segments*Math.PI*2)*radius,Math.sin(n/segments*Math.PI*2)*radius));
    return add(MeshBuilder.CreateTube(name,{path,radius:thickness,tessellation:lite||micro?4:6},scene),material);
  };
  ring('machined-rim-lip',r*.706,lite?.012:.009,face,m.alloy);
  if(!lite){
    ring('sidewall-bead',r*.79,.0025,side*width*.501,m.rubber);ring('inner-rim-lip',r*.695,.009,-face,m.alloy);
    // Raised sidewall mould lines and a real valve stem give the wheel scale
    // without changing its rolling radius or physical contact patch.
    ring('sidewall-mould-line',r*.885,.0017,side*width*.503,m.rubber,true);
    if(d.class==='FORMULA')ring('slick-centre-seam',r*.999,.0018,0,m.rubber,true);
    const valve=MeshBuilder.CreateCylinder('wheel-valve-stem',{height:.030,diameter:.010,tessellation:8},scene);
    valve.rotation.z=Math.PI/2;valve.position.set(face+side*.010,Math.cos(.72)*r*.61,Math.sin(.72)*r*.61);add(valve,m.rubber);
    const cap=MeshBuilder.CreateCylinder('wheel-valve-cap',{height:.009,diameter:.013,tessellation:8},scene);
    cap.rotation.z=Math.PI/2;cap.position.set(face+side*.028,Math.cos(.72)*r*.61,Math.sin(.72)*r*.61);add(cap,m.brake);
    if(d.class!=='FORMULA'){
      // Three staggered herringbone lanes float only 1.2 mm above the visual
      // carcass. They are display relief, not collision or tire-force geometry.
      const tp:number[]=[],ti:number[]=[],tn:number[]=[],tu:number[]=[];
      for(let segment=0;segment<18;segment++)for(let lane=-1;lane<=1;lane++){
        const a=segment/18*Math.PI*2+(lane===0?.025:lane*.045),span=.076,laneX=lane*width*.205,half=width*.105;
        const corners=[[-half,-span],[half,-span*.42],[half,span],[-half,span*.42]];
        const base=tp.length/3;
        for(const [dx,da]of corners){const angle=a+da,rad=r+.0012;tp.push(laneX+dx,Math.cos(angle)*rad,Math.sin(angle)*rad);tn.push(0,Math.cos(angle),Math.sin(angle));tu.push(lane/3+.5,segment/18);}
        ti.push(base,base+1,base+2,base,base+2,base+3);
      }
      const tread=new Mesh('herringbone-tread-relief',scene),td=new VertexData();td.positions=tp;td.indices=ti;td.normals=tn;td.uvs=tu;td.applyToMesh(tread);add(tread,m.rubber);
    }
  }
  lathe('ventilated-brake-rotor',[[r*.20,discX-.006],[r*.58,discX-.006],[r*.58,discX+.006],[r*.20,discX+.006],[r*.20,discX-.006]],m.brake);
  if(!lite)ring('brake-rotor-hat',r*.255,.010,discX+side*.009,m.alloy,true);
  const positions:number[]=[],indices:number[]=[];
  const polygon=(corners:Vector3[])=>{const base=positions.length/3;corners.forEach(p=>positions.push(p.x,p.y,p.z));for(let k=1;k<corners.length-1;k++)indices.push(base,base+k,base+k+1);};
  const point=(x:number,rad:number,a:number)=>new Vector3(x,Math.cos(a)*rad,Math.sin(a)*rad);
  for(let spoke=0;spoke<style.spokes;spoke++)for(const split of style.split?[-1,1]:[0]){
    const a=spoke/style.spokes*Math.PI*2,sections=lite?2:4;
    for(let k=0;k<sections;k++){
      const edge=(t:number,sign:number)=>{
        const rad=r*(.17+t*.51),angle=a+style.sweep*t+split*.092*t+sign*(style.split?.038:d.id==='crest'?.095:.062);
        return point(face-side*(.044*(1-t)*(1-t)),rad,angle);
      };
      const a0=edge(k/sections,-1),b0=edge(k/sections,1),a1=edge((k+1)/sections,-1),b1=edge((k+1)/sections,1);
      const back=(p:Vector3)=>p.add(new Vector3(-side*.017,0,0));
      const faces=[[a0,b0,b1,a1],[back(b0),back(a0),back(a1),back(b1)],[a0,a1,back(a1),back(a0)],[b1,b0,back(b0),back(b1)]];
      for(const f of faces)polygon(side<0?f.reverse():f);
    }
  }
  const normals:number[]=[],spokes=new Mesh('sculpted-forged-spokes',scene),data=new VertexData();VertexData.ComputeNormals(positions,indices,normals);data.positions=positions;data.indices=indices;data.normals=normals;data.uvs=positions.flatMap((_,i)=>i%3===0?[positions[i+1],positions[i+2]]:[]);data.applyToMesh(spokes);add(spokes,m.alloy);
  const hub=MeshBuilder.CreateCylinder('centre-hub',{height:.028,diameter:r*.32,tessellation:lite?10:20},scene);hub.rotation.z=Math.PI/2;hub.position.x=face-side*.032;add(hub,m.alloy);
  if(!lite){
    for(let n=0;n<(d.class==='ROAD'?5:1);n++){const a=n/5*Math.PI*2,bolt=MeshBuilder.CreateCylinder('wheel-fastener',{height:.011,diameter:d.class==='ROAD'?.018:.046,tessellation:6},scene);bolt.rotation.z=Math.PI/2;bolt.position.set(face-side*.015,Math.cos(a)*(d.class==='ROAD'?r*.095:0),Math.sin(a)*(d.class==='ROAD'?r*.095:0));add(bolt,m.brake);}
    // Slots are shallow dark faces, batched with the tyre rather than another material.
    for(let n=0;n<12;n++){const a=n/12*Math.PI*2,slot=MeshBuilder.CreateBox('rotor-slot',{width:.0015,height:r*.13,depth:.006},scene);slot.rotation.x=a+.25;slot.position.set(discX+side*.007,Math.cos(a)*r*.47,Math.sin(a)*r*.47);add(slot,m.rubber);}
  }
  let caliper:Mesh|undefined;
  if(!lite){
    caliper=MeshBuilder.CreateCapsule('fixed-brake-caliper',{height:r*.62,radius:r*.12,tessellation:8,subdivisions:1,capSubdivisions:2},scene);
    caliper.position.set(discX,0,-r*.48);caliper.scaling.x=.70;caliper.material=m.accent;
  }
  return {parts,caliper};
}
