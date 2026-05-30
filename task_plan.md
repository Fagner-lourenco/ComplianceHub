# Task Plan: Refatoração Zero-Risco do Monolito ComplianceHub

> **Status:** Planejamento em execução — Phase A corrigida detalhada, Fases B-E estruturadas
> **Criado em:** 2026-05-29
> **Última revisão:** 2026-05-29
> **Scope:** Refatoração do monolito `functions/index.js` (~13.556 linhas, 47 callables, 10 triggers Firestore, 1 onRequest, 1 onSchedule) com paginação por cursor Firestore, export assíncrono via Cloud Storage, e remoção de código morto — mantendo 100% dos testes passando, zero regressão de API pública, e compatibilidade backward-compatible.

---

## Goal

Implementar cursor pagination real para listagens, substituir export síncrono por job assíncrono com Cloud Storage, dividir o monolito em módulos coesos testáveis, e eliminar código morto confirmado — mantendo V1 operante durante toda a transição.

---

## Constraints & Preferences

- **Respostas em português**
- **TDD:** Testes RED → Implementação → Testes GREEN para cada módulo
- **Não alterar interfaces públicas de callables sem versionamento**
- **Verificar `lint`, `test` frontend (~891), `test` backend (~571) antes de cada commit**
- **Deploy separado:** backend primeiro, frontend depois, com janela de observação de 5 minutos
- **Modo PLANO para refatoração:** análise profunda primeiro, execução depois de aprovação explícita
- **Métricas baseline documentadas:** monolito 13.556 linhas, 1110 nós graphify, 2062 edges

---

## Current Phase

**Phase A corrigida — baseline/documentos + V2 cursor pagination side-by-side**

---

## Decisões de Trade-off (Aprovadas)

| # | Pergunta | Decisão | Rationale |
|---|----------|---------|-----------|
| 1 | Downtime aceitável? | **(A)** 2-5min de indisponibilidade | Blue-green é overkill; janela de manutenção aceitável |
| 2 | Prioridade? | **(A)** Cursor pagination primeiro | Resolve dor imediata dos usuários (listagens truncadas/lentas) |
| 3 | Compatibilidade API? | **(A)** 100% backward-compatible | V1 intacta + V2 side-by-side; frontend adapta gradualmente |
| 4 | Arquitetura export? | **(D)** Coleção `exportJobs` + polling | Simples, transparente, sem infra extra de Cloud Tasks/Pub/Sub |
| 5 | Backpressure? | **(A)** `maxInstances: 10` + circuit breaker | Cloud Tasks é próximo passo após estabilizar |
| 6 | Phase A inclui modularização? | **(NÃO)** Modularização é Phase C | Phase A = baseline + V2 cursor apenas |
| 7 | Phase A inclui remoção de código morto? | **(NÃO)** Remoção é Phase D | Phase A = zero alterações em código existente |
| 8 | Phase A inclui export assíncrono? | **(NÃO)** Export async é Phase B | Phase A = apenas documentar necessidade |

---

## Baseline Pré-Refatoração (Confirmado por Busca Estática)

| Métrica | Valor Atual | Target Pós-Refatoração |
|---------|-------------|------------------------|
| Tamanho monolito | **13.556 linhas** | < 500 linhas (wiring apenas) |
| Callables no index.js | **47** | 0 (delegados para módulos) |
| Triggers Firestore no index.js | **10** | 0 (delegados para módulos) |
| onRequest no index.js | **1** | 0 (delegados para módulos) |
| onSchedule no index.js | **1** | 0 (delegados para módulos) |
| Total exports detectados | **~59** | 0 (delegados) |
| Funções no index.js | ~300 | ~0 |
| Testes frontend | ~891 (39 arquivos) | Manter 891+ |
| Testes backend | ~571 (48 arquivos) | Manter 571+ |
| Lint frontend | 0 erros, 0 warnings | Manter 0 |
| Lint backend | 0 erros, 0 warnings | Manter 0 |
| Nós graphify | 1110 | Esperado: 1200+ (mais granular) |
| Listagens com cursor real | 0% | 100% (após migração frontend) |
| Export síncrono | 100% | 0% (após Phase B) |
| Código morto identificado | Candidatos não confirmados | 0 (após Phase D) |

**Nota:** Números de testes e exports detectados por busca estática. Contagem semântica pode divergir.

