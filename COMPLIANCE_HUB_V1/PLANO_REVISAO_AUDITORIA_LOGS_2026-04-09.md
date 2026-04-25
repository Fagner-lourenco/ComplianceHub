# Plano Detalhado de Revisao de Auditoria e Logs

## Escopo
Este documento converte o diagnostico do modulo de Auditoria e Logs em backlog tecnico executavel para os dois lados do sistema:
- portal operacional com trilha completa, estruturada e investigavel;
- portal do cliente com trilha propria, util para governanca da tenant e rigidamente isolada.

Base de evidencia usada:
- leitura da pagina atual em [src/portals/ops/AuditoriaPage.jsx](/d:/ComplianceHub/src/portals/ops/AuditoriaPage.jsx);
- leitura do hook em [src/hooks/useAuditLogs.js](/d:/ComplianceHub/src/hooks/useAuditLogs.js);
- leitura dos servicos em [src/core/firebase/firestoreService.js](/d:/ComplianceHub/src/core/firebase/firestoreService.js);
- leitura de regras em [firestore.rules](/d:/ComplianceHub/firestore.rules);
- leitura de RBAC e rotas em [src/core/rbac/permissions.js](/d:/ComplianceHub/src/core/rbac/permissions.js), [src/App.jsx](/d:/ComplianceHub/src/App.jsx) e [src/ui/layouts/Sidebar.jsx](/d:/ComplianceHub/src/ui/layouts/Sidebar.jsx);
- leitura da entrega publica de relatorios em [src/pages/PublicReportPage.jsx](/d:/ComplianceHub/src/pages/PublicReportPage.jsx);
- mapeamento de todas as escritas atuais em [functions/index.js](/d:/ComplianceHub/functions/index.js).

Objetivo:
- parar de tratar auditoria como tabela generica de texto truncado;
- separar trilha operacional profunda de trilha client-safe;
- normalizar modelagem de evento, filtros, descricoes e rastreabilidade;
- cobrir eventos relevantes de negocio hoje ausentes;
- garantir isolamento multi-tenant no backend e no frontend.

## Guardrails de implementacao
- Nao expor `auditLogs` bruto para perfis cliente.
- Nao confiar em filtro frontend para isolamento de tenant.
- Nao quebrar o desktop atual enquanto a nova experiencia nao estiver pronta.
- Nao misturar logs internos sensiveis com eventos de governanca do cliente.
- Nao usar `detail` como deposito de `JSON.stringify(...)`.
- Nao reaproveitar `target` como campo generico para tudo no schema novo.
- Toda escrita nova de auditoria deve sair de helper central.
- Toda tela nova deve fechar com `loading`, `empty`, `error` e `success`.
- Toda alteracao de seguranca deve ser validada com teste negativo de tenant cruzada.

## Escala de prioridade, risco e impacto

### Prioridade
- `P0`: bloqueia seguranca, rastreabilidade ou utilidade pratica da trilha.
- `P1`: melhora fortemente investigacao, governanca e leitura.
- `P2`: refinamento, historico legado, performance e polimento.

### Risco
- `Baixo`: ajuste localizado de UI, formatter ou permissao ja esperada.
- `Medio`: altera consultas, rotas, RBAC ou pontos recorrentes de escrita.
- `Alto`: muda schema, centraliza auditoria, cria nova projecao ou altera entrega de link publico.

### Impacto no fluxo
- `Baixo`: ganho incremental de legibilidade.
- `Medio`: melhora investigacao ou governanca, mas havia alternativa manual.
- `Alto`: reduz ruido e permite responder perguntas operacionais reais.
- `Critico`: sem a correcao, o modulo continua inseguro, incompleto ou praticamente inutil.

## Matriz consolidada de problemas

### AUD-PRB-001 - Escrita de logs espalhada e inconsistente
**Estado atual:** ha pelo menos 21 pontos em [functions/index.js](/d:/ComplianceHub/functions/index.js) escrevendo direto em `auditLogs`.  
**Problema real:** cada ponto monta seu proprio payload, com variacao de campos, resumo e detalhe.  
**Impacto:** drift de schema, filtros ruins, campos faltantes e historico dificil de evoluir.  
**Prioridade:** `P0`  
**Risco:** `Alto`  
**Backlog associado:** `AUD-010`, `AUD-011`, `AUD-020` a `AUD-024`

### AUD-PRB-002 - Schema atual e pobre para o volume de casos de uso
**Estado atual:** o schema efetivo gira em torno de `tenantId`, `userId`, `userEmail`, `action`, `target`, `detail`, `ip`, `timestamp`.  
**Problema real:** nao existem `level`, `category`, `actorType`, `entityType`, `source`, `audience`, `related`, `summary` estruturado nem `clientVisible`.  
**Impacto:** nao ha como filtrar, renderizar ou separar trilhas com qualidade.  
**Prioridade:** `P0`  
**Risco:** `Alto`  
**Backlog associado:** `AUD-010`, `AUD-011`, `AUD-012`

### AUD-PRB-003 - Inconsistencia entre backend e UI para o campo de usuario
**Estado atual:** o backend grava `userEmail`; a tela atual usa `log.user`.  
**Problema real:** busca e coluna de usuario ficam inconsistentes e parte da leitura quebra.  
**Impacto:** perda de confianca no modulo e busca parcial.  
**Prioridade:** `P0`  
**Risco:** `Baixo-Medio`  
**Backlog associado:** `AUD-030`, `AUD-031`, `AUD-060`

