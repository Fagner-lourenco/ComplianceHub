# Auditoria Backend V2 Orientada ao Fluxo Completo de Dossie Uplexis/Upminer

## 1. Resumo Executivo

### Visao geral do sistema inferido

A analise consolidada da pasta `C:\Users\Analista\Downloads\FireShot\Lexi` mostra um produto de dossie que comeca antes da emissao do relatorio e continua depois dela. O sistema observado nao e apenas uma tela de resultado. Ele possui, explicitamente:

- historico/listagem de dossies
- criacao guiada por etapas
- selecao de perfis padronizados PF/PJ
- possibilidade explicita de criar perfis personalizados
- criterios, tag e parametros adicionais
- opcao de criacao com processamento automatico
- monitoramento de progresso por fonte
- reprocessamento por fonte
- visao analitica
- visao detalhada
- navegacao por macroareas
- drawers laterais de fontes com/sem resultado
- drill-down processual
- comentarios finais por bloco
- analise conclusiva do dossie
- aprovacao / reprovacao
- exportacao
- historico de dossies

### Conclusao de aderencia do backend atual

O backend V2 atual esta entre "suporta parcialmente" e "suporta bem" para a parte operacional base, mas ainda esta entre "nao suporta" e "suporta com acoplamento ruim" para a parte que transforma esse fluxo em um dossie configuravel, multi-visao e schema-driven.

Resumo objetivo:

- O V2 ja sustenta bem: produtos, modulos, PF/PJ, materializacao de artefatos, snapshot de relatorio, decisao, timeline, publicacao e projeoes seguras.
- O V2 suporta parcialmente: agrupamento logico por modulo, exposicao cliente, governanca multi-tenant e trilha operacional.
- O V2 ainda nao suporta de forma nativa: presets de dossie, schemas de dossie, customizacao PF/PJ self-service, visao analitica estruturada, visao detalhada orientada por entradas, filtros analiticos, agregacoes graficas, detalhamento processual de alto nivel, comentarios por escopo, responsividade guiada por metadata e fluxo formal de processamento por fonte.

### Conflito com o plano existente

O arquivo `d:\ComplianceHub\COMPLIANCE_HUB_V2\app\docs\audits\2026-04-23-lexi-visual-refactor-plan.md` trata principalmente de tema visual, paleta, renderer visual e schema de apresentacao no frontend. Isso esta alinhado com a referencia apenas em superficie. O conjunto de imagens mostra que a lacuna dominante nao e visual; e de contrato backend, modelo de dossie, estado operacional, preset/schema, analiticos e composicao customizada. Portanto, para esta revisao, a evidencia das imagens tem precedencia sobre o plano visual existente.

## 2. Inventario das Referencias Visuais

### Criterio de leitura

- "Observado": elemento explicitamente visivel no arquivo.
- "Inferencia": conclusao arquitetural extraida da composicao da UX.

### Inventario arquivo a arquivo

#### `FireShot Capture 082 - Dossie - [dossie.uplexis.com].png`
- Tipo: PNG
- O que mostra: pagina `Dossies` vazia, com filtros por periodo, responsavel, status, CTA `Criar novo dossie`, botoes `Limpar` e `Buscar`.
- Etapa do fluxo: entrada no modulo / historico vazio.
- Implicacoes backend:
  - Observado: existe listagem filtravel de dossies.
  - Observado: filtro por periodo, responsavel e status.
  - Inferencia: backend precisa de read model paginavel para lista de dossies, nao apenas `cases` crus.
  - Inferencia: backend precisa expor colunas operacionais e estados resumidos para tabela.

#### `082.html.txt`
- Tipo: export HTML/TXT
- O que mostra: DOM da mesma tela do arquivo 082.
- Etapa do fluxo: historico vazio.
- Implicacoes backend:
  - Observado: confirma nomenclatura `Dossies`.
  - Observado: reforca existencia de filtros declarados na UI.

#### `FireShot Capture 083 - Dossie - [dossie.uplexis.com].png`
- Tipo: PNG
- O que mostra: `Criacao de dossies`, etapa `Perfil de consulta`, toggle `Pessoa Fisica` / `Pessoa Juridica`, perfis padronizados como `Compliance`, `Compliance Internacional`, `Financeiro`, `Investigativo`, `Juridico`, `PLD`.
- Etapa do fluxo: criacao, escolha de preset/perfil.
- Implicacoes backend:
  - Observado: PF/PJ e um eixo primario do produto.
  - Observado: existem perfis de consulta padronizados.
  - Observado: existe secao `Perfis de Consulta Personalizados`.
  - Inferencia: backend precisa separar `produto comercial` de `preset de dossie`.

#### `083.html.txt`
- Tipo: export HTML/TXT
- O que mostra: DOM da etapa `Perfil de consulta`.
- Etapa do fluxo: criacao / preset.
- Implicacoes backend:
  - Observado: confirma stepper `Perfil de consulta / Criterios / Tag / Parametros`.
  - Observado: confirma labels de perfis e CTA de criacao de perfil novo.

#### `FireShot Capture 083_2 - Dossie - [dossie.uplexis.com].png`
- Tipo: PNG
- O que mostra: a mesma etapa de perfis, com drawer lateral aberto para `Financeiro`, exibindo objetivo e lista de fontes do perfil.
- Etapa do fluxo: criacao / preview de preset.
- Implicacoes backend:
  - Observado: cada perfil tem descricao e fonte-lista explicita.
  - Inferencia: preset nao e so um nome; ele tem `objetivo`, `fontes`, composicao e possivelmente regras.
  - Inferencia: backend precisa armazenar metadata de preset e preview contratual.

#### `083.2.html.txt`
- Tipo: export HTML/TXT
- O que mostra: DOM da etapa de perfis com drawer lateral.
- Etapa do fluxo: criacao / preview de preset.
- Implicacoes backend:
  - Observado: a drawer lista fontes individualmente, reforcando que preset precisa ser materializado em fontes/modulos legiveis.

#### `FireShot Capture 084 - Dossie - [dossie.uplexis.com].png`
- Tipo: PNG
- O que mostra: mesma tela de perfis com `Pessoa Juridica`.
- Etapa do fluxo: criacao / preset PJ.
- Implicacoes backend:
  - Observado: os perfis mudam de contexto conforme PF/PJ.
  - Inferencia: `subjectKind` e `preset/schema` devem ser validados juntos.

