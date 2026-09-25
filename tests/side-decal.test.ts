import {describe,it,expect} from 'vitest';
import {NullEngine,Scene,MeshBuilder,StandardMaterial,PBRMaterial} from '@babylonjs/core';
import {panelDecal} from '../src/render/panel-stripe';
import {finishCarLens} from '../src/render/car-materials';
describe('continuous projected panel gaps',()=>{
  it('clips to the correct side with finite outward geometry and no opposite-face duplication',()=>{
    const engine=new NullEngine(),scene=new Scene(engine),body=MeshBuilder.CreateBox('body',{width:2,height:1,depth:4},scene),material=new StandardMaterial('gap',scene);
    try{for(const side of [-1,1]){
      const decal=panelDecal(scene,'gap',body,material,[[-.3,-.5],[.3,-.5],[.3,-.494],[-.3,-.494]],.003,side),p=decal.getVerticesData('position')!,n=decal.getVerticesData('normal')!;
      expect(p.length).toBeGreaterThan(8);expect(p.every(Number.isFinite)).toBe(true);expect(n.every(Number.isFinite)).toBe(true);
      for(let i=0;i<p.length;i+=3){expect(p[i]).toBeCloseTo(side*1.003,5);expect(p[i+1]).toBeGreaterThanOrEqual(-.30001);expect(p[i+1]).toBeLessThanOrEqual(.30001);expect(n[i]*side).toBeGreaterThan(.99);}
    }}finally{scene.dispose();engine.dispose();}
  });
  it('interpolates smooth panel normals through clipping instead of faceting reflective lenses',()=>{
    const engine=new NullEngine(),scene=new Scene(engine),body=MeshBuilder.CreateGround('curved-skin',{width:2,height:2,subdivisions:2},scene),material=new StandardMaterial('lens',scene);
    try{
      const p=body.getVerticesData('position')!,normals=p.map((_,i)=>{const x=p[i-i%3],length=Math.hypot(x*.4,1);return i%3===0?x*.4/length:i%3===1?1/length:0;});body.setVerticesData('normal',normals);
      const decal=panelDecal(scene,'lens',body,material,[[-.6,-.5],[.6,-.5],[.6,.5],[-.6,.5]]),n=decal.getVerticesData('normal')!;
      expect(Math.min(...n.filter((_,i)=>i%3===0))).toBeLessThan(-.1);expect(Math.max(...n.filter((_,i)=>i%3===0))).toBeGreaterThan(.1);
      for(let i=0;i<n.length;i+=3)expect(Math.hypot(n[i],n[i+1],n[i+2])).toBeCloseTo(1,5);
    }finally{scene.dispose();engine.dispose();}
  });
  it('limits clear-cover reflectance equally after import and fallback creation',()=>{
    const engine=new NullEngine(),scene=new Scene(engine),lens=new PBRMaterial('lens',scene);
    try{lens.clearCoat.isEnabled=true;finishCarLens(lens);expect(lens.alpha).toBe(.12);expect(lens.environmentIntensity).toBe(.18);expect(lens.metallic).toBe(0);expect(lens.clearCoat.isEnabled).toBe(false);}finally{scene.dispose();engine.dispose();}
  });
});
