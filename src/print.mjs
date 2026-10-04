import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { FONT_BASE64 } from '../assets/font-data.mjs';

const A4 = [595.28, 841.89];
const MARGIN = 36;
const CARD_X = 36, CARD_W = 523.28, CARD_H = 312, CARD_TOPS = [112, 440];
const INNER_W = CARD_W - 36;
const FONT_BYTES = Uint8Array.from(atob(FONT_BASE64), c => c.charCodeAt(0));
const METRICS = fontkit.create(FONT_BYTES);
const c = { ink: rgb(.10,.20,.20), muted: rgb(.31,.39,.39), line: rgb(.75,.82,.80), paper: rgb(.97,.98,.96), green: rgb(.14,.37,.31) };
const EN = {
  booklet: 'BOOKLET', page: 'Booklet page', question: 'Question', source: 'source',
  instructions: 'Start at {start}. Record answers separately and follow each chosen route; skip other cards. END means stop.\nIf you change a routing answer, restart with a clean answer sheet.',
  continuation: 'Follow card IDs and booklet page numbers. Do not read the cards in printed order.',
  destination: (id,p) => `${id} / booklet p. ${p}`, end: 'END / stop',
  select: 'Required: choose exactly one answer', write: 'Optional: write an answer on the answer sheet', note: 'Information only', next: 'Then go to',
  answer: 'ANSWER SHEET', answerIntro: 'One row per original question; leave skipped questions blank. If you change a routing answer, start again with a clean sheet.',
  name: 'Name / reference (optional):', response: 'Your answer', noAnswer: 'Information only - no answer needed', sheetFooter: (p,n) => `Answer sheet ${p} of ${n} - separate from booklet page numbers`,
  count: (n,a=1) => `${n} booklet pages + ${a} answer sheet${a===1?'':'s'}`, read: 'Read the card, then follow its route',
};
const JA = {
  booklet: '質問冊子', page: '冊子ページ', question: '質問', source: '項目名',
  instructions: '{start}から始め、回答の案内先へ進んでください。回答は別紙へ記入し、ほかのカードは飛ばします。ENDで終了します。\n分岐に使う回答を変える場合は、新しい回答用紙で最初からやり直してください。',
  continuation: 'カードIDと冊子ページ番号を確認してください。印刷された順番には進みません。',
  destination: (id,p) => `${id} / 冊子 ${p}ページ`, end: 'END / 終了',
  select: '必須：回答を1つ選んでください', write: '任意：回答用紙に記入してください', note: '案内のみ', next: '次のカード',
  answer: '回答用紙', answerIntro: '元の質問ごとに1行です。飛ばした質問は空欄にしてください。分岐に使う回答を変える場合は、新しい回答用紙で最初からやり直してください。',
  name: '氏名・管理番号（任意）：', response: '回答欄', noAnswer: '案内のみ・回答不要', sheetFooter: (p,n) => `回答用紙 ${p} / ${n} - 冊子のページ番号とは別です`,
  count: (n,a=1) => `冊子 ${n}ページ + 回答用紙 ${a}ページ`, read: 'カードを読み、案内先へ進んでください',
};
const locale = m => /(?:\(ja\)|^ja$|日本語)/.test(m.language || '') ? JA : EN;
const clean = value => String(value ?? '').replace(/\r\n?/g, '\n');
const esc = value => clean(value).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const ADVANCES = new Map();
const width = (text,size) => [...text].reduce((sum,char) => {
  if(!ADVANCES.has(char)) ADVANCES.set(char,METRICS.glyphForCodePoint(char.codePointAt(0)).advanceWidth);
  return sum+ADVANCES.get(char);
},0) / METRICS.unitsPerEm * size;

/** Wrap with the exact embedded font's glyph advances, never truncate. */
function wrap(text, size, availableWidth) {
  const result = [];
  for (const paragraph of clean(text).split('\n')) {
    if (!paragraph) { result.push(''); continue; }
    let line = '';
    for (const char of paragraph) {
      if (line && width(line + char,size) > availableWidth + .01) {
        // Prefer an English word boundary. CJK text may wrap between characters.
        const breakAt = line.lastIndexOf(' ');
        if (breakAt > 0 && breakAt > line.length / 2) {
          result.push(line.slice(0,breakAt)); line = line.slice(breakAt+1) + char;
        } else { result.push(line); line = char; }
      } else line += char;
    }
    result.push(line);
  }
  return result;
}

