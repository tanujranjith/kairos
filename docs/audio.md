# Original driving sound

All sound runs locally through Web Audio. No recorded automotive samples, paid assets or remote audio are required.

`engine-wave.ts` creates a zero-DC, rounded asymmetric combustion-pressure waveform. The audio graph routes it through separate exhaust and intake resonances, with a restrained crank-order tone and filtered overrun texture. RPM/cylinder count controls firing frequency; throttle and RPM change intake/exhaust levels and resonant frequencies. Fuel state gates the complete engine bus. Profile differences do not alter the shared visual model.

The graph also retains wheel-speed/gear whine, contact/surface-dependent road noise, aerodynamic noise, tire slip, impacts and rain. A short shift envelope survives repeated audio updates. Cockpit filtering and a bounded tunnel echo affect the mix. A compressor limits peaks; mute, pause and dispose cover every layer. Autoplay blocking never blocks a drive: the next trusted keyboard/pointer input unlocks audio.

Tune the numerical mix in `audio-mix.ts`, harmonic envelope in `engine-wave.ts`, and filter/level balance in `audio-graph.ts`. Keep engine sublayers upstream of `engineGain` so fuel, shifts and layer-isolation tests remain correct.

`node scripts/verify-audio.mjs` renders actual PCM using the same graph, checks finite/unclipped output, audible layers, mute/pause silence, shift cuts, cabin/tunnel differences and browser autoplay recovery. It retains a WAV for listening. These checks do not certify subjective realism, device latency or physical speaker/headphone output.
