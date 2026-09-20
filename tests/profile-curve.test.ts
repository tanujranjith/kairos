import {describe,it,expect} from 'vitest';
import {profileCurve} from '../src/render/profile-curve';
import {roadDesign} from '../src/render/road-design';
import {VEHICLES} from '../src/content/vehicles';
import {finishCarPaint} from '../src/render/car-materials';
import {NullEngine,Scene,PBRMaterial} from '@babylonjs/core';

describe('smooth non-uniform authored body profiles',()=>{
  it('interpolates every authored station without overshooting the local silhouette',()=>{
    for(const d of VEHICLES.filter(v=>v.class!=='FORMULA'))for(const channel of [1,2,3]){
      const points=roadDesign(d).stations.map(s=>[s[0],s[channel]] as const),curve=profileCurve(points);
      for(const [x,y]of points)expect(curve.at(x)).toBeCloseTo(y,10);
      for(let i=0;i<points.length-1;i++)for(let n=0;n<=40;n++){
        const x=points[i][0]+(points[i+1][0]-points[i][0])*n/40,v=curve.at(x),a=points[i][1],b=points[i+1][1];
        expect(v).toBeGreaterThanOrEqual(Math.min(a,b)-1e-10);expect(v).toBeLessThanOrEqual(Math.max(a,b)+1e-10);
      }
    }
  });
  it('keeps one physical tangent through unevenly spaced stations and flat runs',()=>{
    for(const points of [[[0,0],[.1,1],[2,2],[3,1],[3.2,1]],[[0,3],[.02,2],[.1,1],[4,0]]] as [number,number][][]){
      const curve=profileCurve(points);
      for(const [x]of points.slice(1,-1)){
        expect(Math.abs(curve.derivative(x-1e-8)-curve.derivative(x+1e-8))).toBeLessThan(.001);
        expect((curve.at(x+1e-7)-curve.at(x-1e-7))/2e-7).toBeCloseTo(curve.derivative(x),3);
      }
    }
  });
  it('retains linear/two-point profiles, bounded ends and rejects degenerate input',()=>{
    const curve=profileCurve([[0,1],[2,5]]);expect(curve.at(.5)).toBe(2);expect(curve.derivative(1)).toBe(2);expect(curve.at(-1)).toBe(1);expect(curve.at(4)).toBe(5);
    for(const points of [[],[[0,0]],[[0,0],[0,1]],[[0,0],[1,NaN]]] as [number,number][][])expect(()=>profileCurve(points)).toThrow(/stations/i);
  });
  it('applies the same layered paint response after import or procedural creation',()=>{
    const engine=new NullEngine(),scene=new Scene(engine),paint=new PBRMaterial('paint',scene);
    try{paint.metallic=.9;paint.clearCoat.roughness=0;finishCarPaint(paint);expect(paint.metallic).toBe(.46);expect(paint.roughness).toBe(.28);expect(paint.clearCoat.isEnabled).toBe(true);expect(paint.clearCoat.roughness).toBe(.13);expect(paint.environmentIntensity).toBe(.85);}finally{scene.dispose();engine.dispose();}
  });
});