### AUD-PRB-004 - `target` esta sobrecarregado e perde rastreabilidade
**Estado atual:** `target` recebe ora `caseId`, ora token de relatorio, ora `uid`, ora `tenantId`, ora string composta.  
**Problema real:** o mesmo campo tenta representar entidades diferentes sem tipagem.  
**Impacto:** timeline por caso falha, filtro por alvo nao e confiavel e correlacao entre eventos e entidade fica fraca.  
**Prioridade:** `P0`  
**Risco:** `Alto`  
**Backlog associado:** `AUD-011`, `AUD-024`, `AUD-034`, `AUD-060`

### AUD-PRB-005 - `detail` mistura resumo humano com payload tecnico cru
**Estado atual:** varios eventos usam `detail` com strings curtas; outros usam `JSON.stringify(...)`.  
**Problema real:** o mesmo campo tenta ser resumo e payload ao mesmo tempo.  
**Impacto:** detalhe ruim, truncamento excessivo, UX confusa e risco de vazar informacao sensivel na UI errada.  
**Prioridade:** `P0`  
**Risco:** `Medio-Alto`  
**Backlog associado:** `AUD-011`, `AUD-012`, `AUD-032`, `AUD-043`

### AUD-PRB-006 - A pagina operacional mistura negocio, sistema e IA sem hierarquia
**Estado atual:** a tela de auditoria lista tudo numa tabela unica com filtro raso por `acao`.  
**Problema real:** nao ha distincao entre evento humano, evento automatico, erro, processamento, tenant, seguranca ou evento client-safe.  
**Impacto:** investigacao fica lenta e o ruido ocupa o mesmo peso visual do sinal.  
**Prioridade:** `P0`  
**Risco:** `Medio`  
**Backlog associado:** `AUD-031`, `AUD-032`, `AUD-033`

### AUD-PRB-007 - A consulta atual nao e pensada para trilha investigativa
**Estado atual:** `useAuditLogs` assina a colecao generica e filtra no cliente; `buildTenantCollectionQuery` usa limite padrao.  
**Problema real:** pagina nao tem paginacao investigativa, filtros server-side nem escopo por categoria/periodo.  
**Impacto:** volume real degrada utilidade e pode esconder eventos relevantes fora do lote consultado.  
**Prioridade:** `P1`  
**Risco:** `Medio`  
**Backlog associado:** `AUD-013`, `AUD-030`, `AUD-031`, `AUD-061`

### AUD-PRB-008 - Timeline de caso nao representa a trilha real do caso
**Estado atual:** [firestoreService.js](/d:/ComplianceHub/src/core/firebase/firestoreService.js) usa `where('target', '==', caseId)` em `subscribeToCaseAuditLogs`.  
**Problema real:** varios eventos ligados ao caso usam outros alvos e nao entram na timeline.  
**Impacto:** caso parece ter menos historico do que realmente teve.  
**Prioridade:** `P1`  
**Risco:** `Medio`  
**Backlog associado:** `AUD-024`, `AUD-034`, `AUD-060`

### AUD-PRB-009 - O portal cliente nao tem auditoria propria
**Estado atual:** nao ha rota, pagina, menu nem permissao propria para auditoria do cliente.  
**Problema real:** o gestor da franquia nao consegue governar o que seu time fez.  
**Impacto:** cliente depende do ops para responder perguntas basicas de governanca.  
**Prioridade:** `P0`  
**Risco:** `Medio-Alto`  
**Backlog associado:** `AUD-040`, `AUD-041`, `AUD-042`, `AUD-043`

### AUD-PRB-010 - Regras atuais bloqueiam cliente, mas nao existe projecao segura alternativa
**Estado atual:** [firestore.rules](/d:/ComplianceHub/firestore.rules) permite leitura de `auditLogs` apenas para analistas.  
**Problema real:** isso esta correto para seguranca, mas nao ha colecao/projecao client-safe.  
**Impacto:** cliente continua sem trilha e qualquer tentativa rapida de liberar leitura seria insegura.  
**Prioridade:** `P0`  
**Risco:** `Alto`  
**Backlog associado:** `AUD-012`, `AUD-040`, `AUD-041`, `AUD-061`

### AUD-PRB-011 - Abertura de relatorio publico nao e auditavel com confiabilidade
**Estado atual:** [PublicReportPage.jsx](/d:/ComplianceHub/src/pages/PublicReportPage.jsx) busca o documento direto do Firestore por token.  
**Problema real:** o backend nao participa da leitura, entao nao grava acesso.  
**Impacto:** nao e possivel responder de forma confiavel quem/quando abriu um relatorio publico.  
**Prioridade:** `P1`  
**Risco:** `Alto`  
**Backlog associado:** `AUD-050`, `AUD-051`

### AUD-PRB-012 - Exportacao so registra criacao, nao consumo real
**Estado atual:** existe `EXPORT_CREATED`, mas nao ha evento confiavel de `download` ou `open`.  
**Problema real:** governanca de exportacoes fica pela metade.  
**Impacto:** o cliente enxerga que uma exportacao foi gerada, mas nao se ela foi consumida.  
**Prioridade:** `P2`  
**Risco:** `Medio-Alto`  
**Backlog associado:** `AUD-052`

### AUD-PRB-013 - Catalogo atual de acoes da UI cobre so parte dos eventos reais
**Estado atual:** [AuditoriaPage.jsx](/d:/ComplianceHub/src/portals/ops/AuditoriaPage.jsx) so reconhece uma parcela pequena das actions persistidas.  
**Problema real:** filtro e badges ignoram eventos reais de IA, tenant, relatorio e processamento.  
**Impacto:** modulo parece arbitrario e incompleto.  
**Prioridade:** `P1`  
**Risco:** `Baixo-Medio`  
**Backlog associado:** `AUD-031`, `AUD-033`

