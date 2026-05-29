# Task Plan — Correção de Gargalos Críticos ComplianceHub

> **Status:** Planejamento concluído. Aguardando aprovação para execução.
> **Criado em:** 2026-05-29
> **Scope:** 11 itens de segurança, performance e estabilidade (excluídos: 1.2, 1.4, 1.5, 2.4)

---

## Goal

Corrigir todos os gargalos críticos e de alta severidade identificados na análise de performance e segurança do ComplianceHub, sem introduzir regressão, mantendo compatibilidade com o fluxo de enriquecimento existente e preservando todos os testes passando.

## Constraints

- **Não remover** código sem validar dependências via `grep` e leitura de callers
- **Não alterar** interfaces públicas de callables (manter mesma assinatura de entrada/saída)
- **Preservar** `DEFAULT_QUERY_LIMIT = 500` para subscriptions realtime legítimas
- **Manter** compatibilidade com demo mode e mock data
- **TDD:** Testes RED → Implementação → Testes GREEN para cada item
- **Verificações obrigatórias** antes de cada commit: lint, test frontend, test backend, build
- **Deploy separado:** backend primeiro, frontend depois, com janela de observação

---

## Phase Overview

| Phase | Nome | Itens | Est. Horas | Status |
|-------|------|-------|------------|--------|
| 0 | Infraestrutura e Helpers | Criar rateLimiter.js, transaction wrappers | 2h | 🔲 Pending |
| 1 | Segurança Crítica | 1.3 (backfill permissions) | 3h | 🔲 Pending |
| 2 | Performance Backend | 2.1, 2.2, 2.3, 2.5, 2.6 | 8h | 🔲 Pending |
| 3 | Performance Frontend | 3.1, 3.2, 3.3 | 6h | 🔲 Pending |
| 4 | Remoção de Código Morto | Arquivos duplicados, funções não chamadas | 1h | 🔲 Pending |
| 5 | Validação e Deploy | Testes completos, smoke test, deploy | 2h | 🔲 Pending |
| **Total** | | | **~22h** | |

---

## Phase 0 — Infraestrutura e Helpers

### 0.1 Criar `functions/helpers/rateLimiter.js`

**Motivação:** Embora o item 1.5 (rate limiting em callables) tenha sido excluído do escopo, o helper de rate limiting é necessário para o item 1.3 (backfillClientCasesMirror), que deve ter proteção contra reexecução acidental.

**Arquivo:** `functions/helpers/rateLimiter.js` (novo)  
**Teste:** `functions/helpers/rateLimiter.test.js` (novo)  
**Estimativa:** 2 horas  
**Risco:** Baixo — função pura, não afeta fluxo existente

---

#### PASSO 0.1.1 — Análise Pré-Implementação

- [ ] **Ler** `functions/helpers/circuitBreaker.js` para entender padrão de acesso Firestore usado no projeto
- [ ] **Verificar** se existe algum helper de rate limiting existente (`grep -r "rate" functions/helpers/ --include="*.js"`)
- [ ] **Ler** `functions/package.json` para confirmar versão do `firebase-admin` (deve suportar `runTransaction`)
- [ ] **Verificar** se há testes existentes em `functions/helpers/` para seguir o mesmo padrão

#### PASSO 0.1.2 — Implementação do Helper

**Arquivo:** `functions/helpers/rateLimiter.js`

```javascript
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 10;

/**
 * Verifica se o identificador excedeu o limite de requisições na janela de tempo.
 * Usa Firestore + transaction para atomicidade.
 * 
 * @param {string} identifier - UID do usuário ou IP
 * @param {Object} options
 * @param {number} options.windowMs - Janela de tempo em ms (default: 60000)
 * @param {number} options.maxRequests - Máximo de requisições na janela (default: 10)
 * @param {string} options.key - Chave de contexto (default: 'default')
 * @throws {Error} com code: 'resource-exhausted' se limite excedido
 */
async function checkRateLimit(identifier, { windowMs = DEFAULT_WINDOW_MS, maxRequests = DEFAULT_MAX_REQUESTS, key = 'default' } = {}) {
    const db = getFirestore();
    const ref = db.collection('rateLimits').doc(`${identifier}:${key}`);
    const now = Date.now();
    const windowStart = now - windowMs;

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists ? snap.data() : {};
        const requests = Array.isArray(data.requests) ? data.requests : [];
        
        // Filtrar apenas requisições dentro da janela
        const recent = requests.filter(ts => ts > windowStart);
        
        if (recent.length >= maxRequests) {
            const err = new Error('RATE_LIMIT_EXCEEDED');
            err.code = 'resource-exhausted';
            throw err;
        }
        
        recent.push(now);
        tx.set(ref, { requests: recent, updatedAt: FieldValue.serverTimestamp() });
    });
}

module.exports = { checkRateLimit };
```

**Checklist de implementação:**
- [ ] Criar arquivo com a função acima
- [ ] Garantir que não há import circular com outros helpers
- [ ] Garantir que não quebra o build do backend

#### PASSO 0.1.3 — Implementação dos Testes

**Arquivo:** `functions/helpers/rateLimiter.test.js`

**Cenários a testar:**

| # | Cenário | Expectativa |
|---|---------|-------------|
| 1 | 3 requisições dentro da janela | Todas permitidas (não throw) |
| 2 | 4ª requisição na mesma janela | Throw com `err.code === 'resource-exhausted'` |
| 3 | Após windowMs passar, nova requisição | Permitida (timestamps antigos limpos) |
| 4 | Identifier A atinge limite, Identifier B solicita | B permitido (isolamento) |
| 5 | Duas chamadas simultâneas (concorrência) | Transaction resolve atomicamente, uma é rejeitada |
| 6 | Collection `rateLimits` não existe | Criada automaticamente na primeira chamada |

**Checklist de testes:**
- [ ] Mock do `getFirestore()` e `runTransaction()`
- [ ] Mock do `FieldValue.serverTimestamp()`
- [ ] Teste 1: 3 calls → nenhum throw
- [ ] Teste 2: 4th call → throw com code correto
- [ ] Teste 3: wait > windowMs → 4th call permitida
- [ ] Teste 4: identifier A limitado, identifier B livre
- [ ] Teste 5: simular race condition
- [ ] Teste 6: collection vazia → cria doc

#### PASSO 0.1.4 — Validação

- [ ] `cd functions && npm test -- rateLimiter.test.js` → TODOS passam
- [ ] `cd functions && npm run lint` → 0 erros, 0 warnings
- [ ] `cd functions && npm test` → todos os 513+ testes existentes ainda passam (sem regressão)
- [ ] Commit: `feat(infra): add rate limiter helper with Firestore-backed sliding window`

---

## Phase 1 — Segurança Crítica

### 1.1 `backfillClientCasesMirror` sem permissões

**Severidade:** CRÍTICO  
**Arquivo:** `functions/index.js:7227`  
**Risco:** Qualquer usuário autenticado pode invocar e ler/escrever cases de todos os tenants  
**Estimativa:** 3 horas  
**Risco de regressão:** Médio — altera callable administrativo

---

#### PASSO 1.1.1 — Análise Pré-Implementação

- [ ] **Ler** `functions/index.js` linhas 7227-7262 (função atual)
- [ ] **Ler** `functions/index.js` linhas próximas a `getOpsUserProfile` para entender o padrão de verificação de role
- [ ] **Grep** no frontend: `grep -r "backfillClientCasesMirror" src/ --include="*.js" --include="*.jsx"`
- [ ] **Verificar** se existe teste para `backfillClientCasesMirror` atualmente
- [ ] **Ler** `functions/index.js` linhas 5909+ para entender `buildClientCasePayload` (usado dentro do backfill)
- [ ] **Verificar** se `systemLocks` collection já existe no código (usada em outros lugares?)

