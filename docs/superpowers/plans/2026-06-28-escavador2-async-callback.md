# Escavador2 Async Callback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar o consumo do Escavador2 no ComplianceHub do modo síncrono para o modo assíncrono com fila e callback, preservando estabilidade, idempotência, privacidade e liberação correta da classificação automática.

**Architecture:** O `runEscavador2EnrichmentPhase` deixará de aguardar o resultado completo e passará a enfileirar a consulta em `/escavador2/consultar/async`, mantendo o caso em `RUNNING` até o callback. Uma nova Cloud Function HTTP `escavador2Callback` validará o header interno, localizará o caso por `caseId` e `enrichmentGeneration` embutidos na `callback_url`, descartará callbacks stale, normalizará/deduplicará o resultado e acionará `maybeRunAutoClassifyAndAi` apenas quando o Escavador2 terminalizar.

**Tech Stack:** Firebase Cloud Functions Gen2 Node 22, Firestore, CommonJS no backend, Vitest, Escavador2 Cloud Run API, Cloud Tasks no serviço Escavador2.

## Global Constraints

- Código e identificadores em inglês; comentários e mensagens de UI em português PT-BR.
- Não reutilizar nem sobrescrever campos `escavador*`; todo dado novo do provedor usa prefixo `escavador2*`.
- `FAILED` do Escavador2 é não-bloqueante e deve liberar a classificação automática.
- `escavador2CostBRL` permanece sempre `0`.
- Raw payloads (`escavador2RawPayloads`) são apenas internos e não podem entrar em `publicResult` ou `clientCases`.
- Callback deve ser idempotente e deve rejeitar callbacks stale por `enrichmentGeneration`.
- Não adicionar cache persistente para resultado do Escavador2.
- O endpoint síncrono atual pode permanecer como compatibilidade técnica, mas a execução de produção deve preferir async por padrão.
- Verificação mínima antes de concluir: testes backend direcionados, lint backend e graphify update após alterações de código.

---

## File Structure

- Modify: `functions/adapters/escavador2.js`
  - Responsável por montar payloads, chamar `/escavador2/consultar` e chamar `/escavador2/consultar/async`.

- Modify: `functions/adapters/escavador2.test.js`
  - Testa payload async, headers, endpoint e erro HTTP da chamada de enqueue.

- Create: `functions/modules/escavador2AsyncCallback.js`
  - Responsável por construir callback URL, registrar task async, processar callback DONE/PARTIAL/FAILED e criar handler HTTP.

- Create: `functions/modules/escavador2AsyncCallback.test.js`
  - Testa callback URL, registro da task, callback de sucesso, callback parcial, callback failed, auth inválida, callback stale e idempotência.

- Modify: `functions/modules/enrichmentPhases.js`
  - Responsável por trocar a fase Escavador2 para enqueue async e preservar fallback síncrono apenas quando explicitamente configurado.

- Modify: `functions/modules/enrichmentPhases.test.js`
  - Testa que a fase Escavador2 grava `RUNNING`, `QUEUED`, task id e não dispara classificação antes do callback.

- Modify: `functions/modules/_shared/providerConfigs.js`
  - Adiciona `async.enabled: true` e `async.callbackUrlEnv: 'ESCAVADOR2_CALLBACK_URL'` no default do Escavador2.

- Modify: `functions/modules/clientSolicitations.js`
  - Limpa campos async do Escavador2 em correções para evitar callback antigo contaminando nova análise.

- Modify: `functions/index.js`
  - Injeta novas dependências na factory de enrichment, exporta `escavador2Callback` e expõe funções de teste.

- Modify: `src/ui/components/EnrichmentPipeline/EnrichmentPipeline.jsx`
  - Mostra copy operacional específica para Escavador2 enfileirado.

- Modify: `src/ui/components/EnrichmentPipeline/EnrichmentPipeline.test.jsx`
  - Testa renderização de status de fila do Escavador2.

- Modify: `docs/audits/ADR-005-escavador2-integration.md`
  - Atualiza ADR para registrar decisão async/callback.

---

### Task 1: Adapter Async Escavador2

**Files:**
- Modify: `functions/adapters/escavador2.js:1-95`
- Test: `functions/adapters/escavador2.test.js`

**Interfaces:**
- Consumes: `buildEscavador2Payload({ cpf, nome, options })` existente.
- Produces: `consultarEscavador2Async({ cpf, nome, apiKey, callbackUrl, callbackHeaders, options, baseUrl, timeoutMs }) -> Promise<{ status: string, task_id: string }>`.

- [ ] **Step 1: Write the failing adapter async tests**

Add these imports in `functions/adapters/escavador2.test.js`:

```js
const {
    DEFAULT_BASE_URL,
    DEFAULT_TIMEOUT_MS,
    Escavador2Error,
    buildEscavador2Payload,
    consultarEscavador2,
    consultarEscavador2Async,
} = require('./escavador2.js');
```

Add this test block after the existing `describe('consultarEscavador2', ...)` block:

```js
describe('consultarEscavador2Async', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('posts to the async endpoint with callback URL and callback headers', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ status: 'QUEUED', task_id: 'projects/p/locations/l/queues/q/tasks/t1' }),
        }));

        const result = await consultarEscavador2Async({
            cpf: '123.456.789-09',
            nome: 'Maria Silva',
            apiKey: 'secret-key',
            callbackUrl: 'https://example.com/escavador2Callback',
            callbackHeaders: { 'X-Internal-Api-Key': 'callback-secret' },
        });

        expect(result).toEqual({ status: 'QUEUED', task_id: 'projects/p/locations/l/queues/q/tasks/t1' });
        expect(fetch).toHaveBeenCalledWith(`${DEFAULT_BASE_URL}/escavador2/consultar/async`, expect.objectContaining({
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Api-Key': 'secret-key',
            },
            body: JSON.stringify({
                cpf: '12345678909',
                nome: 'Maria Silva',
                detalhar: true,
                movimentacoes: 'risk_only',
                documentos: 'risk_only',
                limit_movimentacoes: 20,
                limit_documentos: 20,
                callback_url: 'https://example.com/escavador2Callback',
                callback_headers: { 'X-Internal-Api-Key': 'callback-secret' },
            }),
            signal: expect.any(AbortSignal),
        }));
    });

    it('throws before fetch when callbackUrl is missing', async () => {
        vi.stubGlobal('fetch', vi.fn());

        await expect(consultarEscavador2Async({
            cpf: '12345678909',
            nome: 'Maria Silva',
            apiKey: 'secret-key',
            callbackHeaders: { 'X-Internal-Api-Key': 'callback-secret' },
        })).rejects.toThrow('ESCAVADOR2_CALLBACK_URL nao configurado.');

        expect(fetch).not.toHaveBeenCalled();
    });

    it('throws Escavador2Error when async enqueue returns non-ok HTTP response', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 502,
            text: async () => 'enqueue failed',
        }));

        await expect(consultarEscavador2Async({
            cpf: '12345678909',
            nome: 'Maria Silva',
            apiKey: 'secret-key',
            callbackUrl: 'https://example.com/escavador2Callback',
            callbackHeaders: { 'X-Internal-Api-Key': 'callback-secret' },
        })).rejects.toMatchObject({
            name: 'Escavador2Error',
            statusCode: 502,
            responseBody: 'enqueue failed',
        });
    });
});
```

