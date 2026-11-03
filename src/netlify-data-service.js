import {SCHEMA_VERSION, validateData} from './domain.js';

export const emptySnapshot = () => ({schemaVersion:SCHEMA_VERSION, items:[], benchmarks:[]});

// The gift field can contain names of family members and friends.
// Public readers receive a compatible data shape without these names.
export function publicSnapshot(snapshot) {
  const validated=validateData(snapshot);
  return {...validated,items:validated.items.map(item=>({...item,gift:''}))};
}

export function mutateSnapshot(current,action,payload={}) {
  const snapshot=validateData(current);
  if(action==='replaceAll') return validateData(payload.data);
  const config={
    saveItem:{collection:'items',key:'item'},
    deleteItem:{collection:'items',key:'id'},
    saveBenchmark:{collection:'benchmarks',key:'benchmark'},
    deleteBenchmark:{collection:'benchmarks',key:'id'}
  }[action];
  if(!config) throw new Error('Operação de edição desconhecida.');
  if(action.startsWith('save')) {
    const record=payload[config.key];
    if(!record||typeof record!=='object'||typeof record.id!=='string'||!record.id.trim())
      throw new Error('Registro inválido.');
    const rows=snapshot[config.collection];
    const at=rows.findIndex(row=>row.id===record.id);
    if(at<0) rows.push(record);
    else rows[at]=record;
  } else {
    const id=payload.id;
    if(typeof id!=='string'||!id.trim()) throw new Error('Identificador inválido.');
    const rows=snapshot[config.collection];
    if(!rows.some(row=>row.id===id)) throw new Error('Registro não encontrado.');
    snapshot[config.collection]=rows.filter(row=>row.id!==id);
  }
  return validateData(snapshot);
}