#### `084.html.txt`
- Tipo: export HTML/TXT
- O que mostra: DOM da tela PJ.
- Etapa do fluxo: criacao / preset PJ.
- Implicacoes backend:
  - Observado: confirma stepper e troca de sujeito.

#### `FireShot Capture 086 - Dossie - [dossie.uplexis.com].pdf`
- Tipo: PDF exportado por captura
- O que mostra: captura exportada da etapa de criacao/criterios.
- Etapa do fluxo: criacao / criterios.
- Implicacoes backend:
  - Observado: o fluxo de criacao tem variacao em formato exportado.
  - Inferencia: historico e export de configuracao podem fazer sentido tambem para etapas pre-processamento.

#### `086.html.txt`
- Tipo: export HTML/TXT
- O que mostra: etapa `Criterios`, input de CPF/CNPJ, opcao de upload de modelo/planilha, drawer lateral do preset `Recursos Humanos`.
- Etapa do fluxo: criacao / criterios.
- Implicacoes backend:
  - Observado: criterios podem ser digitados e possivelmente importados por planilha.
  - Observado: drawer de preset `Recursos Humanos` lista fontes heterogeneas de varias macroareas.
  - Inferencia: criterios e preset precisam ser desacoplados; um preset nao define sozinho o sujeito nem todos os parametros.
  - Inferencia: suporte a lote/importacao e compativel com a UX futura.

#### `FireShot Capture 087 - Dossie - [dossie.uplexis.com].png`
- Tipo: PNG
- O que mostra: etapa `Tag`, com selecao de tag existente e opcao `Nao atribuir tag a esse dossie`.
- Etapa do fluxo: criacao / classificacao.
- Implicacoes backend:
  - Observado: tag e parte do fluxo oficial.
  - Inferencia: `case` precisa carregar classificacao/rotulacao separada de produto/preset.

#### `FireShot Capture 088 - Dossie - [dossie.uplexis.com].png`
- Tipo: PNG
- O que mostra: etapa `Parametros`, bloco `Processos Judiciais (Nova)`, checkbox `Marcar automaticamente como relevantes`, checkbox `Criar e processar Dossies automaticamente`, CTA `Criar dossie`.
- Etapa do fluxo: criacao / parametros finais.
- Implicacoes backend:
  - Observado: ha parametros adicionais por area/fonte.
  - Observado: ha politicas operacionais no ato da criacao.
  - Inferencia: backend precisa persistir `searchParameters`, `autoMarkRelevant`, `autoProcess`, por dossie e por modulo/area quando aplicavel.

#### `FireShot Capture 089 - Dossie - [dossie.uplexis.com].png`
- Tipo: PNG
- O que mostra: listagem com toast `Dossie criado com sucesso!`, uma linha com colunas `No dossie`, `Criacao`, `Tag`, `Criterio`, `Progresso`, `Status`, `Monitoria`, `Workflow`, `Score`, `Acoes`; status `Iniciar`.
- Etapa do fluxo: pos-criacao / historico.
- Implicacoes backend:
  - Observado: o dossie entra no historico antes do processamento terminar.
  - Observado: ha estado acionavel `Iniciar`.
  - Inferencia: existe maquina de estados do caso diferente do snapshot final.
  - Inferencia: lista do cliente precisa de read model operacional, nao so status final.

#### `FireShot Capture 090 - Dossie - [dossie.uplexis.com].png`
- Tipo: PNG
- O que mostra: mesma listagem, progresso `0%`, status `Na fila`.
- Etapa do fluxo: fila.
- Implicacoes backend:
  - Observado: existe estado intermediario de fila.
  - Inferencia: backend precisa distinguir `created`, `queued`, `running`, `completed`, `failed`, `waiting_review`, etc.

#### `FireShot Capture 091 - Dossie - [dossie.uplexis.com].png`
- Tipo: PNG
- O que mostra: mesma listagem, progresso `73%`, status `Processando`.
- Etapa do fluxo: execucao.
- Implicacoes backend:
  - Observado: progresso e percentual.
  - Inferencia: progresso e calculado por fonte/modulo, nao apenas por booleano pronto/nao pronto.

#### `FireShot Capture 092 - Dossie - [dossie.uplexis.com].png`
- Tipo: PNG
- O que mostra: drawer `Progresso` com numero do dossie, criterio, criacao, percentual `86%`, botao `Reprocessar`, lista por fonte com estados `Erro`, `Processando`, `Concluido`, e nota de reprocessar ate 5 vezes.
- Etapa do fluxo: monitoramento detalhado.
- Implicacoes backend:
  - Observado: progresso por fonte e oficial no produto.
  - Observado: existe reprocessamento e limite operacional.
  - Observado: fontes podem ter links/acoes individuais.
  - Inferencia: backend precisa entidade de execucao por fonte/dataset com status, tentativas, erro, timestamps, e politica de retry.

#### `FireShot Capture 093 - Dossie - [dossie.uplexis.com].png`
- Tipo: PNG
- O que mostra: modo `Detalhado`, macroareas no topo, card-resumo do dossie, area `Juridico` expandida, card detalhado para `Antecedente Criminal da Policia Federal`, bloco `Processos Judiciais` com abas `Segmento`, `Area`, `Classe`, lista de processos com statuses, comentarios finais por bloco e area de `Analise conclusiva do dossie` e `Comentarios finais` no rodape.
- Etapa do fluxo: leitura detalhada do dossie.
- Implicacoes backend:
  - Observado: detalhado e orientado a fonte/entrada, nao a modulo abstrato.
  - Observado: processos possuem subestrutura rica.
  - Observado: comentarios existem por bloco e no fechamento do dossie.
  - Inferencia: backend precisa `detailEntry` e `commentThread` por escopo.

#### `FireShot Capture 094 - Dossie - [dossie.uplexis.com].png`
- Tipo: PNG
- O que mostra: modo `Analitico`, area `Juridico` com aviso sobre diferenca entre visoes analitica e detalhada, filtros laterais, cards de metricas, grafico de status, donuts e seccoes resumidas por area/fonte.
- Etapa do fluxo: leitura analitica.
- Implicacoes backend:
  - Observado: a visao analitica usa consolidacao e deduplicacao.
  - Observado: filtros analiticos fazem parte do contrato de leitura.
  - Inferencia: backend precisa agregacoes pre-materializadas e facetas de filtro.