#### PASSO 1.1.2 — Backup do Código Original

- [ ] Copiar trecho atual das linhas 7227-7262 para um comentário ou arquivo temporário
- [ ] Documentar o comportamento atual em `findings.md` (já feito)

#### PASSO 1.1.3 — Implementação da Correção

**Alterações em `functions/index.js`:**

**Linha ~7232 (verificação de role):**
```javascript
// DE:
await getOpsUserProfile(uid);

// PARA:
const profile = await getOpsUserProfile(uid);
if (!['admin', 'owner'].includes(profile.role)) {
    throw new HttpsError('permission-denied', 'Apenas administradores podem executar backfill.');
}
```

**Linha ~7240 (filtro de tenant):**
```javascript
// DE:
let q = db.collection('cases').limit(pageSize);

// PARA:
const targetTenant = request.data?.tenantId || profile.tenantId;
if (!targetTenant) {
    throw new HttpsError('invalid-argument', 'tenantId obrigatorio para backfill.');
}
let q = db.collection('cases').where('tenantId', '==', targetTenant).limit(pageSize);
```

**Linha ~7233 (lock de reexecução):**
```javascript
// ADICIONAR após a verificação de role:
const lockRef = db.collection('systemLocks').doc('backfillClientCasesMirror');
const lockSnap = await lockRef.get();
if (lockSnap.exists && lockSnap.data().locked === true) {
    throw new HttpsError('failed-precondition', 'Backfill ja em execucao.');
}
await lockRef.set({ 
    locked: true, 
    startedBy: uid, 
    startedAt: FieldValue.serverTimestamp() 
});

try {
    // ... loop de backfill existente ...
} finally {
    await lockRef.update({ 
        locked: false, 
        finishedAt: FieldValue.serverTimestamp() 
    });
}
```

**Checklist de implementação:**
- [ ] Adicionar verificação de role (`admin`/`owner`)
- [ ] Adicionar atribuição do retorno de `getOpsUserProfile` para `profile`
- [ ] Adicionar extração de `targetTenant`
- [ ] Adicionar validação de `targetTenant`
- [ ] Adicionar filtro `where('tenantId', '==', targetTenant)` na query
- [ ] Adicionar lock com `systemLocks` collection
- [ ] Garantir unlock no `finally`
- [ ] Verificar que `return { synced: count }` ainda funciona

#### PASSO 1.1.4 — Testes de Não Regressão

**Arquivo:** `functions/index.test.js` (novo) OU adicionar em arquivo de teste existente

| # | Teste | Setup | Expectativa |
|---|-------|-------|-------------|
| 1 | Analyst chamando | `request.auth.uid` com role `analyst` | `HttpsError('permission-denied')` |
| 2 | Owner sem tenantId | `request.auth.uid` com role `owner`, sem `tenantId` | `HttpsError('invalid-argument')` |
| 3 | Admin com tenantId | `request.auth.uid` com role `admin`, `tenantId: 'tenant1'` | Query inclui `where('tenantId', '==', 'tenant1')` |
| 4 | Lock ativo | Doc `systemLocks/backfillClientCasesMirror` com `locked: true` | `HttpsError('failed-precondition')` |
| 5 | Sem lock, 2 tenants | Cases em `tenant1` e `tenant2`, caller de `tenant1` | Apenas cases de `tenant1` processados |
| 6 | Lock liberado | Após execução, verificar `systemLocks` | `locked: false`, `finishedAt` presente |

**Checklist de testes:**
- [ ] Mock de `getFirestore()`, `collection()`, `doc()`, `get()`, `set()`, `update()`
- [ ] Mock de `getOpsUserProfile()`
- [ ] Mock de `HttpsError`
- [ ] Mock de `buildClientCasePayload()` (se necessário)
- [ ] Teste 1: analyst → permission-denied
- [ ] Teste 2: owner sem tenantId → invalid-argument
- [ ] Teste 3: admin com tenantId → where clause correto
- [ ] Teste 4: lock ativo → failed-precondition
- [ ] Teste 5: tenant isolation → count correto
- [ ] Teste 6: lock cleanup → unlocked after execution

#### PASSO 1.1.5 — Validação de Não Regressão

- [ ] `cd functions && npm test` → todos os 513+ testes existentes passam
- [ ] `cd functions && npm run lint` → 0 erros, 0 warnings
- [ ] Verificar que `getClientExportCases` ainda funciona (não usa mesma função, mas validar)
- [ ] Verificar que `listOpsCases` ainda funciona
- [ ] Commit: `fix(security): add role and tenant validation to backfillClientCasesMirror`

---

## Phase 2 — Performance Backend

### 2.1 `fetchTenantCaseDocuments` sem limite total

**Severidade:** CRÍTICO  
**Arquivo:** `functions/index.js:10809`  
**Risco:** OOM/timeout em tenants grandes (10k+ casos)  
**Estimativa:** 2 horas  
**Risco de regressão:** Baixo — adiciona parâmetro opcional com default

---

#### PASSO 2.1.1 — Análise Pré-Implementação

- [ ] **Ler** `functions/index.js` linhas 10370-10375 (constantes próximas)
- [ ] **Ler** `functions/index.js` linhas 10809-10832 (`fetchTenantCaseDocuments`)
- [ ] **Ler** `functions/index.js` linhas 10920-10940 (`listOpsCases` — caller)
- [ ] **Ler** `functions/index.js` linhas 11032-11050 (`getClientExportCases` — caller)
- [ ] **Ler** `functions/index.js` linhas 10764-10786 (`fetchCaseMetricDocuments` — função similar)
- [ ] **Verificar** se `CASE_QUERY_PAGE_SIZE` é usada em outros lugares (`grep -n "CASE_QUERY_PAGE_SIZE" functions/index.js`)
- [ ] **Decidir:** Unificar `fetchTenantCaseDocuments` e `fetchCaseMetricDocuments`? (Se sim, criar sub-task)

#### PASSO 2.1.2 — Implementação da Correção

**Arquivo:** `functions/index.js`

**Linha ~10372 (nova constante):**
```javascript
const CASE_QUERY_MAX_DOCS = 10000;
```

**Linhas 10809-10832 (função modificada):**
```javascript
async function fetchTenantCaseDocuments({ 
    collectionId, 
    tenantId = null, 
    fields = [], 
    maxDocs = CASE_QUERY_MAX_DOCS 
}) {
    let lastDoc = null;
    let pageCount = 0;
    let scannedRecords = 0;
    const docs = [];

    while (scannedRecords < maxDocs) {
        let q = db.collection(collectionId)
            .orderBy('createdAt', 'desc')
            .limit(Math.min(CASE_QUERY_PAGE_SIZE, maxDocs - scannedRecords));
        
        if (tenantId) q = q.where('tenantId', '==', tenantId);
        if (fields.length > 0) q = q.select(...fields);
        if (lastDoc) q = q.startAfter(lastDoc);
        
        const snap = await q.get();
        const currentDocs = snap.docs || [];
        scannedRecords += currentDocs.length;
        docs.push(...currentDocs.map(d => ({ id: d.id, ...d.data() })));
        
        if (currentDocs.length < CASE_QUERY_PAGE_SIZE) break;
        lastDoc = currentDocs[currentDocs.length - 1];
    }

    return { docs, pageCount, scannedRecords, capped: scannedRecords >= maxDocs };
}
```