function destination(m, target) {
  const t = locale(m);
  if (target === 'END') return t.end;
  const card = m.cards.find(card => card.id === target);
  return card ? t.destination(card.id, card.page) : `[invalid destination: ${target}]`;
}

function cardLayout(m,card) {
  const t = locale(m);
  const label = wrap(card.label,15,INNER_W), hint = card.hint ? wrap(card.hint,9.5,INNER_W) : [];
  const groups = card.groups?.length ? wrap(card.groups.join(' / '),9,INNER_W) : [];
  const rows = (card.options || []).map(option => ({
    label: wrap(option.label,11,265), destination: destination(m,option.next),
    height: Math.max(30,wrap(option.label,11,265).length * 15 + 12),
  }));
  const contentHeight = (groups.length?groups.length*12+5:0) + label.length*20 + (hint.length ? hint.length*13+7 : 0) + 25 + (card.kind === 'select_one' ? rows.reduce((sum,row) => sum+row.height,0) : 45);
  return {label,hint,groups,rows,contentHeight,source:`${t.question} ${card.questionNumber ?? '?'} / ${t.source}: ${card.source}`};
}

function sheetLayout(m) {
  return m.questions.map((q,index) => {
    const label = wrap(`${index+1}. ${q.label}`,11,260);
    const source = wrap(q.name,8,260);
    const height = Math.max(46,label.length*15+source.length*11+12);
    return { q, index, label, source, height };
  });
}

/** Reject overflow, missing glyphs, and invalid physical destinations before exporting. */
export function validatePrintLayout(manifest) {
  const errors = [], m = manifest || {};
  const fail = message => errors.push(message);
  if (!Array.isArray(m.cards) || !m.cards.length || !Array.isArray(m.questions) || !m.questions.length) {
    return {ok:false,errors:['A non-empty compiled manifest with cards and original questions is required.'],bookletPages:0,answerSheetPages:1,totalPages:1};
  }
  const pages = Math.ceil(m.cards.length/2), answerPages=Math.ceil(m.questions.length/10), ids = new Set(m.cards.map(card => card.id));
  if (m.schema !== 'routeleaf/1') fail('Unsupported manifest schema.');
  if (ids.size !== m.cards.length || m.cards.some(card => !/^C\d{2,4}$/.test(card.id))) fail('Every card needs a unique C-prefixed numeric ID.');
  if (!ids.has(m.start)) fail('The start card does not exist.');
  if (m.cards.length > 200) fail('The booklet exceeds the 200-card print limit.');
  if (m.questions.length > 30) fail('The answer sheet supports at most 30 original questions, ten per page.');
  if (m.counts?.pages != null && m.counts.pages !== pages) fail('Manifest booklet-page count does not match two cards per page.');
  const fields = [['Title',m.title]];
  const t = locale(m);
  if (wrap(t.instructions.replace('{start}',m.start),9,CARD_W).length>2 || wrap(t.answerIntro,9,CARD_W).length>2) fail('Translated print instructions exceed the reserved header height.');
  if (!clean(m.title).trim() || wrap(m.title,18,460).length > 1) fail('The title must fit on one line at 18 pt (maximum width 460 pt).');
  for (const [index,card] of m.cards.entries()) {
    if (card.page !== Math.floor(index/2)+1) fail(`${card.id}: page does not match its physical booklet page.`);
    if (!['select_one','text','note'].includes(card.kind)) fail(`${card.id}: unsupported card kind.`);
    if (card.kind==='text' && card.required) fail(`${card.id}: required text fields are not supported by the printed optional-text profile.`);
    if (card.kind==='select_one' && card.required===false) fail(`${card.id}: select_one cards must require one answer.`);
    for (const key of ['label','hint','source']) fields.push([`${card.id} ${key}`,card[key]]);
    (card.groups || []).forEach((group,i) => fields.push([`${card.id} group ${i+1}`,group]));
    if (!clean(card.label).trim()) fail(`${card.id}: the label is empty.`);
    const layout = cardLayout(m,card);
    if (layout.label.length > 3 || clean(card.label).length > 300) fail(`${card.id}: question label exceeds three lines or 300 characters.`);
    if (layout.hint.length > 2 || clean(card.hint).length > 200) fail(`${card.id}: hint exceeds two lines or 200 characters.`);
    if (layout.groups.length > 2) fail(`${card.id}: group context exceeds two lines.`);
    if (width(layout.source,8.5) > INNER_W-80 || /\n/.test(layout.source)) fail(`${card.id}: source number/name is too long for its header.`);
    if (layout.contentHeight > CARD_H-80) fail(`${card.id}: content would overflow the fixed two-card A4 layout; shorten the label, hint, or choices.`);
    const nexts = card.kind === 'select_one' ? (card.options || []).map(option=>option.next) : [card.next];
    if (card.kind === 'select_one' && (!card.options?.length || card.options.length > 8)) fail(`${card.id}: one to eight answer choices are required.`);
    (card.options || []).forEach((option,i) => {
      fields.push([`${card.id} choice ${i+1}`,option.label]);
      if (!clean(option.label).trim() || clean(option.label).length > 180 || layout.rows[i].label.length > 3) fail(`${card.id}: choice ${i+1} is empty or exceeds three lines / 180 characters.`);
      if (width(layout.rows[i].destination,10.5) > 175) fail(`${card.id}: route text exceeds its reserved column.`);
    });
    nexts.forEach(next => { if (next !== 'END' && !ids.has(next)) fail(`${card.id}: destination ${next} does not exist.`); });
  }
  const names = new Set();
  m.questions.forEach((q,index) => {
    fields.push([`Original question ${index+1}`,q.label],[`Original question ${index+1} name`,q.name]);
    if (!q.name || names.has(q.name)) fail('Answer-sheet original question names must be non-empty and unique.');
    names.add(q.name);
  });
  const rows = sheetLayout(m);
  for(let p=0;p<answerPages;p++) if (rows.slice(p*10,p*10+10).reduce((sum,row)=>sum+row.height,0) > 610) fail(`Original question labels would overflow answer-sheet page ${p+1}; shorten labels.`);
  for (const [field,value] of fields) {
    const str = clean(value);
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(str)) fail(`${field}: control characters cannot be printed.`);
    const missing = [...new Set([...str].filter(char => char !== '\n' && !METRICS.hasGlyphForCodePoint(char.codePointAt(0))))];
    if (missing.length) fail(`${field}: unsupported font characters (${missing.slice(0,8).join(' ')}). Use supported Latin/Japanese text.`);
  }
  return {ok:errors.length === 0,errors,bookletPages:pages,answerSheetPages:answerPages,totalPages:pages+answerPages};
}

