import {terrainHeight} from '../content/world';
import type {MeshDataBuilder} from './mesh-data';

export interface UrbanParcelSpec {x:number;z:number;width:number;depth:number;yaw:number}
export interface UrbanForecourtSpec extends UrbanParcelSpec {roadWidth:number;lateral:number}

const parcelPoint=(s:UrbanParcelSpec,across:number,forward:number,lift=.075)=>{const c=Math.cos(s.yaw),sin=Math.sin(s.yaw),x=s.x+across*c+forward*sin,z=s.z-across*sin+forward*c;return {x,y:terrainHeight(x,z)+lift,z};};

/** A narrow terrain-following hardscape apron for procedural city buildings.
 * It joins the collision-bearing structure batch, so the visible concrete is
 * also the contact surface instead of disguising grass with visual-only paint. */
export function buildUrbanParcel(g:MeshDataBuilder,s:UrbanParcelSpec){
  const width=s.width+4,depth=s.depth+4,columns=Math.ceil(width/6),rows=Math.ceil(depth/6),first=g.positions.length/3;
  const point=(column:number,row:number)=>parcelPoint(s,-width/2+width*column/columns,-depth/2+depth*row/rows);
  for(let column=0;column<columns;column++)for(let row=0;row<rows;row++)g.quad(point(column,row),point(column+1,row),point(column,row+1),point(column+1,row+1));
  g.tintSince(first,[.40,.42,.40,1]);
}

/** A bounded street-facing parking apron. It only appears where the authored
 * setback leaves real space between the building pad and outer sidewalk. */
export function buildUrbanForecourt(g:MeshDataBuilder,paint:MeshDataBuilder,s:UrbanForecourtSpec){
  const side=Math.sign(s.lateral)||1,sidewalk=Math.abs(s.roadWidth)/2+2.8,parcelNear=Math.abs(s.lateral)-s.width/2-2,depth=Math.min(7,parcelNear-sidewalk-.5);
  if(depth<3)return false;
  const span=s.depth+4,near=-side*(s.width/2+1.8),outer=near-side*depth,columns=Math.ceil(depth/3.5),rows=Math.ceil(span/5),first=g.positions.length/3;
  const point=(column:number,row:number)=>parcelPoint(s,near+(outer-near)*column/columns,-span/2+span*row/rows);
  for(let column=0;column<columns;column++)for(let row=0;row<rows;row++)g.quad(point(column,row),point(column+1,row),point(column,row+1),point(column+1,row+1));
  g.tintSince(first,[.31,.33,.32,1]);
  const bays=Math.max(3,Math.floor(span/2.75)),lineInner=near-side*.65,lineOuter=outer+side*.55;
  for(let bay=0;bay<=bays;bay++){
    const forward=-span/2+span*bay/bays,half=.055;
    paint.quad(parcelPoint(s,lineInner,forward-half,.091),parcelPoint(s,lineOuter,forward-half,.091),parcelPoint(s,lineInner,forward+half,.091),parcelPoint(s,lineOuter,forward+half,.091));
  }
  return true;
}
