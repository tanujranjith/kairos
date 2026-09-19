import { RawCubeTexture, Constants, Texture, Vector3, type Scene } from '@babylonjs/core';

/** Direction-correct seamless cubemaps. Studio softboxes produce readable paint/glass highlights. */
export function lightingEnvironment(scene:Scene,studio=false){
  const size=128,faces:Uint8Array[]=[],sun=new Vector3(-.55,.25,.65).normalize();
  for(let face=0;face<6;face++){
    const data=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const u=(x+.5)/size*2-1,v=(y+.5)/size*2-1;
      const direction=[new Vector3(1,-v,-u),new Vector3(-1,-v,u),new Vector3(u,1,v),new Vector3(u,-1,-v),new Vector3(u,-v,1),new Vector3(-u,-v,-1)][face].normalize();
      const h=direction.y,az=Math.atan2(direction.z,direction.x),horizon=Math.exp(-Math.abs(h)*8);
      const sky=[.24,.40,.60],ground=[.12,.15,.13],warm=[.85,.65,.42];
      let c=(h>0?sky:ground).map((b,i)=>b*(1-horizon*.65)+warm[i]*horizon*.65);
      const glow=Math.pow(Math.max(0,Vector3.Dot(direction,sun)),180)*.85;
      c=c.map((b,i)=>b+glow*[1,.8,.5][i]);
      if(studio){
        const ceiling=h>.32,strip=ceiling&&Math.abs(Math.sin(az*2))<.10,window=h>-.12&&h<.35&&direction.z<-.3;
        c=strip?[1,.97,.91]:window?[.77,.79,.74]:ceiling?[.12,.15,.17]:c.map(b=>b*.42);
      }
      const o=(y*size+x)*4;c.forEach((v,i)=>data[o+i]=Math.min(255,v*255));data[o+3]=255;
    }faces.push(data);
  }
  const cube=new RawCubeTexture(scene,faces,size,Constants.TEXTUREFORMAT_RGBA,Constants.TEXTURETYPE_UNSIGNED_BYTE,true,false,Texture.TRILINEAR_SAMPLINGMODE);cube.name=studio?'original-studio-environment':'original-valley-environment';cube.gammaSpace=true;return cube;
}