---

## Phases

### Phase A corrigida: Baseline/Documentos + V2 Cursor Pagination Side-by-Side

**Objetivo:** Criar baseline documental do código real, implementar cursor pagination real em V2 side-by-side com V1, sem alterar callables existentes, sem modularizar, sem remover código morto, e sem implementar export assíncrono.
**Status:** pending → **a iniciar após aprovação**
**Estimativa:** 16-24 horas
**Risco:** Médio — cria V2 novo, mas V1 permanece inalterado

---

#### A.0 — Baseline Real e Contrato V1

**Objetivo:** Documentar o estado real do código antes de qualquer alteração.

**Checklist:**
- [ ] **A.0.1** Confirmar linhas reais de `functions/index.js`: **13.556 linhas**
- [ ] **A.0.2** Confirmar contagem real de `onCall`: **47 callables**
- [ ] **A.0.3** Confirmar contagem real de triggers Firestore diretos (`onDocumentCreated/Updated/Deleted`): **10 triggers**
- [ ] **A.0.4** Confirmar contagem real de `onRequest`: **1**
- [ ] **A.0.5** Confirmar contagem real de `onSchedule`: **1**
- [ ] **A.0.6** Confirmar total de exports detectados por busca estática: **~59**
- [ ] **A.0.7** Mapear contratos atuais de `listOpsCases`:
  - Parâmetros: `tenantId`, `pageSize` (max 100), `page` (numérica), `filters`, `queueOnly`, `assigneeUid`, `sortField`, `sortDir`
  - Retorno: `{ cases, total, stats, page, pageSize, totalPages, hasMore, meta }`
  - Implementação: carrega todos os docs via `fetchTenantCaseDocuments`, filtra/sorta em memória, faz `slice`
- [ ] **A.0.8** Mapear contratos atuais de `listClientCases`:
  - Parâmetros: `pageSize` (max 100), `page` (numérica), `filters`, `sortField`, `sortDir`
  - Retorno: `{ cases, total, stats, page, pageSize, totalPages, hasMore, meta }`
  - Implementação: pagina internamente com `startAfter`, mas acumula `allMatches` em memória, depois filtra/sorta e faz `slice`
- [ ] **A.0.9** Mapear contrato atual de `getClientExportCases`:
  - Parâmetros: `scopeCode` (ALL/DONE/PENDING/RED), `dateFrom`, `dateTo`
  - Retorno: `{ cases, total, pendingCount, meta }`
  - Implementação: carrega todos os docs via `fetchTenantCaseDocuments`, filtra em memória
- [ ] **A.0.10** Mapear consumidores frontend V1:
  - `callListOpsCases` → `src/hooks/useOpsCasesQuery.js`
  - `callListClientCases` → `src/hooks/useClientCasesQuery.js`
  - `callGetClientExportCases` → `src/portals/client/ExportacoesPage.jsx`
- [ ] **A.0.11** Registrar que V1 será **preservada sem alteração funcional**
- [ ] **A.0.12** Registrar que V2 será **criada side-by-side** (novas callables)
- [ ] **A.0.13** Registrar que **frontend não será migrado automaticamente nesta fase**

**Critério de aceite:** Documento de baseline com números reais, contratos V1 mapeados, e decisão arquitetural registrada.

---

#### A.1 — Auditar todas as queries de listagem

**Arquivos alvo:**
- `src/core/firebase/firestoreService.js` (subscriptions)
- `functions/index.js` (callables: `listOpsCases`, `listClientCases`, `getClientExportCases`)

**Checklist:**
- [ ] **A.1.1** Listar todas as funções que fazem `.get()` sem cursor real no retorno
- [ ] **A.1.2** Mapear collections: `cases`, `clientCases`, `auditLogs`, `notifications`, `tenantAuditLogs`
- [ ] **A.1.3** Documentar filtros atuais (where clauses), ordenação, limites
- [ ] **A.1.4** Identificar queries que usam paginação interna mas acumulam em memória
- [ ] **A.1.5** Identificar queries com `.orderBy()` implícito ou ausente
- [ ] **A.1.6** Verificar quais queries são usadas por subscriptions realtime (não devem usar cursor)
- [ ] **A.1.7** Documentar em `findings.md` com tabela: Collection | Filtros | Ordem | Limit | Cursor real? | Usada em

