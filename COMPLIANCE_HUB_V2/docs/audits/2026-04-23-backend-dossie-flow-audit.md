# Auditoria Backend V2 Orientada ao Fluxo Completo de Dossiê Uplexis/Upminer

**Data da auditoria:** 2026-04-23  
**Referência visual:** `C:\Users\Analista\Downloads\FireShot\Lexi`  
**Backend inspecionado:** `d:\ComplianceHub\COMPLIANCE_HUB_V2\app\functions`  
**Plano anterior:** `2026-04-23-lexi-visual-refactor-plan.md`  
**Auditor:** Arquiteto de Software Sênior (prompt dirigido)

---

## 1. Resumo Executivo

### 1.1 Visão geral do sistema inferido

A análise consolidada da pasta `Lexi` e do componente React de referência revela um produto de dossiê que não é uma tela isolada, mas um **sistema completo de ciclo de vida**:

- **Histórico/listagem** de dossiês com filtros operacionais
- **Criação guiada por etapas** (perfil → critérios → tag → parâmetros)
- **Seleção de perfis padronizados** PF/PJ com preview contratual
- **Perfis personalizados** com composição self-service de fontes
- **Processamento com progresso por fonte**, reprocessamento e fila
- **Visão analítica** com filtros, métricas, gráficos e agregações
- **Visão detalhada** com cards expansíveis, tabelas, listas processuais e comentários por bloco
- **Drill-down processual** estruturado (lista → detalhe → movimentações → partes)
- **Análise conclusiva + comentários finais** como capacidades separadas
- **Aprovação / reprovação** com gates de revisão
- **Exportação** como ação transversal
- **Histórico de dossiês** vinculado ao sujeito

### 1.2 Conclusão de aderência do backend atual

O backend V2 está em **estado híbrido avançado**:

- **Já suporta bem:** produtos, módulos, PF/PJ, entitlements, materialização de artefatos (`providerRequests`, `rawSnapshots`, `evidenceItems`, `riskSignals`), snapshot de relatório, decisão, timeline, publicação e projeções seguras.
- **Suporta parcialmente:** agrupamento lógico por módulo, governança multi-tenant e trilha operacional.
- **Possui base inesperada e subutilizada:** `domain/dossierSchema.cjs` já define macroáreas, `SECTION_REGISTRY`, `DOSSIER_SCHEMA_REGISTRY`, resolvers de schema e `buildDossierProjection` — mas esta camada **ainda não está integrada** à criação de caso, ao snapshot de relatório nem às client projections.
- **Não suporta de forma nativa:** presets versionados, customização PF/PJ self-service no contrato de criação, visão analítica estruturada materializada, visão detalhada orientada por entradas (`detailEntries`), filtros analíticos com facetas, modelo processual de alto nível, comentários por escopo, responsividade guiada por metadata, fluxo formal de progresso por fonte com retry, e `exportJobs` estruturados.

### 1.3 Conflito com o plano existente vs. realidade do código

O arquivo `2026-04-23-lexi-visual-refactor-plan.md` trata principalmente de tema visual, paleta e renderer frontend. O rascunho preliminar (fornecido no prompt) acerta as lacunas de contrato, mas **erra por omissão** ao não detectar que `dossierSchema.cjs` já existe no domínio V2 desde 2026-04-23.

**Prioridade desta auditoria:** a evidência das imagens e do código-fonte real tem precedência. O `dossierSchema.cjs` existente é uma semente arquitetural valiosa que deve ser **integrada, não substituída**.

---

## 2. Inventário das Referências Visuais

### Critério de leitura

- **Observado:** elemento explicitamente visível no arquivo.
- **Inferência:** conclusão arquitetural extraída da composição da UX.

### Inventário arquivo a arquivo

