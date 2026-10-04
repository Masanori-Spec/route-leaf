import { defineConfig } from 'vite';
export default defineConfig({
  root:import.meta.dirname,
  server:{host:'127.0.0.1',port:4175,strictPort:true},
  optimizeDeps:{include:['vue','@getodk/web-forms','@getodk/xforms-engine']},
  build:{target:'es2022'}
});