### AUD-PRB-014 - Nao existe estrategia de backfill para historico legado
**Estado atual:** mesmo que o schema novo seja criado, historico antigo continuara fraco.  
**Problema real:** a UI nova ficaria inconsistente entre eventos recentes e antigos.  
**Impacto:** baixa confianca e experencia quebrada na transicao.  
**Prioridade:** `P1`  
**Risco:** `Medio`  
**Backlog associado:** `AUD-060`, `AUD-062`

## Inventario do estado atual

### Acoes atualmente persistidas em `auditLogs`
- `AI_ANALYSIS_RUN`
- `AI_DECISION_SET`
- `AI_HOMONYM_ANALYSIS_RUN`
- `AI_RERUN`
- `CASE_ASSIGNED`
- `CASE_CONCLUDED`
- `CASE_CORRECTED`
- `CASE_DRAFT_SAVED`
- `CASE_RETURNED`
- `CLIENT_PUBLIC_REPORT_CREATED`
- `CLIENT_PUBLIC_REPORT_REVOKED`
- `ENRICHMENT_PHASE_RERUN`
- `EXPORT_CREATED`
- `OWN_PROFILE_UPDATED`
- `PUBLIC_REPORT_CREATED`
- `PUBLIC_REPORT_REVOKED`
- `SOLICITATION_CREATED`
- `TENANT_CONFIG_UPDATED`
- `TENANT_USER_CREATED`
- `TENANT_USER_UPDATED`
- `USER_CREATED`

### Superficies afetadas hoje
- UI ops: [src/portals/ops/AuditoriaPage.jsx](/d:/ComplianceHub/src/portals/ops/AuditoriaPage.jsx)
- timeline do caso: [src/portals/ops/CasoPage.jsx](/d:/ComplianceHub/src/portals/ops/CasoPage.jsx)
- hook atual: [src/hooks/useAuditLogs.js](/d:/ComplianceHub/src/hooks/useAuditLogs.js)
- servico de consulta: [src/core/firebase/firestoreService.js](/d:/ComplianceHub/src/core/firebase/firestoreService.js)
- regras: [firestore.rules](/d:/ComplianceHub/firestore.rules)
- RBAC: [src/core/rbac/permissions.js](/d:/ComplianceHub/src/core/rbac/permissions.js)
- rotas/menu: [src/App.jsx](/d:/ComplianceHub/src/App.jsx), [src/ui/layouts/Sidebar.jsx](/d:/ComplianceHub/src/ui/layouts/Sidebar.jsx)
- relatorio publico: [src/pages/PublicReportPage.jsx](/d:/ComplianceHub/src/pages/PublicReportPage.jsx)

## Arquitetura alvo

### Separacao de trilhas
- `auditLogs`: trilha completa, bruta, estruturada, imutavel e exclusiva do ops.
- `tenantAuditLogs`: projecao sanitizada, limitada a eventos `clientVisible`, lida apenas por tenant correspondente.

### Schema v2 proposto para `auditLogs`
- `eventId`
- `occurredAt`
- `tenantId`
- `level`
- `category`
- `action`
- `audience`
- `source`
- `actor.type`
- `actor.id`
- `actor.email`
- `actor.displayName`
- `entity.type`
- `entity.id`
- `entity.label`
- `related.caseId`
- `related.reportToken`
- `related.exportId`
- `related.userId`
- `summary`
- `detail`
- `metadata`
- `clientVisible`
- `clientSummary`
- `clientMetadata`
- `searchText`
- `ipMasked`

### Schema v2 proposto para `tenantAuditLogs`
- `eventId`
- `occurredAt`
- `tenantId`
- `category`
- `action`
- `source`
- `actor.displayName`
- `actor.email`
- `actor.type`
- `entity.type`
- `entity.id`
- `entity.label`
- `related.caseId`
- `related.reportToken`
- `related.exportId`
- `summary`
- `detail`
- `metadata`
- `searchText`

### Taxonomia proposta

#### Niveis
- `AUDIT`
- `INFO`
- `WARNING`
- `ERROR`
- `SYSTEM`
- `SECURITY`

#### Categorias
- `CASE`
- `REPORT_PUBLIC`
- `EXPORT`
- `TENANT_ADMIN`
- `PROFILE`
- `SETTINGS`
- `PROCESSING`
- `AI`
- `INTEGRATION`
- `SECURITY`

#### Tipos de ator
- `OPS_USER`
- `CLIENT_USER`
- `SYSTEM`
- `PUBLIC_LINK`

#### Tipos de entidade
- `CASE`
- `REPORT_PUBLIC`
- `EXPORT`
- `USER`
- `TENANT`
- `PROFILE`
- `SETTINGS`

#### Fontes
- `portal_ops`
- `portal_client`
- `cloud_function`
- `public_report`
- `system`

## Mapa de visibilidade ops x cliente

### Eventos visiveis ao cliente
- `SOLICITATION_CREATED`
- `CASE_RETURNED`
- `CASE_CORRECTED`
- `CASE_CONCLUDED`
- `EXPORT_CREATED`
- `PUBLIC_REPORT_CREATED`
- `PUBLIC_REPORT_REVOKED`
- `CLIENT_PUBLIC_REPORT_CREATED`
- `CLIENT_PUBLIC_REPORT_REVOKED`
- `TENANT_USER_CREATED`
- `TENANT_USER_UPDATED`
- `OWN_PROFILE_UPDATED`
- `TENANT_CONFIG_UPDATED` apenas quando o delta for visivel e relevante para a franquia
- novos eventos `PUBLIC_REPORT_VIEWED`, `PUBLIC_REPORT_LINK_COPIED`, `EXPORT_DOWNLOADED` quando a arquitetura suportar