| Arquivo | Tipo | O que mostra | Etapa do fluxo | Implicações backend |
|---|---|---|---|---|
| `FireShot Capture 082` | PNG | Página `Dossiês` vazia, filtros por período/responsável/status, CTA `Criar novo dossiê` | Entrada / histórico vazio | **Obs:** listagem filtrável. **Inf:** read model paginável com colunas operacionais |
| `082.html.txt` | TXT | DOM da mesma tela | Histórico vazio | **Obs:** confirma nomenclatura e filtros |
| `FireShot Capture 083` | PNG | `Criação de dossiês`, etapa `Perfil de consulta`, toggle PF/PJ, perfis padronizados (Compliance, Financeiro, Investigativo, Jurídico, PLD, etc.) | Criação / preset | **Obs:** PF/PJ é eixo primário; perfis padronizados existem; há seção para perfis personalizados. **Inf:** backend precisa separar `produto comercial` de `preset de dossiê` |
| `083.html.txt` | TXT | DOM da etapa de perfis | Criação / preset | **Obs:** confirma stepper `Perfil / Critérios / Tag / Parâmetros` |
| `FireShot Capture 083_2` | PNG | Drawer lateral do perfil `Financeiro` com objetivo e lista de fontes | Criação / preview de preset | **Obs:** preset tem descrição e fonte-lista explícita. **Inf:** preset precisa ser entidade com metadata e preview contratual |
| `083.2.html.txt` | TXT | DOM do drawer de perfil | Criação / preview | **Obs:** fontes listadas individualmente |
| `FireShot Capture 084` | PNG | Mesma tela com `Pessoa Jurídica` selecionada | Criação / preset PJ | **Obs:** perfis mudam conforme PF/PJ. **Inf:** `subjectKind` e `preset/schema` devem ser validados juntos |
| `084.html.txt` | TXT | DOM da tela PJ | Criação / preset PJ | **Obs:** confirma troca de contexto |
| `FireShot Capture 086` | PDF | Etapa de critérios | Criação / critérios | **Obs:** fluxo de criação tem variação em formato exportado |
| `086.html.txt` | TXT | Etapa `Critérios`, input CPF/CNPJ, upload de modelo/planilha, drawer de preset `Recursos Humanos` | Criação / critérios | **Obs:** critérios por digitação e possível importação; drawer lista fontes heterogêneas de várias macroáreas. **Inf:** critérios e preset devem ser desacoplados; suporte a lote |
| `FireShot Capture 087` | PNG | Etapa `Tag`, seleção de tag existente ou `Não atribuir tag` | Criação / classificação | **Obs:** tag é parte do fluxo oficial. **Inf:** `case` precisa carregar classificação separada de produto |
| `FireShot Capture 088` | PNG | Etapa `Parâmetros`, bloco `Processos Judiciais (Nova)`, checkbox `Marcar automaticamente como relevantes`, checkbox `Criar e processar Dossies automaticamente` | Criação / parâmetros finais | **Obs:** parâmetros por área/fonte; políticas operacionais no ato da criação. **Inf:** persistir `searchParameters`, `autoMarkRelevant`, `autoProcess` |
| `FireShot Capture 089` | PNG | Listagem com toast `Dossiê criado com sucesso!`, colunas operacionais (Nº, Criação, Tag, Critério, Progresso, Status, Monitoria, Workflow, Score, Ações), status `Iniciar` | Pós-criação / histórico | **Obs:** dossiê entra no histórico antes do processamento terminar; estado acionável `Iniciar`. **Inf:** máquina de estados do caso diferente do snapshot final; read model operacional necessário |
| `FireShot Capture 090` | PNG | Mesma listagem, progresso `0%`, status `Na fila` | Fila | **Obs:** estado intermediário de fila |
| `FireShot Capture 091` | PNG | Mesma listagem, progresso `73%`, status `Processando` | Execução | **Obs:** progresso percentual. **Inf:** progresso calculado por fonte/módulo |
| `FireShot Capture 092` | PNG | Drawer `Progresso` com percentual `86%`, botão `Reprocessar`, lista por fonte com estados `Erro`, `Processando`, `Concluído`, nota de limite de 5 reprocessamentos | Monitoramento detalhado | **Obs:** progresso por fonte é oficial; reprocessamento com limite operacional. **Inf:** entidade de execução por fonte com status, tentativas, erro, timestamps e política de retry |
| `FireShot Capture 093` | PNG | Modo `Detalhado`, macroáreas no topo, card-resumo, área `Jurídico` expandida, cards detalhados, bloco `Processos Judiciais` com abas, lista de processos, comentários finais por bloco, `Análise conclusiva` e `Comentários finais` | Leitura detalhada | **Obs:** detalhado orientado a fonte/entrada; processos com subestrutura rica; comentários por bloco e no fechamento. **Inf:** `detailEntry` e `commentThread` por escopo |
| `FireShot Capture 094` | PNG | Modo `Analítico`, área `Jurídico` com aviso de deduplicação, filtros laterais, cards de métricas, gráfico de status, donuts por tribunal/assunto/vara/classe | Leitura analítica | **Obs:** visão analítica usa consolidação e deduplicação; filtros analíticos são parte do contrato. **Inf:** agregações pré-materializadas e facetas |
| `FireShot Capture 095` | PNG | Detalhado com foco em fontes e cards abertos, comentários finais por bloco | Leitura detalhada | **Obs:** cada fonte pode ter estado aberto/fechado e área de comentário própria |
| `FireShot Capture 096` | PNG | Drawer lateral `Detalhe dos processos` originado da visão analítica, tabela de processos filtrados, participação, valor, link `Detalhes` | Drill-down analítico | **Obs:** filtros analíticos levam a listagem detalhada de processos. **Inf:** backend precisa alinhar bucket analítico com conjunto exato de processos |
| `FireShot Capture 097` | PNG | Detalhamento profundo de `Processos Judiciais`, cada processo aberto com número, classe, tribunal, status, movimentações, valor, assunto, área, grau, segmento, órgão julgador, URL, participantes por polo, processos relacionados | Drill-down máximo processual | **Obs:** processo judicial tem estrutura de entidade própria; relacionamentos entre processos. **Inf:** `evidenceItem` genérico é insuficiente; modelo processual estruturado necessário |
| `FireShot Capture 099` | PNG | Dossiê detalhado de perfil `Recursos Humanos`, menos macroáreas ativas; contadores `Fontes com Resultados` e `Fontes sem Resultados`; drawers laterais | Dossiê de outro preset | **Obs:** diferentes perfis ativam diferentes macroáreas; drawers de resultado/não-resultado. **Inf:** schema/preset altera taxonomia navegável |
| `Captura de tela 2026-04-23 192757` | PNG | Variação do detalhado com `Histórico de Dossiês` no topo | Navegação complementar | **Obs:** dossiê final se conecta ao histórico |
| `Captura de tela 2026-04-23 193615` | PNG | Drawer `Fontes sem Resultados` | Leitura / status | **Obs:** fontes sem resultado podem ser listadas. **Inf:** diferenciar `sem resultado`, `não executado`, `indisponível` |
| `Captura de tela 2026-04-23 193643` | PNG | Drawer `Fontes com Resultados` | Leitura / status | **Obs:** contagem de fontes com resultado é feature de navegação |
| `FireShot Capture 100` | PNG | Drawer de progresso com lista de fontes e percentual | Monitoramento | **Obs:** reforça necessidade de `sourceRows` como projeção |
| `FireShot Capture 101-107` | PNG | Telas `Getdemo` — não fazem parte do sistema Uplexis/Upminer | — | **Descartado** do escopo desta auditoria |

