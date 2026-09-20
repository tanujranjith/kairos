import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    port: 5173, strictPort: true,
    // Generated captures/reports aren't source. On Windows a copying report can
    // briefly be locked, and watching it caused an unhandled EBUSY server exit.
    watch: { ignored: /(^|[/\\])output([/\\]|$)/ },
  },
  build: {
    target: 'es2022', chunkSizeWarningLimit: 1800, sourcemap: true,
    // Keep Babylon's interdependent modules together. Hundreds of tiny preload
    // requests otherwise serialize on HTTP/1.1 and pay latency before the menu.
    // The hashed engine stays cacheable across changes to Kairos game code.
    rolldownOptions: { output: { codeSplitting: { groups: [
      { name: 'babylon', test: /[\\/]node_modules[\\/]@babylonjs[\\/](core|loaders)[\\/]/ },
    ] } } },
  },
});
