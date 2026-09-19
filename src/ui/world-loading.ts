import { ControllerMenuNavigator } from './controller-navigation';
export class WorldLoadingOverlay {
  private root:HTMLDivElement;
  private navigation:ControllerMenuNavigator;
  constructor(retry:()=>void,leave:()=>void){
    this.root=document.createElement('div');this.root.id='world-loading';this.root.hidden=true;this.root.setAttribute('role','status');this.root.setAttribute('aria-live','polite');
    this.root.innerHTML='<div class="world-loading-panel"><span class="eyebrow">KAIROS · WORLD STREAMING</span><h2>Preparing the road ahead</h2><p data-world-message></p><div class="world-loading-actions"><button id="world-retry">Retry loading</button><button id="world-leave">Return to menu</button></div></div>';
    document.body.append(this.root);this.root.querySelector('#world-retry')!.addEventListener('click',retry);this.root.querySelector('#world-leave')!.addEventListener('click',leave);
    this.navigation=new ControllerMenuNavigator(this.root,{isActive:()=>!this.root.hidden,context:()=>this.root.getAttribute('aria-busy')??'',onBack:leave});
  }
  show(message:string,error=false){const focusError=error&&(this.root.hidden||this.root.getAttribute('aria-busy')!=='false');this.root.hidden=false;document.querySelector<HTMLElement>('#ui')!.inert=true;this.root.setAttribute('aria-busy',String(!error));this.root.querySelector('h2')!.textContent=error?'The world could not load':'Preparing the road ahead';this.root.querySelector('[data-world-message]')!.textContent=message;this.root.querySelector<HTMLElement>('.world-loading-actions')!.hidden=!error;if(focusError)this.root.querySelector<HTMLButtonElement>('#world-retry')!.focus();}
  update(){this.navigation.update();}
  hide(){this.root.hidden=true;document.querySelector<HTMLElement>('#ui')!.inert=false;this.root.setAttribute('aria-busy','false');if(this.root.contains(document.activeElement))(document.activeElement as HTMLElement).blur();}
}
