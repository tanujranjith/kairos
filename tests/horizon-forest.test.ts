import {describe,it,expect} from 'vitest';
import {ShaderLanguage} from '@babylonjs/core';
import {horizonTrees} from '../src/world/horizon-forest';
import {mountainHeight} from '../src/world/landscape';
import {groundShader} from '../src/render/ground-material';

describe('outer landscape completion',()=>{
  it('keeps every repeatable low-cost tree beyond driving cells and on its foothill',()=>{
    const trees=horizonTrees();expect(trees).toEqual(horizonTrees());expect(trees.length).toBeGreaterThan(1200);expect(trees.length*4).toBeLessThanOrEqual(6400);
    for(const t of trees){expect(Math.max(Math.abs(t.x),Math.abs(t.z))).toBeGreaterThanOrEqual(2600);expect(t.y).toBeCloseTo(mountainHeight(t.x,t.z)-1.8,8);expect(t.height).toBeGreaterThanOrEqual(18);expect(t.variant).toBeGreaterThanOrEqual(0);expect(t.variant).toBeLessThan(4);}
  });
  it.each([ShaderLanguage.GLSL,ShaderLanguage.WGSL])('shades geology only outside the existing ground-floor branch (%s)',language=>{
    const code=groundShader(language).CUSTOM_FRAGMENT_BEFORE_LIGHTS;
    expect(code).toContain('<2176.0');expect(code).toContain('} else {');expect(code).toContain('krSnow');expect(code).toContain('krForest');expect(code).not.toContain('textureSample');
  });
});
