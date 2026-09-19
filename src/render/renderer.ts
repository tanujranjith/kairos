import { Engine, WebGPUEngine, AbstractEngine, Scene, FreeCamera, Vector3, Color3, Color4, HemisphericLight, DirectionalLight, ShadowGenerator, MeshBuilder, StandardMaterial, VertexBuffer, RawCubeTexture, Constants, Texture, ImageProcessingConfiguration, Quaternion, Mesh, LinesMesh, PBRMaterial, TransformNode, DynamicTexture, SpotLight, Light, RawTexture } from '@babylonjs/core';
import type { Settings } from '../core/types';
import { clamp, approach } from '../core/math';
import type { Vehicle } from '../sim/physics';
import type { CarVisual } from './car';
import { configureLocalResources, localShaderOptions } from './local-resources';

export class Renderer {
  scene:Scene;camera:FreeCamera;sun:DirectionalLight;ambient:HemisphericLight;shadow:ShadowGenerator;sky:Mesh;sunDisc:Mesh;
  showroom:TransformNode;rendererName:string;lightsEnabled=true;private skyGradient:RawTexture;private shadowParts=new Set<Mesh>();private headlights:SpotLight[]=[];private cameraPosition=new Vector3();private look=new Vector3();private wasGarage=true;private rain:LinesMesh;private rainPositions:Float32Array;
  constructor(public engine:AbstractEngine,public canvas:HTMLCanvasElement){
    this.rendererName=engine instanceof WebGPUEngine?'WebGPU':'WebGL2';
    this.scene=new Scene(engine);const scene=this.scene;scene.clearColor=new Color4(.57,.65,.69,1);scene.fogMode=Scene.FOGMODE_EXP2;scene.fogDensity=.00038;scene.fogColor=new Color3(.72,.69,.58);
    scene.imageProcessingConfiguration.toneMappingEnabled=true;scene.imageProcessingConfiguration.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES;scene.imageProcessingConfiguration.exposure=1.1;scene.imageProcessingConfiguration.contrast=1.1;
    this.camera=new FreeCamera('driver-camera',new Vector3(0,2,-8),scene);this.camera.minZ=.08;this.camera.maxZ=9000;this.camera.fov=.80;this.camera.inputs.clear();
    this.ambient=new HemisphericLight('sky-light',new Vector3(0,1,0),scene);this.ambient.intensity=1.15;this.ambient.diffuse=new Color3(.8,.87,.98);this.ambient.groundColor=new Color3(.22,.20,.15);
    this.sun=new DirectionalLight('sun',new Vector3(.55,-.38,-.65),scene);this.sun.intensity=2.4;this.sun.diffuse=new Color3(1,.79,.52);this.sun.shadowMinZ=1;this.sun.shadowMaxZ=220;
    this.shadow=new ShadowGenerator(1024,this.sun);this.shadow.usePercentageCloserFiltering=true;this.shadow.filteringQuality=ShadowGenerator.QUALITY_LOW;this.shadow.bias=.001;this.shadow.normalBias=.03;this.shadow.setDarkness(.22);
    // Original procedural environment: all six faces and their mip levels stay same-origin.
    const size=32,faces:Uint8Array[]=[];for(let f=0;f<6;f++){const pixels=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const t=f===2?0:f===3?1:y/(size-1);const sky=[105,151,179],ground=[94,91,75],horizon=[242,216,167];const c=t<.6?sky.map((v,i)=>v+(horizon[i]-v)*t/.6):horizon.map((v,i)=>v+(ground[i]-v)*(t-.6)/.4);const o=(y*size+x)*4;pixels[o]=c[0];pixels[o+1]=c[1];pixels[o+2]=c[2];pixels[o+3]=255;}faces.push(pixels);}
    const env=new RawCubeTexture(scene,faces,size,Constants.TEXTUREFORMAT_RGBA,Constants.TEXTURETYPE_UNSIGNED_BYTE,true,false,Texture.TRILINEAR_SAMPLINGMODE);env.gammaSpace=true;scene.environmentTexture=env;scene.environmentIntensity=.85;
    this.sky=MeshBuilder.CreateSphere('atmosphere',{diameter:13000,segments:24,sideOrientation:Mesh.BACKSIDE},scene);this.sky.infiniteDistance=true;this.sky.isPickable=false;this.sky.applyFog=false;const skyMat=new StandardMaterial('sky-gradient',scene);skyMat.disableLighting=true;skyMat.emissiveColor=Color3.White();skyMat.backFaceCulling=false;this.sky.material=skyMat;const pos=this.sky.getVerticesData(VertexBuffer.PositionKind)!,colors:number[]=[];for(let i=0;i<pos.length;i+=3){const h=clamp(pos[i+1]/3500,0,1);const bottom=new Color3(.96,.77,.50),top=new Color3(.22,.43,.63),c=Color3.Lerp(bottom,top,Math.pow(h,.6));colors.push(c.r,c.g,c.b,1);}this.sky.setVerticesData(VertexBuffer.ColorKind,colors,true);
    this.skyGradient=RawTexture.CreateRGBATexture(new Uint8Array(64*4),1,64,scene,false,false,Texture.BILINEAR_SAMPLINGMODE);skyMat.emissiveColor=Color3.Black();skyMat.emissiveTexture=this.skyGradient;this.sky.useVertexColors=false;const skyUvs:number[]=[];for(let i=0;i<pos.length;i+=3)skyUvs.push(.5,clamp(pos[i+1]/6500,0,1));this.sky.setVerticesData(VertexBuffer.UVKind,skyUvs);
    this.sunDisc=MeshBuilder.CreateSphere('sun-disc',{diameter:100,segments:16},scene);this.sunDisc.isPickable=false;this.sunDisc.applyFog=false;const sm=new StandardMaterial('sun-glow',scene);sm.disableLighting=true;sm.emissiveColor=new Color3(1,.90,.61);this.sunDisc.material=sm;
    this.showroom=this.makeShowroom();
    for(const side of [-1,1]){const light=new SpotLight(`headlamp-${side}`,Vector3.Zero(),Vector3.Forward(),.85,3,scene);light.diffuse=new Color3(.82,.91,1);light.falloffType=Light.FALLOFF_GLTF;light.intensity=0;light.range=100;this.headlights.push(light);}
    this.rain=MeshBuilder.CreateLineSystem('rain',{lines:Array.from({length:250},()=>[new Vector3(),new Vector3(0,-1,0)]),updatable:true},scene);this.rain.color=new Color3(.7,.78,.85);this.rain.isPickable=false;this.rain.setEnabled(false);this.rainPositions=new Float32Array(1500);
    window.addEventListener('resize',()=>this.engine.resize());
  }
  static async create(canvas:HTMLCanvasElement){let engine:AbstractEngine|undefined;const forceGL=new URLSearchParams(location.search).get('renderer')==='webgl';
    configureLocalResources();
    if(!forceGL&&await WebGPUEngine.IsSupportedAsync){let gpu:WebGPUEngine|undefined;try{gpu=new WebGPUEngine(canvas,{antialias:true,powerPreference:'high-performance',...localShaderOptions});await gpu.initAsync();engine=gpu;}catch(e){console.warn('WebGPU unavailable; using WebGL2',e);gpu?.dispose();}}
    if(!engine){const gl=new Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true,powerPreference:'high-performance',disableWebGL2Support:false});if(gl.webGLVersion<2){gl.dispose();throw new Error('Kairos needs hardware-accelerated WebGL2 or WebGPU. Enable browser hardware acceleration, then reload.');}engine=gl;}
    return new Renderer(engine,canvas);
  }
  private makeShowroom(){const root=new TransformNode('showroom',this.scene),floorMat=new PBRMaterial('showroom-stone',this.scene);floorMat.albedoColor=new Color3(.19,.22,.23);floorMat.roughness=.3;floorMat.metallic=.35;
    const floor=MeshBuilder.CreateGround('showroom-floor',{width:80,height:70},this.scene);floor.position.y=-.02;floor.material=floorMat;floor.receiveShadows=true;floor.parent=root;
    const stage=MeshBuilder.CreateCylinder('turntable',{height:.16,diameter:7.6,tessellation:80},this.scene);stage.position.y=.025;stage.material=floorMat;stage.receiveShadows=true;stage.parent=root;
    const metal=new PBRMaterial('showroom-metal',this.scene);metal.albedoColor=new Color3(.11,.14,.15);metal.metallic=.7;metal.roughness=.36;
    const glow=new StandardMaterial('showroom-warm-light',this.scene);glow.emissiveColor=new Color3(1,.68,.34);glow.disableLighting=true;
    const ring=MeshBuilder.CreateTorus('turntable-light',{diameter:7.6,thickness:.025,tessellation:100},this.scene);ring.position.y=.115;ring.material=glow;ring.parent=root;
    for(let x=-16;x<=16;x+=8){const pillar=MeshBuilder.CreateBox('showroom-column',{width:.32,height:10,depth:.32},this.scene);pillar.position.set(x,5,-11);pillar.material=metal;pillar.parent=root;}
    const beam=MeshBuilder.CreateBox('showroom-beam',{width:45,height:.4,depth:.5},this.scene);beam.position.set(0,10,-11);beam.material=metal;beam.parent=root;
    for(let x=-20;x<=20;x+=4){const line=MeshBuilder.CreateBox('floor-joint',{width:.013,height:.005,depth:50},this.scene);line.position.set(x,.006,0);line.material=metal;line.parent=root;}
    const overhead=MeshBuilder.CreateTorus('ceiling-light',{diameter:13,thickness:.08,tessellation:80},this.scene);overhead.position.y=7;overhead.material=glow;overhead.parent=root;
    const backdrop=new StandardMaterial('showroom-hills',this.scene);backdrop.diffuseColor=new Color3(.35,.4,.36);for(let i=0;i<9;i++){const hill=MeshBuilder.CreateCylinder('distant-ridge',{diameterTop:0,diameterBottom:35,height:12+(i%3)*7,tessellation:6},this.scene);hill.position.set(-45+i*13,-1,-50-(i%2)*15);hill.material=backdrop;hill.parent=root;}
    const signtex=new DynamicTexture('showroom-wordmark',{width:1024,height:256},this.scene,false);signtex.drawText('K A I R O S',null,158,'300 100px sans-serif','#dce5e4','transparent',true);const signMat=new StandardMaterial('wordmark-material',this.scene);signMat.diffuseTexture=signtex;signMat.diffuseTexture.hasAlpha=true;signMat.useAlphaFromDiffuseTexture=true;signMat.emissiveColor=new Color3(.45,.45,.45);const sign=MeshBuilder.CreatePlane('showroom-wordmark',{width:10,height:2.5,sideOrientation:Mesh.DOUBLESIDE},this.scene);sign.position.set(0,4,-12);sign.rotation.y=Math.PI;sign.material=signMat;sign.parent=root;
    root.position.y=-1000;return root;
  }
  registerCar(car:CarVisual){for(const part of car.parts){this.shadowParts.add(part);part.onDisposeObservable.addOnce(()=>{this.shadowParts.delete(part);this.shadow.removeShadowCaster(part);});}}
  applySettings(settings:Settings){const profiles={Low:[1280,720,1024],Medium:[1600,900,1536],High:[1920,1080,2048],Ultra:[2560,1440,4096]},profile=profiles[settings.quality],scale=Math.max(1,window.innerWidth/profile[0],window.innerHeight/profile[1]);this.engine.setHardwareScalingLevel(scale/settings.resolution);this.shadow.getShadowMap()?.resize(profile[2]);}
  update(vehicle:Vehicle,visual:CarVisual,settings:Settings,dt:number,garage:boolean,clock:number,wetness:number,alpha=1){
    const time=settings.time;const day=clamp(Math.sin((time-5.5)/25*Math.PI*2)*1.5+.38,.035,1),golden=1-clamp(Math.abs(time-17.5)/3,0,1);const overcast=settings.weather==='Rain'?.6:settings.weather==='Overcast'?.4:settings.weather==='Cloudy'?.18:0;
    this.ambient.intensity=.25+day*1.25;this.sun.intensity=(.12+day*2.2)*(1-overcast);this.sun.diffuse=Color3.Lerp(new Color3(.96,.96,.89),new Color3(1,.79,.57),golden);this.scene.environmentIntensity=.22+day*.8;
    this.sun.direction.set(.55,-Math.max(.12,day*.6),-.65).normalize();this.scene.fogColor=Color3.Lerp(new Color3(.10,.15,.23),new Color3(.76,.75,.65),day);this.scene.fogDensity=.00038+wetness*.0005;
    this.sky.visibility=1;const skyPixels=new Uint8Array(256);for(let i=0;i<64;i++){const t=Math.pow(i/63,.55),night=Color3.Lerp(new Color3(.025,.043,.072),new Color3(.005,.012,.035),t),horizon=Color3.Lerp(new Color3(.69,.80,.87),new Color3(.94,.68,.39),golden*(1-overcast)),dayColor=Color3.Lerp(horizon,new Color3(.18,.43,.70),t),c=Color3.Lerp(night,dayColor,clamp((day-.035)/.65,0,1));skyPixels.set([c.r*255,c.g*255,c.b*255,255],i*4);}this.skyGradient.update(skyPixels);this.sunDisc.position.copyFrom(this.camera.position).addInPlace(this.sun.direction.scale(-5000));this.sunDisc.setEnabled(day>.05&&overcast<.5);
    this.showroom.setEnabled(garage);
    if(garage){visual.glass.alpha=1;visual.glass.transparencyMode=PBRMaterial.PBRMATERIAL_OPAQUE;}
    this.headlights.forEach((light,i)=>{const f=new Vector3(Math.sin(vehicle.state.yaw),-.08,Math.cos(vehicle.state.yaw)),r=new Vector3(Math.cos(vehicle.state.yaw),0,-Math.sin(vehicle.state.yaw));light.position.copyFrom(vehicle.node.position).addInPlace(f.scale(vehicle.definition.length*.48)).addInPlace(r.scale(i===0?-.55:.55));light.direction.copyFrom(f);light.intensity=!garage&&this.lightsEnabled?(day<.65?650:4):0;});
    if(garage){const a=-.7+Math.sin(clock*.07)*.12;visual.root.position.set(0,-999.26,0);visual.root.rotationQuaternion=Quaternion.RotationYawPitchRoll(.2,0,0);this.camera.position.set(Math.sin(a)*8.3,-997.0,Math.cos(a)*8.3);this.camera.setTarget(new Vector3(0,-999.05,0));this.camera.fov=.62;this.sun.position.set(30,-960,30);this.scene.fogDensity=.0003;this.wasGarage=true;}
    else{
      visual.root.position.copyFrom(Vector3.Lerp(vehicle.previousPosition,vehicle.node.position,alpha));visual.root.rotationQuaternion=Quaternion.Slerp(vehicle.previousRotation,vehicle.node.rotationQuaternion!,alpha);visual.update(vehicle.state);
      const p=visual.root.position,yaw=vehicle.state.yaw,forward=new Vector3(Math.sin(yaw),0,Math.cos(yaw)),right=new Vector3(Math.cos(yaw),0,-Math.sin(yaw));const mode=settings.camera;
      let target=p.add(new Vector3(0,.65,0)),desired:Vector3;
      if(mode<2){const dist=mode===0?7.1:4.9;desired=p.subtract(forward.scale(dist)).add(new Vector3(0,mode===0?2.7:1.85,0));target.addInPlace(forward.scale(3));}
      else{const cockpit=mode===2;desired=p.add(forward.scale(cockpit?-.32:mode===3?vehicle.definition.length*.31:vehicle.definition.length*.51)).add(new Vector3(0,cockpit?.58:mode===3?.18:-.12));if(cockpit&&vehicle.definition.class!=='FORMULA')desired.subtractInPlace(right.scale(.34));target=desired.add(forward.scale(30));}
      visual.glass.alpha=mode===2?.13:1;visual.glass.transparencyMode=mode===2?PBRMaterial.PBRMATERIAL_ALPHABLEND:PBRMaterial.PBRMATERIAL_OPAQUE;
      if(mode<2){const origin=p.add(new Vector3(0,.8,0)),hit=vehicle.world.engine.raycast(origin,desired,{collideWith:1});if(hit.hasHit)desired=Vector3.Lerp(origin,hit.hitPointWorld,Math.max(.1,1-.25/Math.max(.25,hit.hitDistance)));}
      if(this.wasGarage||mode>=2||Vector3.Distance(this.cameraPosition,desired)>40){this.cameraPosition.copyFrom(desired);this.look.copyFrom(target);}else{Vector3.LerpToRef(this.cameraPosition,desired,1-Math.exp(-6*dt),this.cameraPosition);Vector3.LerpToRef(this.look,target,1-Math.exp(-10*dt),this.look);}
      this.camera.position.copyFrom(this.cameraPosition);this.camera.setTarget(this.look);this.camera.fov=approach(this.camera.fov,.77+clamp(Math.abs(vehicle.state.speed)/120,0,.17),5,dt);this.sun.position.copyFrom(p).subtractInPlace(this.sun.direction.scale(90));this.wasGarage=false;
    }
    const shadowMap=this.shadow.getShadowMap();if(shadowMap)shadowMap.renderList=[...this.shadowParts].filter(p=>p.isEnabled()&&Vector3.DistanceSquared(p.getAbsolutePosition(),visual.root.position)<3600);
    const rainy=settings.weather==='Rain';this.rain.setEnabled(rainy&&!garage);if(rainy&&!garage){const p=this.camera.position;for(let i=0;i<250;i++){const x=((i*7.31)%34)-17+p.x,z=((i*11.27)%34)-17+p.z,y=(((i*3.71-clock*24)%18)+18)%18+p.y-3;this.rainPositions.set([x,y,z,x-.15,y-1.05,z],i*6);}this.rain.updateVerticesData(VertexBuffer.PositionKind,this.rainPositions);this.rain.refreshBoundingInfo();}
  }
  render(){this.scene.render();}
}