### Eventos exclusivos do ops
- `AI_ANALYSIS_RUN`
- `AI_HOMONYM_ANALYSIS_RUN`
- `AI_RERUN`
- `AI_DECISION_SET`
- `ENRICHMENT_PHASE_RERUN`
- `CASE_DRAFT_SAVED`
- falhas tecnicas de provider, pipeline, prompts, custos internos, callbacks e detalhes metodologicos

## Estrategia de implementacao sem regressao
- Nao reescrever tudo numa unica PR.
- Primeiro normalizar escrita e schema; depois migrar UI.
- O cliente so entra depois que a projecao sanitizada estiver pronta.
- O acesso publico ao relatorio so deve ser alterado quando houver plano claro de retrocompatibilidade com tokens existentes.
- O historico legado deve ser tratado com backfill e fallback de formatter, nunca com quebra brusca.
- Regras de seguranca e RBAC entram junto com a projecao client-safe, nao antes.

## Mapa de dependencias
- `AUD-000` e `AUD-001` abrem o trabalho.
- `AUD-010` depende de `AUD-000`.
- `AUD-011` depende de `AUD-010`.
- `AUD-012` depende de `AUD-011`.
- `AUD-013` depende de `AUD-011`.
- `AUD-020` a `AUD-024` dependem de `AUD-011`.
- `AUD-030` depende de `AUD-013`.
- `AUD-031`, `AUD-032`, `AUD-033` dependem de `AUD-030`.
- `AUD-034` depende de `AUD-024` e `AUD-030`.
- `AUD-040` depende de `AUD-012` e `AUD-061`.
- `AUD-041` depende de `AUD-040`.
- `AUD-042` e `AUD-043` dependem de `AUD-041`.
- `AUD-050` depende de `AUD-011` e exige alinhamento de produto sobre tracking de abertura publica.
- `AUD-051` depende de `AUD-050`.
- `AUD-052` depende de `AUD-011`.
- `AUD-060` depende de schema v2 definido e formatters prontos.
- `AUD-061` acompanha `AUD-012`, `AUD-040` e `AUD-041`.
- `AUD-062` e `AUD-063` fecham o rollout.

## Ordem recomendada
1. Baseline e catalogo de eventos
2. Helper central e schema v2
3. Projecao client-safe e regras
4. Migracao das escritas atuais
5. UI operacional estruturada
6. Nova auditoria do cliente
7. Cobertura de eventos hoje ausentes
8. Backfill, testes negativos e rollout

## Definition of Done global
- toda escrita nova passa por helper central de auditoria;
- `auditLogs` bruto continua ops-only;
- cliente le somente `tenantAuditLogs` ou endpoint equivalente, sempre tenant-scoped;
- a tela ops responde quem, o que, quando, onde, em qual tenant e com qual contexto;
- a tela cliente responde quem criou, alterou, exportou, abriu, compartilhou ou desativou algo relevante da sua tenant;
- nenhum dado de IA, prompts, provider ou metodologia interna vaza para cliente;
- timeline de caso usa relacoes estruturadas, nao apenas `target`;
- historico legado continua legivel durante a transicao.

---

## Fase 0 - Baseline e diagnostico executavel

### AUD-000 - Congelar baseline do modulo atual
**Prioridade:** `P0`  
**Arquivos alvo:**  
- `results/real-mobile-audit-2026-04-09/*`
- opcionalmente `tests/` ou `scripts/`

**Problema:** sem baseline, a refatoracao de schema e UI fica sem comparacao objetiva.

**Implementacao segura:**
- registrar screenshots e dumps controlados da auditoria ops atual;
- registrar exemplos reais de eventos por categoria;
- registrar pelo menos um caso com timeline, um relatorio publico e uma exportacao.

**Criterios de aceite:**
- existe amostra visual e estrutural do modulo atual;
- existe lista de perguntas que a auditoria atual nao responde.

### AUD-001 - Inventariar eventos atuais e fontes de escrita
**Prioridade:** `P0`  
**Arquivos alvo:**  
- [functions/index.js](/d:/ComplianceHub/functions/index.js)

**Problema:** hoje o sistema nao tem mapa oficial do que audita.

**Implementacao segura:**
- consolidar tabela `action -> origem -> tenant -> target -> detalhe -> clientVisible`;
- marcar eventos que hoje gravam payload tecnico e os que hoje sao client-safe.

**Criterios de aceite:**
- existe inventario fechado das actions atuais;
- cada action atual tem classificacao preliminar de categoria, nivel e visibilidade.

---

## Fase 1 - Schema v2 e helper central

### AUD-010 - Criar catalogo central de auditoria
**Prioridade:** `P0`  
**Arquivos alvo:**  
- novo [functions/audit/auditCatalog.js](/d:/ComplianceHub/functions/audit/auditCatalog.js)
- novo [src/core/audit/auditCatalog.js](/d:/ComplianceHub/src/core/audit/auditCatalog.js)

**Problema:** hoje labels, filtros e classificacoes vivem espalhados e incompletos.

**Implementacao segura:**
- definir metadados por action:
  - `category`
  - `level`
  - `defaultAudience`
  - `entityType`
  - `source`
  - `clientVisible`
  - `summaryTemplate`
- espelhar catalogo minimo no frontend para renderizacao, sem duplicar regra sensivel.

**Risco:** `Medio`  
**Impacto:** `Alto`

**Criterios de aceite:**
- toda action atual mapeada no catalogo;
- UI deixa de depender de lista hardcoded parcial.

### AUD-011 - Criar helper unico de escrita `writeAuditEvent`
**Prioridade:** `P0`  
**Arquivos alvo:**  
- novo [functions/audit/writeAuditEvent.js](/d:/ComplianceHub/functions/audit/writeAuditEvent.js)
- [functions/index.js](/d:/ComplianceHub/functions/index.js)

