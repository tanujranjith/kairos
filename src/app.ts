import './style.css';
import './ui/theme.css';
import './ui/results.css';
import { Vector3, Quaternion, Color3 } from '@babylonjs/core';
import { Renderer } from './render/renderer';
import { WorldRenderer } from './render/world';
import { createCar, type CarVisual } from './render/car';
import { createLodCar } from './render/car-lod';
import { loadCarAssets } from './render/car-assets';
import { PhysicsWorld, Vehicle, FIXED_DT, neutralInput } from './sim/physics';
import {steeringContactGrip} from './sim/contacts';
import {preparePresentation,renderPreparationFrame,waitForPresentationReady} from './core/presentation-ready';
import { RaceManager } from './sim/race';
import { racingInput } from './sim/ai';
import { PitDriver } from './sim/pit-driver';
import {evaluateSpeedTrap,type ActivityState} from './sim/activities';
import {pitServiceBox} from './content/pit-plan';
import { TrafficRuntime } from './runtime/traffic';
import { WorldLoadingOverlay } from './ui/world-loading';
import { VEHICLES, vehicleById, defaultSave } from './content/vehicles';
import { ROADS, CIRCUIT, LANDMARKS, pointAt, nearestRoad, nearestRoadAt, landmarkPosition, atDestination, RoadGraph } from './content/world';
import { HANDLING, inHandlingCourse } from './content/handling-course';
import { Input } from './core/input';
import { SaveStore, validateSave } from './core/storage';
import { DrivingAudio } from './core/audio';
import {AdaptiveQuality} from './render/adaptive-quality';
import {GraphicsRecovery,isExpectedGraphicsCancellation} from './render/graphics-recovery';
import { Interface, type ViewModel } from './ui/interface';
import { ControllerMenuNavigator } from './ui/controller-navigation';
import { clamp, distance, formatTime, wrap, percentile } from './core/math';
import type { Screen, SaveGame, RaceSessionConfig, RaceSessionStart, InputFrame, V3, Settings, Quality } from './core/types';

