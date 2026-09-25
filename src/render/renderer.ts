import { Engine, WebGPUEngine, AbstractEngine, Scene, ScenePerformancePriority, FreeCamera, Vector3, Color3, Color4, HemisphericLight, DirectionalLight, ShadowGenerator, MeshBuilder, StandardMaterial, VertexBuffer, DefaultRenderingPipeline, ImageProcessingConfiguration, Quaternion, Mesh, LinesMesh, PBRMaterial, TransformNode, DynamicTexture, SpotLight, Light, Material } from '@babylonjs/core';
import type { Settings } from '../core/types';
import { clamp, approach } from '../core/math';
import type { Vehicle } from '../sim/physics';
import type { CarVisual } from './car';
import { configureLocalResources, initializeLocalTextureDecoder, localShaderOptions } from './local-resources';
import { lightingEnvironment } from './lighting-environment';
import { drivingLighting } from './atmosphere';
import { SkyDome } from './sky-material';
import { atmosphereFog } from './sky-field';
import { LocalReflections } from './local-reflections';
import { createShowroom } from './showroom';
import { cameraMounts } from './camera-mounts';
import { visualModelId } from './car-assets';
import { vehicleById } from '../content/vehicles';
import {QualityEffects} from './quality-effects';
import type { MirrorTexture,BaseTexture } from '@babylonjs/core';

const AMBIENT_DAY=new Color3(.8,.87,.98),AMBIENT_NIGHT=new Color3(.48,.62,.88),GROUND_DAY=new Color3(.22,.20,.15),GROUND_NIGHT=new Color3(.12,.17,.25),SUN_DAY=new Color3(.96,.96,.89),SUN_GOLD=new Color3(1,.66,.34),MOON_LIGHT=new Color3(.48,.62,.88);

