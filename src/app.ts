import './style.css';
import './ui/theme.css';
import { Vector3, Quaternion, Color3 } from '@babylonjs/core';
import { Renderer } from './render/renderer';
import { WorldRenderer } from './render/world';
import { createCar, type CarVisual } from './render/car';
import { loadCarAssets } from './render/car-assets';
import { PhysicsWorld, Vehicle, FIXED_DT, neutralInput } from './sim/physics';
import { RaceManager, insidePitLane } from './sim/race';
import { racingInput, trafficInput, trafficSpawn, type TrafficAgent } from './sim/ai';
import { VEHICLES, vehicleById, defaultSave } from './content/vehicles';
import { ROADS, CIRCUIT, PIT, LANDMARKS, pointAt, nearestRoad, RoadGraph } from './content/world';
import { Input } from './core/input';
import { SaveStore, validateSave } from './core/storage';
import { DrivingAudio } from './core/audio';
import { Interface, type ViewModel } from './ui/interface';
import { clamp, distance, formatTime, wrap, percentile } from './core/math';
import type { Screen, SaveGame, RaceSessionConfig, InputFrame, V3, Settings } from './core/types';

type Opponent={vehicle:Vehicle;visual:CarVisual;input:InputFrame;retired:boolean;stuck:number;pit:boolean;service:number};
export class Kairos {
  renderer!:Renderer;physics!:PhysicsWorld;world!:WorldRenderer;player!:Vehicle;visual!:CarVisual;save!:SaveGame;ui!:Interface;input!:Input;
  store=new SaveStore();audio=new DrivingAudio();race=new RaceManager();graph=new RoadGraph();
  screen:Screen='home';mode='Free Drive';clock=0;wetness=0;pausedFromDrive=false;hasDrive=false;
  raceConfig:RaceSessionConfig={kind:'Quick Race',laps:5,entrants:8,difficulty:.65,position:4,vehicleClass:'GT'};
  opponents:Opponent[]=[];traffic:(TrafficAgent&{visual:CarVisual})[]=[];route:V3[]=[];destination:string|null=null;mapSelection:string|null=null;
  activity:{name:string;id:string;time:number;score:number;started:boolean}|null=null;message='';messageUntil=0;
  private manual=false;private accumulator=0;private testAccumulator=0;private last=performance.now();private aiClock=0;private saveClock=0;private uiClock=0;private routeClock=0;private serviceTimer=0;private lastInput=neutralInput();private autoTestDriver=false;private lastDamage=0;private speedTraps=new Map<string,number>();private showcase:CarVisual[]=[];private physicsMs=0;private frameTimes:number[]=[];private overloads=0;private cameraClock=0;
  get vehicle(){return this.player;}
  async init(){
    this.save=await this.store.open();const canvas=document.querySelector<HTMLCanvasElement>('#game')!;
    this.renderer=await Renderer.create(canvas);this.physics=await PhysicsWorld.create(this.renderer.scene);this.world=new WorldRenderer(this.renderer.scene,this.physics);
    await loadCarAssets(this.renderer.scene,VEHICLES.map(v=>v.id));
    const spawn=this.freeSpawn();this.player=new Vehicle(this.physics,vehicleById(this.save.selected),'player',spawn,spawn.yaw,this.store.customization(this.save,this.save.selected));this.visual=createCar(this.renderer.scene,this.player.definition,this.player.setup);this.renderer.registerCar(this.visual);
    this.world.setEnabled(false);this.input=new Input(()=>this.save.settings);this.input.onAction=action=>this.handleInputAction(action);
    this.ui=new Interface(document.querySelector<HTMLElement>('#ui')!,()=>this.view(),(action,value)=>void this.action(action,value));this.store.onError=message=>this.toast(message,12);this.applySettings();this.ui.render();
    for(const [i,id]of ['gtx','apex'].entries()){const car=createCar(this.renderer.scene,vehicleById(id),undefined,true);car.root.position.set(i===0?-6:6,-999.3,-5);car.root.rotationQuaternion=Quaternion.RotationYawPitchRoll(i===0?.5:-.4,0,0);this.showcase.push(car);}
    this.renderer.engine.runRenderLoop(()=>this.frame());
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.screen==='drive')this.setScreen('pause');this.input.clear();this.accumulator=0;this.last=performance.now();});
    window.addEventListener('beforeunload',()=>{void this.store.write(this.save);});
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.setScreen('pause');this.toast('Graphics context was lost. Reload to restore the scene; saved progress is retained.',60);});
    if(import.meta.env.DEV||import.meta.env.MODE==='test'){
      window.render_game_to_text=()=>JSON.stringify(this.snapshot());window.advanceTime=(ms)=>this.advanceTime(ms);window.kairos=this;
    }
    document.querySelector('#loading')?.remove();if(this.store.error)this.toast(this.store.error,10);
    window.addEventListener('gamepaddisconnected',()=>{this.input.clear();if(this.screen==='drive')this.setScreen('pause');this.toast('Controller disconnected. Reconnect it or continue with the keyboard.',10);});
  }
  private freeSpawn(){return pointAt(ROADS.find(r=>r.id==='lakeshore')!,1790,2.1);}
  private get garage(){return !this.hasDrive||['home','garage','customize','motorsport'].includes(this.screen);}
  private applySettings(){this.renderer.applySettings(this.save.settings);this.world.setQuality(this.save.settings.quality);this.world.setWetness(this.wetness);if(this.hasDrive){this.world.ensure(this.player.state.position);for(const other of [...this.traffic,...this.opponents])this.world.ensure(other.vehicle.state.position);}}
  toast(message:string,seconds=4){this.message=message;this.messageUntil=this.cameraClock+seconds;this.ui?.update();}
  setScreen(screen:Screen){if(this.screen==='drive'&&screen!=='drive'){this.pausedFromDrive=true;this.audio.pause();}if(screen==='drive'){this.pausedFromDrive=false;this.input.clear();this.accumulator=0;}this.screen=screen;this.world.setEnabled(!this.garage);this.showcase.forEach(c=>c.root.setEnabled(this.garage));this.ui.render(true);}
  private handleInputAction(action:string){if(action==='pause'){if(this.screen==='drive')this.setScreen('pause');else if(this.pausedFromDrive)this.setScreen('drive');else this.setScreen('home');return;}
    if(action==='map'){this.setScreen(this.screen==='map'&&this.hasDrive?'drive':'map');return;}
    if(action==='fullscreen'){void (document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen());return;}
    if(action==='telemetry'){this.save.settings.showTelemetry=!this.save.settings.showTelemetry;return;}
    if(action==='lights'){this.renderer.lightsEnabled=!this.renderer.lightsEnabled;this.toast(this.renderer.lightsEnabled?'Headlights on':'Headlights off');return;}
    if(action==='camera'){this.save.settings.camera=(this.save.settings.camera+1)%5;void this.store.write(this.save);return;}
    if(action==='reset'&&this.hasDrive)this.resetPlayer();
  }
  private changeCar(id:string,spawn=this.freeSpawn(),yaw=spawn.yaw){this.player.dispose();this.visual.dispose();this.save.selected=id;const d=vehicleById(id),setup=this.store.customization(this.save,id);this.player=new Vehicle(this.physics,d,'player',spawn,yaw,setup);this.visual=createCar(this.renderer.scene,d,setup);this.renderer.registerCar(this.visual);void this.store.write(this.save);}
  private clearOthers(){this.opponents.forEach(o=>{o.vehicle.dispose();o.visual.dispose();});this.traffic.forEach(t=>{t.vehicle.dispose();t.visual.dispose();});this.opponents=[];this.traffic=[];}
  private prepareDrive(){this.clearOthers();this.serviceTimer=0;this.input.clear();this.autoTestDriver=false;this.hasDrive=true;this.lastDamage=0;this.activity=null;this.clock=0;this.aiClock=0;this.accumulator=0;this.race=new RaceManager();}
  async startDrive(){await this.audio.start().catch(()=>{});this.prepareDrive();this.mode='Free Drive';this.world.clear();const spawn=this.freeSpawn();this.world.ensure(spawn);this.changeCar(this.save.selected,spawn);this.createTraffic();this.setScreen('drive');this.toast('WASD or arrows to drive · C changes camera · M opens your map',6);}
  private createTraffic(){this.traffic.forEach(t=>{t.vehicle.dispose();t.visual.dispose();});this.traffic=[];for(let i=0;i<this.save.settings.traffic;i++){const spawn=trafficSpawn(this.player.state.position,i);this.world.ensure(spawn.position);const def=VEHICLES[[0,2,3][i%3]],v=new Vehicle(this.physics,def,`traffic-${i}`,spawn.position,spawn.position.yaw),visual=createCar(this.renderer.scene,def,{paint:['#bac7c4','#9bafbc','#936951','#d9d3c2','#425762'][i%5],wheels:'#82929c',livery:0,brakeBias:.6,aero:1},true);this.traffic.push({vehicle:v,visual,road:spawn.road,direction:spawn.direction,lane:0,input:neutralInput(),timer:0,stuck:0,signal:i});}}
  async startRace(stage=0){await this.audio.start().catch(()=>{});this.prepareDrive();this.mode=this.raceConfig.kind;this.world.clear();this.race.start(this.raceConfig,stage);const playerSlot=this.raceConfig.position-1,d=vehicleById(this.raceConfig.vehicleClass==='FORMULA'?'apex':'gtx');
    const grid=(slot:number)=>pointAt(CIRCUIT,CIRCUIT.length-18-Math.floor(slot/2)*14,(slot%2===0?-1:1)*3);
    const p=grid(playerSlot);this.world.ensure(p);this.changeCar(d.id,p);
    for(let i=1;i<this.raceConfig.entrants;i++){const slot=i-1>=playerSlot?i:i-1,spawn=grid(slot);this.world.ensure(spawn);const vehicle=new Vehicle(this.physics,d,`racer-${i}`,spawn,spawn.yaw);const visual=createCar(this.renderer.scene,d,{paint:['#ba5239','#65908f','#cdc9bb','#365a92','#dea658','#6b667d','#8cbaad'][i%7],wheels:'#9caaac',livery:1,brakeBias:.6,aero:1},true);this.renderer.registerCar(visual);this.opponents.push({vehicle,visual,input:neutralInput(),retired:false,stuck:0,pit:false,service:0});}
    this.setScreen('drive');this.toast(stage===0?'Aster International · Find your braking points.':stage===1?'Qualifying · Your fastest valid lap sets the grid.':'Race · Make the moment count.',5);
  }
  private resetPlayer(){const near=nearestRoad(this.player.node.position.x,this.player.node.position.z,this.mode==='Free Drive'?r=>r.kind!=='pit':r=>r.id==='circuit');const p=pointAt(near.road,near.progress,this.mode==='Free Drive'?2:0);this.world.ensure(p);this.player.reset(p,p.yaw);this.race.resetLap('player');this.input.clear();this.toast(this.mode==='Free Drive'?'Back on the road.':'Back on circuit · current lap invalidated.');}
  async action(action:string,value?:string){
    if(action==='screen'){this.setScreen(value as Screen);return;}
    if(action==='home'){this.hasDrive=false;this.pausedFromDrive=false;this.clearOthers();this.race=new RaceManager();this.mode='Free Drive';this.setScreen('home');void this.store.write(this.save);return;}
    if(action==='start-drive'){await this.startDrive();return;}
    if(action==='start-race'||action==='retry-race'){await this.startRace();return;}
    if(action==='pause'){this.setScreen('pause');return;}
    if(action==='resume'){this.setScreen(this.hasDrive?'drive':'home');return;}
    if(action==='select-car'){this.changeCar(value!);this.ui.invalidate();this.ui.render();return;}
    if(action==='reset'){this.resetPlayer();if(this.pausedFromDrive)this.setScreen('drive');return;}
    if(action==='setting'){const {key,value:v}=JSON.parse(value!);const next=structuredClone(this.save);(next.settings as unknown as Record<string,unknown>)[key]=typeof this.save.settings[key as keyof Settings]==='number'?Number(v):v;this.save=validateSave(next);this.applySettings();if(key==='traffic'&&this.mode==='Free Drive'&&this.hasDrive)this.createTraffic();void this.store.write(this.save);return;}
    if(action==='custom'){const {key,value:v}=JSON.parse(value!);const setup=this.store.customization(this.save,this.save.selected);(setup as unknown as Record<string,unknown>)[key]=['paint','wheels'].includes(key)?v:Number(v);this.save.customization[this.save.selected]=setup;this.changeCar(this.save.selected);this.ui.render(true);return;}
    if(action==='race-config'){const {key,value:v}=JSON.parse(value!);(this.raceConfig as unknown as Record<string,unknown>)[key]=typeof this.raceConfig[key as keyof RaceSessionConfig]==='number'?Number(v):v;this.raceConfig.position=Math.min(this.raceConfig.position,this.raceConfig.entrants);this.ui.render(true);return;}
    if(action==='map-select'){this.mapSelection=value!;this.ui.render(true);return;}
    if(action==='navigate'){const landmark=LANDMARKS.find(l=>l.id===value)!;this.destination=landmark.id;this.route=this.graph.route(this.player.state.position,landmark);if(!this.route.length)this.toast('No connected road route was found.');else this.toast(`Route set · ${landmark.name}`);this.ui.render(true);return;}
    if(action==='activity'){const l=LANDMARKS.find(l=>l.id===value)!;if(!this.hasDrive)await this.startDrive();this.activity={name:l.name,id:l.id,time:0,score:0,started:false};this.destination=l.id;this.route=this.graph.route(this.player.state.position,l);this.setScreen('drive');this.toast(`Drive to ${l.name} to begin.`);return;}
    if(action==='end-session'){this.race.end();this.finishSession();return;}
    if(action==='next-session'){const stage=this.race.stage;if(stage===1)this.raceConfig.position=this.race.order().findIndex(r=>r.id==='player')+1;await this.startRace(stage+1);return;}
    if(action==='service'){const p=this.player.state.position;const station=LANDMARKS.find(l=>(l.type==='service'||l.type==='garage')&&distance(l,p)<35),pit=nearestRoad(p.x,p.z,r=>r.kind==='pit');if(Math.abs(this.player.state.speed)>1){this.toast('Come to a stop before servicing your car.');return;}if(station||this.mode!=='Free Drive'&&pit.distance<6&&pit.progress>170&&pit.progress<PIT.length-170){this.serviceTimer=6;this.toast('Service in progress · refueling and replacing tires',6);}else this.toast('Stop at a service station or in the Aster pit service area.');return;}
    if(action==='toggle-sound'){this.save.settings.volume=this.save.settings.volume>0?0:.55;void this.store.write(this.save);this.toast(this.save.settings.volume?'Audio on':'Audio muted');return;}
    if(action==='save-export'){this.store.export(this.save);return;}
    if(action==='save-import'){const picker=document.createElement('input');picker.type='file';picker.accept='.json,application/json';picker.onchange=async()=>{try{const f=picker.files?.[0];if(!f)return;if(f.size>2_000_000)throw new Error('Save file is too large.');const imported=validateSave(JSON.parse(await f.text()));this.hasDrive=false;this.clearOthers();this.save=imported;this.changeCar(imported.selected);this.applySettings();await this.store.write(this.save);this.setScreen('settings');this.toast('Save imported.');}catch(e){this.toast(`Import failed: ${String(e)}`,7);}};picker.click();return;}
    if(action==='reset-save'){if(confirm('Reset Kairos settings, customization, and personal records on this device?')){this.save=defaultSave();this.hasDrive=false;this.clearOthers();this.changeCar(this.save.selected);this.applySettings();await this.store.write(this.save);this.ui.render(true);this.toast('Progress reset.');}return;}
    if(action==='bind'){this.toast(`Press a key for ${value}. Escape cancels.`,12);const listener=(event:KeyboardEvent)=>{event.preventDefault();event.stopImmediatePropagation();window.removeEventListener('keydown',listener,true);if(event.code!=='Escape'){for(const [key,code]of Object.entries(this.save.settings.bindings))if(code===event.code&&key!==value){this.toast(`That key is assigned to ${key}. Choose a different key.`,5);return;}this.save.settings.bindings[value!]=event.code;void this.store.write(this.save);}this.input.clear();this.toast('Controls updated.');this.ui.render(true);};window.addEventListener('keydown',listener,true);}
  }
  private step(){
    if(this.screen!=='drive')return;const dt=FIXED_DT;this.clock+=dt;this.saveClock+=dt;this.aiClock+=dt;this.routeClock+=dt;
    const settings=this.save.settings;settings.time=(settings.time+dt*settings.timeRate/3600)%24;this.wetness=clamp(this.wetness+(settings.weather==='Rain'?.012:-.003)*dt,0,1);
    const raceActive=this.mode!=='Free Drive',all=[this.player,...this.opponents.map(o=>o.vehicle),...this.traffic.map(t=>t.vehicle)];
    if(this.aiClock>=.1){const elapsed=this.aiClock;this.aiClock=0;this.world.ensure(this.player.state.position);for(let i=0;i<this.opponents.length;i++){
      const o=this.opponents[i],v=o.vehicle,n=nearestRoad(v.state.position.x,v.state.position.z,r=>r.id==='circuit');this.world.ensure(v.state.position);
      const needsService=v.state.fuel<v.definition.tank*.18||v.state.wheels.some(w=>w.wear<.55);
      if(needsService&&n.progress>CIRCUIT.length-300&&n.progress<CIRCUIT.length-140)o.pit=true;
      o.input=racingInput(v,all,this.raceConfig.difficulty,this.wetness,i,o.pit?PIT:CIRCUIT);
      if(o.pit){const p=nearestRoad(v.state.position.x,v.state.position.z,r=>r.id==='pit'),box=260+i*25;
        if(needsService&&p.progress>box-45&&p.progress<box+30){o.input.throttle=0;o.input.brake=clamp((45-(box-p.progress))/35,0,1);if(Math.abs(v.state.speed)<.7){o.service+=elapsed;o.input.brake=1;if(o.service>=6){v.restore();o.service=0;}}}
        if(!needsService&&p.progress>PIT.length-18)o.pit=false;
      }
      o.stuck=Math.abs(v.state.speed)<1.5&&!o.pit?o.stuck+elapsed:0;
      if(v.needsRecovery()||o.stuck>8){const p=pointAt(CIRCUIT,n.progress-8,i%2?3:-3);if(all.every(other=>other===v||distance(other.state.position,p)>9)){this.world.ensure(p);v.reset(p,p.yaw);this.race.resetLap(v.id);o.stuck=0;}}
    }
      for(let i=0;i<this.traffic.length;i++){const t=this.traffic[i];this.world.ensure(t.vehicle.state.position);t.input=trafficInput(t,all,this.clock);if(distance(t.vehicle.state.position,this.player.state.position)>700||t.vehicle.needsRecovery()){const spawn=trafficSpawn(this.player.state.position,i);this.world.ensure(spawn.position);t.vehicle.reset(spawn.position,spawn.position.yaw);t.road=spawn.road;t.direction=spawn.direction;}}
    }
    let input=this.autoTestDriver||this.race.player?.finished?racingInput(this.player,all,this.raceConfig.difficulty,this.wetness,0):this.input.poll(dt,this.player.state.speed);this.lastInput=input;
    const countdown=this.race.state.phase==='countdown';if(countdown&&(this.autoTestDriver||input.throttle<.05))input={...neutralInput(),brake:1};
    if(this.serviceTimer>0){this.serviceTimer-=dt;input={...neutralInput(),brake:1};if(this.serviceTimer<=0){this.player.restore();this.toast('Service complete. Clear to rejoin.');}}
    this.player.preStep(input,settings,this.wetness,dt);
    const aiSettings={...settings,automatic:true,abs:true,tc:true,esc:true};
    for(const o of this.opponents){if(o.retired)continue;o.vehicle.preStep(countdown?{...neutralInput(),brake:1}:o.input,aiSettings,this.wetness,dt);}
    for(const t of this.traffic)t.vehicle.preStep(t.input,aiSettings,this.wetness,dt);
    this.physics.step(dt);all.forEach(v=>v.postStep(dt));this.save.distance+=Math.abs(this.player.state.speed)*dt;
    if(this.player.needsRecovery())this.resetPlayer();
    if(raceActive){const samples=[this.player,...this.opponents.filter(o=>!o.retired).map(o=>o.vehicle)].map(v=>{const n=nearestRoad(v.state.position.x,v.state.position.z,r=>r.id==='circuit'),pit=nearestRoad(v.state.position.x,v.state.position.z,r=>r.id==='pit');return {id:v.id,progress:n.progress,lateral:n.lateral,speed:Math.abs(v.state.speed),pit:insidePitLane(pit.progress,pit.distance,n.distance)};});this.race.update(dt,samples);const best=this.race.player?.best;if(best&&Number.isFinite(best)){const key=`lap-${this.player.definition.id}`;this.save.records[key]=Math.min(this.save.records[key]??Infinity,best);}if(this.race.state.phase==='finished')this.finishSession();}
    else this.updateActivities(dt);
    if(this.routeClock>3){this.routeClock=0;const n=nearestRoad(this.player.state.position.x,this.player.state.position.z);if(n.distance<n.road.width&&!this.save.discovered.includes(n.road.id))this.save.discovered.push(n.road.id);if(this.destination){const target=LANDMARKS.find(l=>l.id===this.destination)!;this.route=this.graph.route(this.player.state.position,target);if(distance(this.player.state.position,target)<30){if(!this.save.visits.includes(target.id))this.save.visits.push(target.id);this.toast(`Arrived · ${target.name}`);this.destination=null;this.route=[];}}}
    if(this.saveClock>5){this.saveClock=0;void this.store.write(this.save);}
  }
  private updateActivities(dt:number){const s=this.player.state;for(const l of LANDMARKS.filter(l=>l.type==='speed')){if(distance(s.position,l)<20&&(this.speedTraps.get(l.id)??-100)<this.clock-8){this.speedTraps.set(l.id,this.clock);const speed=Math.abs(s.speed)*3.6;this.save.records[l.id]=Math.max(this.save.records[l.id]??0,speed);this.toast(`${l.name} · ${Math.round(speed)} km/h${speed>=(l.target??0)?' · TARGET REACHED':''}`);}}
    if(!this.activity)return;const a=this.activity,l=LANDMARKS.find(l=>l.id===a.id)!;if(!a.started){if(distance(s.position,l)>30)return;a.started=true;a.time=0;this.toast(`${l.name} · GO`);if(l.type==='trial'&&l.end){this.route=this.graph.route(s.position,l.end);this.destination=null;}if(l.type==='scenic'||l.type==='speed'){if(!this.save.visits.includes(l.id))this.save.visits.push(l.id);this.toast(`${l.name} · Discovered`);this.activity=null;return;}}
    a.time+=dt;if(l.type==='trial'&&l.end&&distance(s.position,l.end)<25){const old=this.save.records[l.id]??Infinity;this.save.records[l.id]=Math.min(old,a.time);this.toast(`${l.name} · ${formatTime(a.time)}${a.time<old?' · PERSONAL BEST':''}`,8);this.activity=null;this.route=[];}
    if(l.type==='drift'){const slip=Math.abs(wrap(Math.atan2(s.velocity.x,s.velocity.z)-s.yaw));if(Math.abs(s.speed)>7&&slip>.13&&slip<1.2&&s.grounded)a.score+=Math.abs(s.speed)*slip*dt*12;if(a.time>60||distance(s.position,l)>380){this.save.records[l.id]=Math.max(this.save.records[l.id]??0,a.score);this.toast(`${l.name} · ${Math.round(a.score)} points`,7);this.activity=null;}}
  }
  private finishSession(){this.audio.pause();this.setScreen('results');void this.store.write(this.save);}
  private frame(){const now=performance.now(),raw=(now-this.last)/1000;this.last=now;if(this.manual)return;if(document.hidden)return;if(raw>FIXED_DT*8)this.overloads++;const dt=Math.min(raw,.067);this.frameTimes.push(raw*1000);if(this.frameTimes.length>1800)this.frameTimes.shift();this.accumulator+=dt;let steps=0;const start=performance.now();while(this.accumulator>=FIXED_DT&&steps<8){this.step();this.accumulator-=FIXED_DT;steps++;}this.physicsMs=performance.now()-start;if(this.accumulator>=FIXED_DT){this.overloads++;this.accumulator%=FIXED_DT;}this.draw(dt,this.accumulator/FIXED_DT);}
  private draw(dt:number,alpha=1){this.cameraClock+=dt;if(this.message&&this.cameraClock>this.messageUntil)this.message='';
    this.world.setEnabled(!this.garage);if(!this.garage)this.world.update(this.player.state.position,this.player.state.velocity,[...this.opponents.map(o=>o.vehicle.state.position),...this.traffic.map(t=>t.vehicle.state.position)]);this.world.setWetness(this.wetness);
    this.renderer.update(this.player,this.visual,this.save.settings,dt,this.garage,this.cameraClock,this.wetness,alpha);
    for(const o of [...this.opponents,...this.traffic]){o.visual.root.setEnabled(!this.garage&&distance(o.vehicle.state.position,this.player.state.position)<650);o.visual.root.position.copyFrom(Vector3.Lerp(o.vehicle.previousPosition,o.vehicle.node.position,alpha));o.visual.root.rotationQuaternion=Quaternion.Slerp(o.vehicle.previousRotation,o.vehicle.node.rotationQuaternion!,alpha);o.visual.update(o.vehicle.state);}
    this.showcase.forEach(c=>c.root.setEnabled(this.garage));this.renderer.render();this.audio.update(this.player.state,this.player.definition,this.lastInput.throttle,this.save.settings.volume,this.screen==='drive',this.save.settings.camera===2,this.wetness);
    if(this.player.state.damage>this.lastDamage){this.audio.impact((this.player.state.damage-this.lastDamage)*5);this.input.rumble((this.player.state.damage-this.lastDamage)*8);this.lastDamage=this.player.state.damage;}
    this.uiClock+=dt;if(this.uiClock>.1){this.uiClock=0;this.ui.update();}this.pollMenuGamepad();
  }
  private menuButtonLatch=false;
  private pollMenuGamepad(){if(this.screen==='drive')return;const pad=Array.from(navigator.getGamepads?.()??[]).find(p=>p?.connected);if(!pad)return;const pressed=pad.buttons[12]?.pressed||pad.buttons[13]?.pressed||pad.buttons[14]?.pressed||pad.buttons[15]?.pressed||pad.buttons[0]?.pressed||pad.buttons[1]?.pressed;if(pressed&&!this.menuButtonLatch){const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>('#ui button')).filter(b=>b.getBoundingClientRect().width>0);let i=buttons.indexOf(document.activeElement as HTMLButtonElement);if(pad.buttons[0]?.pressed)buttons[i]?.click();else if(pad.buttons[1]?.pressed)void this.action('resume');else {i=(i+(pad.buttons[12]?.pressed||pad.buttons[14]?.pressed?-1:1)+buttons.length)%buttons.length;buttons[i]?.focus();}}this.menuButtonLatch=!!pressed;}
  advanceTime(ms:number){this.manual=true;this.testAccumulator+=Math.max(0,ms)/1000;const start=performance.now();while(this.testAccumulator>=FIXED_DT-1e-9){this.step();this.testAccumulator-=FIXED_DT;}this.physicsMs=performance.now()-start;this.draw(ms/1000,1);this.ui.update();}
  resumeRealTime(){this.manual=false;this.last=performance.now();this.accumulator=0;}
  setAutopilot(enabled:boolean){this.autoTestDriver=enabled;}
  teleport(x:number,z:number,roadId?:string){const n=nearestRoad(x,z,roadId?r=>r.id===roadId:undefined);const p=pointAt(n.road,n.progress,2);this.world.ensure(p);this.player.reset(p,p.yaw);this.race.resetLap('player');}
  snapshot(){return {screen:this.screen,mode:this.mode,renderer:this.renderer.rendererName,coordinateSystem:'meters; Y up; +Z forward at yaw 0; +X right',player:this.player.state,race:this.race.state,cells:this.world.cells.size,traffic:this.traffic.map(t=>({id:t.vehicle.id,position:t.vehicle.state.position,speed:t.vehicle.state.speed})),opponents:this.opponents.map(o=>({id:o.vehicle.id,position:o.vehicle.state.position,speed:o.vehicle.state.speed})),destination:this.destination,routePoints:this.route.length,activity:this.activity,weather:this.save.settings.weather,wetness:this.wetness,time:this.save.settings.time,physicsMs:this.physicsMs,overloads:this.overloads,frameTimeP95:percentile(this.frameTimes,.95),message:this.message};}
  view():ViewModel{return {screen:this.screen,save:this.save,player:this.player.state,race:this.race.state,raceOrder:this.race.order(),raceStage:this.race.stage,raceConfig:this.raceConfig,mode:this.mode,renderer:this.renderer.rendererName,fps:this.renderer.engine.getFps(),cells:this.world.cells.size,drawCalls:this.renderer.scene.getActiveMeshes().length,triangles:this.renderer.scene.getActiveIndices()/3,wetness:this.wetness,clock:this.clock,route:this.route,destination:this.destination,mapSelection:this.mapSelection,activity:this.activity,message:this.message,storageError:this.store.error,pausedFromDrive:this.pausedFromDrive,trafficCount:this.traffic.length,physicsMs:this.physicsMs};}
}

const game=new Kairos();game.init().catch(e=>{console.error(e);document.querySelector('#loading-message')!.textContent=String(e.message??e);});
