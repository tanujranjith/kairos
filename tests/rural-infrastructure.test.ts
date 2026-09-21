import {describe,it,expect} from 'vitest';
import {CELL_SIZE,JUNCTIONS,inLake,junctionRadius,nearestRoad,terrainHeight} from '../src/content/world';
import {ruralInfrastructure,farmSilos} from '../src/world/rural-infrastructure';
import {buildCellBlueprint} from '../src/world/cell-blueprint';

describe('streamed rural infrastructure',()=>{
  it('owns finite original props and farm clusters in exactly one cell',()=>{
    let props=0,farms=0,poles=0,wires=0,fences=0;
    for(let cx=-9;cx<=8;cx++)for(let cz=-9;cz<=8;cz++){
      const data=ruralInfrastructure(cx,cz);expect(data).toEqual(ruralInfrastructure(cx,cz));
      for(const p of data.props){expect(Math.floor(p.x/CELL_SIZE)).toBe(cx);expect(Math.floor(p.z/CELL_SIZE)).toBe(cz);expect([p.x,p.y,p.z,p.width,p.height,p.depth,p.yaw].every(Number.isFinite)).toBe(true);expect(p.width).toBeGreaterThan(0);expect(p.height).toBeGreaterThan(0);expect(p.depth).toBeGreaterThan(0);expect(inLake(p.x,p.z)).toBe(false);expect(JUNCTIONS.every(j=>Math.hypot(j.x-p.x,j.z-p.z)>=junctionRadius(j)+13)).toBe(true);props++;if(p.kind==='utility-pole')poles++;if(p.kind==='wire')wires++;if(p.kind.startsWith('fence'))fences++;}
      for(const farm of data.farms){expect(Math.floor(farm.x/CELL_SIZE)).toBe(cx);expect(Math.floor(farm.z/CELL_SIZE)).toBe(cz);expect(Math.abs(farm.y-terrainHeight(farm.x,farm.z))).toBeLessThan(1e-8);expect(nearestRoad(farm.x,farm.z).distance).toBeGreaterThan(70);
        const silos=farmSilos(farm);expect(silos).toHaveLength(2);for(const silo of silos){expect(Object.values(silo).every(Number.isFinite)).toBe(true);expect(Math.abs(silo.y-terrainHeight(silo.x,silo.z))).toBeLessThan(1e-8);expect(silo.radius).toBeGreaterThan(2);expect(silo.height).toBeGreaterThan(7);expect(nearestRoad(silo.x,silo.z).distance).toBeGreaterThan(50);}farms++;}
    }
    expect(props).toBeGreaterThan(1000);expect(poles).toBeGreaterThan(80);expect(wires).toBeGreaterThan(400);expect(fences).toBeGreaterThan(500);expect(farms).toBe(5);
  });
  it('merges infrastructure into detail batches without adding collision surfaces',()=>{
    const occupied:{cx:number;cz:number;props:number;farms:number}[]=[];
    for(let cx=-9;cx<=8;cx++)for(let cz=-9;cz<=8;cz++){const data=ruralInfrastructure(cx,cz);if(data.props.length||data.farms.length)occupied.push({cx,cz,props:data.props.length,farms:data.farms.length});}
    expect(occupied.length).toBeGreaterThan(15);
    const samples=[...occupied.filter(c=>c.props),...occupied.filter(c=>c.farms)].filter((c,i,a)=>a.findIndex(v=>v.cx===c.cx&&v.cz===c.cz)===i).slice(0,6);
    for(const sample of samples){const blueprint=buildCellBlueprint(sample.cx,sample.cz,'Low'),detail=blueprint.meshes.find(m=>m.name.startsWith('rural-infrastructure'));if(sample.props){expect(detail).toBeDefined();expect(detail!.material).toBe('trunk');expect(detail!.collision).toBe(false);expect(detail!.data.positions.length).toBeGreaterThan(0);}}
  });
});
