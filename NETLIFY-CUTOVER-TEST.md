# Enxoval — roteiro de aceite (Netlify)

## Status
Implementação da migração na branch `feature/netlify-cutover-ready`.
**Não alterar a branch de produção do Netlify nem importar dados antes de os testes passarem.**
A implantação atual em `https://enxoval-pitu.netlify.app/` continua utilizando a branch `feature/netlify-blobs-staging` e o Supabase até o corte.

## Pré-requisitos
- Site de testes Netlify com Identity ativado, convites restritos e usuário com papel exato `enxoval-admin`.
- Backup JSON privado (03/11/2026): 191 itens e 46 benchmarks.
- Deploy Preview ou site de staging separado para testar a branch de corte ANTES de mudar a branch de produção.
- CI `Netlify cutover checks` aprovado.

## Critérios de aceite
- [ ] Sem login, a API `/api/enxoval-data` não retorna nomes no campo `gift`, e não permite POST.
- [ ] Login com uma conta que não tenha o papel `enxoval-admin` não permite edições.
- [ ] Login do administrador funciona e exibe a área Base.
- [ ] Primeira importação do backup com confirmação grava 191 registros e 46 benchmarks.
- [ ] Download de um novo backup autenticado produz dados completos e idênticos nos campos do esquema v3.
- [ ] O dashboard mostra 18 completos, 10 parciais e 18 faltantes para o backup fornecido, se os dados e regras não mudaram.
- [ ] Criar, editar e apagar itens e metas atualiza a interface e persiste após recarregar.
- [ ] Edição feita com versão antiga recebe HTTP 409 e não sobrescreve alterações recentes.
- [ ] API pública não disponibiliza os nomes de presenteadores; não há arquivos `data/*.json` ou `enxoval-compartilhar.html` no deploy.
- [ ] Rede do navegador não contém requisições a `supabase.co` para carregar a aplicação.
- [ ] Navegação e formulários funcionam em desktop e iPhone.
- [ ] GitHub Pages (`main`) e Supabase permanecem intactos até conclusão.

## Atenção
A publicação de uma branch sem dados importados exibe mensagem de inventário não inicializado ao público.
Para evitar isso, use um Deploy Preview isolado ou configure um segundo projeto Netlify
antes de mudar o site público. A mudança de papéis entra em vigor no novo login/refresh.
