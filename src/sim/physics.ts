import { Scene, Vector3, Quaternion, TransformNode, PhysicsBody, PhysicsShapeBox, PhysicsShapeMesh, PhysicsMotionType, HavokPlugin, PhysicsRaycastResult, Mesh } from '@babylonjs/core';
import type { PhysicsEngine } from '@babylonjs/core/Physics/v2/physicsEngine';
import HavokPhysics from '@babylonjs/havok';
import havokUrl from '@babylonjs/havok/lib/esm/HavokPhysics.wasm?url';
import type { VehicleDefinition, VehicleState, InputFrame, Settings, Customization, V3 } from '../core/types';
import { clamp, approach } from '../core/math';
import { nearestRoad, terrainHeight, inLake, onJunctionSurface } from '../content/world';
import { tireForces } from './tire';
import { inHandlingCourse } from '../content/handling-course';

export const FIXED_DT=1/120;
export const neutralInput=():InputFrame=>({throttle:0,brake:0,steer:0,handbrake:false,shift:0,reverse:false});
export class PhysicsWorld {
  engine:PhysicsEngine;
  constructor(public scene:Scene,public plugin:HavokPlugin){this.engine=scene.getPhysicsEngine() as PhysicsEngine;this.engine.setTimeStep(FIXED_DT);scene.physicsEnabled=false;}
  static async create(scene:Scene){const hk=await HavokPhysics({locateFile:()=>havokUrl});const plugin=new HavokPlugin(true,hk);scene.enablePhysics(new Vector3(0,-9.81,0),plugin);return new PhysicsWorld(scene,plugin);}
  step(dt=FIXED_DT){this.plugin.executeStep(dt,this.engine.getBodies());}
  addStaticMesh(mesh:Mesh){const body=new PhysicsBody(mesh,PhysicsMotionType.STATIC,true,this.scene);const shape=new PhysicsShapeMesh(mesh,this.scene);shape.material={friction:.55,restitution:.04};shape.filterMembershipMask=1;body.shape=shape;return {body,shape};}
  addBox(node:TransformNode,size:Vector3){const body=new PhysicsBody(node,PhysicsMotionType.STATIC,true,this.scene);const shape=new PhysicsShapeBox(Vector3.Zero(),Quaternion.Identity(),size,this.scene);shape.material={friction:.6,restitution:.08};shape.filterMembershipMask=1;body.shape=shape;return {body,shape};}
}
export class Vehicle {
  node:TransformNode;body:PhysicsBody;shape:PhysicsShapeBox;state:VehicleState;
  previousPosition=new Vector3();previousRotation=Quaternion.Identity();
  private linear=new Vector3();private angular=new Vector3();private forward=new Vector3();private right=new Vector3();private up=new Vector3();
  private hit=new PhysicsRaycastResult();private shiftTimer=0;private massTimer=0;private lastSpeed=0;private pendingReset=false;
  setup:Customization;
  constructor(public world:PhysicsWorld,public definition:VehicleDefinition,public id:string,spawn:V3,yaw:number,setup?:Customization) {
    const d=definition;this.setup=setup??{paint:d.color,wheels:'#b2bac0',livery:0,brakeBias:.6,aero:1};
    this.node=new TransformNode(`body-${id}`,world.scene);this.node.position.copyFromFloats(spawn.x,spawn.y+.7,spawn.z);this.node.rotationQuaternion=Quaternion.RotationYawPitchRoll(yaw,0,0);
    this.body=new PhysicsBody(this.node,PhysicsMotionType.DYNAMIC,false,world.scene);
    this.shape=new PhysicsShapeBox(new Vector3(0,.05,0),Quaternion.Identity(),new Vector3(d.width*.86,.38,d.length*.87),world.scene);
    this.shape.material={friction:.2,restitution:.08};this.shape.filterMembershipMask=2;this.body.shape=this.shape;
    this.body.setMassProperties({mass:d.mass+d.tank*.75,centerOfMass:new Vector3(0,-.12,d.drive==='FWD'?.12:-.05)});
    this.body.setLinearDamping(.015);this.body.setAngularDamping(.22);
    this.state={id,position:{...spawn},velocity:{x:0,y:0,z:0},yaw,speed:0,rpm:950,gear:1,steer:0,fuel:d.tank,wheels:Array.from({length:4},()=>({load:0,compression:0,slip:0,angle:0,omega:0,temperature:25,wear:1,contact:false})),grounded:false,surface:'Asphalt',damage:0,absActive:false,tcActive:false,distance:0};
    this.previousPosition.copyFrom(this.node.position);this.previousRotation.copyFrom(this.node.rotationQuaternion!);
  }
  reset(spawn:V3,yaw:number){this.node.position.copyFromFloats(spawn.x,spawn.y+.74,spawn.z);this.node.rotationQuaternion=Quaternion.RotationYawPitchRoll(yaw,0,0);this.node.computeWorldMatrix(true);this.body.disablePreStep=false;this.body.setLinearVelocity(Vector3.Zero());this.body.setAngularVelocity(Vector3.Zero());this.previousPosition.copyFrom(this.node.position);this.previousRotation.copyFrom(this.node.rotationQuaternion);this.state.wheels.forEach(w=>{w.omega=0;w.compression=0;});this.state.gear=1;this.state.speed=0;this.lastSpeed=0;this.pendingReset=true;}
  restore(){this.state.fuel=this.definition.tank;this.state.damage=0;this.state.wheels.forEach(w=>{w.wear=1;w.temperature=65;});}
  preStep(input:InputFrame,settings:Settings,wetness:number,dt=FIXED_DT) {
    // Let Havok consume the teleport before applying forces at the new wheel positions.
    if(this.pendingReset){this.pendingReset=false;return;}
    const d=this.definition,s=this.state;
    this.previousPosition.copyFrom(this.node.position);this.previousRotation.copyFrom(this.node.rotationQuaternion!);
    const matrix=this.node.computeWorldMatrix(true);this.body.getLinearVelocityToRef(this.linear);this.body.getAngularVelocityToRef(this.angular);
    Vector3.TransformNormalToRef(Vector3.Forward(),matrix,this.forward);Vector3.TransformNormalToRef(Vector3.Right(),matrix,this.right);Vector3.TransformNormalToRef(Vector3.Up(),matrix,this.up);
    const vLong=Vector3.Dot(this.linear,this.forward),speed=this.linear.length();s.speed=vLong;
    this.shiftTimer=Math.max(0,this.shiftTimer-dt);let throttle=input.throttle;
    if(input.reverse&&Math.abs(vLong)<1.5)s.gear=-1;
    if(!input.reverse&&throttle>.1&&s.gear===-1&&Math.abs(vLong)<1)s.gear=1;
    if(input.shift&&this.shiftTimer===0&&!settings.automatic){s.gear=clamp(s.gear+input.shift,1,d.gears.length);this.shiftTimer=.18;}
    const driven=[0,1,2,3].filter(i=>d.drive==='AWD'||(d.drive==='FWD'?i<2:i>=2));
    const meanOmega=driven.reduce((a,i)=>a+Math.abs(s.wheels[i].omega),0)/driven.length;
    let ratio=(s.gear===-1?3.1:d.gears[s.gear-1])*d.finalDrive;
    const wheelRpm=meanOmega*ratio*60/(Math.PI*2);
    s.rpm=approach(s.rpm,clamp(Math.max(950+throttle*1400,wheelRpm),900,d.redline+200),14,dt);
    if(settings.automatic&&this.shiftTimer===0&&s.gear>0){if(s.rpm>d.redline*.9&&s.gear<d.gears.length){s.gear++;this.shiftTimer=.18;}else if(s.rpm<d.redline*.37&&s.gear>1){s.gear--;this.shiftTimer=.18;}}
    ratio=(s.gear===-1?3.1:d.gears[s.gear-1])*d.finalDrive;
    const maxSteer=clamp(.57/(1+Math.abs(vLong)*.055),.115,.57);s.steer=approach(s.steer,input.steer*maxSteer,9,dt);
    const rpmFraction=s.rpm/d.redline,torque=d.torque*(.55+.45*Math.sin(clamp(rpmFraction,0,1)*Math.PI))*(1-s.damage*.16);
    if(this.shiftTimer>0)throttle*=.12;
    if(s.fuel<=0||s.rpm>d.redline)throttle=0;
    s.absActive=false;s.tcActive=false;
    const near=nearestRoad(this.node.position.x,this.node.position.z,undefined,1),onRoad=inHandlingCourse(this.node.position.x,this.node.position.z)||near.distance<near.road.width*.5+1||onJunctionSurface(this.node.position);
    s.surface=onRoad?'Asphalt':inLake(this.node.position.x,this.node.position.z)?'Water':'Grass';
    const surfaceMu=onRoad?1:.46;const wetMu=1-wetness*(d.class==='ROAD'?.28:.4);
    const rest=.32+d.travel*.5;
    const downforce=.5*1.225*d.downforce*speed*speed*this.setup.aero;
    this.body.applyForce(this.up.scale(-downforce),this.node.position);
    if(speed>.1)this.body.applyForce(this.linear.scale(-.5*1.225*d.drag*2.1*speed),this.node.position);
    let contacts=0;
    for(let i=0;i<4;i++){
      const wheel=s.wheels[i],front=i<2,side=i%2===0?-1:1;
      const local=new Vector3(side*d.track*.5,0,front?d.wheelbase*.5:-d.wheelbase*.5);
      const origin=Vector3.TransformCoordinates(local,matrix),to=origin.subtract(this.up.scale(rest+d.wheelRadius));
      this.hit.reset();this.world.engine.raycastToRef(origin,to,this.hit,{ignoreBody:this.body,collideWith:1,shouldHitTriggers:false});
      wheel.contact=this.hit.hasHit;const prevCompression=wheel.compression;
      if(!wheel.contact){wheel.compression=0;wheel.load=0;wheel.omega+=((driven.includes(i)?torque*ratio*throttle/driven.length:0)-wheel.omega*1.2)*dt/1.8;wheel.angle+=wheel.omega*dt;continue;}
      contacts++;
      const compression=clamp(rest-(this.hit.hitDistance-d.wheelRadius),0,rest);
      wheel.compression=compression;
      const contact=this.hit.hitPointWorld.clone(),r=contact.subtract(this.node.position),velocity=this.linear.add(Vector3.Cross(this.angular,r));
      const normal=this.hit.hitNormalWorld;const compressionVelocity=-Vector3.Dot(velocity,this.up);
      const antiRoll=(prevCompression-s.wheels[i^1].compression)*d.spring*.2;
      const load=clamp(compression*d.spring+compressionVelocity*d.damper+antiRoll,0,d.mass*9.81*1.8);
      wheel.load=load;this.body.applyForce(this.up.scale(load),origin);
      const steer=front?s.steer:0;
      let fwd=this.forward.scale(Math.cos(steer)).add(this.right.scale(Math.sin(steer)));
      fwd.subtractInPlace(normal.scale(Vector3.Dot(fwd,normal))).normalize();const sideDir=Vector3.Cross(normal,fwd).normalize();
      const longitudinal=Vector3.Dot(velocity,fwd),lateral=Vector3.Dot(velocity,sideDir);
      const drivenWheel=driven.includes(i),inertia=1.8;
      let driveTorque=drivenWheel?torque*ratio*throttle*.87/driven.length*(s.gear===-1?-1:1):0;
      const slipBefore=(wheel.omega*d.wheelRadius-longitudinal)/Math.max(3,Math.abs(longitudinal));
      if(settings.tc&&slipBefore>.14&&throttle>0&&drivenWheel){driveTorque*=clamp(.14/slipBefore,.06,1);s.tcActive=true;}
      if(drivenWheel)driveTorque-=(1-throttle)*Math.sign(wheel.omega)*Math.min(65,Math.abs(wheel.omega)*2);
      const partner=s.wheels[i^1];if(drivenWheel)driveTorque+=(partner.omega-wheel.omega)*(d.drive==='FWD'?6:12);
      wheel.omega+=driveTorque*dt/inertia;
      const brakeDistribution=front?this.setup.brakeBias:1-this.setup.brakeBias;
      let brakeTorque=input.brake*d.mass*9.81*.16*brakeDistribution+(input.handbrake&&!front?2200:0);
      if(settings.abs&&input.brake>0&&longitudinal>3&&wheel.omega*d.wheelRadius<longitudinal*.82){brakeTorque*=.12;s.absActive=true;}
      wheel.omega=Math.sign(wheel.omega)*Math.max(0,Math.abs(wheel.omega)-brakeTorque*dt/inertia);
      const slip=(wheel.omega*d.wheelRadius-longitudinal)/Math.max(3,Math.abs(longitudinal));
      const angle=Math.atan2(lateral,Math.max(2,Math.abs(longitudinal)));
      const temperatureGrip=d.class==='ROAD'?1:clamp(.82+(wheel.temperature-25)*.004,.8,1.08);
      const mu=d.grip*surfaceMu*wetMu*(.65+.35*wheel.wear)*temperatureGrip*(input.handbrake&&!front?.62:1);
      // Implicit wheel/contact solve. Explicit tire torque at 120 Hz exaggerates slip
      // because the light rotating wheel can change speed much faster than the chassis.
      const relative=wheel.omega*d.wheelRadius-longitudinal;
      const compliance=(d.wheelRadius*d.wheelRadius/inertia+4/d.mass)*dt;
      let low=-load*mu*1.2,high=load*mu*1.2;
      for(let iteration=0;iteration<12;iteration++){
        const force=(low+high)*.5;
        const response=tireForces((relative-force*compliance)/Math.max(3,Math.abs(longitudinal)),angle,load,mu).longitudinal;
        if(force>response)high=force;else low=force;
      }
      const fx=(low+high)*.5,settledSlip=(relative-fx*compliance)/Math.max(3,Math.abs(longitudinal));
      const forces=tireForces(settledSlip,angle,load,mu);
      const fy=clamp(forces.lateral,-Math.abs(lateral)*d.mass/4/dt,Math.abs(lateral)*d.mass/4/dt);
      this.body.applyForce(fwd.scale(fx).add(sideDir.scale(fy)),contact);
      wheel.omega-=fx*d.wheelRadius*dt/inertia;wheel.angle+=wheel.omega*dt;wheel.slip=approach(wheel.slip,Math.hypot(settledSlip,angle),15,dt);
      wheel.temperature=clamp(wheel.temperature+(Math.abs(fx*(wheel.omega*d.wheelRadius-longitudinal))+Math.abs(fy*lateral))*.00002*dt-(wheel.temperature-(25-wetness*6))*.012*dt,20,160);
      wheel.wear=clamp(wheel.wear-dt*(Math.abs(fy*lateral)+Math.abs(fx*slip))*.000000015,0,1);
      // Static tire contact counters gravity on a slope while brake is held.
      if(Math.abs(longitudinal)<.5&&input.brake>.2){const gravityAlong=Vector3.Dot(new Vector3(0,-9.81,0),fwd)*d.mass/4;this.body.applyForce(fwd.scale(-gravityAlong),contact);}
    }
    s.grounded=contacts>1;
    if(settings.esc&&contacts>1&&speed>4){const sideSpeed=Vector3.Dot(this.linear,this.right);this.body.applyTorque(this.up.scale(-this.angular.y*Math.abs(sideSpeed)*d.mass*.045));}
    if(contacts&&speed>.05)this.body.applyForce(this.linear.scale(-d.mass*9.81*.013/Math.max(speed,1)),this.node.position);
    s.fuel=Math.max(0,s.fuel-dt*(.00012+throttle*d.power*(d.class==='ROAD'?.00003:.00008))*(s.rpm/d.redline+.3));
    this.massTimer+=dt;if(this.massTimer>1){this.massTimer=0;this.body.setMassProperties({mass:d.mass+s.fuel*.75,centerOfMass:new Vector3(0,-.12,d.drive==='FWD'?.12:-.05)});}
  }
  postStep(dt=FIXED_DT){
    this.body.disablePreStep=true;this.body.getLinearVelocityToRef(this.linear);const s=this.state,p=this.node.position;
    s.position={x:p.x,y:p.y,z:p.z};s.velocity={x:this.linear.x,y:this.linear.y,z:this.linear.z};s.yaw=this.node.rotationQuaternion!.toEulerAngles().y;
    const fwd=Vector3.TransformNormal(Vector3.Forward(),this.node.computeWorldMatrix(true));s.speed=Vector3.Dot(this.linear,fwd);s.distance+=Math.abs(s.speed)*dt;
    const delta=Math.abs(this.lastSpeed)-Math.abs(s.speed);if(delta>5)s.damage=clamp(s.damage+delta*.003,0,1);this.lastSpeed=s.speed;
  }
  safeSpawn(){const p=this.node.position;const r=nearestRoad(p.x,p.z);return {position:{x:r.point.x,y:r.point.y,z:r.point.z},yaw:r.point.yaw};}
  needsRecovery(){return this.node.position.y<terrainHeight(this.node.position.x,this.node.position.z)-8||Math.abs(this.node.position.x)>2300||Math.abs(this.node.position.z)>2300||!Number.isFinite(this.node.position.x);}
  dispose(){this.body.dispose();this.shape.dispose();this.node.dispose();}
}