#### `FireShot Capture 095 - Dossie - [dossie.uplexis.com].png`
- Tipo: PNG
- O que mostra: detalhado com foco em fontes e cards abertos, inclusive comentarios finais por bloco.
- Etapa do fluxo: leitura detalhada.
- Implicacoes backend:
  - Observado: cada fonte pode ter estado aberto/fechado e area de comentario propria.
  - Inferencia: metadata de expansao/ordenacao por entrada ajuda a UX, ainda que o frontend controle abertura local.

#### `FireShot Capture 096 - Dossie - [dossie.uplexis.com].png`
- Tipo: PNG
- O que mostra: drawer lateral `Detalhe dos processos` originado da visao analitica, com tabela de processos filtrados, participacao, valor e link `Detalhes`.
- Etapa do fluxo: drill-down do analitico para lista estruturada.
- Implicacoes backend:
  - Observado: filtros analiticos levam a listagem detalhada de processos.
  - Inferencia: o backend precisa alinhar bucket analitico com o conjunto exato de processos que originou o bucket.

#### `FireShot Capture 097 - Dossie - [dossie.uplexis.com].png`
- Tipo: PNG
- O que mostra: detalhamento profundo de `Processos Judiciais`, com cada processo aberto exibindo numero, classe, tribunal, status, movimentacoes, valor, assunto, area, grau, segmento, orgao julgador, URL, participantes por polo e processos relacionados.
- Etapa do fluxo: drill-down maximo processual.
- Implicacoes backend:
  - Observado: processo judicial tem estrutura de entidade propria.
  - Observado: existem relacionamentos entre processos.
  - Inferencia: `evidenceItem` generico e insuficiente; e preciso um modelo processual estruturado ou subpayload padronizado.

#### `FireShot Capture 099 - Dossie - [dossie.uplexis.com].png`
- Tipo: PNG
- O que mostra: dossie detalhado de perfil `Recursos Humanos`, com menos macroareas ativas; areas `Juridico`, `Cadastro`, `Reguladores`, `Socioambiental`; contador de `Fontes com Resultados` e `Fontes sem Resultados`; drawer lateral de `Fontes sem Resultados`.
- Etapa do fluxo: dossie detalhado de outro preset.
- Implicacoes backend:
  - Observado: diferentes perfis ativam diferentes macroareas.
  - Observado: resultado e nao-resultado possuem drawers proprios.
  - Inferencia: schema/preset altera a taxonomia navegavel do dossie.

#### `Captura de tela 2026-04-23 192757.png`
- Tipo: PNG
- O que mostra: variacao do modo detalhado com `Historico de Dossies` no topo.
- Etapa do fluxo: navegacao complementar.
- Implicacoes backend:
  - Observado: o dossie final se conecta ao historico do sujeito/dossie.
  - Inferencia: historico de dossies deve ser tratavel como capacidade nativa do dominio.

#### `Captura de tela 2026-04-23 193615.png`
- Tipo: PNG
- O que mostra: drawer lateral `Fontes sem Resultados` listando nomes de fontes.
- Etapa do fluxo: leitura detalhada / status de fontes.
- Implicacoes backend:
  - Observado: fontes sem resultado nao desaparecem; elas podem ser listadas.
  - Inferencia: backend precisa diferenciar `sem resultado` de `nao executado` e de `indisponivel`.

#### `Captura de tela 2026-04-23 193643.png`
- Tipo: PNG
- O que mostra: drawer lateral `Fontes com Resultados`.
- Etapa do fluxo: leitura detalhada / status de fontes.
- Implicacoes backend:
  - Observado: contagem de fontes com resultado e feature de navegacao.
  - Inferencia: `sourceRows` precisam existir como entidade/projecao distinta das `detailEntries`.

## 3. Reconstrucao do Fluxo Completo do Dossie

### 3.1 Entrada no sistema

Evidencia visual observada:

- A jornada comeca na pagina `Dossies`.
- Ha filtros por periodo, responsavel e status.
- Existe CTA primario `Criar novo dossie`.

Impacto backend:

- O backend precisa um read model de lista/historico independente do objeto `case` bruto.
- Esse read model precisa suportar filtros, ordenacao e indicadores operacionais.

### 3.2 Criacao do dossie

Evidencia visual observada:

- O stepper oficial e `Perfil de consulta -> Criterios -> Tag -> Parametros`.
- Ha alternancia `Pessoa Fisica` / `Pessoa Juridica`.
- Existem perfis padronizados.
- Existe area para perfis personalizados vazia e CTA `Clique aqui para criar um novo!`.

Impacto backend:

- Criacao de caso nao pode ser tratada apenas como `productKey + subject data`.
- E necessario distinguir:
  - `product family`
  - `dossier preset`
  - `subject kind`
  - `criteria`
  - `tag`
  - `parameters`

### 3.3 Preview do perfil de consulta

Evidencia visual observada:

- O drawer lateral do perfil mostra objetivo e fontes especificas.

Impacto backend:

- Preset precisa ser entidade versionada e legivel.
- O backend deve expor preview de preset com lista de fontes, objetivos, publico e restricoes.

### 3.4 Criterios

Evidencia visual observada:

- Existe etapa de criterios com entrada por CPF/CNPJ e possibilidade de modelo/planilha.

Impacto backend:

- O caso deve armazenar criterios declarados e criterios derivados.
- O modelo de entrada deve suportar lote/importacao futura.

### 3.5 Tag

Evidencia visual observada:

- Tag e etapa separada do fluxo.

Impacto backend:

- Tag nao e detalhe cosmetico; faz parte da modelagem do dossie e do historico.

### 3.6 Parametros

Evidencia visual observada:

- Ha bloco `Processos Judiciais (Nova)`.
- Ha `Marcar automaticamente como relevantes`.
- Ha `Criar e processar Dossies automaticamente`.

Impacto backend:

- O fluxo precisa aceitar parametros por area/fonte.
- Relevancia automatica precisa virar politica persistida.
- Auto-processamento precisa ser flag de orquestracao.

### 3.7 Pos-criacao e historico

Evidencia visual observada:

