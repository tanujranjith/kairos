import {readFileSync,readdirSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {ENVIRONMENT_ASSET_VERSION,MODEL_ASSET_VERSION,galleryEnvironmentUrl,modelAssetUrl} from '../src/render/asset-version';

interface HeaderRule {source:string;headers:{key:string;value:string}[]}
interface VercelConfig {framework:string;installCommand:string;buildCommand:string;outputDirectory:string;headers:HeaderRule[]}

const config=JSON.parse(readFileSync('vercel.json','utf8')) as VercelConfig;
const cache=(source:string)=>config.headers.find(rule=>rule.source===source)?.headers.find(header=>header.key==='Cache-Control')?.value;
const header=(source:string,key:string)=>config.headers.find(rule=>rule.source===source)?.headers.find(item=>item.key===key)?.value;

describe('static delivery configuration',()=>{
  it('builds the pinned Vite project into dist',()=>{
    expect(config.framework).toBe('vite');
    expect(config.installCommand).toBe('npm ci');
    expect(config.buildCommand).toBe('npm run build');
    expect(config.outputDirectory).toBe('dist');
  });

  it('revalidates the shell and makes only fingerprinted runtime payloads immutable',()=>{
    expect(cache('/')).toBe('public, max-age=0, must-revalidate');
    expect(cache('/index.html')).toBe('public, max-age=0, must-revalidate');
    for(const source of ['/assets/(.*)','/models/(.*)\\.glb','/textures/(.*)\\.ktx2','/environment/(.*)\\.env']){
      expect(cache(source)).toBe('public, max-age=31536000, immutable');
    }
    expect(MODEL_ASSET_VERSION).toMatch(/^3-/);
    expect(ENVIRONMENT_ASSET_VERSION).toMatch(/^[a-f0-9]{12}$/);
    expect(modelAssetUrl('velara',0)).toContain(`?v=${MODEL_ASSET_VERSION}`);
    expect(galleryEnvironmentUrl()).toContain(`?v=${ENVIRONMENT_ASSET_VERSION}`);
  });

  it('keeps baseline response hardening on every route',()=>{
    expect(header('/(.*)','X-Content-Type-Options')).toBe('nosniff');
    expect(header('/(.*)','Referrer-Policy')).toBe('no-referrer');
    expect(header('/(.*)','Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
  });

  it('does not ship a service worker',()=>{
    expect(readdirSync('public',{recursive:true}).map(String).some(path=>/service-worker|sw\.js$/i.test(path))).toBe(false);
  });
});