export class Renderer {
  scene:Scene;camera:FreeCamera;sun:DirectionalLight;ambient:HemisphericLight;shadow:ShadowGenerator;sky:Mesh;atmosphere:SkyDome;
  showroom:TransformNode;rendererName:string;lightsEnabled=true;private shadowParts=new Set<Mesh>();private headlights:SpotLight[]=[];private cameraPosition=new Vector3();private look=new Vector3();private wasGarage=true;private cameraMode=0;private cameraObstructed=false;private cameraRequestedDistance=0;private cameraResolvedDistance=0;private cameraCurrentDistance=0;private rain:LinesMesh;private rainPositions:Float32Array;
  private outdoorEnvironment:ReturnType<typeof lightingEnvironment>;private studioEnvironment:ReturnType<typeof lightingEnvironment>;private pipeline:DefaultRenderingPipeline;private contactMaterial:StandardMaterial;
  reflections:LocalReflections;private registeredCars=new WeakMap<CarVisual,Mesh>();private studioLights:SpotLight[]=[];private floorReflection:MirrorTexture;private galleryEnvironment:BaseTexture;
  private activeSettings:Settings|null=null;private dynamicResolutionScale=1;private daylightColour=new Color3();private shadowSelectionAt=-Infinity;
  private activeMeshListDirty=true;private activeMeshCount=-1;private activeMeshRefreshes=0;
  readonly effects:QualityEffects;
  constructor(public engine:AbstractEngine,public canvas:HTMLCanvasElement){
    this.rendererName=engine instanceof WebGPUEngine?'WebGPU':'WebGL2';
    this.scene=new Scene(engine);const scene=this.scene;scene.performancePriority=ScenePerformancePriority.Intermediate;scene.clearColor=new Color4(.57,.65,.69,1);scene.fogMode=Scene.FOGMODE_EXP2;scene.fogDensity=.00038;scene.fogColor=new Color3(.72,.69,.58);
    scene.imageProcessingConfiguration.toneMappingEnabled=true;scene.imageProcessingConfiguration.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES;scene.imageProcessingConfiguration.exposure=1.1;scene.imageProcessingConfiguration.contrast=1.07;
    this.reflections=new LocalReflections(scene);
    this.camera=new FreeCamera('driver-camera',new Vector3(0,2,-8),scene);this.camera.minZ=.08;this.camera.maxZ=9000;this.camera.fov=.80;this.camera.inputs.clear();
    this.ambient=new HemisphericLight('sky-light',new Vector3(0,1,0),scene);this.ambient.intensity=1.15;this.ambient.diffuse=new Color3(.8,.87,.98);this.ambient.groundColor=new Color3(.22,.20,.15);
    this.sun=new DirectionalLight('sun',new Vector3(.55,-.38,-.65),scene);this.sun.intensity=2.4;this.sun.diffuse=new Color3(1,.79,.52);this.sun.shadowMinZ=1;this.sun.shadowMaxZ=220;
    this.shadow=new ShadowGenerator(1024,this.sun);this.shadow.usePercentageCloserFiltering=true;this.shadow.filteringQuality=ShadowGenerator.QUALITY_LOW;this.shadow.bias=.001;this.shadow.normalBias=.03;this.shadow.setDarkness(.08);this.sun.shadowFrustumSize=115;
    this.pipeline=new DefaultRenderingPipeline('kairos-photographic',true,scene,[this.camera]);this.pipeline.fxaaEnabled=true;this.pipeline.bloomThreshold=1.15;this.pipeline.bloomWeight=.12;this.pipeline.bloomKernel=32;this.pipeline.bloomScale=.5;
    this.effects=new QualityEffects(scene,this.camera,'kairos-photographic');scene.onDisposeObservable.addOnce(()=>this.effects.dispose());
    this.outdoorEnvironment=lightingEnvironment(scene);this.studioEnvironment=lightingEnvironment(scene,true);scene.environmentTexture=this.outdoorEnvironment;
    const shadowTexture=new DynamicTexture('original-contact-occlusion',128,scene,true),sctx=shadowTexture.getContext(),gradient=sctx.createRadialGradient(64,64,12,64,64,62);gradient.addColorStop(0,'rgba(0,0,0,.58)');gradient.addColorStop(.55,'rgba(0,0,0,.30)');gradient.addColorStop(1,'rgba(0,0,0,0)');sctx.fillStyle=gradient;sctx.fillRect(0,0,128,128);shadowTexture.update();shadowTexture.hasAlpha=true;
    this.contactMaterial=new StandardMaterial('contact-occlusion',scene);this.contactMaterial.diffuseTexture=shadowTexture;this.contactMaterial.emissiveTexture=shadowTexture;this.contactMaterial.useAlphaFromDiffuseTexture=true;this.contactMaterial.disableLighting=true;this.contactMaterial.emissiveColor=Color3.White();this.contactMaterial.zOffset=-1;this.contactMaterial.backFaceCulling=false;
    this.atmosphere=new SkyDome(scene);this.sky=this.atmosphere.mesh;
    const gallery=createShowroom(scene);this.showroom=gallery.root;this.floorReflection=gallery.reflection;this.galleryEnvironment=gallery.environment;
    for(const [name,p,power,color]of [['studio-key',new Vector3(-4,-994,4),900,new Color3(1,.86,.70)],['studio-fill',new Vector3(4,-996,-3),480,new Color3(.68,.82,1)]] as const){const lamp=new SpotLight(name,p,new Vector3(0,-999,0).subtract(p).normalize(),1.8,1,scene);lamp.diffuse=color;lamp.falloffType=Light.FALLOFF_GLTF;lamp.intensity=power;lamp.range=22;this.studioLights.push(lamp);}
    for(const side of [-1,1]){const light=new SpotLight(`headlamp-${side}`,Vector3.Zero(),Vector3.Forward(),.85,3,scene);light.diffuse=new Color3(.82,.91,1);light.falloffType=Light.FALLOFF_GLTF;light.intensity=0;light.range=100;this.headlights.push(light);}
    this.rain=MeshBuilder.CreateLineSystem('rain',{lines:Array.from({length:250},()=>[new Vector3(),new Vector3(0,-1,0)]),updatable:true},scene);this.rain.color=new Color3(.7,.78,.85);this.rain.isPickable=false;this.rain.setEnabled(false);this.rainPositions=new Float32Array(1500);
    window.addEventListener('resize',()=>{this.applyHardwareScale();this.engine.resize();});
  }
  static async create(canvas:HTMLCanvasElement){let engine:AbstractEngine|undefined;const forceGL=new URLSearchParams(location.search).get('renderer')==='webgl';
    configureLocalResources();
    if(!forceGL&&await WebGPUEngine.IsSupportedAsync){let gpu:WebGPUEngine|undefined;try{gpu=new WebGPUEngine(canvas,{antialias:true,powerPreference:'high-performance',doNotHandleContextLost:true,...localShaderOptions});await gpu.initAsync();this.monitorWebGPU(gpu);engine=gpu;}catch(e){console.warn('WebGPU unavailable; using WebGL2',e);gpu?.dispose();}}
    if(!engine){const gl=new Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true,powerPreference:'high-performance',disableWebGL2Support:false});if(gl.webGLVersion<2){gl.dispose();throw new Error('Kairos needs hardware-accelerated WebGL2 or WebGPU. Enable browser hardware acceleration, then reload.');}engine=gl;}
    initializeLocalTextureDecoder(engine);
    return new Renderer(engine,canvas);
  }
  /** Babylon 9.27 starts its asynchronous WebGPU reinitialization without
   * awaiting it before rebuilding resources. Own the loss loop so buffers,
   * textures and effects are rebuilt only after the replacement device exists. */
  private static monitorWebGPU(engine:WebGPUEngine){
    type Internals={_device:GPUDevice;_isDisposed:boolean;_contextWasLost:boolean;_currentRenderPass:unknown;_clearEmptyResources:()=>void;_rebuildGraphicsResources:()=>void;_flagContextRestored:()=>void};
    const internal=engine as unknown as Internals,device=internal._device;
    void device.lost.then(async info=>{
      if(internal._isDisposed)return;internal._contextWasLost=true;console.warn(`Kairos WebGPU device lost: ${info.reason}${info.message?` · ${info.message}`:''}`);engine.onContextLostObservable.notifyObservers(engine);
      const snapshotRenderingMode=engine.snapshotRenderingMode,snapshotRendering=engine.snapshotRendering,disableCacheSamplers=engine.disableCacheSamplers,disableCacheRenderPipelines=engine.disableCacheRenderPipelines,disableCacheBindGroups=engine.disableCacheBindGroups,enableGPUTimingMeasurements=engine.enableGPUTimingMeasurements;
      const depthTest=engine.depthCullingState.depthTest,depthFunc=engine.depthCullingState.depthFunc,depthMask=engine.depthCullingState.depthMask,stencilTest=engine.stencilState.stencilTest;
      try{internal._clearEmptyResources();await engine.initAsync();engine.snapshotRenderingMode=snapshotRenderingMode;engine.snapshotRendering=snapshotRendering;engine.disableCacheSamplers=disableCacheSamplers;engine.disableCacheRenderPipelines=disableCacheRenderPipelines;engine.disableCacheBindGroups=disableCacheBindGroups;engine.enableGPUTimingMeasurements=enableGPUTimingMeasurements;internal._currentRenderPass=null;internal._rebuildGraphicsResources();engine.depthCullingState.depthTest=depthTest;engine.depthCullingState.depthFunc=depthFunc;engine.depthCullingState.depthMask=depthMask;engine.stencilState.stencilTest=stencilTest;this.monitorWebGPU(engine);internal._flagContextRestored();}
      catch(error){console.error('Kairos could not rebuild the WebGPU device.',error);}
    });
  }
  registerCar(car:CarVisual,grounded=true){
    const existing=this.registeredCars.get(car);if(existing){existing.visibility=grounded?1:0;return;}
    // Sun/sky, two headlamps and at most two nearby street lights.
    for(const part of car.parts)if(part.material instanceof PBRMaterial)part.material.maxSimultaneousLights=6;
    car.root.metadata={...car.root.metadata,kairosCar:true};
    const patches:Mesh[]=[];
    const patch=(width:number,height:number,x:number,z:number,y:number)=>{const mesh=MeshBuilder.CreateGround('contact-patch',{width,height},this.scene);mesh.position.set(x,y,z);mesh.material=this.contactMaterial;patches.push(mesh);};
    patch(2.55,5.2,0,0,-car.groundOffset+.006);
    for(const wheel of car.wheels)patch(.65,1.05,wheel.position.x,wheel.position.z,-car.groundOffset+.007);
    const contact=Mesh.MergeMeshes(patches,true,true)!;contact.name='car-contact-shadow';contact.parent=car.root;contact.material=this.contactMaterial;contact.isPickable=false;contact.isVisible=true;contact.visibility=grounded?1:0;this.registeredCars.set(car,contact);
    for(const part of car.parts){
      // Glass and tiny emissive faces are not opaque sun occluders. The body,
      // cabin/wing, tyres and wheels provide the car's actual shadow silhouette.
      if(part.material===car.glass||part.material===car.lights||part.material===car.tail||part.material?.name.includes('-instruments')||part.material?.name.includes('-lamp-lens'))continue;
      this.shadowParts.add(part);part.onDisposeObservable.addOnce(()=>{this.shadowParts.delete(part);this.shadow.removeShadowCaster(part);});
    }
  }
  invalidateActiveMeshes(){this.activeMeshListDirty=true;}
  activeMeshState(){return {frozen:this.scene._activeMeshesFrozen,active:this.scene.getActiveMeshes().length,total:this.scene.meshes.length,refreshes:this.activeMeshRefreshes};}
  prepareReflections(car:CarVisual,settings:Settings,garage:boolean,clock:number){this.reflections.update({position:car.root.position,garage,clock,stamp:`${Math.round(settings.time*4)}:${settings.weather}`},settings.quality,[car.paint,car.glass]);}
  recoverGraphicsResources(){this.scene.unfreezeActiveMeshes();this.invalidateActiveMeshes();this.reflections.recover();const old=[this.outdoorEnvironment,this.studioEnvironment];this.outdoorEnvironment=lightingEnvironment(this.scene);this.studioEnvironment=lightingEnvironment(this.scene,true);this.scene.environmentTexture=this.wasGarage?(this.galleryEnvironment.isReady()?this.galleryEnvironment:this.studioEnvironment):this.outdoorEnvironment;for(const texture of old){const internal=(texture as unknown as {_texture?:{_hardwareTexture:unknown}})._texture;if(internal)internal._hardwareTexture=null;texture.dispose();}this.engine.wipeCaches(true);this.scene.markAllMaterialsAsDirty(Material.TextureDirtyFlag);}
  private applyHardwareScale(){if(!this.activeSettings)return;const profiles={Low:[1280,720],Medium:[1600,900],High:[1920,1080],Ultra:[2560,1440]},profile=profiles[this.activeSettings.quality],viewportScale=Math.max(1,window.innerWidth/profile[0],window.innerHeight/profile[1]);this.engine.setHardwareScalingLevel(viewportScale/(this.activeSettings.resolution*this.dynamicResolutionScale));}
  applySettings(settings:Settings,resetDynamic=false){this.activeSettings=settings;if(resetDynamic)this.dynamicResolutionScale=1;this.applyHardwareScale();const shadows={Low:1024,Medium:1536,High:2048,Ultra:4096};this.shadow.getShadowMap()?.resize(shadows[settings.quality]);this.pipeline.bloomEnabled=settings.quality!=='Low';this.pipeline.samples=settings.quality==='Ultra'?4:1;this.effects.apply(settings.quality,this.wasGarage);this.invalidateActiveMeshes();}
  setDynamicResolutionScale(scale:number){const next=clamp(scale,.7,1);if(Math.abs(next-this.dynamicResolutionScale)<1e-6)return;this.dynamicResolutionScale=next;this.applyHardwareScale();}
  graphicsState(){const requested=this.activeSettings?.resolution??1;return {dynamicScale:this.dynamicResolutionScale,requestedScale:requested,effectiveScale:requested*this.dynamicResolutionScale,width:this.engine.getRenderWidth(),height:this.engine.getRenderHeight(),effects:this.effects.snapshot()};}
  cameraState(){return {mode:this.cameraMode,obstructed:this.cameraObstructed,requestedDistance:this.cameraRequestedDistance,resolvedDistance:this.cameraResolvedDistance,currentDistance:this.cameraCurrentDistance};}
  update(vehicle:Vehicle,visual:CarVisual,settings:Settings,dt:number,garage:boolean,clock:number,wetness:number,alpha=1){
    if(this.wasGarage!==garage){this.effects.apply(settings.quality,garage);this.invalidateActiveMeshes();}
    const time=settings.time,lighting=drivingLighting(time,settings.weather),solar=lighting.solar,day=lighting.day,night=lighting.night,golden=solar.golden;
    this.ambient.intensity=garage?.35:lighting.ambientIntensity;Color3.LerpToRef(AMBIENT_DAY,AMBIENT_NIGHT,lighting.nightBlend,this.ambient.diffuse);Color3.LerpToRef(GROUND_DAY,GROUND_NIGHT,lighting.nightBlend,this.ambient.groundColor);
    Color3.LerpToRef(SUN_DAY,SUN_GOLD,golden,this.daylightColour);this.sun.intensity=garage?2.8:lighting.directIntensity;Color3.LerpToRef(this.daylightColour,MOON_LIGHT,lighting.nightBlend,this.sun.diffuse);this.scene.environmentIntensity=garage?.65:lighting.environmentIntensity;this.scene.environmentTexture=garage?(this.galleryEnvironment.isReady()?this.galleryEnvironment:this.studioEnvironment):this.outdoorEnvironment;
    this.scene.imageProcessingConfiguration.exposure=garage?1.1:lighting.exposure;
    if(garage)this.sun.direction.set(.55,-.6,-.65).normalize();else if(day>.04)this.sun.direction.set(-solar.direction.x,-Math.max(.02,solar.direction.y),-solar.direction.z).normalize();else this.sun.direction.set(solar.direction.x,Math.min(-.20,solar.direction.y),solar.direction.z).normalize();
    this.scene.fogColor.set(...atmosphereFog(time,settings.weather));this.scene.fogDensity=.00013+golden*.000025+wetness*.0006;
    this.sky.visibility=1;this.atmosphere.update(time,settings.weather,clock);
    if(this.showroom.isEnabled(false)!==garage)this.showroom.setEnabled(garage);
    this.registerCar(visual,garage||vehicle.state.grounded);
    // Planar reflection is confined to the gallery; driving never pays for this pass.
    if(garage&&(!this.wasGarage||!visual.parts.some(mesh=>this.floorReflection.renderList?.includes(mesh))))this.floorReflection.renderList=this.scene.meshes.filter(mesh=>mesh.isEnabled()&&mesh.isVisible&&mesh.name!=='car-contact-shadow'&&(mesh.metadata?.floorReflection||(()=>{let node=mesh.parent;while(node){if(node.metadata?.kairosCar)return true;node=node.parent;}return false;})()));
    else if(!garage&&this.wasGarage)this.floorReflection.renderList=[];
    this.studioLights.forEach(light=>{if(light.isEnabled()!==garage)light.setEnabled(garage);});const headlampsEnabled=!garage;this.headlights.forEach(light=>{if(light.isEnabled()!==headlampsEnabled)light.setEnabled(headlampsEnabled);});
    if(garage){visual.glass.alpha=.64;visual.glass.transparencyMode=PBRMaterial.PBRMATERIAL_ALPHABLEND;for(const n of visual.root.getChildTransformNodes())if(/brake-\d$/.test(n.name)){n.position.y=-.32;n.rotationQuaternion=null;n.rotation.set(0,0,0);}}
    this.headlights.forEach((light,i)=>{const f=new Vector3(Math.sin(vehicle.state.yaw),-.08,Math.cos(vehicle.state.yaw)),r=new Vector3(Math.cos(vehicle.state.yaw),0,-Math.sin(vehicle.state.yaw));light.position.copyFrom(vehicle.node.position).addInPlace(f.scale(vehicle.definition.length*.48)).addInPlace(r.scale(i===0?-.55:.55));light.direction.copyFrom(f);light.intensity=!garage&&this.lightsEnabled?(night>.72?650:1):0;});
    if(garage){const a=-.58+Math.sin(clock*.07)*.08;visual.wheels.forEach(w=>{w.position.y=-.32;w.rotation.set(0,0,0);w.rotationQuaternion=null;});visual.root.position.set(0,-1000+.105+visual.groundOffset,0);visual.root.rotationQuaternion=Quaternion.RotationYawPitchRoll(.2,0,0);this.camera.position.set(Math.sin(a)*8.5,-998.32,Math.cos(a)*8.5);this.camera.setTarget(new Vector3(0,-999.12,0));this.camera.fov=.59;this.sun.position.copyFrom(visual.root.position).subtractInPlace(this.sun.direction.scale(90));this.scene.fogDensity=.0003;this.wasGarage=true;}
    else{
      visual.root.position.copyFrom(Vector3.Lerp(vehicle.previousPosition,vehicle.node.position,alpha));visual.root.rotationQuaternion=Quaternion.Slerp(vehicle.previousRotation,vehicle.node.rotationQuaternion!,alpha);visual.update(vehicle.state);
      const p=visual.root.position,yaw=vehicle.state.yaw,forward=new Vector3(Math.sin(yaw),0,Math.cos(yaw));const mode=settings.camera;this.cameraMode=mode;this.cameraObstructed=false;this.cameraRequestedDistance=0;this.cameraResolvedDistance=0;
      let target=p.add(new Vector3(0,.65,0)),desired:Vector3;
      if(mode<2){const dist=mode===0?6.5:4.9;desired=p.subtract(forward.scale(dist)).add(new Vector3(0,mode===0?1.65:1.25,0));target=p.add(new Vector3(0,.38,0)).add(forward.scale(4.2));}
      else{
        // Mounts belong to the shared body, not the selected drivetrain profile.
        // Body-mounted views also follow pitch/roll on slopes and banked roads.
        const mounts=cameraMounts(vehicleById(visualModelId(vehicle.definition.id))),mount=mode===2?mounts.cockpit:mode===3?mounts.hood:mounts.bumper,matrix=visual.root.computeWorldMatrix(true);
        desired=Vector3.TransformCoordinates(new Vector3(mount.x,mount.y,mount.z),matrix);target=desired.add(Vector3.TransformNormal(new Vector3(0,0,30),matrix));
      }
      visual.glass.alpha=mode===2?.13:.64;visual.glass.transparencyMode=PBRMaterial.PBRMATERIAL_ALPHABLEND;
      const cameraOrigin=p.add(new Vector3(0,.8,0));
      if(mode<2){this.cameraRequestedDistance=Vector3.Distance(cameraOrigin,desired);const hit=vehicle.world.engine.raycast(cameraOrigin,desired,{collideWith:1});if(hit.hasHit){this.cameraObstructed=true;desired=Vector3.Lerp(cameraOrigin,hit.hitPointWorld,Math.max(.1,1-.25/Math.max(.25,hit.hitDistance)));}this.cameraResolvedDistance=Vector3.Distance(cameraOrigin,desired);}
      if(this.wasGarage||mode>=2||this.cameraObstructed||Vector3.Distance(this.cameraPosition,desired)>40){this.cameraPosition.copyFrom(desired);this.look.copyFrom(target);}else{Vector3.LerpToRef(this.cameraPosition,desired,1-Math.exp(-6*dt),this.cameraPosition);Vector3.LerpToRef(this.look,target,1-Math.exp(-10*dt),this.look);}
      this.cameraCurrentDistance=Vector3.Distance(cameraOrigin,this.cameraPosition);
      this.camera.position.copyFrom(this.cameraPosition);this.camera.setTarget(this.look);this.camera.fov=approach(this.camera.fov,.77+clamp(Math.abs(vehicle.state.speed)/120,0,.17),5,dt);this.sun.position.copyFrom(p).subtractInPlace(this.sun.direction.scale(90));this.wasGarage=false;
    }
    // Caster membership changes only as objects cross a wide 60–80 m band;
    // four refreshes per second keep moving transforms live while avoiding a
    // full scene/bounds scan on one frame in every six.
    const shadowMap=this.shadow.getShadowMap();if(shadowMap&&(clock-this.shadowSelectionAt>=.25||this.wasGarage!==garage)){this.shadowSelectionAt=clock;const p=visual.root.position;
      const scenery=this.scene.meshes.filter(m=>{if(!m.metadata?.worldCaster||!m.isVisible||!m.isEnabled())return false;const b=m.getBoundingInfo().boundingBox;return b.minimumWorld.x<p.x+80&&b.maximumWorld.x>p.x-80&&b.minimumWorld.z<p.z+80&&b.maximumWorld.z>p.z-80;});
      shadowMap.renderList=[...[...this.shadowParts].filter(m=>m.isEnabled()&&Vector3.DistanceSquared(m.getAbsolutePosition(),p)<3600),...scenery];
    }
    const rainy=settings.weather==='Rain',showRain=rainy&&!garage;if(this.rain.isEnabled()!==showRain){this.rain.setEnabled(showRain);this.invalidateActiveMeshes();}if(showRain){const p=this.camera.position;for(let i=0;i<250;i++){const offset=i*6,x=((i*7.31)%34)-17+p.x,z=((i*11.27)%34)-17+p.z,y=(((i*3.71-clock*24)%18)+18)%18+p.y-3;this.rainPositions[offset]=x;this.rainPositions[offset+1]=y;this.rainPositions[offset+2]=z;this.rainPositions[offset+3]=x-.15;this.rainPositions[offset+4]=y-1.05;this.rainPositions[offset+5]=z;}this.rain.updateVerticesData(VertexBuffer.PositionKind,this.rainPositions);this.rain.refreshBoundingInfo();}
  }
  render(){
    const count=this.scene.meshes.length;if(count!==this.activeMeshCount)this.activeMeshListDirty=true;
    if(this.activeMeshListDirty){
      if(this.scene._activeMeshesFrozen)this.scene.unfreezeActiveMeshes();
      // Keep the current render list but continue per-submesh frustum clipping.
      // Dynamic car transforms remain live because meshes themselves are not frozen.
      if(this.scene.isReady(false)){
        this.activeMeshListDirty=false;this.activeMeshCount=count;this.activeMeshRefreshes++;
        this.scene.freezeActiveMeshes(true,undefined,()=>{this.activeMeshListDirty=true;},false,true);
      }
    }
    this.scene.render();
  }
}
