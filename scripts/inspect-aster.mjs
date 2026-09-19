import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
  const {ROADS,CIRCUIT,PIT,LANE_GRAPH,nearestRoad,pointAt,RoadGraph,landmarkPosition,LANDMARKS}=await server.ssrLoadModule('/src/content/world.ts');
  const access=ROADS.find(r=>r.id==='circuitlink'),end=access.points.at(-1),dest=landmarkPosition(LANDMARKS.find(l=>l.id==='aster'));
  const near=(p,id)=>{const n=nearestRoad(p.x,p.z,r=>r.id===id);return {road:id,s:n.progress,d:n.distance,y:n.point.y,x:n.point.x,z:n.point.z,yaw:n.point.yaw};};
  for(const p of LANE_GRAPH.paths.values())if(p.junction?.startsWith('aster'))console.log(JSON.stringify({id:p.id,length:p.length,turn:p.turn,maxCurvature:Math.max(...p.points.map(p=>Math.abs(p.curvature)))}));
  console.log(JSON.stringify({lengths:{circuit:CIRCUIT.length,pit:PIT.length,access:access.length},accessEnd:{...end,near:near(end,'circuit')},closestAccess:access.points.map(p=>({lower:p,upper:near(p,'circuit')})).sort((a,b)=>a.upper.d-b.upper.d).slice(0,3),pitEnds:[PIT.points[0],PIT.points.at(-1)].map(p=>({...p,near:near(p,'circuit')})),routeEnd:new RoadGraph().route({x:-380,z:110},dest).at(-1),dest},null,2));
}finally{await server.close();}
