import { BackgroundMaterial, Color3, CubeTexture, DynamicTexture, Mesh, MeshBuilder, MirrorTexture, PBRMaterial, Plane, StandardMaterial, Texture, TransformNode, Vector3, type Scene } from '@babylonjs/core';
import { Geometry } from './geometry';
import { surfaceTexture, surfaceTextures } from './surface-textures';
import { rng } from '../core/math';

/** Original gallery architecture, locally bundled CC0 HDR, and an asset-failure fallback. */
export function createShowroom(scene:Scene){
  const root=new TransformNode('showroom',scene);root.position.y=-1000;
  const material=(name:string,color:string,metallic:number,roughness:number)=>{const m=new PBRMaterial(name,scene);m.albedoColor=Color3.FromHexString(color).toLinearSpace();m.metallic=metallic;m.roughness=roughness;return m;};
  const floorMat=material('showroom-stone','#707579',.22,.30),stone=surfaceTextures(scene,'stone',10);floorMat.albedoTexture=stone.albedo;floorMat.bumpTexture=stone.normal;floorMat.bumpTexture.level=.025;
  const metal=material('showroom-metal','#292c2d',.72,.31),wall=material('gallery-concrete','#c7bbab',0,.86),wood=material('gallery-oak','#503b2c',0,.68);
  const concrete=surfaceTextures(scene,'concrete',.45);wall.albedoTexture=concrete.albedo;wall.bumpTexture=concrete.normal;wall.bumpTexture.level=.09;
  const warm=new StandardMaterial('gallery-warm-light',scene);warm.emissiveColor=new Color3(1,.73,.42);warm.disableLighting=true;
  const softbox=new StandardMaterial('gallery-softbox',scene);softbox.emissiveColor=new Color3(1,.94,.82).scale(2);softbox.disableLighting=true;
  const panel=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,mat:PBRMaterial|StandardMaterial)=>{const mesh=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);mesh.position.set(x,y,z);mesh.material=mat;mesh.parent=root;mesh.receiveShadows=true;return mesh;};
  const floor=MeshBuilder.CreateGround('showroom-floor',{width:60,height:44},scene);floor.position.set(0,.09,4);floor.material=floorMat;floor.parent=root;floor.receiveShadows=true;
  const stage=MeshBuilder.CreateCylinder('turntable',{height:.035,diameter:7.6,tessellation:80},scene);stage.position.y=.0875;stage.material=floorMat;stage.parent=root;stage.receiveShadows=true;
  const ring=MeshBuilder.CreateTorus('turntable-light',{diameter:7.6,thickness:.018,tessellation:96},scene);ring.position.y=.11;ring.material=warm;ring.parent=root;
  panel('gallery-ceiling',50,.35,31,0,8.1,4,wood);
  for(const x of [-19,19])panel('gallery-side-wall',.5,8,31,x,4,4,wall);
  for(const x of [-16,-8,8,16]){panel('architectural-pier',.55,8,.70,x,4,-10,metal);panel('pier-uplight',.5,.04,.15,x,.17,-9.6,warm);}
  panel('gallery-window-header',38,.50,.8,0,7.85,-10,wood);
  panel('gallery-window-sill',38,.10,.7,0,.1,-10,metal);
  for(let x=-18;x<=18;x+=3)panel('window-mullion',.045,7.8,.08,x,4,-10,metal);
  // The window openings deliberately stay clear: the landscape, not black glass, is the backdrop.
  for(const x of [-12,-4,4,12]){const light=panel('ceiling-softbox',.65,.05,13,x,7.88,0,softbox);light.metadata={floorReflection:true};}
  const joints=new Geometry();for(let x=-24;x<=24;x+=3)joints.box(x,.092,3,.006,.001,36);for(let z=-12;z<=21;z+=3)joints.box(0,.092,z,48,.001,.006);const seam=joints.mesh('floor-joints',scene,metal)!;seam.parent=root;
  for(const x of [-6,6]){const plinth=MeshBuilder.CreateCylinder('secondary-plinth',{diameter:5.5,height:.025,tessellation:48},scene);plinth.position.set(x,.091,-5);plinth.material=floorMat;plinth.parent=root;plinth.receiveShadows=true;}
  // A small sign on a side wall keeps the car and vista as the visual focal points.
  const signTexture=new DynamicTexture('showroom-wordmark',{width:1024,height:256},scene,true);signTexture.drawText('K A I R O S',null,151,'300 94px sans-serif','#ddd8ce','#35322e',true);
  const signMat=new StandardMaterial('showroom-wordmark-material',scene);signMat.diffuseTexture=signTexture;signMat.emissiveColor.set(.15,.14,.12);
  panel('gallery-brand-pier',3.4,7.9,.4,-13,4,-9.8,wall);const sign=MeshBuilder.CreatePlane('showroom-wordmark',{width:2.8,height:.70,sideOrientation:Mesh.DOUBLESIDE},scene);sign.position.set(-13,4.3,-9.55);sign.material=signMat;sign.parent=root;
  const fallback=new TransformNode('gallery-vista-fallback',scene);fallback.parent=root;
  const skyTex=new DynamicTexture('gallery-sunset-sky',{width:1024,height:512},scene,false),ctx=skyTex.getContext() as CanvasRenderingContext2D,gradient=ctx.createLinearGradient(0,0,0,512);
  gradient.addColorStop(0,'#718aa9');gradient.addColorStop(.35,'#c6a7a6');gradient.addColorStop(.65,'#f1c99c');gradient.addColorStop(1,'#eee0c3');ctx.fillStyle=gradient;ctx.fillRect(0,0,1024,512);
  const random=rng(312);for(let i=0;i<100;i++){const x=random()*1024,y=40+random()*200,w=22+random()*130;ctx.fillStyle=`rgba(123,112,127,${.015+random()*.035})`;ctx.beginPath();ctx.ellipse(x,y,w,3+random()*9,-.05,0,Math.PI*2);ctx.fill();}skyTex.update();skyTex.wrapU=skyTex.wrapV=Texture.CLAMP_ADDRESSMODE;
  const skyMat=new StandardMaterial('gallery-sky-material',scene);skyMat.disableLighting=true;skyMat.emissiveTexture=skyTex;skyMat.emissiveColor=Color3.White();skyMat.backFaceCulling=false;
  const sky=MeshBuilder.CreatePlane('gallery-sunset',{width:900,height:240,sideOrientation:Mesh.DOUBLESIDE},scene);sky.position.set(0,55,-290);sky.material=skyMat;sky.parent=fallback;sky.applyFog=false;
  const sunMat=new StandardMaterial('gallery-sun-material',scene);sunMat.disableLighting=true;sunMat.emissiveColor=new Color3(1,.91,.67).scale(1.8);
  const sun=MeshBuilder.CreateDisc('gallery-sunset-disc',{radius:5.2,tessellation:48,sideOrientation:Mesh.DOUBLESIDE},scene);sun.position.set(125,19,-210);sun.material=sunMat;sun.parent=fallback;sun.applyFog=false;
  for(let layer=0;layer<4;layer++){
    const g=new Geometry(),depth=-240+layer*37,base=-6-layer*1.2,c=Color3.FromHexString(['#a39aab','#818899','#637987','#476570'][layer]);
    const ridge=(x:number)=>2+Math.abs(Math.sin(x*.018+layer*2.3))*8+Math.abs(Math.sin(x*.042+layer))*5+Math.sin(x*.19+layer)*.8+Math.sin(x*.41)*.4;
    for(let x=-350;x<350;x+=3){const tint=.94+.06*Math.sin(x*.041);g.quad({x,y:base,z:depth},{x:x+3,y:base,z:depth},{x,y:ridge(x),z:depth},{x:x+3,y:ridge(x+3),z:depth},[c.r*tint,c.g*tint,c.b*tint,1]);}
    const mat=new StandardMaterial('gallery-ridge-'+layer,scene);mat.disableLighting=true;mat.emissiveColor=Color3.White();mat.backFaceCulling=false;const mesh=g.mesh('gallery-distant-ridge-'+layer,scene,mat)!;mesh.parent=fallback;mesh.applyFog=false;
  }
  const terrace=material('gallery-terrace','#707364',0,.98);panel('gallery-terrace',90,.4,18,0,-.16,-20,terrace);
  const water=material('gallery-lake','#738986',.35,.22),waves=surfaceTexture(scene,'water','normal',6);water.bumpTexture=waves;water.bumpTexture.level=.08;const lake=MeshBuilder.CreateGround('gallery-lake',{width:650,height:220},scene);lake.position.set(0,-.42,-138);lake.material=water;lake.parent=fallback;
  const environment=CubeTexture.CreateFromPrefilteredData('/environment/fish-eagle-hill.env',scene);environment.name='CC0 Fish Eagle Hill / Greg Zaal';environment.rotationY=3;
  const photoMaterial=new BackgroundMaterial('gallery-hdr-background',scene);photoMaterial.reflectionBlur=0;photoMaterial.backFaceCulling=false;photoMaterial.useRGBColor=false;photoMaterial.primaryColor=new Color3(.85,.85,.85);
  const panorama=MeshBuilder.CreateBox('gallery-photographic-vista',{size:1200,sideOrientation:Mesh.BACKSIDE},scene);panorama.parent=root;panorama.material=photoMaterial;panorama.applyFog=false;panorama.isPickable=false;panorama.isVisible=false;panorama.metadata={environmentBackground:true};
  const showPhoto=()=>{const skyMap=environment.clone();skyMap.name='gallery-skybox-map';skyMap.coordinatesMode=Texture.SKYBOX_MODE;photoMaterial.reflectionTexture=skyMap;panorama.isVisible=true;fallback.setEnabled(false);};if(environment.isReady())showPhoto();else environment.onLoadObservable.addOnce(showPhoto);
  // Broad-leaf plants: tapered stems and shaped leaf blades, combined into two meshes.
  const leaves=new Geometry(),stems=new Geometry();
  for(const x of [-10,10]){
    const pot=MeshBuilder.CreateCylinder('gallery-planter',{diameterTop:1.15,diameterBottom:.78,height:.85,tessellation:24},scene);pot.position.set(x,.52,-7.4);pot.material=wall;pot.parent=root;
    for(let i=0;i<24;i++){const a=i*2.399,len=.7+random()*.95,h=.95+random()*1.85,dx=Math.sin(a),dz=Math.cos(a);stems.box(x,.88,-7.4,.019,h*.82,.019);const origin=new Vector3(x,h,-7.4),tip=origin.add(new Vector3(dx*len,.25+len*.10,dz*len)),middle=Vector3.Lerp(origin,tip,.55).add(new Vector3(0,.2,0)),side=new Vector3(dz*.19,0,-dx*.19);leaves.quad(origin,middle.add(side),middle.subtract(side),tip,[.64+random()*.20,.75+random()*.20,.60,1]);}
  }
  const leafmat=material('gallery-leaves','#425b37',0,.64);leafmat.backFaceCulling=false;leafmat.twoSidedLighting=true;for(const [g,mat,name]of [[leaves,leafmat,'gallery-plant-leaves'],[stems,wood,'gallery-plant-stems']] as const){const mesh=g.mesh(name,scene,mat)!;mesh.parent=root;}
  const reflection=new MirrorTexture('gallery-floor-reflection',512,scene,true);reflection.mirrorPlane=new Plane(0,-1,0,-999.895);reflection.blurKernel=8;reflection.level=.50;reflection.renderParticles=false;reflection.renderSprites=false;reflection.renderList=[];floorMat.reflectionTexture=reflection;
  scene.onDisposeObservable.addOnce(()=>reflection.dispose());
  return {root,reflection,environment};
}
