import type {V3} from '../core/types';
import type {StreetPedestrian} from '../content/streetscape';
import type {MeshDataBuilder} from './mesh-data';

const CLOTHES=[
  [[.12,.28,.38,1],[.12,.15,.17,1]],[[.48,.22,.13,1],[.16,.18,.20,1]],
  [[.18,.35,.27,1],[.18,.16,.14,1]],[[.42,.34,.15,1],[.13,.17,.22,1]],
] as const;
const SKIN=[[.72,.48,.34,1],[.88,.65,.48,1],[.48,.29,.20,1],[.78,.55,.39,1]] as const;

function local(person:StreetPedestrian,x:number,y:number,z:number,scale:number):V3{
  const c=Math.cos(person.yaw),s=Math.sin(person.yaw);return {x:person.x+(x*c+z*s)*scale,y:person.y+y*scale,z:person.z+(-x*s+z*c)*scale};
}

/** A capped six-sided tapered limb between arbitrary points. The silhouette is
 * rounded enough for mid-distance scale cues but remains inexpensive. */
function limb(g:MeshDataBuilder,a:V3,b:V3,ra:number,rb:number,color:readonly number[]){
  const first=g.positions.length/3,dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,length=Math.hypot(dx,dy,dz)||1,d={x:dx/length,y:dy/length,z:dz/length};
  const reference=Math.abs(d.y)>.92?{x:1,y:0,z:0}:{x:0,y:1,z:0};
  let ux=d.y*reference.z-d.z*reference.y,uy=d.z*reference.x-d.x*reference.z,uz=d.x*reference.y-d.y*reference.x,ul=Math.hypot(ux,uy,uz)||1;ux/=ul;uy/=ul;uz/=ul;
  const vx=d.y*uz-d.z*uy,vy=d.z*ux-d.x*uz,vz=d.x*uy-d.y*ux,lower:V3[]=[],upper:V3[]=[];
  for(let index=0;index<6;index++){const angle=index/6*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle);lower.push({x:a.x+(ux*c+vx*s)*ra,y:a.y+(uy*c+vy*s)*ra,z:a.z+(uz*c+vz*s)*ra});upper.push({x:b.x+(ux*c+vx*s)*rb,y:b.y+(uy*c+vy*s)*rb,z:b.z+(uz*c+vz*s)*rb});}
  for(let index=0;index<6;index++){const next=(index+1)%6;g.quad(lower[index],lower[next],upper[index],upper[next]);}
  g.polygon([...lower].reverse());g.polygon(upper);g.tintSince(first,color);
}

function torso(g:MeshDataBuilder,person:StreetPedestrian,bottom:number,top:number,scale:number,color:readonly number[]){
  const first=g.positions.length/3,lower:V3[]=[],upper:V3[]=[];
  for(let index=0;index<8;index++){const angle=index/8*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle);lower.push(local(person,c*.145,bottom,s*.095,scale));upper.push(local(person,c*.235,top,s*.115,scale));}
  for(let index=0;index<8;index++){const next=(index+1)%8;g.quad(lower[index],lower[next],upper[index],upper[next]);}
  g.polygon([...lower].reverse());g.polygon(upper);g.tintSince(first,color);
}

function head(g:MeshDataBuilder,person:StreetPedestrian,bottom:number,scale:number,skin:readonly number[],hair:readonly number[]){
  const neckA=local(person,0,bottom-.07,0,scale),neckB=local(person,0,bottom+.03,0,scale);limb(g,neckA,neckB,.055*scale,.06*scale,skin);
  const a=local(person,0,bottom,0,scale),b=local(person,0,bottom+.25,0,scale);limb(g,a,b,.105*scale,.085*scale,skin);
  const capA=local(person,0,bottom+.20,-.004,scale),capB=local(person,0,bottom+.275,-.004,scale);limb(g,capA,capB,.09*scale,.055*scale,hair);
}

export function buildPedestrian(g:MeshDataBuilder,person:StreetPedestrian){
  const scale=.94+(person.variant%5)*.025,[shirt,pants]=CLOTHES[person.variant%CLOTHES.length],skin=SKIN[(person.variant*3)%SKIN.length],hair:[number,number,number,number]=person.variant%3===0?[.10,.065,.04,1]:person.variant%3===1?[.19,.12,.07,1]:[.055,.045,.038,1];
  if(person.pose==='standing'){
    torso(g,person,.70,1.28,scale,shirt);
    for(const side of [-1,1]){
      const ankle=local(person,side*.075,.07,0,scale),hip=local(person,side*.095,.73,0,scale);limb(g,ankle,hip,.055*scale,.075*scale,pants);
      const shoulder=local(person,side*.205,1.20,0,scale),elbow=local(person,side*.245,.96,.015,scale),hand=local(person,side*.18,.75,.035,scale);limb(g,shoulder,elbow,.052*scale,.048*scale,shirt);limb(g,elbow,hand,.044*scale,.038*scale,skin);
    }
    head(g,person,1.34,scale,skin,hair);
  }else{
    torso(g,person,.57,1.11,scale,shirt);
    for(const side of [-1,1]){
      const hip=local(person,side*.095,.61,0,scale),knee=local(person,side*.10,.56,.29,scale),ankle=local(person,side*.10,.08,.43,scale);limb(g,hip,knee,.075*scale,.065*scale,pants);limb(g,knee,ankle,.063*scale,.052*scale,pants);
      const shoulder=local(person,side*.20,1.03,0,scale),elbow=local(person,side*.22,.82,.16,scale),hand=local(person,side*.12,.66,.27,scale);limb(g,shoulder,elbow,.052*scale,.047*scale,shirt);limb(g,elbow,hand,.043*scale,.037*scale,skin);
    }
    head(g,person,1.17,scale,skin,hair);
  }
}
