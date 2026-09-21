export const surfaceKinds:readonly ['asphalt','meadow','gravel','concrete','stone','bark','water','cliff','boulder'];
export type GeneratedSurfaceKind=typeof surfaceKinds[number];
export function periodicNoise(x:number,y:number,period:number):number;
export function surfacePixels(kind:GeneratedSurfaceKind,size?:number):{color:Uint8Array;normal:Uint8Array};
export function cloudAtlas(size?:number):Uint8Array;