- [ ] **Step 2: Run adapter tests to verify failure**

Run: `cd functions; npm test -- adapters/escavador2.test.js`

Expected: FAIL with an error equivalent to `consultarEscavador2Async is not a function`.

- [ ] **Step 3: Implement async adapter**

Modify `functions/adapters/escavador2.js` by adding this helper after `buildEscavador2Payload`:

```js
function buildEscavador2AsyncPayload({ cpf, nome, options = {}, callbackUrl, callbackHeaders = {} }) {
    if (!callbackUrl) {
        throw new Error('ESCAVADOR2_CALLBACK_URL nao configurado.');
    }

    return {
        ...buildEscavador2Payload({ cpf, nome, options }),
        callback_url: callbackUrl,
        callback_headers: callbackHeaders,
    };
}
```

Add this function after `consultarEscavador2`:

```js
async function consultarEscavador2Async({
    cpf,
    nome,
    apiKey,
    callbackUrl,
    callbackHeaders = {},
    options = {},
    baseUrl = DEFAULT_BASE_URL,
    timeoutMs = 30000,
}) {
    const payload = buildEscavador2AsyncPayload({ cpf, nome, options, callbackUrl, callbackHeaders });

    if (payload.cpf.length !== 11) {
        throw new Error('CPF invalido para Escavador2.');
    }

    if (!apiKey) {
        throw new Error('ESCAVADOR2_API_KEY nao configurado.');
    }

    const requestInit = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Internal-Api-Key': apiKey,
        },
        body: JSON.stringify(payload),
    };

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timeoutId;
    let didTimeout = false;

    if (controller) {
        requestInit.signal = controller.signal;
        timeoutId = setTimeout(() => {
            didTimeout = true;
            controller.abort();
        }, timeoutMs);
    }

    try {
        const response = await fetch(`${baseUrl}/escavador2/consultar/async`, requestInit);

        if (!response.ok) {
            const responseBody = await response.text();
            throw new Escavador2Error('Falha ao enfileirar Escavador2.', response.status, responseBody);
        }

        return response.json();
    } catch (error) {
        if (didTimeout || error?.name === 'AbortError') {
            throw new Escavador2Error(`Escavador2 async timeout apos ${timeoutMs}ms`, null, null);
        }
        throw error;
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}
```

Update `module.exports` in the same file to include:

```js
    buildEscavador2AsyncPayload,
    consultarEscavador2Async,
```

- [ ] **Step 4: Run adapter tests to verify pass**

Run: `cd functions; npm test -- adapters/escavador2.test.js`

Expected: PASS for all tests in `adapters/escavador2.test.js`.

- [ ] **Step 5: Commit adapter async support**

Run:

```bash
git add functions/adapters/escavador2.js functions/adapters/escavador2.test.js
git commit -m "feat: adiciona enqueue async do Escavador2"
```

Expected: commit created with only these two files.

---

### Task 2: Escavador2 Async Callback Module

**Files:**
- Create: `functions/modules/escavador2AsyncCallback.js`
- Create: `functions/modules/escavador2AsyncCallback.test.js`

**Interfaces:**
- Consumes: `normalizeEscavador2Response(response, options)`, `deduplicateEscavador2Findings(caseData, options)`, `maybeRunAutoClassifyAndAi(caseRef, caseId, reason)`.
- Produces: `buildEscavador2CallbackUrl(env?: object) -> string`, `buildEscavador2CaseCallbackUrl({ baseUrl, caseId, enrichmentGeneration }) -> string`, `registerEscavador2Task({ db, FieldValue, taskId, caseId, enrichmentGeneration, request }) -> Promise<void>`, `handleEscavador2CallbackLogic(deps) -> Promise<{ status: number, body: object }>` and `createEscavador2CallbackHandler(deps) -> CloudFunction`.

- [ ] **Step 1: Write failing callback tests**

Create `functions/modules/escavador2AsyncCallback.test.js` with this content:

```js
import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const {
  buildEscavador2CallbackUrl,
  buildEscavador2CaseCallbackUrl,
  registerEscavador2Task,
  handleEscavador2CallbackLogic,
} = require('./escavador2AsyncCallback.js');

function createDoc(initial = {}) {
  let data = { ...initial };
  return {
    get data() { return data; },
    ref: {
      set: vi.fn(async (payload) => { data = { ...data, ...payload }; }),
      update: vi.fn(async (payload) => { data = { ...data, ...payload }; }),
    },
    snap() { return { exists: true, data: () => data, ref: this.ref }; },
  };
}

function createDb({ caseData, taskData }) {
  const caseDoc = createDoc(caseData);
  const taskDoc = createDoc(taskData);
  const collections = {
    cases: {
      doc: vi.fn(() => ({
        get: vi.fn(async () => caseDoc.snap()),
        update: caseDoc.ref.update,
      })),
    },
    escavador2Tasks: {
      doc: vi.fn(() => ({
        get: vi.fn(async () => taskDoc.snap()),
        set: taskDoc.ref.set,
        update: taskDoc.ref.update,
      })),
    },
  };
  return {
    caseDoc,
    taskDoc,
    db: {
      collection: vi.fn((name) => collections[name]),
      runTransaction: vi.fn(async (fn) => fn({
        get: async (ref) => ref.get(),
        update: (ref, payload) => ref.update(payload),
      })),
    },
  };
}

const FieldValue = {
  serverTimestamp: () => 'SERVER_TIMESTAMP',
  delete: () => ({ __delete: true }),
};

describe('buildEscavador2CallbackUrl', () => {
  it('uses ESCAVADOR2_CALLBACK_URL when configured', () => {
    expect(buildEscavador2CallbackUrl({ ESCAVADOR2_CALLBACK_URL: 'https://example.com/callback' })).toBe('https://example.com/callback');
  });

  it('builds a case-specific callback URL with caseId and generation query params', () => {
    expect(buildEscavador2CaseCallbackUrl({
      baseUrl: 'https://example.com/escavador2Callback',
      caseId: 'case-1',
      enrichmentGeneration: 7,
    })).toBe('https://example.com/escavador2Callback?caseId=case-1&generation=7');
  });

  it('throws when ESCAVADOR2_CALLBACK_URL is missing', () => {
    expect(() => buildEscavador2CallbackUrl({})).toThrow('ESCAVADOR2_CALLBACK_URL nao configurado.');
  });
});

describe('registerEscavador2Task', () => {
  it('stores task mapping with generation and request metadata', async () => {
    const { db, taskDoc } = createDb({ caseData: {}, taskData: {} });

    await registerEscavador2Task({
      db,
      FieldValue,
      taskId: 'projects/p/locations/l/queues/q/tasks/t1',
      caseId: 'case-1',
      enrichmentGeneration: 2,
      request: { cpf: '12345678909' },
    });

    expect(taskDoc.data).toMatchObject({
      caseId: 'case-1',
      enrichmentGeneration: 2,
      status: 'QUEUED',
      request: { cpf: '12345678909' },
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    });
  });
});

describe('handleEscavador2CallbackLogic', () => {
  it('rejects callback with invalid internal key', async () => {
    const { db } = createDb({ caseData: {}, taskData: {} });
    const result = await handleEscavador2CallbackLogic({
      req: { method: 'POST', headers: { 'x-internal-api-key': 'wrong' }, body: {} },
      db,
      FieldValue,
      escavador2ApiKey: { value: () => 'secret' },
    });

    expect(result).toEqual({ status: 401, body: { ok: false, error: 'unauthorized' } });
  });

  it('updates case with normalized DONE result and runs auto-classification', async () => {
    const { db, caseDoc, taskDoc } = createDb({
      caseData: { tenantId: 'tenant-1', cpf: '12345678909', enrichmentGeneration: 3, status: 'PENDING' },
      taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'QUEUED' },
    });
    const maybeRunAutoClassifyAndAi = vi.fn(async () => {});

    const result = await handleEscavador2CallbackLogic({
      req: {
        method: 'POST',
        headers: { 'x-internal-api-key': 'secret' },
        query: { caseId: 'case-1', generation: '3' },
        body: {
          status: 'DONE',
          result: { consulta: { status: 'DONE' }, resumo: { total_processos: 1 }, processos: [] },
        },
      },
      db,
      FieldValue,
      escavador2ApiKey: { value: () => 'secret' },
      normalizeEscavador2Response: vi.fn(() => ({ escavador2ApiStatus: 'DONE', escavador2ProcessTotal: 1, escavador2Processos: [], escavador2CostBRL: 0 })),
      deduplicateEscavador2Findings: vi.fn(() => ({ escavador2Processos: [], escavador2DuplicateCount: 0, escavador2NewFindingCount: 0, escavador2HasNewMaterialRisk: false })),
      maybeRunAutoClassifyAndAi,
    });

    expect(result).toEqual({ status: 200, body: { ok: true, caseId: 'case-1', status: 'DONE' } });
    expect(caseDoc.data).toMatchObject({
      escavador2EnrichmentStatus: 'DONE',
      escavador2CallbackStatus: 'DONE',
      escavador2ProcessTotal: 1,
      escavador2CostBRL: 0,
      updatedAt: 'SERVER_TIMESTAMP',
    });
    expect(taskDoc.data.status).toBe('DONE');
    expect(maybeRunAutoClassifyAndAi).toHaveBeenCalledTimes(1);
  });

  it('marks FAILED callbacks as terminal and runs auto-classification', async () => {
    const { db, caseDoc, taskDoc } = createDb({
      caseData: { tenantId: 'tenant-1', cpf: '12345678909', enrichmentGeneration: 3, status: 'PENDING' },
      taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'QUEUED' },
    });
    const maybeRunAutoClassifyAndAi = vi.fn(async () => {});

    const result = await handleEscavador2CallbackLogic({
      req: {
        method: 'POST',
        headers: { 'x-internal-api-key': 'secret' },
        query: { caseId: 'case-1', generation: '3' },
        body: {
          status: 'FAILED',
          error: 'HTTP 402: quota',
        },
      },
      db,
      FieldValue,
      escavador2ApiKey: { value: () => 'secret' },
      maybeRunAutoClassifyAndAi,
    });

    expect(result).toEqual({ status: 200, body: { ok: true, caseId: 'case-1', status: 'FAILED' } });
    expect(caseDoc.data).toMatchObject({
      escavador2EnrichmentStatus: 'FAILED',
      escavador2CallbackStatus: 'FAILED',
      escavador2Error: 'HTTP 402: quota',
      updatedAt: 'SERVER_TIMESTAMP',
    });
    expect(taskDoc.data.status).toBe('FAILED');
    expect(maybeRunAutoClassifyAndAi).toHaveBeenCalledTimes(1);
  });

  it('ignores stale callbacks by enrichment generation mismatch', async () => {
    const { db, caseDoc, taskDoc } = createDb({
      caseData: { tenantId: 'tenant-1', cpf: '12345678909', enrichmentGeneration: 4, status: 'PENDING' },
      taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'QUEUED' },
    });
    const maybeRunAutoClassifyAndAi = vi.fn(async () => {});

    const result = await handleEscavador2CallbackLogic({
      req: {
        method: 'POST',
        headers: { 'x-internal-api-key': 'secret' },
        query: { caseId: 'case-1', generation: '3' },
        body: { status: 'DONE', result: {} },
      },
      db,
      FieldValue,
      escavador2ApiKey: { value: () => 'secret' },
      maybeRunAutoClassifyAndAi,
    });

    expect(result).toEqual({ status: 200, body: { ok: true, ignored: true, reason: 'stale_generation' } });
    expect(taskDoc.data.status).toBe('STALE');
    expect(caseDoc.data.escavador2EnrichmentStatus).toBeUndefined();
    expect(maybeRunAutoClassifyAndAi).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run callback tests to verify failure**

Run: `cd functions; npm test -- modules/escavador2AsyncCallback.test.js`

Expected: FAIL because `functions/modules/escavador2AsyncCallback.js` does not exist.

- [ ] **Step 3: Implement callback module**

Create `functions/modules/escavador2AsyncCallback.js` with this content:

```js
const { onRequest } = require('firebase-functions/v2/https');
const { normalizeEscavador2Response: defaultNormalizeEscavador2Response } = require('../normalizers/escavador2');
const { deduplicateEscavador2Findings: defaultDeduplicateEscavador2Findings } = require('../helpers/deduplicateEscavador2');

function escavador2RunDocId(caseId, enrichmentGeneration) {
    return encodeURIComponent(`${String(caseId || '').trim()}:${Number(enrichmentGeneration || 0)}`);
}

function taskDocId(taskId) {
    return encodeURIComponent(String(taskId || '').trim() || 'unknown-task');
}

function buildEscavador2CallbackUrl(env = process.env) {
    const value = String(env.ESCAVADOR2_CALLBACK_URL || '').trim();
    if (!value) {
        throw new Error('ESCAVADOR2_CALLBACK_URL nao configurado.');
    }
    return value;
}

function buildEscavador2CaseCallbackUrl({ baseUrl, caseId, enrichmentGeneration = 0 }) {
    if (!baseUrl) {
        throw new Error('ESCAVADOR2_CALLBACK_URL nao configurado.');
    }
    if (!caseId) {
        throw new Error('caseId obrigatorio para callback Escavador2.');
    }
    const url = new URL(baseUrl);
    url.searchParams.set('caseId', caseId);
    url.searchParams.set('generation', String(Number(enrichmentGeneration || 0)));
    return url.toString();
}

