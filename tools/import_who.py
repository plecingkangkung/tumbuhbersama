"""Extract official WHO daily LMS and independent percentile check vectors; stdlib only.
Run node tools/download-who.mjs then python tools/import_who.py.
"""
import zipfile, io, xml.etree.ElementTree as E, json, pathlib, hashlib
root=pathlib.Path(__file__).resolve().parents[1]
ns={'x':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
sources=json.loads((root/'.who-cache/sources.json').read_text())
data={}; checks=[]
for source in sources:
 metric,sex=source['metric'],source['sex']
 raw=(root/'.who-cache'/f'{metric}-{sex}.xlsx').read_bytes()
 source['sha256']=hashlib.sha256(raw).hexdigest()
 z=zipfile.ZipFile(io.BytesIO(raw))
 strings=[''.join(n.itertext()) for n in E.fromstring(z.read('xl/sharedStrings.xml')).findall('x:si',ns)]
 rows=[]
 for row in E.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//x:sheetData/x:row',ns):
  values=[]
  for c in row.findall('x:c',ns):
   v=c.find('x:v',ns)
   if v is not None: values.append(strings[int(v.text)] if c.get('t')=='s' else float(v.text))
  rows.append(values)
 header=rows.pop(0)
 assert len(rows)==1857 and [r[0] for r in rows]==list(range(1857))
 assert header[1:4]==['L','M','S']
 data.setdefault(metric,{})[sex]=[r[1:4] for r in rows]
 # Every official daily curve compared in tests, independent of LMS formula.
 checks.append({'metric':metric,'sex':sex,'values':[[r[header.index('P'+str(p))] for p in [1,5,10,25,50,75,90,95,99]] for r in rows]})
(root/'shared/data/who-lms.json').write_text(json.dumps(data,separators=(',',':')),encoding='utf8')
(root/'shared/data/who-checks.json').write_text(json.dumps(checks,separators=(',',':')),encoding='utf8')
(root/'shared/data/who-sources.json').write_text(json.dumps({'retrieved':'2026-09-09','ageUnit':'days','maxDay':1856,'monthsToDays':30.4375,'sources':sources},indent=2),encoding='utf8')
print('Extracted 11,142 daily LMS rows and independent percentile validation vectors.')