**Critério de aceite:** Toda query de listagem (>50 docs potenciais) está mapeada com decisão: "mantém subscription", "migra para cursor pagination", ou "requer análise adicional".

---

#### A.2 — Projetar índices compostos para cursor pagination

**Arquivo alvo:** `firestore.indexes.json` (planejamento apenas, sem deploy)

**Checklist:**
- [ ] **A.2.1** Para cada query paginada V2: definir `orderBy` fields + `cursorField` + tie-breaker `__name__`
- [ ] **A.2.2** `cases`: `(tenantId, status, createdAt DESC, __name__ DESC)`, `(tenantId, assigneeId, createdAt DESC, __name__ DESC)`, `(tenantId, createdAt DESC, __name__ DESC)`
- [ ] **A.2.3** `clientCases`: `(tenantId, createdAt DESC, __name__ DESC)`, `(tenantId, status, createdAt DESC, __name__ DESC)`
- [ ] **A.2.4** `auditLogs`: `(tenantId, occurredAt DESC, __name__ DESC)` — **nota: usar `occurredAt`, não `createdAt`**
- [ ] **A.2.5** `tenantAuditLogs`: `(tenantId, occurredAt DESC, __name__ DESC)` — **nota: usar `occurredAt`, não `createdAt`**
- [ ] **A.2.6** `notifications`: `(recipientUid, read, createdAt DESC, __name__ DESC)`
- [ ] **A.2.7** Validar contra índices existentes (16 índices atuais)
- [ ] **A.2.8** Criar tabela obrigatória:

| Collection | Query V2 | Where | OrderBy | Índice necessário | Já existia? |
|------------|----------|-------|---------|-------------------|-------------|
| cases | listOpsCasesV2 | tenantId | createdAt DESC, __name__ DESC | (tenantId, createdAt DESC, __name__ DESC) | NÃO |
| cases | listOpsCasesV2 + status | tenantId, status | createdAt DESC, __name__ DESC | (tenantId, status, createdAt DESC, __name__ DESC) | NÃO |
| clientCases | listClientCasesV2 | tenantId | createdAt DESC, __name__ DESC | (tenantId, createdAt DESC, __name__ DESC) | SIM (parcial) |
| auditLogs | (futuro) | tenantId | occurredAt DESC, __name__ DESC | (tenantId, occurredAt DESC, __name__ DESC) | SIM |

- [ ] **A.2.9** **NÃO remover índices nesta fase**
- [ ] **A.2.10** **NÃO fazer deploy de índices nesta tarefa de documentação**

**Critério de aceite:** Nenhuma query paginada V2 sem índice correspondente planejado; tabela de índices completa.

---

#### A.3 — Implementar `paginateFirestoreQuery`

**Arquivo:** `functions/helpers/paginateFirestoreQuery.js` (novo)
**Teste:** `functions/helpers/paginateFirestoreQuery.test.js` (novo)

**Checklist:**
- [ ] **A.3.1** Definir interface: `async paginateFirestoreQuery(query, { cursor, limit, cursorField })`
- [ ] **A.3.2** Suporte a `startAfter()` com **cursor composto** (array de valores: `[fieldValue, docId]`)
- [ ] **A.3.3** **Tie-breaker obrigatório por `__name__`** (document ID) para evitar duplicatas/omissões
- [ ] **A.3.4** **Buscar `limit + 1` docs** para calcular `hasMore` sem necessidade de contagem total
- [ ] **A.3.5** Encoder de cursor: **Base64 URL-safe** do JSON do array `[fieldValue, docId]`
- [ ] **A.3.6** Decoder de cursor: inverso do encoder, validação de schema
- [ ] **A.3.7** Retorno: `{ results: DocumentSnapshot[], nextCursor: string | null, hasMore: boolean }`
- [ ] **A.3.8** Validação: `limit` entre 1 e 1000 (limite Firestore)
- [ ] **A.3.9** Validação: `cursorField` existe no schema da collection
- [ ] **A.3.10** Tratamento de cursor inválido: throw `invalid-argument`
- [ ] **A.3.11** Teste 1: primeira página sem cursor
- [ ] **A.3.12** Teste 2: segunda página com cursor
- [ ] **A.3.13** Teste 3: página vazia (fim dos resultados)
- [ ] **A.3.14** Teste 4: limite customizado (1, 50, 100, 1000)
- [ ] **A.3.15** Teste 5: cursor inválido
- [ ] **A.3.16** Teste 6: **timestamps iguais** — verificar que tie-breaker por `__name__` evita duplicatas
- [ ] **A.3.17** Teste 7: **omissão** — verificar que nenhum doc é pulado entre páginas
- [ ] **A.3.18** Teste 8: múltiplos filtros + paginação

