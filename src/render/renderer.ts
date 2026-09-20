import { Engine, WebGPUEngine, AbstractEngine, Scene, FreeCamera, Vector3, Color3, Color4, HemisphericLight, DirectionalLight, ShadowGenerator, MeshBuilder, StandardMaterial, VertexBuffer, DefaultRenderingPipeline, ImageProcessingConfiguration, Quaternion, Mesh, LinesMesh, PBRMaterial, TransformNode, DynamicTexture, SpotLight, Light } from '@babylonjs/core';
import type { Settings } from '../core/types';
import { clamp, approach } from '../core/math';
import type { Vehicle } from '../sim/physics';
import type { CarVisual } from './car';
import { configureLocalResources, localShaderOptions } from './local-resources';
import { lightingEnvironment } from './lighting-environment';
import { solarLighting } from './atmosphere';
import { SkyDome } from './sky-material';
import { atmosphereFog } from './sky-field';
import { LocalReflections } from './local-reflections';
import { createShowroom } from './showroom';
import { cameraMounts } from './camera-mounts';
import type { MirrorTexture,BaseTexture } from '@babylonjs/core';

export class Renderer {
  scene:Scene;camera:FreeCamera;sun:DirectionalLight;ambient:HemisphericLight;shadow:ShadowGenerator;sky:Mesh;atmosphere:SkyDome;
  showroom:TransformNode;rendererName:string;lightsEnabled=true;private shadowParts=new Set<Mesh>();private headlights:SpotLight[]=[];private cameraPosition=new Vector3();private look=new Vector3();private wasGarage=true;private rain:LinesMesh;private rainPositions:Float32Array;
  private outdoorEnvironment:ReturnType<typeof lightingEnvironment>;private studioEnvironment:ReturnType<typeof lightingEnvironment>;private pipeline:DefaultRenderingPipeline;private contactMaterial:StandardMaterial;
  reflections:LocalReflections;private registeredCars=new WeakMap<CarVisual,Mesh>();private studioLights:SpotLight[]=[];private floorReflection:MirrorTexture;private galleryEnvironment:BaseTexture;
  constructor(public engine:AbstractEngine,public canvas:HTMLCanvasElement){
    this.rendererName=engine instanceof WebGPUEngine?'WebGPU':'WebGL2';
    this.scene=new Scene(engine);const scene=this.scene;scene.clearColor=new Color4(.57,.65,.69,1);scene.fogMode=Scene.FOGMODE_EXP2;scene.fogDensity=.00038;scene.fogColor=new Color3(.72,.69,.58);
    scene.imageProcessingConfiguration.toneMappingEnabled=true;scene.imageProcessingConfiguration.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES;scene.imageProcessingConfiguration.exposure=1.1;scene.imageProcessingConfiguration.contrast=1.07;
    this.reflections=new LocalReflections(scene);
    this.camera=new FreeCamera('driver-camera',new Vector3(0,2,-8),scene);this.camera.minZ=.08;this.camera.maxZ=9000;this.camera.fov=.80;this.camera.inputs.clear();
    this.ambient=new HemisphericLight('sky-light',new Vector3(0,1,0),scene);this.ambient.intensity=1.15;this.ambient.diffuse=new Color3(.8,.87,.98);this.ambient.groundColor=new Color3(.22,.20,.15);
    this.sun=new DirectionalLight('sun',new Vector3(.55,-.38,-.65),scene);this.sun.intensity=2.4;this.sun.diffuse=new Color3(1,.79,.52);this.sun.shadowMinZ=1;this.sun.shadowMaxZ=220;
    this.shadow=new ShadowGenerator(1024,this.sun);this.shadow.usePercentageCloserFiltering=true;this.shadow.filteringQuality=ShadowGenerator.QUALITY_LOW;this.shadow.bias=.001;this.shadow.normalBias=.03;this.shadow.setDarkness(.08);this.sun.shadowFrustumSize=115;
    this.pipeline=new DefaultRenderingPipeline('kairos-photographic',true,scene,[this.camera]);this.pipeline.fxaaEnabled=true;this.pipeline.bloomThreshold=1.15;this.pipeline.bloomWeight=.12;this.pipeline.bloomKernel=32;this.pipeline.bloomScale=.5;
    this.outdoorEnvironment=lightingEnvironment(scene);this.studioEnvironment=lightingEnvironment(scene,true);scene.environmentTexture=this.outdoorEnvironment;
    const shadowTexture=new DynamicTexture('original-contact-occlusion',128,scene,true),sctx=shadowTexture.getContext(),gradient=sctx.createRadialGradient(64,64,12,64,64,62);gradient.addColorStop(0,'rgba(0,0,0,.58)');gradient.addColorStop(.55,'rgba(0,0,0,.30)');gradient.addColorStop(1,'rgba(0,0,0,0)');sctx.fillStyle=gradient;sctx.fillRect(0,0,128,128);shadowTexture.update();shadowTexture.hasAlpha=true;
    this.contactMaterial=new StandardMaterial('contact-occlusion',scene);this.contactMaterial.diffuseTexture=shadowTexture;this.contactMaterial.emissiveTexture=shadowTexture;this.contactMaterial.useAlphaFromDiffuseTexture=true;this.contactMaterial.disableLighting=true;this.contactMaterial.emissiveColor=Color3.White();this.contactMaterial.zOffset=-1;this.contactMaterial.backFaceCulling=false;
    this.atmosphere=new SkyDome(scene);this.sky=this.atmosphere.mesh;
    const gallery=createShowroom(scene);this.showroom=gallery.root;this.floorReflection=gallery.reflection;this.galleryEnvironment=gallery.environment;
    for(const [name,p,power,color]of [['studio-key',new Vector3(-4,-994,4),900,new Color3(1,.86,.70)],['studio-fill',new Vector3(4,-996,-3),480,new Color3(.68,.82,1)]] as const){const lamp=new SpotLight(name,p,new Vector3(0,-999,0).subtract(p).normalize(),1.8,1,scene);lamp.diffuse=color;lamp.falloffType=Light.FALLOFF_GLTF;lamp.intensity=power;lamp.range=22;this.studioLights.push(lamp);}
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
  registerCar(car:CarVisual,grounded=true){
    const existing=this.registeredCars.get(car);if(existing){existing.isVisible=grounded;return;}
    // Sun/sky, two headlamps and at most two nearby street lights.
    for(const part of car.parts)if(part.material instanceof PBRMaterial)part.material.maxSimultaneousLights=6;
    car.root.metadata={...car.root.metadata,kairosCar:true};
    const patches:Mesh[]=[];
    const patch=(width:number,height:number,x:number,z:number,y:number)=>{const mesh=MeshBuilder.CreateGround('contact-patch',{width,height},this.scene);mesh.position.set(x,y,z);mesh.material=this.contactMaterial;patches.push(mesh);};
    patch(2.55,5.2,0,0,-car.groundOffset+.006);
    for(const wheel of car.wheels)patch(.65,1.05,wheel.position.x,wheel.position.z,-car.groundOffset+.007);
    const contact=Mesh.MergeMeshes(patches,true,true)!;contact.name='car-contact-shadow';contact.parent=car.root;contact.material=this.contactMaterial;contact.isPickable=false;contact.isVisible=grounded;this.registeredCars.set(car,contact);
    for(const part of car.parts){
      // Glass and tiny emissive faces are not opaque sun occluders. The body,
      // cabin/wing, tyres and wheels provide the car's actual shadow silhouette.
      if(part.material===car.glass||part.material===car.lights||part.material===car.tail||part.material?.name.includes('-instruments'))continue;
      this.shadowParts.add(part);part.onDisposeObservable.addOnce(()=>{this.shadowParts.delete(part);this.shadow.removeShadowCaster(part);});
    }
  }
  prepareReflections(car:CarVisual,settings:Settings,garage:boolean,clock:number){this.reflections.update({position:car.root.position,garage,clock,stamp:`${Math.round(settings.time*4)}:${settings.weather}`},settings.quality,[car.paint,car.glass]);}
  applySettings(settings:Settings){const profiles={Low:[1280,720,1024],Medium:[1600,900,1536],High:[1920,1080,2048],Ultra:[2560,1440,4096]},profile=profiles[settings.quality],scale=Math.max(1,window.innerWidth/profile[0],window.innerHeight/profile[1]);this.engine.setHardwareScalingLevel(scale/settings.resolution);this.shadow.getShadowMap()?.resize(profile[2]);this.pipeline.bloomEnabled=settings.quality!=='Low';this.pipeline.samples=settings.quality==='Ultra'?4:1;}
  update(vehicle:Vehicle,visual:CarVisual,settings:Settings,dt:number,garage:boolean,clock:number,wetness:number,alpha=1){
    const time=settings.time,solar=solarLighting(time),day=solar.daylight,golden=solar.golden;const overcast=settings.weather==='Rain'?.72:settings.weather==='Overcast'?.55:settings.weather==='Cloudy'?.20:0;
    this.ambient.intensity=garage?.35:.32+day*.60;this.sun.intensity=garage?2.8:day*(2.8+golden*.9)*(1-overcast);this.sun.diffuse=Color3.Lerp(new Color3(.96,.96,.89),new Color3(1,.66,.34),golden);this.scene.environmentIntensity=garage?.65:.22+day*.78;this.scene.environmentTexture=garage?(this.galleryEnvironment.isReady()?this.galleryEnvironment:this.studioEnvironment):this.outdoorEnvironment;
    this.scene.imageProcessingConfiguration.exposure=garage?1.1:1.12+day*.06+golden*.15;
    if(garage)this.sun.direction.set(.55,-.6,-.65).normalize();else this.sun.direction.set(-solar.direction.x,-Math.max(.02,solar.direction.y),-solar.direction.z).normalize();
    this.scene.fogColor.set(...atmosphereFog(time,settings.weather));this.scene.fogDensity=.00013+golden*.000025+wetness*.0006;
    this.sky.visibility=1;this.atmosphere.update(time,settings.weather,clock);
    this.showroom.setEnabled(garage);
    // Planar reflection is confined to the gallery; driving never pays for this pass.
    this.floorReflection.renderList=garage?this.scene.meshes.filter(mesh=>mesh.isEnabled()&&mesh.isVisible&&mesh.name!=='car-contact-shadow'&&(mesh.metadata?.floorReflection||(()=>{let node=mesh.parent;while(node){if(node.metadata?.kairosCar)return true;node=node.parent;}return false;})())):[];
    this.registerCar(visual,garage||vehicle.state.grounded);
    this.studioLights.forEach(light=>light.setEnabled(garage));this.headlights.forEach(light=>light.setEnabled(!garage));
    if(garage){visual.glass.alpha=.64;visual.glass.transparencyMode=PBRMaterial.PBRMATERIAL_ALPHABLEND;for(const n of visual.root.getChildTransformNodes())if(/brake-\d$/.test(n.name)){n.position.y=-.32;n.rotationQuaternion=null;n.rotation.set(0,0,0);}}
    this.headlights.forEach((light,i)=>{const f=new Vector3(Math.sin(vehicle.state.yaw),-.08,Math.cos(vehicle.state.yaw)),r=new Vector3(Math.cos(vehicle.state.yaw),0,-Math.sin(vehicle.state.yaw));light.position.copyFrom(vehicle.node.position).addInPlace(f.scale(vehicle.definition.length*.48)).addInPlace(r.scale(i===0?-.55:.55));light.direction.copyFrom(f);light.intensity=!garage&&this.lightsEnabled?(day<.28?650:1):0;});
    if(garage){const a=-.58+Math.sin(clock*.07)*.08;visual.wheels.forEach(w=>{w.position.y=-.32;w.rotation.set(0,0,0);w.rotationQuaternion=null;});visual.root.position.set(0,-1000+.105+.32+vehicle.definition.wheelRadius,0);visual.root.rotationQuaternion=Quaternion.RotationYawPitchRoll(.2,0,0);this.camera.position.set(Math.sin(a)*8.5,-998.32,Math.cos(a)*8.5);this.camera.setTarget(new Vector3(0,-999.12,0));this.camera.fov=.59;this.sun.position.copyFrom(visual.root.position).subtractInPlace(this.sun.direction.scale(90));this.scene.fogDensity=.0003;this.wasGarage=true;}
    else{
      visual.root.position.copyFrom(Vector3.Lerp(vehicle.previousPosition,vehicle.node.position,alpha));visual.root.rotationQuaternion=Quaternion.Slerp(vehicle.previousRotation,vehicle.node.rotationQuaternion!,alpha);visual.update(vehicle.state);
      const p=visual.root.position,yaw=vehicle.state.yaw,forward=new Vector3(Math.sin(yaw),0,Math.cos(yaw)),right=new Vector3(Math.cos(yaw),0,-Math.sin(yaw));const mode=settings.camera;
      let target=p.add(new Vector3(0,.65,0)),desired:Vector3;
      if(mode<2){const dist=mode===0?6.5:4.9;desired=p.subtract(forward.scale(dist)).add(new Vector3(0,mode===0?1.65:1.25,0));target=p.add(new Vector3(0,.38,0)).add(forward.scale(4.2));}
      else{const mounts=cameraMounts(vehicle.definition),mount=mode===2?mounts.cockpit:mode===3?mounts.hood:mounts.bumper;desired=p.add(forward.scale(mount.z)).add(right.scale(mount.x)).add(new Vector3(0,mount.y,0));target=desired.add(forward.scale(30));}
      visual.glass.alpha=mode===2?.13:.64;visual.glass.transparencyMode=PBRMaterial.PBRMATERIAL_ALPHABLEND;
      if(mode<2){const origin=p.add(new Vector3(0,.8,0)),hit=vehicle.world.engine.raycast(origin,desired,{collideWith:1});if(hit.hasHit)desired=Vector3.Lerp(origin,hit.hitPointWorld,Math.max(.1,1-.25/Math.max(.25,hit.hitDistance)));}
      if(this.wasGarage||mode>=2||Vector3.Distance(this.cameraPosition,desired)>40){this.cameraPosition.copyFrom(desired);this.look.copyFrom(target);}else{Vector3.LerpToRef(this.cameraPosition,desired,1-Math.exp(-6*dt),this.cameraPosition);Vector3.LerpToRef(this.look,target,1-Math.exp(-10*dt),this.look);}
      this.camera.position.copyFrom(this.cameraPosition);this.camera.setTarget(this.look);this.camera.fov=approach(this.camera.fov,.77+clamp(Math.abs(vehicle.state.speed)/120,0,.17),5,dt);this.sun.position.copyFrom(p).subtractInPlace(this.sun.direction.scale(90));this.wasGarage=false;
    }
    const shadowMap=this.shadow.getShadowMap();if(shadowMap){const p=visual.root.position;
      const scenery=this.scene.meshes.filter(m=>{if(!m.metadata?.worldCaster||!m.isVisible||!m.isEnabled())return false;const b=m.getBoundingInfo().boundingBox;return b.minimumWorld.x<p.x+80&&b.maximumWorld.x>p.x-80&&b.minimumWorld.z<p.z+80&&b.maximumWorld.z>p.z-80;});
      shadowMap.renderList=[...[...this.shadowParts].filter(m=>m.isEnabled()&&Vector3.DistanceSquared(m.getAbsolutePosition(),p)<3600),...scenery];
    }
    const rainy=settings.weather==='Rain';this.rain.setEnabled(rainy&&!garage);if(rainy&&!garage){const p=this.camera.position;for(let i=0;i<250;i++){const x=((i*7.31)%34)-17+p.x,z=((i*11.27)%34)-17+p.z,y=(((i*3.71-clock*24)%18)+18)%18+p.y-3;this.rainPositions.set([x,y,z,x-.15,y-1.05,z],i*6);}this.rain.updateVerticesData(VertexBuffer.PositionKind,this.rainPositions);this.rain.refreshBoundingInfo();}
  }
  render(){this.scene.render();}
}
