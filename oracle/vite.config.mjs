import { defineConfig } from 'vite';
// Official ODK 1.0.3 uses top-level await during engine initialization.
// Vite's dependency optimizer has a separate target from production builds.
const target='es2022';
export default defineConfig({
  root:import.meta.dirname,
  server:{host:'127.0.0.1',port:4175,strictPort:true},
  esbuild:{target},
  optimizeDeps:{include:['vue','@getodk/web-forms','@getodk/xforms-engine'],esbuildOptions:{target}},
  build:{target}
});
