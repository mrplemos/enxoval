import {getStore} from '@netlify/blobs';
import {getUser,verifyRequestOrigin} from '@netlify/identity';
import {emptySnapshot,publicSnapshot,mutateSnapshot} from '../../src/netlify-data-service.js';

const STORE='enxoval-private', KEY='current';
const json=(data,status=200)=>Response.json(data,{
  status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
});
const editorInfo=async()=>{
  const user=await getUser();
  return user?.roles?.includes('enxoval-admin')?{email:user.email}:null;
};

export default async function handler(req) {
  if(!['GET','POST'].includes(req.method))return json({error:'Método não permitido.'},405);
  try {
    if(req.method==='POST') verifyRequestOrigin(req);
    const user=await editorInfo();
    const editor=!!user;
    if(req.method==='POST'&&!editor)return json({error:'Acesso de edição não autorizado.'},403);
    const store=getStore(STORE);
    const current=await store.getWithMetadata(KEY,{consistency:'strong',type:'json'});
    const data=current?.data??emptySnapshot();
    const version=current?.etag??null;
    if(req.method==='GET'){
      return json({data:editor?data:publicSnapshot(data),version,initialized:!!current,editor,user});
    }
    const raw=await req.text();
    if(raw.length>4_000_000)return json({error:'Arquivo muito grande para importar.'},413);
    let command;
    try {command=JSON.parse(raw);}catch{return json({error:'JSON inválido.'},400);}
    if(!command||!Object.hasOwn(command,'expectedVersion'))
      return json({error:'Atualize os dados antes de editar.'},428);
    if(!current&&command.action!=='replaceAll')
      return json({error:'Importe primeiro um backup válido na área administrativa.'},409);
    if(command.expectedVersion!==version)
      return json({error:'Os dados foram alterados em outra sessão. Recarregue antes de salvar.'},409);
    let next;
    try {next=mutateSnapshot(data,command.action,command.payload);}
    catch(error){return json({error:error.message||'Dados inválidos.'},400);}
    const result=await store.setJSON(KEY,next,current?{onlyIfMatch:version}:{onlyIfNew:true});
    if(!result.modified)
      return json({error:'Conflito de edição. Recarregue os dados antes de tentar novamente.'},409);
    const saved=await store.getWithMetadata(KEY,{consistency:'strong',type:'json'});
    return json({data:next,version:saved?.etag??null});
  }catch(error){
    console.error('enxoval-data:',error);
    return json({error:'Serviço de dados indisponível. Tente novamente.'},503);
  }
}
export const config={path:'/api/enxoval-data'};
