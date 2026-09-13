import {calculate,matches,PHASES,STATUSES,TIMINGS,SCHEMA_VERSION,parseBackup} from './domain.js';
import {repository} from './repository.js';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data, tab='inventory', phase='', query='', category='', timing='Comprar agora', timer;
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('enxoval-changes'):null;
const uniq=values=>[...new Set(values.filter(Boolean))];
const options=(values,current='',empty='')=>(empty?`<option value="">${esc(empty)}</option>`:'')+values.map(v=>`<option ${v===current?'selected':''}>${esc(v)}</option>`).join('');
const route=()=>['dashboard','compras','base'].includes(location.hash.slice(1))?location.hash.slice(1):'dashboard';
function notify(message) {clearTimeout(timer);$('#notice').textContent=message;$('#notice').classList.add('show');timer=setTimeout(()=>$('#notice').classList.remove('show'),6000);}
function error(e) {console.error(e);notify(e.message || 'Não foi possível concluir. Tente novamente.');}
function announceChange() {channel?.postMessage('changed');}
async function update(action,message) {data=await action();render();announceChange();notify(message);}
const title=b=>b.rule==='Tipo N2'?b.type:b.description;
const badge=r=>`<span class="badge ${r.need===0?'complete':r.have?'partial':'missing'}">${esc(r.status)}</span>`;
const fits=r=>(!phase||r.phase===phase)&&(!category||r.category===category)&&(!query||[r.description,r.original,r.type,r.brand,r.color,r.gift].join(' ').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));

