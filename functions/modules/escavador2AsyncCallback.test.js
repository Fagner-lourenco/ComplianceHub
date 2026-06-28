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
