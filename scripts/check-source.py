"""Independent source reconciliation and benchmark evaluation; requires openpyxl."""
import json, sys
from pathlib import Path
import openpyxl
root=Path(__file__).resolve().parents[1]
w=openpyxl.load_workbook(sys.argv[1],data_only=True)
base=[r for r in list(w['Base de Itens'].values)[1:] if r[0]]
items=json.loads((root/'data/inventory.json').read_text())
keys=['id','category','type','description','quantity','unit','phase','brand','color','gift','fabric']
for row,item in zip(base,items,strict=True):
    for col,key in enumerate(keys):
        expected=row[col] if key=='quantity' else str(row[col] if row[col] is not None else '')
        assert item[key]==expected,(item['id'],key)
result=[]
control=w['Controle']
benchmarks=[r for r in list(w['Benchmark Enxoval'].values)[1:] if r[0]]
for index, benchmark in enumerate(benchmarks):
    benchmark_id, category, item_type, description, phase, target, _, rule, _, timing, _ = benchmark
    have=sum(row[4] for row in base if row[1]==category and row[2]==item_type and row[6]==phase and (rule=='Tipo N2' or row[3]==description))
    need=max(target-have,0)
    status='Completo' if need==0 else 'Falta' if have==0 else 'Parcial'
    action='Não comprar' if need==0 else timing
    control_row=11+index
    assert [control.cell(control_row,c).value for c in range(6,11)] == [have,need,have-target,status,action], benchmark_id
    result.append({'id':benchmark_id,'have':have,'need':need,'status':status})
(root/'tests/workbook-control.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
assert len(base)==187 and sum(row[4] for row in base)==487 and len(set(row[0] for row in base))==187
assert not {'ITM-0133','ITM-0134','ITM-0135','ITM-0136'} & {row[0] for row in base}
assert control['B4'].value==187 and control['B5'].value==487 and control['B6'].value==12 and control['B7'].value==18
print(f'All {len(items)*len(keys)} inventory attributes reconcile; {len(result)} benchmark rows independently evaluated.')
