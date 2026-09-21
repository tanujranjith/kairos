import {Constants, InternalTextureSource, Mesh, type InternalTexture, type Scene} from '@babylonjs/core';

const MIB=1024*1024;

const formatComponents=(format:number)=>{
  if(format===Constants.TEXTUREFORMAT_ALPHA||format===Constants.TEXTUREFORMAT_LUMINANCE||format===Constants.TEXTUREFORMAT_RED||format===Constants.TEXTUREFORMAT_R||format===Constants.TEXTUREFORMAT_RED_INTEGER||format===Constants.TEXTUREFORMAT_R_INTEGER||format===Constants.TEXTUREFORMAT_DEPTH16||format===Constants.TEXTUREFORMAT_DEPTH24||format===Constants.TEXTUREFORMAT_DEPTH32_FLOAT||format===Constants.TEXTUREFORMAT_STENCIL8)return 1;
  if(format===Constants.TEXTUREFORMAT_LUMINANCE_ALPHA||format===Constants.TEXTUREFORMAT_RG||format===Constants.TEXTUREFORMAT_RG_INTEGER)return 2;
  if(format===Constants.TEXTUREFORMAT_RGB||format===Constants.TEXTUREFORMAT_RGB_INTEGER||format===Constants.TEXTUREFORMAT_RGB16_UNORM||format===Constants.TEXTUREFORMAT_RGB16_SNORM)return 3;
  return 4;
};

const bytesPerComponent=(type:number)=>{
  if(type===Constants.TEXTURETYPE_FLOAT||type===Constants.TEXTURETYPE_INT||type===Constants.TEXTURETYPE_UNSIGNED_INTEGER)return 4;
  if(type===Constants.TEXTURETYPE_HALF_FLOAT||type===Constants.TEXTURETYPE_SHORT||type===Constants.TEXTURETYPE_UNSIGNED_SHORT)return 2;
  return 1;
};

const textureBytes=(texture:InternalTexture)=>{
  const width=Math.max(1,texture.width),height=Math.max(1,texture.height),depth=Math.max(1,texture.depth||1);
  const faces=texture.isCube?6:1,layers=texture.is3D||texture.is2DArray?depth:1;
  const mipmapped=texture.generateMipMaps||texture.useMipMaps===true||texture.mipLevelCount>1||texture._source===InternalTextureSource.CubePrefiltered;
  const mipFactor=mipmapped?(texture.is3D?8/7:4/3):1;
  const multisampleFactor=texture.samples>1?texture.samples+1:1;
  const bytesPerPixel=formatComponents(texture.format)*bytesPerComponent(texture.type);
  return Math.ceil(width*height*faces*layers*mipFactor*multisampleFactor*bytesPerPixel);
};

/**
 * Conservative development estimate of resident scene GPU allocations.
 *
 * Babylon's real GPU buffers are counted by DataBuffer capacity and internal
 * textures are de-duplicated by identity. A 25% allowance covers shader,
 * uniform and driver-side allocations that browser APIs do not expose.
 */
export function auditGpuResources(scene:Scene){
  const buffers=new Map<number,{bytes:number;kind:'vertex'|'index'}>();
  for(const geometry of scene.geometries){
    for(const vertex of Object.values(geometry.getVertexBuffers()??{})){
      const data=vertex.getBuffer();if(data&&!buffers.has(data.uniqueId))buffers.set(data.uniqueId,{bytes:data.capacity,kind:'vertex'});
    }
    const index=geometry.getIndexBuffer();
    if(index&&!buffers.has(index.uniqueId)){
      const indices=geometry.getIndices(),count=indices?.length??geometry.getTotalIndices();
      buffers.set(index.uniqueId,{bytes:index.capacity||count*(index.is32Bits?4:2),kind:'index'});
    }
  }
  let vertexBytes=0,indexBytes=0;
  for(const buffer of buffers.values()){if(buffer.kind==='vertex')vertexBytes+=buffer.bytes;else indexBytes+=buffer.bytes;}

  // Babylon stores these transforms outside ordinary Geometry buffers.
  const meshes=scene.meshes.filter((mesh):mesh is Mesh=>mesh instanceof Mesh);
  const thinInstanceBytes=meshes.reduce((sum,mesh)=>sum+mesh.thinInstanceCount*16*4,0);
  const instanceBytes=meshes.reduce((sum,mesh)=>sum+mesh.instances.length*16*4,0);
  const internals=scene.getEngine().getLoadedTexturesCache().filter(texture=>texture.isReady);
  const textures=[...new Map(internals.map(texture=>[texture.uniqueId,texture])).values()];
  const textureRows=textures.map(texture=>({
    id:texture.uniqueId,
    name:texture.url||`internal-${texture.uniqueId}`,
    size:[texture.width,texture.height,texture.isCube?6:Math.max(1,texture.depth||1)],
    bytes:textureBytes(texture),
  })).sort((a,b)=>b.bytes-a.bytes);
  const textureBytesTotal=textureRows.reduce((sum,row)=>sum+row.bytes,0);

  // Account for the browser-owned swapchain colour/depth buffers, which are
  // not represented in Babylon's loaded texture cache.
  const engine=scene.getEngine(),framebufferBytes=engine.getRenderWidth()*engine.getRenderHeight()*16;
  const accountedBytes=vertexBytes+indexBytes+thinInstanceBytes+instanceBytes+textureBytesTotal+framebufferBytes;
  const contingencyBytes=Math.ceil(accountedBytes*.25),estimatedBytes=accountedBytes+contingencyBytes;
  return {
    budgetBytes:256*MIB,
    estimatedBytes,
    estimatedMiB:estimatedBytes/MIB,
    headroomMiB:(256*MIB-estimatedBytes)/MIB,
    accountedBytes,
    contingencyBytes,
    geometry:{vertexBytes,indexBytes,thinInstanceBytes,instanceBytes,buffers:buffers.size,geometries:scene.geometries.length},
    textures:{bytes:textureBytesTotal,count:textures.length,largest:textureRows.slice(0,8)},
    framebufferBytes,
    resolution:[engine.getRenderWidth(),engine.getRenderHeight()],
  };
}
