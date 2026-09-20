import {MaterialPluginBase,ShaderLanguage,type PBRMaterial,type MaterialDefines} from '@babylonjs/core';
import {LAKE} from '../content/world';

// Linear reflectances. The existing meadow texture supplies close-scale grain;
// world-space fields blend habitats without a repeating cell-sized splat map.
export const GROUND_PALETTE={
  grass:[.055,.092,.027],dry:[.145,.139,.064],forest:[.029,.046,.018],
  earth:[.135,.099,.057],stone:[.190,.184,.159],shore:[.174,.158,.115],
} as const;

export function groundShader(language:ShaderLanguage){
  const wgsl=language===ShaderLanguage.WGSL,vec2=wgsl?'vec2f':'vec2',vec3=wgsl?'vec3f':'vec3';
  const position=wgsl?'fragmentInputs.vPositionW':'vPositionW',color=wgsl?'fragmentInputs.vColor':'vColor';
  const local=(type:string,name:string,value:string)=>wgsl?`var ${name}: ${type} = ${value};`:`${type} ${name} = ${value};`;
  const scalar=(name:string,value:string)=>local(wgsl?'f32':'float',name,value);
  const palette=(name:keyof typeof GROUND_PALETTE)=>`${vec3}(${GROUND_PALETTE[name].map(v=>v.toFixed(3)).join(',')})`;
  const definitions=wgsl?`
fn kairosGroundHash(p: vec2f) -> f32 {
  var q=fract(vec3f(p.x,p.y,p.x)*0.1031);
  q+=dot(q,q.yzx+vec3f(33.33));
  return fract((q.x+q.y)*q.z);
}
fn kairosGroundNoise(p: vec2f) -> f32 {
  let i=floor(p); let f=fract(p); let u=f*f*(vec2f(3.0)-2.0*f);
  return mix(mix(kairosGroundHash(i),kairosGroundHash(i+vec2f(1.0,0.0)),u.x),
    mix(kairosGroundHash(i+vec2f(0.0,1.0)),kairosGroundHash(i+vec2f(1.0,1.0)),u.x),u.y);
}`:`
float kairosGroundHash(vec2 p) {
  vec3 q=fract(vec3(p.x,p.y,p.x)*0.1031);
  q+=dot(q,q.yzx+vec3(33.33));
  return fract((q.x+q.y)*q.z);
}
float kairosGroundNoise(vec2 p) {
  vec2 i=floor(p),f=fract(p),u=f*f*(vec2(3.0)-2.0*f);
  return mix(mix(kairosGroundHash(i),kairosGroundHash(i+vec2(1.0,0.0)),u.x),
    mix(kairosGroundHash(i+vec2(0.0,1.0)),kairosGroundHash(i+vec2(1.0,1.0)),u.x),u.y);
}`;
  const shade=`
#ifdef KAIROS_GROUND
#ifdef KAIROS_GROUND_FLOOR
if(max(abs(${position}.x),abs(${position}.z))<2176.0) {
#endif
${local(vec2,'kgP',`${position}.xz`)}
${scalar('kgBroad',`kairosGroundNoise(kgP*0.018)`)}
${scalar('kgPatch',`kairosGroundNoise(kgP*0.145+${vec2}(21.7,9.2))`)}
${scalar('kgFine',`kairosGroundNoise(kgP*0.63)`)}
${scalar('kgEdge','24.0')}
${scalar('kgForest',`smoothstep(570.0,930.0,kgP.y)*(1.0-smoothstep(500.0,920.0,kgP.x))*smoothstep(-490.0,-270.0,kgP.x)`)}
${scalar('kgDry','smoothstep(0.26,0.80,kgBroad)')}
#ifndef KAIROS_GROUND_FLOOR
#ifdef VERTEXCOLOR
kgEdge=${color}.r*24.0;
kgForest=${color}.g;
#endif
#endif
${scalar('kgEarth','1.0-smoothstep(0.15,3.1,kgEdge+(kgPatch-0.5)*2.4)')}
${scalar('kgRock','smoothstep(0.14,0.42,1.0-abs(geometricNormalW.y))')}
${scalar('kgShore',`(length((kgP-${vec2}(${LAKE.x.toFixed(1)},${LAKE.z.toFixed(1)}))/${vec2}(${LAKE.rx.toFixed(1)},${LAKE.rz.toFixed(1)}))-1.0)*${LAKE.rx.toFixed(1)}`)}
${scalar('kgSand','(1.0-smoothstep(2.0,11.0,kgShore+(kgPatch-0.5)*3.0))*(1.0-kgRock)')}
${scalar('kgMicro','1.0')}
#if defined(ALBEDO) && !defined(KAIROS_GROUND_FLOOR)
kgMicro=clamp(dot(albedoTexture.rgb,${vec3}(0.333333))/0.464,0.80,1.20);
#endif
${local(vec3,'kgAlbedo',`mix(${palette('grass')},${palette('dry')},clamp(kgDry*0.85+(kgPatch-0.5)*0.28,0.0,1.0))`)}
kgAlbedo=mix(kgAlbedo,${palette('forest')}*(0.80+kgBroad*0.35),kgForest*0.68);
kgAlbedo=mix(kgAlbedo,${palette('earth')},kgEarth);
kgAlbedo=mix(kgAlbedo,${palette('shore')},kgSand*0.80);
kgAlbedo=mix(kgAlbedo,${palette('stone')}*(0.72+kgPatch*0.45),kgRock);
surfaceAlbedo=kgAlbedo*(0.88+kgPatch*0.18+kgFine*0.08)*kgMicro*${wgsl?'uniforms.':''}vAlbedoColor.rgb;
#ifdef KAIROS_GROUND_FLOOR
}
#endif
#endif`;
  return {CUSTOM_FRAGMENT_DEFINITIONS:definitions,CUSTOM_FRAGMENT_BEFORE_LIGHTS:shade};
}

/** Keeps standard PBR sun, shadows, headlamps and fog in both native backends.
 * No new texture, mesh, render pass or per-frame uniform is allocated. */
export class GroundMaterial extends MaterialPluginBase {
  constructor(material:PBRMaterial,private readonly floor=false){
    super(material,'KairosGround',195,{KAIROS_GROUND:true,KAIROS_GROUND_FLOOR:floor},true,true);
  }
  override isCompatible(language:ShaderLanguage){return language===ShaderLanguage.GLSL||language===ShaderLanguage.WGSL;}
  override prepareDefines(defines:MaterialDefines){defines.KAIROS_GROUND=true;defines.KAIROS_GROUND_FLOOR=this.floor;}
  override getCustomCode(type:string,language=ShaderLanguage.GLSL){return type==='fragment'?groundShader(language):null;}
}
