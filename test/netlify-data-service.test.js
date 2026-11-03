import test from 'node:test';
import assert from 'node:assert/strict';
import {emptySnapshot,publicSnapshot,mutateSnapshot} from '../src/netlify-data-service.js';

const item={id:'ITM-test',category:'Roupas',type:'Body',description:'Body',
  quantity:1,unit:'peça',phase:'RN',brand:'',color:'',gift:'Nome privado',fabric:''};
const benchmark={id:'BEN-test',category:'Roupas',type:'Body',description:'Body',
  phase:'RN',target:2,unit:'peça',rule:'Descrição N3',priority:'Alta',
  timing:'Comprar agora',sources:''};
test('consulta pública não expõe nomes de presenteadores',()=>{
  const full={schemaVersion:3,items:[item],benchmarks:[benchmark]};
  const pub=publicSnapshot(full);
  assert.equal(pub.items[0].gift,'');
  assert.equal(full.items[0].gift,'Nome privado');
  assert.equal(pub.items.length,1);
});
test('cadastro, edição e exclusão preservam o contrato de dados',()=>{
  const start=emptySnapshot();
  const a=mutateSnapshot(start,'saveItem',{item});
  assert.equal(a.items.length,1);
  assert.equal(start.items.length,0);
  const b=mutateSnapshot(a,'saveBenchmark',{benchmark});
  assert.equal(b.benchmarks.length,1);
  const c=mutateSnapshot(b,'saveItem',{item:{...item,quantity:2}});
  assert.equal(c.items[0].quantity,2);
  const d=mutateSnapshot(c,'deleteItem',{id:item.id});
  assert.equal(d.items.length,0);
  assert.equal(d.benchmarks.length,1);
});
test('restauração rejeita duplicidades e campos inválidos',()=>{
  const a={schemaVersion:3,items:[item],benchmarks:[benchmark]};
  assert.throws(()=>mutateSnapshot(a,'replaceAll',{data:{...a,items:[item,item]}}),/duplicados/);
  assert.throws(()=>mutateSnapshot(a,'saveItem',{item:{...item,quantity:-1}}),/Quantidades/);
  assert.throws(()=>mutateSnapshot(a,'deleteBenchmark',{id:'inexistente'}),/não encontrado/);
});
