import { Engine, SceneInstrumentation } from '@babylonjs/core';

/** Development-only submission audit. This is not a GPU/frame-pacing benchmark. */
export async function auditRendering(frames=36){
  const game=window.kairos!,scene=game.renderer.scene,instrument=new SceneInstrumentation(scene);
  instrument.captureFrameTime=true;instrument.captureRenderTargetsRenderTime=true;
  const rows=[];await scene.whenReadyAsync();
  try{
    for(let frame=0;frame<frames;frame++){
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      const before=game.renderer.reflections.snapshot().captures;
      const start=performance.now();await game.advanceTime(1000/30);
      rows.push({submitMs:performance.now()-start,sceneMs:instrument.frameTimeCounter.current,renderTargetsMs:instrument.renderTargetsRenderTimeCounter.current,drawCalls:instrument.drawCallsCounter.current,activeTriangles:scene.getActiveIndices()/3,probeCaptured:game.renderer.reflections.snapshot().captures>before});
    }
  }finally{instrument.dispose();}
  return {renderer:game.renderer.rendererName,adapter:game.renderer.engine instanceof Engine?game.renderer.engine.getGlInfo():{renderer:game.renderer.rendererName},quality:game.save.settings.quality,resolution:[game.renderer.engine.getRenderWidth(),game.renderer.engine.getRenderHeight()],rows};
}