- O dossie aparece imediatamente na lista.
- O status inicial pode ser `Iniciar`.
- Depois aparecem `Na fila` e `Processando`.

Impacto backend:

- Ha um ciclo de vida operacional anterior ao `DONE`.
- O backend precisa read model de fila/execucao.

### 3.8 Progresso por fonte

Evidencia visual observada:

- O drawer `Progresso` lista fontes e status individuais.
- Ha botao `Reprocessar`.
- Existe observacao sobre limite de 5 reprocessamentos.

Impacto backend:

- O backend precisa entidade de `source execution` ou ampliar `providerRequests`/`moduleRuns` para suportar:
  - status por fonte
  - tentativas
  - reprocess count
  - erro detalhado
  - timestamps
  - origem do erro

### 3.9 Entrada no dossie final

Evidencia visual observada:

- O dossie tem card-resumo no topo.
- Ha alternancia `Analitico` / `Detalhado`.
- Ha navegacao por macroareas.

Impacto backend:

- O snapshot final precisa servir duas visoes do mesmo dossie.
- O backend precisa modelo de navegacao por macroareas e entradas.

### 3.10 Visao analitica

Evidencia visual observada:

- Usa filtros, contadores, graficos, distribuicoes e listas resumidas por area/fonte.
- O proprio sistema avisa que a visao analitica usa deduplicacao.

Impacto backend:

- E preciso materializar agregacoes e facetas, nao apenas entregar evidencias cruas.

### 3.11 Visao detalhada

Evidencia visual observada:

- Cada fonte vira card detalhado com tabela, texto, PDF, listas e comentarios.

Impacto backend:

- O snapshot precisa expor `detailEntries` padronizados por tipo.

### 3.12 Drill-down processual

Evidencia visual observada:

- Existe detalhe lateral vindo do analitico.
- Existe detalhe profundo por processo no detalhado.

Impacto backend:

- Processos precisam modelo estruturado, com relacoes entre agregacao, lista e detalhe.

### 3.13 Fechamento analitico e comentario

Evidencia visual observada:

- Existem dois blocos distintos:
  - `Analise conclusiva do dossie`
  - `Comentarios finais`
- Existem acoes `Aprovar` e `Reprovar`.
- Existe opcao de enviar comentario como relevante.

Impacto backend:

- `decision`, `analysis`, `commentary` e `highlighted comment` precisam ser modelados separadamente.

## 4. Modelo Funcional do Produto

### 4.1 Modos de visualizacao

Observado:

- `Analitico`
- `Detalhado`

Inferencia:

- Ambos sao projeoes do mesmo dossie, nao produtos diferentes.

### 4.2 Tipos de dossie aparentes

Observado:

- PF
- PJ
- Perfis padronizados: `Compliance`, `Compliance Internacional`, `Financeiro`, `Investigativo`, `Juridico`, `PLD`, `Recursos Humanos`
- Perfil personalizado explicitamente previsto

Inferencia:

- O produto real tem ao menos tres eixos:
  - tipo de sujeito
  - familia comercial do dossie
  - preset/schema operacional

### 4.3 Macroareas

Observado:

- Juridico
- Midia/Internet
- Financeiro
- Cadastro
- Reguladores
- Bens e Imoveis
- Listas Restritivas
- Profissional
- Socioambiental

Inferencia:

- Macroarea e construto de navegacao acima de fonte e acima de modulo tecnico.

### 4.4 Subtipos de bloco

Observado:

- resumo do dossie
- area analitica com filtros
- cards metricos
- graficos
- seccao resumida por fonte/status
- card detalhado de fonte
- lista de processos
- detalhe expandido de processo
- comentarios finais por bloco
- analise conclusiva do dossie
- drawers laterais

### 4.5 Tipos de fonte

Observado:

- fontes judiciais
- fontes cadastrais
- fontes reguladoras
- listas restritivas
- fontes socioambientais
- fontes financeiras

Inferencia:

- o backend precisa identificar fonte, provider, dataset, area funcional, cobertura e render type.

### 4.6 Tipos de resultado/estado

Observado:

- com resultado
- nenhum resultado
- indisponivel
- aguardando revisao
- em andamento
- concluido
- erro
- iniciar
- na fila
- processando

Inferencia:

- ha dois planos de estado:
  - estado operacional do caso/fonte
  - estado de conteudo da fonte/bloco

### 4.7 Tipos de evidencia

Observado:

- tabela tabular
- texto corrido/certidao
- link PDF
- lista processual
- participantes por polo
- processos relacionados

### 4.8 Tipos de agregacao

Observado:

- total de processos
- por polo
- por status
- por tribunal
- por assunto
- por vara
- por classe

### 4.9 Acoes do usuario

Observado:

- criar dossie
- iniciar
- filtrar
- limpar filtros
- ver detalhes
- abrir drawer
- recolher/expandir
- reprocessar
- exportar
- abrir historico
- aprovar
- reprovar
- adicionar comentario
- enviar comentario relevante

### 4.10 Responsividade

Observado:

- nao houve captura mobile pura.

Inferencia:

- a composicao em abas horizontais, drawers laterais, cards expansivos e sumarios indica que a responsividade depende de prioridade semantica entre blocos.
- O backend nao precisa "fazer CSS", mas se beneficia de `render hints` para mobile/desktop.

## 5. Gap Analysis Backend Atual vs UX Observada

