import {Constants,SSAO2RenderingPipeline,SSRRenderingPipeline,type Scene,type Camera} from '@babylonjs/core';
import type {ThinSSAO2RenderingPipeline} from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/thinSSAO2RenderingPipeline';
import type {Quality} from '../core/types';
import {configureGeometryShader} from './geometry-shader';

export const effectProfile=(quality:Quality)=>({ao:quality==='High'||quality==='Ultra',reflections:quality==='Ultra',samples:quality==='Ultra'?16:8,ratio:quality==='Ultra'?.75:.5});

/** Higher presets alone own the extra geometry/occlusion/reflection passes.
 * Dispose them as a group: both effects share Babylon's geometry buffer. */
export class QualityEffects {
  private ao:SSAO2RenderingPipeline|null=null;
  private ssr:SSRRenderingPipeline|null=null;
  private quality:Quality|null=null;
  private garage=true;
  private fallback='';
  constructor(private scene:Scene,private camera:Camera,private finalPipeline:string){}
  apply(quality:Quality,garage=true){
    if(this.quality===quality&&this.garage===garage)return;
    this.dispose();this.quality=quality;this.garage=garage;this.fallback='';
    const profile=effectProfile(quality),manager=this.scene.postProcessRenderPipelineManager;
    if(!profile.ao)return;
    const caps=this.scene.getEngine().getCaps();
    if(!caps.drawBuffersExtension||!caps.textureHalfFloatRender){this.fallback='Extra effects unavailable on this GPU; using reflection probes.';return;}
    manager.detachCamerasFromRenderPipeline(this.finalPipeline,this.camera);
    try{
      configureGeometryShader();
      // The showroom already has a bounded planar floor reflection. Applying
      // SSR as well creates a second, screen-edge-clipped image of the car.
      if(profile.reflections&&!garage){
        this.ssr=new SSRRenderingPipeline('kairos-screen-reflections',this.scene,[this.camera],true,Constants.TEXTURETYPE_HALF_FLOAT);
        this.ssr.maxSteps=64;this.ssr.step=3;this.ssr.maxDistance=65;this.ssr.thickness=.25;
        this.ssr.ssrDownsample=1;this.ssr.blurDownsample=1;this.ssr.blurDispersionStrength=.035;
        this.ssr.strength=.7;this.ssr.reflectivityThreshold=.045;this.ssr.useFresnel=true;
        this.ssr.inputTextureColorIsInGammaSpace=false;this.ssr.generateOutputInGammaSpace=false;
      }
      this.ao=new SSAO2RenderingPipeline('kairos-contact-occlusion',this.scene,{ssaoRatio:profile.ratio,blurRatio:1},[this.camera],true,Constants.TEXTURETYPE_HALF_FLOAT);
      // Pinned 9.27.1 assigns this only when its preceding color-copy shader
      // draws. On a cached WebGPU effect the AO shader can be ready first;
      // bind() then returns before setting randomSampler. Seed our sole camera
      // before the first frame instead of depending on shader compile order.
      const thin=(this.ao as unknown as {_thinSSAORenderingPipeline:ThinSSAO2RenderingPipeline})._thinSSAORenderingPipeline;
      thin.camera=this.camera;thin._ssaoPostProcess.updateEffect();
      this.ao.samples=profile.samples;this.ao.radius=.8;this.ao.totalStrength=.65;this.ao.base=.3;this.ao.maxZ=160;
      this.ao.bilateralSamples=8;this.ao.bilateralSoften=.25;this.ao.bilateralTolerance=.1;
      // The contact-shadow quad and glazing are blended surfaces, not solid
      // depth. Including them reflects/occludes their invisible rectangular
      // bounds. Alpha-tested foliage remains in the geometry buffer.
      const geometry=this.scene.geometryBufferRenderer;if(geometry)geometry.renderTransparentMeshes=false;
    }catch(error){this.dispose();this.quality=quality;this.fallback=`Extra effects unavailable: ${String(error)}`;console.warn(this.fallback);}
    finally{manager.attachCamerasToRenderPipeline(this.finalPipeline,this.camera);}
  }
  snapshot(){return {ambientOcclusion:!!this.ao,screenReflections:!!this.ssr,ready:(!this.ao||this.ao.isReady())&&(!this.ssr||this.ssr.isReady()),fallback:this.fallback};}
  dispose(){
    const owned=!!this.ao||!!this.ssr;
    this.ssr?.dispose();this.ssr=null;this.ao?.dispose();this.ao=null;
    if(owned)this.scene.disableGeometryBufferRenderer();
    this.quality=null;
  }
}