---

## 3. Reconstrução do Fluxo Completo do Dossiê

### 3.1 Entrada no sistema

**Evidência:** tela 082 mostra página `Dossiês` com filtros e CTA de criação.
**Impacto backend:** read model de lista independente do `case` bruto, com filtros, ordenação e indicadores operacionais.

### 3.2 Criação do dossiê

**Evidência:** stepper `Perfil → Critérios → Tag → Parâmetros`; toggle PF/PJ; perfis padronizados e personalizados.
**Impacto backend:** criação não pode ser apenas `productKey + subject data`. É necessário distinguir: product family, dossier preset, subject kind, criteria, tag, parameters.

### 3.3 Preview do perfil

**Evidência:** drawer lateral mostra objetivo e fontes específicas.
**Impacto backend:** preset precisa ser entidade legível com lista de fontes, objetivos e restrições.

### 3.4 Critérios

**Evidência:** entrada por CPF/CNPJ e possibilidade de modelo/planilha.
**Impacto backend:** armazenar critérios declarados e derivados; suportar lote/importação futura.

### 3.5 Tag

**Evidência:** etapa separada do fluxo.
**Impacto backend:** tag faz parte da modelagem do dossiê e do histórico, não é detalhe cosmético.

### 3.6 Parâmetros

**Evidência:** bloco `Processos Judiciais (Nova)`; `Marcar automaticamente como relevantes`; `Criar e processar Dossiês automaticamente`.
**Impacto backend:** persistir `searchParameters`, `autoMarkRelevant`, `autoProcess` por dossiê e por módulo/área.

### 3.7 Pós-criação e histórico

**Evidência:** dossiê aparece imediatamente na lista com status `Iniciar`, depois `Na fila`, `Processando`.
**Impacto backend:** ciclo de vida operacional anterior ao `DONE`; read model de fila/execução.

### 3.8 Progresso por fonte

**Evidência:** drawer `Progresso` lista fontes, status, botão `Reprocessar`, limite de 5 reprocessamentos.
**Impacto backend:** entidade de execução por fonte/dataset com status, tentativas, reprocess count, erro, timestamps.

### 3.9 Entrada no dossiê final

**Evidência:** card-resumo, alternância `Analítico / Detalhado`, navegação por macroáreas.
**Impacto backend:** snapshot final precisa servir duas visões do mesmo dossiê; modelo de navegação por macroáreas e entradas.

### 3.10 Visão analítica

**Evidência:** filtros, contadores, gráficos, distribuições, aviso de deduplicação.
**Impacto backend:** materializar agregações e facetas, não apenas entregar evidências cruas.

### 3.11 Visão detalhada

**Evidência:** cards por fonte com tabela, texto, PDF, listas, comentários.
**Impacto backend:** snapshot precisa expor `detailEntries` padronizados por tipo.

### 3.12 Drill-down processual

**Evidência:** detalhe lateral vindo do analítico; detalhe profundo por processo no detalhado.
**Impacto backend:** processos precisam de modelo estruturado com relações entre agregação, lista e detalhe.

### 3.13 Fechamento analítico e comentário

**Evidência:** `Análise conclusiva do dossiê` e `Comentários finais` como blocos distintos; ações `Aprovar` e `Reprovar`; comentário como relevante.
**Impacto backend:** `decision`, `analysis`, `commentary` e `highlighted comment` precisam ser modelados separadamente.

---

## 4. Modelo Funcional do Produto

### 4.1 Modos de visualização

- `analitico`
- `detalhado`

**Inferência:** ambos são projeções do mesmo dossiê, não produtos diferentes.

### 4.2 Tipos de dossiê

- PF / PJ
- Perfis padronizados: `Compliance`, `Compliance Internacional`, `Financeiro`, `Investigativo`, `Jurídico`, `PLD`, `Recursos Humanos`
- Perfil personalizado (previsto explicitamente)

**Inferência:** três eixos — tipo de sujeito, família comercial, preset/schema operacional.

### 4.3 Macroáreas

Observadas: `Jurídico`, `Mídia/Internet`, `Financeiro`, `Cadastro`, `Reguladores`, `Bens e Imóveis`, `Listas Restritivas`, `Profissional`, `Socioambiental`.

### 4.4 Subtipos de bloco

- Resumo do dossiê
- Área analítica com filtros
- Cards métricos
- Gráficos (barras, donuts)
- Seção resumida por fonte/status
- Card detalhado de fonte
- Lista de processos
- Detalhe expandido de processo
- Comentários finais por bloco
- Análise conclusiva do dossiê
- Drawers laterais

### 4.5 Tipos de fonte

Judiciais, cadastrais, reguladoras, listas restritivas, socioambientais, financeiras.

### 4.6 Estados operacionais e de conteúdo

**Operacional:** `criado`, `na fila`, `processando`, `concluído`, `erro`, `iniciar`.  
**Conteúdo:** `com resultado`, `nenhum resultado`, `indisponível`, `aguardando revisão`.

### 4.7 Tipos de evidência

Tabela tabular, texto corrido/certidão, link PDF, lista processual, participantes por polo, processos relacionados.

### 4.8 Tipos de agregação

Total de processos, por polo, por status, por tribunal, por assunto, por vara, por classe.

### 4.9 Ações do usuário

Criar, iniciar, filtrar, limpar, ver detalhes, abrir drawer, expandir/recolher, reprocessar, exportar, abrir histórico, aprovar, reprovar, comentar, marcar como relevante.

### 4.10 Responsividade

