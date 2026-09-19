import { defineConfig } from 'vite';
export default defineConfig({
  server: { port: 5173, strictPort: true },
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