function requireLayout(m) {
  const result = validatePrintLayout(m);
  if (!result.ok) {
    const error = new Error(`Print layout rejected: ${result.errors.join(' ')}`);
    error.name='PrintLayoutError'; error.code='print_layout'; error.errors=result.errors;
    throw error;
  }
  return result;
}

const css = `@font-face{font-family:RouteLeaf;src:url(data:font/ttf;base64,${FONT_BASE64}) format('truetype');font-weight:400;font-style:normal}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:RouteLeaf,sans-serif;font-kerning:none;font-variant-ligatures:none;color:#193333;background:#dfe7e3}@page{size:A4;margin:0}.sheet{position:relative;width:595.28pt;height:841.89pt;margin:20px auto;background:white;break-after:page;padding:30pt 36pt}.sheet:last-child{break-after:auto}.title{font-size:18pt;margin:0 0 5pt;line-height:25pt;font-weight:normal}.eyebrow{font-size:8pt;color:#506363;letter-spacing:.7pt}.instruction{white-space:pre-line;font-size:9pt;line-height:13pt;margin:8pt 0 0}.card{position:absolute;left:36pt;width:523.28pt;height:312pt;border:1pt solid #bfcecc;border-left:5pt solid #245e4f;border-radius:7pt;background:#f7faf5;padding:16pt 18pt}.card:nth-of-type(1){top:112pt}.card:nth-of-type(2){top:440pt}.card-head{height:46pt;display:flex;align-items:center;gap:15pt}.card-id{font:bold 26pt Arial,sans-serif}.source{font-size:8.5pt;color:#506363}.label{font-size:15pt;line-height:20pt;margin:0;font-weight:normal}.hint{font-size:9.5pt;line-height:13pt;margin:7pt 0 0;color:#506363}.kind{font-size:9pt;margin:8pt 0 6pt;color:#506363}.option{display:flex;align-items:center;justify-content:space-between;border-top:.5pt solid #bfcecc;gap:15pt;padding:6pt 0;font-size:11pt;line-height:15pt}.choice{width:265pt}.route{width:175pt;font-size:10.5pt;color:#245e4f}.next{font-size:12pt;padding-top:12pt}.footer{position:absolute;left:36pt;right:36pt;bottom:29pt;border-top:.5pt solid #bfcecc;padding-top:8pt;font-size:8pt;color:#506363;display:flex;justify-content:space-between}.answer-name{font-size:11pt;margin:22pt 0 16pt}.answer-table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:11pt}.answer-table th{text-align:left;font-size:9pt;background:#f0f5f1;padding:8pt}.answer-table td{vertical-align:top;border:1pt solid #bfcecc;padding:6pt}.answer-table th:first-child,.answer-table td:first-child{width:290pt}.answer-table .src{font-size:8pt;color:#506363;margin-top:2pt}.answer-table .empty{color:#506363;font-size:9pt}.answer-table p{margin:0;line-height:15pt}@media print{html,body{background:white}.sheet{margin:0;box-shadow:none;print-color-adjust:exact;-webkit-print-color-adjust:exact}}`;
const linesHtml = lines => lines.map(esc).join('<br>');
function htmlDocument(m,body,title) { return `<!doctype html><html lang="${locale(m)===JA?'ja':'en'}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>${body}</body></html>`; }

