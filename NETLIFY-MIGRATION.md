# Migração Enxoval → Netlify (branch de preparação)

**Estado: base do backend implementada, NÃO PRONTA PARA PUBLICAÇÃO.**
Nenhuma informação real do backup de 03/11/2026 foi adicionada a esta branch.
A publicação existente no GitHub Pages continua vinculada ao Supabase.

## Arquitetura de teste

- `netlify/functions/enxoval-data.mjs`: GET público com projeção sem o campo `gift`, GET autenticado completo, POST autorizado com validação e ETags.
- `netlify/functions/enxoval-auth.mjs`: sessão de administrador com Netlify Identity. Papel exigido: `enxoval-admin`.
- `src/netlify-data-service.js`: regras de mutação compartilhadas com testes, preservando o esquema v3 e as validações em `src/domain.js`.
- `netlify.toml`: configuração inicial do build e funções.
- O armazenamento utiliza um único objeto `enxoval-private/current` do Netlify Blobs. Neste desenho, dois POSTs concorrentes são detectados pelo ETag e não sobrescrevem silenciosamente um ao outro.

## PENDÊNCIAS que bloqueiam implantação

1. Integrar a interface `src/app.js`, `src/login.js` e `src/repository.js` ao novo backend (a interface publicada nesta branch **ainda chama Supabase**).
2. Criar um fluxo explícito de bootstrap/importação do backup **somente via POST autenticado**, sem incluir o backup em arquivos públicos ou logs.
3. Remover o histórico de dados iniciais acessível em `data/inventory.json`, `data/benchmarks.json` e na versão standalone do build para evitar cópias desatualizadas/exposição do campo `gift`. Atenção: repositório público anterior já contém esses arquivos; retirar de um novo commit não apaga seu histórico.
4. Gerar `package-lock.json` com `npm install`, versioná-lo e confirmar `npm ci && npm test && npm run build`.
5. Criar um site Netlify **separado** para staging, habilitar Identity manualmente e selecionar cadastro por convite. Atribuir `enxoval-admin` apenas aos editores autorizados (a mudança de papel passa a valer no próximo login/refresh).
6. Testar autenticação em um deploy real ou Deploy Preview: Netlify Identity não funciona no ambiente local `netlify dev`.
7. Exercitar GET público (sem `gift`), GET autenticado, tentativas POST sem login/sem papel, mutações, backup, restauração, versionamento, erros e conflitos.
8. Conferir contagens/IDs/somas com o backup original, testar iPhone/PWA, só então planejar corte para produção.

## Segurança e privacidade

- Nunca adicione o backup integral do enxoval, senhas ou segredos a um repositório público.
- O papel de edição é verificado pelo servidor, não por controles escondidos no HTML.
- O endpoint público omite `gift`, mas outros atributos (marcas, cores, descrição, quantidade) permanecem visíveis. Revisar essa política antes da publicação.
- Proteja o backup original fora do repositório e mantenha uma rotina de exportação independente do Netlify Blobs.
- O aplicativo atual pode continuar público no GitHub Pages, inclusive com arquivos de dados antigos. Isso precisa de revisão à parte.
