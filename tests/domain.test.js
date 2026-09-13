import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculate,validateData,parseBackup} from '../src/domain.js';
const read=name=>JSON.parse(readFileSync(new URL(`../data/${name}.json`,import.meta.url)));
const seed={schemaVersion:2,items:read('inventory'),benchmarks:read('benchmarks')};
const copy=()=>structuredClone(seed);
test('current workbook: 191 records, 491 quantities, 46 independent targets',()=>{
  assert.doesNotThrow(()=>validateData(seed));
  assert.equal(seed.items.length,191);assert.equal(seed.items.reduce((n,i)=>n+i.quantity,0),491);assert.equal(seed.benchmarks.length,46);
  assert.equal(seed.items.at(-1).id,'ITM-0191');assert.equal(seed.items.at(-2).id,'ITM-0190');
});
test('all 46 calculations reconcile to independent workbook SUMIFS extraction',()=>{
  const expected=JSON.parse(readFileSync(new URL('./workbook-control.json',import.meta.url)));
  assert.deepEqual(calculate(seed.items,seed.benchmarks).map(({id,have,need,status})=>({id,have,need,status})),expected);
});
test('N2 aggregates description variants and N3 requires exact classification',()=>{
  const b={...seed.benchmarks[0],type:'Meia',rule:'Tipo N2',target:3};
  const a={...seed.items[0],category:b.category,type:b.type,phase:b.phase,description:'Meia bichinho',quantity:2};
  assert.equal(calculate([a,{...a,id:'second',description:'Meia sapatinho',quantity:1}],[b])[0].have,3);
  assert.equal(calculate([a],[{...b,rule:'Descrição N3',description:'Meia sapatinho'}])[0].have,0);
});
test('phase and category prevent unrelated items counting',()=>{
  const b=seed.benchmarks[0],a={...seed.items[0],category:b.category,type:b.type,description:b.description,phase:b.phase,quantity:6};
  for(const patch of [{phase:'3–6 meses'},{category:'Outros acessórios'}])assert.equal(calculate([{...a,...patch}],[b])[0].have,0);
});
test('CRUD-equivalent changes recompute have, need and status without modifying benchmarks',()=>{
  const b={...seed.benchmarks[0],target:3};
  const i={...seed.items[0],category:b.category,type:b.type,description:b.description,phase:b.phase,quantity:2};
  let r=calculate([i],[b])[0];assert.equal(r.status,'Parcial');assert.equal(r.need,1);
  r=calculate([{...i,quantity:5}],[b])[0];assert.equal(r.have,5);assert.equal(r.need,0);assert.equal(r.surplus,2);assert.equal(r.status,'Completo');
  assert.equal(calculate([],[b])[0].status,'Falta');assert.equal(b.target,3);
});
test('zero target is complete; future needs retain planning timing',()=>{
  assert.equal(calculate([],[{...seed.benchmarks[0],target:0}])[0].status,'Completo');
  for(const timing of ['Planejar','Aguardar']) assert.equal(calculate([],[{...seed.benchmarks[0],timing}])[0].action,timing);
});
test('backup round-trip preserves every attribute and benchmark independently',()=>{
  assert.deepEqual(parseBackup(JSON.stringify(seed)),seed);
  assert.deepEqual(parseBackup(JSON.stringify({schemaVersion:2,items:[],benchmarks:[]})),{schemaVersion:2,items:[],benchmarks:[]});
});
test('invalid and future backups reject before mutation',()=>{
  assert.throws(()=>parseBackup('{broken'));
  for(const mutate of [d=>d.schemaVersion=1,d=>d.items.push(d.items[0]),d=>d.items[0].quantity=-1,d=>d.items[0].quantity=1.5,d=>d.items[0].quantity='2',d=>delete d.items[0].brand,d=>d.benchmarks[0].rule='Anything',d=>d.benchmarks[0].target=null,d=>d.items[0].category='']){const d=copy();mutate(d);assert.throws(()=>validateData(d));}
});
