# Findings — Análise de Gargalos ComplianceHub

> **Data:** 2026-05-29
> **Scope:** Frontend, Backend, Segurança, Arquitetura
> **Método:** Análise estática de código + trace de dependências + quantificação de impacto

---

## Executive Summary

Foram identificados **15 problemas** distribuídos em 4 categorias. Destes, **11 estão no escopo de correção** (4 excluídos por decisão do usuário: 1.2, 1.4, 1.5, 2.4).

| Categoria | Crítico | Alto | Médio | Baixo | Total |
|-----------|---------|------|-------|-------|-------|
| Segurança | 1 | 0 | 0 | 0 | 1 |
| Performance Backend | 2 | 3 | 1 | 0 | 6 |
| Performance Frontend | 3 | 0 | 0 | 0 | 3 |
| Arquitetura/Dívida | — | — | — | — | (fora do escopo) |

---

## Discovery 1: `fetchTenantCaseDocuments` — Leitura Ilimitada (CRÍTICO)

### Localização
- **Arquivo:** `functions/index.js:10809`
- **Função:** `fetchTenantCaseDocuments`
- **Constante:** `CASE_QUERY_PAGE_SIZE = 500` (linha 10372)

### Código atual
```javascript
async function fetchTenantCaseDocuments({ collectionId, tenantId = null, fields = [] }) {
    let lastDoc = null;
    let pageCount = 0;
    let scannedRecords = 0;
    const docs = [];

    while (true) {  // ← SEM LIMITE
        let q = db.collection(collectionId);
        if (tenantId) q = q.where('tenantId', '==', tenantId);
        q = q.orderBy('createdAt', 'desc');
        if (fields.length > 0) q = q.select(...fields);
        if (lastDoc) q = q.startAfter(lastDoc);
        q = q.limit(CASE_QUERY_PAGE_SIZE);
        const snap = await q.get();
        // ...
        if (currentDocs.length < CASE_QUERY_PAGE_SIZE) break;
        lastDoc = currentDocs[currentDocs.length - 1];
    }
    return { docs, pageCount, scannedRecords };
}
```

### Callers
- `listOpsCases` (linha 10920)
- `getClientExportCases` (linha 11032)
- `fetchCaseMetricDocuments` (linha 10764) — função quase idêntica

### Impacto quantitativo
- **Memória:** 50.000 docs × 2KB = **100 MB** de payload + overhead Node.js
- **Tempo:** 100 páginas × 100ms = **10 segundos** de I/O
- **Risco:** OOM kill (limite 1GiB) ou timeout de 120s

### Cenário de falha
Tenant com 50.000 casos (ex: cliente enterprise com histórico de 2 anos) invoca `listOpsCases`. A function carrega todos os casos em memória antes de filtrar. A instância é morta pelo Firebase antes de retornar.

### Correção ideal
Hard limit de 10.000 documentos com flag `capped` no retorno.

---

## Discovery 2: `repairAllClaims` — Query Unbounded (CRÍTICO)

### Localização
- **Arquivo:** `functions/index.js:6325`
- **Função:** `exports.repairAllClaims`

### Código atual
```javascript
const snapshot = await db.collection('userProfiles').get();  // ← SEM LIMITE
for (const doc of snapshot.docs) {
    await getAuth().setCustomUserClaims(targetUid, {...});  // Sequencial, ~100ms cada
}
```

### Impacto quantitativo
- 5.000 usuários × 100ms = **500 segundos** > timeout de 300s
- Snapshot consome **5-10 MB** de memória
- Falha silenciosa na metade → claims inconsistentes

### Código duplicado
- `functions/repair-all-claims.js` (duplica a lógica)
- `scripts/repair-all-claims.cjs` (duplica a lógica)

---

## Discovery 3: `CasoPage.jsx` — Componente Monolítico (CRÍTICO)

