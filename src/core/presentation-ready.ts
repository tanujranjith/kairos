/** A standalone draw must submit its frame before yielding. In WebGPU, keeping
 * its swap-chain texture across an async yield can submit a destroyed texture. */
export function renderPreparationFrame(engine:{beginFrame:()=>void;endFrame:()=>void},draw:()=>void){
  engine.beginFrame();try{draw();}finally{engine.endFrame();}
}

/** Render without advancing simulation until real resources are ready. Two
 * ready draws allow a completed reflection to be bound on the following draw. */
export async function preparePresentation(
  draw:()=>void,
  ready:()=>boolean,
  options:{now?:()=>number;yieldFrame?:()=>Promise<void>;timeoutMs?:number}={},
){
  const now=options.now??(()=>performance.now());
  const yieldFrame=options.yieldFrame??(()=>new Promise<void>(resolve=>setTimeout(resolve,16)));
  const deadline=now()+(options.timeoutMs??30_000);
  let consecutive=0;
  while(consecutive<2){
    if(now()>=deadline)throw new Error('Graphics preparation timed out. Reload or try another graphics renderer.');
    draw();consecutive=ready()?consecutive+1:0;
    if(consecutive<2)await yieldFrame();
  }
}
