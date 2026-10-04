/** Exercise the real Vite optimizer and every static import without launching a browser. */
import test from 'node:test';import assert from 'node:assert/strict';import {writeFile,mkdir} from 'node:fs/promises';import {createServer} from 'vite';
test('official component and engine imports survive fresh ES2022 optimization',async()=>{
 const server=await createServer({configFile:new URL('./vite.config.mjs',import.meta.url).pathname,server:{host:'127.0.0.1',port:0,strictPort:false},optimizeDeps:{force:true}});
 const visited=new Set(),modules=[];
 try{await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;const queue=[`${base}/browser-entry.mjs`];
 while(queue.length){const url=queue.shift();if(visited.has(url))continue;visited.add(url);assert(visited.size<=40,'Unexpected import graph expansion');const response=await fetch(url);const source=await response.text();assert.equal(response.status,200,`${url}: ${source.slice(0,1000)}`);modules.push({path:new URL(url).pathname,bytes:Buffer.byteLength(source)});
 for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*)["']([^"']+)["']/g)){const spec=match[1];if(!spec.startsWith('/')&&!spec.startsWith('.'))continue;const dependency=new URL(spec,url);assert.equal(dependency.origin,base);queue.push(dependency.href);}}
 assert(modules.some(m=>m.path.includes('@getodk_web-forms.js')),'Actual official component import missing');assert(modules.some(m=>m.path.includes('@getodk_xforms-engine.js')),'Actual official engine import missing');assert.equal((await fetch(base+'/')).status,200,'Vite server stopped after optimization');
 const out=new URL('./generated/',import.meta.url);await mkdir(out,{recursive:true});await writeFile(new URL('vite-smoke-report.json',out),JSON.stringify({status:'passed',target:'es2022',freshOptimization:true,browserLaunched:false,modules},null,2));
 }finally{await server.close();}
});
