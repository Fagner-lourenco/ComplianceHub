# Findings — Refatoração do Monolito ComplianceHub

> **Data:** 2026-05-29
> **Scope:** Arquitetura, Escalabilidade, Modularização
> **Método:** Análise estática de código + graphify + trace de dependências + quantificação de impacto

---

## Executive Summary

O monolito `functions/index.js` possui **13.556 linhas** com **47 callables**, **10 triggers Firestore diretos**, **1 `onRequest`**, **1 `onSchedule`**, totalizando **~59 exports Firebase detectados por busca estática**. Análise via graphify identificou **1.110 nós** e **2.062 edges**, indicando acoplamento excessivo e dificuldade de manutenção.

Foram identificados **5 grandes gargalos de escala** que impedem crescimento para 100k+ casos:

| # | Gargalo | Severidade | Impacto |
|---|---------|------------|---------|
| 1 | Listagens com paginação interna mas acumulação em memória (scan até 10k docs) | CRÍTICO | OOM/timeout em tenants grandes |
| 2 | Export síncrono (120s timeout) | CRÍTICO | Quebra com >2k casos |
| 3 | Monolito 13k+ linhas | ALTO | Impossível testar isoladamente, mudanças arriscadas |
| 4 | Enriquecimento sem backpressure real | ALTO | Cascata de falhas em APIs externas |
| 5 | Código morto acumulado | MÉDIO | Confusão, bundle maior, risco de regressão |

---

## Discovery 1: Listagens com Paginação Interna + Acumulação em Memória (CRÍTICO)

### Localização
- **Arquivo:** `functions/index.js`
- **Funções:** `listOpsCases`, `listClientCases`, `getClientExportCases`, `fetchTenantCaseDocuments`

### Código problemático
```javascript
// fetchTenantCaseDocuments (linha ~10870)
// Usa startAfter internamente para buscar páginas de 500 docs,
// mas acumula TODOS os documentos em um array `docs` antes de retornar
while (scannedRecords < maxDocs) {
    let q = db.collection(collectionId);
    if (tenantId) q = q.where('tenantId', '==', tenantId);
    q = q.orderBy('createdAt', 'desc');
    if (lastDoc) q = q.startAfter(lastDoc);
    q = q.limit(Math.min(CASE_QUERY_PAGE_SIZE, maxDocs - scannedRecords));
    const snap = await q.get();
    // ... docs.push(...currentDocs.map(...))
}
```

```javascript
// listOpsCases (linha ~10920)
const { docs, pageCount, scannedRecords, capped } = await fetchTenantCaseDocuments({
    collectionId: 'cases', tenantId, fields: OPS_CASE_LIST_FIELDS,
});
const serialized = docs.map((docData) => serializeClientCaseDocument(docData));
const allMatches = serialized.filter((caseData) => matchesOpsCaseFilters(caseData, filters, { queueOnly, assigneeUid }));
allMatches.sort((left, right) => compareOpsCases(left, right, sortField, sortDir));
const start = (page - 1) * pageSize;
const pageCases = allMatches.slice(start, start + pageSize);
```

```javascript
// listClientCases (linha ~10980)
// Também pagina internamente com startAfter, mas acumula matches em memória
while (true) {
    let q = db.collection('clientCases')
        .where('tenantId', '==', profile.tenantId)
        .orderBy('createdAt', 'desc')
        .limit(CASE_QUERY_PAGE_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);
    // ... docs.forEach(...) → allMatches.push(serialized)
}
allMatches.sort((left, right) => compareClientCases(left, right, sortField, sortDir));
const pageCases = allMatches.slice(start, start + pageSize);
```

```javascript
// getClientExportCases (linha ~11032)
const { docs, pageCount, scannedRecords, capped } = await fetchTenantCaseDocuments({
    collectionId: 'clientCases', tenantId: profile.tenantId,
});
const cases = docs
    .map((docData) => serializeClientCaseDocument(docData))
    .filter((caseData) => matchesClientCaseFilters(caseData, filters))
    .filter((caseData) => (scopeCode === 'RED' ? caseData.riskLevel === 'RED' || caseData.riskLevel === 'HIGH' : true));
```

### Problema Real
O problema **não é ausência absoluta de `startAfter`**. O problema real é que:

