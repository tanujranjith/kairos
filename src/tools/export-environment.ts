import { HDRCubeTexture, EnvironmentTextureTools, Scene } from '@babylonjs/core';

/** Development-only conversion: source HDR never ships in the static production directory. */
export async function exportGalleryEnvironment(){
  const scene=new Scene(window.kairos!.renderer.engine);
  try{
    const texture=await new Promise<HDRCubeTexture>((resolve,reject)=>{
      const map=new HDRCubeTexture('/assets/sources/fish_eagle_hill_2k.hdr',scene,512,false,true,false,true,()=>resolve(map),(message,error)=>reject(error??new Error(message)));
    });
    const data=await EnvironmentTextureTools.CreateEnvTextureAsync(texture,{imageType:'image/png'});
    return Array.from(new Uint8Array(data));
  }finally{scene.dispose();}
}
