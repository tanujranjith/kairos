/** Bump these fingerprints whenever their retained runtime files are rebuilt. */
export const MODEL_ASSET_VERSION='7-smooth-optics';
export const ENVIRONMENT_ASSET_VERSION='a51e9198f02a';

export const modelAssetUrl=(modelId:string,lod:number)=>`/models/${modelId}-lod${lod}.glb?v=${MODEL_ASSET_VERSION}`;
export const galleryEnvironmentUrl=()=>`/environment/fish-eagle-hill.env?v=${ENVIRONMENT_ASSET_VERSION}`;
