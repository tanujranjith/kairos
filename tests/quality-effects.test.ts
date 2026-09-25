import {describe,it,expect} from 'vitest';
import {effectProfile} from '../src/render/quality-effects';
import {correctGeometryShader} from '../src/render/geometry-shader';
import {geometryPixelShaderWGSL} from '@babylonjs/core/ShadersWGSL/geometry.fragment';
describe('optional high-end rendering budgets',()=>{
  it('does not request extra passes on the laptop presets',()=>{for(const preset of ['Low','Medium'] as const){expect(effectProfile(preset).ao).toBe(false);expect(effectProfile(preset).reflections).toBe(false);}});
  it('enables bounded AO on High and reserves SSR for Ultra',()=>{expect(effectProfile('High')).toEqual({ao:true,reflections:false,samples:8,ratio:.5});expect(effectProfile('Ultra')).toEqual({ao:true,reflections:true,samples:16,ratio:.75});});
  it('uses the vec3 gamma conversion in the pinned WGSL geometry shader',()=>{const source=correctGeometryShader(geometryPixelShaderWGSL.shader);expect(source).not.toContain('color=toLinearSpaceVec4(color)');expect(source).toContain('color=toLinearSpaceVec3(color)');expect(correctGeometryShader(source)).toBe(source);});
});
