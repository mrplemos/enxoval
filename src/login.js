import {repository} from './repository.js';

async function checkSession() {
  try {
    const state=await repository.request('/api/enxoval-auth');
    if(state.editor) location.replace('./#base');
  } catch {
    // Leave the form usable if a session lookup fails temporarily.
  }
}
checkSession();

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