**Modificar callers:**

**`listOpsCases` (linha ~10934):**
```javascript
// Propagar capped no retorno
return {
    cases: pageCases,
    total: allMatches.length,
    // ... outros campos ...
    meta: {
        // ... campos existentes ...
        capped: fetchResult.capped,
    },
};
```

**`getClientExportCases` (linha ~11045):**
```javascript
// Similar propagation
return {
    cases: exportCases,
    // ...
    meta: {
        // ...
        capped: fetchResult.capped,
    },
};
```

**Checklist de implementação:**
- [ ] Adicionar `CASE_QUERY_MAX_DOCS` constante
- [ ] Adicionar `maxDocs` parâmetro com default
- [ ] Modificar condição do `while`
- [ ] Adicionar `capped` no return
- [ ] Modificar `listOpsCases` para propagar `capped`
- [ ] Modificar `getClientExportCases` para propagar `capped`
- [ ] **NÃO modificar** `fetchCaseMetricDocuments` (fora do escopo, risco de regressão)

#### PASSO 2.1.3 — Testes de Não Regressão

**Arquivo:** Novo teste em `functions/index.test.js` ou arquivo dedicado

| # | Teste | Setup | Expectativa |
|---|-------|-------|-------------|
| 1 | 10.001 cases | Mock de 10.001 docs | Retorna 10.000, `capped: true` |
| 2 | 100 cases | Mock de 100 docs | Retorna 100, `capped: false` |
| 3 | Sem maxDocs | Chamada sem `maxDocs` | Usa default 10.000 |
| 4 | Com maxDocs=500 | Chamada com `maxDocs: 500` | Retorna 500, respeita parâmetro |
| 5 | listOpsCases propaga | `listOpsCases` chamado | `meta.capped` presente na resposta |
| 6 | Tenant pequeno | 50 cases | Retorna 50, `capped: false`, funciona normalmente |

**Checklist de testes:**
- [ ] Mock de `db.collection()`, `orderBy()`, `where()`, `limit()`, `startAfter()`, `get()`
- [ ] Simular paginação (múltiplas chamadas ao `get()`)
- [ ] Teste 1: 10.001 cases → 10.000 + capped
- [ ] Teste 2: 100 cases → 100 + !capped
- [ ] Teste 3: default maxDocs
- [ ] Teste 4: custom maxDocs
- [ ] Teste 5: listOpsCases integration
- [ ] Teste 6: tenant pequeno (não regressão)

#### PASSO 2.1.4 — Validação

- [ ] `cd functions && npm test` → 513+ testes passam
- [ ] `cd functions && npm run lint` → 0 erros
- [ ] `npm test` → 820+ testes frontend passam
- [ ] Commit: `perf(backend): add hard limit to fetchTenantCaseDocuments to prevent OOM`

---

### 2.2 `repairAllClaims` sem paginação

**Severidade:** CRÍTICO  
**Arquivo:** `functions/index.js:6325`  
**Risco:** Timeout em massa (>300s) com 5k+ usuários  
**Estimativa:** 2 horas  
**Risco de regressão:** Médio — altera loop principal da função

---

#### PASSO 2.2.1 — Análise Pré-Implementação

- [ ] **Ler** `functions/index.js` linhas 6325-6365 (função atual)
- [ ] **Verificar** `functions/repair-all-claims.js` existe e se é igual
- [ ] **Verificar** `scripts/repair-all-claims.cjs` existe e se é igual
- [ ] **Grep** por chamadas: `grep -r "repair-all-claims" . --include="*.js" --include="*.cjs" --include="*.json"`
- [ ] **Verificar** `package.json` scripts que possam chamar esses arquivos
- [ ] **Ler** documentação Firebase sobre `setCustomUserClaims` rate limits

#### PASSO 2.2.2 — Implementação da Correção

**Arquivo:** `functions/index.js`

**Linhas 6325-6365 (função modificada):**
```javascript
exports.repairAllClaims = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 300, memory: '1GiB', cors: true },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const callerDoc = await db.collection('userProfiles').doc(uid).get();
        const callerData = callerDoc.data() || {};
        if (!['admin', 'owner'].includes(callerData.role)) {
            throw new HttpsError('permission-denied', 'Apenas administradores podem executar reparo em massa.');
        }

        const BATCH_SIZE = 500;
        const CONCURRENCY = 10;
        let lastDoc = null;
        let fixed = 0;
        let skipped = 0;
        let errors = 0;
        let total = 0;

        while (true) {
            let q = db.collection('userProfiles')
                .orderBy('__name__')
                .limit(BATCH_SIZE);
            if (lastDoc) q = q.startAfter(lastDoc);
            
            const snap = await q.get();
            if (snap.empty) break;

            const batch = snap.docs;
            total += batch.length;
            lastDoc = batch[batch.length - 1];

            // Processar em paralelo com limite de concorrência
            for (let i = 0; i < batch.length; i += CONCURRENCY) {
                const chunk = batch.slice(i, i + CONCURRENCY);
                await Promise.all(chunk.map(async (doc) => {
                    const data = doc.data();
                    const targetUid = doc.id;

                    if (!data.role || !data.tenantId) {
                        skipped++;
                        return;
                    }

                    try {
                        await getAuth().setCustomUserClaims(targetUid, {
                            role: data.role,
                            tenantId: data.tenantId,
                        });
                        fixed++;
                    } catch {
                        errors++;
                    }
                }));
            }
        }

        return { success: true, total, fixed, skipped, errors };
    },
);
```

**Checklist de implementação:**
- [ ] Substituir `db.collection('userProfiles').get()` por paginação
- [ ] Adicionar `orderBy('__name__')` para cursor estável
- [ ] Adicionar `startAfter(lastDoc)` para paginação
- [ ] Substituir `for...of` sequencial por chunks paralelos
- [ ] Adicionar `CONCURRENCY = 10` para evitar rate limit do Auth
- [ ] Manter contadores `total`, `fixed`, `skipped`, `errors`
- [ ] Manter `return` object com mesmas chaves

#### PASSO 2.2.3 — Remoção de Código Duplicado

**Arquivos a remover (após validação):**
- `functions/repair-all-claims.js`
- `scripts/repair-all-claims.cjs`

**Checklist:**
- [ ] `grep -r "repair-all-claims" .` → 0 resultados (exceto o próprio arquivo)
- [ ] `cat functions/repair-all-claims.js` → confirmar que é cópia
- [ ] `cat scripts/repair-all-claims.cjs` → confirmar que é cópia
- [ ] `git rm functions/repair-all-claims.js`
- [ ] `git rm scripts/repair-all-claims.cjs`
- [ ] Commit separado: `chore: remove duplicate repair-all-claims files`

#### PASSO 2.2.4 — Testes de Não Regressão

| # | Teste | Setup | Expectativa |
|---|-------|-------|-------------|
| 1 | 1.000 usuários | Mock de 1.000 docs | `total === 1000`, processado em <5s |
| 2 | 5.000 usuários | Mock de 5.000 docs | `fixed + skipped + errors === 5000` |
| 3 | Sem role/tenantId | Alguns docs sem `role` ou `tenantId` | `skipped` incrementado, não quebra |
| 4 | Auth falha em 1 | `setCustomUserClaims` falha em 1 usuário | `errors++`, outros continuam |
| 5 | Paginação | Mais de 500 usuários | Usa `startAfter`, múltiplas páginas |
| 6 | Retorno | Qualquer cenário | Retorna `{ success, total, fixed, skipped, errors }` |