| Capacidade | Evidencia da UX | Backend atual | Classificacao | Lacuna / recomendacao |
| --- | --- | --- | --- | --- |
| Catalogo de produtos | Perfis padronizados e familias comerciais visiveis na criacao | `PRODUCT_CATALOG` comercial existe em `v2ProductCatalog.cjs:9` | suporta parcialmente | Falta separar produto comercial de preset/schema de dossie |
| Modulos | Fontes e areas sao compostas a partir do perfil escolhido | `PRODUCT_REGISTRY` e `resolveCaseEntitlements` em `v2Modules.cjs:253` e `:462` | ja suporta bem | Boa base, mas ainda centrada em modulo tecnico |
| Presets de dossie | Drawer de perfil mostra objetivo e fontes | Nao ha entidade de preset versionada | nao suporta | Criar `dossierPresets` com governanca, preview e versionamento |
| Schema de dossie | Macroareas, visoes e detalhamentos mudam entre perfis | `SECTION_ORDER` fixa em `v2ReportSections.cjs:22` | nao suporta | Criar `dossierSchemas` para grupos, secoes, entradas e hints |
| Customizacao PF/PJ | `Pessoa Fisica`, `Pessoa Juridica`, CTA para perfil novo | `v2CreateClientSolicitation` aceita apenas `productKey` e dados do sujeito em `index.js:5159` | nao suporta | Fluxo precisa aceitar preset, schema, tag, parametros e composicao custom |
| Agrupamento por macroarea | Abas Juridico/Cadastro/etc. | Snapshot atual monta secoes por modulo em `buildSectionsFromV2` | suporta com acoplamento ruim | Introduzir `sectionGroupKey` como eixo nativo |
| Visao analitica | Filtros, contadores, graficos, distribuicoes | `clientProjection` atual e enxuta em `v2Core.cjs:441` | nao suporta | Materializar `analyticsBlocks`, facetas e metricas |
| Visao detalhada | Cards por fonte, tabelas, PDFs, comentarios | `sections` atuais sao superficiais em `v2ReportSections.cjs:127` | suporta parcialmente | Adicionar `detailEntries` tipadas e `sourceRows` |
| Filtros analiticos | Tribunal, status, polo, UF | Nao ha contrato de facetas | nao suporta | Criar `filterMetadata` e `facetCounts` |
| Metricas e distribuicoes | bar chart e donuts | Nao ha agregacoes formais em snapshot/projection | nao suporta | Materializar series e distribuicoes por schema |
| Fontes e status por fonte | drawers e listas com/sem resultado | `providerRequests` e `moduleRuns` existem, mas nao como read model cliente por fonte | suporta parcialmente | Criar `sourceRows` ou ampliar `providerRequests` para UX |
| Detalhamento por evidencia | tabelas, texto, PDF, listas | `evidenceItems` existem, mas genericos | suporta parcialmente | Adicionar `renderType`, `detailPayload`, `sourceBlockKey` |
| Processos judiciais estruturados | lista, detalhe, polos, relacionados | `judicial` hoje e tratado como modulo + evidencias/sinais | nao suporta | Criar modelo processual ou subtipo canonicamente estruturado |
| Comentarios por secao/bloco | comentario final em cada bloco | Nao ha modelagem especifica de comentario por escopo | nao suporta | Criar `commentThreads` por dossie/grupo/secao/entry |
| Fluxo de aprovacao/reprovacao | botoes explicitos | `decision` e `reviewGate` existem em `v2ReviewGate.cjs:32` | suporta parcialmente | Falta separar aprovacao do dossie, comentarios e justificativas |
| Exportacao | acao global `Exportar` | Publicacao HTML/token existe em `materializeV2PublicationArtifacts` | suporta parcialmente | Falta `exportJob` e variantes por modo/escopo |
| Timeline | historico e operacao sugerem trilha | `buildTimelineEventsForCase` em `v2Timeline.cjs:106` | suporta parcialmente | Timeline e tecnica demais; falta semantica por area/fonte/acao do usuario |
| Versionamento de snapshot | relatorio publicado precisa ser reprodutivel | `contentHash` e token deterministico existem | ja suporta bem | Expandir para schema/preset/config hash |
| Read models | cliente consome `clientProjections`, `moduleRuns`, `evidenceItems`, etc. | subscriptions em `firestoreService.js:508` e `CaseViewPage.jsx` | suporta parcialmente | Falta read model de dossie rico e de historico operacional |
| Multi-tenant governance | perfis, limites e produtos diferem por tenant | entitlements existem | suporta parcialmente | Falta politica de composicao custom e publicacao por tenant |
| Responsividade por hints backend | UX sugere prioridade diferente por viewport | inexistente | nao suporta | Adicionar `responsiveRenderHints` no snapshot/schema |

## 6. Plano Ultra Detalhado de Refatoracao do Backend

### 6.1 Product catalog e product contracts

Problema atual:

- `PRODUCT_REGISTRY` em `v2Modules.cjs:253` conhece required/optional modules, mas nao conhece preset, schema, grupos, visoes ou configurabilidade.
- `PRODUCT_CATALOG` em `v2ProductCatalog.cjs:9` descreve nome e tier, mas nao governa montagem de dossie.

Comportamento exigido pela UX:

- Um mesmo produto comercial pode ter multiplos presets.
- PF e PJ alteram os perfis disponiveis.
- O preset possui objetivo e lista de fontes visiveis antes da criacao.

Mudancas recomendadas:

- Manter `PRODUCT_REGISTRY` como contrato tecnico de modulos.
- Introduzir camada `DOSSIER_PRODUCT_FAMILIES` ou ampliar `PRODUCT_CATALOG` com:
  - `defaultPresetKey`
  - `supportedPresetKeys`
  - `supportsCustomComposition`
  - `supportedSubjectKinds`
  - `defaultSchemaKey`
  - `allowedSchemaKeys`
  - `allowedSectionGroups`
  - `allowedParameters`
  - `supportsAutoProcess`
  - `supportsTags`

Colecoes/documentos:

- opcionalmente nenhuma colecao nova nesta camada se o catalogo continuar em codigo
- ou nova colecao `dossierProductCatalog` caso queira governanca operacional sem deploy

Risco:

- Se continuar tudo em codigo fixo, a customizacao futura vai gerar deploy para alteracoes comerciais triviais.

### 6.2 Dossier schemas e presets

Problema atual:

- Nao existe conceito formal de `dossierPreset`.
- Nao existe conceito formal de `dossierSchema`.
- `v2ReportSections.cjs:22` usa `SECTION_ORDER` fixa.

Comportamento exigido pela UX:

- Perfis como `Financeiro` e `Recursos Humanos` ligam diferentes fontes e macroareas.
- A drawer de preview de perfil precisa refletir a composicao real.
- Dossies diferentes expõem diferentes conjuntos de areas e contagens.

Mudancas recomendadas:

- Criar `dossierPresets`:
  - objetivo comercial/operacional
  - fontes previstas
  - modulos previstos
  - schema associado
  - sujeito suportado
- Criar `dossierSchemas`:
  - grupos
  - secoes
  - regras de visibilidade
  - analytics config
  - detail config
  - hints de responsividade