1. **`fetchTenantCaseDocuments`** usa `startAfter` para buscar dados em batches de 500, mas **acumula todos os documentos em memória** antes de retornar. Para um tenant com 50.000 casos:
   - **Memória:** 50.000 × 2KB = **100 MB** de payload
   - **Tempo:** 100 páginas × 100ms = **10 segundos** de I/O
   - **Risco:** OOM kill (limite 1GiB) ou timeout de 120s

2. **`listOpsCases`** e **`listClientCases`** filtram e ordenam **em memória** (`matches*CaseFilters`, `compare*Cases`), depois fazem `slice((page-1)*pageSize, page*pageSize)`. Isso não é cursor pagination real — é "offset pagination falsa" que ainda requer carregar todos os docs.

3. **`getClientExportCases`** carrega **todos** os casos filtrados em uma callable (120s timeout), pior cenário.

### Callers afetados
1. `listOpsCases` — carrega todos os cases do tenant via `fetchTenantCaseDocuments`, filtra/sorta em memória
2. `listClientCases` — mesmo padrão, com paginação interna até `CLIENT_CASE_SEARCH_SCAN_LIMIT = 10000`
3. `getClientExportCases` — carrega todos para export (pior cenário)
4. `getOpsCaseMetrics` / `getClientDashboardMetrics` — agregação em tempo real

### Solução proposta
Implementar **cursor pagination real** por Firestore:
- Queries com `orderBy` + `startAfter` + `limit` que **não acumulam** em memória
- Índices compostos para cada combinação de filtros
- Retorno: `{ results, nextCursor }` — nunca carregar tudo em memória
- **Tie-breaker obrigatório por `__name__` (document ID)** para evitar duplicatas/omissões quando timestamps são iguais
- **Buscar `limit + 1`** para calcular `hasMore` sem necessidade de `total`

---

## Discovery 2: Export Síncrono (CRÍTICO)

### Localização
- **Arquivo:** `functions/index.js:11032`
- **Função:** `getClientExportCases`
- **Frontend:** `src/portals/client/ExportacoesPage.jsx`

### Código problemático
```javascript
// Backend: retorna TUDO numa callable
const { docs, pageCount, scannedRecords, capped } = await fetchTenantCaseDocuments({
    collectionId: 'clientCases', tenantId: profile.tenantId,
});
const cases = docs.map(...).filter(...).filter(...);
return { cases, total: cases.length, pendingCount, meta: { scannedRecords, pageCount, capped } };

// Frontend: asyncPool(5) chamando getCasePublicResult para cada caso
```

### Impacto
- **Backend:** 120s timeout em callable — quebra com >2.000 casos
- **Frontend:** UI congela durante processamento
- **Browser:** múltiplas requisições paralelas = memory leak, throttling

### Solução proposta
**Export assíncrono com Cloud Storage (Phase B):**
1. Frontend chama `createExportJob(filters, format)`
2. Backend cria doc em `exportJobs` com status `pending`
3. Trigger `onCreate` dispara worker que processa em background
4. Worker pagina cases (500/batch), formata, upload para Storage
5. Frontend faz polling a cada 3s via `getExportJobStatus(jobId)`
6. Quando `done`, frontend recebe URL signed para download

**Nota:** Phase A não implementa export assíncrono. Apenas documenta a necessidade.

---

## Discovery 3: Monolito 13.556 Linhas (ALTO)

### Localização
- **Arquivo:** `functions/index.js`

### Métricas (detectadas por busca estática)
| Métrica | Valor |
|---------|-------|
| Linhas de código | **13.556** |
| Callables (`onCall`) | **47** |
| Triggers Firestore diretos (`onDocument*`) | **10** |
| `onRequest` | **1** |
| `onSchedule` | **1** |
| Total exports detectados | **~59** |
| Funções internas | ~300 |
| Nós graphify | 1.110 |
| Edges graphify | 2.062 |

### Problemas
1. **Testabilidade:** Impossível testar uma função sem carregar todo o arquivo
2. **Code review:** PRs de 500+ linhas são impossíveis de revisar efetivamente
3. **Hot reload:** Qualquer mudança recompila todo o monolito (30-60s)
4. **Deploy:** Uma function quebra = todo o backend quebra
5. **Onboarding:** Novo dev leva dias para entender o fluxo

