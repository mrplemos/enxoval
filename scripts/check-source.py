"""Independent source reconciliation and SUMIFS evaluation; requires openpyxl."""
import json, re, sys
from pathlib import Path
import openpyxl
root=Path(__file__).resolve().parents[1]
w=openpyxl.load_workbook(sys.argv[1],data_only=False)
base=[r for r in list(w['Base de Itens'].values)[1:] if r[0]]
items=json.loads((root/'data/inventory.json').read_text())
keys=['id','category','type','description','original','quantity','unit','size','phase','brand','color','gift','fabric','status','notes']
for row,item in zip(base,items,strict=True):
    for col,key in enumerate(keys):
        expected=row[col] if key=='quantity' else str(row[col] if row[col] is not None else '')
        assert item[key]==expected,(item['id'],key)
result=[]
control=w['Controle']
for r in range(11,57):
    formula=control.cell(r,6).value
    # Read actual criteria columns and references in each workbook formula.
    pairs=re.findall(r"'Base de Itens'!\$([A-Z]):\$\1,(\$[A-Z]+[0-9]+|\"[^\"]*\")",formula)
    assert pairs,formula
    criteria=[(ord(col)-65,control[ref.replace('$','')].value if ref.startswith('$') else ref.strip('"')) for col,ref in pairs]
    have=sum(row[5] for row in base if all(row[col]==val for col,val in criteria))
    target=control.cell(r,4).value
    need=max(target-have,0)
    result.append({'id':f'BEN-{r-10:03}','have':have,'need':need,'status':'Completo' if need==0 else 'Falta' if have==0 else 'Parcial'})
(root/'tests/workbook-control.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(f'All {len(items)*len(keys)} inventory attributes reconcile; {len(result)} workbook SUMIFS formulas independently evaluated.')
