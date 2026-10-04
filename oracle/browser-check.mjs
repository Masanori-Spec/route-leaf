/**
 * Run on the hosted Ubuntu 22.04 CI runner with sandboxed system Chrome.
 * This tests the real official OdkWebForm, not RouteLeaf's screen renderer.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { workshopCases, traverseRoute, questionEvent, normalize, textAnswer } from './route-json.mjs';
import { loadRouteArtifact } from './route-input.mjs';
import { readQuestionElements } from './official-dom.mjs';
const root=import.meta.dirname;
const out=new URL('./generated/',import.meta.url);
await mkdir(out,{recursive:true});
const {artifactBytes,manifest,routeInputPath,routeInputMode}=await loadRouteArtifact();
const source=JSON.parse(await readFile(new URL('source.json',out),'utf8'));
const byLabel=new Map(source.questions.map(q=>[normalize(q.label),q]));
assert.equal(byLabel.size,source.questions.length,'Unique source labels are required for this fixed fixture');
const server=spawn(process.execPath,[`${root}/node_modules/vite/bin/vite.js`,'--host','127.0.0.1','--port','4175','--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']});
let serverOutput='';
server.stdout.on('data',x=>{serverOutput+=x;});
server.stderr.on('data',x=>{serverOutput+=x;});
let browser;
const results=[],errors=[],deniedRequests=[];
const report={status:'running',consumer:'@getodk/web-forms',version:'1.0.3',engineVersion:'1.0.3',routeInputPath,routeInputMode,
  routeSha256:createHash('sha256').update(artifactBytes).digest('hex'),
  xformSha256:source.xformSha256, inputSha256:source.inputSha256,
  sandbox:true,cases:results,errors,deniedRequests};
const writeReport=()=>writeFile(new URL('browser-report.json',out),JSON.stringify(report,null,2)+'\n');
async function domQuestions(page) {
  const controls=await page.locator('.question-container:visible').evaluateAll(readQuestionElements);
  return controls.map(c=>{
    const q=byLabel.get(normalize(c.label));
    assert.ok(q,`Unexpected official UI question label: ${c.label}`);
    assert.equal(c.required,q.kind==='select_one',`Official UI requiredness: ${q.source}`);
    return {...c,source:q.source,event:questionEvent(q.source,c.kind,c.label,c.choices)};
  });
}
try {
  let ready=false;
  for(let i=0;i<150;i++){
    if(server.exitCode!==null) throw new Error(`Vite exited: ${serverOutput}`);
    try{if((await fetch('http://127.0.0.1:4175')).ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,200));
  }
  assert.ok(ready,`Consumer server not ready: ${serverOutput}`);
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',chromiumSandbox:true});
  report.browserVersion=browser.version();
  for (const c of workshopCases) {
    const context=await browser.newContext({viewport:{width:1360,height:1100},locale:'en-US'});
    await context.tracing.start({screenshots:true,snapshots:true});
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.hostname==='127.0.0.1'&&url.port==='4175') return route.continue();
      deniedRequests.push({case:c.id,url:url.origin,path:url.pathname});
      return route.abort();
    });
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push({case:c.id,message:error.message}));
    try {
      await page.goto('http://127.0.0.1:4175',{waitUntil:'networkidle'});
      await page.waitForFunction(()=>window.odkLoaded&&typeof window.oracleEngine==='function');
      // The component intentionally leaves this status marker empty once ready.
      await page.locator('.form-initialization-status.ready').waitFor({state:'attached'});
      await page.locator('.question-container').first().waitFor({state:'visible'});
      await page.getByRole('radio',{name:'Print',exact:true}).waitFor({state:'visible'});
      const observedEngine=await page.evaluate(answers=>window.oracleEngine(answers),c.answers);
      const route=traverseRoute(manifest,c.answers);
      assert.deepEqual(route.events,observedEngine.events,`Browser engine mismatch: ${c.id}`);
      const events=[],visited=new Set(),snapshots=[];
      let controls=await domQuestions(page);
      snapshots.push(controls.map(q=>q.source));
      assert.deepEqual(snapshots[0],observedEngine.snapshots[0],`Initial UI relevance: ${c.id}`);
      while(true) {
        controls=await domQuestions(page);
        const next=controls.find(q=>!visited.has(q.source));
        if(!next) break;
        visited.add(next.source); events.push(next.event);
        const container=page.locator(`[id=${JSON.stringify(next.id)}]`);
        if(next.kind==='select_one') {
          const answer=c.answers[next.source];
          assert.equal(typeof answer,'string',`Missing test answer for ${next.source}`);
          const radio=container.locator(`input[type="radio"][value=${JSON.stringify(answer)}]`);
          await radio.check();
          assert.ok(await radio.isChecked());
          events.push({event:'answer',source:next.source,value:await radio.inputValue()});
        } else if(next.kind==='text') {
          const input=container.locator('input:not([type="hidden"]),textarea');
          await input.fill(textAnswer(next.source));
          events.push({event:'answer',source:next.source,value:await input.inputValue()});
        }
        // Poll DOM state rather than guessing a timer for Vue's reactive updates.
        const expected=observedEngine.snapshots[snapshots.length];
        assert.ok(expected,`Unexpected extra official UI question: ${next.source}`);
        let actual;
        for(let i=0;i<50;i++){
          actual=(await domQuestions(page)).map(q=>q.source);
          if(JSON.stringify(actual)===JSON.stringify(expected))break;
          await new Promise(r=>setTimeout(r,20));
        }
        assert.deepEqual(actual,expected,`UI relevance after ${next.source}: ${c.id}`);
        snapshots.push(actual);
      }
      await page.screenshot({path:new URL(`web-forms-${c.id}.png`,out).pathname,fullPage:true});
      await page.getByRole('button',{name:'Send',exact:true}).click();
      await page.waitForFunction(()=>window.odkSubmission!==null);
      const submission=await page.evaluate(()=>window.odkSubmission);
      assert.equal(submission.status,'ready',`Official UI terminal: ${c.id}`);
      const stored=await page.evaluate(xml=>{
        const doc=new DOMParser().parseFromString(xml,'text/xml');
        return Object.fromEntries([...doc.documentElement.children].map(e=>[e.localName,e.textContent]));
      },submission.xml);
      for(const event of events.filter(e=>e.event==='answer')) assert.equal(stored[event.source],event.value,`Submitted value ${event.source}`);
      events.push({event:'terminal',value:'END'});
      assert.deepEqual(events,route.events,`Official Web Forms source/answer/terminal mismatch: ${c.id}`);
      assert.deepEqual(snapshots,observedEngine.snapshots,`Complete UI state sequence: ${c.id}`);
      results.push({id:c.id,answers:c.answers,events,snapshots,cards:route.cards,submissionXml:submission.xml,match:true});
    } catch(error) {
      await page.screenshot({path:new URL(`failure-${c.id}.png`,out).pathname,fullPage:true}).catch(()=>{});
      await writeFile(new URL(`failure-${c.id}.html`,out),await page.content()).catch(()=>{});
      throw error;
    } finally {
      await context.tracing.stop({path:new URL(`trace-${c.id}.zip`,out).pathname});
      await context.close();
    }
  }
  assert.equal(results.length,6);
  assert.deepEqual(errors,[],'Official UI page errors');
  report.status='passed';
  console.log('Official ODK Web Forms: 6/6 full UI source/answer/terminal traces and all relevance snapshots match');
} catch(error) {
  report.status='failed';
  report.failure={name:error.name,message:error.message,stack:error.stack};
  throw error;
} finally {
  await writeReport();
  await writeFile(new URL('vite.log',out),serverOutput);
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