**Checklist de testes:**
- [ ] Mock de `db.collection().orderBy().limit().get()` com paginação
- [ ] Mock de `getAuth().setCustomUserClaims()`
- [ ] Teste 1: 1.000 usuários
- [ ] Teste 2: 5.000 usuários
- [ ] Teste 3: usuários incompletos
- [ ] Teste 4: falha parcial
- [ ] Teste 5: múltiplas páginas
- [ ] Teste 6: estrutura do retorno

#### PASSO 2.2.5 — Validação

- [ ] `cd functions && npm test` → 513+ testes passam
- [ ] `cd functions && npm run lint` → 0 erros
- [ ] Commit 1: `perf(backend): paginate repairAllClaims to handle large user bases`
- [ ] Commit 2: `chore: remove duplicate repair-all-claims files`

---

### 2.3 PDF Puppeteer cold start extremo

**Severidade:** ALTO  
**Arquivo:** `functions/helpers/pdfRenderer.js`  
**Risco:** Timeout 10-20s de cold start + 30-60s de renderização  
**Estimativa:** 2 horas  
**Risco de regressão:** Baixo — melhoria de performance sem mudar interface

---

#### PASSO 2.3.1 — Análise Pré-Implementação

- [ ] **Ler** `functions/helpers/pdfRenderer.js` inteiro (linhas 1-100+)
- [ ] **Ler** como o arquivo é importado em `functions/index.js` (`grep -n "pdfRenderer" functions/index.js`)
- [ ] **Verificar** se Puppeteer é usado em outros lugares (`grep -r "puppeteer" functions/ --include="*.js"`)
- [ ] **Pesquisar** se Firebase Functions Gen2 reutiliza instâncias entre chamadas (sim, warm starts)
- [ ] **Ler** documentação do `@sparticuz/chromium` sobre reutilização

#### PASSO 2.3.2 — Implementação da Correção

**Arquivo:** `functions/helpers/pdfRenderer.js`

**Código completo modificado:**
```javascript
const Chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// Cache global na instância da function (persiste entre warm starts)
let browserPromise = null;
let lastLaunchError = null;

async function getBrowser() {
    if (lastLaunchError) {
        throw new Error(`[pdfRenderer] Browser launch previously failed: ${lastLaunchError.message}`);
    }
    
    if (browserPromise) {
        try {
            const browser = await browserPromise;
            // Health check: verificar se o processo ainda existe
            if (browser.process() != null) {
                return browser;
            }
        } catch {
            // Browser morreu, recriar
        }
        browserPromise = null;
    }
    
    console.log('[pdfRenderer] Launching Chromium (persistent instance)...');
    Chromium.graphicsMode = false;
    
    try {
        const executablePath = await Chromium.executablePath();
        browserPromise = puppeteer.launch({
            args: [
                ...Chromium.args,
                '--disable-gpu',
                '--font-render-hinting=none',
            ],
            defaultViewport: { width: 1240, height: 1754, deviceScaleFactor: 1 },
            executablePath,
            headless: 'shell',
        });
        
        return await browserPromise;
    } catch (err) {
        lastLaunchError = err;
        throw err;
    }
}

async function renderHtmlToPdfBuffer(html, options = {}) {
    if (!html || typeof html !== 'string') {
        throw new Error('renderHtmlToPdfBuffer: html obrigatorio.');
    }

    const browser = await getBrowser();
    const page = await browser.newPage();
    
    try {
        page.setDefaultTimeout(options.timeoutMs || 60000);
        await page.emulateMediaType('print');
        
        await page.setContent(html, {
            waitUntil: ['load', 'domcontentloaded'],
            timeout: options.setContentTimeoutMs || 60000,
        });
        
        try {
            await page.evaluateHandle('document.fonts && document.fonts.ready');
        } catch (fontErr) {
            console.warn('[pdfRenderer] Font ready check failed:', fontErr.message);
        }
        
        const rawPdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
            displayHeaderFooter: false,
            margin: { top: '14mm', right: '12mm', bottom: '14mm', left: '12mm' },
            timeout: options.pdfTimeoutMs || 60000,
        });
        
        return Buffer.isBuffer(rawPdf) ? rawPdf : Buffer.from(rawPdf);
    } finally {
        // Fechar a página, mas NÃO o browser (reutilização)
        await page.close().catch(() => {});
    }
}

module.exports = { renderHtmlToPdfBuffer };
```

**Checklist de implementação:**
- [ ] Adicionar variáveis globais `browserPromise` e `lastLaunchError`
- [ ] Criar função `getBrowser()` com cache
- [ ] Adicionar health check (`browser.process() != null`)
- [ ] Modificar `renderHtmlToPdfBuffer` para usar `getBrowser()`
- [ ] Remover `browser.close()` do `finally`
- [ ] Manter `page.close()` no `finally`
- [ ] Adicionar tratamento de erro no `getBrowser()`

#### PASSO 2.3.3 — Testes de Não Regressão

**Arquivo:** `functions/helpers/pdfRenderer.test.js` (novo)

| # | Teste | Setup | Expectativa |
|---|-------|-------|-------------|
| 1 | Reutilização | Chamar 2x | `getBrowser()` retorna mesma instância |
| 2 | Browser morto | `browser.process()` retorna `null` | Cria nova instância |
| 3 | HTML válido | HTML simples | Retorna Buffer válido |
| 4 | HTML inválido | `null` ou número | Throw com mensagem correta |
| 5 | Page fechada | Verificar após chamada | `page.close()` chamado, `browser.close()` NÃO |
| 6 | Erro de launch | `puppeteer.launch()` falha | Erro armazenado em `lastLaunchError`, próxima chamada throw imediato |

**Checklist de testes:**
- [ ] Mock de `puppeteer.launch()`
- [ ] Mock de `Chromium.executablePath()`
- [ ] Mock de `browser.process()`
- [ ] Mock de `browser.newPage()` e `page.close()`
- [ ] Teste 1: segunda chamada reutiliza browser
- [ ] Teste 2: browser morto → novo launch
- [ ] Teste 3: HTML válido → Buffer
- [ ] Teste 4: HTML inválido → throw
- [ ] Teste 5: page.close() simulado, browser.close() NÃO chamado
- [ ] Teste 6: launch falha → erro persistente

#### PASSO 2.3.4 — Validação

- [ ] `cd functions && npm test` → 513+ testes passam
- [ ] `cd functions && npm run lint` → 0 erros
- [ ] Commit: `perf(backend): reuse Puppeteer browser instance to reduce PDF cold start`

---

### 2.4 DJEN trigger sem timeout adequado

**Severidade:** ALTO  
**Arquivo:** `functions/index.js:4807`  
**Risco:** Timeout 60s default com loop de 500ms por processo  
**Estimativa:** 30 minutos  
**Risco de regressão:** Muito baixo — apenas adiciona parâmetros de configuração

---

#### PASSO 2.4.1 — Análise Pré-Implementação

- [ ] **Ler** `functions/index.js` linhas 4807-4810 (definição atual do trigger)
- [ ] **Ler** `functions/index.js` linhas 4440-4445 (como `enrichJuditOnCase` define timeout)
- [ ] **Grep** todos os triggers: `grep -n "onDocumentUpdated" functions/index.js | head -20`
- [ ] **Identificar** outros triggers sem timeout explícito

#### PASSO 2.4.2 — Implementação da Correção

**Arquivo:** `functions/index.js`

