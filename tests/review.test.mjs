// Independent review counterexamples. No RouteLeaf parser/compiler internals are reused.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import JSZip from 'jszip';
import pako from 'pako';
import { openZip } from '../src/zip.mjs';
import { readXlsx } from '../src/xlsx.mjs';
import { compileTables } from '../src/core.mjs';
import { workshop } from '../src/fixture.mjs';
const original = await fs.readFile(new URL('../generated/workshop.xlsx', import.meta.url));
async function modified(change) {
  const zip = await JSZip.loadAsync(original);
  await change(zip);
  return zip.generateAsync({ type:'uint8array', compression:'DEFLATE' });
}
const sheetPath = 'xl/worksheets/sheet1.xml';
async function changeSheet(zip, change) {
  zip.file(sheetPath, change(await zip.file(sheetPath).async('string')));
}
test('review: populated group hints must be preserved or rejected, never dropped', () => {
  const tables = structuredClone(workshop);
  const warning = 'IMPORTANT: read consent first';
  tables.survey.splice(2, 0, ['begin_group','review_group','Intake','聞き取り',warning,'説明','','']);
  tables.survey.splice(4, 0, ['end_group','','','','','','','']);
  try {
    const manifest = compileTables(tables, 'English (en)');
    assert.ok(JSON.stringify(manifest).includes(warning), 'Accepted group hint was silently dropped');
  } catch (error) {
    if (error.name !== 'RouteError') throw error;
    assert.ok(error.code);
  }
});
test('review: missing OOXML content types and package relationships are rejected', async () => {
  const bytes = await modified(zip => {
    zip.remove('[Content_Types].xml');
    zip.remove('_rels/.rels');
  });
  await assert.rejects(readXlsx(bytes));
});
test('review: a second sheetData block is rejected rather than ignored', async () => {
  const bytes = await modified(zip => changeSheet(zip, xml => {
    const prefix = /<((?:[A-Za-z_][\w.-]*:)?)worksheet\b/.exec(xml)[1];
    const extra = `<${prefix}sheetData><${prefix}row r="11"><${prefix}c r="A11" t="str"><${prefix}v>calculate</${prefix}v></${prefix}c></${prefix}row></${prefix}sheetData>`;
    return xml.replace(`</${prefix}worksheet>`, `${extra}</${prefix}worksheet>`);
  }));
  await assert.rejects(readXlsx(bytes));
});
test('review: duplicate cell values are rejected rather than first-value wins', async () => {
  const bytes = await modified(zip => changeSheet(zip, xml => {
    return xml.replace(/<((?:[A-Za-z_][\w.-]*:)?)v>Which workshop are you joining\?<\/\1v>/,
      (_, prefix) => `<${prefix}v>Which workshop are you joining?</${prefix}v><${prefix}v>Discarded active text</${prefix}v>`);
  }));
  await assert.rejects(readXlsx(bytes));
});
test('review: phonetic annotations do not become base cell labels', async () => {
  const bytes = await modified(zip => changeSheet(zip, xml => {
    return xml.replace(/<((?:[A-Za-z_][\w.-]*:)?)c r="C2"[\s\S]*?<\/\1c>/,
      (_, p) => `<${p}c r="C2" t="inlineStr"><${p}is><${p}t>Tokyo</${p}t><${p}rPh sb="0" eb="5"><${p}t>とうきょう</${p}t></${p}rPh></${p}is></${p}c>`);
  }));
  let tables;
  try { tables = await readXlsx(bytes); }
  catch (error) { assert.equal(error.name, 'RouteError'); return; }
  assert.equal(tables.survey[1][2], 'Tokyo');
});
test('review: deterministic generated forms match a separate reachable-history enumerator', () => {
  let state = 71983;
  const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const pick = values => values[Math.floor(random() * values.length)];
  const stable = histories => histories.map(h => JSON.stringify({
    answers:Object.fromEntries(Object.entries(h.answers).sort()), questions:h.questions
  })).sort();
  for (let fixture = 0; fixture < 250; fixture++) {
    const prior = [], rules = [], referenced = new Set();
    const atom = () => {
      const name = pick(prior), value = pick(['yes','no']);
      referenced.add(name);
      return { expression:`\${${name}} = '${value}'`, accepts:answers => answers[name] === value };
    };
    const survey = [['type','name','label','required','relevant']];
    for (let i = 0; i < 7; i++) {
      const kind = i === 0 ? 'select_one' : pick(['select_one','select_one','text','note']);
      const name = `q${i}`;
      let rule = { expression:'', accepts:() => true };
      if (prior.length && random() < .75) {
        const a = atom();
        if (random() < .55) {
          const b = atom(), operation = pick(['and','or']);
          rule = { expression:`(${a.expression} ${operation} ${b.expression})`,
            accepts:answers => operation === 'and' ? a.accepts(answers) && b.accepts(answers) : a.accepts(answers) || b.accepts(answers) };
        } else rule = a;
      }
      rules.push({ name, kind, accepts:rule.accepts });
      survey.push([kind === 'select_one' ? 'select_one yn' : kind,name,`Question ${i}`,kind === 'select_one' ? 'yes' : '',rule.expression]);
      if (kind === 'select_one') prior.push(name);
    }
    const expected = [];
    const enumerate = (index, answers, questions) => {
      if (index === rules.length) { expected.push({ answers, questions }); return; }
      const rule = rules[index];
      if (!rule.accepts(answers)) return enumerate(index + 1, answers, questions);
      const visited = [...questions,rule.name];
      if (rule.kind === 'select_one' && referenced.has(rule.name)) {
        for (const value of ['yes','no']) enumerate(index + 1, {...answers,[rule.name]:value}, visited);
      } else enumerate(index + 1, answers, visited);
    };
    enumerate(0, {}, []);
    const manifest = compileTables({ survey, choices:[['list_name','name','label'],['yn','yes','Yes'],['yn','no','No']] });
    assert.deepEqual(stable(manifest.histories), stable(expected), `Reachable histories: fixture ${fixture}`);
    const cards = new Map(manifest.cards.map(card => [card.id,card]));
    for (const history of expected) {
      const actual = [], seen = new Set();
      let id = manifest.start;
      while (id !== 'END') {
        assert.ok(cards.has(id) && !seen.has(id), `Missing/cyclic edge: fixture ${fixture}`);
        seen.add(id);
        const card = cards.get(id); actual.push(card.source);
        id = card.kind === 'select_one' ? card.options.find(option => option.value === (history.answers[card.source] ?? 'yes')).next : card.next;
      }
      assert.deepEqual(actual, history.questions, `Actual card edges: fixture ${fixture}`);
    }
  }
});
function directoryOffset(bytes) {
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  return view.getUint32(bytes.length - 22 + 16,true);
}
test('review: forged ZIP sizes abort within the first bounded inflate chunk', async () => {
  const zip = new JSZip(); zip.file('large.xml',new Uint8Array(25 * 1024 * 1024));
  const bytes = await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), directory = directoryOffset(bytes);
  view.setUint32(directory + 24,1,true);
  view.setUint32(view.getUint32(directory + 42,true) + 22,1,true);
  const Original = pako.Inflate;
  let inflated = 0;
  // Count actual inflater output, so rejection after full inflation cannot pass.
  pako.Inflate = function (...args) {
    const instance = new Original(...args), push = instance.push;
    instance.push = function (...input) {
      const onData = this.onData;
      this.onData = function (chunk) { inflated += chunk.length; return onData.call(this,chunk); };
      return push.apply(this,input);
    };
    return instance;
  };
  try {
    assert.throws(() => openZip(bytes).read('large.xml'),error => error.code === 'zip_limit');
    assert.ok(inflated <= 16384, `Inflated ${inflated} bytes before rejection`);
  } finally { pako.Inflate = Original; }
});
test('review: local ZIP names cannot differ from validated central names', async () => {
  const zip = new JSZip(); zip.file('a.xml','abc');
  const bytes = await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
  bytes[30] = 'b'.charCodeAt(0);
  assert.throws(() => openZip(bytes),error => error.code === 'zip_path');
});
test('review: unconsumed bytes after a deflate stream are rejected', async () => {
  const zip = new JSZip(); zip.file('a.xml','abc');
  const bytes = await zip.generateAsync({type:'uint8array',compression:'DEFLATE'}), directory = directoryOffset(bytes);
  const corrupted = new Uint8Array(bytes.length + 1);
  corrupted.set(bytes.subarray(0,directory)); corrupted[directory] = 255;
  corrupted.set(bytes.subarray(directory),directory + 1);
  const view = new DataView(corrupted.buffer);
  view.setUint32(18,view.getUint32(18,true) + 1,true);
  view.setUint32(directory + 1 + 20,view.getUint32(directory + 1 + 20,true) + 1,true);
  view.setUint32(corrupted.length - 22 + 16,directory + 1,true);
  assert.throws(() => openZip(corrupted).read('a.xml'),error => error.code === 'zip_invalid');
});
