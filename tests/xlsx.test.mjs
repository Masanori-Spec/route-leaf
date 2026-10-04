import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import JSZip from 'jszip';import {readXlsx} from '../src/xlsx.mjs';import {compileTables} from '../src/core.mjs';
const original=await fs.readFile(new URL('../generated/workshop.xlsx',import.meta.url));
async function modify(fn){const z=await JSZip.loadAsync(original);await fn(z);return z.generateAsync({type:'uint8array',compression:'DEFLATE'});}
test('read actual artifact-authored XLSX and compile',async()=>assert.equal(compileTables(await readXlsx(original)).counts.cards,12));
test('reject nonzip input',async()=>assert.rejects(readXlsx(new TextEncoder().encode('invalid')),e=>e.code==='zip_invalid'));
test('reject formula cells regardless of cached result',async()=>{const bytes=await modify(async z=>{const s=await z.file('xl/worksheets/sheet1.xml').async('string');z.file('xl/worksheets/sheet1.xml',s.replace(/(<((?:[A-Za-z0-9_]+:)?)c\b[^>]*>)/,(_,tag,prefix)=>tag+`<${prefix}f>1+1</${prefix}f>`));});await assert.rejects(readXlsx(bytes),e=>e.code==='formula_cell');});
test('reject DTD',async()=>{const bytes=await modify(async z=>z.file('xl/workbook.xml','<!DOCTYPE workbook []>'+await z.file('xl/workbook.xml').async('string')));await assert.rejects(readXlsx(bytes),e=>e.code==='xml_unsafe');});
test('reject external relationship',async()=>{const bytes=await modify(async z=>z.file('xl/_rels/workbook.xml.rels',(await z.file('xl/_rels/workbook.xml.rels').async('string')).replace('<Relationship ','<Relationship TargetMode="External" ')));await assert.rejects(readXlsx(bytes),e=>e.code==='external_relationship');});
test('reject macro part',async()=>{await assert.rejects(readXlsx(await modify(z=>z.file('xl/vbaProject.bin','x'))),e=>e.code==='xlsx_features');});
test('reject unsafe zip path',async()=>{await assert.rejects(readXlsx(await modify(z=>z.file('../outside.xml','x'))),e=>e.code==='zip_path');});
test('reject extra nonempty sheet',async()=>{const t=await readXlsx(original);t.extra=[['logic'],['hidden behavior']];assert.throws(()=>compileTables(t),e=>e.code==='unsupported_sheet');});
test('reject numeric labels rather than stringify',async()=>{const t=await readXlsx(original);t.survey[1][2]=42;assert.throws(()=>compileTables(t),e=>e.code==='text_cells_only');});
test('reject malformed XML and oversized file',async()=>{const bytes=await modify(z=>z.file('xl/workbook.xml','<workbook>'));await assert.rejects(readXlsx(bytes),e=>e.code==='xml_invalid');await assert.rejects(readXlsx(new Uint8Array(8*1024*1024+1)),e=>e.code==='file_size');});

test('reject incorrect spreadsheet namespace',async()=>{const bytes=await modify(async z=>z.file('xl/workbook.xml',(await z.file('xl/workbook.xml').async('string')).replaceAll('http://schemas.openxmlformats.org/spreadsheetml/2006/main','urn:not-ooxml')));await assert.rejects(readXlsx(bytes),e=>e.code==='xml_namespace');});
test('reject duplicate relationship IDs',async()=>{const bytes=await modify(async z=>{const name='xl/_rels/workbook.xml.rels',s=await z.file(name).async('string'),m=s.match(/<(?:[A-Za-z_]+:)?Relationship\s[^>]*\/>/)[0];z.file(name,s.replace(/<\/(?:[A-Za-z_]+:)?Relationships>/,m+'$&'));});await assert.rejects(readXlsx(bytes),e=>e.code==='duplicate_relationship');});

for(const encoding of ['str','inlineStr','s'])test(`reject OOXML escape patterns in ${encoding} strings`,async()=>{
 const bytes=await modify(async z=>{const name='xl/worksheets/sheet1.xml',s=await z.file(name).async('string');z.file(name,s.replace(/<((?:[A-Za-z_][\w.-]*:)?)c r="C2"[\s\S]*?<\/\1c>/,(_,p)=>`<${p}c r="C2" t="${encoding}">${encoding==='inlineStr'?`<${p}is><${p}t>Shown _x005F_x0041_ literally</${p}t></${p}is>`:`<${p}v>${encoding==='s'?'0':'Shown _x005F_x0041_ literally'}</${p}v>`}</${p}c>`));if(encoding==='s')z.file('xl/sharedStrings.xml','<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Shown _x005F_x0041_ literally</t></si></sst>');});
 await assert.rejects(readXlsx(bytes),e=>e.code==='ooxml_escape');
});