**Critério de aceite:** 100% cobertura de testes, zero dependência de Firebase Admin (mockável), < 50ms overhead por query.

---

#### A.4 — Criar `listOpsCasesV2` (side-by-side com V1)

**Arquivo:** Callable registrado em `functions/index.js` atual (não criar `functions/modules/caseManager/index.js` nesta fase)
**Teste:** `functions/index.test.js` ou novo `functions/listOpsCasesV2.test.js`

**Checklist:**
- [ ] **A.4.1** Copiar lógica de autorização de `listOpsCases` atual como baseline
- [ ] **A.4.2** Adicionar parâmetros: `cursor` (string | null), `limit` (default 50, max 500)
- [ ] **A.4.3** **Remover parâmetro `page` (numérico)** — V2 usa cursor, não paginação numérica
- [ ] **A.4.4** Manter parâmetros: `filters`, `sortField`, `sortDir`, `queueOnly`, `assigneeUid`
- [ ] **A.4.5** Usar `paginateFirestoreQuery` com índice `(tenantId, createdAt DESC, __name__ DESC)`
- [ ] **A.4.6** Se `cursor` omitido, retorna primeira página
- [ ] **A.4.7** Se `nextCursor` null, indica fim dos resultados
- [ ] **A.4.8** Retorno: `{ results: Case[], nextCursor: string | null, hasMore: boolean }`
- [ ] **A.4.9** **NÃO retornar `totalCount` ou `totalPages`** se isso exigir scan completo
- [ ] **A.4.10** **NÃO retornar `stats`** por scan completo; `stats` pode ser `null` ou omitido
- [ ] **A.4.11** Filtros não suportados por Firestore (ex: search textual) devem ser:
  - **Rejeitados** com erro claro, OU
  - **Documentados** como não suportados, OU
  - **Caírem para V1** com flag explícita (`fallbackToV1: true`), nunca de forma silenciosa
- [ ] **A.4.12** Teste 1: sem cursor → primeira página
- [ ] **A.4.13** Teste 2: com cursor → próxima página
- [ ] **A.4.14** Teste 3: limite custom (10, 50, 100, 500)
- [ ] **A.4.15** Teste 4: filtros combinados + paginação
- [ ] **A.4.16** Teste 5: permission denied (role inválido)
- [ ] **A.4.17** Teste 6: tenant isolation (não vê cases de outro tenant)
- [ ] **A.4.18** Teste 7: **timestamps iguais** — verificar duplicatas/omissões

**Critério de aceite:** Resposta < 500ms para 50 docs, < 2s para 500 docs; V1 intacta e operante.

---

#### A.5 — Criar `listClientCasesV2` (side-by-side com V1)

**Arquivo:** Callable registrado em `functions/index.js` atual (não criar `functions/modules/clientPortal/index.js` nesta fase)
**Teste:** `functions/listClientCasesV2.test.js`

**Checklist:**
- [ ] **A.5.1** Copiar lógica de autorização de `listClientCases` atual como baseline
- [ ] **A.5.2** Adicionar parâmetros: `cursor` (string | null), `limit` (default 50, max 500)
- [ ] **A.5.3** **Remover parâmetro `page` (numérico)**
- [ ] **A.5.4** Usar `paginateFirestoreQuery` com índice `(tenantId, createdAt DESC, __name__ DESC)`
- [ ] **A.5.5** `tenantId` deve vir do `profile` (autorização), **não do payload do cliente**
- [ ] **A.5.6** Retorno: `{ results: ClientCase[], nextCursor: string | null, hasMore: boolean }`
- [ ] **A.5.7** **NÃO retornar `totalCount`, `totalPages`, ou `stats` por scan completo**
- [ ] **A.5.8** Filtros não suportados: rejeitar, documentar, ou cair para V1 com flag explícita
- [ ] **A.5.9** Teste 1: sem cursor → primeira página
- [ ] **A.5.10** Teste 2: com cursor → próxima página
- [ ] **A.5.11** Teste 3: filtros + paginação
- [ ] **A.5.12** Teste 4: client isolation (usuário só vê seus cases)
- [ ] **A.5.13** Teste 5: permission denied
- [ ] **A.5.14** Teste 6: **timestamps iguais** — verificar duplicatas/omissões

