import {calculate,matches,PHASES,TIMINGS,parseBackup} from './domain.js';
import {repository} from './repository.js';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data, tab='inventory', phase='', query='', category='', timing='Comprar agora', dashboardPhase='RN', dashboardStatus='', timer;
let canEdit=!!repository.getSignedInUser();
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('enxoval-changes'):null;
const uniq=values=>[...new Set(values.filter(Boolean))];
const options=(values,current='',empty='')=>(empty?`<option value="">${esc(empty)}</option>`:'')+values.map(v=>`<option ${v===current?'selected':''}>${esc(v)}</option>`).join('');
const route=()=>{const requested=location.hash.slice(1);return requested==='base'&&!canEdit?'dashboard':['dashboard','compras','base'].includes(requested)?requested:'dashboard';};
function notify(message) {clearTimeout(timer);$('#notice').textContent=message;$('#notice').classList.add('show');timer=setTimeout(()=>$('#notice').classList.remove('show'),6000);}
function error(e) {console.error(e);notify(e.message || 'Não foi possível concluir. Tente novamente.');}
function announceChange() {channel?.postMessage('changed');}
async function update(action,message) {data=await action();render();announceChange();notify(message);}
const title=b=>b.rule==='Tipo N2'?b.type:b.description;
const badge=r=>`<span class="badge ${r.need===0?'complete':r.have?'partial':'missing'}">${esc(r.status)}</span>`;
const fits=r=>(!phase||r.phase===phase)&&(!category||r.category===category)&&(!query||[r.description,r.type,r.brand,r.color,r.gift].join(' ').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));