**Problema:** schema e escrita sao inconsistentes.

**Implementacao segura:**
- criar helper que:
  - normaliza schema v2;
  - preenche `summary`, `detail`, `metadata`, `related`, `searchText`;
  - mascara IP quando necessario;
  - evita `JSON.stringify` em `detail`;
  - grava documento imutavel em `auditLogs`.

**Risco:** `Alto`  
**Impacto:** `Critico`

**Criterios de aceite:**
- nenhum novo ponto de escrita faz `db.collection('auditLogs').add(...)` direto;
- helper suporta ator humano, sistema e link publico.

### AUD-012 - Criar projecao sanitizada `tenantAuditLogs`
**Prioridade:** `P0`  
**Arquivos alvo:**  
- novo [functions/audit/projectTenantAuditEvent.js](/d:/ComplianceHub/functions/audit/projectTenantAuditEvent.js)
- [functions/audit/writeAuditEvent.js](/d:/ComplianceHub/functions/audit/writeAuditEvent.js)
- [firestore.rules](/d:/ComplianceHub/firestore.rules)

**Problema:** cliente nao pode ler `auditLogs`, mas precisa de trilha propria.

**Implementacao segura:**
- gerar espelho client-safe apenas quando `clientVisible === true`;
- remover metadata sensivel;
- gravar somente os campos de governanca necessarios;
- manter mesma `eventId` entre bruto e projeção.

**Risco:** `Alto`  
**Impacto:** `Critico`

**Criterios de aceite:**
- cliente continua sem acesso a `auditLogs` bruto;
- existe colecao/projecao segura por tenant;
- dados sensiveis nao sao copiados para a projeção.

### AUD-013 - Normalizar busca e consulta server-side
**Prioridade:** `P1`  
**Arquivos alvo:**  
- [functions/audit/writeAuditEvent.js](/d:/ComplianceHub/functions/audit/writeAuditEvent.js)
- [src/core/firebase/firestoreService.js](/d:/ComplianceHub/src/core/firebase/firestoreService.js)

**Problema:** filtro atual depende de varredura no cliente e limite generico.

**Implementacao segura:**
- preencher `searchText` na escrita;
- preparar consulta por intervalo, categoria, action, tenant e data;
- desenhar paginacao baseada em `occurredAt`.

**Risco:** `Medio`  
**Impacto:** `Alto`

**Criterios de aceite:**
- UI consegue consultar sem depender so de filtro local;
- consulta suporta crescimento de volume sem perder legibilidade.

---

## Fase 2 - Migracao das escritas atuais

### AUD-020 - Migrar eventos de tenant, usuario e perfil
**Prioridade:** `P0`  
**Arquivos alvo:**  
- [functions/index.js](/d:/ComplianceHub/functions/index.js)

**Cobertura:**  
- `USER_CREATED`
- `TENANT_USER_CREATED`
- `TENANT_USER_UPDATED`
- `OWN_PROFILE_UPDATED`
- `TENANT_CONFIG_UPDATED`

**Implementacao segura:**
- trocar escrita manual por helper;
- preencher `actor`, `entity`, `related.userId`, `tenantId`, `summary` e `clientVisible`;
- separar delta tecnico de delta visivel ao cliente em `metadata`.

**Criterios de aceite:**
- eventos administrativos saem com schema v2;
- cliente so ve mudancas visiveis e permitidas.

### AUD-021 - Migrar eventos de negocio do cliente
**Prioridade:** `P0`  
**Arquivos alvo:**  
- [functions/index.js](/d:/ComplianceHub/functions/index.js)

**Cobertura:**  
- `SOLICITATION_CREATED`
- `CASE_CORRECTED`
- `EXPORT_CREATED`
- `CLIENT_PUBLIC_REPORT_CREATED`
- `CLIENT_PUBLIC_REPORT_REVOKED`

**Implementacao segura:**
- garantir `related.caseId`, `related.exportId`, `related.reportToken`;
- criar `clientSummary` limpo e util;
- marcar `source` como `portal_client` quando aplicavel.

**Criterios de aceite:**
- governanca da tenant passa a ter eventos realmente usaveis;
- exportacao e relatorio publico ficam rastreaveis por tenant.

### AUD-022 - Migrar eventos operacionais de caso
**Prioridade:** `P0`  
**Arquivos alvo:**  
- [functions/index.js](/d:/ComplianceHub/functions/index.js)

**Cobertura:**  
- `CASE_ASSIGNED`
- `CASE_RETURNED`
- `CASE_CONCLUDED`
- `CASE_DRAFT_SAVED`

**Implementacao segura:**
- separar eventos client-safe dos ops-only;
- estruturar `entity.type = CASE`;
- preencher `related.caseId`.

**Criterios de aceite:**
- ops consegue filtrar fluxo de caso com coerencia;
- cliente so recebe os eventos que fazem sentido para governanca.

### AUD-023 - Migrar eventos de IA e processamento
**Prioridade:** `P1`  
**Arquivos alvo:**  
- [functions/index.js](/d:/ComplianceHub/functions/index.js)

**Cobertura:**  
- `AI_ANALYSIS_RUN`
- `AI_HOMONYM_ANALYSIS_RUN`
- `AI_RERUN`
- `AI_DECISION_SET`
- `ENRICHMENT_PHASE_RERUN`

**Implementacao segura:**
- tirar payload cru do `detail`;
- armazenar metadata estruturada;
- marcar `clientVisible = false`;
- classificar em `AI` ou `PROCESSING`.

**Criterios de aceite:**
- payload tecnico so aparece em detalhe estruturado do ops;
- nenhum desses eventos vaza para cliente.

