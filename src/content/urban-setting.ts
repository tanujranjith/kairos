export type UrbanSiteKind='square'|'court'|'exchange'|'campus';

export interface UrbanSiteDefinition {
  id:string;
  kind:UrbanSiteKind;
  x:number;
  z:number;
  yaw:number;
  width:number;
  depth:number;
  seed:number;
  testSpot:{across:number;forward:number};
}

/** Deliberate blocks inside the Westbrook street grid. Their bounds remain
 * clear of the authored roads; the procedural scatter yields inside them. */
export const URBAN_SITE_DEFINITIONS:readonly UrbanSiteDefinition[]=[
  {id:'cedar-square',kind:'square',x:-1510,z:-1065,yaw:0,width:100,depth:100,seed:211,testSpot:{across:0,forward:-4}},
  {id:'market-court',kind:'court',x:-1160,z:-1065,yaw:0,width:120,depth:100,seed:307,testSpot:{across:0,forward:-31}},
  {id:'harbor-exchange',kind:'exchange',x:-805,z:-1060,yaw:0,width:104,depth:100,seed:419,testSpot:{across:31,forward:-27}},
  {id:'westbrook-campus',kind:'campus',x:-1570,z:-750,yaw:0,width:110,depth:110,seed:523,testSpot:{across:0,forward:-16}},
];
