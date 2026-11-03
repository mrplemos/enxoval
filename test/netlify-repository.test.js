import test from 'node:test';
import assert from 'node:assert/strict';
import {NetlifyRepository} from '../src/netlify-repository.js';

const empty={schemaVersion:3,items:[],benchmarks:[]};
const reply=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
test('consulta pública sem permissão de edição',async()=>{
  const requests=[];
  const repository=new NetlifyRepository({fetchImpl:async(path,options)=>{
    requests.push({path,options});
    return reply({data:empty,version:'v1',initialized:true,editor:false,user:null});
  }});
  const data=await repository.load();
  assert.deepEqual(data,empty);
  assert.equal(repository.getSignedInUser(),null);
  assert.equal(repository.version,'v1');
  assert.equal(requests[0].path,'/api/enxoval-data');
});
test('escrita envia versão e mantém a resposta validada',async()=>{
  const requests=[];
  const repository=new NetlifyRepository({fetchImpl:async(path,options)=>{
    requests.push({path,options});
    return reply({data:empty,version:requests.length===1?'v1':'v2',initialized:true,editor:true,user:{email:'admin@example.test'}});
  }});
  await repository.load();
  await repository.replaceAll(empty);
  const command=JSON.parse(requests[1].options.body);
  assert.equal(command.action,'replaceAll');
  assert.equal(command.expectedVersion,'v1');
  assert.equal(repository.version,'v2');
});
test('não mascara conflitos de edições concorrentes',async()=>{
  const repository=new NetlifyRepository({fetchImpl:async()=>{
    return reply({error:'Conflito de edição.'},409);
  }});
  await assert.rejects(()=>repository.replaceAll(empty),error=>error.status===409);
});
