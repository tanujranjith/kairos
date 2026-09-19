import { HANDLING, HANDLING_FEATURES } from '../content/handling-course';

/** Map geometry comes from the same authored dimensions as the collision course. */
export function handlingMap(project: (x: number, z: number) => string) {
  const [x0,z0,x1,z1]=HANDLING.bounds;
  const rect=(bounds:readonly number[])=>[project(bounds[0],bounds[1]),project(bounds[2],bounds[1]),project(bounds[2],bounds[3]),project(bounds[0],bounds[3])].join(' ');
  const slalom=HANDLING.slalom;
  const lanes=[HANDLING.spawn.z,slalom.z].map(z=>`<polyline points="${project(x0+50,z)} ${project(HANDLING.barrier.x-20,z)}" fill="none" stroke="#94a6a5" stroke-width=".8"/>`).join('');
  const features=HANDLING_FEATURES.map(f=>`<polygon points="${rect(f.bounds)}" fill="#809a9a" opacity=".7"/>`).join('');
  const ring=Array.from({length:65},(_,i)=>project(HANDLING.skidpad.x+Math.sin(i/64*Math.PI*2)*HANDLING.skidpad.radius,HANDLING.skidpad.z+Math.cos(i/64*Math.PI*2)*HANDLING.skidpad.radius)).join(' ');
  return `<g data-map-layer="handling" aria-label="Northstar handling course"><polygon points="${rect([x0,z0,x1,z1])}" fill="#3c5053" stroke="#657f80" stroke-width=".8"/>${features}${lanes}<polyline points="${ring}" fill="none" stroke="#94a6a5" stroke-width=".8"/></g>`;
}