**Critério de aceite:** Mesmo padrão de A.4, mas com isolation por `tenantId` do profile.

---

#### A.6 — Auditoria documental de subscriptions de auditoria (não criar callables V2)

**Arquivo alvo:** `src/core/firebase/firestoreService.js`

**Checklist:**
- [ ] **A.6.1** Mapear subscriptions de auditoria atuais:
  - `subscribeToAuditLogs` — usa `occurredAt` (não `createdAt`)
  - `subscribeToTenantAuditLogs` — usa `occurredAt` (não `createdAt`)
- [ ] **A.6.2** Verificar que índices de auditoria existentes usam `occurredAt`
- [ ] **A.6.3** Registrar que subscriptions realtime **não devem usar cursor pagination** (natureza realtime)
- [ ] **A.6.4** **NÃO criar `listAuditLogsV2` ou `listTenantAuditLogsV2` como callables nesta fase**
- [ ] **A.6.5** Registrar que eventual migração de auditoria para cursor pagination será **decisão futura**, não Phase A

**Critério de aceite:** Documento de auditoria com decisão registrada: "subscriptions realtime mantidas; callables de auditoria não são parte da Phase A".

---

#### A.7 — Planejar índices Firestore (sem deploy)

**Checklist:**
- [ ] **A.7.1** Gerar tabela de índices necessários (ver A.2.8)
- [ ] **A.7.2** Validar contra índices existentes (16 índices atuais)
- [ ] **A.7.3** **NÃO remover índices nesta fase**
- [ ] **A.7.4** **Adicionar apenas índices estritamente necessários** para V2
- [ ] **A.7.5** Documentar que deploy de índices será feito em etapa separada, antes da ativação de V2
- [ ] **A.7.6** **NÃO fazer deploy nesta tarefa de documentação**

**Critério de aceite:** Tabela de índices completa, validada, e pronta para deploy futuro.

---

#### A.8 — Testes de carga end-to-end (local/emulador apenas)

**Script:** `scripts/load-test-pagination.cjs` (novo)

**Checklist:**
- [ ] **A.8.1** Script deve **abortar em produção** — verificar `process.env.FIRESTORE_EMULATOR_HOST`
- [ ] **A.8.2** Exigir `FIRESTORE_EMULATOR_HOST` ou `ALLOW_LOCAL_LOAD_TEST=true` para prosseguir
- [ ] **A.8.3** Usar tenant fake (ex: `test-tenant-load`)
- [ ] **A.8.4** Inserir 1.000 cases mockados via batch
- [ ] **A.8.5** Iterar todas as páginas via `listOpsCasesV2` (limit 100)
- [ ] **A.8.6** Verificar: total recuperado == 1.000
- [ ] **A.8.7** Verificar: ordem correta (createdAt DESC)
- [ ] **A.8.8** Verificar: sem duplicatas ou omissões
- [ ] **A.8.9** Medir latência por página (log em console, não em `progress.md`)
- [ ] **A.8.10** Testar cenário: deletar case no meio da paginação (verificar consistência)
- [ ] **A.8.11** **NÃO alterar `progress.md` automaticamente pelo script**

**Critério de aceite:** < 3s por página de 500, memória estável, zero duplicatas/omissões.

---

#### A.9 — Documentar migration path e contratos V2

**Arquivo:** `docs/migrations/v2-pagination.md` (novo)

**Checklist:**
- [ ] **A.9.1** Explicar diferença V1 vs V2:
  - V1: paginação numérica (`page`, `pageSize`), carrega tudo em memória
  - V2: cursor pagination (`cursor`, `limit`), sem acumulação em memória
- [ ] **A.9.2** Documentar que V2 **não retorna `total` nem `totalPages`** (a menos que contador barato seja implementado)
- [ ] **A.9.3** Documentar que V2 **não retorna `stats` por scan completo** — `stats` pode ser `null`
- [ ] **A.9.4** Exemplo de código: como iterar todas as páginas com cursor
- [ ] **A.9.5** Timeline de deprecação da V1: **3 meses após frontend migrado e validado**
- [ ] **A.9.6** Checklist de migração para frontend:
  1. Criar hook `useOpsCasesQueryV2` side-by-side com `useOpsCasesQuery`
  2. Testar com feature flag
  3. Migrar `useClientCasesQuery` para V2
  4. Remover V1 após 3 meses estável
