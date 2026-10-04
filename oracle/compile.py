"""Compile the delivered XLSX with official pyxform; never import RouteLeaf."""
import hashlib
import importlib.metadata
import json
from pathlib import Path
from openpyxl import load_workbook
from pyxform.xls2xform import xls2xform_convert

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'oracle' / 'generated'
OUT.mkdir(exist_ok=True)
source = ROOT / 'generated' / 'workshop.xlsx'
assert importlib.metadata.version('pyxform') == '4.5.0'
warnings = xls2xform_convert(source, OUT / 'workshop.xml', validate=False, pretty_print=True)
workbook = load_workbook(source, read_only=True, data_only=True)
def records(sheet):
    rows = list(workbook[sheet].values)
    return [dict(zip(rows[0], row)) for row in rows[1:] if any(x is not None for x in row)]
choices = records('choices')
questions = []
for row in records('survey'):
    raw = row['type'].split()
    kind = 'select_one' if raw[0] == 'select_one' else raw[0]
    assert kind in ('select_one', 'text', 'note'), f'Unsupported source fixture kind: {kind}'
    questions.append({'source':row['name'], 'kind':kind, 'label':row['label::English (en)'],
        'choices':[{'value':c['name'],'label':c['label::English (en)']} for c in choices if kind=='select_one' and c['list_name']==raw[1]]})
metadata = {'compiler':'pyxform', 'compilerVersion':importlib.metadata.version('pyxform'),
    'inputSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
    'xformSha256':hashlib.sha256((OUT/'workshop.xml').read_bytes()).hexdigest(),
    'warnings':warnings, 'odkValidate':'not-run (conversion only; external engine and browser are separate stages)', 'questions':questions}
(OUT/'source.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({k:v for k,v in metadata.items() if k!='questions'},ensure_ascii=False))