**Linhas 4807-4810:**
```javascript
// DE:
exports.enrichDjenOnCase = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1', secrets: [openaiApiKey] },
    async (event) => { ... }
);

// PARA:
exports.enrichDjenOnCase = onDocumentUpdated(
    { 
        document: 'cases/{caseId}', 
        region: 'southamerica-east1',
        timeoutSeconds: 300,
        memory: '512MiB',
        secrets: [openaiApiKey] 
    },
    async (event) => { ... }
);
```

**Opcional (verificar outros triggers):**
- [ ] Verificar `enrichEscavadorOnCase` — adicionar timeout se não tiver?
- [ ] Verificar `enrichJuditOnCase` — já tem timeout?
- [ ] Documentar outros triggers sem timeout para futura correção

**Checklist de implementação:**
- [ ] Adicionar `timeoutSeconds: 300`
- [ ] Adicionar `memory: '512MiB'`
- [ ] **NÃO modificar** a lógica interna do trigger
- [ ] **NÃO modificar** outras partes do arquivo

#### PASSO 2.4.3 — Testes de Não Regressão

| # | Teste | Setup | Expectativa |
|---|-------|-------|-------------|
| 1 | Trigger disparado | Simular update em `cases/{caseId}` | Trigger é invocado (lógica interna intacta) |
| 2 | Timeout config | Verificar definição do trigger | `timeoutSeconds === 300`, `memory === '512MiB'` |
| 3 | Outros triggers | `enrichJuditOnCase`, `enrichEscavadorOnCase` | Não afetados |

**Checklist de testes:**
- [ ] Teste 1: trigger invocation mock
- [ ] Teste 2: config verification
- [ ] Teste 3: other triggers untouched

#### PASSO 2.4.4 — Validação

- [ ] `cd functions && npm test` → 513+ testes passam
- [ ] `cd functions && npm run lint` → 0 erros
- [ ] Commit: `fix(backend): add timeout and memory to DJEN trigger to prevent timeouts`

---

### 2.5 `writeClientCaseMirror` compara `JSON.stringify` inteiro

**Severidade:** ALTO  
**Arquivo:** `functions/index.js:5910`  
**Risco:** Skips writes legítimos, CPU excessiva  
**Estimativa:** 2 horas  
**Risco de regressão:** Médio — altera lógica de comparação crítica

---

#### PASSO 2.5.1 — Análise Pré-Implementação

- [ ] **Ler** `functions/index.js` linhas 5910-5927 (`writeClientCaseMirror`)
- [ ] **Ler** `functions/index.js` linhas 5873-5908 (`buildClientCasePayload`)
- [ ] **Identificar** todos os timestamps que podem estar no payload (`updatedAt`, `createdAt`, `concludedAt`, etc.)
- [ ] **Verificar** se `syncClientCaseOnCreate` usa a mesma função
- [ ] **Verificar** quais campos são arrays (ex: `warrants`, `processes`)

#### PASSO 2.5.2 — Implementação da Correção

**Arquivo:** `functions/index.js`

**Nova função (adicionar antes de `writeClientCaseMirror`):**
```javascript
function clientPayloadChanged(payload, existing) {
    const ignoreKeys = new Set([
        'updatedAt', 'createdAt', 'concludedAt', 'correctedAt',
        'djenEnrichedAt', 'autoClassifiedAt', 'enrichedAt'
    ]);
    
    const keysToCompare = Object.keys(payload).filter(k => !ignoreKeys.has(k));
    
    for (const key of keysToCompare) {
        const a = payload[key];
        const b = existing[key];
        
        // Arrays: comparar comprimento e itens
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return true;
            for (let i = 0; i < a.length; i++) {
                if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return true;
            }
            continue;
        }
        
        // Objetos simples
        if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
            if (JSON.stringify(a) !== JSON.stringify(b)) return true;
            continue;
        }
        
        // Primitivos
        if (a !== b) return true;
    }
    
    return false;
}
```

**Função `writeClientCaseMirror` modificada:**
```javascript
async function writeClientCaseMirror(caseId, caseData) {
    const payload = buildClientCasePayload(caseId, caseData);
    const existingRef = db.collection('clientCases').doc(caseId);
    const existingSnap = await existingRef.get();
    
    if (existingSnap.exists) {
        const existing = existingSnap.data() || {};
        if (!clientPayloadChanged(payload, existing)) {
            console.log(`[clientCases] ${caseId}: no visible change, skipping mirror write.`);
            return;
        }
    }
    
    await existingRef.set(payload);
}
```

**Checklist de implementação:**
- [ ] Criar `clientPayloadChanged(payload, existing)`
- [ ] Definir `ignoreKeys` com todos os timestamps
- [ ] Implementar comparação de arrays
- [ ] Implementar comparação de objetos
- [ ] Implementar comparação de primitivos
- [ ] Substituir `JSON.stringify` duplo no `writeClientCaseMirror`
- [ ] Manter logs existentes
- [ ] **NÃO alterar** `buildClientCasePayload`

#### PASSO 2.5.3 — Testes de Não Regressão

| # | Teste | Setup | Expectativa |
|---|-------|-------|-------------|
| 1 | Timestamps iguais | `updatedAt` diferente, resto igual | `clientPayloadChanged` → `false` |
| 2 | Flag diferente | `criminalFlag: 'POSITIVE'` vs `'NEGATIVE'` | `clientPayloadChanged` → `true` |
| 3 | Array diferente | `warrants` com 1 item a mais | `clientPayloadChanged` → `true` |
| 4 | Timestamp only | Mudança apenas em `updatedAt` | `writeClientCaseMirror` NÃO chama `set()` |
| 5 | Flag changed | Mudança em `criminalFlag` | `writeClientCaseMirror` chama `set()` |
| 6 | Novo caso | `existingSnap.exists === false` | `writeClientCaseMirror` chama `set()` |

**Checklist de testes:**
- [ ] Teste 1: timestamps ignorados
- [ ] Teste 2: flags detectados
- [ ] Teste 3: arrays detectados
- [ ] Teste 4: skip de write
- [ ] Teste 5: write realizado
- [ ] Teste 6: novo caso sempre write

#### PASSO 2.5.4 — Validação

- [ ] `cd functions && npm test` → 513+ testes passam
- [ ] `cd functions && npm run lint` → 0 erros
- [ ] Commit: `fix(backend): replace JSON.stringify comparison with field-by-field diff in clientCaseMirror`

---

### 2.6 Cascata de triggers `maybeRunAutoClassifyAndAi`

**Severidade:** MÉDIO  
**Arquivo:** `functions/index.js`  
**Risco:** ~12 invocações de trigger por caso  
**Estimativa:** 2 horas  
**Risco de regressão:** Médio — altera comportamento de triggers

---

#### PASSO 2.6.1 — Análise Pré-Implementação

- [ ] **Ler** `functions/index.js` linhas 1115-1134 (`maybeRunAutoClassifyAndAi`)
- [ ] **Ler** `functions/index.js` linhas 5086-5384 (`runAutoClassifyAndAi`)
- [ ] **Ler** `functions/index.js` linhas 5929-5945 (`syncClientCaseOnCreate`)
- [ ] **Ler** `functions/index.js` linhas 5939-5955 (`syncClientCaseOnUpdate`)
- [ ] **Ler** `functions/index.js` linhas 5957-5994 (`publishResultOnCaseDone`)
- [ ] **Identificar** todos os campos que `runAutoClassifyAndAi` modifica
- [ ] **Verificar** se `syncClientCaseOnUpdate` deve reagir a MUDANÇAS DE STATUS (sim!)

#### PASSO 2.6.2 — Implementação da Correção

