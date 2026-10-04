import fs from 'node:fs/promises';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const project=path.resolve(process.env.ROUTELEAF_PROJECT||process.cwd());
const {workshop}=await import(pathToFileURL(path.join(project,'src/fixture.mjs')));
const out=path.join(project,'generated');
const wb=Workbook.create();for(const [name,rows] of Object.entries(workshop)){const s=wb.worksheets.add(name);s.showGridLines=false;s.getRangeByIndexes(0,0,rows.length,rows[0].length).values=rows;const all=s.getRangeByIndexes(0,0,rows.length,rows[0].length);all.format.font={name:'Arial',size:11};all.format.rowHeight=48;all.format.columnWidth=30;all.format.wrapText=true;s.getRangeByIndexes(0,0,1,rows[0].length).format={fill:'#294C3D',font:{name:'Arial',bold:true,color:'#FFFFFF'}};if(name==='survey'){s.getRange('C:D').format.columnWidth=45;s.getRange('H:H').format.columnWidth=65;}s.freezePanes.freezeRows(1);}
wb.recalculate();await fs.mkdir(out,{recursive:true});console.log((await wb.inspect({kind:'table',range:'survey!A1:H10',include:'values,formulas',tableMaxRows:10,tableMaxCols:8,maxChars:7000})).ndjson);console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',options:{useRegex:true,maxResults:20}})).ndjson);for(const [name,rows] of Object.entries(workshop)){const p=await wb.render({sheetName:name,range:`A1:${String.fromCharCode(64+rows[0].length)}${rows.length}`,scale:1});await fs.writeFile(`${out}/${name}-preview.png`,new Uint8Array(await p.arrayBuffer()));}await(await SpreadsheetFile.exportXlsx(wb)).save(`${out}/workshop.xlsx`);
