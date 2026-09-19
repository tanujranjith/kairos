import type { SaveGame, Settings, Customization } from './types';
import { defaultSave, DEFAULT_SETTINGS, VEHICLES } from '../content/vehicles';
import { clamp } from './math';
const object=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
export function validateSave(value:unknown):SaveGame {
  if(!object(value)||value.version!==1)throw new Error('This is not a supported Kairos save.');
  const clean=defaultSave();if(typeof value.selected==='string'&&VEHICLES.some(v=>v.id===value.selected))clean.selected=value.selected;
  if(object(value.settings)){
    const s=value.settings;const numeric:Record<string,[number,number]>={resolution:[.7,1.5],volume:[0,1],time:[0,24],timeRate:[0,60],traffic:[0,32],deadzone:[0,.4],steerSensitivity:[.3,1.4],camera:[0,4]};
    for(const key of Object.keys(DEFAULT_SETTINGS))if(typeof s[key]===typeof DEFAULT_SETTINGS[key as keyof Settings]&&key!=='bindings'){
      if(key in numeric){const n=s[key] as number;if(Number.isFinite(n))(clean.settings as unknown as Record<string,unknown>)[key]=clamp(n,...numeric[key]);}
      else if(typeof s[key]==='boolean')(clean.settings as unknown as Record<string,unknown>)[key]=s[key];
    }
    if(['Low','Medium','High','Ultra'].includes(String(s.quality)))clean.settings.quality=s.quality as Settings['quality'];
    if(['Clear','Cloudy','Overcast','Rain'].includes(String(s.weather)))clean.settings.weather=s.weather as Settings['weather'];
    if(s.units==='mph'||s.units==='km/h')clean.settings.units=s.units;
    if(object(s.bindings))for(const key of Object.keys(clean.settings.bindings)){const code=s.bindings[key];if(typeof code==='string'&&/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Escape|ShiftLeft|ControlLeft|Tab|Enter)$/.test(code))clean.settings.bindings[key]=code;}
  }
  if(object(value.customization))for(const vehicle of VEHICLES){const c=value.customization[vehicle.id];if(!object(c))continue;const hex=(v:unknown,fallback:string)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:fallback;clean.customization[vehicle.id]={paint:hex(c.paint,vehicle.color),wheels:hex(c.wheels,'#b2bac0'),livery:clamp(Number(c.livery)||0,0,2),brakeBias:clamp(Number(c.brakeBias)||.6,.45,.72),aero:clamp(Number(c.aero)||1,.6,1.4)};}
  if(object(value.records))for(const [key,n]of Object.entries(value.records))if(key.length<120&&typeof n==='number'&&Number.isFinite(n)&&n>=0)clean.records[key]=n;
  for(const key of ['discovered','visits'] as const)if(Array.isArray(value[key]))clean[key]=[...new Set(value[key].filter((v):v is string=>typeof v==='string'&&v.length<100))].slice(0,10000);
  clean.settings.camera=Math.round(clean.settings.camera);clean.settings.traffic=Math.round(clean.settings.traffic);for(const custom of Object.values(clean.customization))custom.livery=Math.round(custom.livery);
  clean.distance=typeof value.distance==='number'&&Number.isFinite(value.distance)?Math.max(0,value.distance):0;return clean;
}
export class SaveStore {
  private db:IDBDatabase|null=null;private queue:Promise<void>=Promise.resolve();error='';onError:(message:string)=>void=()=>{};
  async open():Promise<SaveGame>{
    try{
      this.db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('kairos',1);r.onupgradeneeded=()=>r.result.createObjectStore('profile');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Storage is busy in another tab.'));});
      const value=await new Promise<unknown>((resolve,reject)=>{const r=this.db!.transaction('profile').objectStore('profile').get('save');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      if(!value)return defaultSave();
      try{return validateSave(value);}catch(error){
        // Preserve a corrupt/unsupported profile before a fresh profile can overwrite it.
        await new Promise<void>((resolve,reject)=>{const tx=this.db!.transaction('profile','readwrite');tx.objectStore('profile').put(value,`recovery-${Date.now()}`);tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error);}).catch(()=>{});
        throw error;
      }
    }catch(error){this.error=`Progress cannot be loaded: ${String(error)}. Playing with a fresh in-memory profile; export a backup before closing.`;return defaultSave();}
  }
  write(save:SaveGame){
    const snapshot=structuredClone(save);
    this.queue=this.queue.catch(()=>{}).then(()=>new Promise<void>((resolve,reject)=>{
      if(!this.db){reject(new Error('Storage is unavailable'));return;}
      try{const tx=this.db.transaction('profile','readwrite');tx.objectStore('profile').put(snapshot,'save');tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error);}catch(error){reject(error);}
    }));
    return this.queue.catch(()=>{const message='Progress could not be saved. Storage is unavailable or full; use Export save before closing.';if(this.error!==message){this.error=message;this.onError(message);}});
  }
  export(save:SaveGame){const url=URL.createObjectURL(new Blob([JSON.stringify(save,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`kairos-save-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  customization(save:SaveGame,id:string):Customization{return save.customization[id]??{paint:VEHICLES.find(v=>v.id===id)!.color,wheels:'#b2bac0',livery:0,brakeBias:.6,aero:1};}
}