**Nova função (adicionar antes dos triggers):**
```javascript
function isAutoClassifyOnlyChange(before, after) {
    const autoClassifyFields = new Set([
        'autoClassifySignature', 'autoClassifiedAt', 'autoClassifyLock',
        'autoClassifyRerunRequested', 'criminalFlag', 'warrantFlag', 'laborFlag',
        'riskScore', 'riskLevel', 'suggestedVerdict', 'finalVerdict',
        'negativePartialSafetyNetEligible', 'negativePartialSafetyNetReasons',
        'negativePartialSafetyNetAction', 'negativePartialSafetyNetTriggered',
        'prefillNarratives', 'deterministicPrefill', 'aiHomonymTriggered',
        'aiHomonymDecision', 'aiHomonymConfidence', 'aiHomonymRisk',
        'aiHomonymRecommendedAction', 'aiClassificationReview',
        'aiClassificationReviewOk', 'aiProvidersIncluded', 'aiStatus', 'aiError',
        'aiCostUsd', 'aiHomonymCostUsd', 'aiClassificationReviewCostUsd',
        'executiveSummary', 'keyFindings', 'clientNotes',
    ]);
    
    const beforeKeys = Object.keys(before);
    const afterKeys = Object.keys(after);
    const allKeys = new Set([...beforeKeys, ...afterKeys]);
    
    for (const key of allKeys) {
        if (before[key] !== after[key]) {
            if (!autoClassifyFields.has(key)) {
                return false; // Mudança NÃO relacionada a auto-classify
            }
        }
    }
    
    return true; // Todas as mudanças são de auto-classify
}
```

**Trigger `syncClientCaseOnUpdate` modificado:**
```javascript
exports.syncClientCaseOnUpdate = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1' },
    async (event) => {
        const before = event.data?.before?.data() || {};
        const after = event.data?.after?.data();
        if (!after) return;
        
        // GUARD: skip se a única mudança foi auto-classificação
        if (isAutoClassifyOnlyChange(before, after)) return;
        
        const caseId = event.params.caseId;
        await writeClientCaseMirror(caseId, after);
    },
);
```

**Checklist de implementação:**
- [ ] Criar `isAutoClassifyOnlyChange(before, after)`
- [ ] Definir set completo de campos de auto-classificação
- [ ] Adicionar guard no `syncClientCaseOnUpdate`
- [ ] Verificar se `publishResultOnCaseDone` também precisa de guard (se só reage a `status === 'DONE'`, talvez não)
- [ ] **NÃO adicionar guard** em triggers que reagem a status (Judit, Escavador)

#### PASSO 2.6.3 — Testes de Não Regressão

| # | Teste | Setup | Expectativa |
|---|-------|-------|-------------|
| 1 | Mudança auto-only | `riskScore` muda de 30 para 50 | `isAutoClassifyOnlyChange` → `true` |
| 2 | Mudança de status | `status` muda de `PENDING` para `IN_PROGRESS` | `isAutoClassifyOnlyChange` → `false` |
| 3 | Mudança mista | `riskScore` + `status` mudam | `isAutoClassifyOnlyChange` → `false` |
| 4 | Trigger skip | `syncClientCaseOnUpdate` com mudança auto-only | NÃO chama `writeClientCaseMirror` |
| 5 | Trigger executa | `syncClientCaseOnUpdate` com mudança de status | Chama `writeClientCaseMirror` |
| 6 | Judit trigger | `enrichJuditOnCase` com mudança de status | Ainda reage normalmente |

**Checklist de testes:**
- [ ] Teste 1: auto-only → true
- [ ] Teste 2: status change → false
- [ ] Teste 3: mixed → false
- [ ] Teste 4: trigger skip
- [ ] Teste 5: trigger executes
- [ ] Teste 6: Judit unaffected

#### PASSO 2.6.4 — Validação

- [ ] `cd functions && npm test` → 513+ testes passam
- [ ] `cd functions && npm run lint` → 0 erros
- [ ] Commit: `perf(backend): skip syncClientCaseOnUpdate when only auto-classify fields changed`

---

## Phase 3 — Performance Frontend

### 3.1 `CasoPage.jsx` recálculos síncronos pesados a cada keystroke

**Severidade:** CRÍTICO  
**Arquivo:** `src/portals/ops/CasoPage.jsx`  
**Risco:** UI trava ao digitar em casos complexos  
**Estimativa:** 3 horas  
**Risco de regressão:** Médio — altera estado e ciclo de vida do componente principal

---

#### PASSO 3.1.1 — Análise Pré-Implementação

- [ ] **Ler** `src/portals/ops/CasoPage.jsx` linhas 1068-1098 (função `update`)
- [ ] **Ler** `src/portals/ops/CasoPage.jsx` linhas 1100-1164 (useMemo declarations)
- [ ] **Ler** `src/portals/ops/CasoPage.jsx` linhas 749-785 (state declarations)
- [ ] **Identificar** todos os campos de texto livre (textarea) no JSX
- [ ] **Verificar** se `CasoPage.test.jsx` testa digitação em algum campo
- [ ] **Ler** `src/portals/ops/CasoPage.test.jsx` para entender mocks existentes

#### PASSO 3.1.2 — Implementação do Debounce

**Opção A: Hook reutilizável (recomendado)**

**Novo arquivo:** `src/hooks/useDebouncedField.js`
```javascript
import { useState, useCallback, useRef } from 'react';

export function useDebouncedField(initialValue, onCommit, delay = 400) {
    const [localValue, setLocalValue] = useState(initialValue);
    const debounceRef = useRef(null);

    const handleChange = useCallback((value) => {
        setLocalValue(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            onCommit(value);
        }, delay);
    }, [onCommit, delay]);

    return [localValue, handleChange];
}
```

**Uso no CasoPage:**
```javascript
// Para cada campo de texto:
const [localAnalystComment, handleAnalystCommentChange] = useDebouncedField(
    form.analystComment || '',
    (value) => update('analystComment', value),
    400
);
```

**Opção B: Inline (se não quiser criar hook)**

**Checklist de implementação:**
- [ ] Criar hook `useDebouncedField` (ou implementar inline)
- [ ] Adicionar estados locais para os 10 campos de texto
- [ ] Substituir `onChange={(e) => update('field', e.target.value)}` por handlers debounced
- [ ] Manter `value={form.field}` para campos NÃO debounced (dropdowns, radios)
- [ ] Memoizar `activeWarrantCount`
- [ ] Granularizar dependencies do `calculateRisk`

#### PASSO 3.1.3 — Memoização de `activeWarrantCount`

**Linha ~1109:**
```javascript
// DE:
const activeWarrantCount = (
    (caseData?.juditActiveWarrantCount || 0) +
    (Array.isArray(caseData?.bigdatacorpActiveWarrants)
        ? caseData.bigdatacorpActiveWarrants.filter((warrant) => warrant?.isActive !== false).length
        : 0)
);

// PARA:
const activeWarrantCount = useMemo(() => (
    (caseData?.juditActiveWarrantCount || 0) +
    (Array.isArray(caseData?.bigdatacorpActiveWarrants)
        ? caseData.bigdatacorpActiveWarrants.filter((warrant) => warrant?.isActive !== false).length
        : 0)
), [caseData?.juditActiveWarrantCount, caseData?.bigdatacorpActiveWarrants]);
```

#### PASSO 3.1.4 — Granularização de `calculateRisk`