function filters() {return `<div class="filters"><label>Buscar<input id="search" type="search" value="${esc(query)}" placeholder="Item, marca, presente…"></label><label>Fase<select id="phase">${options(uniq([...PHASES,...data.items.map(i=>i.phase),...data.benchmarks.map(b=>b.phase)]),phase,'Todas as fases')}</select></label><label>Categoria<select id="category">${options(uniq([...data.items,...data.benchmarks].map(i=>i.category)),category,'Todas as categorias')}</select></label></div>`;}
function render() {
  if(!data)return;
  const page=route(), rows=calculate(data.items,data.benchmarks), shown=rows.filter(fits);
  document.querySelectorAll('nav a').forEach(a=>{if(a.hash===`#${page}`)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  updateAccess();
  let html=`<div class="page-heading"><div><p class="eyebrow">NOSSO ENXOVAL</p><h1>${{dashboard:'Um pequeno passo de cada vez.',compras:'O que ainda falta',base:'Tudo no seu lugar'}[page]}</h1></div>${canEdit?'<button class="primary" data-action="add">+ Adicionar item</button>':'<button data-action="login">Entrar para editar</button>'}</div>`;
  if(page==='dashboard') {
    const phases=uniq([...PHASES.filter(p=>rows.some(r=>r.phase===p)),...rows.map(r=>r.phase)]);
    if(!phases.includes(dashboardPhase))dashboardPhase=phases[0]||'RN';
    const phaseRows=rows.filter(r=>r.phase===dashboardPhase);
    const visible=phaseRows.filter(r=>!dashboardStatus||r.status===dashboardStatus);
    html+=`<div class="phase-tabs" aria-label="Fase do enxoval">${phases.map(p=>`<button data-dashboard-phase="${esc(p)}" aria-pressed="${p===dashboardPhase}">${esc(p)}</button>`).join('')}</div>
      <div class="section-heading phase-title"><h2>${esc(dashboardPhase)}</h2><span>${phaseRows.length} itens de referência</span></div>
      <div class="status-cards" aria-label="Filtrar por situação">${[['Completo','complete','✓','Tudo pronto'],['Parcial','partial','◐','Já começamos'],['Falta','missing','○','Ainda precisamos']].map(([status,cls,icon,label])=>`<button class="status-card ${cls}" data-dashboard-status="${status}" aria-pressed="${dashboardStatus===status}"><span class="status-icon" aria-hidden="true">${icon}</span><span>${status}<small>${label}</small></span><strong>${phaseRows.filter(r=>r.status===status).length}</strong></button>`).join('')}</div>
      <section class="panel phase-list"><div class="section-heading"><h2>${dashboardStatus||'Todos os itens'}</h2>${dashboardStatus?'<button data-dashboard-status="">Ver todos</button>':'<span>Temos / recomendado</span>'}</div>
      ${visible.length?visible.map(r=>`<article class="layette-item"><div class="item-line"><div class="item-name"><h3>${esc(title(r))}</h3><span>${esc(r.category)} · ${esc(r.unit)}</span></div><div class="item-progress"><span><strong>${r.have}</strong> / ${r.target}</span><progress value="${Math.min(r.have,r.target)}" max="${r.target||1}" aria-label="${esc(title(r))}: temos ${r.have} de ${r.target}"></progress></div><div class="item-status">${badge(r)}<small>${r.need?`Faltam ${r.need} · ${esc(r.timing)}`:r.surplus?`${r.surplus} acima da referência`:'Quantidade atendida'}</small></div>${r.need&&canEdit?`<button data-register="${esc(r.id)}">+ Registrar item</button>`:''}</div><details class="owned-details"><summary>Ver itens possuídos (${r.included.length})</summary>${r.included.length?`<ul>${r.included.map(id=>{const i=data.items.find(i=>i.id===id);return `<li><span><strong>${i.quantity} × ${esc(i.description)}</strong><small>${esc([i.brand,i.color,i.gift&&'Presente de '+i.gift].filter(Boolean).join(' · '))}</small></span>${canEdit?`<button data-edit="${esc(i.id)}">Editar</button>`:''}</li>`;}).join('')}</ul>`:'<p>Nenhum item correspondente nesta fase.</p>'}</details></article>`).join(''):'<div class="empty"><h3>Nenhum item nesta situação</h3><p>Selecione outro status ou veja todos os itens da fase.</p></div>'}</section>`;
  } else if(page==='compras') {
    html+=`<p class="intro">As necessidades acompanham a base automaticamente. Registre o que ganhou ou comprou para atualizar esta lista.</p><div class="segments" aria-label="Momento da compra">${TIMINGS.map(t=>`<button data-timing="${t}" aria-pressed="${timing===t}">${t} <span>${rows.filter(r=>r.need&&r.timing===t).length}</span></button>`).join('')}</div><section class="panel">${filters()}${benchmarkTable(shown.filter(r=>r.need&&r.timing===timing),false,true)}</section>`;
  } else {
    html+=`<div class="segments"><button data-tab="inventory" aria-pressed="${tab==='inventory'}">Inventário <span>${data.items.length}</span></button><button data-tab="benchmark" aria-pressed="${tab==='benchmark'}">Benchmark <span>${rows.length}</span></button></div><section class="panel">${tab==='benchmark'?'<div class="section-heading"><p>Metas independentes do inventário. Ajuste a referência sem alterar o que vocês têm.</p><button data-action="add-benchmark">+ Adicionar meta</button></div>':''}${filters()}${tab==='inventory'?inventoryTable(data.items.filter(fits)):benchmarkTable(shown,true)}</section>`;
  }
  $('#content').innerHTML=html;
  if($('#phase')) $('#phase').onchange=e=>{phase=e.target.value;render();};
  if($('#category')) $('#category').onchange=e=>{category=e.target.value;render();};
  if($('#search')) $('#search').oninput=e=>{const pos=e.target.selectionStart;query=e.target.value;render();$('#search').focus();$('#search').setSelectionRange(pos,pos);};
}
function benchmarkTable(rows,edit=false,buy=false) {
  if(!rows.length)return '<div class="empty"><h3>Nenhuma pendência por aqui.</h3><p>Não há metas para estes filtros, ou todas já foram atendidas.</p></div>';
  return `<div class="table-scroll"><table><caption class="sr-only">Comparação do inventário com as metas</caption><thead><tr><th>Item de referência</th><th>Fase</th><th>Meta</th><th>Temos</th><th>Falta</th><th>Situação</th><th>${edit?'Gerenciar':'Próximo passo'}</th></tr></thead><tbody>${rows.map(r=>`<tr><td><details><summary><strong>${esc(title(r))}</strong><small>${esc(r.category)} · ${esc(r.unit)}</small></summary><div class="detail"><p>Contagem: ${esc(r.rule)} · Prioridade ${esc(r.priority)}</p><p>Incluídos: ${r.included.length?r.included.map(id=>{const i=data.items.find(i=>i.id===id);return `${i.quantity} × ${esc(i.description)} (${esc(i.phase)})`;}).join('; '):'nenhum item correspondente'}</p>${r.sources.split(' | ').filter(s=>/^https?:\/\//.test(s)).map((s,n)=>`<a href="${esc(s)}" target="_blank" rel="noopener noreferrer">Fonte ${n+1}</a>`).join(' · ')}</div></details></td><td>${esc(r.phase)}</td><td>${r.target}</td><td>${r.have}</td><td><strong>${r.need}</strong></td><td>${badge(r)}</td><td>${edit?`<div class="row-actions"><button data-edit-benchmark="${esc(r.id)}">Editar</button><button class="danger" data-delete-benchmark="${esc(r.id)}" aria-label="Excluir meta ${esc(title(r))}">Excluir</button></div>`:buy&&canEdit?`<button data-register="${esc(r.id)}">Registrar item</button>`:esc(r.action)}</td></tr>`).join('')}</tbody></table></div>`;
}
function inventoryTable(items) {
  if(!items.length)return '<div class="empty"><h3>Nenhum item encontrado</h3><p>Altere os filtros ou adicione um item à base.</p></div>';
  return `<p class="table-count">${items.length} registros · ${items.reduce((s,i)=>s+i.quantity,0)} quantidades cadastradas</p><div class="table-scroll"><table><caption class="sr-only">Inventário do enxoval</caption><thead><tr><th>Item</th><th>Fase</th><th>Quantidade</th><th>Detalhes</th><th>Ações</th></tr></thead><tbody>${items.map(i=>`<tr><td><strong>${esc(i.description)}</strong><small>${esc(i.category)} → ${esc(i.type)}</small><small>${esc(i.id)}${data.benchmarks.some(b=>matches(i,b))?'':' · Sem meta'}</small></td><td>${esc(i.phase)}</td><td><strong>${i.quantity}</strong> ${esc(i.unit)}</td><td><details><summary>${esc([i.brand,i.color].filter(Boolean).join(' · ')||'Ver atributos')}</summary><p>Presente de: ${esc(i.gift||'—')}<br>Fecho/tecido: ${esc(i.fabric||'—')}</p></details></td><td><div class="row-actions"><button data-edit="${esc(i.id)}" aria-label="Editar ${esc(i.description)}">Editar</button><button class="danger" data-delete="${esc(i.id)}" aria-label="Excluir ${esc(i.description)}">Excluir</button></div></td></tr>`).join('')}</tbody></table></div>`;
}
const field=(key,label,value,extra='')=>`<label>${label}<input name="${key}" value="${esc(value)}" ${extra}></label>`;
const select=(key,label,values,value)=>`<label>${label}<select name="${key}">${options(values,value)}</select></label>`;
function openEditor(id,kind='item',benchmarkId) {
  const isBench=kind==='benchmark', collection=isBench?data.benchmarks:data.items;
  const existing=collection.find(i=>i.id===id), b=data.benchmarks.find(i=>i.id===benchmarkId);
  const item=existing|| (isBench?{category:'Roupas',type:'',description:'',phase:'RN',target:1,unit:'peça',rule:'Descrição N3',priority:'Alta',timing:'Comprar agora',sources:''}:{category:b?.category||'Roupas',type:b?.type||'',description:b?(b.rule==='Tipo N2'?b.type:b.description):'',quantity:b?calculate(data.items,[b])[0].need:1,unit:b?.unit||'peça',phase:b?.phase||'RN',brand:'',color:'',gift:'',fabric:''});
  const records=[...data.items,...data.benchmarks], categories=uniq(records.map(i=>i.category));
  const typesFor=category=>uniq(records.filter(i=>i.category===category).map(i=>i.type));
  const lists=['description','unit'].map(key=>`<datalist id="list-${key}">${options(uniq(records.map(i=>i[key])))}</datalist>`).join('');
  $('#editor').innerHTML=`<form id="edit-form"><div class="section-heading"><h2 id="editor-title">${existing?'Editar':'+ Adicionar'} ${isBench?'meta':'item'}</h2><button type="button" data-close aria-label="Fechar">✕</button></div><div class="form-grid">${select('category','Categoria N1',categories,item.category)}${select('type','Tipo N2',typesFor(item.category),item.type)}${field('description',isBench?'Descrição N3 / escopo':'Descrição N3',item.description,'required list="list-description"')}${select('phase','Fase',uniq([...PHASES,...data.items.map(i=>i.phase),...data.benchmarks.map(i=>i.phase)]),item.phase)}${field(isBench?'target':'quantity',isBench?'Quantidade recomendada':'Quantidade',isBench?item.target:item.quantity,'required type="number" min="0" max="1000000" step="1"')}${field('unit','Unidade',item.unit,'required list="list-unit"')}${isBench?select('rule','Regra de contagem',['Descrição N3','Tipo N2'],item.rule)+select('priority','Prioridade',['Alta','Média','Baixa'],item.priority)+select('timing','Momento',TIMINGS,item.timing)+field('sources','Fontes (URLs separadas por |)',item.sources):field('brand','Loja / marca',item.brand)+field('color','Cor / descrição',item.color)+field('gift','Presente de',item.gift)+field('fabric','Fecho / tecido',item.fabric)}</div>${lists}<p class="hint">${isBench?'Tipo N2 soma todas as descrições do mesmo tipo e fase. Descrição N3 soma apenas a descrição exata.':'Tudo que está na Base é considerado possuído e entra automaticamente no total “Temos” quando a classificação e a fase correspondem ao benchmark.'}</p><p id="form-error" role="alert"></p><div class="dialog-actions"><button type="button" data-close>Cancelar</button><button class="primary" type="submit">Salvar ${isBench?'meta':'item'}</button></div></form>`;
  $('#editor').showModal();
  const categorySelect=$('#edit-form [name="category"]'),typeSelect=$('#edit-form [name="type"]');
  categorySelect.onchange=()=>{typeSelect.innerHTML=options(typesFor(categorySelect.value));};
  $('#edit-form').onsubmit=async e=>{
    e.preventDefault();const button=e.submitter;button.disabled=true;
    try {const values=Object.fromEntries(new FormData(e.target));Object.keys(values).forEach(k=>values[k]=values[k].trim());values[isBench?'target':'quantity']=Number(values[isBench?'target':'quantity']);values.id=existing?.id||`${isBench?'BEN':'ITM'}-${crypto.randomUUID()}`;
      await update(()=>isBench?repository.saveBenchmark(values):repository.saveItem(values),'Salvo. Os totais já foram atualizados.');$('#editor').close();
    } catch(e) {$('#form-error').textContent=e.message;} finally {button.disabled=false;}
  };
}
function confirmAction(heading,message,action,label='Excluir') {
  $('#confirm').innerHTML=`<h2 id="confirm-title">${esc(heading)}</h2><p>${esc(message)}</p><p id="confirm-error" role="alert"></p><div class="dialog-actions"><button data-cancel>Cancelar</button><button class="${label==='Excluir'?'danger':'primary'}" id="confirm-yes">${esc(label)}</button></div>`;
  $('#confirm').showModal();$('#confirm [data-cancel]').onclick=()=>$('#confirm').close();
  $('#confirm-yes').onclick=async e=>{e.target.disabled=true;try{await action();$('#confirm').close();}catch(err){$('#confirm-error').textContent=err.message;e.target.disabled=false;}};
}
function updateAccess() {
  const user=repository.getSignedInUser();canEdit=!!user;
  $('#base-link').hidden=!canEdit;$('#backup-actions').hidden=!canEdit;
  $('#access').innerHTML=canEdit?`<span class="sync-dot">●</span> Sincronizado <button data-action="logout">Sair</button>`:`<span class="sync-dot">●</span> Consulta pública <button data-action="login">Entrar</button>`;
}
function openLogin() {
  const fileHint=location.protocol==='file:'?'<p class="login-hint">O preenchimento automático pode ser bloqueado em arquivos baixados. Para usar seu gerenciador de senhas, abra o endereço hospedado do Dashboard.</p>':'';
  $('#login').innerHTML=`<form id="login-form" method="post" autocomplete="on"><div class="section-heading"><div><p class="eyebrow">ÁREA DE EDIÇÃO</p><h2 id="login-title">Entrar na Base</h2></div><button type="button" data-login-close aria-label="Fechar">✕</button></div><p>O Dashboard continua disponível para consulta sem login.</p>${fileHint}<label for="login-email">E-mail</label><input id="login-email" name="email" type="email" inputmode="email" autocapitalize="none" spellcheck="false" autocomplete="username" required><label for="login-password">Senha</label><input id="login-password" name="password" type="password" autocomplete="current-password" required><p id="login-error" role="alert"></p><div class="dialog-actions"><button type="button" data-login-close>Cancelar</button><button class="primary" type="submit">Entrar e editar</button></div></form>`;
  $('#login').showModal();$('#login-email').focus();
  $('#login-form').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{const values=Object.fromEntries(new FormData(e.target));await repository.signIn(values.email.trim(),values.password);canEdit=true;data=await repository.load();$('#login').close();render();notify('Modo de edição ativado.');}catch(err){$('#login-error').textContent=err.message;}finally{button.disabled=false;}};
}
document.addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button)return;const d=button.dataset;
  if('loginClose'in d)$('#login').close();
  if(d.action==='login')openLogin();
  if(d.action==='logout'){repository.signOut().finally(()=>{canEdit=false;if(location.hash==='#base')location.hash='dashboard';render();notify('Você saiu do modo de edição.');});}
  if(!data)return;
  if('close'in d)$('#editor').close();
  if(d.action==='add')openEditor();
  if(d.action==='add-benchmark')openEditor(null,'benchmark');
  if(d.edit)openEditor(d.edit);
  if(d.editBenchmark)openEditor(d.editBenchmark,'benchmark');
  if(d.register)openEditor(null,'item',d.register);
  if('dashboardPhase' in d){dashboardPhase=d.dashboardPhase;dashboardStatus='';render();}
  if('dashboardStatus' in d){dashboardStatus=dashboardStatus===d.dashboardStatus?'':d.dashboardStatus;render();}
  if(d.tab){tab=d.tab;render();}
  if(d.timing){timing=d.timing;render();}
  if(d.phase){phase=d.phase;timing=data.benchmarks.find(b=>b.phase===phase)?.timing||'Comprar agora';location.hash='compras';render();}
  if(d.delete||d.deleteBenchmark){const isBench=!!d.deleteBenchmark,id=d.deleteBenchmark||d.delete,item=(isBench?data.benchmarks:data.items).find(i=>i.id===id);confirmAction(`Excluir ${isBench?'meta':'item'}?`,`${item.description} será removido. Os totais serão recalculados.`,()=>update(()=>isBench?repository.deleteBenchmark(id):repository.deleteItem(id),'Registro excluído.'));}
});
$('#export').onclick=async()=>{try{const current=await repository.load();const url=URL.createObjectURL(new Blob([JSON.stringify({...current,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`enxoval-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);notify('Backup exportado. Guarde o arquivo em um lugar seguro.');}catch(e){error(e);}};
$('#import').onclick=()=>$('#backup-file').click();
$('#backup-file').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>10_000_000)throw new Error('Backup muito grande (máximo 10 MB).');const backup=parseBackup(await file.text());confirmAction('Restaurar backup?',`Substituir a base atual por ${backup.items.length} itens e ${backup.benchmarks.length} metas? Exporte a base atual antes, se quiser guardá-la.`,()=>update(()=>repository.replaceAll(backup),'Backup restaurado.'),'Restaurar');}catch(err){error(err);}};
window.addEventListener('hashchange',()=>{render();$('#content').focus();});
channel?.addEventListener('message',async()=>{try{data=await repository.load();render();}catch(e){error(e);}});
document.addEventListener('visibilitychange',async()=>{if(!document.hidden&&data){try{data=await repository.load();render();}catch(e){error(e);}}});
async function boot() {
  try {
    data=await repository.initialize();render();
  } catch(e) {$('#content').innerHTML=`<section class="panel"><h1>Não foi possível abrir o enxoval</h1><p>${esc(e.message)}</p><p>Verifique sua conexão e tente novamente.</p><button id="retry">Tentar novamente</button></section>`;$('#retry').onclick=boot;}
}
boot();
