"""Read-only extraction: python import-workbook.py workbook.xlsx. Requires openpyxl."""
import sys, json, hashlib
from pathlib import Path
import openpyxl

source = Path(sys.argv[1])
workbook = openpyxl.load_workbook(source, data_only=True)
root = Path(__file__).resolve().parents[1]
def extract(sheet, prefix, keys):
    return [dict(zip(keys, [v if v is not None else '' for v in row[:len(keys)]]))
            for row in list(workbook[sheet].values)[1:]
            if isinstance(row[0], str) and row[0].startswith(prefix)]
items = extract('Base de Itens', 'ITM-', ['id','category','type','description','original','quantity','unit','size','phase','brand','color','gift','fabric','status','notes'])
benchmarks = extract('Benchmark Enxoval', 'BEN-', ['id','category','type','description','phase','target','unit','rule','priority','timing','rationale','sources'])
for rows, numeric in [(items, 'quantity'), (benchmarks, 'target')]:
    for row in rows:
        for key, value in row.items():
            if key != numeric:
                row[key] = str(value)
for name, data in [('inventory',items), ('benchmarks',benchmarks)]:
    (root/'data'/f'{name}.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
manifest = {'source':source.name, 'sha256':hashlib.sha256(source.read_bytes()).hexdigest(), 'records':len(items), 'quantity':sum(i['quantity'] for i in items), 'benchmarks':len(benchmarks), 'method':'Values copied from Base de Itens and Benchmark Enxoval. Blank template rows and methodology footer excluded. Controle formulas recalculated by the app.'}
(root/'data'/'provenance.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(manifest,ensure_ascii=False))
