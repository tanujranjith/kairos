import type { InputFrame, Settings } from './types';
import { approach, clamp } from './math';
import { keyboardSteeringScale } from './steering';
export class Input {
  keys=new Set<string>();private steer=0;private throttle=0;private brake=0;private shift=0;private previousButtons:boolean[]=[];private padIdentity:string|null=null;private clearVersion=0;lastDevice='keyboard';onAction:(action:string)=>void=()=>{};
  constructor(private settings:()=>Settings){window.addEventListener('keydown',e=>{if(e.defaultPrevented||e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement||(e.target instanceof HTMLElement&&e.target.isContentEditable))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();this.keys.add(e.code);this.lastDevice='keyboard';if(!e.repeat){for(const [action,code]of Object.entries(this.settings().bindings))if(e.code===code){if(action==='up')this.shift=1;else if(action==='down')this.shift=-1;else if(!['throttle','brake','left','right','handbrake'].includes(action))this.onAction(action);}if(e.code==='F3')this.onAction('telemetry');}});window.addEventListener('keyup',e=>this.keys.delete(e.code));window.addEventListener('blur',()=>this.clear());window.addEventListener('gamepaddisconnected',()=>this.clear());}
  clear(){this.keys.clear();this.steer=0;this.throttle=0;this.brake=0;this.shift=0;this.previousButtons=[];this.padIdentity=null;this.clearVersion++;this.lastDevice='keyboard';}
  rumble(strength:number){const pad=Array.from(navigator.getGamepads?.()??[]).find(p=>p?.connected);void pad?.vibrationActuator?.playEffect('dual-rumble',{duration:120,strongMagnitude:clamp(strength,0,1),weakMagnitude:clamp(strength*.5,0,1)}).catch(()=>{});}
  poll(dt:number,speed:number,wheelbase=2.65,wetness=0,surfaceGrip=1):InputFrame {
    const s=this.settings(),key=(n:string,alt?:string)=>this.keys.has(s.bindings[n])||(alt?this.keys.has(alt):false);let steering=Number(key('right','ArrowRight'))-Number(key('left','ArrowLeft')),throttle=Number(key('throttle','ArrowUp')),brake=Number(key('brake','ArrowDown')),handbrake=key('handbrake');
    const pad=Array.from(navigator.getGamepads?.()??[]).find(p=>p?.connected);
    if(pad){const axis=pad.axes[0]??0;if(Math.abs(axis)>s.deadzone||pad.buttons.some(b=>b.pressed))this.lastDevice='controller';if(this.lastDevice==='controller'){steering=Math.sign(axis)*Math.pow(clamp((Math.abs(axis)-s.deadzone)/(1-s.deadzone),0,1),1.4);throttle=pad.buttons[7]?.value??0;brake=pad.buttons[6]?.value??0;handbrake=pad.buttons[0]?.pressed??false;}
      const identity=`${pad.index}:${pad.id}`,buttons=pad.buttons.map(b=>b.pressed);
      // Seed edges on connect/resume. A button held in a menu is not a new driving action.
      const previous=this.padIdentity===identity?this.previousButtons:buttons;
      this.padIdentity=identity;this.previousButtons=buttons;const version=this.clearVersion;
      const actions:Record<number,string>={1:'camera',2:'reset',3:'map',9:'pause'};
      for(let i=0;i<buttons.length;i++){if(buttons[i]&&!previous[i]){if(i===4)this.shift=-1;else if(i===5)this.shift=1;else if(actions[i])this.onAction(actions[i]);}if(version!==this.clearVersion)break;}
    }else if(this.padIdentity!==null){this.clear();}
    const keyboard=this.lastDevice==='keyboard';
    const steeringTarget=steering*s.steerSensitivity*(keyboard?keyboardSteeringScale(speed,wheelbase,wetness,surfaceGrip):1);
    // Digital steering already has a speed/surface envelope. Respond promptly
    // inside it rather than stacking a slow input filter onto the physical rack.
    this.steer=approach(this.steer,steeringTarget,steering===0?(keyboard?12:7):(keyboard?7:4.5),dt);this.throttle=approach(this.throttle,throttle,8,dt);this.brake=approach(this.brake,brake,12,dt);
    const reverse=brake>.1&&speed<.3&&throttle<.1;const result={steer:this.steer,throttle:reverse?this.brake:this.throttle,brake:reverse?0:this.brake,handbrake,shift:this.shift,reverse};this.shift=0;return result;
  }
}