**Linha ~1100:**
```javascript
// DE:
const risk = useMemo(() => calculateRisk(form, enabledPhases), [form, enabledPhases]);

// PARA:
const risk = useMemo(() => calculateRisk(form, enabledPhases), [
    enabledPhases,
    form.criminalFlag, form.criminalSeverity,
    form.laborFlag, form.laborSeverity,
    form.warrantFlag, form.osintLevel,
    form.socialStatus, form.digitalFlag,
    form.conflictInterest, form.cpfPendingRegularization,
    // NOTA: campos de texto (analystComment, notes) NÃO devem estar aqui
]);
```

#### PASSO 3.1.5 — Testes de Não Regressão

| # | Teste | Setup | Expectativa |
|---|-------|-------|-------------|
| 1 | Renderização | Renderizar CasoPage | Não quebra (smoke test) |
| 2 | Debounce | Digitar em `analystComment` | `update()` NÃO chamado imediatamente |
| 3 | Commit | Esperar 400ms após digitar | `update()` chamado com valor correto |
| 4 | Memo | `caseData` não muda | `activeWarrantCount` não recalcula |
| 5 | Risk calc | Mudar `analystComment` | `calculateRisk` NÃO recalcula |
| 6 | Salvar | Fluxo completo de conclusão | Funciona normalmente |
| 7 | Carregar | Caso existente | Dados preenchidos corretamente |

**Checklist de testes:**
- [ ] Smoke test
- [ ] Mock de `update()` com spy
- [ ] Teste de debounce com `jest.useFakeTimers()` ou `vi.useFakeTimers()`
- [ ] Teste de memoização
- [ ] Teste de risk calculation
- [ ] Teste de fluxo de salvar
- [ ] Teste de carregar caso existente

#### PASSO 3.1.6 — Validação

- [ ] `npm test -- CasoPage.test.jsx` → todos passam
- [ ] `npm test` → 820+ testes passam
- [ ] `npm run lint` → 0 erros
- [ ] Commit: `perf(frontend): add debounce to text fields and memoize heavy computations in CasoPage`

---

### 3.2 Subscriptions Firestore com limit 500

**Severidade:** CRÍTICO  
**Arquivo:** `src/core/firebase/firestoreService.js`  
**Risco:** Dados truncados silenciosamente  
**Estimativa:** 1 hora  
**Risco de regressão:** Baixo — altera constante numérica

---

#### PASSO 3.2.1 — Análise Pré-Implementação

- [ ] **Ler** `src/core/firebase/firestoreService.js` linha 330 (`DEFAULT_QUERY_LIMIT`)
- [ ] **Ler** `src/core/firebase/firestoreService.js` linhas 1079-1109 (`subscribeToCaseMessages`)
- [ ] **Grep** por `subscribeTo` no frontend: `grep -n "subscribeTo" src/core/firebase/firestoreService.js`
- [ ] **Verificar** se `demo mode` usa essas funções (`grep -n "subscribeTo" src/demo/`)
- [ ] **Verificar** uso de memória: 5000 docs × 2KB = ~10MB (aceitável para desktop)

#### PASSO 3.2.2 — Implementação da Correção

**Arquivo:** `src/core/firebase/firestoreService.js`

**Linha 330:**
```javascript
// DE:
const DEFAULT_QUERY_LIMIT = 500;

// PARA:
const DEFAULT_QUERY_LIMIT = 5000;
const MESSAGE_QUERY_LIMIT = 50;
```

**Linhas 1079-1109 (`subscribeToCaseMessages`):**
```javascript
// Adicionar .limit(MESSAGE_QUERY_LIMIT) na query
q = query(q, limit(MESSAGE_QUERY_LIMIT));
```

**Checklist de implementação:**
- [ ] Alterar `DEFAULT_QUERY_LIMIT` para 5000
- [ ] Adicionar `MESSAGE_QUERY_LIMIT = 50`
- [ ] Adicionar `.limit(MESSAGE_QUERY_LIMIT)` em `subscribeToCaseMessages`
- [ ] Verificar se outras subscriptions precisam de limites diferentes

#### PASSO 3.2.3 — Testes de Não Regressão

| # | Teste | Setup | Expectativa |
|---|-------|-------|-------------|
| 1 | Limit 5000 | `buildTenantCollectionQuery` | Query tem `limit(5000)` |
| 2 | Messages | `subscribeToCaseMessages` | Query tem `limit(50)` |
| 3 | CasosPage | Render com 2.000 casos | Mostra todos sem erro |
| 4 | Auditoria | Render com 2.000 logs | Mostra todos sem truncamento |
| 5 | Demo mode | Carregar demo | Funciona normalmente |

**Checklist de testes:**
- [ ] Teste de `buildTenantCollectionQuery`
- [ ] Teste de `subscribeToCaseMessages`
- [ ] Teste de componente CasosPage
- [ ] Teste de componente AuditoriaPage
- [ ] Teste de demo mode

#### PASSO 3.2.4 — Validação

- [ ] `npm test` → 820+ testes passam
- [ ] `npm run lint` → 0 erros
- [ ] Commit: `perf(frontend): increase Firestore query limits to prevent data truncation`

---

### 3.3 Exportação síncrona no frontend

**Severidade:** CRÍTICO  
**Arquivo:** `src/portals/client/ExportacoesPage.jsx`  
**Risco:** UI congela, 50+ requisições paralelas  
**Estimativa:** 2 horas  
**Risco de regressão:** Baixo — melhoria de performance sem mudar interface

---

#### PASSO 3.3.1 — Análise Pré-Implementação

- [ ] **Ler** `src/portals/client/ExportacoesPage.jsx` linhas 1007-1032 (`enrichCasesForExport`)
- [ ] **Ler** `src/portals/client/ExportacoesPage.jsx` linhas 1034-1095 (`handleExport`)
- [ ] **Identificar** onde `buildCsvContent` e `buildPrintableHtml` são chamados
- [ ] **Verificar** se existe algum padrão de `asyncPool` no projeto (`grep -r "asyncPool\|p-limit\|Promise.all" src/ --include="*.js"`)

#### PASSO 3.3.2 — Implementação do `asyncPool`

**Novo arquivo:** `src/utils/asyncPool.js`
```javascript
export async function asyncPool(concurrency, items, fn) {
    const results = [];
    const executing = new Set();
    
    for (const item of items) {
        const p = fn(item).then((result) => {
            executing.delete(p);
            return result;
        });
        
        results.push(p);
        executing.add(p);
        
        if (executing.size >= concurrency) {
            await Promise.race(executing);
        }
    }
    
    return Promise.all(results);
}
```

**Modificação em `ExportacoesPage.jsx`:**
```javascript
// Substituir Promise.all por asyncPool
const enriched = await asyncPool(5, casesToEnrich, async (c) => {
    if (c.status !== 'DONE') return c;
    try {
        const publicResult = await getCasePublicResult(c.id);
        return publicResult ? { ...c, ...publicResult } : c;
    } catch {
        return c;
    }
});
```

**Adicionar estado de progresso:**
```javascript
const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

// Durante o enrich:
setExportProgress({ current: index, total: casesToEnrich.length });
```

**Checklist de implementação:**
- [ ] Criar `src/utils/asyncPool.js`
- [ ] Importar `asyncPool` em `ExportacoesPage.jsx`
- [ ] Substituir `Promise.all` por `asyncPool(5, ...)`
- [ ] Adicionar estado de progresso
- [ ] Renderizar barra/spinner de progresso no JSX

#### PASSO 3.3.3 — Testes de Não Regressão