### AUD-024 - Estruturar correlacao por entidade e relacoes
**Prioridade:** `P0`  
**Arquivos alvo:**  
- [functions/index.js](/d:/ComplianceHub/functions/index.js)
- [functions/audit/writeAuditEvent.js](/d:/ComplianceHub/functions/audit/writeAuditEvent.js)

**Problema:** timeline por caso depende de `target`.

**Implementacao segura:**
- preencher `entity.type/entity.id`;
- preencher `related.caseId`, `related.reportToken`, `related.exportId`, `related.userId`;
- manter `target` legado apenas para compatibilidade temporaria.

**Criterios de aceite:**
- eventos de relatorio e exportacao ligados ao caso podem ser encontrados pelo caso;
- timeline do caso deixa de depender apenas de string generica.

---

## Fase 3 - UI operacional de auditoria

### AUD-030 - Criar camada de servico e mapper v2 para auditoria
**Prioridade:** `P0`  
**Arquivos alvo:**  
- [src/core/firebase/firestoreService.js](/d:/ComplianceHub/src/core/firebase/firestoreService.js)
- [src/hooks/useAuditLogs.js](/d:/ComplianceHub/src/hooks/useAuditLogs.js)
- novo [src/core/audit/auditFormatters.js](/d:/ComplianceHub/src/core/audit/auditFormatters.js)

**Problema:** UI atual recebe documento quase cru e tenta descobrir tudo no componente.

**Implementacao segura:**
- normalizar `userEmail` legado;
- criar formatter com fallback legado;
- introduzir query params estruturados para ops.

**Criterios de aceite:**
- componente nao depende mais de `log.user` vs `log.userEmail`;
- mapeamento legado e v2 convivem durante a migracao.

### AUD-031 - Refatorar filtros da auditoria operacional
**Prioridade:** `P1`  
**Arquivos alvo:**  
- [src/portals/ops/AuditoriaPage.jsx](/d:/ComplianceHub/src/portals/ops/AuditoriaPage.jsx)
- [src/portals/ops/AuditoriaPage.css](/d:/ComplianceHub/src/portals/ops/AuditoriaPage.css)

**Filtros novos propostos:**
- periodo
- tenant
- nivel
- categoria
- action
- ator
- tipo de entidade
- apenas humano
- apenas sistema
- apenas erros
- apenas eventos client-visible

**Implementacao segura:**
- manter filtro atual como fallback temporario se necessario;
- usar catalogo central para popular selects e badges.

**Criterios de aceite:**
- usuario ops consegue isolar ruido de processamento;
- filtro cobre o universo real de actions existentes.

### AUD-032 - Substituir tabela truncada por resumo + detalhe expandivel
**Prioridade:** `P1`  
**Arquivos alvo:**  
- [src/portals/ops/AuditoriaPage.jsx](/d:/ComplianceHub/src/portals/ops/AuditoriaPage.jsx)
- [src/portals/ops/AuditoriaPage.css](/d:/ComplianceHub/src/portals/ops/AuditoriaPage.css)
- possivel novo [src/ui/components/AuditEventDrawer/AuditEventDrawer.jsx](/d:/ComplianceHub/src/ui/components/AuditEventDrawer/AuditEventDrawer.jsx)
- possivel novo [src/ui/components/AuditEventDrawer/AuditEventDrawer.css](/d:/ComplianceHub/src/ui/components/AuditEventDrawer/AuditEventDrawer.css)

**Problema:** tudo importante hoje fica truncado na mesma linha.

**Implementacao segura:**
- mostrar linha resumo com:
  - quando
  - nivel
  - categoria
  - resumo
  - ator
  - tenant
  - entidade
- abrir drawer/painel lateral para:
  - detail
  - metadata
  - source
  - related ids
  - ipMasked

**Criterios de aceite:**
- payload tecnico nao fica mais exposto como texto cru truncado;
- evento pode ser investigado sem sair da pagina.

### AUD-033 - Criar sistema de labels, badges e renderizacao por categoria
**Prioridade:** `P1`  
**Arquivos alvo:**  
- novo [src/core/audit/auditLabelMap.js](/d:/ComplianceHub/src/core/audit/auditLabelMap.js)
- [src/portals/ops/AuditoriaPage.jsx](/d:/ComplianceHub/src/portals/ops/AuditoriaPage.jsx)
- [src/portals/ops/AuditoriaPage.css](/d:/ComplianceHub/src/portals/ops/AuditoriaPage.css)

**Problema:** labels atuais sao parciais e pouco coerentes.

**Implementacao segura:**
- definir cor por nivel e categoria;
- separar resumo humano e rotulo tecnico;
- criar renderers especificos para `AI`, `PROCESSING`, `CASE`, `REPORT_PUBLIC`, `EXPORT`.

**Criterios de aceite:**
- eventos diferentes deixam de competir com o mesmo peso visual;
- leitura rapida identifica o que e negocio e o que e sistema.

### AUD-034 - Corrigir timeline de caso para relacoes estruturadas
**Prioridade:** `P1`  
**Arquivos alvo:**  
- [src/core/firebase/firestoreService.js](/d:/ComplianceHub/src/core/firebase/firestoreService.js)
- [src/portals/ops/CasoPage.jsx](/d:/ComplianceHub/src/portals/ops/CasoPage.jsx)

**Problema:** timeline atual perde eventos por depender de `target == caseId`.

**Implementacao segura:**
- migrar consulta para `related.caseId == caseId` quando disponivel;
- manter fallback legado enquanto houver historico antigo;
- ajustar labels de timeline para catalogo novo.