export function renderBookletHtml(manifest) {
  const m=manifest, stats=requireLayout(m), t=locale(m);
  const pages=Array.from({length:stats.bookletPages},(_,pageIndex) => {
    const cards=m.cards.slice(pageIndex*2,pageIndex*2+2).map(card=>{
      const l=cardLayout(m,card);
      const content=card.kind==='select_one' ? l.rows.map(row=>`<div class="option" style="height:${row.height}pt"><span class="choice">${linesHtml(row.label)}</span><span class="route">${esc(row.destination)}</span></div>`).join('') : `<div class="next">${esc(t.next)}: ${esc(destination(m,card.next))}</div>`;
      return `<article class="card" id="${esc(card.id)}"><div class="card-head"><b class="card-id">${esc(card.id)}</b><span class="source">${esc(l.source)}</span></div>${l.groups.length?`<div style="font-size:9pt;line-height:12pt;margin-bottom:5pt">${linesHtml(l.groups)}</div>`:''}<h2 class="label">${linesHtml(l.label)}</h2>${l.hint.length?`<p class="hint">${linesHtml(l.hint)}</p>`:''}<p class="kind">${esc(card.kind==='select_one'?t.select:card.kind==='text'?t.write:t.note)}</p>${content}</article>`;
    }).join('');
    return `<section class="sheet"><div class="eyebrow">RouteLeaf / ${esc(t.booklet)}</div><h1 class="title">${esc(m.title)}</h1><p class="instruction">${esc(pageIndex===0?t.instructions.replace('{start}',m.start):t.continuation)}</p>${cards}<footer class="footer"><span>${esc(t.page)} ${pageIndex+1} / ${stats.bookletPages}</span><span>${esc(t.count(stats.bookletPages,stats.answerSheetPages))}</span></footer></section>`;
  }).join('');
  return htmlDocument(m,pages,`${m.title} - ${t.booklet}`);
}

export function renderAnswerSheetHtml(manifest) {
  const m=manifest,stats=requireLayout(m),t=locale(m),allRows=sheetLayout(m);
  const body=Array.from({length:stats.answerSheetPages},(_,p)=>{
    const rows=allRows.slice(p*10,p*10+10).map(row=>`<tr style="height:${row.height}pt"><td><p>${linesHtml(row.label)}</p><div class="src">${linesHtml(row.source)}</div></td><td class="empty">${row.q.kind==='note'?esc(t.noAnswer):''}</td></tr>`).join('');
    return `<section class="sheet"><div class="eyebrow">RouteLeaf / ${esc(t.answer)}</div><h1 class="title">${esc(m.title)}</h1><p class="instruction">${esc(t.answerIntro)}</p><div class="answer-name">${esc(t.name)} __________________________</div><table class="answer-table"><thead><tr><th>${esc(t.question)}</th><th>${esc(t.response)}</th></tr></thead><tbody>${rows}</tbody></table><footer class="footer"><span>${esc(t.sheetFooter(p+1,stats.answerSheetPages))}</span></footer></section>`;
  }).join('');
  return htmlDocument(m,body,`${m.title} - ${t.answer}`);
}

