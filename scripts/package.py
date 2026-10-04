"""Freeze a reviewable source snapshot without dependencies or generated test evidence."""
from pathlib import Path
import hashlib,json,zipfile
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT.parent/'route-leaf-output'
OUT.mkdir(exist_ok=True)
excluded={'node_modules','.venv','.git','tmp','test-results','__pycache__'}
files=[]
for p in sorted(ROOT.rglob('*')):
    if not p.is_file():continue
    rel=p.relative_to(ROOT)
    if any(part in excluded for part in rel.parts):continue
    if str(rel).startswith('oracle/generated/'):continue
    if rel.suffix in ('.pyc',):continue
    if str(rel).startswith('generated/') and (rel.suffix in ('.html','.png') or p.name.endswith('.inspect.ndjson')):continue
    files.append(p)
manifest={'product':'RouteLeaf','snapshot':'source snapshot; verification provenance in docs/VERIFICATION.md','createdUtc':datetime.now(timezone.utc).isoformat(),'files':[]}
archive=OUT/'route-leaf-source.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for p in files:
        data=p.read_bytes();name=p.relative_to(ROOT).as_posix()
        z.writestr('route-leaf/'+name,data)
        manifest['files'].append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'gitBlobSha1':hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()})
manifest['archive']={'filename':archive.name,'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}
with zipfile.ZipFile(archive) as z:
    assert len(z.namelist())==len(files)
    for f in manifest['files']:assert hashlib.sha256(z.read('route-leaf/'+f['path'])).hexdigest()==f['sha256']
(OUT/'source-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'files':len(files),'archive':manifest['archive']},indent=2))
