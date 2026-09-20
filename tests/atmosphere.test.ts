import {describe,it,expect} from 'vitest';
import {NullEngine,Scene} from '@babylonjs/core';
import {atmosphereFog,CLOUD_HORIZON,cloudAtlas,cloudCoverage,cloudNoise,skyState} from '../src/render/sky-field';
import {SkyDome,skyShaders} from '../src/render/sky-material';

describe('directional sky and original cloud atlas',()=>{
  it('fades both cloud layers before the horizon projection clamp can stretch them',()=>{
    expect(CLOUD_HORIZON.fadeStart).toBeGreaterThan(CLOUD_HORIZON.projectionMin);expect(CLOUD_HORIZON.fadeEnd).toBeGreaterThan(CLOUD_HORIZON.fadeStart);
    for(const native of [false,true])expect(skyShaders(native).fragmentSource.match(/smoothstep\(0\.085,/g)).toHaveLength(2);
  });
  it('desaturates storm haze while preserving clear-day and night fog',()=>{
    const day=atmosphereFog(12,'Clear'),rain=atmosphereFog(12,'Rain');expect(day).toEqual([.54,.66,.79]);
    expect(rain[2]-rain[0]).toBeLessThan((day[2]-day[0])*.4);expect(atmosphereFog(0,'Rain')).toEqual([.035,.05,.08]);
    for(const weather of ['Clear','Cloudy','Overcast','Rain'] as const)for(let time=0;time<24;time+=.25)expect(atmosphereFog(time,weather).every(v=>v>=0&&v<=1)).toBe(true);
  });
  it('wraps its cloud field continuously in both axes',()=>{
    for(const x of [-17.4,-.0001,0,2.81,15.9999])for(const y of [-9.1,0,3.45,17]){
      expect(cloudNoise(x,y,16)).toBeCloseTo(cloudNoise(x+16,y,16),10);
      expect(cloudNoise(x,y,16)).toBeCloseTo(cloudNoise(x,y-16,16),10);
    }
  });
  it('packs deterministic independent coverage, erosion and wisps',()=>{
    const pixels=cloudAtlas(64);expect(pixels).toEqual(cloudAtlas(64));expect(pixels).toHaveLength(64*64*4);
    for(let channel=0;channel<3;channel++){const values=pixels.filter((_,i)=>i%4===channel);expect(Math.max(...values)-Math.min(...values)).toBeGreaterThan(90);}
    expect(pixels.filter((_,i)=>i%4===3).every(v=>v===255)).toBe(true);
  });
  it('increases cloud coverage with weather without regenerating a field',()=>{
    const field=cloudAtlas(64).filter((_,i)=>i%4===0),means=(['Clear','Cloudy','Overcast','Rain'] as const).map(w=>field.reduce((sum,v)=>sum+cloudCoverage(v/255,skyState(12,w,0).cover),0)/field.length);
    expect(means[0]).toBeLessThan(.35);expect(means[1]).toBeGreaterThan(means[0]+.15);expect(means[2]).toBeGreaterThan(.85);expect(means[3]).toBeGreaterThanOrEqual(means[2]);
  });
  it('keeps the sky aligned with the light and continuous across midnight',()=>{
    for(let time=0;time<=24;time+=.25){const s=skyState(time,'Clear',4);expect(Math.hypot(s.sun.x,s.sun.y,s.sun.z)).toBeCloseTo(1,12);expect(s.day).toBeGreaterThanOrEqual(0);expect(s.day).toBeLessThanOrEqual(1);}
    expect(skyState(12,'Clear',0).day).toBe(1);expect(skyState(0,'Clear',0).day).toBe(0);
    expect(skyState(0,'Clear',0).moonVisibility).toBeGreaterThan(skyState(0,'Rain',0).moonVisibility);
    expect(skyState(24,'Clear',10).sun.y).toBeCloseTo(skyState(0,'Clear',10).sun.y,12);
  });
  it('provides native shader sources with direction-based clouds and one linear output',()=>{
    const gl=skyShaders(false),gpu=skyShaders(true);expect(gl.fragmentSource).toContain('texture2D');expect(gpu.fragmentSource).toContain('textureSample');
    for(const source of [gl.fragmentSource,gpu.fragmentSource]){expect(source).toContain('normalize(');expect(source).toContain('moonDisc');expect(source).toContain('sunDisc');expect(source).not.toContain('toGammaSpace');}
    expect(gpu.fragmentSource).not.toContain('gl_FragColor');expect(gl.fragmentSource).not.toContain('fragmentOutputs');
  });
  it('retains one mesh, material and atlas through day/weather updates',()=>{
    const engine=new NullEngine(),scene=new Scene(engine),sky=new SkyDome(scene),counts=()=>[scene.meshes.length,scene.materials.length,scene.textures.length],original=counts();
    try{const texture=sky.atlas.getInternalTexture();for(let i=0;i<240;i++)sky.update(i/10,(['Clear','Cloudy','Overcast','Rain'] as const)[i%4],i*10);
      expect(counts()).toEqual(original);expect(sky.atlas.getInternalTexture()).toBe(texture);expect(sky.mesh.getTotalIndices()/3).toBeLessThan(3000);expect(sky.mesh.isPickable).toBe(false);expect(sky.material.disableDepthWrite).toBe(true);
    }finally{scene.dispose();engine.dispose();}
  });
});
