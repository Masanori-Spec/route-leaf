/** DOM-only reader for the actual official component. Safe to serialize with evaluateAll. */
export function readQuestionElements(els){return els.map(el=>{
 const label=el.querySelector('.control-text > label');
 if(!label)throw new Error(`Missing official question label: ${el.id}`);
 const radios=Array.from(el.querySelectorAll('input[type="radio"]'));
 const choices=Array.from(el.querySelectorAll('label.value-option')).map(option=>{
  const input=option.querySelector('input[type="radio"]');
  if(!input)throw new Error(`Missing official choice radio: ${el.id}`);
  return {value:input.value,label:option.textContent??''};
 });
 if(radios.length!==choices.length)throw new Error(`Unlabeled official radio: ${el.id}`);
 return {id:el.id,label:label.textContent??'',required:label.classList.contains('required'),kind:radios.length?'select_one':el.querySelector('input:not([type="hidden"]),textarea')?'text':el.querySelector('.note-control')?'note':'unknown',choices};
});}