**Criterios de aceite:**
- eventos de relatorio e exportacao ligados ao caso entram na timeline correta;
- timeline nao some com eventos legados.

---

## Fase 4 - Auditoria do cliente

### AUD-040 - Criar permissao, rota e menu do cliente para auditoria
**Prioridade:** `P0`  
**Arquivos alvo:**  
- [src/core/rbac/permissions.js](/d:/ComplianceHub/src/core/rbac/permissions.js)
- [src/App.jsx](/d:/ComplianceHub/src/App.jsx)
- [src/ui/layouts/Sidebar.jsx](/d:/ComplianceHub/src/ui/layouts/Sidebar.jsx)

**Implementacao segura:**
- criar permissao `TENANT_AUDIT_VIEW` ou equivalente;
- conceder inicialmente para `client_manager`;
- adicionar rota protegida e item de menu proprio.

**Criterios de aceite:**
- cliente gestor ve a entrada de auditoria;
- outros perfis cliente sem permissao nao veem rota nem item de menu.

### AUD-041 - Expor servico client-safe de leitura da auditoria da tenant
**Prioridade:** `P0`  
**Arquivos alvo:**  
- [src/core/firebase/firestoreService.js](/d:/ComplianceHub/src/core/firebase/firestoreService.js)
- [firestore.rules](/d:/ComplianceHub/firestore.rules)
- opcionalmente novo callable em [functions/index.js](/d:/ComplianceHub/functions/index.js) se a leitura direta precisar ser endurecida

**Problema:** cliente nao pode ler `auditLogs` bruto.

**Implementacao segura:**
- ler somente `tenantAuditLogs`;
- aplicar filtro server-side ou regra de tenant;
- bloquear leitura cruzada por tenant em qualquer paginação ou busca.

**Criterios de aceite:**
- cliente so recebe eventos da propria tenant;
- nao ha caminho alternativo para ler bruto.

### AUD-042 - Criar pagina de auditoria do cliente
**Prioridade:** `P0`  
**Arquivos alvo:**  
- novo [src/portals/client/AuditoriaClientePage.jsx](/d:/ComplianceHub/src/portals/client/AuditoriaClientePage.jsx)
- novo [src/portals/client/AuditoriaClientePage.css](/d:/ComplianceHub/src/portals/client/AuditoriaClientePage.css)

**Estrutura proposta:**
- header simples com contagem no periodo
- filtros por periodo, tipo de evento, usuario da tenant, caso e relatorio/exportacao
- lista resumida com:
  - quando
  - quem
  - o que aconteceu
  - em qual entidade
  - status
- detalhe expandivel sem payload tecnico

**Criterios de aceite:**
- gestor da franquia entende rapidamente historico util da sua operacao;
- linguagem e orientada a negocio, nao a processamento interno.

### AUD-043 - Criar formatters client-safe e descricoes claras
**Prioridade:** `P1`  
**Arquivos alvo:**  
- novo [src/core/audit/clientAuditFormatters.js](/d:/ComplianceHub/src/core/audit/clientAuditFormatters.js)
- [src/portals/client/AuditoriaClientePage.jsx](/d:/ComplianceHub/src/portals/client/AuditoriaClientePage.jsx)

**Problema:** mesmo com projecao segura, a descricao precisa ser clara e util.

**Implementacao segura:**
- padronizar resumo:
  - `Joao Silva criou a solicitacao do caso X`
  - `Maria Oliveira exportou 5 registros em PDF`
  - `Relatorio publico do caso Y foi desativado`
- esconder metadados tecnicos irrelevantes;
- mostrar chips simples de categoria.

**Criterios de aceite:**
- cliente entende o historico sem treinamento tecnico;
- nenhum termo metodologico interno aparece.

---

## Fase 5 - Cobertura de eventos hoje ausentes

### AUD-050 - Tornar abertura de relatorio publico auditavel
**Prioridade:** `P1`  
**Arquivos alvo:**  
- [src/pages/PublicReportPage.jsx](/d:/ComplianceHub/src/pages/PublicReportPage.jsx)
- [src/core/firebase/firestoreService.js](/d:/ComplianceHub/src/core/firebase/firestoreService.js)
- [functions/index.js](/d:/ComplianceHub/functions/index.js)

**Problema:** leitura publica atual nao passa pelo backend.

**Implementacao segura:**
- mover a entrega do HTML para fluxo mediado por backend ou endpoint auditado;
- gravar `PUBLIC_REPORT_VIEWED` com `actor.type = PUBLIC_LINK`;
- decidir politica de `ipMasked` e `userAgent`.

**Risco:** `Alto`  
**Impacto:** `Alto`

**Criterios de aceite:**
- cada abertura valida gera evento auditavel;
- expiracao e revogacao continuam funcionando.

### AUD-051 - Auditar copia e compartilhamento de relatorio publico
**Prioridade:** `P2`  
**Arquivos alvo:**  
- [src/pages/PublicReportPage.jsx](/d:/ComplianceHub/src/pages/PublicReportPage.jsx)
- telas de relatorio ops/client relevantes
- [functions/index.js](/d:/ComplianceHub/functions/index.js)

**Problema:** hoje nao ha trilha de compartilhamento/copia.

**Implementacao segura:**
- gravar `PUBLIC_REPORT_LINK_COPIED` quando a acao partir de portal autenticado;
- se produto exigir rastreio nominal de destinatario, desenhar share model proprio antes de prometer `quem abriu`.

**Criterios de aceite:**
- a plataforma sabe quando um usuario autenticado copiou/gerou/compartilhou um link;
- nao ha falsa promessa de identidade quando o link continuar anonimo.