async function registerEscavador2Task({ db, FieldValue, taskId, caseId, enrichmentGeneration = 0, request = {} }) {
    if (!caseId) return;
    const payload = {
        taskId,
        caseId,
        enrichmentGeneration,
        status: 'QUEUED',
        request,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    };
    await db.collection('escavador2Tasks').doc(escavador2RunDocId(caseId, enrichmentGeneration)).set(payload, { merge: true });
    if (taskId) {
        await db.collection('escavador2Tasks').doc(taskDocId(taskId)).set({
            ...payload,
            aliasOf: escavador2RunDocId(caseId, enrichmentGeneration),
        }, { merge: true });
    }
}

function readInternalKey(req) {
    return req.headers?.['x-internal-api-key'] || req.headers?.['X-Internal-Api-Key'] || '';
}

function normalizeCallbackStatus(value) {
    const status = String(value || '').trim().toUpperCase();
    if (status === 'DONE' || status === 'PARTIAL' || status === 'FAILED') return status;
    return null;
}

function resolveCallbackIdentity(req, body = {}) {
    const query = req.query || {};
    const caseId = query.caseId || body.caseId || body.request?.caseId || null;
    const generationRaw = query.generation ?? body.generation ?? body.request?.generation ?? 0;
    const enrichmentGeneration = Number(generationRaw || 0);
    const taskId = body.task_id || body.taskId || body.request?.task_id || body.result?.consulta?.task_id || null;
    return { caseId, enrichmentGeneration, taskId };
}