- [ ] **A.9.7** Documentar que V1 só será depreciada após frontend migrado e validado
- [ ] **A.9.8** Documentar plano de fallback: se V2 falhar, frontend pode voltar para V1 imediatamente

**Critério de aceite:** Qualquer dev consegue seguir o doc para migrar uma listagem.

---

### Phase B: Export Assíncrono + Cloud Storage

**Objetivo:** Eliminar timeout de 120s do `getClientExportCases`. Substituir por job background com Storage.
**Status:** pending
**Estimativa:** 20 horas
**Risco:** Médio — nova arquitetura, mas isolada

**Nota:** Phase B fica **fora da Phase A**. Não implementar nesta rodada.

---

### Phase C: Extração de Módulos do Monolito

**Objetivo:** Dividir `functions/index.js` em módulos coesos testáveis independentemente.
**Status:** pending
**Estimativa:** 40 horas
**Risco:** Alto — altera estrutura fundamental do backend

**Nota:** Phase C fica **fora da Phase A**. Modularização só começa após Phase A e B concluídas e estáveis.

#### C.0 — Preparação e contratos

**Checklist:**
- [ ] **C.0.1** Criar diretório `functions/modules/` (apenas na Phase C)
- [ ] **C.0.2** Criar `functions/modules/_contracts/` com interfaces TypeScript (JSDoc)
- [ ] **C.0.3** Definir contrato `ICaseManager`: métodos, parâmetros, retornos, erros
- [ ] **C.0.4** Definir contrato `IEnrichmentPipeline`: adapters, circuit breaker, retry
- [ ] **C.0.5** Definir contrato `IReportEngine`: HTML, PDF, publicação
- [ ] **C.0.6** Definir contrato `IUserManager`: CRUD, roles, claims
- [ ] **C.0.7** Definir contrato `IClientPortal`: clientCases, quotas, export, mirror
- [ ] **C.0.8** Definir contrato `IAuditManager`: logs, eventos, query
- [ ] **C.0.9** Definir contrato `INotificationManager`: notificações, push, email
- [ ] **C.0.10** Criar `functions/modules/_shared/` para utilitários compartilhados (db, auth, logger)

**Critério de aceite:** Todos os contratos documentados, revisados, e aprovados.

#### C.1-C.9 — Extração de módulos (detalhado na execução da Phase C)

**Módulos a extrair:**
- `caseManager` — CRUD cases, listagem V1/V2, busca
- `enrichmentPipeline` — Judit, Escavador, BigDataCorp, DJEN, IA
- `reportEngine` — HTML, PDF, publicação
- `userManager` — Auth, roles, claims
- `clientPortal` — clientCases, quotas, export, mirror
- `auditManager` — Logs, eventos, query
- `notificationManager` — Notificações, push

**Critério de aceite:** `index.js` < 500 linhas, nenhuma função de negócio inline.

---

### Phase D: Remoção de Código Morto

**Objetivo:** Limpar exports não utilizados e funções órfãs.
**Status:** pending
**Estimativa:** 4 horas
**Risco:** Baixo — apenas remove código confirmado como morto

**Nota:** Phase D fica **fora da Phase A**. Remoção de código morto só ocorre após modularização (Phase C).

#### D.1 — Classificação de candidatos a remoção

**Checklist:**
- [ ] **D.1.1** `ENTITY_TYPE` — analisar uso em `writeAuditEvent.js` (não apenas grep)
- [ ] **D.1.2** `ACTOR_TYPE` — analisar uso em `writeAuditEvent.js`
- [ ] **D.1.3** `getActionConfig` — analisar uso em `writeAuditEvent.js`
- [ ] **D.1.4** Classificar cada candidato:
  - **REMOVÍVEL COM SEGURANÇA** — nenhuma referência, testes cobrem ausência
  - **PROVAVELMENTE REMOVÍVEL, MAS PRECISA TESTE** — referências indiretas ou dinâmicas
  - **NÃO CONFIRMADO** — requer análise manual
  - **NÃO REMOVER** — usado em fluxo crítico