type Opponent={vehicle:Vehicle;visual:CarVisual;input:InputFrame;retired:boolean;stuck:number;depleted:number;pitDriver:PitDriver};
export class Kairos {
  renderer!:Renderer;physics!:PhysicsWorld;world!:WorldRenderer;player!:Vehicle;visual!:CarVisual;save!:SaveGame;ui!:Interface;input!:Input;
  store=new SaveStore();audio=new DrivingAudio();race=new RaceManager();graph=new RoadGraph();
  private adaptiveQuality=new AdaptiveQuality();private pendingAutomaticQuality:Quality|null=null;private graphicsRecovery=new GraphicsRecovery();private graphicsRecoveryTimeout=0;
  private menuNavigation!:ControllerMenuNavigator;
  private preparingPresentation=true;
  loading=false;loadError='';private transitioning=false;private loadingTicket=0;private retryOperation:(()=>Promise<void>)|null=null;private transitionPromise=Promise.resolve();private advanceQueue=Promise.resolve();
  private loadingOverlay=new WorldLoadingOverlay(()=>{if(this.retryOperation)void this.retryOperation();else{this.loadError='';this.world.retry();}},()=>{void this.action('home');});
  screen:Screen='home';mode='Free Drive';clock=0;wetness=0;pausedFromDrive=false;hasDrive=false;
  raceConfig:RaceSessionConfig={kind:'Quick Race',laps:5,entrants:8,difficulty:.65,position:4,vehicleClass:'GT'};
  opponents:Opponent[]=[];trafficSystem!:TrafficRuntime;route:V3[]=[];destination:string|null=null;mapSelection:string|null=null;
  get traffic(){return this.trafficSystem?.cars??[];}
  activity:ActivityState|null=null;message='';messageUntil=0;
  private manual=false;private accumulator=0;private testAccumulator=0;private last=performance.now();private aiClock=0;private saveClock=0;private uiClock=0;private routeClock=0;private serviceTimer=0;private lastInput=neutralInput();private autoTestDriver=false;private autoTestRoad=CIRCUIT;private autoTestOffset=0;private lastDamage=0;private speedTraps=new Map<string,number>();private showcase:CarVisual[]=[];private physicsMs=0;private frameTimes:number[]=[];private overloads=0;private cameraClock=0;
  get vehicle(){return this.player;}
  async init(){
    let phase=performance.now();const timed=(name:string)=>{const end=performance.now();performance.measure(`kairos:startup:${name}`,{start:phase,end});phase=end;};
    this.save=await this.store.open();this.adaptiveQuality.reset(this.save.settings.automaticQuality);const canvas=document.querySelector<HTMLCanvasElement>('#game')!;
    timed('storage');this.renderer=await Renderer.create(canvas);timed('renderer');this.physics=await PhysicsWorld.create(this.renderer.scene);timed('physics');this.world=new WorldRenderer(this.renderer.scene,this.physics);this.trafficSystem=new TrafficRuntime(this.physics,this.world,this.renderer.scene);timed('world');
    await loadCarAssets(this.renderer.scene,VEHICLES.map(v=>v.id));timed('vehicles');
    const spawn=this.freeSpawn();this.player=new Vehicle(this.physics,vehicleById(this.save.selected),'player',spawn,spawn.yaw,this.store.customization(this.save,this.save.selected));this.visual=createCar(this.renderer.scene,this.player.definition,this.player.setup);this.renderer.registerCar(this.visual);
    this.world.setEnabled(false);this.input=new Input(()=>this.save.settings);this.input.onAction=action=>this.handleInputAction(action);
    this.ui=new Interface(document.querySelector<HTMLElement>('#ui')!,()=>this.view(),(action,value)=>void this.action(action,value));this.store.onError=message=>this.toast(message,12);this.applySettings();this.ui.render();
    this.menuNavigation=new ControllerMenuNavigator(document.querySelector<HTMLElement>('#ui')!,{isActive:()=>this.screen!=='drive'&&!this.loading,context:()=>this.screen,onBack:()=>{void this.action('resume');}});
    for(const [i,id]of ['gtx','apex'].entries()){const car=createCar(this.renderer.scene,vehicleById(id),undefined,true);car.root.position.set(i===0?-6:6,-999.3,-5);car.root.rotationQuaternion=Quaternion.RotationYawPitchRoll(i===0?.5:-.4,0,0);this.showcase.push(car);}
    timed('interface');
    const loadingMessage=document.querySelector('#loading-message');if(loadingMessage)loadingMessage.textContent='Preparing car materials and showroom lighting…';
    await preparePresentation(()=>renderPreparationFrame(this.renderer.engine,()=>this.draw(0,1)),()=>{
      const reflection=this.renderer.reflections.snapshot();
      return reflection.ready&&reflection.pendingFace<0&&this.visual.paint.reflectionTexture!==null&&this.renderer.scene.isReady(true);
    });
    timed('presentation');this.preparingPresentation=false;this.input.clear();this.last=performance.now();this.installGraphicsRecovery();
    this.renderer.engine.runRenderLoop(()=>this.frame());
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.screen==='drive')this.setScreen('pause');this.input.clear();this.accumulator=0;this.last=performance.now();});
    window.addEventListener('beforeunload',()=>{void this.store.write(this.save);});
    if(import.meta.env.DEV||import.meta.env.MODE==='test'){
      window.render_game_to_text=()=>JSON.stringify(this.snapshot());window.advanceTime=(ms)=>this.advanceTime(ms);window.kairos=this;
    }
    document.querySelector('#loading')?.remove();if(this.store.error)this.toast(this.store.error,10);
    window.addEventListener('gamepaddisconnected',()=>{this.input.clear();if(this.screen==='drive')this.setScreen('pause');this.toast('Controller disconnected. Reconnect it or continue with the keyboard.',10);});
  }
  private freeSpawn(){return pointAt(ROADS.find(r=>r.id==='lakeshore')!,1790,2.1);}
  private get garage(){return !this.hasDrive||['home','garage','customize','motorsport'].includes(this.screen);}
  private installGraphicsRecovery(){this.renderer.engine.onContextLostObservable.add(()=>this.beginGraphicsRecovery());this.renderer.engine.onContextRestoredObservable.add(()=>{void this.finishGraphicsRecovery();});const interrupted=()=>{const engineLost=(this.renderer.engine as unknown as {_contextWasLost?:boolean})._contextWasLost===true;return engineLost||!this.graphicsRecovery.isReady();};window.addEventListener('unhandledrejection',event=>{if(isExpectedGraphicsCancellation(event.reason,interrupted()))event.preventDefault();});window.addEventListener('error',event=>{if(isExpectedGraphicsCancellation(event.error,interrupted()))event.preventDefault();});}
  private beginGraphicsRecovery(){const resume=this.screen==='drive'||this.pausedFromDrive,token=this.graphicsRecovery.begin(performance.now(),resume);window.clearTimeout(this.graphicsRecoveryTimeout);this.graphicsRecoveryTimeout=window.setTimeout(()=>{if(this.graphicsRecovery.fail(token,performance.now(),'Graphics could not be restored yet. Reload Kairos to rebuild the renderer; saved progress is retained.')){this.ui.render(true);this.toast(this.graphicsRecovery.snapshot().message,60);}},20000);this.input.clear();this.accumulator=0;this.audio.pause();if(this.screen==='drive')this.setScreen('pause');this.toast('Graphics device interrupted. Rebuilding local rendering resources…',60);}
  private async finishGraphicsRecovery(){const token=this.graphicsRecovery.activeToken();try{this.renderer.recoverGraphicsResources();this.applySettings();await waitForPresentationReady(()=>this.renderer.scene.textures.every(texture=>texture.isReadyOrNotBlocking()));if(!this.graphicsRecovery.isCurrent(token))return;await preparePresentation(()=>renderPreparationFrame(this.renderer.engine,()=>this.draw(0,1)),()=>this.renderer.scene.isReady(true));if(!this.graphicsRecovery.succeed(token,performance.now()))return;window.clearTimeout(this.graphicsRecoveryTimeout);this.last=performance.now();this.accumulator=0;this.input.clear();this.ui.render(true);this.toast(this.graphicsRecovery.snapshot().resumeRequested?'Graphics restored. Resume when you are ready.':'Graphics restored.',8);}catch(error){if(this.graphicsRecovery.fail(token,performance.now(),`Graphics recovery failed: ${String(error)}. Reload Kairos; saved progress is retained.`)){this.ui.render(true);this.toast(this.graphicsRecovery.snapshot().message,60);}}}
  private applySettings(resetDynamic=false){this.renderer.applySettings(this.save.settings,resetDynamic);this.world.setQuality(this.save.settings.quality);this.world.setWetness(this.wetness);if(this.hasDrive){this.world.requestAround(this.player.node.position,true);for(const other of [...this.traffic,...this.opponents])this.world.requestAround(other.vehicle.node.position);}}
  toast(message:string,seconds=4){this.message=message;this.messageUntil=this.cameraClock+seconds;this.ui?.update();}
  setScreen(screen:Screen){if(screen==='drive'&&!this.graphicsRecovery.isReady()){this.toast('Graphics are still recovering. Kairos will keep the simulation paused.',8);return;}if(this.screen==='drive'&&screen!=='drive'){this.pausedFromDrive=true;this.audio.pause();}if(screen==='drive'){this.pausedFromDrive=false;this.input.clear();this.accumulator=0;}this.screen=screen;this.world.setEnabled(!this.garage);this.showcase.forEach(c=>c.root.setEnabled(this.garage));this.ui.render(true);}
  private handleInputAction(action:string){if(this.preparingPresentation)return;if(this.loading){if(action==='pause')void this.action('home');return;}if(action==='pause'){if(this.screen==='drive')this.setScreen('pause');else if(this.pausedFromDrive)this.setScreen('drive');else this.setScreen('home');return;}
    if(action==='map'){this.setScreen(this.screen==='map'&&this.hasDrive?'drive':'map');return;}
    if(action==='fullscreen'){void (document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen());return;}
    if(action==='telemetry'){this.save.settings.showTelemetry=!this.save.settings.showTelemetry;return;}
    if(action==='lights'){this.renderer.lightsEnabled=!this.renderer.lightsEnabled;this.toast(this.renderer.lightsEnabled?'Headlights on':'Headlights off');return;}
    if(action==='camera'){this.save.settings.camera=(this.save.settings.camera+1)%5;void this.store.write(this.save);return;}
    if(action==='reset'&&this.hasDrive)this.resetPlayer();
  }
  private changeCar(id:string,spawn=this.freeSpawn(),yaw=spawn.yaw){this.player.dispose();this.visual.dispose();this.save.selected=id;const d=vehicleById(id),setup=this.store.customization(this.save,id);this.player=new Vehicle(this.physics,d,'player',spawn,yaw,setup);this.visual=createCar(this.renderer.scene,d,setup);this.renderer.registerCar(this.visual);void this.store.write(this.save);}
  private clearOthers(){this.opponents.forEach(o=>{o.vehicle.dispose();o.visual.dispose();});this.opponents=[];this.trafficSystem.clear();}
  private prepareDrive(){this.clearOthers();this.serviceTimer=0;this.input.clear();this.autoTestDriver=false;this.autoTestRoad=CIRCUIT;this.autoTestOffset=0;this.hasDrive=true;this.lastDamage=0;this.activity=null;this.speedTraps.clear();this.clock=0;this.aiClock=0;this.accumulator=0;this.race=new RaceManager();}
  private startAudio(){void this.audio.start().catch(()=>{});window.setTimeout(()=>{if(this.screen==='drive'&&this.audio.needsGesture&&this.save.settings.volume>0)this.toast('Click or press a key to enable audio. You can keep driving with your controller.',8);},700);}
  private session(operation:(ticket:number)=>Promise<void>,retry:()=>Promise<void>){
    const ticket=++this.loadingTicket;this.transitioning=true;this.loading=true;this.loadError='';this.retryOperation=retry;this.audio.pause();this.input.clear();this.loadingOverlay.show('Loading verified driving surfaces. Simulation is paused.');
    const pending=(async()=>{try{await operation(ticket);if(ticket!==this.loadingTicket)return;this.loading=false;this.retryOperation=null;this.loadingOverlay.hide();}catch(error){if(ticket!==this.loadingTicket)return;this.loadError=String(error);this.loading=true;this.loadingOverlay.show(this.loadError,true);}finally{if(ticket===this.loadingTicket)this.transitioning=false;}})();
    this.transitionPromise=pending;return pending;
  }
  startDrive(handling=false):Promise<void>{return this.session(async ticket=>{
    this.startAudio();this.prepareDrive();this.mode='Free Drive';this.world.clear();const spawn=handling?{...HANDLING.spawn,s:0,curvature:0}:this.freeSpawn();
    await this.world.prepare('exploration',[spawn]);if(ticket!==this.loadingTicket)return;this.changeCar(this.save.selected,spawn);if(!handling)await this.createTraffic();if(ticket!==this.loadingTicket)return;
    this.setScreen('drive');this.toast(handling?'Northstar · Skidpad, slalom, braking, banking and ride tests. No traffic on the pad.':'WASD or arrows to drive · C changes camera · M opens your map',6);
  },()=>this.startDrive(handling));}
  private async createTraffic(){await this.trafficSystem.populate(this.player,this.save.settings.traffic,this.clock);}
  startRace(start:RaceSessionStart={config:this.raceConfig,stage:0}):Promise<void>{
    // Capture before prepareDrive replaces the manager. The same immutable
    // request survives a failed world load without losing qualifying results.
    const request={config:{...start.config},stage:start.stage,grid:start.grid?[...start.grid]:undefined},config=request.config,stage=request.stage;
    return this.session(async ticket=>{
    this.startAudio();this.prepareDrive();this.mode=config.kind;this.world.clear();this.race.start(config,stage,request.grid);const order=this.race.state.grid,playerSlot=order.indexOf('player'),d=vehicleById(config.vehicleClass==='FORMULA'?'apex':'gtx');
    const grid=(slot:number)=>pointAt(CIRCUIT,CIRCUIT.length-18-Math.floor(slot/2)*14,(slot%2===0?-1:1)*3),p=grid(playerSlot);
    await this.world.prepare('racing',order.map((_,slot)=>grid(slot)));if(ticket!==this.loadingTicket)return;this.changeCar(d.id,p);
    for(let i=1;i<config.entrants;i++){const id=`racer-${i}`,spawn=grid(order.indexOf(id)),vehicle=new Vehicle(this.physics,d,id,spawn,spawn.yaw),visual=createLodCar(this.renderer.scene,d,{paint:['#ba5239','#65908f','#cdc9bb','#365a92','#dea658','#6b667d','#8cbaad'][i%7],wheels:'#9caaac',livery:1,brakeBias:.6,aero:1});this.renderer.registerCar(visual);this.opponents.push({vehicle,visual,input:neutralInput(),retired:false,stuck:0,depleted:0,pitDriver:new PitDriver(i-1)});}
    this.setScreen('drive');this.toast(this.race.state.phase==='countdown'?`Race · Starting P${playerSlot+1}. Make the moment count.`:this.race.state.phase==='qualifying'?'Qualifying · Your fastest valid lap sets the grid.':'Aster International · Find your braking points.',5);
  },()=>this.startRace(request));}
  private resetPlayer(){
    const onCourse=this.mode==='Free Drive'&&inHandlingCourse(this.player.node.position.x,this.player.node.position.z);
    const near=nearestRoadAt(this.player.node.position,this.mode==='Free Drive'?undefined:r=>r.id==='circuit');
    const p=onCourse?HANDLING.spawn:pointAt(near.road,near.progress,this.mode==='Free Drive'&&!near.road.oneWay?2:0);
    this.world.requestAround(p,true);this.player.reset(p,p.yaw);this.race.resetLap('player');this.input.clear();
    this.toast(onCourse?'Back at Northstar’s braking lane.':this.mode==='Free Drive'?'Back on the road.':'Back on circuit · current lap invalidated.');
  }
  async action(action:string,value?:string){
    if(action==='graphics-fallback'){await this.store.write(this.save);const url=new URL(location.href);url.searchParams.set('renderer','webgl');location.replace(url);return;}
    if(action==='screen'){this.setScreen(value as Screen);return;}
    if(action==='home'){this.loadingTicket++;this.transitioning=false;this.loading=false;this.loadError='';this.retryOperation=null;this.loadingOverlay.hide();this.world.clear();this.hasDrive=false;this.pausedFromDrive=false;this.clearOthers();this.race=new RaceManager();this.mode='Free Drive';this.applyPendingAutomaticQuality();this.setScreen('home');void this.store.write(this.save);return;}
    if(action==='start-drive'){await this.startDrive();return;}
    if(action==='handling'){await this.startDrive(true);return;}
    if(action==='start-race'||action==='retry-race'){await this.startRace();return;}
    if(action==='pause'){this.setScreen('pause');return;}
    if(action==='resume'){if(this.screen==='results'){await this.action('home');return;}this.setScreen(this.hasDrive?'drive':'home');return;}
    if(action==='select-car'){this.changeCar(value!);this.ui.invalidate();this.ui.render();return;}
    if(action==='reset'){this.resetPlayer();if(this.pausedFromDrive)this.setScreen('drive');return;}
    if(action==='setting'){const {key,value:v}=JSON.parse(value!);const next=structuredClone(this.save);(next.settings as unknown as Record<string,unknown>)[key]=typeof this.save.settings[key as keyof Settings]==='number'?Number(v):v;if(key==='quality')next.settings.automaticQuality=false;this.save=validateSave(next);if(key==='quality'||key==='automaticQuality'||key==='resolution'){this.pendingAutomaticQuality=null;this.adaptiveQuality.reset(this.save.settings.automaticQuality);}if(key==='quality'||key==='automaticQuality')this.ui.render(true);this.applySettings(key==='quality'||key==='resolution'||key==='automaticQuality');if(key==='traffic'&&this.mode==='Free Drive'&&this.hasDrive)await this.createTraffic();void this.store.write(this.save);return;}
    if(action==='custom'){const {key,value:v}=JSON.parse(value!);const setup=this.store.customization(this.save,this.save.selected);(setup as unknown as Record<string,unknown>)[key]=['paint','wheels'].includes(key)?v:Number(v);this.save.customization[this.save.selected]=setup;this.changeCar(this.save.selected);this.ui.render(true);return;}
    if(action==='race-config'){const {key,value:v}=JSON.parse(value!);(this.raceConfig as unknown as Record<string,unknown>)[key]=typeof this.raceConfig[key as keyof RaceSessionConfig]==='number'?Number(v):v;this.raceConfig.position=Math.min(this.raceConfig.position,this.raceConfig.entrants);this.ui.render(true);return;}
    if(action==='map-select'){this.mapSelection=value!;this.ui.render(true);return;}
    if(action==='navigate'){const landmark=LANDMARKS.find(l=>l.id===value)!;this.destination=landmark.id;this.route=this.graph.route({...this.player.state.position,yaw:this.player.state.yaw},landmarkPosition(landmark));if(!this.route.length)this.toast('No connected road route was found.');else this.toast(`Route set · ${landmark.name}`);this.ui.render(true);return;}
    if(action==='activity'){const l=LANDMARKS.find(l=>l.id===value)!;if(!this.hasDrive)await this.startDrive();this.activity={name:l.name,id:l.id,type:l.type,time:0,score:0,started:false};this.destination=l.id;this.route=this.graph.route({...this.player.state.position,yaw:this.player.state.yaw},landmarkPosition(l));this.setScreen('drive');this.toast(`Drive to ${l.name} to begin.`);return;}
    if(action==='end-session'){this.race.end();this.finishSession();return;}
    if(action==='next-session'){if(this.transitioning)return;const next=this.race.nextSession();if(next)await this.startRace(next);return;}
    if(action==='service'){const p=this.player.state.position,assigned=pitServiceBox(15);const station=LANDMARKS.find(l=>(l.type==='service'||l.type==='garage')&&atDestination(p,l,35)),inRaceBox=this.mode!=='Free Drive'&&distance(p,assigned.position)<3&&Math.abs(p.y-assigned.position.y)<3;if(Math.abs(this.player.state.speed)>1){this.toast('Come to a stop before servicing your car.');return;}if(this.player.state.grounded&&(station||inRaceBox)){this.serviceTimer=6;this.toast('Service in progress · refueling and replacing tires',6);}else this.toast(this.mode==='Free Drive'?'Stop at a service station.':'Stop inside your assigned Aster pit box · box 16.');return;}
    if(action==='toggle-sound'){this.save.settings.volume=this.save.settings.volume>0?0:.55;void this.store.write(this.save);this.toast(this.save.settings.volume?'Audio on':'Audio muted');return;}
    if(action==='save-export'){this.store.export(this.save);return;}
    if(action==='save-import'){const picker=document.createElement('input');picker.type='file';picker.accept='.json,application/json';picker.onchange=async()=>{try{const f=picker.files?.[0];if(!f)return;if(f.size>2_000_000)throw new Error('Save file is too large.');const imported=validateSave(JSON.parse(await f.text()));this.hasDrive=false;this.clearOthers();this.save=imported;this.pendingAutomaticQuality=null;this.adaptiveQuality.reset(this.save.settings.automaticQuality);this.changeCar(imported.selected);this.applySettings(true);await this.store.write(this.save);this.setScreen('settings');this.toast('Save imported.');}catch(e){this.toast(`Import failed: ${String(e)}`,7);}};picker.click();return;}
    if(action==='reset-save'){if(confirm('Reset Kairos settings, customization, and personal records on this device?')){this.save=defaultSave();this.pendingAutomaticQuality=null;this.adaptiveQuality.reset(true);this.hasDrive=false;this.clearOthers();this.changeCar(this.save.selected);this.applySettings(true);await this.store.write(this.save);this.ui.render(true);this.toast('Progress reset.');}return;}
    if(action==='bind'){this.toast(`Press a key for ${value}. Escape cancels.`,12);const listener=(event:KeyboardEvent)=>{event.preventDefault();event.stopImmediatePropagation();window.removeEventListener('keydown',listener,true);if(event.code!=='Escape'){for(const [key,code]of Object.entries(this.save.settings.bindings))if(code===event.code&&key!==value){this.toast(`That key is assigned to ${key}. Choose a different key.`,5);return;}this.save.settings.bindings[value!]=event.code;void this.store.write(this.save);}this.input.clear();this.toast('Controls updated.');this.ui.render(true);};window.addEventListener('keydown',listener,true);}
  }
  private streamingPositions(){return [this.player.node.position,...this.opponents.map(o=>o.vehicle.node.position),...this.trafficSystem.criticalPositions(this.player)];}
  private step(){
    if(this.transitioning||this.loadError)return false;if(this.screen!=='drive')return true;
    if(!this.world.readyFor(this.streamingPositions())){this.loading=true;const error=this.world.snapshot().errors[0]?.error;this.loadingOverlay.show(error??'Collision data is loading. Your car and all session clocks are paused.',!!error);return false;}
    if(this.loading){this.loading=false;this.loadingOverlay.hide();}
    const dt=FIXED_DT;this.clock+=dt;this.saveClock+=dt;this.aiClock+=dt;this.routeClock+=dt;
    const settings=this.save.settings;settings.time=(settings.time+dt*settings.timeRate/3600)%24;this.wetness=clamp(this.wetness+(settings.weather==='Rain'?.012:-.003)*dt,0,1);
    if(this.mode==='Free Drive')this.trafficSystem.beforeStep(this.player,this.clock,dt,this.wetness);
    const raceActive=this.mode!=='Free Drive',all=[this.player,...this.opponents.map(o=>o.vehicle),...this.traffic.map(t=>t.vehicle)];
    if(this.aiClock>=.1){const elapsed=this.aiClock;this.aiClock=0;for(let i=0;i<this.opponents.length;i++){
      const o=this.opponents[i],v=o.vehicle;
      if(o.retired){o.input={...neutralInput(),brake:1};continue;}
      const decision=o.pitDriver.update(elapsed,v,all,this.race.state,this.wetness);o.input=decision.input;if(decision.serviceComplete)v.restore();
      const beingServiced=o.pitDriver.phase==='service';
      o.depleted=v.state.fuel<=0&&Math.abs(v.state.speed)<.8&&v.state.grounded&&!beingServiced&&this.race.state.phase!=='countdown'?o.depleted+elapsed:0;
      if(o.depleted>=3){o.retired=true;o.input={...neutralInput(),brake:1};o.stuck=0;this.race.retire(v.id,'OUT OF FUEL');continue;}
      o.stuck=Math.abs(v.state.speed)<1.5&&(o.input.throttle>.2||!v.state.grounded)?o.stuck+elapsed:0;
      if(v.needsRecovery()||o.stuck>8){const n=nearestRoad(v.state.position.x,v.state.position.z,r=>r.id==='circuit'),p=pointAt(CIRCUIT,n.progress-8,i%2?3:-3);if(all.every(other=>other===v||distance(other.state.position,p)>9)){this.world.requestAround(p);v.reset(p,p.yaw);this.race.resetLap(v.id);o.stuck=0;o.pitDriver.reset();}}
    }
    }
    let input=this.autoTestDriver||this.race.player?.finished?racingInput(this.player,all,this.race.state.session.difficulty,this.wetness,0,this.autoTestDriver?this.autoTestRoad:CIRCUIT,dt,this.autoTestDriver?this.autoTestOffset:0):this.input.poll(dt,this.player.state.speed,this.player.definition.wheelbase,this.wetness,steeringContactGrip(this.player.state.wheels));this.lastInput=input;
    const countdown=this.race.state.phase==='countdown';if(countdown&&(this.autoTestDriver||input.throttle<.05))input={...neutralInput(),brake:1};
    if(this.serviceTimer>0){this.serviceTimer-=dt;input={...neutralInput(),brake:1};if(this.serviceTimer<=0){this.player.restore();this.toast('Service complete. Check traffic before rejoining.');}}
    this.player.preStep(input,settings,this.wetness,dt);
    const aiSettings={...settings,automatic:true,abs:true,tc:true,esc:true};
    for(const o of this.opponents)o.vehicle.preStep(o.retired?{...neutralInput(),brake:1}:countdown?{...neutralInput(),brake:1}:o.input,aiSettings,this.wetness,dt);
    for(const t of this.traffic)t.vehicle.preStep(t.input,aiSettings,this.wetness,dt);
    this.physics.step(dt);all.forEach(v=>v.postStep(dt));this.save.distance+=Math.abs(this.player.state.speed)*dt;
    if(this.player.needsRecovery())this.resetPlayer();
    if(raceActive){const samples=[this.player,...this.opponents.filter(o=>!o.retired).map(o=>o.vehicle)].map(v=>({id:v.id,position:v.state.position,speed:Math.abs(v.state.speed),grounded:v.state.grounded}));this.race.update(dt,samples);const best=this.race.player?.best;if(best&&Number.isFinite(best)){const key=`lap-${this.player.definition.id}`;this.save.records[key]=Math.min(this.save.records[key]??Infinity,best);}if(this.race.state.phase==='finished')this.finishSession();}
    else this.updateActivities(dt);
    if(this.routeClock>3){this.routeClock=0;const s=this.player.state,n=nearestRoadAt(s.position);if(s.grounded&&Math.abs(s.position.y-n.point.y)<3&&n.distance<n.road.width/2&&!this.save.discovered.includes(n.road.id))this.save.discovered.push(n.road.id);if(this.destination){const target=LANDMARKS.find(l=>l.id===this.destination)!;this.route=this.graph.route({...s.position,yaw:s.yaw},landmarkPosition(target));if(s.grounded&&atDestination(s.position,target,30)){if(!this.save.visits.includes(target.id))this.save.visits.push(target.id);this.toast(`Arrived · ${target.name}`);this.destination=null;this.route=[];}}}
    if(this.saveClock>5){this.saveClock=0;void this.store.write(this.save);}return true;
  }
  private updateActivities(dt:number){const s=this.player.state;for(const l of LANDMARKS.filter(l=>l.type==='speed')){if(Math.abs(s.speed)>1&&s.grounded&&atDestination(s.position,l,20)&&(this.speedTraps.get(l.id)??-100)<this.clock-8){this.speedTraps.set(l.id,this.clock);const result=evaluateSpeedTrap(this.save.records[l.id],s.speed,l.target??0);this.save.records[l.id]=result.bestKph;if(!this.save.visits.includes(l.id))this.save.visits.push(l.id);if(this.activity?.id===l.id){this.activity=null;this.destination=null;this.route=[];}this.toast(`${l.name} · ${Math.round(result.speedKph)} km/h${result.personalBest?' · PERSONAL BEST':''}${result.targetReached?' · TARGET REACHED':''}`,7);}}
    if(!this.activity)return;const a=this.activity,l=LANDMARKS.find(l=>l.id===a.id)!;if(!a.started){if(!s.grounded||!atDestination(s.position,l,30))return;a.started=true;a.time=0;this.toast(`${l.name} · GO`);if(l.type==='trial'&&l.end){this.route=this.graph.route({...s.position,yaw:s.yaw},landmarkPosition(l.end));this.destination=null;}if(l.type==='speed'){this.destination=null;this.route=[];this.toast(`${l.name} · accelerate through the trap`,6);return;}if(l.type==='scenic'){if(!this.save.visits.includes(l.id))this.save.visits.push(l.id);this.toast(`${l.name} · Discovered`);this.activity=null;this.destination=null;this.route=[];return;}}
    a.time+=dt;if(l.type==='trial'&&l.end&&s.grounded&&atDestination(s.position,l.end,25)){const old=this.save.records[l.id]??Infinity;this.save.records[l.id]=Math.min(old,a.time);this.toast(`${l.name} · ${formatTime(a.time)}${a.time<old?' · PERSONAL BEST':''}`,8);this.activity=null;this.route=[];}
    if(l.type==='drift'){const slip=Math.abs(wrap(Math.atan2(s.velocity.x,s.velocity.z)-s.yaw));if(Math.abs(s.speed)>7&&slip>.13&&slip<1.2&&s.grounded)a.score+=Math.abs(s.speed)*slip*dt*12;if(a.time>60||distance(s.position,l)>380){this.save.records[l.id]=Math.max(this.save.records[l.id]??0,a.score);this.toast(`${l.name} · ${Math.round(a.score)} points`,7);this.activity=null;}}
  }
  private finishSession(){this.audio.pause();this.setScreen('results');void this.store.write(this.save);}
  private applyPendingAutomaticQuality(){if(!this.pendingAutomaticQuality||!this.save.settings.automaticQuality)return;const changed=this.pendingAutomaticQuality!==this.save.settings.quality;this.save.settings.quality=this.pendingAutomaticQuality;this.pendingAutomaticQuality=null;this.applySettings(true);if(changed)void this.store.write(this.save);}
  private updateAdaptiveGraphics(frameMs:number){
    const decision=this.adaptiveQuality.sample(frameMs,{automaticQuality:this.save.settings.automaticQuality,benchmarkActive:!this.preparingPresentation&&!this.loading&&!this.transitioning,adaptationActive:this.screen==='drive'&&!this.loading&&!this.transitioning,quality:this.save.settings.quality});
    if(decision.quality){if(this.hasDrive&&decision.quality!==this.save.settings.quality){this.pendingAutomaticQuality=decision.quality;this.ui.update();}else{const changed=decision.quality!==this.save.settings.quality;this.save.settings.quality=decision.quality;this.applySettings(true);if(changed)void this.store.write(this.save);this.ui.render(true);}}
    else if(decision.dynamicScale!==undefined)this.renderer.setDynamicResolutionScale(decision.dynamicScale);
  }
  private graphicsState(){return {quality:this.save.settings.quality,automaticQuality:this.save.settings.automaticQuality,pendingQuality:this.pendingAutomaticQuality,...this.adaptiveQuality.state(),...this.renderer.graphicsState(),recovery:this.graphicsRecovery.snapshot()};}
  private frame(){const now=performance.now(),raw=(now-this.last)/1000;this.last=now;if(this.manual)return;if(document.hidden)return;if(raw>FIXED_DT*8)this.overloads++;const dt=Math.min(raw,.067);this.frameTimes.push(raw*1000);if(this.frameTimes.length>1800)this.frameTimes.shift();this.accumulator+=dt;let steps=0;const start=performance.now();while(this.accumulator>=FIXED_DT&&steps<8){if(!this.step()){this.accumulator=0;break;}this.accumulator-=FIXED_DT;steps++;}this.physicsMs=performance.now()-start;if(this.accumulator>=FIXED_DT){this.overloads++;this.accumulator%=FIXED_DT;}this.draw(dt,this.accumulator/FIXED_DT);this.updateAdaptiveGraphics(raw*1000);}
  private draw(dt:number,alpha=1){this.cameraClock+=dt;if(this.message&&this.cameraClock>this.messageUntil)this.message='';
    this.world.updateSignals(this.clock,this.save.settings.time);
    this.world.setEnabled(!this.garage);if(!this.garage&&!this.transitioning)this.world.update(this.player.state.position,this.player.state.velocity,[...this.opponents,...this.traffic].map(o=>({id:o.vehicle.id,position:o.vehicle.state.position,velocity:o.vehicle.state.velocity})));this.world.setWetness(this.wetness);
    this.world.updateLighting(this.player.state.position,this.save.settings.time,dt);
    this.renderer.update(this.player,this.visual,this.save.settings,dt,this.garage,this.cameraClock,this.wetness,alpha);
    for(const o of [...this.opponents,...this.traffic]){o.visual.root.setEnabled(!this.garage&&distance(o.vehicle.state.position,this.player.state.position)<650);o.visual.root.position.copyFrom(Vector3.Lerp(o.vehicle.previousPosition,o.vehicle.node.position,alpha));o.visual.root.rotationQuaternion=Quaternion.Slerp(o.vehicle.previousRotation,o.vehicle.node.rotationQuaternion!,alpha);o.visual.selectDetail?.(Vector3.Distance(o.visual.root.position,this.renderer.camera.position),this.save.settings.quality);o.visual.update(o.vehicle.state);this.renderer.registerCar(o.visual,o.vehicle.state.grounded);}
    this.showcase.forEach(c=>c.root.setEnabled(this.garage));this.renderer.prepareReflections(this.visual,this.save.settings,this.garage,this.cameraClock);this.renderer.render();this.audio.update(this.player.state,this.player.definition,this.lastInput.throttle,this.save.settings.volume,this.screen==='drive'&&!this.loading,this.save.settings.camera===2,this.wetness,this.save.settings.weather==='Rain');
    if(this.player.state.damage>this.lastDamage){this.audio.impact((this.player.state.damage-this.lastDamage)*5);this.input.rumble((this.player.state.damage-this.lastDamage)*8);this.lastDamage=this.player.state.damage;}
    this.uiClock+=dt;if(this.uiClock>.1){this.uiClock=0;this.ui.update();}if(!this.preparingPresentation)this.menuNavigation.update();this.loadingOverlay.update();
  }
  advanceTime(ms:number){
    this.manual=true;if(ms<=0){renderPreparationFrame(this.renderer.engine,()=>this.draw(0,1));this.ui.update();return Promise.resolve();}
    const run=async()=>{if(this.transitioning)await this.transitionPromise;if(this.loadError)throw new Error(this.loadError);this.testAccumulator+=Math.max(0,ms)/1000;const start=performance.now();
      try{while(this.testAccumulator>=FIXED_DT-1e-9){if(!this.step()){await this.world.waitForSurfaces(this.streamingPositions());if(this.loadError)throw new Error(this.loadError);continue;}this.testAccumulator-=FIXED_DT;}}catch(error){this.testAccumulator=0;throw error;}
      this.physicsMs=performance.now()-start;renderPreparationFrame(this.renderer.engine,()=>this.draw(ms/1000,1));this.ui.update();
    };
    const pending=this.advanceQueue.catch(()=>{}).then(run);this.advanceQueue=pending;return pending;
  }
  resumeRealTime(){this.manual=false;this.last=performance.now();this.accumulator=0;}
  /** Development verification hook. It selects a normal authored road while
   * retaining the same input, tire, drivetrain and collision systems. */
  setAutopilot(enabled:boolean,roadId='circuit',offset=0){const road=ROADS.find(road=>road.id===roadId);if(!road)throw new Error(`Unknown autopilot road: ${roadId}`);this.autoTestRoad=road;this.autoTestOffset=offset;this.autoTestDriver=enabled;}
  teleport(x:number,z:number,roadId?:string){const n=nearestRoad(x,z,roadId?r=>r.id===roadId:undefined);const p=pointAt(n.road,n.progress,2);this.world.requestAround(p,true);this.player.reset(p,p.yaw);this.race.resetLap('player');}
  snapshot(){return {screen:this.screen,pausedFromDrive:this.pausedFromDrive,mode:this.mode,loading:this.loading,loadError:this.loadError,streaming:this.world.snapshot(),renderer:this.renderer.rendererName,graphics:this.graphicsState(),coordinateSystem:'meters; Y up; +Z forward at yaw 0; +X right',player:this.player.state,playerPitBox:pitServiceBox(15),race:this.race.state,cells:this.world.cells.size,traffic:this.traffic.map(t=>({id:t.vehicle.id,position:t.vehicle.state.position,speed:t.vehicle.state.speed,path:t.agent.pathId,reason:t.agent.reason})),trafficSystem:this.trafficSystem.snapshot(),opponents:this.opponents.map(o=>({id:o.vehicle.id,position:o.vehicle.state.position,speed:o.vehicle.state.speed,retired:o.retired,depleted:o.depleted,pit:o.pitDriver.snapshot()})),destination:this.destination,routePoints:this.route.length,activity:this.activity,weather:this.save.settings.weather,wetness:this.wetness,time:this.save.settings.time,physicsMs:this.physicsMs,overloads:this.overloads,frameTimeP95:percentile(this.frameTimes,.95),message:this.message};}
  view():ViewModel{return {screen:this.screen,save:this.save,player:this.player.state,race:this.race.state,raceOrder:this.race.order(),raceStage:this.race.stage,raceConfig:this.mode==='Free Drive'||this.screen==='motorsport'?this.raceConfig:this.race.state.session,mode:this.mode,renderer:this.renderer.rendererName,graphics:this.graphicsState(),fps:this.renderer.engine.getFps(),cells:this.world.cells.size,drawCalls:this.renderer.scene.getActiveMeshes().length,triangles:this.renderer.scene.getActiveIndices()/3,wetness:this.wetness,clock:this.clock,route:this.route,destination:this.destination,mapSelection:this.mapSelection,activity:this.activity,message:this.message,storageError:this.store.error,pausedFromDrive:this.pausedFromDrive,trafficCount:this.traffic.length,physicsMs:this.physicsMs};}
}

const game=new Kairos();game.init().catch(e=>{console.error(e);document.querySelector('#loading-message')!.textContent=String(e.message??e);});
