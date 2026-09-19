import type { V3 } from './types';
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number) => a + (b-a)*t;
export const smooth = (v: number) => { const t=clamp(v,0,1); return t*t*(3-2*t); };
export const approach = (a: number, b: number, rate: number, dt: number) => lerp(a,b,1-Math.exp(-rate*dt));
export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
export const distance = (a: Pick<V3,'x'|'z'>, b: Pick<V3,'x'|'z'>) => Math.hypot(a.x-b.x,a.z-b.z);
export function rng(seed: number) { let t=seed; return () => { t+=0x6D2B79F5; let v=t; v=Math.imul(v^v>>>15,v|1); v^=v+Math.imul(v^v>>>7,v|61); return ((v^v>>>14)>>>0)/4294967296; }; }
export const hash = (x: number,z: number) => Math.abs((Math.imul(x,73856093)^Math.imul(z,19349663))|0);
export const formatTime = (s: number) => !Number.isFinite(s)||s<=0?'—':`${Math.floor(s/60)}:${(s%60).toFixed(3).padStart(6,'0')}`;
export function percentile(values: number[], p: number) { if(!values.length)return 0; const sorted=[...values].sort((a,b)=>a-b); return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]; }
