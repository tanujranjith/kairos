import type { VehicleDefinition, Settings, SaveGame } from '../core/types';
const base = { gears:[3.1,2.1,1.56,1.23,1.0,.82], finalDrive:3.75, wheelbase:2.65, track:1.64, length:4.4, width:1.86, height:1.24, wheelRadius:.34, spring:38000, damper:4500, travel:.22, grip:1.13, drag:.36, downforce:.25, tank:60 };
export const VEHICLES: VehicleDefinition[] = [
  {...base,id:'aeris',name:'Aeris C',subtitle:'LIGHT ON ITS FEET',class:'ROAD',drive:'FWD',color:'#d3dacc',mass:1090,power:182,torque:250,redline:7200,wheelbase:2.48,length:4.02,width:1.76,height:1.28,spring:30000,damper:3600,grip:1.05,topSpeed:228,zeroTo100:6.2,description:'A light, eager front-drive coupe. Find the rhythm in every corner.'},
  {...base,id:'velara',name:'Velara S',subtitle:'PURE BALANCE. BUILT FOR MORE.',class:'ROAD',drive:'RWD',color:'#286fa8',mass:1420,power:420,torque:520,redline:7800,grip:1.18,topSpeed:302,zeroTo100:3.9,description:'A sculpted rear-drive sports car. Precision, with a little wild in reserve.'},
  {...base,id:'crest',name:'Crest RS',subtitle:'GRIP. IN EVERY SEASON.',class:'ROAD',drive:'AWD',color:'#326f58',mass:1530,power:350,torque:470,redline:7200,height:1.42,length:4.35,spring:42000,grip:1.15,drag:.41,topSpeed:278,zeroTo100:4.1,description:'All-wheel confidence and turbocharged character. Made for the mountain pass.'},
  {...base,id:'nova',name:'Nova GT',subtitle:'THE LONG WAY HOME',class:'ROAD',drive:'RWD',color:'#bd9d73',mass:1760,power:490,torque:650,redline:6800,length:4.85,width:1.96,wheelbase:2.85,spring:41000,damper:5200,travel:.26,grip:1.10,topSpeed:312,zeroTo100:4.2,description:'A long-legged grand tourer. Settle in, open the road, and keep going.'},
  {...base,id:'gtx',name:'GTX-R',subtitle:'BUILT FOR THE BRAKING ZONE',class:'GT',drive:'RWD',color:'#e4e4dc',mass:1280,power:540,torque:590,redline:8500,length:4.6,width:2.0,height:1.12,wheelRadius:.35,spring:70000,damper:6400,travel:.14,grip:1.48,drag:.55,downforce:2.2,tank:100,topSpeed:292,zeroTo100:3.1,description:'Slick tires, a stiff platform, and purposeful aero. Every lap is a conversation.'},
  {...base,id:'apex',name:'Apex 01',subtitle:'EVERY MOMENT MATTERS',class:'FORMULA',drive:'RWD',color:'#27aaa5',mass:790,power:790,torque:580,redline:12500,gears:[3.0,2.35,1.95,1.65,1.43,1.25,1.1,.96],finalDrive:4.1,wheelbase:3.30,track:1.8,length:5.25,width:2.0,height:.94,wheelRadius:.36,spring:100000,damper:7000,travel:.10,grip:1.65,drag:.72,downforce:4.5,tank:110,topSpeed:338,zeroTo100:2.6,description:'An open-wheel machine shaped by the air. Trust the speed. Earn the grip.'}
];
export const vehicleById = (id: string) => VEHICLES.find(v=>v.id===id)??VEHICLES[1];
export const DEFAULT_SETTINGS: Settings = {
  quality:'Low',automaticQuality:true,resolution:1,volume:.55,music:false,weather:'Clear',time:17.4,timeRate:1,traffic:12,
  automatic:true,abs:true,tc:true,esc:true,deadzone:.12,steerSensitivity:.85,units:'mph',camera:0,showTelemetry:false,
  bindings:{throttle:'KeyW',brake:'KeyS',left:'KeyA',right:'KeyD',handbrake:'Space',up:'KeyE',down:'KeyQ',camera:'KeyC',reset:'KeyR',map:'KeyM',pause:'Escape',lights:'KeyL',fullscreen:'KeyF'}
};
export const defaultSave = (): SaveGame => ({version:1,selected:'velara',settings:structuredClone(DEFAULT_SETTINGS),customization:{},records:{},discovered:[],distance:0,visits:[]});
