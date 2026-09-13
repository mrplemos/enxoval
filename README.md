# Enxoval

Primeira versão funcional do controle de enxoval minimalista, em português, com Dashboard, Compras e Base. Frontend responsivo e instalável como PWA, em HTML, CSS e módulos JavaScript nativos, sem dependências de execução ou serviços externos.

## Dados iniciais

- Fonte exclusiva: **Enxoval - base minimalista.xlsx** da conversa fornecida.
- **121 registros / 419 quantidades cadastradas**, incluindo ITM-0120 e ITM-0121.
- **46 metas**, extraídas separadamente da aba Benchmark Enxoval.
- Os 15 campos do inventário e os 12 do benchmark foram preservados. Células vazias tornam-se texto vazio; tamanhos numéricos tornam-se texto. A taxonomia da planilha é mantida, inclusive os dois últimos registros.
- `data/provenance.json` contém o SHA-256 da fonte e a reconciliação. A planilha original não é modificada nem adicionada ao repositório.
- `scripts/import-workbook.py caminho.xlsx` reproduz a extração com Python e openpyxl. Linhas de modelo vazias e a nota final de metodologia não viram registros. As fontes e os racionais de cada meta são preservados.

## Funcionalidades

- Dashboard com metas atendidas, quantidades possuídas, pendências imediatas e preparação por fase.
- Compras separa **Comprar agora**, **Planejar** e **Aguardar**. “Registrar item” abre o formulário com classificação e quantidade faltante preenchidas; nada é contabilizado antes de salvar.
- Base oferece inventário e benchmark em seções independentes, com adicionar, editar e excluir, busca e filtros. Exclusões pedem confirmação.
- Cálculos em `src/domain.js`: somente `Possuído` entra em “Temos”; categoria + tipo + fase devem coincidir. “Descrição N3” exige descrição exata; “Tipo N2” soma todas as descrições daquele tipo na fase. Isso reproduz as regras SUMIFS da planilha. Não há conversão automática entre pacotes, peças e unidades: cadastre quantidades na unidade da meta.
- Falta = máximo(meta − temos, 0). Status: Completo, Parcial ou Falta. Itens sem benchmark aparecem como **Sem meta**, sem criar compras artificiais. Excesso de uma fase não compensa outra. O percentual é a proporção de metas completas, não uma soma de unidades heterogêneas.
- IndexedDB guarda inventário e benchmark neste navegador/origem. Não há sincronização entre aparelhos, login ou banco remoto nesta versão. A semente só é aplicada quando não existe uma base; uma base vazia após exclusões/restauração não é repopulada. Cada mutação é uma transação atômica e lê o estado mais recente; outras abas recebem atualização.
- Backup JSON completo, versionado, inclui inventário e benchmark. No iPhone, a exportação usa a folha de compartilhamento para salvar em Arquivos ou iCloud Drive. A importação valida tudo antes de substituir a base e guarda atomicamente a base anterior, permitindo desfazer a restauração.

## Executar e verificar

Requer Node.js 22 ou superior. Não é necessário instalar pacotes.

```sh
npm test
npm run build
npm start
```

Abra `http://127.0.0.1:4173`. Use servidor HTTP; abrir index.html diretamente com file:// não é suportado. `npm run build` gera `dist/` com os arquivos estáticos. Todos os caminhos são relativos, compatíveis com `/enxoval/` no GitHub Pages.

Os testes cobrem a integridade da fonte, reconciliação das 46 metas com uma extração independente das regras da planilha, limites de contagem e importação/exportação. Não há dependências de produção nem CDN.

## Evolução do armazenamento

A interface só usa o contrato assíncrono de `src/repository.js`: `initialize(seed)`, `load()`, `saveItem(item)`, `deleteItem(id)`, `saveBenchmark(benchmark)`, `deleteBenchmark(id)` e `replaceAll(data)`. Todos retornam o snapshot `{schemaVersion, items, benchmarks}`. IDs são estáveis; os novos são UUIDs. A apresentação e os cálculos não dependem de IndexedDB.

Para migrar para Supabase, implemente esse mesmo contrato em um adaptador remoto e troque a instância exportada de `repository`. Mantenha inventário e benchmark em tabelas separadas, com uma versão de esquema. A restauração precisa de atomicidade equivalente; autenticação, controle de acesso por família e importação do backup serão parte dessa migração. Nenhuma credencial ou conexão Supabase é necessária nesta versão. Edições simultâneas do mesmo registro usam a última gravação; colaboração remota precisará de controle de conflitos.

## GitHub Pages (etapa manual)

O repositório deve continuar **privado**. Esta entrega não ativa publicação pública.

1. No repositório, abra **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **Deploy from a branch**.
3. Selecione **main** e **/(root)**, depois **Save**. O arquivo `.nojekyll` permite servir os módulos e os JSON diretamente, sem build externo.
4. Aguarde a publicação e use o endereço que o GitHub mostrar (normalmente `https://mrplemos.github.io/enxoval/`).

**Atenção à diferença entre repositório e site:** Pages a partir de repositório privado de conta pessoal requer GitHub Pro. O site Pages normalmente é público, mesmo com o repositório privado; quem acessar o site poderá baixar os JSON iniciais, incluindo atributos como “Presente de”. Se esses dados também precisam ficar privados, não ative Pages público; será necessário hospedar com controle de acesso. Os dados editados posteriormente ficam apenas no navegador e não são enviados ao GitHub.

Documentação: [disponibilidade do Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) e [criar um site Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).

## Instalar no iPhone

A instalação exige que o app seja servido por HTTPS; o Quick Look do app Arquivos não executa uma PWA e não oferece armazenamento confiável. Abra o endereço publicado no Safari, toque em **Compartilhar → Adicionar à Tela de Início** e abra o ícone Enxoval. Depois da primeira carga completa, o service worker mantém a interface e os dados iniciais disponíveis offline.

Os dados editados continuam locais ao Safari/PWA. Eles não entram no repositório nem são sincronizados. Use **Exportar backup** regularmente e salve o JSON em Arquivos ou iCloud Drive. Antes de qualquer restauração, a base atual é guardada como ponto de retorno; **Desfazer restauração** troca com segurança as duas versões.

O código ser privado não torna automaticamente o endereço publicado privado. Use hospedagem HTTPS com controle de acesso se o próprio aplicativo e os dados iniciais não puderem ser públicos.