### Solução proposta
**Extração em módulos coesos (Phase C):**
```
functions/modules/
├── caseManager/         # CRUD cases, listagem, busca
├── enrichmentPipeline/  # Judit, Escavador, BigDataCorp, DJEN, IA
├── reportEngine/        # HTML, PDF, publicação
├── userManager/         # Auth, roles, claims
├── clientPortal/        # clientCases, quotas, export
├── auditManager/        # Logs, eventos, rastreabilidade
└── notificationManager/ # Notificações, push
```

**Nota:** Phase A não cria `functions/modules/*`. Modularização é exclusiva da Phase C.

---

## Discovery 4: Enriquecimento Sem Backpressure (ALTO)

### Localização
- **Arquivo:** `functions/index.js`
- **Adapters:** `functions/adapters/judit.js`, `escavador.js`, `bigdatacorp.js`, `djen.js`

### Código problemático
```javascript
// Cada trigger de enriquecimento dispara imediatamente
exports.enrichJuditOnCase = onDocumentUpdated(..., async (event) => {
    // ... chama Judit API sem fila, sem rate limit, sem retry backoff
});
```

### Impacto
- Judit falha → trigger falha → case fica preso
- 100 casos criados ao mesmo tempo = 100 chamadas paralelas à Judit
- Sem circuit breaker por provedor (apenas global)
- Sem fila para retry em caso de rate limit

### Solução proposta (Fase F — fora do escopo inicial)
1. **Cloud Tasks por provedor:** cada enriquecimento vira uma task na fila
2. **Rate limiting:** max 5 tasks/min por provedor
3. **Retry com backoff:** exponential backoff, max 5 tentativas
4. **Dead letter queue:** tasks que falham 5x vão para DLQ para análise

**Imediato (este plano):**
- Adicionar `maxInstances: 10` por trigger de enriquecimento
- Reforçar circuit breaker existente

---

## Discovery 5: Candidatos a Auditoria de Código Morto (MÉDIO)

### Localização
- **Arquivo:** `functions/audit/auditCatalog.js`
- **Arquivo:** `functions/index.js` (funções não chamadas)

### Candidatos identificados
```javascript
// auditCatalog.js — exports usados internamente
exports.ENTITY_TYPE = { /* ... */ };
exports.ACTOR_TYPE = { /* ... */ };
exports.getActionConfig = (action) => { /* ... */ };
```

### Status
**NÃO CONFIRMADO COMO REMOVÍVEL.** Verificação via `grep` simples não é suficiente:
- `ENTITY_TYPE`, `ACTOR_TYPE`, `getActionConfig` são usados **internamente** em `writeAuditEvent.js` (que os importa do `auditCatalog.js`)
- Remoção requer análise semântica do fluxo de auditoria, não apenas busca textual

### Classificação
| Candidato | Status | Rationale |
|-----------|--------|-----------|
| `ENTITY_TYPE` | NÃO CONFIRMADO | Pode ser usado internamente em `writeAuditEvent` |
| `ACTOR_TYPE` | NÃO CONFIRMADO | Pode ser usado internamente em `writeAuditEvent` |
| `getActionConfig` | NÃO CONFIRMADO | Pode ser usado internamente em `writeAuditEvent` |
| Funções órfãs em `index.js` | CANDIDATOS | Requer análise profunda de dependências |

### Solução proposta
1. Auditar cada export do monolito com análise semântica (não apenas grep)
2. Cruzar com referências em frontend + outros módulos
3. Classificar em:
   - **REMOVÍVEL COM SEGURANÇA** — nenhuma referência, testes cobrem ausência
   - **PROVAVELMENTE REMOVÍVEL, MAS PRECISA TESTE** — referências indiretas ou dinâmicas
   - **NÃO CONFIRMADO** — requer análise manual
   - **NÃO REMOVER** — usado em fluxo crítico

**Nota:** Remoção de código morto fica **fora da Phase A**. É responsabilidade da Phase D, após modularização.

---

## Correção de Escopo da Phase A

A Phase A foi **restringida e corrigida** para ser uma fase de baseline + documentação + V2 side-by-side, **sem**:

- ❌ Modularização (não criar `functions/modules/*`)
- ❌ Remoção de código morto
- ❌ Export assíncrono
- ❌ Deploy de índices (apenas planejamento)
- ❌ Remoção de índices existentes
- ❌ Alteração de callables V1 existentes

A Phase A **deve**:
- ✅ Criar V2 side-by-side, preservando V1 intacta
- ✅ Evitar scan completo silencioso (não carregar tudo em memória)
- ✅ Usar cursor composto com tie-breaker por document ID
- ✅ Documentar contratos e migration path
- ✅ Planejar índices necessários (sem deploy)
- ✅ Testar em emulador/local (sem alterar dados reais)

---

## Métricas de Impacto Esperado (Pós-Refatoração)

| Métrica | Valor Atual | Target | Melhoria |
|---------|-------------|--------|----------|
| Tamanho do monolito | 13.556 linhas | < 500 linhas | **96% redução** |
| Tempo de listagem (10k docs) | 10s+ / OOM | < 2s | **5x+** |
| Export (50k casos) | Timeout 120s | < 5 min (async) | **Infinito** |
| Cold start PDF | 10-20s | < 3s (warm) | **3-6x** |
| Invocações trigger por caso | ~12 | ~4 | **3x** |
| Testes isolados por módulo | 0 | 100+ | **Novo** |
| Tempo de build functions | 30-60s | < 5s | **6-12x** |

---

## Referências Cruzadas

| Descoberta | Arquivos Relacionados | Testes Necessários |
|------------|----------------------|-------------------|
| Cursor pagination | `firestoreService.js`, `index.js`, `firestore.indexes.json` | `paginateFirestoreQuery.test.js`, `listOpsCasesV2.test.js` |
| Export async | `ExportacoesPage.jsx`, `index.js` | `exportManager.test.js`, `exportWorker.test.js` |
| Modularização | `index.js`, `modules/*` | Testes por módulo (7 módulos) |
| Backpressure | `adapters/*.js`, `index.js` | Testes de carga, circuit breaker |
| Código morto | `auditCatalog.js`, `index.js` | Análise semântica + testes de regressão |

---

## Riscos Identificados

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Regressão em callable durante extração | Alta | Alto | Testes de contrato, branch `pre-refactor` |
| Índice Firestore não propagado a tempo | Média | Alto | Deploy índices 24h antes, validar no console |
| Worker de export excede timeout (9min) | Média | Médio | Paginação interna, progresso parcial, retry |
| Frontend não adapta a paginação | Baixa | Alto | Manter V1 operante, migration path documentado |
| Módulo circular (A importa B, B importa A) | Baixa | Alto | Contratos claros, shared layer |
| Filtros textuais/search não indexáveis | Alta | Médio | Rejeitar em V2 ou cair para V1 com flag explícita |
| `stats`/`total` exatos exigem scan completo | Média | Médio | Não retornar `total` em V2; usar contadores aproximados |

---

## Notas Técnicas

- **Firestore Cursor:** `startAfter` requer que o campo de ordenação seja único ou composto. **Obrigatório usar `__name__` (document ID) como tie-breaker**.
- **Cursor Encoder:** Base64 URL-safe do array `[fieldValue, docId]` para evitar parsing ambíguo.
- **Limit + 1:** Buscar `limit + 1` docs para calcular `hasMore` sem necessidade de contagem total.
- **Storage Bucket:** Usar bucket padrão do Firebase (`{projectId}.firebasestorage.app`) ou criar `exports.{projectId}.firebasestorage.app`.
- **TTL:** Firestore TTL é eventual (pode levar 72h). Para garantia imediata, usar Cloud Scheduler.
- **maxInstances:** Firebase Functions Gen2 suporta `maxInstances` por function. Recomendado: 10 para enriquecimento, 100 para callables.
- **Circuit Breaker:** Já existe em `functions/helpers/circuitBreaker.js`. Precisa ser movido para `modules/_shared/` (Phase C).
- **Auditoria:** Subscriptions de auditLogs usam `occurredAt` (não `createdAt`). Índices de auditoria existentes usam `occurredAt`.
- **Índices:** Não remover índices nesta fase. Adicionar apenas estritamente necessários.

---

> **Atualizado em:** 2026-05-29
> **Próxima revisão:** Após conclusão da Phase A corrigida