**Inferência:** composição em abas horizontais, drawers, cards expansivos indica que responsividade depende de prioridade semântica entre blocos. Backend deve carregar `render hints` para degradação elegante.

---

## 5. Gap Analysis Backend Atual vs UX Observada

| Capacidade | Evidência da UX | Backend atual | Classificação | Lacuna / recomendação |
|---|---|---|---|---|
| **Catálogo de produtos** | Perfis padronizados e famílias comerciais | `PRODUCT_CATALOG` existe em `v2ProductCatalog.cjs` | Suporta parcialmente | Falta separar produto comercial de preset/schema |
| **Módulos** | Fontes compostas a partir do perfil | `PRODUCT_REGISTRY` e `resolveCaseEntitlements` em `v2Modules.cjs` | Já suporta bem | Boa base, mas centrada em módulo técnico, não em fonte UX |
| **Presets de dossiê** | Drawer de perfil mostra objetivo e fontes | Não há entidade `dossierPreset` versionada | Não suporta | Criar `dossierPresets` com governança, preview e versionamento |
| **Schema de dossiê** | Macroáreas, visões e detalhamentos mudam entre perfis | **`dossierSchema.cjs` JÁ EXISTE** com `MACRO_AREAS`, `SECTION_REGISTRY`, `DOSSIER_SCHEMA_REGISTRY`, `buildDossierProjection` | **Suporta parcialmente (base sólida mas desconectada)** | Integrar `dossierSchema.cjs` na criação de caso, snapshot e client projection. Expandir para analytics e detail config |
| **Agrupamento por macroárea** | Abas Jurídico/Cadastro/etc. | `dossierSchema.cjs` já resolve macroáreas por `resolveMacroAreas` | **Suporta parcialmente** | Falta integrar em `reportSnapshots` e `clientProjections`. `v2ReportSections.cjs` ainda usa `SECTION_ORDER` fixa |
| **Customização PF/PJ** | Toggle PF/PJ, CTA perfil novo | `v2CreateClientSolicitation` aceita apenas `productKey` e dados do sujeito | Não suporta | Fluxo precisa aceitar preset, schema, tag, parâmetros e composição custom |
| **Visão analítica** | Filtros, contadores, gráficos, distribuições | `clientProjection` é enxuta em `v2Core.cjs:441`. `dossierSchema.cjs` tem `analyticsEnabled` flag mas sem materialização | Não suporta | Materializar `analyticsBlocks`, facetas e métricas no snapshot |
| **Visão detalhada** | Cards por fonte, tabelas, PDFs, comentários | `sections` atuais são superficiais em `v2ReportSections.cjs:127` | Suporta parcialmente | Adicionar `detailEntries` tipadas e `sourceRows` |
| **Filtros analíticos** | Tribunal, status, polo, UF | Não há contrato de facetas | Não suporta | Criar `filterMetadata` e `facetCounts` derivados de `providerRecords` |
| **Métricas e distribuições** | Bar chart e donuts | Não há agregações formais | Não suporta | Materializar séries e distribuições por schema |
| **Fontes e status por fonte** | Drawers e listas com/sem resultado | `providerRequests` e `moduleRuns` existem, mas não como read model cliente por fonte | Suporta parcialmente | Criar `sourceRows` ou ampliar `providerRequests` para UX |
| **Detalhamento por evidência** | Tabelas, texto, PDF, listas | `evidenceItems` existem, mas genéricos | Suporta parcialmente | Adicionar `renderType`, `detailPayload`, `sourceBlockKey` |
| **Processos judiciais estruturados** | Lista, detalhe, polos, relacionados | `judicial` hoje é módulo + evidências/sinais. `providerRecords` extrai itens de `snap.payload.processes` mas sem schema rigido | Não suporta | Criar modelo processual canônico ou subtipo estruturado em `detailEntries` |
| **Comentários por seção/bloco** | Comentário final em cada bloco | Não há modelagem de comentário por escopo | Não suporta | Criar `commentThreads` por dossie/grupo/seção/entry |
| **Fluxo de aprovação/reprovação** | Botões explícitos | `decision` e `reviewGate` existem em `v2ReviewGate.cjs:32` | Suporta parcialmente | Falta separar aprovação do dossiê, comentários e justificativas |
| **Exportação** | Ação global `Exportar` | Publicação HTML/token existe em `materializeV2PublicationArtifacts`. Coleção `exports` existe em `collections.js` | Suporta parcialmente | Falta `exportJob` estruturado com scope/format/status |
| **Timeline** | Histórico e operação sugerem trilha | `buildTimelineEventsForCase` em `v2Timeline.cjs:106` | Suporta parcialmente | Falta semântica por área/fonte/ação do usuário |
| **Versionamento de snapshot** | Relatório publicado precisa ser reprodutível | `contentHash` e token determinístico existem | Já suporta bem | Expandir para schema/preset/config hash |
| **Read models** | Cliente consome projeções | Subscriptions em `firestoreService.js:508` e `CaseViewPage.jsx` | Suporta parcialmente | Falta read model de dossiê rico e histórico operacional |
| **Multi-tenant governance** | Perfis e produtos diferem por tenant | Entitlements existem | Suporta parcialmente | Falta política de composição custom e publicação por tenant |
| **Responsividade por hints** | UX sugere prioridade diferente por viewport | Inexistente | Não suporta | Adicionar `responsiveRenderHints` no snapshot/schema |

---

## 6. Plano Ultra Detalhado de Refatoração do Backend

### 6.1 Product catalog e contracts

**Problema:** `PRODUCT_REGISTRY` conhece required/optional modules, mas não conhece preset, schema, grupos, visões ou configurabilidade. `PRODUCT_CATALOG` descreve nome e tier, mas não governa montagem de dossiê.