Colecoes/documentos:

- `dossierSchemas/{schemaKey_version}`
- `dossierPresets/{presetKey_version}`
- `tenantDossierPolicies/{tenantId}`
- opcional: `tenantDossierPresets/{tenantId_presetKey}`

Politica:

- schema estrutural criado apenas por ops/admin
- preset pode ser institucional ou tenant-specific
- cliente corporativo so compoe dentro da policy do tenant

### 6.3 Case creation flow

Problema atual:

- `v2CreateClientSolicitation` em `index.js:5159` aceita sujeito, `productKey` e alguns campos sociais/digitais.
- Nao aceita tag, preset, schema, parametros estruturados, auto-process ou composicao custom.

Comportamento exigido pela UX:

- Criacao tem stepper oficial com 4 etapas.
- Tag faz parte do fluxo.
- Parametros fazem parte do fluxo.
- Existe opcao de criar e processar automaticamente.

Mudancas recomendadas:

- Ampliar o payload de criacao para aceitar:
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

Colecoes/documentos:

- `cases` deve persistir configuracao resolvida e configuracao declarada
- opcional `caseConfigurations/{caseId}` se quiser isolar payload de criacao

Validacoes:

- PF nao deve aceitar schema PJ puro
- PJ nao deve aceitar schema PF puro
- fontes/modulos fora da policy do tenant devem ser barrados
- campos obrigatorios variam por preset/schema

### 6.4 Module resolution

Problema atual:

- `resolveCaseEntitlements` e `buildModuleRunsForCase` resolvem modulos, mas ignoram grupos, secoes, fontes de UX e preset/schema.

Comportamento exigido pela UX:

- Fonte visivel nao e igual a modulo tecnico.
- Uma macroarea pode agregar multiplos modulos e multiplas fontes.
- Um preset pode esconder ou exibir partes do mesmo modulo em lugares diferentes.

Mudancas recomendadas:

- Estender `moduleRuns` com:
  - `sectionGroupKey`
  - `sectionKey`
  - `sourceRowKeys`
  - `displayOrder`
  - `uiVisibility`
  - `responsivePriority`
  - `emptyStatePolicy`
  - `presetContribution`
- Resolver modulos por:
  - produto
  - preset
  - schema
  - policy do tenant
  - parametros do caso

### 6.5 Evidence and source modeling

Problema atual:

- `PROVIDER_SOURCE_SPECS` em `v2OperationalArtifactBuilder.cjs:5` cobre provedores principais, mas ainda em taxonomia muito tecnica.
- `evidenceItems` hoje sao uteis, mas nao capturam bem a visao de fonte/bloco.

Comportamento exigido pela UX:

- O usuario navega por fonte e por resultado, nao por modulo interno.
- Existe lista de fontes com resultado e sem resultado.
- Fonte tem status, contagem, CTA e detalhe.

Mudancas recomendadas:

- Introduzir `sourceRows` como read model ou enriquecer `providerRequests`/`evidenceItems` com:
  - `sourceKey`
  - `sourceDisplayName`
  - `sectionGroupKey`
  - `sectionKey`
  - `sourceStatus`
  - `resultState`
  - `resultCount`
  - `hasDetail`
  - `detailEntryKeys`
  - `emptyReasonCode`
- Enriquecer `evidenceItems` com:
  - `renderType`
  - `detailPayload`
  - `detailPayloadRef`
  - `sourceBlockKey`
  - `desktopSummary`
  - `mobileSummary`
  - `isPrimaryForSource`

### 6.6 Analytical aggregations

Problema atual:

- O backend atual nao materializa filtros e distribuicoes da visao analitica.

Comportamento exigido pela UX:

- Filtros laterais.
- Cards metricos.
- Graficos por status, tribunal, assunto, vara e classe.
- Drill-down coerente entre agregacao e lista.

Mudancas recomendadas:

- Criar bloco `analyticsBlocks` no snapshot:
  - `metrics`
  - `series`
  - `distributions`
  - `facets`
  - `drilldowns`
- Cada bloco deve carregar:
  - `aggregationKey`
  - `groupBy`
  - `filterDependencies`
  - `bucketIds`
  - `total`
  - `supportsDrawer`

Materializacao:

- gerar na publicacao
- opcionalmente gerar tambem em processamento operacional quando a UX precisar de pre-visualizacao

### 6.7 Detail entry modeling

Problema atual:

- `sections` atuais em `v2ReportSections.cjs:127` carregam contagem e ids, mas nao o tipo de entrada a renderizar.

Comportamento exigido pela UX:

- Cards detalhados podem conter tabela, texto, PDF, lista de processos, comentario e acoes.

Mudancas recomendadas:

- Criar `detailEntries` com tipos canonicos:
  - `table`
  - `paragraph`
  - `process_list`
  - `process_detail`
  - `document_link`
  - `mixed`
- Cada entrada deve conter:
  - `entryKey`
  - `sectionGroupKey`
  - `sectionKey`
  - `sourceKey`
  - `title`
  - `subtitle`
  - `status`
  - `entryType`
  - `payload`
  - `payloadRef`
  - `supportsComments`
  - `supportsHighlight`

### 6.8 Judicial process modeling

Problema atual:

- O modulo `judicial` detecta findings, mas nao representa processo como entidade de primeiro nivel.

Comportamento exigido pela UX:

- Processo tem identificador, classe, tribunal, status, assunto, area, grau, segmento, orgao julgador, partes, valor, movimentacoes e relacionados.

Mudancas recomendadas:

- Criar modelo processual canonico:
  - `judicialProcesses`
  - ou `detailEntries.processItems[]` com schema rigido
- Estruturar:
  - identidade do processo
  - classificacoes
  - estado processual
  - participantes por polo
  - referencias de origem
  - processos relacionados
  - fatos/flags derivados para analytics

### 6.9 Comments and decision workflow

Problema atual:

- `decision` existe e `reviewGate` existe, mas comentarios por escopo nao.
- `Analise conclusiva` e `Comentarios finais` ainda nao sao entidades separadas.

Comportamento exigido pela UX:

- comentario por bloco
- comentario final do dossie
- comentario relevante
- aprovacao/reprovacao do dossie

Mudancas recomendadas:

