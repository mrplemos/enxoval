import {repository} from './repository.js';

if(repository.getSignedInUser())location.replace('./#base');

document.querySelector('#login-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.currentTarget,button=event.submitter;button.disabled=true;
  document.querySelector('#login-error').textContent='';
  try {
    const values=Object.fromEntries(new FormData(form));
    await repository.signIn(values.email.trim(),values.password);
    form.reset();
    location.replace('./#base');
  } catch(error) {
    document.querySelector('#login-error').textContent=error.message||'Não foi possível entrar.';
    button.disabled=false;
  }
});
