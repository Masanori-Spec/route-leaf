import { createApp, h } from 'vue';
// 1.0.3's actual npm export is lowercase, despite the README's older example.
import { OdkWebForm, webFormsPlugin } from '@getodk/web-forms';
import { engineTrace } from './engine.mjs';
const xml=await fetch('/generated/workshop.xml').then(r=>{if(!r.ok)throw new Error('Missing compiled XForm');return r.text();});
window.oracleEngine=answers=>engineTrace(xml,answers);
window.odkLoaded=false;
window.odkSubmission=null;
const app=createApp({render:()=>h(OdkWebForm,{
  formXml:xml,
  fetchFormAttachment:async()=>{throw new Error('No attachments are permitted in this fixture');},
  deviceId:'routeleaf-fixture-only',
  onLoaded:()=>{window.odkLoaded=true;},
  onSubmit:async(payload)=>{
    const file=payload.data[0].get('xml_submission_file');
    window.odkSubmission={status:payload.status,xml:await file.text()};
    // Capture locally. Never send a submission to an ODK server.
  }
})});
app.use(webFormsPlugin);
app.mount('#odk-consumer');
