// Pure control flow, shared by the browser UI and automated tests.
export function chooseNextStep(callback){
  if(callback?.type==='invite'&&typeof callback.token==='string'&&callback.token.length>0)return 'invite';
  if(callback?.type==='recovery'&&callback.user)return 'recovery';
  if(['confirmation','email_change','oauth'].includes(callback?.type))return 'confirmed';
  return 'invalid';
}
export function validatePasswordPair(password,confirmation){
  if(typeof password!=='string'||password.length<12||password.length>128)return 'Use uma senha de 12 a 128 caracteres.';
  if(password!==confirmation)return 'As senhas digitadas não são iguais.';
  return '';
}
