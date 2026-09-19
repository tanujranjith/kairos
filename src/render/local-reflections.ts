import { ReflectionProbe, RenderTargetTexture, SphericalPolynomial, Vector3, type Scene, type AbstractMesh, type PBRMaterial, type TransformNode } from '@babylonjs/core';
import type { Quality } from '../core/types';
import { needsReflection, reflectionProfile, type ReflectionSample } from './detail-policy';

/** A single bounded local capture, never recursively reflected into itself. */
export class LocalReflections {
  private probe:ReflectionProbe|null=null;
  private buffers:ReflectionProbe[]=[];private displayed:ReflectionProbe|null=null;private pendingFace=-1;private faceSubmissions=0;
  private previous:ReflectionSample|undefined;
  private bound=new Set<PBRMaterial>();
  private size=0;private ready=false;private started=0;
  private captures=0;private lastCpuMs=0;private triangles=0;private signature='';
  constructor(private scene:Scene){scene.onDisposeObservable.addOnce(()=>this.dispose());}
  private create(size:number){
    this.releaseProbe();this.size=size;
    for(let index=0;index<2;index++){
      const probe=new ReflectionProbe(`kairos-local-reflection-${index}`,size,this.scene,true,true,true);this.buffers.push(probe);
      probe.refreshRate=RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
      probe.cubeTexture.renderParticles=false;probe.cubeTexture.renderSprites=false;probe.samples=1;
      // Diffuse ambient stays authored: no readback may outlive a resized texture.
      const diffuse=new SphericalPolynomial();for(const coefficient of [diffuse.xx,diffuse.yy,diffuse.zz])coefficient.set(.14,.16,.19);
      probe.cubeTexture.sphericalPolynomial=diffuse;
      let currentFace=-1;
      probe.cubeTexture.onBeforeRenderObservable.add(face=>{currentFace=face;});
      probe.cubeTexture.getCustomRenderList=face=>this.probe===probe&&face===this.pendingFace?null:[];
      // Keep the five untouched faces. Only one face has geometry/clear work per displayed frame.
      probe.cubeTexture.onClearObservable.add(engine=>{if(this.probe===probe&&currentFace===this.pendingFace)engine.clear(this.scene.clearColor,true,true,true);});
      probe.cubeTexture.onBeforeBindObservable.add(()=>{this.started=performance.now();});
      probe.cubeTexture.onAfterUnbindObservable.add(()=>{
        if(this.probe!==probe||this.pendingFace<0)return;
        this.lastCpuMs=performance.now()-this.started;
        // Shader warm-up can skip a mesh. Retry that face rather than publish a hole.
        if(!probe.renderList?.every(mesh=>mesh.isDisposed()||mesh.isReady(true)))return;
        this.faceSubmissions++;
        if(++this.pendingFace<6)return;
        this.pendingFace=-1;this.ready=true;this.captures++;this.displayed=probe;
        const target=this.scene.customRenderTargets.indexOf(probe.cubeTexture);if(target>=0)this.scene.customRenderTargets.splice(target,1);
      });
    }
    this.probe=this.buffers[0];
  }
  update(sample:ReflectionSample,quality:Quality,materials:PBRMaterial[]){
    const profile=reflectionProfile(quality);
    if(this.size!==profile.size||!this.probe)this.create(profile.size);
    for(const material of this.bound)if(!materials.includes(material))material.reflectionTexture=null;
    this.bound=new Set(materials);
    // Cars deliberately use the analytic sky until a complete local cube is available.
    for(const material of materials)material.reflectionTexture=this.ready?this.displayed!.cubeTexture:null;
    if(this.pendingFace>=0){
      const moved=this.previous&&Math.hypot(sample.position.x-this.previous.position.x,sample.position.y-this.previous.position.y,sample.position.z-this.previous.position.z)>128;
      if(this.previous?.garage===sample.garage&&!moved){this.probe!.cubeTexture.resetRefreshCounter();return;}
      // A scene transition supersedes an unfinished capture, without publishing partial faces.
      const target=this.scene.customRenderTargets.indexOf(this.probe!.cubeTexture);if(target>=0)this.scene.customRenderTargets.splice(target,1);
      this.pendingFace=-1;this.previous=undefined;
    }
    if(this.previous&&this.previous.garage===sample.garage&&Math.hypot(sample.position.x-this.previous.position.x,sample.position.y-this.previous.position.y,sample.position.z-this.previous.position.z)<=128&&sample.clock-this.previous.clock<profile.interval)return;
    const position=new Vector3(sample.position.x,sample.position.y+.45,sample.position.z);
    const distance=(mesh:AbstractMesh)=>{mesh.computeWorldMatrix();const box=mesh.getBoundingInfo().boundingBox;return Math.hypot(Math.max(box.minimumWorld.x-position.x,0,position.x-box.maximumWorld.x),Math.max(box.minimumWorld.y-position.y,0,position.y-box.maximumWorld.y),Math.max(box.minimumWorld.z-position.z,0,position.z-box.maximumWorld.z));};
    const excluded=(mesh:AbstractMesh)=>{let node:TransformNode|null=mesh;while(node){if(node.metadata?.kairosCar)return true;node=node.parent as TransformNode|null;}return false;};
    const background=(mesh:AbstractMesh)=>mesh.infiniteDistance||mesh.metadata?.environmentBackground;
    const candidates=this.scene.meshes.filter(mesh=>mesh.isEnabled()&&mesh.isVisible&&mesh.visibility>0&&mesh.getTotalIndices()>0&&!excluded(mesh)&&mesh.name!=='rain'&&!/floor-joint|floor-inlay/.test(mesh.name)&&(background(mesh)||distance(mesh)<100));
    candidates.sort((a,b)=>(background(a)?-1:distance(a))-(background(b)?-1:distance(b)));
    const list:AbstractMesh[]=[];let triangles=0;
    for(const mesh of candidates){const cost=mesh.getTotalIndices()/3*Math.max(1,mesh.hasThinInstances?(mesh as import('@babylonjs/core').Mesh).thinInstanceCount:1);if(list.length>=profile.meshes||triangles+cost>profile.triangles)continue;list.push(mesh);triangles+=cost;}
    // Late-arriving scenery should replace an early, mostly sky-only capture.
    const signature=list.map(m=>m.uniqueId).join(',');
    const next={...sample,stamp:sample.stamp+':'+signature};
    if(!needsReflection(this.previous,next,quality))return;
    const probe=this.probe=this.buffers.find(p=>p!==this.displayed)!;
    this.previous={...next,position:{...sample.position}};this.signature=signature;this.triangles=triangles;
    probe.position.copyFrom(position);probe.renderList=list;
    probe.cubeTexture.boundingBoxPosition.copyFrom(position);
    // Box projection is useful indoors. Outdoors a large box avoids obvious nearby parallax.
    probe.cubeTexture.boundingBoxSize=new Vector3(sample.garage?42:220,sample.garage?18:220,sample.garage?34:220);
    this.pendingFace=0;this.scene.customRenderTargets.push(probe.cubeTexture);
    probe.cubeTexture.resetRefreshCounter();
  }
  snapshot(){return {size:this.size,ready:this.ready,captures:this.captures,faceSubmissions:this.faceSubmissions,pendingFace:this.pendingFace,meshes:this.probe?.renderList?.length??0,trianglesPerFace:this.triangles,lastCpuSubmitMs:this.lastCpuMs,signature:this.signature};}
  private releaseProbe(){
    for(const material of this.bound)material.reflectionTexture=null;this.bound.clear();
    for(const probe of this.buffers){const index=this.scene.customRenderTargets.indexOf(probe.cubeTexture);if(index>=0)this.scene.customRenderTargets.splice(index,1);probe.dispose();}
    this.buffers=[];this.probe=null;this.displayed=null;this.pendingFace=-1;this.ready=false;this.previous=undefined;
  }
  dispose(){this.releaseProbe();}
}
