import {describe,it,expect} from 'vitest';
import config from '../vite.config';

describe('development source watcher',()=>{
  it('excludes generated output on both path conventions without ignoring source or models',()=>{
    const ignore=config.server?.watch?.ignored;
    expect(ignore).toBeInstanceOf(RegExp);if(!(ignore instanceof RegExp))throw new Error('Expected explicit path exclusion');
    for(const path of ['output','output/report.json','D:/work/Kairos/output/check/report.json','D:\\work\\Kairos\\output\\check\\report.json'])expect(ignore.test(path)).toBe(true);
    for(const path of ['src/app.ts','src/tools/output-check.ts','public/models/velara-lod0.glb','D:/work/Kairos/src/render/world.ts'])expect(ignore.test(path)).toBe(false);
  });
});
