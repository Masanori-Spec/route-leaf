// Portable entry point; the oracle has its own pinned dependency lock.
import { spawnSync } from 'node:child_process';
const cwd=new URL('../oracle/',import.meta.url);
const mode=process.argv[2]??'engine';
if(!['engine','browser','unit'].includes(mode)) throw new Error('Use consumer-check.mjs engine|browser|unit');
const args=mode==='unit'?['--test','route-json.test.mjs','route-input.test.mjs']:[mode==='engine'?'engine-node.mjs':'browser-check.mjs'];
const result=spawnSync(process.execPath,args,{cwd,stdio:'inherit'});
process.exit(result.status??1);