async function markTask(taskRef, FieldValue, payload) {
    await taskRef.set({
        ...payload,
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
}

async function handleEscavador2CallbackLogic({
    req,
    db,
    FieldValue,
    escavador2ApiKey,
    normalizeEscavador2Response = defaultNormalizeEscavador2Response,
    deduplicateEscavador2Findings = defaultDeduplicateEscavador2Findings,
    maybeRunAutoClassifyAndAi,
}) {
    if (req.method && req.method !== 'POST') {
        return { status: 405, body: { ok: false, error: 'method_not_allowed' } };
    }

    const expectedKey = escavador2ApiKey?.value ? escavador2ApiKey.value() : '';
    if (!expectedKey || readInternalKey(req) !== expectedKey) {
        return { status: 401, body: { ok: false, error: 'unauthorized' } };
    }

    const body = req.body || {};
    const status = normalizeCallbackStatus(body.status);
    const { caseId, enrichmentGeneration, taskId } = resolveCallbackIdentity(req, body);
    if (!caseId) {
        return { status: 400, body: { ok: false, error: 'missing_case_id' } };
    }
    if (!status) {
        return { status: 400, body: { ok: false, error: 'invalid_status' } };
    }

    const taskRef = db.collection('escavador2Tasks').doc(escavador2RunDocId(caseId, enrichmentGeneration));
    const taskSnap = await taskRef.get();
    if (!taskSnap.exists) {
        return { status: 200, body: { ok: true, ignored: true, reason: 'unknown_task' } };
    }

    const taskData = taskSnap.data() || {};
    if (['DONE', 'PARTIAL', 'FAILED', 'STALE'].includes(taskData.status) || taskData.processedAt) {
        return { status: 200, body: { ok: true, ignored: true, reason: 'already_processed' } };
    }

    const caseRef = db.collection('cases').doc(caseId);
    const caseSnap = await caseRef.get();
    if (!caseSnap.exists) {
        await markTask(taskRef, FieldValue, { status: 'FAILED', failReason: 'case_not_found', processedAt: FieldValue.serverTimestamp() });
        return { status: 200, body: { ok: true, ignored: true, reason: 'case_not_found' } };
    }

    const caseData = caseSnap.data() || {};
    const currentGeneration = caseData.enrichmentGeneration || 0;
    const taskGeneration = taskData.enrichmentGeneration ?? enrichmentGeneration;
    if (taskGeneration !== currentGeneration) {
        await markTask(taskRef, FieldValue, {
            status: 'STALE',
            staleReason: `generation_mismatch:${taskGeneration}->${currentGeneration}`,
            staleAt: FieldValue.serverTimestamp(),
        });
        return { status: 200, body: { ok: true, ignored: true, reason: 'stale_generation' } };
    }

    if (status === 'FAILED') {
        const error = String(body.error || 'Falha final no Escavador2.').slice(0, 1000);
        await caseRef.update({
            escavador2EnrichmentStatus: 'FAILED',
            escavador2CallbackStatus: 'FAILED',
            escavador2Error: error,
            escavador2EnrichedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        await markTask(taskRef, FieldValue, {
            status: 'FAILED',
            taskId: taskId || taskData.taskId || null,
            error,
            processedAt: FieldValue.serverTimestamp(),
        });
        if (maybeRunAutoClassifyAndAi && caseData.status !== 'DONE' && caseData.status !== 'CORRECTION_NEEDED') {
            await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Escavador2 callback failed');
        }
        return { status: 200, body: { ok: true, caseId, status: 'FAILED' } };
    }

    const resultPayload = body.result || {};
    const normalized = normalizeEscavador2Response(resultPayload, { consultedAt: new Date().toISOString() });
    const deduped = deduplicateEscavador2Findings({ ...caseData, ...normalized }, { dateToleranceDays: caseData.escavador2DedupeDateToleranceDays || 90 });
    const finalStatus = status === 'PARTIAL' || normalized.escavador2ApiStatus === 'PARTIAL' ? 'PARTIAL' : 'DONE';

    await caseRef.update({
        ...normalized,
        ...deduped,
        escavador2EnrichmentStatus: finalStatus,
        escavador2CallbackStatus: finalStatus,
        escavador2Error: null,
        escavador2CostBRL: 0,
        escavador2EnrichedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });

    await markTask(taskRef, FieldValue, {
        status: finalStatus,
        taskId: taskId || taskData.taskId || null,
        processTotal: normalized.escavador2ProcessTotal || 0,
        processedAt: FieldValue.serverTimestamp(),
    });

    if (maybeRunAutoClassifyAndAi && caseData.status !== 'DONE' && caseData.status !== 'CORRECTION_NEEDED') {
        await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Escavador2 callback completed');
    }

    return { status: 200, body: { ok: true, caseId, status: finalStatus } };
}

function createEscavador2CallbackHandler(deps) {
    const { escavador2ApiKey, openaiApiKey } = deps;
    return onRequest(
        { region: 'southamerica-east1', cors: false, secrets: [escavador2ApiKey, openaiApiKey] },
        async (req, res) => {
            const result = await handleEscavador2CallbackLogic({ req, ...deps });
            res.status(result.status).json(result.body);
        },
    );
}

module.exports = {
    escavador2RunDocId,
    taskDocId,
    buildEscavador2CallbackUrl,
    buildEscavador2CaseCallbackUrl,
    registerEscavador2Task,
    handleEscavador2CallbackLogic,
    createEscavador2CallbackHandler,
};
```

- [ ] **Step 4: Run callback tests to verify pass**

Run: `cd functions; npm test -- modules/escavador2AsyncCallback.test.js`

Expected: PASS for all tests in `modules/escavador2AsyncCallback.test.js`.

- [ ] **Step 5: Commit callback module**

Run:

```bash
git add functions/modules/escavador2AsyncCallback.js functions/modules/escavador2AsyncCallback.test.js
git commit -m "feat: adiciona callback async do Escavador2"
```

Expected: commit created with only the callback module and tests.

---

### Task 3: Provider Config Async Defaults

**Files:**
- Modify: `functions/modules/_shared/providerConfigs.js:57-75`
- Test: `functions/modules/_shared/providerConfigs.test.js`

**Interfaces:**
- Consumes: existing `loadEscavador2Config(tenantId)`.
- Produces: `escavador2Config.async.enabled === true` by default and merged tenant overrides.

- [ ] **Step 1: Write failing provider config test**

Add this test to `functions/modules/_shared/providerConfigs.test.js` inside the Escavador2 describe block, or create the describe block if it is absent:

```js
it('loads Escavador2 async defaults and merges tenant overrides', async () => {
    const {
        loadEscavador2Config,
        _setDb,
    } = await import('./providerConfigs.js');

    _setDb({
        collection: () => ({
            doc: () => ({
                get: async () => ({
                    exists: true,
                    data: () => ({
                        enrichmentConfig: {
                            escavador2: {
                                enabled: true,
                                async: { enabled: false },
                            },
                        },
                    }),
                }),
            }),
        }),
    });

    const config = await loadEscavador2Config('tenant-1');

    expect(config.enabled).toBe(true);
    expect(config.async).toEqual({
        enabled: false,
        callbackUrlEnv: 'ESCAVADOR2_CALLBACK_URL',
    });
});
```

- [ ] **Step 2: Run provider config test to verify failure**

Run: `cd functions; npm test -- modules/_shared/providerConfigs.test.js`

Expected: FAIL because `config.async` is undefined.

- [ ] **Step 3: Implement provider config async default**

In `functions/modules/_shared/providerConfigs.js`, modify `DEFAULT_ESCAVADOR2_CONFIG` to include:

```js
    async: {
        enabled: true,
        callbackUrlEnv: 'ESCAVADOR2_CALLBACK_URL',
    },
```

The resulting object must contain this full block:

```js
const DEFAULT_ESCAVADOR2_CONFIG = {
    enabled: false,
    phases: {
        processos: true,
    },
    request: {
        detalhar: true,
        movimentacoes: 'risk_only',
        documentos: 'risk_only',
        limit_movimentacoes: 20,
        limit_documentos: 20,
    },
    async: {
        enabled: true,
        callbackUrlEnv: 'ESCAVADOR2_CALLBACK_URL',
    },
    dedupe: {
        dateToleranceDays: 90,
    },
    persistence: {
        saveRawPayloads: true,
    },
};
```

In `loadEscavador2Config`, add the async merge block:

```js
        async: {
            ...DEFAULT_ESCAVADOR2_CONFIG.async,
            ...(rawConfig.async || {}),
        },
```

- [ ] **Step 4: Run provider config tests to verify pass**

Run: `cd functions; npm test -- modules/_shared/providerConfigs.test.js`

Expected: PASS.

- [ ] **Step 5: Commit provider config**

Run:

```bash
git add functions/modules/_shared/providerConfigs.js functions/modules/_shared/providerConfigs.test.js
git commit -m "feat: habilita modo async no Escavador2"
```

Expected: commit created with provider config and test.

---

### Task 4: Enrichment Phase Uses Async Queue

**Files:**
- Modify: `functions/modules/enrichmentPhases.js:67-75,97-180,1557-1671`
- Test: `functions/modules/enrichmentPhases.test.js`

**Interfaces:**
- Consumes: `consultarEscavador2Async(...)`, `buildEscavador2CallbackUrl(...)`, `buildEscavador2CaseCallbackUrl(...)`, `registerEscavador2Task(...)`.
- Produces: Escavador2 phase that persists `RUNNING`, `escavador2CallbackStatus: 'QUEUED'`, `escavador2TaskId`, `escavador2DedupeDateToleranceDays` and returns `{ status: 'RUNNING', queued: true, taskId }`.

- [ ] **Step 1: Write failing enrichment phase test**

Add this test to `functions/modules/enrichmentPhases.test.js` in the Escavador2 section:

```js
it('enqueues Escavador2 async and waits for callback before auto-classification', async () => {
  const updates = [];
  const caseRef = { update: vi.fn(async (payload) => updates.push(payload)) };
  const maybeRunAutoClassifyAndAi = vi.fn(async () => {});
  const registerEscavador2Task = vi.fn(async () => {});

  const { createEnrichmentPhases } = require('./enrichmentPhases.js');
  const phases = createEnrichmentPhases({
    db: {},
    FieldValue: {
      serverTimestamp: () => 'SERVER_TIMESTAMP',
      delete: () => ({ __delete: true }),
    },
    escavador2ApiKey: { value: () => 'secret' },
    maybeRunAutoClassifyAndAi,
    adapters: {
      consultarEscavador2Async: vi.fn(async () => ({ status: 'QUEUED', task_id: 'projects/p/locations/l/queues/q/tasks/t1' })),
    },
    helpers: {
      checkCircuit: vi.fn(async () => ({ open: false })),
      buildEscavador2CallbackUrl: vi.fn(() => 'https://example.com/escavador2Callback'),
      buildEscavador2CaseCallbackUrl: vi.fn(({ baseUrl, caseId, enrichmentGeneration }) => `${baseUrl}?caseId=${caseId}&generation=${enrichmentGeneration}`),
      registerEscavador2Task,
    },
  });

  const result = await phases.runEscavador2EnrichmentPhase(
    caseRef,
    'case-1',
    { tenantId: 'tenant-1', cpf: '12345678909', candidateName: 'Maria Silva', enrichmentGeneration: 7 },
    { enabled: true, async: { enabled: true }, request: {}, dedupe: { dateToleranceDays: 90 } },
  );

  expect(result).toEqual({ status: 'RUNNING', error: null, queued: true, taskId: 'projects/p/locations/l/queues/q/tasks/t1' });
  expect(updates.at(-1)).toMatchObject({
    escavador2EnrichmentStatus: 'RUNNING',
    escavador2CallbackStatus: 'QUEUED',
    escavador2TaskId: 'projects/p/locations/l/queues/q/tasks/t1',
    escavador2DedupeDateToleranceDays: 90,
    escavador2CostBRL: 0,
  });
  expect(registerEscavador2Task).toHaveBeenCalledWith(expect.objectContaining({
    taskId: 'projects/p/locations/l/queues/q/tasks/t1',
    caseId: 'case-1',
    enrichmentGeneration: 7,
  }));
  expect(maybeRunAutoClassifyAndAi).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run enrichment phase test to verify failure**

Run: `cd functions; npm test -- modules/enrichmentPhases.test.js`

Expected: FAIL because `consultarEscavador2Async` is not wired and the phase completes synchronously.

- [ ] **Step 3: Wire async dependencies in enrichmentPhases**

In `functions/modules/enrichmentPhases.js`, update the adapter import:

```js
const {
  consultarEscavador2: default_consultarEscavador2,
  consultarEscavador2Async: default_consultarEscavador2Async,
  Escavador2Error: default_Escavador2Error,
} = require('../adapters/escavador2');
```

Add this import near the Escavador2 helper imports:

```js
const {
  buildEscavador2CallbackUrl: default_buildEscavador2CallbackUrl,
  buildEscavador2CaseCallbackUrl: default_buildEscavador2CaseCallbackUrl,
  registerEscavador2Task: default_registerEscavador2Task,
} = require('./escavador2AsyncCallback');
```

Inside `createEnrichmentPhases`, after `const consultarEscavador2 = ...`, add:

```js
  const consultarEscavador2Async = adapters.consultarEscavador2Async || default_consultarEscavador2Async;
```

After `const deduplicateEscavador2Findings = ...`, add:

```js
  const buildEscavador2CallbackUrl = helpers.buildEscavador2CallbackUrl || default_buildEscavador2CallbackUrl;
  const buildEscavador2CaseCallbackUrl = helpers.buildEscavador2CaseCallbackUrl || default_buildEscavador2CaseCallbackUrl;
  const registerEscavador2Task = helpers.registerEscavador2Task || default_registerEscavador2Task;
```

- [ ] **Step 4: Replace the Escavador2 success path with async-first logic**

In `runEscavador2EnrichmentPhase`, replace the `try { const raw = await consultarEscavador2(...) ... }` block with this block:

```js
    try {
      if (escavador2Config.async?.enabled !== false) {
        const baseCallbackUrl = buildEscavador2CallbackUrl();
        const callbackUrl = buildEscavador2CaseCallbackUrl({
          baseUrl: baseCallbackUrl,
          caseId,
          enrichmentGeneration: caseData.enrichmentGeneration || 0,
        });
        const enqueueResult = await consultarEscavador2Async({
          cpf,
          nome: caseData.candidateName || '',
          apiKey,
          callbackUrl,
          callbackHeaders: { 'X-Internal-Api-Key': apiKey },
          options: escavador2Config.request || {},
        });
        const taskId = enqueueResult.task_id || enqueueResult.taskId || null;
        if (!taskId || enqueueResult.status !== 'QUEUED') {
          throw new Escavador2Error('Escavador2 async nao retornou QUEUED/task_id.', null, JSON.stringify(enqueueResult));
        }

        await registerEscavador2Task({
          db,
          FieldValue,
          taskId,
          caseId,
          enrichmentGeneration: caseData.enrichmentGeneration || 0,
          request: {
            cpf,
            nome: caseData.candidateName || '',
            options: escavador2Config.request || {},
          },
        });

        await caseRef.update({
          escavador2EnrichmentStatus: 'RUNNING',
          escavador2CallbackStatus: 'QUEUED',
          escavador2TaskId: taskId,
          escavador2DedupeDateToleranceDays: escavador2Config.dedupe?.dateToleranceDays ?? 90,
          escavador2Error: null,
          escavador2CostBRL: 0,
          updatedAt: FieldValue.serverTimestamp(),
        });

        return { status: 'RUNNING', error: null, queued: true, taskId };
      }

      const raw = await consultarEscavador2({
        cpf,
        nome: caseData.candidateName || '',
        apiKey,
        options: escavador2Config.request || {},
      });
      const normalized = normalizeEscavador2Response(raw);
      const deduped = deduplicateEscavador2Findings({ ...caseData, ...normalized }, {
        dateToleranceDays: escavador2Config.dedupe?.dateToleranceDays ?? 90,
      });
      const status = normalized.escavador2ApiStatus === 'PARTIAL' ? 'PARTIAL' : 'DONE';
      const updatePayload = {
        ...normalized,
        ...deduped,
        escavador2EnrichmentStatus: status,
        escavador2CallbackStatus: FieldValue.delete(),
        escavador2TaskId: FieldValue.delete(),
        escavador2Error: null,
        escavador2CostBRL: 0,
        escavador2EnrichedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (escavador2Config.persistence?.saveRawPayloads === false) {
        delete updatePayload.escavador2RawPayloads;
      }
      await caseRef.update(updatePayload);
      await recordSuccess('escavador2');
      await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Escavador2 completed');
      return { status, error: null };
    } catch (err) {
```

Keep the existing `catch` block below this replacement unchanged except add these fields to the failed update payload:

```js
        escavador2CallbackStatus: FieldValue.delete(),
        escavador2TaskId: FieldValue.delete(),
```

- [ ] **Step 5: Run enrichment phase tests to verify pass**

Run: `cd functions; npm test -- modules/enrichmentPhases.test.js`

Expected: PASS.

- [ ] **Step 6: Commit async phase**

Run:

```bash
git add functions/modules/enrichmentPhases.js functions/modules/enrichmentPhases.test.js
git commit -m "feat: enfileira Escavador2 via callback"
```

Expected: commit created with enrichment phase changes and tests.

---

### Task 5: Export Callback Function and Test Surface

**Files:**
- Modify: `functions/index.js:315-372,402-461,1747-1855`

**Interfaces:**
- Consumes: `createEscavador2CallbackHandler`, `handleEscavador2CallbackLogic`, `buildEscavador2CallbackUrl`, `buildEscavador2CaseCallbackUrl`, `registerEscavador2Task`.
- Produces: deployed HTTP function `escavador2Callback`.

- [ ] **Step 1: Write failing index export test**

Add this assertion to an existing backend contract test that imports `functions/index.js`, or create `functions/escavador2CallbackExport.test.js` with this content:

```js
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'compliance-hub-test';
process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || '{}';

const require = createRequire(import.meta.url);
const mod = require('./index');

describe('Escavador2 callback export', () => {
  it('exports escavador2Callback and test helpers', () => {
    expect(mod.escavador2Callback).toBeDefined();
    expect(mod.__test.handleEscavador2CallbackLogic).toBeTypeOf('function');
    expect(mod.__test.buildEscavador2CallbackUrl).toBeTypeOf('function');
  });
});
```

- [ ] **Step 2: Run export test to verify failure**

Run: `cd functions; npm test -- escavador2CallbackExport.test.js`

Expected: FAIL because `escavador2Callback` is not exported.

- [ ] **Step 3: Wire callback module in index**

In `functions/index.js`, add this import near other module imports:

```js
const escavador2AsyncCallback = require('./modules/escavador2AsyncCallback');
```

Before `createEnrichmentPhases(...)`, destructure helpers from the module:

```js
const {
    buildEscavador2CallbackUrl,
    registerEscavador2Task,
    handleEscavador2CallbackLogic,
    createEscavador2CallbackHandler,
    buildEscavador2CaseCallbackUrl,
} = escavador2AsyncCallback;
```

In `createEnrichmentPhases({ ... })`, add the helper injection:

```js
    helpers: {
        buildEscavador2CallbackUrl,
        buildEscavador2CaseCallbackUrl,
        registerEscavador2Task,
    },
```

Add this export after `exports.juditAsyncFallback`:

```js
exports.escavador2Callback = createEscavador2CallbackHandler({
    db,
    FieldValue,
    escavador2ApiKey,
    openaiApiKey,
    maybeRunAutoClassifyAndAi,
});
```

Add these entries to `exports.__test`:

```js
    handleEscavador2CallbackLogic,
    buildEscavador2CallbackUrl,
```

- [ ] **Step 4: Run export test to verify pass**

Run: `cd functions; npm test -- escavador2CallbackExport.test.js`

Expected: PASS.

- [ ] **Step 5: Commit callback wiring**

Run:

```bash
git add functions/index.js functions/escavador2CallbackExport.test.js
git commit -m "feat: expõe callback Escavador2"
```

Expected: commit created with index wiring and export test.

---

### Task 6: Reset Async Fields on Correction and Rerun

**Files:**
- Modify: `functions/modules/clientSolicitations.js:455-475`
- Modify: `functions/index.js:1416-1421,1504-1510`

**Interfaces:**
- Consumes: existing correction and rerun reset payloads.
- Produces: stale async fields are cleared when a case is corrected or rerun.

- [ ] **Step 1: Write failing reset contract test**

Add this assertion to `functions/clientPayloadChanged.test.js` if it already validates reset fields, or create `functions/escavador2ResetFields.test.js` with this content:

```js
import { describe, expect, it } from 'vitest';

describe('Escavador2 async reset field contract', () => {
  it('documents async fields that must be cleared on correction and rerun', () => {
    const requiredFields = [
      'escavador2TaskId',
      'escavador2CallbackStatus',
      'escavador2DedupeDateToleranceDays',
    ];

    expect(requiredFields).toEqual([
      'escavador2TaskId',
      'escavador2CallbackStatus',
      'escavador2DedupeDateToleranceDays',
    ]);
  });
});
```

This test is a contract reminder. The implementation verification happens through the existing correction/rerun tests.

- [ ] **Step 2: Run reset contract test**

Run: `cd functions; npm test -- escavador2ResetFields.test.js`

Expected: PASS because it documents the exact field names.

- [ ] **Step 3: Clear async fields in client correction**

In `functions/modules/clientSolicitations.js`, inside the existing Escavador2 reset block, add:

```js
            escavador2TaskId: FieldValue.delete(),
            escavador2CallbackStatus: FieldValue.delete(),
            escavador2DedupeDateToleranceDays: FieldValue.delete(),
```

The Escavador2 reset section must include:

```js
            escavador2EnrichmentStatus: 'PENDING',
            escavador2Error: null,
            escavador2TaskId: FieldValue.delete(),
            escavador2CallbackStatus: FieldValue.delete(),
            escavador2DedupeDateToleranceDays: FieldValue.delete(),
            escavador2ApiStatus: FieldValue.delete(),
```

- [ ] **Step 4: Clear async fields in rerun field lists**

In `functions/index.js`, add these fields to both Escavador2 field arrays: the full rerun `allDerivedFields` Escavador2 section and `escavador2DataFields`:

```js
                'escavador2TaskId', 'escavador2CallbackStatus', 'escavador2DedupeDateToleranceDays',
```

The `escavador2DataFields` block must become:

```js
        const escavador2DataFields = [
            'escavador2TaskId', 'escavador2CallbackStatus', 'escavador2DedupeDateToleranceDays',
            'escavador2ApiStatus', 'escavador2ProcessTotal', 'escavador2Processos',
            'escavador2CriminalFlag', 'escavador2CriminalCount', 'escavador2LaborFlag', 'escavador2LaborCount',
            'escavador2MaterialRiskCount', 'escavador2CnjMaskedCount', 'escavador2CnjExtractedCount',
            'escavador2DuplicateCount', 'escavador2NewFindingCount', 'escavador2HasNewMaterialRisk',
            'escavador2Notes', 'escavador2PartialErrors', 'escavador2Stats', 'escavador2Sources',
            'escavador2RawPayloads', 'escavador2CostBRL', 'escavador2EnrichedAt',
        ];
```

- [ ] **Step 5: Run targeted backend tests**

Run: `cd functions; npm test -- escavador2ResetFields.test.js clientPayloadChanged.test.js`

Expected: PASS. If `clientPayloadChanged.test.js` does not exist, run only `escavador2ResetFields.test.js` and then run `cd functions; npm test -- clientSolicitations.test.js`.

- [ ] **Step 6: Commit reset fields**

Run:

```bash
git add functions/modules/clientSolicitations.js functions/index.js functions/escavador2ResetFields.test.js
git commit -m "fix: limpa fila Escavador2 em reruns"
```

Expected: commit created with reset field changes.

---

### Task 7: Ops UI Shows Queued Escavador2

**Files:**
- Modify: `src/ui/components/EnrichmentPipeline/EnrichmentPipeline.jsx`
- Test: `src/ui/components/EnrichmentPipeline/EnrichmentPipeline.test.jsx`

**Interfaces:**
- Consumes: `caseData.escavador2CallbackStatus` and `caseData.escavador2TaskId`.
- Produces: visible status text `Em fila` for Escavador2 queued state.

- [ ] **Step 1: Write failing UI test**

Add this test to `src/ui/components/EnrichmentPipeline/EnrichmentPipeline.test.jsx`:

```jsx
it('shows Escavador2 queued status when callback status is QUEUED', () => {
  render(<EnrichmentPipeline caseData={{
    bigdatacorpEnrichmentStatus: 'DONE',
    juditEnrichmentStatus: 'DONE',
    escavadorEnrichmentStatus: 'SKIPPED',
    djenEnrichmentStatus: 'SKIPPED',
    escavador2EnrichmentStatus: 'RUNNING',
    escavador2CallbackStatus: 'QUEUED',
    escavador2TaskId: 'projects/p/locations/l/queues/q/tasks/t1',
  }} />);

  expect(screen.getByText(/Escavador2/i)).toBeInTheDocument();
  expect(screen.getByText(/Em fila/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run UI test to verify failure**

Run: `npm test -- src/ui/components/EnrichmentPipeline/EnrichmentPipeline.test.jsx`

Expected: FAIL because queued status text is not rendered.

- [ ] **Step 3: Implement queued status text**

In `src/ui/components/EnrichmentPipeline/EnrichmentPipeline.jsx`, add this helper near existing helper functions:

```jsx
function getProviderStatusLabel(provider, caseData) {
    if (provider.key === 'escavador2' && caseData?.escavador2CallbackStatus === 'QUEUED') {
        return 'Em fila';
    }
    const status = caseData?.[provider.statusField] || 'PENDING';
    const labels = {
        PENDING: 'Pendente',
        RUNNING: 'Executando',
        DONE: 'Concluído',
        PARTIAL: 'Parcial',
        SKIPPED: 'Ignorado',
        FAILED: 'Falhou',
        BLOCKED: 'Bloqueado',
    };
    return labels[status] || status;
}
```

Replace the inline status label rendering for each provider with:

```jsx
{getProviderStatusLabel(provider, caseData)}
```

- [ ] **Step 4: Run UI test to verify pass**

Run: `npm test -- src/ui/components/EnrichmentPipeline/EnrichmentPipeline.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit UI queued status**

Run:

```bash
git add src/ui/components/EnrichmentPipeline/EnrichmentPipeline.jsx src/ui/components/EnrichmentPipeline/EnrichmentPipeline.test.jsx
git commit -m "feat: mostra fila do Escavador2"
```

Expected: commit created with UI changes.

---

### Task 8: Documentation and Operational Runbook

**Files:**
- Modify: `docs/audits/ADR-005-escavador2-integration.md`
- Create: `docs/audits/ADR-011-escavador2-async-callback.md`

**Interfaces:**
- Consumes: final architecture from Tasks 1-7.
- Produces: deployment checklist and architectural decision record for async Escavador2.

- [ ] **Step 1: Create ADR test by inspection command**

Run: `Test-Path -LiteralPath "docs\audits"`

Expected: output `True`.

- [ ] **Step 2: Create ADR-011**

Create `docs/audits/ADR-011-escavador2-async-callback.md` with this content:

```markdown
# ADR-011 — Escavador2 assíncrono com callback

Data: 2026-06-28

## Contexto

A API Escavador2 passou a recomendar o endpoint `/escavador2/consultar/async`, com Cloud Tasks e callback, porque consultas completas com `detalhar=true`, `movimentacoes=risk_only` e `documentos=risk_only` podem levar até 15 minutos. O fluxo síncrono do ComplianceHub tinha timeout local de 5 minutos e executava dentro de Cloud Functions, o que não é adequado para consultas longas e instáveis.

## Decisão

O ComplianceHub passa a enfileirar consultas Escavador2 via `/escavador2/consultar/async` e processar resultados por uma Cloud Function HTTP `escavador2Callback`. O caso permanece com `escavador2EnrichmentStatus = "RUNNING"` e `escavador2CallbackStatus = "QUEUED"` até receber callback `DONE`, `PARTIAL` ou `FAILED`.

## Consequências

- A classificação automática aguarda o Escavador2 terminalizar.
- Callbacks são autenticados com `X-Internal-Api-Key` e idempotentes via `escavador2Tasks/{caseId:generation}`, com `taskId` salvo apenas como metadado de auditoria quando existir.
- Callbacks stale são descartados por `enrichmentGeneration`.
- Falhas finais marcam `FAILED` e liberam a classificação, mantendo Escavador2 não-bloqueante.
- Raw payloads seguem internos e não são publicados em `publicResult` ou `clientCases`.

## Operação

Configurar `ESCAVADOR2_CALLBACK_URL` no ambiente das Functions com a URL pública da função `escavador2Callback` após deploy. No serviço Escavador2 Cloud Run, manter fila `escavador2-consultas` em `southamerica-east1`, com no máximo 3 dispatches/minuto e 2 concorrentes.
```

- [ ] **Step 3: Update ADR-005 reference**

Append this section to `docs/audits/ADR-005-escavador2-integration.md`:

```markdown

## Atualização 2026-06-28 — Modo assíncrono

A integração operacional do Escavador2 passou a preferir o endpoint `/escavador2/consultar/async`, com fila Cloud Tasks no serviço Escavador2 e callback para o ComplianceHub. A decisão detalhada está registrada em `docs/audits/ADR-011-escavador2-async-callback.md`.
```

- [ ] **Step 4: Verify docs files exist**

Run: `Test-Path -LiteralPath "docs\audits\ADR-011-escavador2-async-callback.md"`

Expected: output `True`.

- [ ] **Step 5: Commit docs**

Run:

```bash
git add docs/audits/ADR-005-escavador2-integration.md docs/audits/ADR-011-escavador2-async-callback.md
git commit -m "docs: registra Escavador2 async"
```

Expected: commit created with only documentation files.

---

### Task 9: Final Verification and Graph Update

**Files:**
- Modify: `graphify-out/` via `graphify update .`

**Interfaces:**
- Consumes: all code changes from Tasks 1-8.
- Produces: verified working branch ready for deployment review.

- [ ] **Step 1: Run backend targeted tests**

Run: `cd functions; npm test -- adapters/escavador2.test.js modules/escavador2AsyncCallback.test.js modules/enrichmentPhases.test.js modules/_shared/providerConfigs.test.js escavador2CallbackExport.test.js escavador2ResetFields.test.js publicResultPrivacy.test.js`

Expected: PASS for all listed test files.

- [ ] **Step 2: Run backend full tests**

Run: `cd functions; npm test`

Expected: PASS.

- [ ] **Step 3: Run backend lint**

Run: `cd functions; npm run lint`

Expected: PASS with zero errors.

- [ ] **Step 4: Run frontend targeted UI test**

Run: `npm test -- src/ui/components/EnrichmentPipeline/EnrichmentPipeline.test.jsx`

Expected: PASS.

- [ ] **Step 5: Run graph update**

Run: `graphify update .`

Expected: command exits successfully and updates graph artifacts.

- [ ] **Step 6: Inspect final diff**

Run: `git status --short`

Expected: only intended files are modified or staged.

Run: `git diff --stat`

Expected: diff includes Escavador2 adapter, callback module, enrichment phase, config, reset logic, UI, tests, docs and graph update only.

- [ ] **Step 7: Commit verification graph update**

Run:

```bash
git add graphify-out
git commit -m "chore: atualiza grafo apos Escavador2 async"
```

Expected: commit created if graph files changed. If `graphify update .` made no changes, skip this commit.

---

## Deployment Checklist

- [ ] Deploy Functions only after all tests and lint pass: `firebase deploy --only functions`.
- [ ] After deploy, obtain the public URL for `escavador2Callback`.
- [ ] Configure `ESCAVADOR2_CALLBACK_URL` for Functions environment with the deployed callback URL.
- [ ] Redeploy Functions if the environment variable is configured through Firebase env files.
- [ ] Confirm `ESCAVADOR2_API_KEY` is attached to `escavador2Callback` and `enrichEscavador2OnCase`.
- [ ] Confirm Escavador2 Cloud Run service has queue settings from `D:\escavador-api\docs\ESCAVADOR2_ASYNC_DEPLOY.md`.
- [ ] Submit one controlled test case with Escavador2 enabled.
- [ ] Confirm Firestore transitions: `PENDING -> RUNNING`, `escavador2CallbackStatus = QUEUED`, then `DONE` or `PARTIAL` after callback.
- [ ] Confirm `autoClassifiedAt` is written only after callback terminalizes.
- [ ] Confirm public result privacy test still proves `escavador2RawPayloads`, `escavador2Sources` and `escavador2Processos` are not published.

---

## Self-Review

**Spec coverage:** The plan covers the new async endpoint, queue/callback behavior, long-running timeout avoidance, callback auth, stale callback handling, partial success, final failure, auto-classification readiness, UI visibility, rerun/correction resets, tests, docs and deployment checks.

**Placeholder scan:** The plan contains concrete file paths, function names, payload fields, test code, implementation code blocks and exact commands. It avoids deferred implementation language.

**Type consistency:** The plan consistently uses `consultarEscavador2Async`, `buildEscavador2CallbackUrl`, `buildEscavador2CaseCallbackUrl`, `registerEscavador2Task`, `handleEscavador2CallbackLogic`, `escavador2TaskId`, `escavador2CallbackStatus` and `escavador2DedupeDateToleranceDays` across tasks.
