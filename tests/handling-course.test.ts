import { describe, expect, it } from 'vitest';
import { HANDLING, HANDLING_FEATURES, featureHeight, handlingHeight, handlingTerrainBlend, inHandlingCourse, terrainOutsideHandling } from '../src/content/handling-course';
import { terrainHeight, LANDMARKS, RoadGraph } from '../src/content/world';
import { handlingMap } from '../src/ui/handling-map';

describe('Northstar authored handling course', () => {
  it('is inside the four-kilometre region and has a flat collision foundation', () => {
    for (const value of HANDLING.bounds) expect(Math.abs(value)).toBeLessThanOrEqual(2048);
    for (const [x, z] of [[-1930, 1940], [-1890, 1878], [-1140, 1845]]) {
      expect(inHandlingCourse(x, z)).toBe(true);
      expect(terrainHeight(x, z)).toBeCloseTo(HANDLING.height - .16);
      expect(handlingHeight(x, z)).toBe(HANDLING.height);
    }
    expect(handlingTerrainBlend(-2032, 1800)).toBe(0);
  });

  it('defines the actual 10 degree banking and 10 percent grade geometry', () => {
    const bank = HANDLING_FEATURES.find(f => f.id === 'bank')!;
    const slope = HANDLING_FEATURES.find(f => f.id === 'slope')!;
    expect((featureHeight(bank, -1700, 1754) - featureHeight(bank, -1700, 1750)) / 4).toBeCloseTo(Math.tan(Math.PI / 18));
    expect(featureHeight(slope, -1660, 1825) - featureHeight(slope, -1670, 1825)).toBeCloseTo(1);
    expect(featureHeight(bank, -1930, 1752)).toBe(0);
    expect(featureHeight(slope, -1420, 1825)).toBe(0);
  });

  it('builds measured bumps, a curb and a jump instead of cosmetic-only markers', () => {
    const bump = HANDLING_FEATURES.find(f => f.id === 'bumps')!;
    for (const [x, height] of [[-1860, .08], [-1800, .13], [-1740, .20]]) expect(featureHeight(bump, x, 1790)).toBeCloseTo(height);
    expect(handlingHeight(-1600, 1783.6) - HANDLING.height).toBeCloseTo(.12);
    expect(handlingHeight(-1528, 1790) - HANDLING.height).toBeCloseTo(1);
  });

  it('connects the public map to the course entrance', () => {
    const graph = new RoadGraph(), entrance = LANDMARKS.find(l => l.id === 'handling')!;
    const route = graph.route(LANDMARKS[0], entrance);
    expect(route.length).toBeGreaterThan(5);
    expect(Math.hypot(route.at(-1)!.x - entrance.x, route.at(-1)!.z - entrance.z)).toBeLessThan(25);
  });

  it('projects the proving ground and features into the map from their authored bounds', () => {
    const markup=handlingMap((x,z)=>`${x},${z}`);
    expect(markup).toContain('data-map-layer="handling"');
    expect(markup).toContain('-2000,1710 -990,1710 -990,1980 -2000,1980');
    for(const feature of HANDLING_FEATURES) expect(markup).toContain(`${feature.bounds[0]},${feature.bounds[1]}`);
    expect(markup).toContain('-1950,1940 -1270,1940');
  });

  it('clips partial terrain tiles precisely without road overlap or outside gaps',()=>{
    const tiles=terrainOutsideHandling([-2008,1704,-1992,1720]);
    const area=tiles.reduce((sum,[x0,z0,x1,z1])=>sum+(x1-x0)*(z1-z0),0);
    expect(area).toBe(16*16-8*10);
    for(const [x0,z0,x1,z1] of tiles)expect(inHandlingCourse((x0+x1)/2,(z0+z1)/2)).toBe(false);
    expect(terrainOutsideHandling([-1950,1900,-1934,1916])).toEqual([]);
    expect(terrainOutsideHandling([-2016,1700,-2000,1716])).toEqual([[-2016,1700,-2000,1716]]);
  });
});
