# Enxoval

Primeira versão funcional do controle de enxoval minimalista, em português, com Dashboard, Compras e Base. Frontend responsivo em HTML, CSS e módulos JavaScript nativos, sem dependências de execução ou serviços externos.

## Versão 0.3.2

O Dashboard incorpora a base atualizada de 13/09. A fase `1–3 meses` substitui `0–3 meses`, e os campos removidos da planilha também saíram da interface. Tudo que está na Base é considerado possuído; o total “Temos” compara diretamente categoria, tipo, descrição e fase com o Benchmark.

O Dashboard continua organizado por fase. Cada fase mostra os totais de metas completas, parciais e faltantes em cartões filtráveis, seguidos por uma lista visual com progresso `temos / recomendado`, quantidade faltante, momento da compra e os itens possuídos que compõem cada total.

## Dados iniciais

- Fonte exclusiva: **Lista Enxoval - base atualizada 13-09.xlsx**, com o Controle recalculado.
- **187 registros / 487 quantidades cadastradas**. Os registros ITM-0133 a ITM-0136 foram removidos após a revisão da base. Os demais IDs permanecem estáveis.
- **46 metas**, extraídas separadamente da aba Benchmark Enxoval.
- Os 11 campos do inventário e os 11 do benchmark foram preservados. Células vazias tornam-se texto vazio.
- `data/provenance.json` contém o SHA-256 da fonte e a reconciliação. A planilha original não é modificada nem adicionada ao repositório.
- `scripts/import-workbook.py caminho.xlsx` reproduz a extração com Python e openpyxl. Linhas de modelo vazias não viram registros. As fontes de cada meta são preservadas.

## Funcionalidades

- Dashboard com metas atendidas, quantidades possuídas, pendências imediatas e preparação por fase.
- Compras separa **Comprar agora**, **Planejar** e **Aguardar**. “Registrar item” abre o formulário com classificação e quantidade faltante preenchidas; nada é contabilizado antes de salvar.
- Base oferece inventário e benchmark em seções independentes, com adicionar, editar e excluir, busca e filtros. Exclusões pedem confirmação.
- Cálculos em `src/domain.js`: todo item da Base entra em “Temos”; categoria + tipo + fase devem coincidir. “Descrição N3” exige descrição exata; “Tipo N2” soma todas as descrições daquele tipo na fase. Isso reproduz as regras SUMIFS da planilha. Não há conversão automática entre pacotes, peças e unidades: cadastre quantidades na unidade da meta.
- Falta = máximo(meta − temos, 0). Status: Completo, Parcial ou Falta. Itens sem benchmark aparecem como **Sem meta**, sem criar compras artificiais. Excesso de uma fase não compensa outra. O percentual é a proporção de metas completas, não uma soma de unidades heterogêneas.
- IndexedDB guarda inventário e benchmark neste navegador/origem. Não há sincronização entre aparelhos, login ou banco remoto nesta versão. A semente só é aplicada quando não existe uma base; uma base vazia após exclusões/restauração não é repopulada. Cada mutação é uma transação atômica e lê o estado mais recente; outras abas recebem atualização.
- Backup JSON completo, versionado, inclui inventário e benchmark. Importação valida versão, campos, IDs únicos e quantidades antes de pedir confirmação e substituir a base em uma única transação. Exporte antes de limpar dados do navegador ou mudar de endereço/aparelho.

## Executar e verificar

Requer Node.js 22 ou superior. Não é necessário instalar pacotes.

```sh
npm test
npm run build
npm start
```

Abra `http://127.0.0.1:4173`. Use servidor HTTP; abrir index.html diretamente com file:// não é suportado. `npm run build` gera `dist/` com os arquivos estáticos. Todos os caminhos são relativos, compatíveis com `/enxoval/` no GitHub Pages.

## Acesso e sincronização

Dashboard e Compras usam leitura pública da base hospedada no Supabase. A Base e todas as ações de adicionar, editar, excluir e restaurar backup exigem login. As permissões também são aplicadas no banco por RLS, portanto esconder os controles na interface não é a única proteção. A configuração pública do cliente fica em `src/supabase-config.js`; a senha do editor nunca deve ser incluída no repositório.

A sessão de edição fica em `sessionStorage`: recarregar a mesma aba mantém o login, mas fechar a aba encerra a persistência local. A versão 0.4.1 também remove automaticamente qualquer sessão antiga que tenha sido gravada em `localStorage` pela versão anterior.

No cadastro, Categoria N1 e Tipo N2 são listas controladas. Os tipos exibidos dependem da categoria selecionada, reduzindo erros de classificação que afetariam a comparação com o benchmark.

O login usa campos estáveis com `autocomplete="username"` e `autocomplete="current-password"`. Gerenciadores de senha devem ser usados na versão hospedada; páginas abertas por `file://` não têm um domínio confiável para associação de credenciais e podem bloquear o preenchimento.

Desde a versão 0.4.4, o formulário existe no documento desde o carregamento da página, em vez de ser criado somente ao abrir a janela. Isso permite que extensões como Bitwarden detectem os campos antes da interação do usuário.

Para compartilhar sem hospedagem, envie o arquivo `enxoval-compartilhar.html` gerado pelo build. Ele contém interface e dados iniciais em um único arquivo e pode ser aberto diretamente no navegador. Ao abrir por `file://`, usa armazenamento local compatível com arquivos baixados; se o navegador bloquear todo armazenamento local, o dashboard ainda abre em modo temporário. Cada pessoa pode exportar um backup para preservar ou transferir suas alterações.

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
