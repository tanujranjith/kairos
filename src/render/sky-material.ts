import {Mesh,MeshBuilder,ShaderLanguage,ShaderMaterial,Texture,Vector3,Vector4,type Scene} from '@babylonjs/core';
import type {Weather} from '../core/types';
import {CLOUD_ATLAS_SIZE,CLOUD_HORIZON,cloudAtlas,skyState} from './sky-field';
import {compressedTexture} from './compressed-texture';
import {textureAssetUrl} from './texture-version';

/** Native source for both engines. Input/output colours are linear; the existing
 * scene post-process owns exposure, ACES and display encoding exactly once. */
export function skyShaders(wgsl:boolean){
  const v2=wgsl?'vec2f':'vec2',v3=wgsl?'vec3f':'vec3',v4=wgsl?'vec4f':'vec4',u=wgsl?'uniforms.':'',d=wgsl?'fragmentInputs.skyDirection':'skyDirection';
  const local=(type:string,name:string,value:string)=>wgsl?`var ${name}: ${type} = ${value};`:`${type} ${name} = ${value};`;
  const scalar=(name:string,value:string)=>local(wgsl?'f32':'float',name,value);
  const sample=(uv:string)=>wgsl?`textureSample(cloudAtlas,cloudAtlasSampler,${uv})`:`texture2D(cloudAtlas,${uv})`;
  const body=`
${local(v3,'dir',`normalize(${d})`)}
${scalar('height','max(0.0,dir.y)')}
${scalar('day',`${u}skyParams.x`)}
${scalar('golden',`${u}skyParams.y`)}
${scalar('cover',`${u}skyParams.z`)}
${scalar('wind',`${u}skyParams.w`)}
${scalar('sunDot',`clamp(dot(dir,${u}skySun),0.0,1.0)`)}
${scalar('sunward',`pow(max(0.0,dot(normalize(dir.xz+${v2}(0.00001)),normalize(${u}skySun.xz))),4.0)`)}
${local(v3,'horizon',`mix(${v3}(0.40,0.57,0.76),${v3}(0.88,0.39,0.13),golden*(0.22+0.65*sunward)*(1.0-cover*0.75))`)}
${local(v3,'zenith',`mix(${v3}(0.025,0.14,0.34),${v3}(0.10,0.16,0.28),golden*0.5)`)}
${local(v3,'colour',`mix(horizon,zenith,pow(height,0.44))`)}
colour=mix(colour,${v3}(0.23,0.28,0.34)*(1.0-height*0.18),cover*0.70);
colour=mix(mix(${v3}(0.008,0.013,0.025),${v3}(0.002,0.004,0.010),pow(height,0.40)),colour,day);
colour+=${v3}(1.0,0.67,0.34)*pow(sunDot,85.0)*(0.10+golden*0.24)*day*(1.0-cover*0.85);

// Two world-direction cloud decks. Mip filtering handles distant compression;
// normalising the ray per fragment avoids the old dome-UV horizontal bands.
${local(v2,'uv',`dir.xz/max(${CLOUD_HORIZON.projectionMin.toFixed(3)},height)*0.145+${v2}(wind,wind*0.37)`)}
${local(v4,'field',sample('uv'))}
${scalar('erosion',`${sample(`uv*3.17+${v2}(0.31,0.53)`)}.g`)}
${scalar('threshold','0.67-cover*0.43')}
${scalar('mass','field.r+(erosion-0.5)*0.055')}
${scalar('density','smoothstep(threshold-0.045,threshold+0.135,mass)')}
${scalar('nearDensity',`smoothstep(threshold-0.045,threshold+0.135,${sample(`uv+normalize(${u}skySun.xz)*0.022`)}.r)`)}
${scalar('edgeLight','clamp((density-nearDensity)*2.1+0.38,0.0,1.0)')}
${scalar('thick','smoothstep(threshold+0.015,threshold+0.22,mass)')}
${scalar('alpha',`density*smoothstep(${CLOUD_HORIZON.fadeStart.toFixed(3)},${CLOUD_HORIZON.fadeEnd.toFixed(3)},height)`)}
${local(v3,'cloudColour',`mix(${v3}(0.29,0.35,0.43),${v3}(0.94,0.96,1.0),clamp(0.50+edgeLight*0.50-thick*0.42,0.0,1.0))`)}
cloudColour*=1.0-cover*0.51;
cloudColour=mix(cloudColour,${v3}(0.93,0.48,0.21)*(0.68+edgeLight*0.35),golden*(0.20+sunward*0.70)*(1.0-cover));
cloudColour=mix(${v3}(0.012,0.018,0.029)*(0.60+edgeLight*0.4),cloudColour,day);
${scalar('wisps',`smoothstep(0.54,0.73,${sample(`uv*${v2}(0.46,1.8)+${v2}(0.41,0.19)`)}.b)*0.22*(1.0-cover)*smoothstep(${CLOUD_HORIZON.fadeStart.toFixed(3)},0.28,height)`)}
colour=mix(colour,mix(${v3}(0.015,0.022,0.037),${v3}(0.68,0.77,0.88),day),wisps);
colour=mix(colour,cloudColour,alpha);

// Small angular sun with a soft aureole, naturally obscured by cloud coverage.
${scalar('sunDisc','smoothstep(0.999970,0.999985,sunDot)*day*(1.0-alpha*0.98)*(1.0-cover*0.75)')}
colour+=${v3}(7.0,5.2,3.0)*sunDisc;

// Sparse stable stars on a hemisphere projection, plus the opposite moon.
${local(v2,'starP','dir.xz/(1.0+abs(dir.y))*430.0')}
${local(v2,'starCell','floor(starP)')}
${scalar('starSeed','skyHash(starCell)')}
${local(v2,'starCentre',`${v2}(skyHash(starCell+${v2}(9.7,3.1)),skyHash(starCell+${v2}(4.2,18.9)))`)}
${scalar('star','(1.0-smoothstep(0.015,0.19,length(fract(starP)-starCentre)))*step(0.996,starSeed)')}
colour+=${v3}(0.42,0.49,0.65)*star*(1.0-day)*(1.0-alpha)*(1.0-cover)*smoothstep(0.02,0.25,height);
${scalar('moonDot',`max(0.0,dot(dir,-${u}skySun))`)}
${scalar('moonDisc','smoothstep(0.999965,0.999982,moonDot)*(1.0-day)*(1.0-alpha*0.97)*(1.0-cover*0.80)')}
colour+=${v3}(0.48,0.55,0.68)*moonDisc+${v3}(0.010,0.017,0.032)*pow(moonDot,100.0)*(1.0-day)*(1.0-cover);
${wgsl?'fragmentOutputs.color':'gl_FragColor'}=${v4}(max(colour,${v3}(0.0)),1.0);`;
  const vertex=wgsl?`attribute position: vec3f; uniform worldViewProjection: mat4x4f; varying skyDirection: vec3f;
@vertex fn main(input: VertexInputs)->FragmentInputs { vertexOutputs.position=uniforms.worldViewProjection*vec4f(vertexInputs.position,1.0); vertexOutputs.skyDirection=vertexInputs.position; }`:
`precision highp float; attribute vec3 position; uniform mat4 worldViewProjection; varying vec3 skyDirection;
void main(){gl_Position=worldViewProjection*vec4(position,1.0);skyDirection=position;}`;
  const fragment=wgsl?`varying skyDirection: vec3f; uniform skySun: vec3f; uniform skyParams: vec4f;
var cloudAtlasSampler: sampler; var cloudAtlas: texture_2d<f32>;
fn skyHash(p:vec2f)->f32 {var q=fract(vec3f(p.x,p.y,p.x)*0.1031);q+=dot(q,q.yzx+vec3f(33.33));return fract((q.x+q.y)*q.z);}
@fragment fn main(input: FragmentInputs)->FragmentOutputs {${body}}`:
`precision highp float; varying vec3 skyDirection; uniform vec3 skySun; uniform vec4 skyParams; uniform sampler2D cloudAtlas;
float skyHash(vec2 p){vec3 q=fract(vec3(p.x,p.y,p.x)*0.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
void main(){${body}}`;
  return {vertexSource:vertex,fragmentSource:fragment};
}

