import {smooth} from '../core/math';

/** Authored landscape, not random decoration over the racing surface. */
export const ASTER_GROVES=[
  {x:655,z:-1270,rx:125,rz:70}, {x:890,z:-1275,rx:150,rz:60},
  {x:1165,z:-1285,rx:155,rz:55}, {x:345,z:-1440,rx:105,rz:130},
  {x:660,z:-1620,rx:210,rz:45}, {x:1190,z:-1608,rx:235,rz:46},
  {x:1690,z:-1110,rx:48,rz:270}, {x:1560,z:-485,rx:165,rz:48},
  {x:1110,z:-390,rx:220,rz:35}, {x:740,z:-680,rx:120,rz:130},
  {x:1390,z:-1000,rx:75,rz:155}, {x:260,z:-1080,rx:70,rz:160},
] as const;

export const inPaddock=(x:number,z:number,margin=0)=>x>515-margin&&x<1305+margin&&z> -1446-margin&&z< -1340+margin;
/** Forecourt planters are outside both the timed lane and garage service boxes. */
export const PIT_GARDENS=[
  ...[768,1024,1280].flatMap(x=>[-1,1].map(side=>({x:x+side*7.6,z:x===1280?-1442:-1449.2,width:4.8,depth:1.9}))),
  ...[640,896,1152].flatMap(x=>[-1,1].map(side=>({x:x+side*44,z:-1420.7,width:15,depth:2.8}))),
] as const;
export function pitGardenPlants(){
  return PIT_GARDENS.flatMap((p,index)=>Array.from({length:p.width>5?6:2},(_,i)=>({
    x:p.x+(i-(p.width>5?2.5:.5))*(p.width>5?2.2:2),y:17.96,z:p.z+Math.sin(i*2.4+index)*.16,
    scale:{x:.25,y:.16,z:p.depth>2?.20:.13},yaw:Math.PI*(index%2),
  })));
}
export function paddockBlend(x:number,z:number){
  return smooth((x-495)/25)*smooth((1325-x)/25)*smooth((z+1460)/18)*smooth((-1320-z)/25);
}
export function circuitBankHeight(x:number,z:number){
  if(x<150||x>1800||z< -1700||z> -330)return 0;
  // Broad rolling banks break up the lawn without moving the track/road anchors.
  const mound=(cx:number,cz:number,rx:number,rz:number,h:number)=>h*Math.exp(-2*(((x-cx)/rx)**2+((z-cz)/rz)**2));
  return mound(675,-1265,160,90,5.5)+mound(1110,-1270,240,100,7)+mound(330,-1430,130,190,5)+mound(1635,-1030,100,300,6)+mound(1270,-430,240,75,5);
}
