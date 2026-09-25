import {rng} from '../core/math';
import {landscapeNoise,mountainHeight} from './landscape';

/** Permanent visual-only LOD on the outer foothills. No phantom obstacles
 * or trees popping out of the active 4 km driving/collision region. */
export function horizonTrees(){
  const random=rng(91837),trees:{x:number;y:number;z:number;height:number;width:number;yaw:number;tint:number;variant:number}[]=[];
  let centre:{x:number;z:number}|undefined;
  for(let attempt=0;attempt<24000&&trees.length<1600;attempt++){
    if(!centre||attempt%42===0)centre={x:(random()-.5)*10200,z:(random()-.5)*10200};
    const angle=random()*Math.PI*2,radius=Math.sqrt(random())*115,x=centre.x+Math.cos(angle)*radius,z=centre.z+Math.sin(angle)*radius,edge=Math.max(Math.abs(x),Math.abs(z));
    if(edge<2600||edge>5200)continue;
    const y=mountainHeight(x,z),slope=Math.hypot(mountainHeight(x-10,z)-mountainHeight(x+10,z),mountainHeight(x,z-10)-mountainHeight(x,z+10))/20;
    if(y<24||y>490||slope>.62||landscapeNoise(x/460,z/460)<.40)continue;
    const height=18+random()*22;
    trees.push({x,y:y-1.8,z,height,width:height*(.33+random()*.10),yaw:random()*Math.PI,tint:.70+random()*.30,variant:Math.floor(random()*4)});
  }
  return trees;
}