export class SkyDome {
  readonly mesh:Mesh;readonly material:ShaderMaterial;readonly atlas:Texture;
  private readonly sun=new Vector3();private readonly params=new Vector4();
  constructor(scene:Scene){
    const wgsl=scene.getEngine().isWebGPU;
    this.atlas=compressedTexture(scene,textureAssetUrl('/textures/cloud-density.ktx2'),'original-cloud-density',CLOUD_ATLAS_SIZE,CLOUD_ATLAS_SIZE,()=>cloudAtlas(),false);
    this.material=new ShaderMaterial('kairos-directional-sky',scene,skyShaders(wgsl),{attributes:['position'],uniforms:['worldViewProjection','skySun','skyParams'],samplers:['cloudAtlas'],shaderLanguage:wgsl?ShaderLanguage.WGSL:ShaderLanguage.GLSL});
    this.material.backFaceCulling=false;this.material.disableDepthWrite=true;this.material.setTexture('cloudAtlas',this.atlas);
    this.mesh=MeshBuilder.CreateSphere('atmosphere',{diameter:13000,segments:24,sideOrientation:Mesh.BACKSIDE},scene);
    this.mesh.infiniteDistance=true;this.mesh.isPickable=false;this.mesh.applyFog=false;this.mesh.material=this.material;this.update(12,'Clear',0);
  }
  update(time:number,weather:Weather,clock:number){
    const s=skyState(time,weather,clock);this.sun.set(s.sun.x,s.sun.y,s.sun.z);this.params.set(s.day,s.golden,s.cover,s.wind);
    this.material.setVector3('skySun',this.sun);this.material.setVector4('skyParams',this.params);
  }
}