function filters() {return `<div class="filters"><label>Buscar<input id="search" type="search" value="${esc(query)}" placeholder="Item, marca, presente…"></label><label>Fase<select id="phase">${options(uniq([...PHASES,...data.items.map(i=>i.phase),...data.benchmarks.map(b=>b.phase)]),phase,'Todas as fases')}</select></label><label>Categoria<select id="category">${options(uniq([...data.items,...data.benchmarks].map(i=>i.category)),category,'Todas as categorias')}</select></label></div>`;}
function render() {
  if(!data)return;
  const page=route(), rows=calculate(data.items,data.benchmarks), shown=rows.filter(fits);
  document.querySelectorAll('nav a').forEach(a=>{if(a.hash===`#${page}`)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  let html=`<div class="page-heading"><div><p class="eyebrow">NOSSO ENXOVAL</p><h1>${{dashboard:'Um pequeno passo de cada vez.',compras:'O que ainda falta',base:'Tudo no seu lugar'}[page]}</h1></div><button class="primary" data-action="add">+ Adicionar item</button></div>`;
  if(page==='dashboard') {
    const owned=data.items.filter(i=>i.status==='Possuído'), ready=rows.filter(r=>!r.need).length, immediate=rows.filter(r=>r.need&&r.timing==='Comprar agora'), percent=rows.length?Math.round(ready/rows.length*100):0;
    html+=`<section class="overview" aria-label="Resumo do enxoval"><div class="progress-card"><span class="eyebrow">METAS ATENDIDAS</span><div class="progress-number">${percent}<span>%</span></div><progress max="100" value="${percent}" aria-label="Metas atendidas">${percent}%</progress><p>${ready} de ${rows.length} metas completas</p></div><div class="stat"><span>Já temos</span><strong>${owned.reduce((s,i)=>s+i.quantity,0)}</strong><p>quantidades cadastradas · ${owned.length} registros</p></div><div class="stat"><span>Comprar agora</span><strong>${immediate.length}</strong><p>itens de referência pendentes</p><a href="#compras">Ver lista de compras →</a></div></section>`;
    html+=`<section class="panel"><div class="section-heading"><h2>Preparação por fase</h2><span>Metas completas / total</span></div><div class="phases">${uniq(rows.map(r=>r.phase)).map(p=>{const rs=rows.filter(r=>r.phase===p),complete=rs.filter(r=>!r.need).length;return `<button class="phase-card" data-phase="${esc(p)}"><span>${esc(p)}</span><strong>${complete}<small> / ${rs.length}</small></strong><progress max="${rs.length}" value="${complete}" aria-label="${esc(p)}: ${complete} de ${rs.length}"></progress><small>${esc(rs[0].timing)}</small></button>`;}).join('')}</div></section>`;
    html+=`<section class="panel"><div class="section-heading"><h2>Visão do benchmark</h2><span>Temos, falta e próxima ação</span></div>${filters()}${benchmarkTable(shown,false)}</section>`;
  } else if(page==='compras') {
    html+=`<p class="intro">As necessidades acompanham a base automaticamente. Registre o que ganhou ou comprou para atualizar esta lista.</p><div class="segments" aria-label="Momento da compra">${TIMINGS.map(t=>`<button data-timing="${t}" aria-pressed="${timing===t}">${t} <span>${rows.filter(r=>r.need&&r.timing===t).length}</span></button>`).join('')}</div><section class="panel">${filters()}${benchmarkTable(shown.filter(r=>r.need&&r.timing===timing),false,true)}</section>`;
  } else {
    html+=`<div class="segments"><button data-tab="inventory" aria-pressed="${tab==='inventory'}">Inventário <span>${data.items.length}</span></button><button data-tab="benchmark" aria-pressed="${tab==='benchmark'}">Benchmark <span>${rows.length}</span></button></div><section class="panel">${tab==='benchmark'?'<div class="section-heading"><p>Metas independentes do inventário. Ajuste a referência sem alterar o que vocês têm.</p><button data-action="add-benchmark">+ Adicionar meta</button></div>':''}${filters()}${tab==='inventory'?inventoryTable(data.items.filter(fits)):benchmarkTable(shown,true)}</section>`;
  }
  $('#content').innerHTML=html;
  $('#phase').onchange=e=>{phase=e.target.value;render();};
  $('#category').onchange=e=>{category=e.target.value;render();};
  $('#search').oninput=e=>{const pos=e.target.selectionStart;query=e.target.value;render();$('#search').focus();$('#search').setSelectionRange(pos,pos);};
}
function benchmarkTable(rows,edit=false,buy=false) {
  if(!rows.length)return '<div class="empty"><h3>Nenhuma pendência por aqui.</h3><p>Não há metas para estes filtros, ou todas já foram atendidas.</p></div>';
  return `<div class="table-scroll"><table><caption class="sr-only">Comparação do inventário com as metas</caption><thead><tr><th>Item de referência</th><th>Fase</th><th>Meta</th><th>Temos</th><th>Falta</th><th>Situação</th><th>${edit?'Gerenciar':'Próximo passo'}</th></tr></thead><tbody>${rows.map(r=>`<tr><td data-label="Item"><details><summary><strong>${esc(title(r))}</strong><small>${esc(r.category)} · ${esc(r.unit)}</small></summary><div class="detail"><p>${esc(r.rationale)}</p><p>Contagem: ${esc(r.rule)} · Prioridade ${esc(r.priority)}</p><p>Incluídos: ${r.included.length?r.included.map(id=>{const i=data.items.find(i=>i.id===id);return `${i.quantity} × ${esc(i.original||i.description)} (${esc(i.size||i.phase)})`;}).join('; '):'nenhum item possuído correspondente'}</p>${r.sources.split(' | ').filter(s=>/^https?:\/\//.test(s)).map((s,n)=>`<a href="${esc(s)}" target="_blank" rel="noopener noreferrer">Fonte ${n+1}</a>`).join(' · ')}</div></details></td><td data-label="Fase">${esc(r.phase)}</td><td data-label="Meta">${r.target}</td><td data-label="Temos">${r.have}</td><td data-label="Falta"><strong>${r.need}</strong></td><td data-label="Situação">${badge(r)}</td><td data-label="Ação">${edit?`<div class="row-actions"><button data-edit-benchmark="${esc(r.id)}">Editar</button><button class="danger" data-delete-benchmark="${esc(r.id)}" aria-label="Excluir meta ${esc(title(r))}">Excluir</button></div>`:buy?`<button data-register="${esc(r.id)}">Registrar item</button>`:esc(r.action)}</td></tr>`).join('')}</tbody></table></div>`;
}
function inventoryTable(items) {
  if(!items.length)return '<div class="empty"><h3>Nenhum item encontrado</h3><p>Altere os filtros ou adicione um item à base.</p></div>';
  return `<p class="table-count">${items.length} registros · ${items.reduce((s,i)=>s+i.quantity,0)} quantidades cadastradas</p><div class="table-scroll"><table><caption class="sr-only">Inventário do enxoval</caption><thead><tr><th>Item</th><th>Fase / tamanho</th><th>Quantidade</th><th>Detalhes</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${items.map(i=>`<tr><td data-label="Item"><strong>${esc(i.original||i.description)}</strong><small>${esc(i.category)} → ${esc(i.type)} → ${esc(i.description)}</small><small>${esc(i.id)}${data.benchmarks.some(b=>matches(i,b))?'':' · Sem meta'}</small></td><td data-label="Fase / tamanho">${esc(i.phase)}<small>${esc(i.size)}</small></td><td data-label="Quantidade"><strong>${i.quantity}</strong> ${esc(i.unit)}</td><td data-label="Detalhes"><details><summary>${esc([i.brand,i.color].filter(Boolean).join(' · ')||'Ver atributos')}</summary><p>Presente de: ${esc(i.gift||'—')}<br>Fecho/tecido: ${esc(i.fabric||'—')}<br>Observações: ${esc(i.notes||'—')}</p></details></td><td data-label="Situação">${esc(i.status)}</td><td data-label="Ações"><div class="row-actions"><button data-edit="${esc(i.id)}" aria-label="Editar ${esc(i.original||i.description)}">Editar</button><button class="danger" data-delete="${esc(i.id)}" aria-label="Excluir ${esc(i.original||i.description)}">Excluir</button></div></td></tr>`).join('')}</tbody></table></div>`;
}
const field=(key,label,value,extra='')=>`<label>${label}<input name="${key}" value="${esc(value)}" ${extra}></label>`;
const select=(key,label,values,value)=>`<label>${label}<select name="${key}">${options(values,value)}</select></label>`;
function openEditor(id,kind='item',benchmarkId) {
  const isBench=kind==='benchmark', collection=isBench?data.benchmarks:data.items;
  const existing=collection.find(i=>i.id===id), b=data.benchmarks.find(i=>i.id===benchmarkId);
  const item=existing|| (isBench?{category:'Roupas',type:'',description:'',phase:'RN',target:1,unit:'peça',rule:'Descrição N3',priority:'Alta',timing:'Comprar agora',rationale:'',sources:''}:{category:b?.category||'Roupas',type:b?.type||'',description:b?(b.rule==='Tipo N2'?b.type:b.description):'',original:'',quantity:b?calculate(data.items,[b])[0].need:1,unit:b?.unit||'peça',size:b?.phase||'',phase:b?.phase||'RN',brand:'',color:'',gift:'',fabric:'',status:'Possuído',notes:''});
  const lists=['category','type','description','unit'].map(key=>`<datalist id="list-${key}">${options(uniq([...data.items,...data.benchmarks].map(i=>i[key])))}</datalist>`).join('');
  $('#editor').innerHTML=`<form id="edit-form"><div class="section-heading"><h2 id="editor-title">${existing?'Editar':'+ Adicionar'} ${isBench?'meta':'item'}</h2><button type="button" data-close aria-label="Fechar">✕</button></div><div class="form-grid">${field('category','Categoria N1',item.category,'required list="list-category"')}${field('type','Tipo N2',item.type,'required list="list-type"')}${field('description',isBench?'Descrição N3 / escopo':'Descrição N3',item.description,'required list="list-description"')}${select('phase','Fase',uniq([...PHASES,...data.items.map(i=>i.phase),...data.benchmarks.map(i=>i.phase)]),item.phase)}${field(isBench?'target':'quantity',isBench?'Quantidade recomendada':'Quantidade',isBench?item.target:item.quantity,'required type="number" min="0" max="1000000" step="1"')}${field('unit','Unidade',item.unit,'required list="list-unit"')}${isBench?select('rule','Regra de contagem',['Descrição N3','Tipo N2'],item.rule)+select('priority','Prioridade',['Alta','Média','Baixa'],item.priority)+select('timing','Momento',TIMINGS,item.timing)+field('sources','Fontes (URLs separadas por |)',item.sources)+`<label class="wide">Racional<textarea name="rationale">${esc(item.rationale)}</textarea></label>`:field('original','Nome original / identificação',item.original)+field('size','Tamanho original',item.size)+field('brand','Loja / marca',item.brand)+field('color','Cor / descrição',item.color)+field('gift','Presente de',item.gift)+field('fabric','Fecho / tecido',item.fabric)+select('status','Situação do item',STATUSES,item.status)+`<label class="wide">Observações<textarea name="notes">${esc(item.notes)}</textarea></label>`}</div>${lists}<p class="hint">${isBench?'Tipo N2 soma todas as descrições do mesmo tipo e fase. Descrição N3 soma apenas a descrição exata.':'Use as sugestões de classificação e a fase correta para o item contar nas metas. Apenas itens possuídos entram no total “Temos”.'}</p><p id="form-error" role="alert"></p><div class="dialog-actions"><button type="button" data-close>Cancelar</button><button class="primary" type="submit">Salvar ${isBench?'meta':'item'}</button></div></form>`;
  $('#editor').showModal();
  $('#edit-form').onsubmit=async e=>{
    e.preventDefault();const button=e.submitter;button.disabled=true;
    try {const values=Object.fromEntries(new FormData(e.target));Object.keys(values).forEach(k=>values[k]=values[k].trim());values[isBench?'target':'quantity']=Number(values[isBench?'target':'quantity']);values.id=existing?.id||`${isBench?'BEN':'ITM'}-${crypto.randomUUID()}`;if(!isBench&&!values.original)values.original=values.description;
      await update(()=>isBench?repository.saveBenchmark(values):repository.saveItem(values),'Salvo. Os totais já foram atualizados.');$('#editor').close();
    } catch(e) {$('#form-error').textContent=e.message;} finally {button.disabled=false;}
  };
}
function confirmAction(heading,message,action,label='Excluir') {
  $('#confirm').innerHTML=`<h2 id="confirm-title">${esc(heading)}</h2><p>${esc(message)}</p><p id="confirm-error" role="alert"></p><div class="dialog-actions"><button data-cancel>Cancelar</button><button class="${label==='Excluir'?'danger':'primary'}" id="confirm-yes">${esc(label)}</button></div>`;
  $('#confirm').showModal();$('#confirm [data-cancel]').onclick=()=>$('#confirm').close();
  $('#confirm-yes').onclick=async e=>{e.target.disabled=true;try{await action();$('#confirm').close();}catch(err){$('#confirm-error').textContent=err.message;e.target.disabled=false;}};
}
document.addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button||!data)return;const d=button.dataset;
  if('close'in d)$('#editor').close();
  if(d.action==='add')openEditor();
  if(d.action==='add-benchmark')openEditor(null,'benchmark');
  if(d.edit)openEditor(d.edit);
  if(d.editBenchmark)openEditor(d.editBenchmark,'benchmark');
  if(d.register)openEditor(null,'item',d.register);
  if(d.tab){tab=d.tab;render();}
  if(d.timing){timing=d.timing;render();}
  if(d.phase){phase=d.phase;timing=data.benchmarks.find(b=>b.phase===phase)?.timing||'Comprar agora';location.hash='compras';render();}
  if(d.delete||d.deleteBenchmark){const isBench=!!d.deleteBenchmark,id=d.deleteBenchmark||d.delete,item=(isBench?data.benchmarks:data.items).find(i=>i.id===id);confirmAction(`Excluir ${isBench?'meta':'item'}?`,`${item.original||item.description} será removido. Os totais serão recalculados.`,()=>update(()=>isBench?repository.deleteBenchmark(id):repository.deleteItem(id),'Registro excluído.'));}
});
$('#export').onclick=async()=>{try{
  const current=await repository.load(),date=new Date().toISOString().slice(0,10),name=`enxoval-backup-${date}.json`;
  const file=new File([JSON.stringify({...current,exportedAt:new Date().toISOString()},null,2)],name,{type:'application/json'});
  if(navigator.canShare?.({files:[file]}))await navigator.share({title:'Backup do enxoval',files:[file]});
  else {const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  localStorage.setItem('enxoval-last-backup',new Date().toISOString());
  notify('Backup criado. Confirme que o arquivo foi salvo em Arquivos ou iCloud Drive.');
}catch(e){if(e.name!=='AbortError')error(e);}};
$('#import').onclick=()=>$('#backup-file').click();
$('#rollback').onclick=()=>confirmAction('Desfazer restauração?','A base atual e a cópia anterior trocarão de lugar.',async()=>{await update(()=>repository.restorePrevious(),'Restauração desfeita.');$('#rollback').hidden=!(await repository.hasRestorePoint());},'Desfazer');
$('#install-help').onclick=()=>{
  $('#confirm').innerHTML=`<h2 id="confirm-title">Instalar no iPhone</h2><ol class="install-steps"><li>Abra este endereço no Safari.</li><li>Toque em <strong>Compartilhar</strong>.</li><li>Escolha <strong>Adicionar à Tela de Início</strong> e confirme.</li></ol><p class="hint">Depois da primeira abertura, o enxoval funciona sem internet. Não apague os dados do Safari sem antes exportar um backup.</p><div class="dialog-actions"><button id="confirm-yes" class="primary">Entendi</button></div>`;
  $('#confirm').showModal();$('#confirm-yes').onclick=()=>$('#confirm').close();
};
$('#backup-file').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>10_000_000)throw new Error('Backup muito grande (máximo 10 MB).');const backup=parseBackup(await file.text());confirmAction('Restaurar backup?',`Substituir a base atual por ${backup.items.length} itens e ${backup.benchmarks.length} metas? Exporte a base atual antes, se quiser guardá-la.`,async()=>{await update(()=>repository.replaceAllWithRollback(backup),'Backup restaurado. Você pode desfazer esta restauração.');$('#rollback').hidden=false;},'Restaurar');}catch(err){error(err);}};
window.addEventListener('hashchange',()=>{render();$('#content').focus();});
channel?.addEventListener('message',async()=>{try{data=await repository.load();render();}catch(e){error(e);}});
document.addEventListener('visibilitychange',async()=>{if(!document.hidden&&data){try{data=await repository.load();render();}catch(e){error(e);}}});
async function boot() {
  try {
    const [items,benchmarks]=await Promise.all(['inventory','benchmarks'].map(async name=>{const res=await fetch(new URL(`../data/${name}.json`,import.meta.url));if(!res.ok)throw new Error('Não foi possível carregar os dados iniciais. Recarregue a página.');return res.json();}));
    data=await repository.initialize({schemaVersion:SCHEMA_VERSION,items,benchmarks});render();
    $('#rollback').hidden=!(await repository.hasRestorePoint());
    if(matchMedia('(display-mode: standalone)').matches||navigator.standalone)$('#install-help').hidden=true;
    navigator.storage?.persist?.().catch(()=>false);
  } catch(e) {$('#content').innerHTML=`<section class="panel"><h1>Não foi possível abrir o enxoval</h1><p>${esc(e.message)}</p><p>Permita o armazenamento do navegador e recarregue. Seus dados existentes não foram substituídos.</p><button id="retry">Tentar novamente</button></section>`;$('#retry').onclick=boot;}
}
boot();

if('serviceWorker' in navigator&&location.protocol.startsWith('http')) {
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.error));
}