- Criar `commentThreads` com `scopeType`:
  - `dossier`
  - `sectionGroup`
  - `section`
  - `detailEntry`
- Criar `approvalState` separado de `decision` analitica automatica, contendo:
  - `approvalStatus`
  - `approvedBy`
  - `rejectedBy`
  - `approvedAt`
  - `rejectedAt`
  - `approvalReason`
  - `requiredReviewLevel`

### 6.10 Report snapshots

Problema atual:

- `buildReportSnapshotFromV2` em `v2ReportSections.cjs:324` gera snapshot com `sections` e `sectionContributions`, mas sem grupos, analytics, entries, comments, source rows ou render hints.

Comportamento exigido pela UX:

- Um snapshot unico deve servir visao analitica e detalhada.

Mudancas recomendadas:

- Expandir `reportSnapshots` para incluir:
  - `dossierSchemaKey`
  - `dossierPresetKey`
  - `configurationHash`
  - `headerContext`
  - `sectionGroups`
  - `sourceRows`
  - `detailEntries`
  - `analyticsBlocks`
  - `navigationModel`
  - `commentSummary`
  - `responsiveRenderHints`

### 6.11 Client projections

Problema atual:

- `buildClientProjectionContract` em `v2Core.cjs:441` entrega dados comerciais e resumo simples.
- Isso serve lista/abertura basica, mas nao a UX de dossie observada.

Comportamento exigido pela UX:

- Lista de dossies precisa progresso, estados operacionais e colunas ricas.
- Tela do cliente precisa resumo do dossie, disponibilidade de modos e status de fontes.

Mudancas recomendadas:

- Ampliar `clientProjections` com duas camadas:
  - `listProjection`
  - `dossierProjection`
- Campos recomendados:
  - `lifecycleStatus`
  - `progressPercent`
  - `sourceExecutionSummary`
  - `sourceResultSummary`
  - `availableModes`
  - `activeSectionGroups`
  - `reportAvailability`

### 6.12 Export/publication

Problema atual:

- `materializeV2PublicationArtifacts` publica HTML e link publico, mas exportacao na UX e mais ampla como acao do usuario.

Comportamento exigido pela UX:

- Export pode existir a partir da tela final e possivelmente com contexto de visao.

Mudancas recomendadas:

- Criar `exportJobs`:
  - `scope`: `full_dossier`, `analytics_view`, `detail_section`, `process_list`
  - `format`: `pdf`, `xlsx`, `csv`, `json`
  - `requestedBy`
  - `status`
  - `artifactRef`

### 6.13 Multi-tenant governance

Problema atual:

- Entitlements existem, mas o tenant ainda nao governa composicao de dossie.

Comportamento exigido pela UX:

- Nao e razoavel liberar qualquer composicao para qualquer tenant.

Mudancas recomendadas:

- `tenantDossierPolicies` com:
  - presets permitidos
  - modulos permitidos
  - sectionGroups permitidos
  - export scopes permitidos
  - autoProcess permitido
  - maxReprocessCount

### 6.14 Security rules

Problema atual:

- Regras atuais em `firestore.rules:117-204` ja protegem bem `rawSnapshots` e `providerRecords`.
- Entretanto, novas entidades de schema/preset/comentario/export ainda nao existem.

Mudancas recomendadas:

- `dossierSchemas`: leitura ops/admin; leitura cliente apenas de schemas publicados e permitidos
- `dossierPresets`: leitura tenant/client conforme policy
- `commentThreads`: leitura por tenant/role e escrita apenas via callable
- `exportJobs`: leitura por solicitante e ops

### 6.15 Versioning and backward compatibility

Problema atual:

- Ha versionamento em `V2_*_VERSION`, `contentHash` e token deterministico.

Mudancas recomendadas:

- Adicionar `schemaVersion`, `presetVersion`, `configurationHash` e `renderContractVersion`.
- Fazer dual-write transicional:
  - manter campos legados
  - adicionar novos campos
  - migrar leitores aos poucos

## 7. Modelo de Dados Recomendado

### `dossierSchema`

- `schemaKey`: identificador estavel
- `version`: versao imutavel
- `displayName`: nome operacional
- `subjectKind`: `pf`, `pj`, `mixed`
- `supportedViewModes`: `analitico`, `detalhado`
- `sectionGroups`: definicoes de macroareas
- `sections`: definicoes de secoes
- `analyticsConfig`: agregacoes previstas
- `detailConfig`: tipos de entrada por secao
- `responsiveRenderHints`: prioridade e comportamento por viewport
- `status`: `draft`, `published`, `deprecated`

### `dossierPreset`

- `presetKey`
- `version`
- `displayName`
- `audience`: `ops_internal`, `client_corporate`, `both`
- `subjectKind`
- `objective`
- `defaultSchemaKey`
- `sourcePreview`
- `moduleKeys`
- `lockedModuleKeys`
- `parameterDefaults`
- `taggingPolicy`
- `autoProcessDefault`

### `customDossierConfig`

- `caseId`
- `configurationSource`
- `requestedModuleKeys`
- `effectiveModuleKeys`
- `requestedSectionGroupKeys`
- `effectiveSectionGroupKeys`
- `requestedSourceKeys`
- `searchParameters`
- `tagIds`
- `autoMarkRelevant`
- `autoProcess`
- `configurationHash`

### `sectionGroup`

- `groupKey`
- `label`
- `iconKey`
- `displayOrder`
- `analyticsEnabled`
- `detailsEnabled`
- `sourceCount`
- `resultCount`
- `emptyStatePolicy`

### `section`

- `sectionKey`
- `groupKey`
- `label`
- `displayOrder`
- `moduleKeys`
- `sourceKeys`
- `entryKeys`
- `renderMode`
- `collapsedByDefault`
- `visibleWhenEmpty`

### `sourceRow`

- `sourceKey`
- `sourceDisplayName`
- `provider`
- `dataset`
- `groupKey`
- `sectionKey`
- `status`
- `resultState`
- `resultCount`
- `detailEntryKeys`
- `supportsRetry`
- `supportsExport`

### `detailEntry`

- `entryKey`
- `groupKey`
- `sectionKey`
- `sourceKey`
- `title`
- `subtitle`
- `status`
- `entryType`
- `payload`
- `payloadRef`
- `commentThreadId`
- `highlightState`
- `responsivePriority`