### Localização
- **Arquivo:** `src/portals/ops/CasoPage.jsx`
- **Tamanho:** 3.911 linhas, ~256 KB
- **Estados:** 30+ useState declarations

### Código problemático
```javascript
const update = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
};

const risk = useMemo(() => calculateRisk(form, enabledPhases), [form, enabledPhases]);
const checklist = useMemo(() => [/* 15 regras */], [enabledPhases, form, caseData, activeWarrantCount, risk]);
```

### Impacto
- Cada keystroke dispara recálculo de risk + checklist + allOk
- Componente de 3.911 linhas re-renderiza inteiro
- `activeWarrantCount` não memoizado (filtra array a cada render)

---

## Discovery 4: Subscriptions Firestore — Limite 500 (CRÍTICO)

### Localização
- **Arquivo:** `src/core/firebase/firestoreService.js`
- **Constante:** `DEFAULT_QUERY_LIMIT = 500` (linha 330)

### Funções afetadas
- `subscribeToCases` (500 docs)
- `subscribeToClientCases` (500 docs)
- `subscribeToAuditLogs` (500 docs)
- `subscribeToExports` (500 docs)
- `subscribeToCaseMessages` (**SEM LIMITE**)

### Impacto
- Dados truncados silenciosamente (sem alerta ao usuário)
- 500 leituras Firestore por subscriber
- 10 analistas = 5.000 leituras simultâneas

---

## Discovery 5: Exportação Frontend — Processamento Síncrono (CRÍTICO)

### Localização
- **Arquivo:** `src/portals/client/ExportacoesPage.jsx`
- **Funções:** `enrichCasesForExport` (linha 1007), `handleExport` (linha 1034)

### Código problemático
```javascript
const enriched = await Promise.all(casesToEnrich.map(async (c) => {
    return getCasePublicResult(c.id);  // Ilimitado paralelismo
}));
// buildPrintableHtml monolítico no main thread
```

### Impacto
- 50 casos = 50 requisições paralelas ao Firestore
- UI congela por 1-3s durante `buildPrintableHtml`
- Sem feedback visual ao usuário

---

## Discovery 6: PDF Puppeteer — Cold Start Extremo (ALTO)

### Localização
- **Arquivo:** `functions/helpers/pdfRenderer.js`
- **Função:** `renderHtmlToPdfBuffer` (linha 14)

### Código problemático
```javascript
browser = await puppeteer.launch({...});  // Novo browser a cada chamada
// ... renderiza ...
await browser.close();  // Fecha tudo
```

### Impacto
- Cold start: **10-20s** só para abrir Chromium
- Renderização: +30-60s para casos complexos
- Memory: **2GiB** alocada, Chromium consome 300-600MB
- Custo: cada PDF gera ~500-1000 vCPU-seconds desnecessários

---

## Discovery 7: DJEN Trigger — Timeout Default (ALTO)

### Localização
- **Arquivo:** `functions/index.js:4807`
- **Função:** `exports.enrichDjenOnCase`

### Código atual
```javascript
exports.enrichDjenOnCase = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1', secrets: [openaiApiKey] },
    async (event) => { ... }  // Sem timeoutSeconds → 60s default
);
```

### Impacto
- Loop com 500ms de delay por processo
- 20 processos = 10s só de espera + latência HTTP
- Timeout em casos complexos → pipeline travado

---

## Discovery 8: `writeClientCaseMirror` — JSON.stringify Não-Determinístico (ALTO)

### Localização
- **Arquivo:** `functions/index.js:5910`
- **Função:** `writeClientCaseMirror`

### Código problemático
```javascript
const payloadJson = JSON.stringify(payload);
const existingJson = JSON.stringify(existing);
if (payloadJson === existingJson) return;  // Problemas:
// 1. Ordem das chaves não garantida
// 2. Timestamps serializam como "{}"
// 3. CPU excessiva para docs grandes
```

