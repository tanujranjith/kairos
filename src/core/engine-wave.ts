/** Original zero-DC combustion pulse train. Rounded, asymmetric pressure pulses
 * provide harmonics without a sampled engine recording or an audio worklet. */
export function combustionHarmonics(count=48){
  const real=new Float32Array(count+1),imag=new Float32Array(count+1);
  for(let n=1;n<=count;n++){
    const amplitude=Math.exp(-n*.055)/(1+n*.32),phase=-Math.atan(n*.55);
    real[n]=amplitude*Math.cos(phase);imag[n]=amplitude*Math.sin(phase);
  }
  return {real,imag};
}