**Comportamento exigido:** um mesmo produto comercial pode ter múltiplos presets; PF/PJ alteram perfis disponíveis; preset possui objetivo e lista de fontes visíveis antes da criação.

**Mudanças:**
- Manter `PRODUCT_REGISTRY` como contrato técnico de módulos.
- Introduzir `dossierProductFamilies` ou ampliar `PRODUCT_CATALOG` com:
  - `defaultPresetKey`
  - `supportedPresetKeys`
  - `supportsCustomComposition`
  - `supportedSubjectKinds`
  - `defaultSchemaKey`
  - `allowedSchemaKeys`
  - `allowedSectionGroupKeys`
  - `supportsAutoProcess`

**Coleções:** opcionalmente manter em código por ora, mas migrar para `dossierProductCatalog` se alterações comerciais precisarem de deploy.

### 6.2 Dossier schemas e presets

**Problema:** não existe `dossierPreset` versionado. `dossierSchema.cjs` já existe e é sólido, mas ainda não é o centro da gravidade do sistema.

**Comportamento exigido:** perfis como `Financeiro` e `Recursos Humanos` ligam diferentes fontes e macroáreas; preview de perfil reflete composição real; dossiês diferentes expõem diferentes conjuntos de áreas.

**Mudanças:**
- **Elevar `dossierSchema.cjs` a contrato oficial de montagem de dossiê.**
- Criar `dossierPresets` com:
  - objetivo comercial/operacional
  - fontes previstas
  - módulos previstos
  - schema associado
  - sujeito suportado
- Expandir `DOSSIER_SCHEMA_REGISTRY` para incluir:
  - `supportedModes: ['analitico', 'detalhado']`
  - `analyticsConfig`
  - `detailConfig`
  - `responsiveConfig`

**Coleções/documentos:**
- `dossierSchemas/{schemaKey_version}`
- `dossierPresets/{presetKey_version}`
- `tenantDossierPolicies/{tenantId}`

**Política:** schema estrutural criado apenas por ops/admin; preset pode ser institucional ou tenant-specific.

### 6.3 Case creation flow

**Problema:** `v2CreateClientSolicitation` em `index.js:5159` aceita sujeito, `productKey` e campos sociais/digitais. **Não aceita** tag, preset, schema, parâmetros estruturados, auto-process ou composição custom.

**Comportamento exigido:** criação tem stepper oficial com 4 etapas; tag, parâmetros e auto-process fazem parte do fluxo.

**Mudanças:**
- Ampliar payload de criação para aceitar:
  - `dossierPresetKey`
  - `dossierSchemaKey`
  - `subjectKind`
  - `criteria`
  - `tagIds`
  - `parameters`
  - `requestedSectionGroupKeys`
  - `requestedSourceKeys`
  - `requestedModuleKeys`
  - `autoMarkRelevant`
  - `autoProcess`
  - `configurationSource`
- Persistir em `cases`:
  - `dossierSchemaKey`
  - `dossierPresetKey`
  - `customDossierConfig`
  - `configurationHash`
  - `requested/effective section groups`
  - `requested/effective sections`

**Validações:** PF não aceita schema PJ puro; fontes/modulos fora da policy do tenant barrados.

### 6.4 Module resolution

**Problema:** `resolveCaseEntitlements` resolve módulos, mas ignora grupos, seções, fontes de UX e preset/schema.

**Mudanças:**
- Estender `moduleRuns` com:
  - `sectionGroupKey`
  - `sectionKey`
  - `sourceRowKeys`
  - `displayOrder`
  - `uiVisibility`
  - `responsivePriority`
  - `emptyStatePolicy`
- Resolver módulos por: produto → preset → schema → policy do tenant → parâmetros do caso.

### 6.5 Evidence and source modeling

**Problema:** `PROVIDER_SOURCE_SPECS` cobre provedores principais em taxonomia técnica. `evidenceItems` não capturam visão de fonte/bloco da UX.

**Mudanças:**
- Introduzir `sourceRows` como read model:
  - `sourceKey`, `sourceDisplayName`, `sectionGroupKey`, `sectionKey`, `sourceStatus`, `resultState`, `resultCount`, `hasDetail`, `detailEntryKeys`, `emptyReasonCode`
- Enriquecer `evidenceItems` com:
  - `renderType`, `detailPayload`, `detailPayloadRef`, `sourceBlockKey`, `desktopSummary`, `mobileSummary`, `isPrimaryForSource`

### 6.6 Analytical aggregations

**Problema:** backend não materializa filtros e distribuições da visão analítica.

**Mudanças:**
- Criar bloco `analyticsBlocks` no snapshot:
  - `metrics`, `series`, `distributions`, `facets`, `drilldowns`
- Cada bloco carrega: `aggregationKey`, `groupBy`, `filterDependencies`, `bucketIds`, `total`, `supportsDrawer`
- Materializar na publicação; opcionalmente também em pré-visualização operacional.

### 6.7 Detail entry modeling

**Problema:** `sections` atuais carregam contagem e ids, mas não tipo de entrada a renderizar.

**Mudanças:**
- Criar `detailEntries` com tipos canônicos: `table`, `paragraph`, `process_list`, `process_detail`, `document_link`, `mixed`
- Campos: `entryKey`, `sectionGroupKey`, `sectionKey`, `sourceKey`, `title`, `subtitle`, `status`, `entryType`, `payload`, `payloadRef`, `supportsComments`, `supportsHighlight`

### 6.8 Judicial process modeling

**Problema:** módulo `judicial` detecta findings, mas não representa processo como entidade de primeiro nível.

