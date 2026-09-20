import {DynamicTexture,PBRMaterial,Color3,type Scene} from '@babylonjs/core';
import type {VehicleDefinition,VehicleState} from '../core/types';

/** One small, locally drawn dashboard texture. A display is owned by one car rig;
 * loaded GLB textures stay owned by their asset library and are never disposed here. */
export function carInstruments(scene:Scene,d:VehicleDefinition,material=new PBRMaterial(`${d.id}-instruments`,scene)){
  material.albedoColor=Color3.Black();material.metallic=0;material.roughness=1;material.emissiveColor.set(.7,.7,.7);
  let texture:DynamicTexture|undefined,last='',lastDraw=-Infinity;
  if(typeof document!=='undefined'){
    texture=new DynamicTexture(`${d.id}-live-instruments`,{width:256,height:128},scene,false);material.emissiveTexture=texture;
  }
  const update=(s:Pick<VehicleState,'speed'|'gear'|'rpm'|'fuel'>,force=false)=>{
    if(!texture)return;const now=performance.now();if(!force&&now-lastDraw<100)return;
    const speed=Math.round(Math.abs(s.speed)*3.6),gear=s.gear<0?'R':s.gear===0?'N':String(s.gear),rpm=Math.round(s.rpm/100)*100,leds=Math.max(0,Math.min(12,Math.round(s.rpm/d.redline*12))),fuel=s.fuel.toFixed(1),stamp=`${speed}:${gear}:${rpm}:${leds}:${fuel}`;
    if(stamp===last)return;last=stamp;lastDraw=now;
    const c=texture.getContext() as CanvasRenderingContext2D;c.fillStyle='#071011';c.fillRect(0,0,256,128);
    for(let i=0;i<12;i++){c.fillStyle=i<leds?(i<7?'#58d594':i<10?'#ecca71':'#9aa5ff'):'#193334';c.fillRect(9+i*20,8,15,8);}
    c.textAlign='center';c.fillStyle='#e5faf2';c.font='bold 66px sans-serif';c.fillText(gear,128,81);
    c.font='bold 25px sans-serif';c.fillText(String(speed),38,58);c.font='11px sans-serif';c.fillStyle='#8eb3ac';c.fillText('km/h',38,77);
    c.font='bold 19px sans-serif';c.fillStyle='#d2e7e0';c.fillText(String(rpm),213,53);c.font='10px sans-serif';c.fillStyle='#8eb3ac';c.fillText('RPM',213,70);
    c.font='12px sans-serif';c.fillText(`FUEL ${fuel} L`,128,109);texture.update();
    material.metadata={...material.metadata,telemetry:{speedKph:speed,gear,rpm,fuel:Number(fuel)}};
  };
  update({speed:0,gear:0,rpm:0,fuel:d.tank},true);
  return {material,update,dispose:()=>texture?.dispose()};
}