/** A real locally generated PDF: embedded Unicode font, no browser print dialog. */
export async function createPdf(manifest) {
  const m=manifest, stats=requireLayout(m), t=locale(m);
  const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
  const font=await pdf.embedFont(FONT_BYTES,{subset:true});
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(m.title);pdf.setSubject('RouteLeaf branch booklet and separate answer sheet');pdf.setProducer('RouteLeaf / pdf-lib / embedded RouteLeaf Sans');pdf.setCreator('RouteLeaf');
  const text=(page,value,x,top,size=11,color=c.ink,useFont=font)=>page.drawText(value,{x,y:A4[1]-top-size,font:useFont,size,color});
  const line=(page,x1,top1,x2,top2)=>page.drawLine({start:{x:x1,y:A4[1]-top1},end:{x:x2,y:A4[1]-top2},thickness:.6,color:c.line});
  const block=(page,lines,x,top,size,leading,color=c.ink)=>lines.forEach((value,i)=>text(page,value,x,top+i*leading,size,color));
  function header(page,caption,instruction) {
    text(page,`RouteLeaf / ${caption}`,MARGIN,29,8,c.muted);
    text(page,m.title,MARGIN,44,18);
    block(page,wrap(instruction,9,CARD_W),MARGIN,76,9,13,c.muted);
  }
  for(let p=0;p<stats.bookletPages;p++) {
    const page=pdf.addPage(A4);
    header(page,t.booklet,p===0?t.instructions.replace('{start}',m.start):t.continuation);
    m.cards.slice(p*2,p*2+2).forEach((card,slot)=>{
      const top=CARD_TOPS[slot], layout=cardLayout(m,card);
      page.drawRectangle({x:CARD_X,y:A4[1]-top-CARD_H,width:CARD_W,height:CARD_H,color:c.paper,borderColor:c.line,borderWidth:.7});
      page.drawRectangle({x:CARD_X,y:A4[1]-top-CARD_H,width:5,height:CARD_H,color:c.green});
      text(page,card.id,CARD_X+18,top+14,26,c.ink,bold);
      text(page,layout.source,CARD_X+104,top+29,8.5,c.muted);
      let y=top+62;
      if(layout.groups.length){block(page,layout.groups,CARD_X+18,y,9,12,c.muted);y+=layout.groups.length*12+5;}
      block(page,layout.label,CARD_X+18,y,15,20);y+=layout.label.length*20;
      if(layout.hint.length){y+=7;block(page,layout.hint,CARD_X+18,y,9.5,13,c.muted);y+=layout.hint.length*13;}
      y+=8;text(page,card.kind==='select_one'?t.select:card.kind==='text'?t.write:t.note,CARD_X+18,y,9,c.muted);y+=17;
      if(card.kind==='select_one') layout.rows.forEach(row=>{
        line(page,CARD_X+18,y,CARD_X+CARD_W-18,y);
        block(page,row.label,CARD_X+18,y+6,11,15);
        text(page,row.destination,CARD_X+CARD_W-193,y+7,10.5,c.green);
        y+=row.height;
      });
      else { text(page,`${t.next}: ${destination(m,card.next)}`,CARD_X+18,y+12,12,c.green); }
    });
    line(page,36,793,559.28,793);text(page,`${t.page} ${p+1} / ${stats.bookletPages}`,36,801,8,c.muted);
    const count=t.count(stats.bookletPages,stats.answerSheetPages);text(page,count,559.28-width(count,8),801,8,c.muted);
  }
  for(let ap=0;ap<stats.answerSheetPages;ap++) {
  const answer=pdf.addPage(A4);header(answer,t.answer,t.answerIntro);
  text(answer,`${t.name} __________________________`,36,113,11);
  let y=151;
  answer.drawRectangle({x:36,y:A4[1]-y-26,width:CARD_W,height:26,color:c.paper});
  text(answer,t.question,44,y+7,9,c.muted);text(answer,t.response,335,y+7,9,c.muted);y+=26;
  for(const row of sheetLayout(m).slice(ap*10,ap*10+10)) {
    answer.drawRectangle({x:36,y:A4[1]-y-row.height,width:CARD_W,height:row.height,borderColor:c.line,borderWidth:.6});
    line(answer,326,y,326,y+row.height);
    block(answer,row.label,44,y+6,11,15);
    block(answer,row.source,44,y+6+row.label.length*15,8,11,c.muted);
    if(row.q.kind==='note') block(answer,wrap(t.noAnswer,9,215),335,y+8,9,13,c.muted);
    y+=row.height;
  }
  line(answer,36,793,559.28,793);text(answer,t.sheetFooter(ap+1,stats.answerSheetPages),36,801,8,c.muted);
  }
  return pdf.save();
}