**Mudanças:**
- Criar modelo processual canônico em `detailEntries` ou coleção `judicialProcesses`:
  - identidade (número, classe, tribunal)
  - classificações (assunto, área, grau, segmento, órgão julgador)
  - estado processual
  - participantes por polo
  - referências de origem
  - processos relacionados
  - flags analíticas derivadas

### 6.9 Comments and decision workflow

**Problema:** `decision` e `reviewGate` existem, mas comentários por escopo não. `Análise conclusiva` e `Comentários finais` ainda não são entidades separadas.

**Mudanças:**
- Criar `commentThreads` com `scopeType`: `dossier`, `sectionGroup`, `section`, `detailEntry`
- Criar `approvalState` separado de `decision` analítica automática, contendo:
  - `approvalStatus`, `approvedBy`, `rejectedBy`, `approvedAt`, `rejectedAt`, `approvalReason`, `requiredReviewLevel`

### 6.10 Report snapshots

**Problema:** `buildReportSnapshotFromV2` gera snapshot com `sections` e `sectionContributions`, mas sem grupos, analytics, entries, comments, source rows ou render hints.

**Mudanças:**
- Expandir `reportSnapshots` para incluir:
  - `dossierSchemaKey`, `dossierPresetKey`, `configurationHash`
  - `headerContext`, `sectionGroups`, `sourceRows`, `detailEntries`
  - `analyticsBlocks`, `navigationModel`, `commentSummary`, `responsiveRenderHints`

### 6.11 Client projections

**Problema:** `buildClientProjectionContract` entrega dados comerciais e resumo simples. Serve para abertura básica, mas não para a UX de dossiê observada.

**Mudanças:**
- Ampliar `clientProjections` com duas camadas: `listProjection` e `dossierProjection`
- Campos recomendados:
  - `lifecycleStatus`, `progressPercent`, `sourceExecutionSummary`, `sourceResultSummary`
  - `availableModes`, `activeSectionGroups`, `reportAvailability`

### 6.12 Export/publication

**Problema:** `materializeV2PublicationArtifacts` publica HTML e link público, mas exportação na UX é ação ampla do usuário.

**Mudanças:**
- Criar `exportJobs`:
  - `scope`: `full_dossier`, `analytics_view`, `detail_section`, `process_list`
  - `format`: `pdf`, `xlsx`, `csv`, `json`
  - `requestedBy`, `status`, `artifactRef`

### 6.13 Multi-tenant governance

**Problema:** entitlements existem, mas o tenant ainda não governa composição de dossiê.

**Mudanças:**
- `tenantDossierPolicies` com:
  - presets permitidos, módulos permitidos, sectionGroups permitidos
  - export scopes permitidos, autoProcess permitido, maxReprocessCount

### 6.14 Security rules

**Problema:** regras atuais protegem `rawSnapshots` e `providerRecords`, mas novas entidades não existem.

**Mudanças:**
- `dossierSchemas`: leitura ops/admin; leitura cliente apenas de schemas publicados
- `dossierPresets`: leitura tenant/client conforme policy
- `commentThreads`: leitura por tenant/role e escrita apenas via callable
- `exportJobs`: leitura por solicitante e ops

### 6.15 Versioning and backward compatibility

**Mudanças:**
- Adicionar `schemaVersion`, `presetVersion`, `configurationHash`, `renderContractVersion`
- Dual-write transicional: manter campos legados, adicionar novos, migrar leitores aos poucos

---

## 7. Modelo de Dados Recomendado

### `dossierSchema`

| Campo | Propósito |
|---|---|
| `schemaKey` | Identificador estável |
| `version` | Versão imutável |
| `displayName` | Nome operacional |
| `subjectKind` | `pf`, `pj`, `mixed` |
| `supportedViewModes` | `['analitico', 'detalhado']` |
| `sectionGroups` | Definições de macroáreas |
| `sections` | Definições de seções |
| `analyticsConfig` | Agregações previstas |
| `detailConfig` | Tipos de entrada por seção |
| `responsiveRenderHints` | Prioridade e comportamento por viewport |
| `status` | `draft`, `published`, `deprecated` |

### `dossierPreset`

| Campo | Propósito |
|---|---|
| `presetKey` | Identificador |
| `version` | Versão imutável |
| `displayName` | Nome comercial |
| `audience` | `ops_internal`, `client_corporate`, `both` |
| `subjectKind` | Restrição PF/PJ |
| `objective` | Descrição comercial |
| `defaultSchemaKey` | Schema associado |
| `sourcePreview` | Lista de fontes para preview |
| `moduleKeys` | Módulos previstos |
| `lockedModuleKeys` | Módulos obrigatórios |
| `parameterDefaults` | Defaults de parâmetros |
| `taggingPolicy` | Regras de tag |
| `autoProcessDefault` | Default de auto-processamento |

### `customDossierConfig`

| Campo | Propósito |
|---|---|
| `caseId` | Vínculo |
| `configurationSource` | `preset`, `custom`, `hybrid` |
| `requestedModuleKeys` | Módulos solicitados |
| `effectiveModuleKeys` | Módulos efetivos |
| `requestedSectionGroupKeys` | Grupos solicitados |
| `effectiveSectionGroupKeys` | Grupos efetivos |
| `requestedSourceKeys` | Fontes solicitadas |
| `searchParameters` | Parâmetros de busca |
| `tagIds` | Tags associadas |
| `autoMarkRelevant`, `autoProcess` | Flags operacionais |
| `configurationHash` | Hash para consistência |

### `sectionGroup`