### AUD-052 - Cobrir download e abertura de exportacoes
**Prioridade:** `P2`  
**Arquivos alvo:**  
- [src/portals/client/ExportacoesPage.jsx](/d:/ComplianceHub/src/portals/client/ExportacoesPage.jsx)
- [src/core/firebase/firestoreService.js](/d:/ComplianceHub/src/core/firebase/firestoreService.js)
- [functions/index.js](/d:/ComplianceHub/functions/index.js)

**Problema:** so a criacao da exportacao fica registrada.

**Implementacao segura:**
- introduzir evento `EXPORT_DOWNLOADED` ou `EXPORT_OPENED` quando houver acao real do usuario;
- evitar duplicidade em reloads automaticos.

**Criterios de aceite:**
- auditoria diferencia gerar de consumir exportacao.

---

## Fase 6 - Backfill, seguranca e validacao final

### AUD-060 - Backfill do historico legado
**Prioridade:** `P1`  
**Arquivos alvo:**  
- novo `scripts/backfill-audit-logs.mjs` ou equivalente
- opcionalmente callable administrativo em [functions/index.js](/d:/ComplianceHub/functions/index.js)

**Problema:** sem backfill a UI nova fica inconsistente no passado.

**Implementacao segura:**
- preencher `summary`, `category`, `level`, `entity`, `related` e `clientVisible` com heuristica controlada;
- mapear `userEmail` legado para `actor.email`;
- preservar payload original em `metadata.legacyRaw` apenas no bruto, se necessario.

**Criterios de aceite:**
- historico antigo fica minimamente navegavel na UI nova;
- cliente nao recebe retroativamente eventos sensiveis.

### AUD-061 - Ajustar regras, indices e contratos de acesso
**Prioridade:** `P0`  
**Arquivos alvo:**  
- [firestore.rules](/d:/ComplianceHub/firestore.rules)
- possiveis indices do Firestore
- [src/core/rbac/permissions.js](/d:/ComplianceHub/src/core/rbac/permissions.js)

**Implementacao segura:**
- manter `auditLogs` ops-only;
- liberar leitura de `tenantAuditLogs` apenas para usuario autenticado da mesma tenant com permissao adequada;
- revisar consultas por paginação e filtros para nao abrir vazamento lateral.

**Criterios de aceite:**
- cliente A nao le tenant B nem por ID direto, nem por filtro, nem por cursor;
- ops mantem leitura completa.

### AUD-062 - Validacao negativa e testes de tenant isolation
**Prioridade:** `P0`  
**Arquivos alvo:**  
- testes de integracao/unitarios relevantes em `src/` e `functions/`

**Checklist minimo:**
- cliente sem tenant nao le nada
- cliente da tenant A nao le tenant B
- cliente nao le `auditLogs` bruto
- cliente nao recebe `AI`, `PROCESSING` ou detalhes sensiveis
- ops continua vendo detalhe tecnico
- timeline de caso encontra eventos relacionados

**Criterios de aceite:**
- todos os cenarios negativos falham como esperado;
- nao ha vazamento por paginação, busca ou relacao cruzada.

### AUD-063 - Validacao funcional final
**Prioridade:** `P1`  
**Arquivos alvo:**  
- rotas ops e client de auditoria
- relatorio publico
- exportacoes
- caso

**Perguntas que a solucao final precisa responder:**
- quem criou uma solicitacao?
- quem corrigiu e reenviou um caso?
- quem exportou um relatorio?
- quem gerou ou desativou um relatorio publico?
- quando uma configuracao visivel da tenant foi alterada?
- quais eventos sao negocio e quais sao processamento?
- quais eventos foram do cliente e quais foram automaticos?

**Criterios de aceite:**
- ops responde perguntas investigativas sem ler JSON cru em tabela truncada;
- cliente gestor responde perguntas de governanca da propria franquia sem depender do ops.

---

## Sequenciamento recomendado em PRs

### PR-1 - Fundacao de auditoria
- `AUD-000`
- `AUD-001`
- `AUD-010`
- `AUD-011`

### PR-2 - Projecao client-safe e seguranca
- `AUD-012`
- `AUD-013`
- `AUD-061`

### PR-3 - Migracao dos eventos atuais
- `AUD-020`
- `AUD-021`
- `AUD-022`
- `AUD-023`
- `AUD-024`

### PR-4 - Auditoria operacional v2
- `AUD-030`
- `AUD-031`
- `AUD-032`
- `AUD-033`
- `AUD-034`

### PR-5 - Auditoria do cliente
- `AUD-040`
- `AUD-041`
- `AUD-042`
- `AUD-043`

### PR-6 - Eventos faltantes de governanca
- `AUD-050`
- `AUD-051`
- `AUD-052`

### PR-7 - Backfill e fechamento
- `AUD-060`
- `AUD-062`
- `AUD-063`

## Matriz de validacao obrigatoria

### Rotas ops
- `/ops/auditoria`
- `/ops/caso/:caseId`
- `/ops/relatorios`

### Rotas client
- `/client/auditoria` ou equivalente
- `/client/relatorios`
- `/client/exportacoes`
- `/client/solicitacoes`

### Estados obrigatorios
- loading
- empty
- error
- lista com muitos eventos
- evento com metadata detalhada
- evento client-safe
- evento ops-only
- tenant unica
- tenant cruzada negada

## Recomendacao final
Se o objetivo for maximizar seguranca e evitar retrabalho, a ordem mais segura e:
1. resolver modelagem e helper central;
2. criar projecao client-safe;
3. migrar eventos de negocio;
4. so entao reescrever as UIs;
5. deixar `PUBLIC_REPORT_VIEWED` e `EXPORT_DOWNLOADED` para uma fase especifica, porque eles exigem mudanca de arquitetura e nao apenas de renderizacao.