- [ ] **D.1.5** Documentar classificação em `findings.md`

#### D.2 — Remoção de código morto confirmado

**Checklist:**
- [ ] **D.2.1** Remover funções classificadas como REMOVÍVEL COM SEGURANÇA
- [ ] **D.2.2** Remover imports não usados
- [ ] **D.2.3** Remover variáveis não usadas
- [ ] **D.2.4** Atualizar testes se necessário
- [ ] **D.2.5** `npm run lint` → 0 erros
- [ ] **D.2.6** `npm test` → todos passam

**Critério de aceite:** Lint passa, testes passam, zero código morto confirmado removido.

---

### Phase E: Documentação e Handoff

**Objetivo:** Documentar arquitetura nova e garantir manutenibilidade futura.
**Status:** pending
**Estimativa:** 8 horas
**Risco:** Baixo — apenas documentação

**Nota:** Phase E fica **fora da Phase A**.

---

## Key Questions

1. **Aprovação do plano:** Confirma que todas as fases e subtarefas estão claras?
2. **Prioridade de fases:** A → B → C → D → E, ou prefere paralelizar algumas?
3. **Timeline:** Urgente (1 semana), moderado (1 mês), ou conservador (2 meses)?
4. **Orçamento de instâncias:** Limite de `maxInstances` para teste de carga?
5. **Cloud Storage bucket:** Usar bucket padrão do Firebase ou criar dedicado para exports?

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Preservar CPF em clientCases (autenticado) | Busca por CPF necessária; removido apenas de publicResult |
| backfillClientCasesMirror sem merge: true | Evita campos stale no espelho |
| syncClientCaseOnUpdate sincroniza DONE | Classificação precisa refletir no portal do cliente |
| DEFAULT_QUERY_LIMIT conservador em 500 | Evita timeouts em collections grandes |
| Debounce com queueMicrotask + cleanup | Performance + segurança de memória |
| limitToLast(50) para mensagens | Evita índice descending extra |
| Browser Puppeteer sem estado de erro permanente | Sempre tenta relançar |
| Refatoração não começa sem plano aprovado | Prevenir regressão em produção |
| Downtime 2-5min aceitável | Blue-green é overkill para escopo atual |
| Cursor pagination primeiro | Resolve dor imediata dos usuários |
| Backward-compatible API | V1 intacta + V2 side-by-side |
| ExportJobs + polling | Simples, transparente, sem infra extra |
| maxInstances: 10 por provedor | Suficiente para backpressure inicial |
| Phase A sem modularização | Modularização é Phase C; Phase A = baseline + V2 apenas |
| Phase A sem remoção de código morto | Remoção é Phase D; requer análise semântica, não grep |
| Phase A sem export assíncrono | Export async é Phase B; Phase A apenas documenta |
| V2 sem total/stats por scan | Cursor pagination real não calcula total exato |
| Tie-breaker por `__name__` obrigatório | Evita duplicatas/omissões com timestamps iguais |
| Buscar `limit + 1` para hasMore | Evita necessidade de contagem total |
| Cursor em Base64 URL-safe | Seguro para URLs e JSON |
| Filtros não suportados: rejeitar ou flag | Nunca fallback silencioso para V1 |

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|-----------|
| — | — | — |

## Notes

- **Modo PLANO ativo**: Após aprovação do usuário, finalizar plano e criar arquivos de execução.
- **Métricas baselines** (pré-refatoração):
  - Frontend: ~891 testes, 39 arquivos, ~10s
  - Backend: ~571 testes, 48 arquivos
  - Monolito: 13.556 linhas, 47 callables, 10 triggers, 1 onRequest, 1 onSchedule, ~59 exports
  - Nós graphify: 1110
- **Deploy seguro**: backend primeiro, aguardar 5min, deploy frontend.
- **Rollback**: manter branch `pre-refactor` como backup.
- **Código morto identificado**: candidatos não confirmados em `auditCatalog.js`; análise semântica requerida antes de remoção.
- **Graphify**: Atualizar após cada fase major (`graphify update .`).
- **Phase A corrigida**: Não modulariza, não remove código morto, não implementa export async, não altera índices existentes.

---

> **Próximo passo:** Aguardar aprovação do usuário para iniciar Phase A corrigida (baseline/documentos + V2 cursor pagination side-by-side).