### `analyticsBlock`

- `blockKey`
- `groupKey`
- `label`
- `chartType`
- `metricType`
- `bucketDefinitions`
- `bucketRows`
- `facetDependencies`
- `drilldownTarget`

### `commentThread`

- `threadId`
- `scopeType`
- `scopeId`
- `caseId`
- `tenantId`
- `entries`
- `highlightedEntryId`
- `visibility`
- `lastUpdatedAt`

### `approvalState`

- `caseId`
- `approvalStatus`
- `reviewLevel`
- `requiresSenior`
- `approvedBy`
- `rejectedBy`
- `approvedAt`
- `rejectedAt`
- `reason`

### `exportJob`

- `jobId`
- `caseId`
- `scope`
- `format`
- `status`
- `requestedBy`
- `requestedAt`
- `completedAt`
- `artifactRef`

### `responsiveRenderHints`

- `mobilePriority`
- `desktopDefaultExpanded`
- `hideOnSmallScreens`
- `mobileCardFields`
- `preferredDrawerBehavior`
- `supportsCompactSummary`

## 8. Estrategia de Migracao

### Principios

- nao quebrar subscriptions atuais
- preservar `clientProjections` e `reportSnapshots`
- adicionar campos antes de substituir consumidores

### Fase recomendada

1. Introduzir schemas/presets/policies sem mudar leitura atual.
2. Ampliar payload de criacao com campos opcionais.
3. Enriquecer `moduleRuns`, `evidenceItems`, `providerRequests`.
4. Materializar `sourceRows`, `detailEntries`, `analyticsBlocks`.
5. Expandir `reportSnapshots`.
6. Expandir `clientProjections`.
7. Migrar clientes gradualmente para o novo contrato.

### Convivencia com legado

- manter `moduleKeys`, `sections`, `riskSummary`, `keyFindings`
- adicionar novos campos paralelos
- usar `renderContractVersion`

### Reemissao de snapshots

- snapshots publicados devem referenciar a configuracao original
- novos snapshots usam novo schema/preset/config hash
- reemissao deve ser explicita, nunca implicita por alteracao de schema

### Validacao de consistencia

- `configurationHash` do caso deve casar com snapshot
- `reportSnapshot.reportModuleKeys` deve casar com `effectiveModuleKeys`
- `sourceRows` devem referenciar `detailEntries` existentes
- agregacoes devem apontar para ids reais de processos/evidencias

## 9. Plano de Testes

### Dominio

- preset PF resolve schema PF correto
- preset PJ resolve schema PJ correto
- custom PF nao aceita grupo PJ proibido
- policy do tenant bloqueia combinacoes indevidas

### Materializacao

- `moduleRuns` recebem `sectionGroupKey`/`sectionKey`
- `sourceRows` saem com status coerente
- `detailEntries` saem tipados corretamente
- `analyticsBlocks` refletem o mesmo conjunto de processos do detalhamento

### Compatibilidade

- leitor legado continua operando sem novos campos
- snapshot antigo permanece valido
- token publico existente continua resolvendo relatorio anterior

### Autorizacao

- cliente nao le `rawSnapshots` nem `providerRecords`
- cliente so le preset/schema autorizado ao tenant
- comentario de tenant A nao vaza para tenant B

### PF/PJ/custom

- criacao PF com preset PJ falha
- criacao PJ com preset PF falha
- caso custom preserva `configurationHash`

### Analitico/detalhado

- analytics e details apontam para a mesma base de evidencias
- bucket do analitico abre o conjunto correto de processos

### Responsividade guiada por metadata

- `responsiveRenderHints` existem em snapshot
- entradas com `mobileCardFields` geram fallback compacto
- grupos de baixa prioridade podem ser colapsados sem perda de ids navegaveis

## 10. Assuncoes e Inferencias

### Alta confianca

- Existe fluxo de criacao por etapas.
- Existem perfis padronizados e espaco para perfis personalizados.
- PF/PJ sao eixos centrais.
- O produto diferencia visao analitica de detalhada.
- O dossie e organizado por macroareas.
- Existe progresso por fonte com reprocessamento.
- Existem comentarios e aprovacao/reprovacao.

### Media confianca

- Preset comercial e diferente de produto tecnico.
- Processos precisam entidade estruturada propria para escalar a UX.
- Responsividade vai exigir hints de backend para reduzir complexidade do frontend.

### Baixa confianca

- O produto pode suportar composicao 100% self-service pelo cliente final; a UX indica isso, mas nao prova o grau de autonomia.
- Pode haver mais estados operacionais internos alem dos observados.

## Decisoes Arquiteturais Recomendadas

- Separar definitivamente `produto`, `preset` e `schema`.
- Fazer o dossie ser schema-driven no backend, nao apenas no frontend.
- Materializar duas visoes do mesmo dossie: `analytics` e `details`.
- Introduzir `sourceRows` e `detailEntries` como contratos formais.
- Criar modelo processual estruturado para `Processos Judiciais`.
- Tratar comentarios e aprovacao como dominios separados.
- Versionar snapshot por `schemaVersion`, `presetVersion` e `configurationHash`.

## Riscos se nada for refatorado

- Cada novo dossie custom PF/PJ vai virar excecao hardcoded.
- A UI futura vai depender de logica excessiva no frontend para compensar a falta de contrato backend.
- Filtros, graficos e drawers laterais ficarao inconsistentes entre si.
- A experiencia de progresso por fonte continuara desconectada do resto do dominio.
- O detalhamento processual pode virar payload ad hoc dificil de validar e testar.
- `clientProjections` continuarao pobres para a UX desejada.

## Ordem ideal de execucao do refactor

1. Definir `dossierSchemas`, `dossierPresets` e `tenantDossierPolicies`.
2. Expandir `v2CreateClientSolicitation` para aceitar preset/schema/tag/parametros.
3. Enriquecer `moduleRuns`, `providerRequests`, `evidenceItems` e `riskSignals`.
4. Introduzir modelo estruturado de `sourceRows`, `detailEntries` e processos judiciais.
5. Materializar `analyticsBlocks` e `filterMetadata`.
6. Expandir `reportSnapshots`.
7. Expandir `clientProjections` e read models de historico/progresso.
8. Fechar regras de seguranca e testes de compatibilidade.
