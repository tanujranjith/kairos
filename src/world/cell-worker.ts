import { buildCellBlueprint,blueprintTransfers } from './cell-blueprint';
import type { Quality } from '../core/types';
interface BuildRequest {id:number;cx:number;cz:number;quality:Quality}
const scope=self as unknown as {onmessage:((event:MessageEvent<BuildRequest>)=>void)|null;postMessage:(message:unknown,transfer?:Transferable[])=>void};
scope.onmessage=event=>{const {id,cx,cz,quality}=event.data;try{const blueprint=buildCellBlueprint(cx,cz,quality);scope.postMessage({id,blueprint},blueprintTransfers(blueprint));}catch(error){scope.postMessage({id,error:String(error)});}};
