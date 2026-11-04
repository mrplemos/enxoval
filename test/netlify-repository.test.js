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

test('usa fetch nativo vinculado ao contexto global',async()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'fetch');
  const native=globalThis.fetch;
  let invoked=false;
  try {
    globalThis.fetch=function(path,options){
      assert.equal(this,globalThis);
      assert.equal(path,'/api/enxoval-data');
      invoked=true;
      return Promise.resolve(reply({data:empty,version:'v1',initialized:true,editor:false,user:null}));
    };
    const repository=new NetlifyRepository();
    await repository.load();
    assert.equal(invoked,true);
  } finally {
    if(descriptor) Object.defineProperty(globalThis,'fetch',descriptor);
    else globalThis.fetch=native;
  }
});

test('login, logout e novo login utilizam a mesma sessão do navegador',async()=>{
  const original=globalThis.__enxovalIdentity;
  let authenticated=false,loginCount=0,logoutCount=0;
  globalThis.__enxovalIdentity={
    login:async(email,password)=>{
      assert.equal(email,'editor@example.test');
      assert.equal(password,'correct-password');
      authenticated=true;loginCount++;
    },
    logout:async()=>{authenticated=false;logoutCount++;},
    getUser:async()=>authenticated?{email:'editor@example.test'}:null
  };
  try {
    const repository=new NetlifyRepository({fetchImpl:async(path)=>{
      assert.equal(path,'/api/enxoval-auth');
      return reply({editor:authenticated,user:authenticated?{email:'editor@example.test'}:null});
    }});
    await repository.signIn('editor@example.test','correct-password');
    assert.ok(repository.getSignedInUser());
    await repository.signOut();
    assert.equal(repository.getSignedInUser(),null);
    await repository.signIn('editor@example.test','correct-password');
    assert.ok(repository.getSignedInUser());
    assert.equal(loginCount,2);
    assert.equal(logoutCount,1);
  }finally{
    if(original===undefined)delete globalThis.__enxovalIdentity;
    else globalThis.__enxovalIdentity=original;
  }
});
test('sem papel de editor, a nova sessão é encerrada',async()=>{
  const original=globalThis.__enxovalIdentity;
  let logoutCount=0;
  globalThis.__enxovalIdentity={
    login:async()=>({}),
    logout:async()=>{logoutCount++;},
    getUser:async()=>null
  };
  try{
    const repository=new NetlifyRepository({fetchImpl:async()=>reply({editor:false,user:null})});
    await assert.rejects(()=>repository.signIn('any@example.test','password'),/permissão/);
    assert.equal(logoutCount,1);
  }finally{
    if(original===undefined)delete globalThis.__enxovalIdentity;
    else globalThis.__enxovalIdentity=original;
  }
});
