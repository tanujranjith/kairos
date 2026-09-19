import type { Road } from '../core/types';

export interface JunctionDefinition {
  id:string; x:number; z:number; roads:string[]; control:'signal'|'priority'|'merge'|'turnaround';
  priority:string[]; radius:number; layer:string; signalGroups?:string[][]; offset?:number;
}
const junction=(id:string,x:number,z:number,roads:string[],priority:string[],control:JunctionDefinition['control']='priority',radius=18):JunctionDefinition=>
  ({id,x,z,roads,priority,control,radius,layer:'surface'});

/** Authored connectivity. Spatial proximity alone never grants a turn connection. */
export const ROAD_JUNCTIONS:JunctionDefinition[]=[
  junction('orchard-west',-1520,-1450,['ring','south'],['ring'],'merge',24),
  junction('foundry-west',-1780,-400,['ring','crossway','industrial'],['ring','crossway'],'priority',24),
  junction('lake-west',-1750,350,['ring','northbridge'],['ring'],'merge',24),
  junction('northstar-access',-650,1660,['ring','lakeshore','testaccess'],['ring'],'priority',24),
  junction('pinecrest-north',380,1690,['ring','forest'],['ring'],'merge',24),
  junction('ridgeway-north',1310,1340,['ring','pass','northbridge'],['ring'],'priority',24),
  junction('expressway-east',1790,-350,['ring','crossway'],['ring'],'merge',24),
  junction('orchard-east',650,-1750,['ring','south'],['ring'],'merge',24),
  junction('orchard-lakeshore',-650,-1120,['south','lakeshore'],['lakeshore']),
  junction('lakeshore-expressway',-410,-480,['crossway','lakeshore','industrial'],['crossway'],'priority',24),
  junction('lake-east',-350,650,['northbridge','lakeshore','forest'],['lakeshore']),
  junction('ridgeway-south',340,-350,['crossway','pass'],['crossway'],'merge',24),
  junction('aster-access',1050,-210,['crossway','circuitlink'],['crossway'],'merge',24),
  junction('aster-paddock-gate',510,-1450,['circuitlink','circuit','pit'],['circuit'],'priority',28),
  {...junction('westbrook-cedar',-1340,-940,['city1','city3'],[],'signal'),signalGroups:[['city1'],['city3']],offset:0},
  {...junction('westbrook-harbor',-960,-940,['city1','city4'],[],'signal'),signalGroups:[['city1'],['city4']],offset:5},
  {...junction('market-cedar',-1400,-1200,['city2','city3'],[],'signal'),signalGroups:[['city2'],['city3']],offset:8},
  {...junction('market-harbor',-980,-1190,['city2','city4'],[],'signal'),signalGroups:[['city2'],['city4']],offset:13},
  junction('foundry-cedar',-1300,-620,['industrial','city3'],['industrial']),
  junction('foundry-harbor',-960,-840,['industrial','city4'],['industrial']),
  junction('cedar-expressway',-1250,-370,['crossway','city3'],['crossway'],'merge',24),
  junction('lakeshore-parkway',-835,-1683,['ring','lakeshore'],['ring'],'merge',24),
  junction('harbor-parkway',-1068,-1640,['ring','city4'],['ring'],'merge',24),
  junction('harbor-expressway',-904,-402,['crossway','city4'],['crossway'],'merge',34),
  junction('ridgeway-crossing',970,1037,['northbridge','pass'],['northbridge']),
  junction('orchard-market',-881,-1187,['south','city2'],['south']),
  junction('orchard-cedar',-1425,-1416,['south','city3'],['south']),
  junction('orchard-harbor',-995,-1242,['south','city4'],['south']),
];

/** Cul-de-sacs have physical turning pads; private service roads exclude ambient traffic. */
export const ROAD_TERMINALS=[
  {roadId:'lakeshore',end:'start'},
  {roadId:'city1',end:'start'},{roadId:'city1',end:'end'},
  {roadId:'city2',end:'start'},{roadId:'city2',end:'end'},
  {roadId:'city3',end:'start'},
  {roadId:'testaccess',end:'end'},
] as const;
export const PRIVATE_TRAFFIC_ROADS=new Set(['testaccess','circuitlink','circuit','pit']);
export function resolveJunctions(roads:Road[]):JunctionDefinition[]{
  const pitEnd=roads.find(r=>r.id==='pit')?.points.at(-1);
  return [...ROAD_JUNCTIONS,...(pitEnd?[junction('aster-pit-exit',pitEnd.x,pitEnd.z,['pit','circuit'],['circuit'],'merge',14)]:[]),...ROAD_TERMINALS.map(terminal=>{
    const road=roads.find(r=>r.id===terminal.roadId)!;
    const p=terminal.end==='start'?road.points[0]:road.points.at(-1)!;
    return {id:`terminal-${terminal.roadId}-${terminal.end}`,x:p.x,z:p.z,roads:[road.id],control:'turnaround' as const,priority:[],radius:12,layer:'surface'};
  })];
}
