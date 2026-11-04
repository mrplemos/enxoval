import {handleAuthCallback,acceptInvite,updateUser,requestPasswordRecovery} from '@netlify/identity';
import {chooseNextStep,validatePasswordPair} from './identity-setup-rules.js';

const $=id=>document.getElementById(id);
const title=$('setup-title'), status=$('setup-status'),form=$('setup-form'),recoveryForm=$('recovery-form'),result=$('setup-result');
let invitation=null, mode=null;
const showError=message=>{status.textContent=message;status.classList.add('error');};
const showForm=(heading,action)=>{mode=action;title.textContent=heading;status.textContent='Escolha uma senha exclusiva, com pelo menos 12 caracteres.';form.hidden=false;};
const showRecoveryRequest=()=>{title.textContent='Recuperar acesso';status.textContent='Enviaremos um link para redefinir sua senha.';recoveryForm.hidden=false;};
const success=()=>{form.hidden=true;title.textContent='Senha configurada';status.classList.remove('error');status.textContent='Senha salva. Você já pode entrar na área administrativa do Enxoval.';result.hidden=false;};

async function init(){
  try {
    const callback=await handleAuthCallback();
    const step=chooseNextStep(callback);
    if(step==='invite'){invitation=callback.token;showForm('Criar senha de acesso','invite');}
    else if(step==='recovery')showForm('Redefinir senha','recovery');
    else if(step==='confirmed'){title.textContent='Conta confirmada';status.textContent='Seu endereço foi confirmado. Prossiga para a área de login.';result.hidden=false;}
    else if(new URLSearchParams(location.search).get('action')==='recover')showRecoveryRequest();
    else {
      title.textContent='Link de acesso necessário';
      showError('Abra o link enviado por e-mail pelo Netlify Identity. Para recuperar o acesso, use a opção de redefinição de senha no painel do Netlify.');
    }
  } catch(error){
    title.textContent='Não foi possível validar o link';
    showError('O link pode estar expirado ou já ter sido utilizado. Solicite outro e-mail de recuperação no Netlify Identity.');
  }
}
recoveryForm.addEventListener('submit',async event=>{
  event.preventDefault();
  const email=$('recovery-email').value.trim();
  const button=recoveryForm.querySelector('button[type="submit"]');
  button.disabled=true;status.classList.remove('error');
  status.textContent='Enviando solicitação…';
  try{
    await requestPasswordRecovery(email);
    recoveryForm.hidden=true;
    title.textContent='Confira seu e-mail';
    status.textContent='Se a conta estiver cadastrada, o Netlify enviará um link para definir uma nova senha.';
    result.hidden=false;
  }catch(error){
    showError('Não foi possível enviar a solicitação. Tente novamente em alguns minutos.');
  }finally{button.disabled=false;}
});
form.addEventListener('submit',async event=>{
  event.preventDefault();
  const password=$('setup-password').value,confirm=$('setup-confirm').value;
  const validation=validatePasswordPair(password,confirm);
  if(validation){showError(validation);return;}
  const button=form.querySelector('button[type="submit"]');button.disabled=true;status.classList.remove('error');status.textContent='Salvando a nova senha…';
  try {
    if(mode==='invite')await acceptInvite(invitation,password);
    else if(mode==='recovery')await updateUser({password});
    else throw new Error('Fluxo de acesso inválido.');
    invitation=null;
    form.reset();
    success();
  }catch(error){showError('Não foi possível salvar a senha. O link pode ter expirado. Solicite outro e-mail de recuperação.');}
  finally{button.disabled=false;}
});
init();
