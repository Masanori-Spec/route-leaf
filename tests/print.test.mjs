import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {PDFDocument} from 'pdf-lib';
import {compileTables} from '../src/core.mjs';
import {workshop} from '../src/fixture.mjs';
import {createPdf,renderBookletHtml,renderAnswerSheetHtml,validatePrintLayout} from '../src/print.mjs';

const fresh=language=>compileTables(structuredClone(workshop),language||'English (en)');

test('exact fixture is six booklet pages plus one separate answer sheet',()=>{
  const m=fresh();
  assert.equal(m.cards.length,12);
  assert.deepEqual(validatePrintLayout(m),{ok:true,errors:[],bookletPages:6,answerSheetPages:1,totalPages:7});
  const html=renderBookletHtml(m),answer=renderAnswerSheetHtml(m);
  assert.equal((html.match(/class="sheet"/g)||[]).length,6);
  assert.equal((html.match(/class="card"/g)||[]).length,12);
  assert.equal((answer.match(/class="sheet"/g)||[]).length,1);
  assert.equal((answer.match(/<tr style=/g)||[]).length,m.questions.length);
  assert.match(html,/Start at C01/);
  assert.match(html,/restart with a clean answer sheet/);
  assert.match(html,/Required: choose exactly one answer/);
  assert.match(html,/Optional: write an answer/);
  assert.match(answer,/start again with a clean sheet/);
  assert.match(html,/6 booklet pages \+ 1 answer sheet/);
  for(const card of m.cards) {
    assert.match(html,new RegExp(`id="${card.id}"`));
    for(const next of card.options?.map(o=>o.next)||[card.next]) {
      if(next==='END')assert.match(html,/END \/ stop/);
      else assert.ok(html.includes(`${next} / booklet p. ${m.cards.find(c=>c.id===next).page}`));
    }
  }
});

test('HTML escapes hostile text and includes locally embedded fonts',()=>{
  const m=fresh();m.title='A & B <form>';
  const html=renderBookletHtml(m);
  assert.match(html,/A &amp; B &lt;form&gt;/);
  assert.match(html,/data:font\/ttf;base64,/);
  assert.doesNotMatch(html,/<script|@import|src="https?:/);
});

test('group context is printed and is subject to glyph and measured-fit bounds',()=>{
  const m=fresh();m.cards[0].groups=['Workshop details','参加者の情報'];
  assert.equal(validatePrintLayout(m).ok,true);
  assert.match(renderBookletHtml(m),/Workshop details \/ 参加者の情報/);
  m.cards[0].groups=['😀'];assert.equal(validatePrintLayout(m).ok,false);
  m.cards[0].groups=['長'.repeat(200)];assert.equal(validatePrintLayout(m).ok,false);
});

test('the 30-question profile paginates into three answer sheets',async()=>{
  const m=fresh();
  m.questions=Array.from({length:30},(_,i)=>({name:`question_${i+1}`,kind:'text',label:`Original question ${i+1}`}));
  m.cards=m.questions.map((q,i)=>({id:`C${String(i+1).padStart(2,'0')}`,source:q.name,questionNumber:i+1,label:q.label,kind:q.kind,page:Math.floor(i/2)+1,next:i===29?'END':`C${String(i+2).padStart(2,'0')}`}));
  m.counts={cards:30,questions:30,pages:15,answerSheetPages:3};
  assert.deepEqual(validatePrintLayout(m),{ok:true,errors:[],bookletPages:15,answerSheetPages:3,totalPages:18});
  assert.equal((renderAnswerSheetHtml(m).match(/class="sheet"/g)||[]).length,3);
  const bytes=await createPdf(m),pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),18);
  const dir=new URL('../tmp/print-tests/',import.meta.url);await mkdir(dir,{recursive:true});
  await writeFile(new URL('thirty.pdf',dir),bytes);await writeFile(new URL('thirty.routes.json',dir),JSON.stringify(m));
  const checked=spawnSync('python3',['scripts/check-pdf.py','tmp/print-tests/thirty.pdf','tmp/print-tests/thirty.routes.json'],{encoding:'utf8'});
  assert.equal(checked.status,0,checked.stdout+checked.stderr);
});

test('measured overflow, missing glyphs, and bad physical routes are rejected',async()=>{
  for(const mutate of [
    m=>{m.cards[0].label='長'.repeat(300);},
    m=>{m.cards[0].hint='Long hint '.repeat(100);},
    m=>{m.cards[0].options[0].label='Choice '.repeat(60);},
    m=>{m.cards[0].label='An unsupported emoji 😀';},
    m=>{m.cards[0].options[0].next='C99';},
    m=>{m.cards[0].page=99;},
    m=>{m.cards[1].id=m.cards[0].id;},
    m=>{m.title='Title '.repeat(100);},
    m=>{m.cards[0].source='source'.repeat(70);},
    m=>{m.cards.find(c=>c.kind==='text').required=true;},
    m=>{m.cards.find(c=>c.kind==='select_one').required=false;},
    m=>{m.questions[1].name=m.questions[0].name;},
    m=>{m.questions.push(...Array.from({length:22},(_,i)=>({name:`extra${i}`,kind:'text',label:'Extra question'})));},
  ]) {
    const m=fresh();mutate(m);
    assert.equal(validatePrintLayout(m).ok,false);
    assert.throws(()=>renderBookletHtml(m),{name:'PrintLayoutError',code:'print_layout'});
    await assert.rejects(()=>createPdf(m),{code:'print_layout'});
  }
});

for(const [language,suffix] of [['English (en)','en'],['日本語 (ja)','ja']]) {
  test(`${language}: locally generated seven-page PDF with embedded text`,async()=>{
    const m=fresh(language),bytes=await createPdf(m);
    assert.ok(bytes instanceof Uint8Array);
    assert.equal(new TextDecoder().decode(bytes.slice(0,5)),'%PDF-');
    const pdf=await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(),7);
    for(const page of pdf.getPages()) {
      assert.ok(Math.abs(page.getWidth()-595.28)<.1);
      assert.ok(Math.abs(page.getHeight()-841.89)<.1);
    }
    const dir=new URL('../tmp/print-tests/',import.meta.url);await mkdir(dir,{recursive:true});
    await writeFile(new URL(`workshop-${suffix}.pdf`,dir),bytes);
    await writeFile(new URL(`workshop-${suffix}.routes.json`,dir),JSON.stringify(m,null,2));
    const checked=spawnSync('python3',['scripts/check-pdf.py',`tmp/print-tests/workshop-${suffix}.pdf`,`tmp/print-tests/workshop-${suffix}.routes.json`],{encoding:'utf8'});
    assert.equal(checked.status,0,checked.stdout+checked.stderr);
  });
}