### Impacto
- Skips writes legítimos quando timestamps mudam
- CPU spikes a cada update do case (10-20 updates por pipeline)
- Leitura extra no Firestore antes de decidir skipar

---

## Discovery 9: Cascata de Triggers (MÉDIO)

### Localização
- **Arquivo:** `functions/index.js`
- **Função:** `maybeRunAutoClassifyAndAi` → `runAutoClassifyAndAi` → `caseRef.update()`

### Cadeia de eventos
1. Judit completa → autoClassify → update case
2. Update dispara: syncClientCaseOnUpdate, publishResultOnCaseDone, enrichEscavadorOnCase
3. Escavador completa → autoClassify → update case
4. ... ciclo repete para DJEN

### Impacto
- ~12 invocações de trigger por caso
- Custo Firebase multiplicado
- `syncClientCaseOnUpdate` executa mesmo quando só campos derivados mudaram

---

## Discovery 10: `backfillClientCasesMirror` — Sem Permissões (CRÍTICO)

### Localização
- **Arquivo:** `functions/index.js:7227`
- **Função:** `exports.backfillClientCasesMirror`

### Código problemático
```javascript
await getOpsUserProfile(uid);  // Retorno descartado — não verifica role!
let q = db.collection('cases').limit(pageSize);  // Sem filtro de tenant
```

### Impacto
- Qualquer usuário autenticado pode invocar
- Lê cases de **todos os tenants**
- Escreve em `clientCases` de todos os tenants
- Vazamento de dados cross-tenant

---

## Discovery 11: Duplicação `reportBuilder.js` / `reportBuilder.cjs`

### Localização
- **Frontend:** `src/core/reportBuilder.js` (425 linhas)
- **Backend:** `functions/reportBuilder.cjs` (317 linhas)

### Funções duplicadas
- `esc()`, `formatDateBR()`, `formatCpfStatus()`
- `flagColor()`, `badge()`, `maskCpfValue()`
- `phaseRow()`, `listBlock()`, `timelineHtml()`

### Impacto
- Bug em um não corrige no outro
- Cada mudança de design requer 2 implementações
- Divergência silenciosa de versão

---

## Métricas de Impacto

| Métrica | Valor Atual | Após Correções |
|---------|-------------|----------------|
| Tempo de `listOpsCases` (10k docs) | 10s+ / OOM | <3s com cap |
| Tempo de `repairAllClaims` (5k users) | Timeout 300s | <60s |
| Cold start PDF | 10-20s | <3s (warm) |
| Invocações trigger por caso | ~12 | ~4 |
| UI freeze exportação (50 casos) | 1-3s | <500ms |
| Casos carregados no frontend | 500 (truncado) | 5.000 |

---

## Referências Cruzadas

| Descoberta | Arquivos Relacionados | Testes Afetados |
|------------|----------------------|-----------------|
| fetchTenantCaseDocuments | `index.js`, `firestoreService.js` | Nenhum direto |
| repairAllClaims | `index.js`, `repair-all-claims.js`, `scripts/repair-all-claims.cjs` | Nenhum |
| CasoPage.jsx | `CasoPage.jsx`, `CasoPage.test.jsx` | `CasoPage.test.jsx` |
| Subscriptions 500 | `firestoreService.js`, `useCases.js`, hooks | `firestoreService.test.js` |
| Exportação síncrona | `ExportacoesPage.jsx`, `ExportacoesPage.test.jsx` | `ExportacoesPage.test.jsx` |
| PDF cold start | `pdfRenderer.js`, `index.js` | Nenhum |
| DJEN timeout | `index.js`, `djen.js` | `djen.test.js` |
| JSON.stringify mirror | `index.js`, `clientPortal.js` | Nenhum |
| Cascata triggers | `index.js` (múltiplos triggers) | Nenhum |
| backfill permissions | `index.js` | Nenhum |
| reportBuilder duplicado | `src/core/reportBuilder.js`, `functions/reportBuilder.cjs` | Ambos |