| # | Teste | Setup | Expectativa |
|---|-------|-------|-------------|
| 1 | Concorrência | 50 casos DONE | `getCasePublicResult` chamado max 5x simultâneo |
| 2 | UI não trava | Exportar 50 casos | Test passa com `act()` e `waitFor` |
| 3 | Progresso | Exportar casos | Barra de progresso visível |
| 4 | 0 casos | Nenhum caso selecionado | Mensagem adequada |
| 5 | Erro parcial | 1 caso falha | Outros 49 processados normalmente |
| 6 | Output correto | Exportar casos | CSV/HTML gerado corretamente |

**Checklist de testes:**
- [ ] Mock de `getCasePublicResult` com delay
- [ ] Teste de concorrência
- [ ] Teste de UI não travando
- [ ] Teste de progresso
- [ ] Teste de 0 casos
- [ ] Teste de erro parcial
- [ ] Teste de output

#### PASSO 3.3.4 — Validação

- [ ] `npm test -- ExportacoesPage.test.jsx` → todos passam
- [ ] `npm test` → 820+ testes passam
- [ ] `npm run lint` → 0 erros
- [ ] Commit: `perf(frontend): limit concurrency in export and add progress indicator`

---

## Phase 4 — Remoção de Código Morto

### 4.1 Validação e Remoção

**Estimativa:** 1 hora  
**Risco:** Baixo — apenas remove código confirmado como morto

---

#### PASSO 4.1.1 — Verificação Completa

**Arquivo:** `functions/repair-all-claims.js`
- [ ] `cat functions/repair-all-claims.js` → confirmar conteúdo
- [ ] `grep -r "repair-all-claims" . --include="*.js" --include="*.cjs" --include="*.json" --include="*.md"`
- [ ] Verificar `package.json` scripts
- [ ] Verificar `firebase.json` functions config
- [ ] Se NENHUMA referência encontrada: **REMOVER**

**Arquivo:** `scripts/repair-all-claims.cjs`
- [ ] `cat scripts/repair-all-claims.cjs` → confirmar conteúdo
- [ ] `grep -r "repair-all-claims.cjs" . --include="*.js" --include="*.json" --include="*.md"`
- [ ] Verificar se é chamado em CI/CD (GitHub Actions, etc.)
- [ ] Se NENHUMA referência encontrada: **REMOVER**

**Arquivo:** `functions/audit-firestore.cjs.bkp`
- [ ] `ls -la functions/audit-firestore.cjs.bkp` → verificar data
- [ ] Se arquivo antigo (>30 dias): **REMOVER**

**Função:** `queryLawsuitsAsync` em `functions/adapters/judit.js`
- [ ] `grep -n "queryLawsuitsAsync" functions/ -r --include="*.js"`
- [ ] Se NÃO é chamada em nenhum lugar: adicionar `@deprecated` ou **REMOVER**

#### PASSO 4.1.2 — Remoção

- [ ] `git rm functions/repair-all-claims.js` (se validado)
- [ ] `git rm scripts/repair-all-claims.cjs` (se validado)
- [ ] `git rm functions/audit-firestore.cjs.bkp` (se validado)
- [ ] Remover `queryLawsuitsAsync` (se validado)

#### PASSO 4.1.3 — Validação

- [ ] `npm test` → 820+ testes passam
- [ ] `cd functions && npm test` → 513+ testes passam
- [ ] Commit: `chore: remove dead code and duplicate files`

---

## Phase 5 — Validação Final e Deploy

### 5.1 Pré-deploy Checklist

- [ ] **Backend lint:** `cd functions && npm run lint` → 0 erros, 0 warnings
- [ ] **Backend tests:** `cd functions && npm test` → todos os 513+ passam
- [ ] **Frontend lint:** `npm run lint` → 0 erros, 0 warnings
- [ ] **Frontend tests:** `npm test` → todos os 820+ passam
- [ ] **Build:** `npm run build` → sucesso, `dist/` gerado
- [ ] **Git status:** apenas arquivos intencionais staged
- [ ] **Diff review:** revisar `git diff` completo antes de push

### 5.2 Smoke Tests Manuais

| # | Teste | Passos | Expectativa |
|---|-------|--------|-------------|
| 1 | Concluir caso | Abrir caso, preencher flags, clicar "Concluir" | Caso concluído, publicResult gerado, não duplica |
| 2 | Exportar 50+ | Portal cliente, selecionar 50 casos DONE, exportar | UI não trava, arquivo gerado, progresso visível |
| 3 | Gerar PDF | Caso concluído, clicar "Gerar PDF" | PDF gerado em <5s (warm) |
| 4 | Dashboard grande | Tenant com 1.000+ casos, abrir /ops/casos | Todos os casos listados, sem truncamento |
| 5 | DJEN complexo | Criar caso com 20+ processos, aguardar enriquecimento | DJEN completa sem timeout |
| 6 | Backfill seguro | Logar como admin, tentar backfill | Só processa tenant do admin |

### 5.3 Deploy Orquestrado

**Passo 1 — Deploy Backend**
```bash
firebase deploy --only functions
```
- [ ] Aguardar conclusão
- [ ] Verificar logs: `firebase functions:log --tail`
- [ ] Observar por 30 minutos
- [ ] Verificar cold starts e taxas de erro

**Passo 2 — Smoke Test em Produção**
- [ ] Concluir 1 caso real
- [ ] Exportar 10 casos
- [ ] Gerar 1 PDF
- [ ] Verificar métricas no Firebase Console

**Passo 3 — Deploy Frontend**
```bash
vercel --prod --yes
```
- [ ] Aguardar build
- [ ] Verificar se build completou sem erros

**Passo 4 — Validação Pós-Deploy**
- [ ] Acessar app em produção
- [ ] Realizar smoke tests
- [ ] Monitorar por 1 hora
- [ ] Verificar Sentry/Cloud Monitoring por erros

### 5.4 Rollback Plan

Se algo der errado:

1. **Backend:** `firebase deploy --only functions --force` (reverte para última versão estável)
2. **Frontend:** Reverter commit no Git e fazer novo deploy na Vercel
3. **Comunicação:** Notificar equipe sobre incidente e timeline de correção

---

## Errors Encountered

| Error | Phase | Item | Resolution |
|-------|-------|------|------------|
| (nenhum ainda) | — | — | — |

---

## Decisions Log

| Decisão | Data | Justificativa |
|---------|------|---------------|
| Preservar `DEFAULT_QUERY_LIMIT = 500` para realtime | 2026-05-29 | Protege subscriptions legítimas; aumentar para 5000 resolve truncamento sem quebrar contrato |
| Não modularizar `functions/index.js` nesta rodada | 2026-05-29 | Foco em correções cirúrgicas; refatoração estrutural é projeto separado (P1) |
| Browser Puppeteer persistente (não pré-gerar PDF) | 2026-05-29 | Ganho imediato de warm start; pré-geração requer redesign do pipeline |
| Debounce 400ms (não useReducer) | 2026-05-29 | Menor mudança arquitetural, mesmo efeito de performance |
| Firestore para rate limiting (não Redis) | 2026-05-29 | Menor infra adicional; sufficiente para lock de backfill |
| Excluir item 1.2 (race condition conclude) | 2026-05-29 | Solicitado pelo usuário |
| Excluir item 1.4 (listOpsUsers) | 2026-05-29 | Solicitado pelo usuário — comportamento esperado para owners |
| Excluir item 1.5 (rate limiting callables) | 2026-05-29 | Solicitado pelo usuário — não faz sentido real |
| Excluir item 2.4 (Judit polling) | 2026-05-29 | Solicitado pelo usuário — dúvida sobre necessidade |
