export class RouteError extends Error {constructor(code,detail=''){super(detail||code);this.name='RouteError';this.code=code;this.detail=detail;}}
const fail=(c,d)=>{throw new RouteError(c,d)};
const IDENT=/^[A-Za-z_][A-Za-z0-9_]{0,47}$/;
const plain=(v,where,max=400)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(v)||/\$\{|<[^>]*>|\[[^\]]*\]\(|https?:\/\//.test(v))fail('plain_text',where);return v.trim();};
export function parseRelevance(text,prior){
 if(!text.trim())return null;if(text.length>800)fail('expression_length',text.slice(0,40));
 let p=0,n=0;const refs=new Set();const ws=()=>{while(/\s/.test(text[p]||'')&&p<text.length)p++;};
 const eat=s=>{ws();if(text.slice(p,p+s.length)===s){p+=s.length;return true;}return false;};
 const keyword=s=>{ws();if(text.slice(p,p+s.length)===s&&!/[A-Za-z_0-9]/.test(text[p+s.length]||'')){p+=s.length;return true;}return false;};
 function atom(depth=0){if(depth>12||++n>120)fail('expression_complexity','Relevance');ws();if(eat('(')){const a=or(depth+1);if(!eat(')'))fail('relevance_syntax',text);return a;}
 const m=/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}/.exec(text.slice(p));if(!m)fail('relevance_syntax',text);p+=m[0].length;if(!eat('='))fail('relevance_syntax',text);ws();const q=text[p];if(q!=="'"&&q!=='"')fail('relevance_syntax',text);p++;const end=text.indexOf(q,p);if(end<0)fail('relevance_syntax',text);const value=text.slice(p,end);p=end+1;if(!value||/[\r\n\\]/.test(value))fail('relevance_value',text);const controller=prior.get(m[1]);if(!controller||controller.kind!=='select_one')fail('earlier_select_only',m[1]);if(!controller.choices.some(c=>c.value===value))fail('unknown_choice',`${m[1]} = ${value}`);refs.add(m[1]);return {op:'eq',name:m[1],value};}
 function and(d=0){let a=atom(d);while(keyword('and'))a={op:'and',left:a,right:atom(d)};return a;}
 function or(d=0){let a=and(d);while(keyword('or'))a={op:'or',left:a,right:and(d)};return a;}
 const ast=or();ws();if(p!==text.length)fail('relevance_syntax',text);return {ast,refs:[...refs]};
}
export function evaluate(ast,answers){if(!ast)return true;if(ast.op==='eq')return answers[ast.name]===ast.value;if(ast.op==='and')return evaluate(ast.left,answers)&&evaluate(ast.right,answers);if(ast.op==='or')return evaluate(ast.left,answers)||evaluate(ast.right,answers);fail('invalid_ast');}
function table(matrix,name,allowed,required){if(!Array.isArray(matrix)||!matrix.length)fail('missing_sheet',name);const heads=matrix[0].map(x=>String(x??'').trim());if(new Set(heads.filter(Boolean)).size!==heads.filter(Boolean).length)fail('duplicate_header',name);for(const col of required)if(!heads.includes(col))fail('missing_column',`${name}.${col}`);return matrix.slice(1).flatMap((values,i)=>{if(values.every(x=>x===''||x==null))return [];const row={_row:i+2};for(let j=0;j<Math.max(values.length,heads.length);j++){const v=values[j]??'';if(typeof v!=='string')fail('text_cells_only',`${name}!${i+2}`);const h=heads[j]||'';if(v!==''&&!allowed(h))fail('unsupported_column',`${name}.${h||'(blank)'}`);if(h)row[h]=v.trim();}return [row];});}
const selected=(row,base,lang)=>row[`${base}::${lang}`]??row[base]??'';
export function availableLanguages(tables){const heads=tables.survey?.[0]||[];const langs=heads.filter(x=>typeof x==='string'&&x.startsWith('label::')).map(x=>x.slice(7));return langs.length?langs:['default'];}
export function parseForm(tables,language){
 for(const key of Object.keys(tables))if(!['survey','choices','settings'].includes(key)&&tables[key].some(r=>r.some(x=>x!==''&&x!=null)))fail('unsupported_sheet',key);
 const languages=availableLanguages(tables);language=language||languages[0];if(!languages.includes(language))fail('language_missing',language);
 const trans=h=>/^(label|hint)(::.+)?$/.test(h);
 const survey=table(tables.survey,'survey',h=>['type','name','required','relevant'].includes(h)||trans(h),['type','name']);
 const rows=table(tables.choices,'choices',h=>['list_name','name'].includes(h)||/^label(::.+)?$/.test(h),['list_name','name']);
 if(survey.length>100||rows.length>240)fail('input_limit','Rows');
 const choices=new Map();for(const r of rows){if(!IDENT.test(r.list_name||'')||!IDENT.test(r.name||''))fail('choice_code',`${r.list_name}.${r.name}`);const list=choices.get(r.list_name)||[];if(list.some(c=>c.value===r.name))fail('duplicate_choice',`${r.list_name}.${r.name}`);list.push({value:r.name,label:plain(selected(r,'label',language),`choices row ${r._row}`,140)});choices.set(r.list_name,list);if(list.length>8)fail('choice_limit',r.list_name);}
 let title='Interview';if(tables.settings){const s=table(tables.settings,'settings',h=>['form_title','form_id','version','default_language'].includes(h),[]);if(s.length>1)fail('settings_rows','settings');if(s[0]?.form_title)title=plain(s[0].form_title,'form_title',100);}
 const questions=[],prior=new Map(),groups=[],allNames=new Set(),controllers=new Set();
 for(const r of survey){const type=(r.type||'').replace(/\s+/g,' ').trim();if(type==='end_group'||type==='end group'){if(!groups.length)fail('groups_unbalanced',`survey row ${r._row}`);if(Object.entries(r).some(([k,v])=>!['_row','type','name'].includes(k)&&v))fail('group_end_fields',`row ${r._row}`);groups.pop();continue;}
 if(!IDENT.test(r.name||'')||allNames.has(r.name))fail('question_name',r.name||`row ${r._row}`);allNames.add(r.name);
 const rel=parseRelevance(r.relevant||'',prior);for(const ref of rel?.refs||[])controllers.add(ref);
 if(type==='begin_group'||type==='begin group'){if(groups.length>=2)fail('group_depth',r.name);if(r.required)fail('unsupported_required',r.name);if(Object.entries(r).some(([k,v])=>/^hint(::|$)/.test(k)&&v))fail('group_hint',r.name);const groupLabel=selected(r,'label',language);if(!groupLabel&&Object.entries(r).some(([k,v])=>/^label(::|$)/.test(k)&&v))fail('plain_text',r.name);groups.push({ast:rel?.ast??null,label:groupLabel?plain(groupLabel,r.name,120):''});continue;}
 const m=/^select_one ([A-Za-z_][A-Za-z0-9_]*)$/.exec(type);const kind=m?'select_one':type;if(!['select_one','text','note'].includes(kind))fail('unsupported_type',`${r.name}: ${type}`);
 if(kind==='select_one'&&!['yes','true()'].includes(r.required||''))fail('select_required',r.name);if(kind!=='select_one'&&!['','yes','no','true()','false()'].includes(r.required||''))fail('unsupported_required',r.name);if(kind==='text'&&['yes','true()'].includes(r.required))fail('required_text_unsupported',r.name);if(kind==='note'&&['yes','true()'].includes(r.required))fail('note_required',r.name);
 const list=m?choices.get(m[1]):[];if(m&&(!list||list.length<2))fail('choice_list',m[1]);
 let relevance=rel?.ast??null;for(const g of groups)if(g.ast)relevance=relevance?{op:'and',left:g.ast,right:relevance}:g.ast;
 const q={name:r.name,kind,number:questions.length+1,label:plain(selected(r,'label',language),r.name,320),hint:selected(r,'hint',language)?plain(selected(r,'hint',language),`${r.name} hint`,220):'',choices:list||[],required:['yes','true()'].includes(r.required||''),relevance,groups:groups.map(g=>g.label).filter(Boolean)};questions.push(q);prior.set(q.name,q);if(questions.length>30)fail('question_limit','30');
 }
 if(groups.length)fail('groups_unbalanced','Unclosed group');if(!questions.length)fail('no_questions','survey');
 return {title,language,languages,questions,controllers:[...controllers]};
}
export function compileForm(form,{historyLimit=512,cardLimit=80}={}){
 const {questions}=form;const controllers=new Set(form.controllers);let leaves=0;const registry=new Map(),histories=[];
 function build(i,answers,visited){while(i<questions.length&&!evaluate(questions[i].relevance,answers))i++;if(i===questions.length){if(++leaves>historyLimit)fail('history_limit',String(historyLimit));histories.push({answers:{...answers},questions:visited});return 'END';}
 const q=questions[i];const targets=[];if(q.kind==='select_one'&&controllers.has(q.name)){for(const c of q.choices)targets.push(build(i+1,{...answers,[q.name]:c.value},[...visited,q.name]));}else{const next=build(i+1,answers,[...visited,q.name]);targets.push(...(q.kind==='select_one'?q.choices.map(()=>next):[next]));}
 const key=JSON.stringify([i,...targets.map(t=>t==='END'?t:t.order)]);if(registry.has(key))return registry.get(key);const node={key,i,targets,order:registry.size};registry.set(key,node);if(registry.size>cardLimit)fail('card_limit',String(cardLimit));return node;
 }
 const root=build(0,{},[]);const nodes=[...registry.values()].sort((a,b)=>a.i-b.i||a.order-b.order);nodes.forEach((n,i)=>n.id=`C${String(i+1).padStart(2,'0')}`);const dest=n=>n==='END'?'END':n.id;
 const cards=nodes.map((n,idx)=>{const q=questions[n.i];const card={id:n.id,source:q.name,questionNumber:q.number,label:q.label,hint:q.hint,groups:q.groups,kind:q.kind,required:q.required,page:Math.floor(idx/2)+1};if(q.kind==='select_one')card.options=q.choices.map((c,j)=>({...c,next:dest(n.targets[j])}));else card.next=dest(n.targets[0]);return card;});
 const cardMap=new Map(cards.map(c=>[c.id,c]));for(const h of histories){let id=dest(root);h.cards=[];while(id!=='END'){const c=cardMap.get(id);h.cards.push(id);id=c.kind==='select_one'?(c.options.find(x=>x.value===h.answers[c.source])||c.options[0]).next:c.next;}}
 const reached=new Set(cards.map(c=>c.source));return {schema:'routeleaf/1',title:form.title,language:form.language,start:dest(root),counts:{questions:questions.length,histories:histories.length,cards:cards.length,pages:Math.ceil(cards.length/2),answerSheetPages:Math.ceil(questions.length/10)},controllers:form.controllers,cards,histories,questions:questions.map(({relevance,...q})=>q),unreachable:questions.filter(q=>!reached.has(q.name)).map(q=>q.name),limits:{questions:30,histories:historyLimit,cards:cardLimit},workflow:'fresh-forward-interview; changing a prior routing answer requires a clean restart'};
}
export function compileTables(tables,language){return compileForm(parseForm(tables,language));}
