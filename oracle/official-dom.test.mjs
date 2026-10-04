import test from 'node:test';import assert from 'node:assert/strict';import {readFile}from'node:fs/promises';import {JSDOM}from'jsdom';import {readQuestionElements}from'./official-dom.mjs';
const html=await readFile(new URL('./fixtures/official-initial-dom.html',import.meta.url),'utf8');
test('captured official ready marker is attached but has no visible content',()=>{const dom=new JSDOM(html),d=dom.window.document;const marker=d.querySelector('.form-initialization-status.ready');assert(marker);assert.equal(marker.textContent,'');assert.equal(marker.children.length,0);assert.equal(d.querySelectorAll('.question-container').length,3);assert.equal(d.querySelector('button').getAttribute('aria-label'),'Send');dom.window.close();});
test('official DOM reader preserves labels, required semantics and exact choice codes',()=>{const dom=new JSDOM(html),d=dom.window.document;const items=readQuestionElements(Array.from(d.querySelectorAll('.question-container')));assert.deepEqual(items.map(x=>({label:x.label,kind:x.kind,choices:x.choices})),[
 {label:'Which workshop are you joining?',kind:'select_one',choices:[{value:'print',label:'Print'},{value:'book',label:'Bookbinding'}]},
 {label:'Do you need a loan kit?',kind:'select_one',choices:[{value:'yes',label:'Yes'},{value:'no',label:'No'}]},
 {label:'Anything else the organizer should know?',kind:'text',choices:[]}
]);assert.deepEqual(items.map(x=>x.required),[true,true,false]);assert.equal(d.querySelectorAll('.control-text > label.required').length,2);assert(items.every(x=>x.id.startsWith('node:')));dom.window.close();});
