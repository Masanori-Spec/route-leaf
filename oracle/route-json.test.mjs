import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { traverseRoute, workshopCases } from './route-json.mjs';
const tiny = () => ({ schema:'routeleaf/1', start:'C01', cards:[
  { id:'C01', source:'choice', kind:'select_one', label:'Pick one', options:[{ value:'yes',label:'Yes',next:'C02' }] },
  { id:'C02', source:'message', kind:'text',label:'Message',next:'END' }
] });
test('independent traversal emits every source, answer, and terminal',()=>{
  assert.deepEqual(traverseRoute(tiny(), {choice:'yes'}).events, [
    {event:'question',source:'choice',kind:'select_one',label:'Pick one',choices:[{value:'yes',label:'Yes'}]},
    {event:'answer',source:'choice',value:'yes'},
    {event:'question',source:'message',kind:'text',label:'Message',choices:[]},
    {event:'answer',source:'message',value:'Oracle answer for message'},
    {event:'terminal',value:'END'}
  ]);
});
test('ignores untrusted precomputed histories',()=>{
  const m=tiny(); m.histories=[{questions:['WRONG']}];
  assert.equal(traverseRoute(m,{choice:'yes'}).events[0].source,'choice');
});
test('fails closed on missing targets, cycles, duplicate IDs and invalid answers',()=>{
  let m=tiny(); m.cards[1].next='absent'; assert.throws(()=>traverseRoute(m,{choice:'yes'}),/Missing/);
  m=tiny(); m.cards[1].next='C01'; assert.throws(()=>traverseRoute(m,{choice:'yes'}),/Cycle/);
  m=tiny(); m.cards.push(m.cards[0]); assert.throws(()=>traverseRoute(m,{choice:'yes'}),/Duplicate/);
  assert.throws(()=>traverseRoute(tiny(),{choice:'no'}),/not uniquely/);
});
test('six independent workshop histories traverse twelve cards',async()=>{
  const m=JSON.parse(await readFile(new URL('../generated/workshop-en.routes.json',import.meta.url),'utf8'));
  assert.equal(workshopCases.length,6);
  assert.equal(m.cards.length,12);
  const visited=new Set();
  for(const c of workshopCases) for(const id of traverseRoute(m,c.answers).cards) visited.add(id);
  assert.equal(visited.size,12,'Every exported card must be traversed');
  for(const number of [2,3,4]) assert.equal(m.cards.filter(c=>c.questionNumber===number).length,2,`Q${number} variants`);
});
