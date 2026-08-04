import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const mockOnRequest = vi.fn((opts, handler) => handler);
const httpsPath = require.resolve('firebase-functions/v2/https');
require.cache[httpsPath] = {
  id: httpsPath,
  filename: httpsPath,
  loaded: true,
  exports: { onRequest: mockOnRequest },
};

const escavador2AsyncCallback = await import('./escavador2AsyncCallback.js');

const {
  buildEscavador2CallbackUrl,
  buildEscavador2CaseCallbackUrl,
  registerEscavador2Task,
  handleEscavador2CallbackLogic,
  createEscavador2CallbackHandler,
} = escavador2AsyncCallback;

function createDoc(initial = {}) {
  let data = { ...initial };
  return {
    get data() { return data; },
    ref: {
      set: vi.fn(async (payload, options) => { data = options?.merge ? { ...data, ...payload } : { ...payload }; }),
      update: vi.fn(async (payload) => { data = { ...data, ...payload }; }),
    },
    snap() { return { exists: true, data: () => data, ref: this.ref }; },
  };
}

function createDb({ caseData, taskData } = {}) {
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

function createRes() {
  const res = {
    statusCode: 200,
    status: vi.fn((code) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((body) => {
      res.body = body;
      return res;
    }),
  };
  return res;
}

function createBaseDeps(overrides = {}) {
  return {
    db: overrides.db,
    FieldValue,
    escavador2ApiKey: { value: () => 'secret' },
    normalizeEscavador2Response: vi.fn(() => ({
      escavador2ApiStatus: 'DONE',
      escavador2ProcessTotal: 1,
      escavador2Processos: [],
      escavador2CostBRL: 0,
    })),
    deduplicateEscavador2Findings: vi.fn(() => ({
      escavador2Processos: [],
      escavador2DuplicateCount: 0,
      escavador2NewFindingCount: 0,
      escavador2HasNewMaterialRisk: false,
    })),
    maybeRunAutoClassifyAndAi: vi.fn(async () => {}),
    ...overrides,
  };
}

function createValidCallbackReq(overrides = {}) {
  return {
    method: 'POST',
    headers: { 'x-internal-api-key': 'secret' },
    query: { caseId: 'case-1', generation: '3' },
    body: {
      status: 'DONE',
      result: { consulta: { status: 'DONE' }, resumo: { total_processos: 1 }, processos: [] },
      ...overrides.body,
    },
    ...overrides,
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

  it('replaces stale processed task state when the same generation is queued again', async () => {
    const { db, taskDoc } = createDb({
      caseData: {},
      taskData: { status: 'DONE', processedAt: 'OLD_TIMESTAMP', staleField: true },
    });

    await registerEscavador2Task({
      db,
      FieldValue,
      taskId: 'projects/p/locations/l/queues/q/tasks/t2',
      caseId: 'case-1',
      enrichmentGeneration: 2,
      request: { cpf: '12345678909' },
    });

    expect(taskDoc.data).toMatchObject({
      caseId: 'case-1',
      enrichmentGeneration: 2,
      status: 'QUEUED',
      request: { cpf: '12345678909' },
    });
    expect(taskDoc.data.processedAt).toBeUndefined();
    expect(taskDoc.data.staleField).toBeUndefined();
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

  it('reapplies the persisted budget after callback deduplication', async () => {
    const { db, caseDoc } = createDb({
      caseData: { tenantId: 'tenant-1', cpf: '12345678909', enrichmentGeneration: 3, status: 'PENDING' },
      taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'QUEUED' },
    });
    const hugeUnicode = 'evidencia complementar çã 🚨 '.repeat(100);
    const processes = Array.from({ length: 120 }, (_, index) => ({
      escavador2Index: index,
      numeroCnj: `${String(index).padStart(7, '0')}-00.2026.5.01.0001`,
      isLabor: true,
      isNewEscavador2Finding: index === 119,
      parties: [{ name: `${hugeUnicode}${index}`, role: 'Polo Ativo', side: 'ACTIVE' }],
    }));

    await handleEscavador2CallbackLogic(createBaseDeps({
      req: createValidCallbackReq(),
      db,
      normalizeEscavador2Response: vi.fn(() => ({
        escavador2ApiStatus: 'DONE',
        escavador2ProcessTotal: processes.length,
        escavador2Processos: processes.map((process) => Object.fromEntries(
          Object.entries(process).filter(([key]) => key !== 'parties'),
        )),
      })),
      deduplicateEscavador2Findings: vi.fn(() => ({
        escavador2Processos: processes,
        escavador2DuplicateCount: 119,
        escavador2NewFindingCount: 1,
        escavador2HasNewMaterialRisk: false,
      })),
    }));

    const escavador2Fields = Object.fromEntries(Object.entries(caseDoc.data).filter(([key]) => key.startsWith('escavador2')));
    expect(Buffer.byteLength(JSON.stringify(escavador2Fields), 'utf8')).toBeLessThanOrEqual(320 * 1024);
    expect(caseDoc.data.escavador2Processos).toEqual(expect.arrayContaining([
      expect.objectContaining({ numeroCnj: '0000119-00.2026.5.01.0001', isNewEscavador2Finding: true }),
    ]));
    expect(caseDoc.data.escavador2ProcessOmissions).toEqual(expect.objectContaining({
      original: processes.length,
      omitted: expect.any(Number),
    }));
  });

  it('runs the real callback normalize-dedupe-enforce pipeline before omitting processes', async () => {
    const processCount = 260;
    const partyPadding = 'EVIDENCIA PROCESSUAL '.repeat(30);
    const processNumber = (index) => `${String(index).padStart(7, '0')}-00.2026.5.01.0001`;
    const rawProcesses = Array.from({ length: processCount }, (_, index) => ({
      cnj: { valor: processNumber(index), mascarado: false },
      lista: {
        polo_ativo: `CANDIDATO ${index} ${partyPadding}`,
        polo_passivo: `EMPRESA ${index} ${partyPadding}`,
      },
      classificacao: { area: 'LABOR', risco_material: false },
      papel_candidato: { tipo_principal: 'Autor', polo_principal: 'ATIVO' },
      normalizado: {
        match: { tipo: 'CPF', has_exact_cpf_match: true },
        dados: { classe: 'Reclamacao Trabalhista', assunto: 'Horas extras' },
      },
    }));
    const { db, caseDoc } = createDb({
      caseData: {
        tenantId: 'tenant-1',
        cpf: '12345678909',
        enrichmentGeneration: 3,
        status: 'PENDING',
        bigdatacorpProcessos: rawProcesses.slice(0, -1).map((_, index) => ({ numeroCnj: processNumber(index), area: 'LABOR' })),
      },
      taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'QUEUED' },
    });
    const req = createValidCallbackReq({
      body: {
        status: 'DONE',
        result: {
          consulta: { status: 'DONE' },
          resumo: { total_processos: processCount },
          processos: rawProcesses,
        },
      },
    });

    await handleEscavador2CallbackLogic(createBaseDeps({
      req,
      db,
      normalizeEscavador2Response: undefined,
      deduplicateEscavador2Findings: undefined,
    }));

    const escavador2Fields = Object.fromEntries(Object.entries(caseDoc.data).filter(([key]) => key.startsWith('escavador2')));
    expect(caseDoc.data.escavador2NewFindingCount).toBe(1);
    expect(caseDoc.data.escavador2Processos).toEqual(expect.arrayContaining([
      expect.objectContaining({ numeroCnj: processNumber(processCount - 1), isNewEscavador2Finding: true }),
    ]));
    expect(Buffer.byteLength(JSON.stringify(escavador2Fields), 'utf8')).toBeLessThanOrEqual(320 * 1024);
  });

  it('deletes stale omission markers after a normal callback completion without omissions', async () => {
    const { db, caseDoc } = createDb({
      caseData: { tenantId: 'tenant-1', cpf: '12345678909', enrichmentGeneration: 3, status: 'PENDING' },
      taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'QUEUED' },
    });

    await handleEscavador2CallbackLogic(createBaseDeps({ req: createValidCallbackReq(), db }));

    expect(caseDoc.data.escavador2ProcessOmissions).toEqual({ __delete: true });
    expect(caseDoc.data.escavador2TechnicalOmissions).toEqual({ __delete: true });
    expect(caseDoc.data.escavador2PersistenceTruncated).toEqual({ __delete: true });
    expect(caseDoc.data.escavador2PersistenceFallback).toEqual({ __delete: true });
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

  it('treats PARTIAL as terminal status and runs auto-classification', async () => {
    const { db, caseDoc, taskDoc } = createDb({
      caseData: { tenantId: 'tenant-1', cpf: '12345678909', enrichmentGeneration: 3, status: 'PENDING' },
      taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'QUEUED' },
    });
    const maybeRunAutoClassifyAndAi = vi.fn(async () => {});

    const result = await handleEscavador2CallbackLogic({
      req: createValidCallbackReq({ body: { status: 'PARTIAL' } }),
      db,
      FieldValue,
      escavador2ApiKey: { value: () => 'secret' },
      normalizeEscavador2Response: vi.fn(() => ({ escavador2ApiStatus: 'PARTIAL', escavador2ProcessTotal: 1, escavador2Processos: [], escavador2CostBRL: 0 })),
      deduplicateEscavador2Findings: vi.fn(() => ({ escavador2Processos: [], escavador2DuplicateCount: 0, escavador2NewFindingCount: 0, escavador2HasNewMaterialRisk: false })),
      maybeRunAutoClassifyAndAi,
    });

    expect(result).toEqual({ status: 200, body: { ok: true, caseId: 'case-1', status: 'PARTIAL' } });
    expect(caseDoc.data).toMatchObject({
      escavador2EnrichmentStatus: 'PARTIAL',
      escavador2CallbackStatus: 'PARTIAL',
      updatedAt: 'SERVER_TIMESTAMP',
    });
    expect(taskDoc.data.status).toBe('PARTIAL');
    expect(maybeRunAutoClassifyAndAi).toHaveBeenCalledTimes(1);
  });

  it('treats SKIPPED as terminal status and runs auto-classification', async () => {
    const { db, caseDoc, taskDoc } = createDb({
      caseData: { tenantId: 'tenant-1', cpf: '12345678909', enrichmentGeneration: 3, status: 'PENDING' },
      taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'QUEUED' },
    });
    const maybeRunAutoClassifyAndAi = vi.fn(async () => {});

    const result = await handleEscavador2CallbackLogic({
      req: createValidCallbackReq({ body: { status: 'SKIPPED' } }),
      db,
      FieldValue,
      escavador2ApiKey: { value: () => 'secret' },
      maybeRunAutoClassifyAndAi,
    });

    expect(result).toEqual({ status: 200, body: { ok: true, caseId: 'case-1', status: 'SKIPPED' } });
    expect(caseDoc.data).toMatchObject({
      escavador2EnrichmentStatus: 'SKIPPED',
      escavador2CallbackStatus: 'SKIPPED',
      escavador2CostBRL: 0,
      updatedAt: 'SERVER_TIMESTAMP',
    });
    expect(taskDoc.data.status).toBe('SKIPPED');
    expect(maybeRunAutoClassifyAndAi).toHaveBeenCalledTimes(1);
  });

  it('returns already_processed when task is already terminal', async () => {
    const { db, caseDoc, taskDoc } = createDb({
      caseData: { tenantId: 'tenant-1', cpf: '12345678909', enrichmentGeneration: 3, status: 'PENDING' },
      taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'DONE', processedAt: 'SERVER_TIMESTAMP' },
    });
    const maybeRunAutoClassifyAndAi = vi.fn(async () => {});

    const result = await handleEscavador2CallbackLogic({
      req: createValidCallbackReq(),
      db,
      FieldValue,
      escavador2ApiKey: { value: () => 'secret' },
      maybeRunAutoClassifyAndAi,
    });

    expect(result).toEqual({ status: 200, body: { ok: true, ignored: true, reason: 'already_processed' } });
    expect(caseDoc.data.escavador2EnrichmentStatus).toBeUndefined();
    expect(taskDoc.data.status).toBe('DONE');
    expect(maybeRunAutoClassifyAndAi).not.toHaveBeenCalled();
  });

  it('returns unknown_task when task document does not exist', async () => {
    const { db, caseDoc, taskDoc } = createDb({
      caseData: { tenantId: 'tenant-1', cpf: '12345678909', enrichmentGeneration: 3, status: 'PENDING' },
      taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'QUEUED' },
    });
    taskDoc.snap = () => ({ exists: false, data: () => null, ref: taskDoc.ref });
    const maybeRunAutoClassifyAndAi = vi.fn(async () => {});

    const result = await handleEscavador2CallbackLogic({
      req: createValidCallbackReq(),
      db,
      FieldValue,
      escavador2ApiKey: { value: () => 'secret' },
      maybeRunAutoClassifyAndAi,
    });

    expect(result).toEqual({ status: 200, body: { ok: true, ignored: true, reason: 'unknown_task' } });
    expect(caseDoc.data.escavador2EnrichmentStatus).toBeUndefined();
    expect(maybeRunAutoClassifyAndAi).not.toHaveBeenCalled();
  });

  it('returns case_not_found and marks task failed when case does not exist', async () => {
    const { db, caseDoc, taskDoc } = createDb({
      caseData: { tenantId: 'tenant-1', cpf: '12345678909', enrichmentGeneration: 3, status: 'PENDING' },
      taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'QUEUED' },
    });
    caseDoc.snap = () => ({ exists: false, data: () => null, ref: caseDoc.ref });
    const maybeRunAutoClassifyAndAi = vi.fn(async () => {});

    const result = await handleEscavador2CallbackLogic({
      req: createValidCallbackReq(),
      db,
      FieldValue,
      escavador2ApiKey: { value: () => 'secret' },
      maybeRunAutoClassifyAndAi,
    });

    expect(result).toEqual({ status: 200, body: { ok: true, ignored: true, reason: 'case_not_found' } });
    expect(taskDoc.data.status).toBe('FAILED');
    expect(taskDoc.data.failReason).toBe('case_not_found');
    expect(maybeRunAutoClassifyAndAi).not.toHaveBeenCalled();
  });

  it('simula concorrencia: apenas o primeiro callback processa a task', async () => {
    const { db, caseDoc, taskDoc } = createDb({
      caseData: { tenantId: 'tenant-1', cpf: '12345678909', enrichmentGeneration: 3, status: 'PENDING' },
      taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'QUEUED' },
    });
    const maybeRunAutoClassifyAndAi = vi.fn(async () => {});

    const first = await handleEscavador2CallbackLogic({
      req: createValidCallbackReq(),
      db,
      FieldValue,
      escavador2ApiKey: { value: () => 'secret' },
      normalizeEscavador2Response: vi.fn(() => ({ escavador2ApiStatus: 'DONE', escavador2ProcessTotal: 1, escavador2Processos: [], escavador2CostBRL: 0 })),
      deduplicateEscavador2Findings: vi.fn(() => ({ escavador2Processos: [], escavador2DuplicateCount: 0, escavador2NewFindingCount: 0, escavador2HasNewMaterialRisk: false })),
      maybeRunAutoClassifyAndAi,
    });

    const second = await handleEscavador2CallbackLogic({
      req: createValidCallbackReq(),
      db,
      FieldValue,
      escavador2ApiKey: { value: () => 'secret' },
      maybeRunAutoClassifyAndAi,
    });

    expect(first).toEqual({ status: 200, body: { ok: true, caseId: 'case-1', status: 'DONE' } });
    expect(second).toEqual({ status: 200, body: { ok: true, ignored: true, reason: 'already_processed' } });
    expect(caseDoc.data).toMatchObject({
      escavador2EnrichmentStatus: 'DONE',
      escavador2CallbackStatus: 'DONE',
    });
    expect(taskDoc.data.status).toBe('DONE');
    expect(db.runTransaction).toHaveBeenCalledTimes(2);
    expect(maybeRunAutoClassifyAndAi).toHaveBeenCalledTimes(1);
  });

  it('retries with minimal persistence when Firestore rejects the case document size', async () => {
    const { db, caseDoc, taskDoc } = createDb({
      caseData: { tenantId: 'tenant-1', cpf: '12345678909', enrichmentGeneration: 3, status: 'PENDING' },
      taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'QUEUED' },
    });
    const sizeError = Object.assign(
      new Error('The value of the document exceeds the maximum size of 1048576 bytes.'),
      { code: 3 },
    );
    db.runTransaction.mockRejectedValueOnce(sizeError);
    const maybeRunAutoClassifyAndAi = vi.fn(async () => {});
    const verbose = 'conteudo tecnico '.repeat(10000);

    const result = await handleEscavador2CallbackLogic({
      req: createValidCallbackReq(),
      db,
      FieldValue,
      escavador2ApiKey: { value: () => 'secret' },
      normalizeEscavador2Response: vi.fn(() => ({
        escavador2ApiStatus: 'DONE',
        escavador2ProcessTotal: 1,
        escavador2Processos: [{
          numeroCnj: '0001234-56.2024.8.26.0100',
          area: 'LABOR',
          isLabor: true,
          isTrabalhista: true,
          isPlaintiff: true,
          hasExactCpfMatch: true,
          parties: [{ name: 'NOME INTEGRAL', role: 'Polo Ativo', side: 'ACTIVE' }],
          _sourceEscavador2: { normalizado: { debug: verbose } },
        }],
        escavador2RawPayloads: { response: { debug: verbose } },
        escavador2PartialErrors: [{ debug: verbose }],
        escavador2Stats: { debug: verbose },
        escavador2Sources: { debug: verbose },
        escavador2CostBRL: 0,
      })),
      deduplicateEscavador2Findings: vi.fn((data) => ({
        escavador2Processos: data.escavador2Processos.map((process) => ({
          ...process,
          isNewEscavador2Finding: true,
        })),
        escavador2DuplicateCount: 0,
        escavador2NewFindingCount: 1,
        escavador2HasNewMaterialRisk: false,
      })),
      maybeRunAutoClassifyAndAi,
    });

    expect(result).toEqual({
      status: 200,
      body: { ok: true, caseId: 'case-1', status: 'DONE', sizeFallback: true },
    });
    expect(db.runTransaction).toHaveBeenCalledTimes(2);
    expect(caseDoc.data).toMatchObject({
      escavador2EnrichmentStatus: 'DONE',
      escavador2CallbackStatus: 'DONE',
      escavador2PersistenceFallback: 'DOCUMENT_SIZE',
      escavador2RawPayloads: { __delete: true },
    });
    expect(caseDoc.data.escavador2Processos[0]).toEqual(expect.objectContaining({
      numeroCnj: '0001234-56.2024.8.26.0100',
      isNewEscavador2Finding: true,
      parties: [{ name: 'NOME INTEGRAL', role: 'Polo Ativo', side: 'ACTIVE' }],
    }));
    expect(caseDoc.data.escavador2Processos[0]._sourceEscavador2?.normalizado).toBeUndefined();
    expect(taskDoc.data).toMatchObject({ status: 'DONE', sizeFallback: true });
    expect(maybeRunAutoClassifyAndAi).toHaveBeenCalledTimes(1);
  });

  it('does not retry a generic transaction failure as a document-size error', async () => {
    const { db } = createDb({
      caseData: { tenantId: 'tenant-1', cpf: '12345678909', enrichmentGeneration: 3, status: 'PENDING' },
      taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'QUEUED' },
    });
    db.runTransaction.mockRejectedValueOnce(new Error('transaction blowup'));

    await expect(handleEscavador2CallbackLogic(createBaseDeps({
      req: createValidCallbackReq(),
      db,
    }))).rejects.toThrow('transaction blowup');
    expect(db.runTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('createEscavador2CallbackHandler', () => {
  it('returns 405 when method is not POST', async () => {
    const { db } = createDb({
      caseData: { tenantId: 'tenant-1', cpf: '12345678909', enrichmentGeneration: 3, status: 'PENDING' },
      taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'QUEUED' },
    });
    const handler = createEscavador2CallbackHandler(createBaseDeps({ db }));
    const res = createRes();
    const req = createValidCallbackReq({ method: 'GET' });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: 'method_not_allowed' });
  });

  it('returns 200 for unknown_task', async () => {
    const { db, taskDoc } = createDb({
      caseData: { tenantId: 'tenant-1', cpf: '12345678909', enrichmentGeneration: 3, status: 'PENDING' },
      taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'QUEUED' },
    });
    taskDoc.snap = () => ({ exists: false, data: () => null, ref: taskDoc.ref });
    const handler = createEscavador2CallbackHandler(createBaseDeps({ db }));
    const res = createRes();

    await handler(createValidCallbackReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true, ignored: true, reason: 'unknown_task' });
  });

  it('returns 200 for already_processed', async () => {
    const { db } = createDb({
      caseData: { tenantId: 'tenant-1', cpf: '12345678909', enrichmentGeneration: 3, status: 'PENDING' },
      taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'DONE', processedAt: 'SERVER_TIMESTAMP' },
    });
    const handler = createEscavador2CallbackHandler(createBaseDeps({ db }));
    const res = createRes();

    await handler(createValidCallbackReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true, ignored: true, reason: 'already_processed' });
  });

  it('returns 200 for case_not_found and marks task failed', async () => {
    const { db, caseDoc, taskDoc } = createDb({
      caseData: { tenantId: 'tenant-1', cpf: '12345678909', enrichmentGeneration: 3, status: 'PENDING' },
      taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'QUEUED' },
    });
    caseDoc.snap = () => ({ exists: false, data: () => null, ref: caseDoc.ref });
    const handler = createEscavador2CallbackHandler(createBaseDeps({ db }));
    const res = createRes();

    await handler(createValidCallbackReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true, ignored: true, reason: 'case_not_found' });
    expect(taskDoc.data.status).toBe('FAILED');
    expect(taskDoc.data.failReason).toBe('case_not_found');
  });

  // O circuito de escavador2 e consultado antes de enfileirar (enrichmentPhases.js),
  // mas nenhum desfecho assincrono o alimentava — durante um outage ele ficava
  // fechado para sempre e o sistema seguia enfileirando consulta condenada.
  describe('circuit breaker', () => {
    function createCircuitDeps(overrides = {}) {
      const recordSuccess = vi.fn(async () => {});
      const recordFailure = vi.fn(async () => {});
      return {
        deps: createBaseDeps({ recordSuccess, recordFailure, ...overrides }),
        recordSuccess,
        recordFailure,
      };
    }

    it('registra falha no circuito quando o callback e FAILED', async () => {
      const { db } = createDb({
        caseData: { tenantId: 'tenant-1', enrichmentGeneration: 3, status: 'PENDING' },
        taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'QUEUED' },
      });
      const { deps, recordFailure, recordSuccess } = createCircuitDeps({ db });

      await handleEscavador2CallbackLogic({
        ...deps,
        req: createValidCallbackReq({ body: { status: 'FAILED', error: 'proxy bloqueou a rota' } }),
      });

      expect(recordFailure).toHaveBeenCalledTimes(1);
      expect(recordFailure).toHaveBeenCalledWith('escavador2', expect.stringContaining('proxy'));
      expect(recordSuccess).not.toHaveBeenCalled();
    });

    it.each(['DONE', 'PARTIAL'])('registra sucesso no circuito quando o callback e %s', async (status) => {
      const { db } = createDb({
        caseData: { tenantId: 'tenant-1', enrichmentGeneration: 3, status: 'PENDING' },
        taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'QUEUED' },
      });
      const { deps, recordFailure, recordSuccess } = createCircuitDeps({ db });

      await handleEscavador2CallbackLogic({
        ...deps,
        req: createValidCallbackReq({ body: { status } }),
      });

      expect(recordSuccess).toHaveBeenCalledWith('escavador2');
      expect(recordFailure).not.toHaveBeenCalled();
    });

    it('nao mexe no circuito quando a task ja foi processada', async () => {
      const { db } = createDb({
        caseData: { tenantId: 'tenant-1', enrichmentGeneration: 3, status: 'PENDING' },
        taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'DONE', processedAt: 'antes' },
      });
      const { deps, recordFailure, recordSuccess } = createCircuitDeps({ db });

      await handleEscavador2CallbackLogic({ ...deps, req: createValidCallbackReq() });

      expect(recordSuccess).not.toHaveBeenCalled();
      expect(recordFailure).not.toHaveBeenCalled();
    });

    it('nao mexe no circuito quando a geracao esta obsoleta', async () => {
      const { db } = createDb({
        caseData: { tenantId: 'tenant-1', enrichmentGeneration: 9, status: 'PENDING' },
        taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'QUEUED' },
      });
      const { deps, recordFailure, recordSuccess } = createCircuitDeps({ db });

      await handleEscavador2CallbackLogic({ ...deps, req: createValidCallbackReq() });

      expect(recordSuccess).not.toHaveBeenCalled();
      expect(recordFailure).not.toHaveBeenCalled();
    });

    it('falha do circuito nao derruba o callback', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { db } = createDb({
        caseData: { tenantId: 'tenant-1', enrichmentGeneration: 3, status: 'PENDING' },
        taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'QUEUED' },
      });
      const { deps } = createCircuitDeps({
        db,
        recordSuccess: vi.fn(async () => { throw new Error('systemHealth indisponivel'); }),
      });

      const result = await handleEscavador2CallbackLogic({ ...deps, req: createValidCallbackReq() });

      expect(result.status).toBe(200);
      consoleSpy.mockRestore();
    });
  });

  it('returns 500 when callback logic throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { db } = createDb({
      caseData: { tenantId: 'tenant-1', cpf: '12345678909', enrichmentGeneration: 3, status: 'PENDING' },
      taskData: { caseId: 'case-1', enrichmentGeneration: 3, status: 'QUEUED' },
    });
    db.runTransaction = vi.fn(async () => { throw new Error('transaction blowup'); });
    const handler = createEscavador2CallbackHandler(createBaseDeps({ db }));
    const res = createRes();

    await handler(createValidCallbackReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: 'internal_error' });
    consoleSpy.mockRestore();
  });
});
