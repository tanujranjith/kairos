import {Texture,type Scene} from '@babylonjs/core';

export interface CompressedTextureMetadata {kairosCompressedSource:string;kairosFallback:boolean;fallbackReason?:string}

function rgbaDataUrl(data:Uint8Array,width:number,height:number){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');if(!context)throw new Error('Canvas 2D is unavailable for the texture fallback.');
  context.putImageData(new ImageData(new Uint8ClampedArray(data),width,height),0,0);
  return canvas.toDataURL('image/png');
}

/** Loads a same-origin KTX2 texture and lazily rebuilds the exact original
 * procedural pixels only when the asset or decoder fails. */
export function compressedTexture(scene:Scene,url:string,name:string,width:number,height:number,fallback:()=>Uint8Array,gamma:boolean,scale=1){
  const metadata:CompressedTextureMetadata={kairosCompressedSource:url,kairosFallback:false};let fallbackStarted=false,disposed=false;
  let texture:Texture;
  const fail=(message?:string,exception?:unknown)=>{
    if(fallbackStarted||disposed)return;fallbackStarted=true;metadata.kairosFallback=true;metadata.fallbackReason=message??String(exception??'unknown KTX2 error');
    console.warn(`Kairos texture fallback: ${url} · ${metadata.fallbackReason}`);
    try{texture.updateURL(rgbaDataUrl(fallback(),width,height),undefined,undefined,'.png');}
    catch(error){console.error(`Kairos could not construct the fallback for ${url}.`,error);}
  };
  texture=new Texture(url,scene,false,false,Texture.TRILINEAR_SAMPLINGMODE,undefined,fail);
  texture.onDisposeObservable.addOnce(()=>{disposed=true;});
  texture.name=name;texture.gammaSpace=gamma;texture.wrapU=texture.wrapV=Texture.WRAP_ADDRESSMODE;texture.anisotropicFilteringLevel=8;texture.uScale=texture.vScale=scale;texture.metadata=metadata;
  return texture;
}
