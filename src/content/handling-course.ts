import { clamp, smooth } from '../core/math';
import type { V3 } from '../core/types';

// Original authored proving ground. Rectangles are [minX, minZ, maxX, maxZ], meters.
export type Bounds = readonly [number, number, number, number];
export const HANDLING = {
  name: 'Northstar Handling Grounds',
  bounds: [-2000, 1710, -990, 1980] as Bounds,
  height: 18.05,
  spawn: { x: -1930, y: 18.05, z: 1940, yaw: Math.PI / 2 },
  skidpad: { x: -1140, z: 1845, radius: 55 },
  slalom: { x: -1890, z: 1878, spacing: 38, count: 12, amplitude: 4.5 },
  barrier: { x: -1250, z: 1940, width: 1.2, depth: 17, height: 1.15 },
} as const;

export interface HandlingFeature {
  id: 'bumps' | 'bank' | 'slope' | 'jump' | 'curb';
  name: string;
  bounds: Bounds;
  step: number;
}

export const HANDLING_FEATURES: HandlingFeature[] = [
  { id: 'bumps', name: 'Ride · 80 / 130 / 200 mm', bounds: [-1890, 1785, -1690, 1795], step: .4 },
  { id: 'bank', name: 'Banked road · 10°', bounds: [-1930, 1745, -1340, 1759], step: 4 },
  { id: 'slope', name: 'Gradient · 10%', bounds: [-1720, 1818, -1420, 1832], step: 2 },
  { id: 'jump', name: 'Launch ramp · 1 m', bounds: [-1540, 1785, -1528, 1795], step: .5 },
  { id: 'curb', name: 'Curb · 120 mm', bounds: [-1630, 1783, -1560, 1784.2], step: .4 },
];

export function insideBounds(x: number, z: number, bounds: Bounds, margin = 0) {
  return x >= bounds[0] - margin && x <= bounds[2] + margin
    && z >= bounds[1] - margin && z <= bounds[3] + margin;
}

export const inHandlingCourse = (x: number, z: number, margin = 0) => insideBounds(x, z, HANDLING.bounds, margin);

/** Clip terrain grid tiles at the pad boundary rather than leaving partial overlap. */
export function terrainOutsideHandling(bounds:Bounds):Bounds[]{
  const [x0,z0,x1,z1]=bounds,[hx0,hz0,hx1,hz1]=HANDLING.bounds;
  if(x1<=hx0||x0>=hx1||z1<=hz0||z0>=hz1)return [bounds];
  if(x0>=hx0&&x1<=hx1&&z0>=hz0&&z1<=hz1)return [];
  const xs=[x0,...[hx0,hx1].filter(x=>x>x0&&x<x1),x1].sort((a,b)=>a-b);
  const zs=[z0,...[hz0,hz1].filter(z=>z>z0&&z<z1),z1].sort((a,b)=>a-b),tiles:Bounds[]=[];
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++)if(!inHandlingCourse((xs[i]+xs[i+1])/2,(zs[j]+zs[j+1])/2))tiles.push([xs[i],zs[j],xs[i+1],zs[j+1]]);
  return tiles;
}

export function handlingTerrainBlend(x: number, z: number) {
  const [x0, z0, x1, z1] = HANDLING.bounds;
  const outside = Math.max(x0 - x, x - x1, z0 - z, z - z1, 0);
  return 1 - smooth(outside / 32);
}

/** Height above the flat pad. The renderer and validation rig use this same definition. */
export function featureHeight(feature: HandlingFeature, x: number, z: number) {
  const [x0, z0, x1, z1] = feature.bounds;
  if (!insideBounds(x, z, feature.bounds)) return 0;
  if (feature.id === 'bumps') {
    const centers = [-1860, -1800, -1740], heights = [.08, .13, .20];
    return centers.reduce((h, center, i) => {
      const distance = Math.abs(x - center);
      return Math.max(h, distance < 1.8 ? heights[i] * .5 * (1 + Math.cos(distance / 1.8 * Math.PI)) : 0);
    }, 0);
  }
  if (feature.id === 'bank') {
    const blend = smooth(Math.min((x - x0) / 45, (x1 - x) / 45));
    return blend * (1.5 + (z - (z0 + z1) / 2) * Math.tan(Math.PI / 18));
  }
  if (feature.id === 'slope') return Math.min(12, (x - x0) * .10, (x1 - x) * .10);
  if (feature.id === 'jump') return (x - x0) / (x1 - x0);
  const lateral = Math.min((z - z0) / .3, (z1 - z) / .3, 1);
  const entry = Math.min((x - x0) / 2, (x1 - x) / 2, 1);
  return .12 * clamp(lateral, 0, 1) * clamp(entry, 0, 1);
}

export function handlingHeight(x: number, z: number) {
  return HANDLING.height + HANDLING_FEATURES.reduce((h, feature) => Math.max(h, featureHeight(feature, x, z)), 0);
}

export const handlingSpawn = (x: number, z: number, yaw = Math.PI / 2): V3 & { yaw: number } =>
  ({ x, z, y: handlingHeight(x, z), yaw });

export const HANDLING_LABELS = [
  { x: -1950, z: 1953, name: 'NORTHSTAR · ACCELERATION / BRAKING' },
  { x: -1930, z: 1889, name: 'SLALOM · 38 M CONE SPACING' },
  { x: -1900, z: 1804, name: 'RIDE · BUMPS / CURB / LAUNCH' },
  { x: -1727, z: 1838, name: 'GRADIENT · 10 PERCENT' },
  { x: -1940, z: 1764, name: 'BANKING · 10 DEGREES' },
  { x: -1217, z: 1923, name: 'SKIDPAD · 35 / 55 / 70 M' },
];