| Campo | Propósito |
|---|---|
| `groupKey`, `label`, `iconKey` | Identidade visual |
| `displayOrder` | Ordenação |
| `analyticsEnabled`, `detailsEnabled` | Modos suportados |
| `sourceCount`, `resultCount` | Métricas |
| `emptyStatePolicy` | Comportamento quando vazio |

### `section`

| Campo | Propósito |
|---|---|
| `sectionKey`, `groupKey`, `label` | Taxonomia |
| `displayOrder` | Ordenação |
| `moduleKeys`, `sourceKeys` | Origens técnicas |
| `entryKeys` | Entradas vinculadas |
| `renderMode`, `collapsedByDefault`, `visibleWhenEmpty` | Comportamento UX |

### `sourceRow`

| Campo | Propósito |
|---|---|
| `sourceKey`, `sourceDisplayName`, `provider`, `dataset` | Identidade da fonte |
| `groupKey`, `sectionKey` | Navegação |
| `status`, `resultState`, `resultCount` | Estado e contagem |
| `detailEntryKeys` | Link para detalhes |
| `supportsRetry`, `supportsExport` | Ações |

### `detailEntry`

| Campo | Propósito |
|---|---|
| `entryKey`, `groupKey`, `sectionKey`, `sourceKey` | Taxonomia |
| `title`, `subtitle`, `status` | Apresentação |
| `entryType` | `table`, `paragraph`, `process_list`, etc. |
| `payload`, `payloadRef` | Dados ou referência externa |
| `commentThreadId` | Thread de comentários |
| `highlightState` | Relevância |
| `responsivePriority` | Hint para mobile |

### `analyticsBlock`

| Campo | Propósito |
|---|---|
| `blockKey`, `groupKey`, `label` | Identidade |
| `chartType`, `metricType` | Tipo de visualização |
| `bucketDefinitions`, `bucketRows` | Dados agregados |
| `facetDependencies` | Filtros que afetam este bloco |
| `drilldownTarget` | Destino do drill-down |

### `commentThread`

| Campo | Propósito |
|---|---|
| `threadId` | Identificador |
| `scopeType`, `scopeId` | `dossier`, `sectionGroup`, `section`, `detailEntry` |
| `caseId`, `tenantId` | Isolamento |
| `entries` | Lista de comentários |
| `highlightedEntryId` | Comentário relevante |
| `visibility` | `internal`, `client`, `both` |
| `lastUpdatedAt` | Ordenação |

### `approvalState`

| Campo | Propósito |
|---|---|
| `caseId` | Vínculo |
| `approvalStatus` | `pending`, `approved`, `rejected` |
| `reviewLevel`, `requiresSenior` | Escalonamento |
| `approvedBy`, `rejectedBy`, `approvedAt`, `rejectedAt` | Audit |
| `reason` | Justificativa |

### `exportJob`

| Campo | Propósito |
|---|---|
| `jobId`, `caseId` | Identificação |
| `scope` | `full_dossier`, `analytics_view`, etc. |
| `format` | `pdf`, `xlsx`, `csv`, `json` |
| `status` | `queued`, `processing`, `completed`, `failed` |
| `requestedBy`, `requestedAt`, `completedAt` | Audit |
| `artifactRef` | Referência ao artefato gerado |

### `responsiveRenderHints`

| Campo | Propósito |
|---|---|
| `mobilePriority` | Ordem no mobile |
| `desktopDefaultExpanded` | Estado default desktop |
| `hideOnSmallScreens` | Ocultação condicional |
| `mobileCardFields` | Campos para card compacto |
| `preferredDrawerBehavior` | `inline`, `drawer`, `modal` |
| `supportsCompactSummary` | Capacidade de resumo |

---

## 8. Estratégia de Migração

### Princípios

- Não quebrar subscriptions atuais
- Preservar `clientProjections` e `reportSnapshots`
- Adicionar campos antes de substituir consumidores

### Fases recomendadas

1. **Introduzir schemas/presets/policies** sem mudar leitura atual.
2. **Ampliar payload de criação** com campos opcionais (`dossierPresetKey`, `dossierSchemaKey`, etc.).
3. **Enriquecer `moduleRuns`, `evidenceItems`, `providerRequests`** com `sectionGroupKey`, `sectionKey`, `renderType`.
4. **Materializar `sourceRows`, `detailEntries`, `analyticsBlocks`** em funções de publicação.
5. **Expandir `reportSnapshots`** com novos blocos.
6. **Expandir `clientProjections`** com `listProjection` e `dossierProjection`.
7. **Migrar clientes gradualmente** para o novo contrato.

### Convivência com legado

- Manter `moduleKeys`, `sections`, `riskSummary`, `keyFindings` nos snapshots antigos
- Adicionar novos campos paralelos
- Usar `renderContractVersion` para o frontend decidir qual parser usar

### Reemissão de snapshots

- Snapshots publicados devem referenciar configuração original
- Novos snapshots usam novo schema/preset/config hash
- Reemissão deve ser explicita, nunca implícita por alteração de schema

### Validação de consistência

- `configurationHash` do caso deve casar com snapshot
- `sourceRows` devem referenciar `detailEntries` existentes
- Agregações devem apontar para ids reais de processos/evidências

---

## 9. Plano de Testes

### Domínio

- Preset PF resolve schema PF correto
- Preset PJ resolve schema PJ correto
- Custom PF não aceita grupo PJ proibido
- Policy do tenant bloqueia combinações indevidas

### Materialização

- `moduleRuns` recebem `sectionGroupKey`/`sectionKey`
- `sourceRows` saem com status coerente
- `detailEntries` saem tipados corretamente
- `analyticsBlocks` refletem o mesmo conjunto de processos do detalhamento

