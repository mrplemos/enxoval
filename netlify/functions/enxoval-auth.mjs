import {login,logout,getUser,verifyRequestOrigin} from '@netlify/identity';

const json=(data,status=200)=>Response.json(data,{
  status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
});
const canEdit=(user)=>!!user?.roles?.includes('enxoval-admin');

export default async function handler(req) {
  if(!['GET','POST'].includes(req.method))return json({error:'Método não permitido.'},405);
  if(req.method==='GET') {
    try {const user=await getUser();return json({editor:canEdit(user),user:canEdit(user)?{email:user.email}:null});}
    catch {return json({editor:false,user:null});}
  }
  try {
    verifyRequestOrigin(req);
    const body=await req.json();
    if(body.action==='login'){
      if(typeof body.email!=='string'||typeof body.password!=='string'||!body.email.trim()||!body.password)
        return json({error:'Informe e-mail e senha.'},400);
      await login(body.email.trim(),body.password);
      return json({ok:true});
    }
    if(body.action==='logout'){await logout();return json({ok:true});}
    return json({error:'Operação desconhecida.'},400);
  }catch(error){
    console.error('enxoval-auth:',error?.name||'error');
    return json({error:'Não foi possível autenticar. Confira as credenciais e tente novamente.'},401);
  }
}
export const config={path:'/api/enxoval-auth'};
