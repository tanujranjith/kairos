import {terrainHeight} from '../content/world';
import type {MeshDataBuilder} from './mesh-data';

export interface UrbanParcelSpec {x:number;z:number;width:number;depth:number;yaw:number}

/** A narrow terrain-following hardscape apron for procedural city buildings.
 * It joins the collision-bearing structure batch, so the visible concrete is
 * also the contact surface instead of disguising grass with visual-only paint. */
export function buildUrbanParcel(g:MeshDataBuilder,s:UrbanParcelSpec){
  const width=s.width+4,depth=s.depth+4,columns=Math.ceil(width/6),rows=Math.ceil(depth/6),first=g.positions.length/3,c=Math.cos(s.yaw),sin=Math.sin(s.yaw);
  const point=(column:number,row:number)=>{const across=-width/2+width*column/columns,forward=-depth/2+depth*row/rows,x=s.x+across*c+forward*sin,z=s.z-across*sin+forward*c;return {x,y:terrainHeight(x,z)+.075,z};};
  for(let column=0;column<columns;column++)for(let row=0;row<rows;row++)g.quad(point(column,row),point(column+1,row),point(column,row+1),point(column+1,row+1));
  g.tintSince(first,[.40,.42,.40,1]);
}