### Compatibilidade

- Leitor legado continua operando sem novos campos
- Snapshot antigo permanece válido
- Token público existente continua resolvendo relatório anterior

### Autorização

- Cliente não lê `rawSnapshots` nem `providerRecords`
- Cliente só lê preset/schema autorizado ao tenant
- Comentário de tenant A não vaza para tenant B

### PF/PJ/custom

- Criação PF com preset PJ falha
- Criação PJ com preset PF falha
- Caso custom preserva `configurationHash`

### Analítico/detalhado

- Analytics e details apontam para a mesma base de evidências
- Bucket do analítico abre o conjunto correto de processos

### Responsividade guiada por metadata

- `responsiveRenderHints` existem em snapshot
- Entradas com `mobileCardFields` geram fallback compacto
- Grupos de baixa prioridade podem ser colapsados sem perda de ids navegáveis

---

## 10. Assunções e Inferências

### Alta confiança

- Existe fluxo de criação por etapas
- Existem perfis padronizados e espaço para perfis personalizados
- PF/PJ são eixos centrais
- O produto diferencia visão analítica de detalhada
- O dossiê é organizado por macroáreas
- Existe progresso por fonte com reprocessamento
- Existem comentários e aprovação/reprovação
- **O backend V2 já possui `dossierSchema.cjs` com macroáreas, section registry e schema registry (descoberta desta auditoria)**

### Média confiança

- Preset comercial é diferente de produto técnico
- Processos precisam de entidade estruturada própria para escalar a UX
- Responsividade vai exigir hints de backend para reduzir complexidade do frontend
- `dossierSchema.cjs` foi criado como preparação para a UI Lexi, mas ainda não está integrado nos pontos de consumo

### Baixa confiança

- O produto pode suportar composição 100% self-service pelo cliente final; a UX indica isso, mas não prova o grau de autonomia
- Pode haver mais estados operacionais internos além dos observados
- A pasta `Lexi` continha capturas `Getdemo` (101-107) que não pertencem ao sistema Uplexis; foram descartadas

---

## Decisões Arquiteturais Recomendadas

1. **Não recriar `dossierSchema.cjs`; integrá-lo.** O arquivo já existe e é arquiteturalmente correto. Deve se tornar o centro de gravidade da montagem de dossiês.
2. **Separar definitivamente `produto`, `preset` e `schema`.** Produto é contrato comercial; preset é configuração operacional; schema é estrutura de navegação e renderização.
3. **Fazer o dossiê ser schema-driven no backend, não apenas no frontend.** O schema deve governar criação, processamento, snapshot e projeção.
4. **Materializar duas visões do mesmo dossiê: `analytics` e `details`.** Ambas derivadas do mesmo conjunto de evidências, mas com contratos de leitura distintos.
5. **Introduzir `sourceRows` e `detailEntries` como contratos formais.** Substituir a lógica ad hoc de mapeamento módulo→seção por uma projeção declarativa.
6. **Criar modelo processual estruturado para `Processos Judiciais`.** Não mais apenas `evidenceItem` genérico com texto livre.
7. **Tratar comentários e aprovação como domínios separados.** `approvalState` ≠ `decision` ≠ `commentThread`.
8. **Versionar snapshot por `schemaVersion`, `presetVersion` e `configurationHash`.** Garantir reprodutibilidade e segurança de publicação.
9. **Adotar dual-write transicional.** Manter contratos legados funcionando enquanto novos campos são populados.

---

## Riscos se nada for refatorado

1. Cada novo dossiê custom PF/PJ vai virar exceção hardcoded em `v2CreateClientSolicitation` e no frontend.
2. A UI futura vai depender de lógica excessiva no frontend para compensar a falta de contrato backend, gerando inconsistências entre analítico e detalhado.
3. `dossierSchema.cjs` continuará sendo código morto ou acoplado de forma parcial, desperdiçando o investimento já feito.
4. Filtros, gráficos e drawers laterais ficarão inconsistentes entre si porque não há faceta backend.
5. A experiência de progresso por fonte continuará desconectada do resto do domínio, dificultando reprocessamento e auditoria.
6. O detalhamento processual pode virar payload ad hoc difícil de validar, testar e manter.
7. `clientProjections` continuarão pobres, forçando o frontend a fazer múltiplas subscriptions para montar uma tela de dossiê.

---

## Ordem ideal de execução do refactor

1. **Definir `dossierPresets` e `tenantDossierPolicies`** — expandir o `DOSSIER_SCHEMA_REGISTRY` existente com `analyticsConfig`, `detailConfig`, `responsiveConfig`.
2. **Expandir `v2CreateClientSolicitation`** para aceitar preset/schema/tag/parâmetros — campos opcionais, backward compatible.
3. **Integrar `dossierSchema.cjs` em `resolveCaseEntitlements` e `buildModuleRunsForCase`** — popular `sectionGroupKey` e `sectionKey` nos `moduleRuns`.
4. **Enriquecer `moduleRuns`, `providerRequests`, `evidenceItems`** com `sourceBlockKey`, `renderType`, `mobileSummary`.
5. **Introduzir modelo estruturado de `sourceRows`, `detailEntries` e processos judiciais** — começar pelo módulo `judicial`.
6. **Materializar `analyticsBlocks` e `filterMetadata`** — gerar na publicação do relatório.
7. **Expandir `reportSnapshots`** — incluir novos blocos mantendo campos legados.
8. **Expandir `clientProjections`** — criar `listProjection` e `dossierProjection`.
9. **Fechar regras de segurança** para novas coleções e testes de compatibilidade.
10. **Remover campos legados** (futuro, após 100% dos clientes migrados).
