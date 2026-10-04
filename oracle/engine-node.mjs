import { JSDOM } from 'jsdom';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { workshopCases, traverseRoute } from './route-json.mjs';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://127.0.0.1:4175'});
for (const key of ['window','document','DOMParser','XMLSerializer','Node','Element','HTMLElement','Document','XMLDocument','XPathResult','localStorage']) Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
// Published 1.0.3 bundles Emscripten's CommonJS __dirname reference.
// Its WASM is embedded; provide only this host compatibility global, without
// changing any official engine source or computation. Browser run needs no shim.
Object.defineProperty(globalThis,'__dirname',{value:new URL('./node_modules/@getodk/xforms-engine/dist/',import.meta.url).pathname,configurable:true});
const { engineTrace }=await import('./engine.mjs');
const root=new URL('./',import.meta.url);
const xml=await readFile(new URL('generated/workshop.xml',root),'utf8');
const artifactBytes=await readFile(new URL('../generated/workshop-en.routes.json',root));
const manifest=JSON.parse(artifactBytes);
const results=[];
for (const c of workshopCases) {
  const observed=await engineTrace(xml,c.answers);
  const route=traverseRoute(manifest,c.answers);
  assert.deepEqual(route.events,observed.events,`Official engine mismatch: ${c.id}`);
  results.push({id:c.id,answers:c.answers,...observed,cards:route.cards,match:true});
}
assert.equal(results.length,6);
// Negative controls prove that equality rejects realistic damaged paper routes.
const negativeControls=[];
for (const [name,mutate] of [
  ['premature-END',m=>{m.cards.find(c=>c.source==='track').options[0].next='END';}],
  ['wrong-choice-code',m=>{m.cards.find(c=>c.source==='track').options[0].value='wrong';}],
  ['wrong-question-label',m=>{m.cards.find(c=>c.source==='track').label='Wrong question';}],
  ['omitted-note',m=>{
    const note=m.cards.find(c=>c.source==='morning_note');
    for(const card of m.cards){
      if(card.next===note.id)card.next=note.next;
      for(const option of card.options??[])if(option.next===note.id)option.next=note.next;
    }
  }]
]) {
  const damaged=structuredClone(manifest); mutate(damaged);
  let detected=false;
  for(const observed of results){
    try {assert.deepEqual(traverseRoute(damaged,observed.answers).events,observed.events);}
    catch {detected=true;break;}
  }
  assert.ok(detected,`Negative control was not detected: ${name}`);
  negativeControls.push({name,status:'detected'});
}
const report={status:'passed',consumer:'@getodk/xforms-engine',version:'1.0.3',runtime:process.version,
  routeSha256:createHash('sha256').update(artifactBytes).digest('hex'),
  xformSha256:createHash('sha256').update(xml).digest('hex'), negativeControls, cases:results};
await mkdir(new URL('generated/',root),{recursive:true});
await writeFile(new URL('generated/engine-report.json',root),JSON.stringify(report,null,2)+'\n');
console.log(`Official ODK engine: ${results.length}/6 complete source/answer/terminal traces match the independently traversed route JSON`);
dom.window.close();
