// Official ODK API only. No local relevant-expression evaluator is used here.
import { createInstance } from '@getodk/xforms-engine';
import { questionEvent, textAnswer } from './route-json.mjs';
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
export function controlNodes(root) {
  const result=[];
  const visit=node=>{
    if (['select','input','note'].includes(node.nodeType)) result.push(node);
    for (const child of node.currentState.children ?? []) visit(child);
  };
  visit(root);
  return result;
}
const sourceOf = node => node.currentState.reference.split('/').at(-1);
const kindOf = node => ({select:'select_one',input:'text',note:'note'})[node.nodeType];
export async function engineTrace(xml, answers) {
  const instance=await createInstance(xml,{instance:{preloadProperties:{deviceID:'routeleaf-fixture-only'}}});
  const root=instance.root;
  const english=root.languages.find(l=>l.language==='English (en)');
  if (english) root.setLanguage(english);
  const nodes=controlNodes(root), events=[], snapshots=[];
  const visible=()=>nodes.filter(n=>n.currentState.relevant).map(sourceOf);
  snapshots.push(visible());
  for (const node of nodes) {
    if (!node.currentState.relevant) continue;
    const source=sourceOf(node), kind=kindOf(node);
    events.push(questionEvent(source,kind,node.currentState.label?.asString,
      (node.currentState.valueOptions ?? []).map(c=>({value:c.value,label:c.label.asString}))));
    if (kind==='select_one') {
      const answer=answers[source];
      if (!node.getValueOption(answer)) throw new Error(`Missing official consumer choice ${source}=${answer}`);
      node.selectValue(answer); await tick();
      if (node.currentState.value.length!==1 || node.currentState.value[0]!==answer) throw new Error(`Consumer failed to store ${source}`);
      events.push({event:'answer',source,value:node.currentState.value[0]});
    } else if (kind==='text') {
      node.setValue(textAnswer(source)); await tick();
      events.push({event:'answer',source,value:node.currentState.value});
    }
    snapshots.push(visible());
  }
  const payload=await root.prepareInstancePayload();
  if (payload.status!=='ready') throw new Error(`Consumer terminal status ${payload.status}`);
  events.push({event:'terminal',value:'END'});
  const file=payload.data[0].get('xml_submission_file');
  return {events,snapshots,submissionXml:await file.text(),status:payload.status};
}
