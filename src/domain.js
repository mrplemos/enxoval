export const SCHEMA_VERSION = 2;
export const PHASES = ['RN', '1–3 meses', '3–6 meses', '6–9 meses', '9–12 meses', 'Sem fase'];
export const TIMINGS = ['Comprar agora', 'Planejar', 'Aguardar'];
export const itemFields = ['id','category','type','description','quantity','unit','phase','brand','color','gift','fabric'];
export const benchmarkFields = ['id','category','type','description','phase','target','unit','rule','priority','timing','sources'];
export function matches(item, benchmark) {
  return item.category === benchmark.category && item.type === benchmark.type && item.phase === benchmark.phase &&
    (benchmark.rule === 'Tipo N2' || item.description === benchmark.description);
}
export function calculate(items, benchmarks) {
  return benchmarks.map(b => {
    const included = items.filter(i => matches(i,b));
    const have = included.reduce((n,i) => n+i.quantity,0);
    const need = Math.max(b.target-have,0);
    return {...b,have,need,included:included.map(i=>i.id),surplus:Math.max(have-b.target,0),status:need===0?'Completo':have===0?'Falta':'Parcial',action:need===0?'Não comprar':b.timing};
  });
}
export function validateData(data) {
  if (!data || data.schemaVersion !== SCHEMA_VERSION || !Array.isArray(data.items) || !Array.isArray(data.benchmarks)) throw new Error('Backup incompatível. Use um arquivo exportado pelo Enxoval na versão atual.');
  for (const [rows,fields,number] of [[data.items,itemFields,'quantity'],[data.benchmarks,benchmarkFields,'target']]) {
    if (rows.length>10000) throw new Error('O backup ultrapassa o limite de 10.000 registros.');
    const ids = new Set();
    for (const row of rows) {
      if (!row || typeof row !== 'object') throw new Error('Registro inválido.');
      for (const field of fields) {
        if (field===number) { if (!Number.isSafeInteger(row[field]) || row[field]<0) throw new Error('Quantidades devem ser inteiros não negativos.'); }
        else if (typeof row[field]!=='string' || row[field].length>10000) throw new Error(`Campo inválido: ${field}.`);
      }
      if (['id','category','type','description','phase','unit'].some(f=>!row[f].trim())) throw new Error('Preencha identificação, classificação, fase e unidade.');
      if (ids.has(row.id)) throw new Error('O backup contém IDs duplicados.');
      ids.add(row.id);
      if (number==='target' && (!['Tipo N2','Descrição N3'].includes(row.rule) || !TIMINGS.includes(row.timing) || !['Alta','Média','Baixa'].includes(row.priority))) throw new Error('Regra de benchmark inválida.');
    }
  }
  return structuredClone({schemaVersion:SCHEMA_VERSION,items:data.items,benchmarks:data.benchmarks});
}
export function parseBackup(text) {
  if (text.length>10_000_000) throw new Error('Backup muito grande (máximo 10 MB).');
  return validateData(JSON.parse(text));
}
