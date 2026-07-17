/**
 * enrichmentPhases.test.js
 */

import { describe, it, expect, vi } from 'vitest';

import {
  createEnrichmentPhases,
  evaluateEscavadorNeed,
  evaluateNegativePartialSafetyNet,
  extractKnownProcessNumbers,
} from './enrichmentPhases';

function makeCaseRef(overrides = {}) {
  const state = { ...overrides };
  return {
    update: vi.fn(async (payload) => {
      Object.assign(state, payload);
      return Promise.resolve();
    }),
    get: vi.fn(async () => ({ data: () => state, exists: true })),
    _state: state,
  };
}

function makeDeps(overrides = {}) {
  return {
    db: { collection: vi.fn(() => ({ doc: vi.fn(() => makeCaseRef()) })) },
    FieldValue: {
      serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
      delete: vi.fn(() => 'DELETE'),
    },
    fontedataApiKey: { value: vi.fn(() => 'fd-key') },
    escavadorApiToken: { value: vi.fn(() => 'esc-token') },
    juditApiKey: { value: vi.fn(() => 'jud-key') },
    bigdatacorpAccessToken: { value: vi.fn(() => 'bdc-token') },
    bigdatacorpTokenId: { value: vi.fn(() => 'bdc-id') },
    maybeRunAutoClassifyAndAi: vi.fn(() => Promise.resolve()),
    returnCaseForIdentityGateBlock: vi.fn(() => Promise.resolve()),
    adapters: {},
    normalizers: {},
    helpers: {},
    ...overrides,
  };
}

const VALID_CPF = '12345678901';

describe('evaluateEscavadorNeed', () => {
  it('retorna true quando criminalFlag é POSITIVE', () => {
    expect(evaluateEscavadorNeed({ juditCriminalFlag: 'POSITIVE' }, { escalation: { triggerEscavador: ['criminal'] } })).toBe(true);
  });

  it('retorna true quando warrantFlag é POSITIVE', () => {
    expect(evaluateEscavadorNeed({ juditWarrantFlag: 'POSITIVE' }, { escalation: { triggerEscavador: ['warrant'] } })).toBe(true);
  });

  it('retorna true quando executionFlag é POSITIVE', () => {
    expect(evaluateEscavadorNeed({ juditExecutionFlag: 'POSITIVE' }, { escalation: { triggerEscavador: ['execution'] } })).toBe(true);
  });

  it('retorna true quando highProcessCount atinge threshold', () => {
    expect(evaluateEscavadorNeed({ juditProcessTotal: 5 }, { escalation: { triggerEscavador: ['highProcessCount'], processCountThreshold: 5 } })).toBe(true);
  });

  it('retorna false quando nenhum trigger atende', () => {
    expect(evaluateEscavadorNeed({ juditProcessTotal: 1 }, { escalation: { triggerEscavador: ['criminal'], processCountThreshold: 5 } })).toBe(false);
  });
});

describe('evaluateNegativePartialSafetyNet', () => {
  it('retorna NONE quando nao ha cobertura parcial, baixa cobertura ou revisao recomendada', () => {
    expect(evaluateNegativePartialSafetyNet({}, { criminalFlag: 'POSITIVE', coverageLevel: 'HIGH_COVERAGE' })).toEqual({ eligible: false, reasons: [], action: 'NONE' });
  });

  it('retorna NONE quando escavador já foi processado', () => {
    expect(evaluateNegativePartialSafetyNet({ escavadorEnrichmentStatus: 'DONE' }, { criminalFlag: 'NEGATIVE', criminalEvidenceQuality: 'NEGATIVE_WITH_PARTIAL_COVERAGE' })).toEqual({ eligible: false, reasons: [], action: 'NONE' });
  });

  it('retorna RUN_ESCAVADOR quando há LOW_COVERAGE', () => {
    expect(evaluateNegativePartialSafetyNet({}, { criminalFlag: 'NEGATIVE', coverageLevel: 'LOW_COVERAGE', criminalEvidenceQuality: 'NEGATIVE_WITH_PARTIAL_COVERAGE' })).toEqual({ eligible: true, reasons: ['LOW_COVERAGE', 'JUDIT_ZERO_PROCESS'], action: 'RUN_ESCAVADOR' });
  });
});

describe('extractKnownProcessNumbers', () => {
  it('extrai números de processo de todas as fontes', () => {
    const caseData = {
      juditProcessos: [{ cnj: '123456789012345' }],
      escavadorProcessos: [{ numeroCnj: '123456789012345' }],
      bigdatacorpProcessos: [{ Number: '543210987654321' }],
    };
    expect(extractKnownProcessNumbers(caseData)).toEqual(['123456789012345', '543210987654321']);
  });

  it('ignora números curtos', () => {
    expect(extractKnownProcessNumbers({ juditProcessos: [{ cnj: '123' }] })).toEqual([]);
  });
});

describe('runFonteDataEnrichmentPhase', () => {
  function makeFonteDataDeps(overrides = {}) {
    const queryReceitaFederal = vi.fn();
    const queryIdentity = vi.fn();
    const queryProcessosAgrupada = vi.fn();
    const queryWarrant = vi.fn();
    const queryLabor = vi.fn();
    const normalizeReceitaFederal = vi.fn((data) => data);
    const normalizeIdentity = vi.fn((data) => data);
    const normalizeProcessos = vi.fn((data) => data);
    const normalizeWarrant = vi.fn((data) => data);
    const normalizeLabor = vi.fn((data) => data);
    const checkCircuit = vi.fn(() => Promise.resolve({ open: false }));
    return {
      ...makeDeps({
        adapters: {
          queryReceitaFederal,
          queryIdentity,
          queryProcessosAgrupada,
          queryWarrant,
          queryLabor,
          FonteDataError: class FonteDataError extends Error {
            constructor(message, statusCode) {
              super(message);
              this.statusCode = statusCode;
            }
          },
        },
        normalizers: {
          normalizeReceitaFederal,
          normalizeIdentity,
          normalizeProcessos,
          normalizeWarrant,
          normalizeLabor,
        },
        helpers: {
          checkCircuit,
          recordSuccess: vi.fn(() => Promise.resolve()),
          recordFailure: vi.fn(() => Promise.resolve()),
          computeNameSimilarity: vi.fn((a, b) => (a && b ? 1.0 : 0.0)),
        },
      }),
      mocks: {
        queryReceitaFederal,
        queryIdentity,
        queryProcessosAgrupada,
        queryWarrant,
        queryLabor,
        checkCircuit,
      },
      ...overrides,
    };
  }

  it('falha quando CPF é inválido', async () => {
    const deps = makeDeps();
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();
    const result = await phases.runFonteDataEnrichmentPhase(caseRef, 'c1', { cpf: '123' }, { phases: {} });
    expect(result.status).toBe('FAILED');
    expect(caseRef.update).toHaveBeenCalled();
  });

  it('passa gate e executa fases com sucesso', async () => {
    const { mocks, ...deps } = makeFonteDataDeps();
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();

    mocks.queryReceitaFederal.mockResolvedValue({ enrichmentIdentity: { name: 'John Doe', cpfStatus: 'REGULAR' }, _source: {} });
    mocks.queryIdentity.mockResolvedValue({ enrichmentContact: { primaryUf: 'SP', allUfs: ['SP'] }, _source: {} });
    mocks.queryProcessosAgrupada.mockResolvedValue({ criminalFlag: 'NEGATIVE', processTotal: 0, _source: {} });
    mocks.queryWarrant.mockResolvedValue({ warrantFlag: 'NEGATIVE', _source: {} });
    mocks.queryLabor.mockResolvedValue({ laborFlag: 'NEGATIVE', _source: {} });

    const result = await phases.runFonteDataEnrichmentPhase(caseRef, 'c1', { cpf: VALID_CPF, candidateName: 'John Doe' }, {
      phases: { identity: true, criminal: true, warrant: true, labor: true },
      gate: { minNameSimilarity: 0.7 },
      escalation: { enabled: false },
    });

    expect(result.status).toBe('DONE');
    expect(mocks.queryReceitaFederal).toHaveBeenCalled();
    expect(mocks.queryIdentity).toHaveBeenCalled();
  });

  it('respeita circuit breaker aberto', async () => {
    const { mocks, ...deps } = makeFonteDataDeps();
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();

    mocks.checkCircuit.mockResolvedValue({ open: true, reason: 'too many errors' });
    mocks.queryReceitaFederal.mockResolvedValue({ enrichmentIdentity: { name: 'John Doe', cpfStatus: 'REGULAR' }, _source: {} });

    const result = await phases.runFonteDataEnrichmentPhase(caseRef, 'c1', { cpf: VALID_CPF, candidateName: 'John Doe' }, {
      phases: { identity: true, criminal: true },
      gate: { minNameSimilarity: 0.7 },
    });

    expect(result.status).toBe('PARTIAL');
    expect(mocks.queryIdentity).not.toHaveBeenCalled();
  });
});

describe('runEscavadorEnrichmentPhase', () => {
  function makeEscavadorDeps(overrides = {}) {
    const queryProcessosByPerson = vi.fn();
    const checkCircuit = vi.fn(() => Promise.resolve({ open: false }));
    return {
      ...makeDeps({
        adapters: {
          queryProcessosByPerson,
          EscavadorError: class EscavadorError extends Error {
            constructor(message, statusCode) {
              super(message);
              this.statusCode = statusCode;
            }
          },
        },
        normalizers: {
          normalizeEscavadorProcessos: vi.fn((data) => data),
        },
        helpers: {
          checkCircuit,
          recordSuccess: vi.fn(() => Promise.resolve()),
          recordFailure: vi.fn(() => Promise.resolve()),
          getEscavadorTribunais: vi.fn(() => []),
        },
      }),
      mocks: { queryProcessosByPerson, checkCircuit },
      ...overrides,
    };
  }

  it('falha quando token não configurado', async () => {
    const deps = makeDeps({ escavadorApiToken: { value: vi.fn(() => '') } });
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();
    const result = await phases.runEscavadorEnrichmentPhase(caseRef, 'c1', { cpf: VALID_CPF }, {});
    expect(result.status).toBe('FAILED');
  });

  it('consulta processos com sucesso', async () => {
    const { mocks, ...deps } = makeEscavadorDeps();
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();

    mocks.queryProcessosByPerson.mockResolvedValue({ items: [{ numeroCnj: '123' }], _source: {} });

    const result = await phases.runEscavadorEnrichmentPhase(caseRef, 'c1', { cpf: VALID_CPF }, { filters: {} });
    expect(result.status).toBe('DONE');
    expect(mocks.queryProcessosByPerson).toHaveBeenCalled();
  });
});

describe('runBigDataCorpEnrichmentPhase', () => {
  function makeBdcDeps(overrides = {}) {
    const queryBigDataCorpCombined = vi.fn();
    const checkCircuit = vi.fn(() => Promise.resolve({ open: false }));
    return {
      ...makeDeps({
        adapters: {
          queryBigDataCorpCombined,
          BigDataCorpError: class BigDataCorpError extends Error {
            constructor(message, statusCode) {
              super(message);
              this.statusCode = statusCode;
            }
          },
        },
        normalizers: {
          normalizeBigDataCorpBasicData: vi.fn((data) => data || {}),
          normalizeBigDataCorpProcesses: vi.fn((data) => data || {}),
          normalizeBigDataCorpKyc: vi.fn((data) => data || {}),
          normalizeBigDataCorpProfession: vi.fn((data) => data || {}),
        },
        helpers: {
          checkCircuit,
          recordSuccess: vi.fn(() => Promise.resolve()),
          recordFailure: vi.fn(() => Promise.resolve()),
          computeNameSimilarity: vi.fn((a, b) => (a && b ? 1.0 : 0.0)),
        },
      }),
      mocks: { queryBigDataCorpCombined, checkCircuit },
      ...overrides,
    };
  }

  it('falha quando credenciais não configuradas', async () => {
    const deps = makeDeps({ bigdatacorpAccessToken: { value: vi.fn(() => '') } });
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();
    const result = await phases.runBigDataCorpEnrichmentPhase(caseRef, 'c1', { cpf: VALID_CPF }, {});
    expect(result.status).toBe('FAILED');
  });

  it('executa com sucesso', async () => {
    const { mocks, ...deps } = makeBdcDeps();
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();

    mocks.queryBigDataCorpCombined.mockResolvedValue({
      basicData: { cpfStatus: 'REGULAR', name: 'John Doe' },
      processes: [],
      kycData: {},
      professionData: {},
      elapsedMs: 120,
    });

    const result = await phases.runBigDataCorpEnrichmentPhase(caseRef, 'c1', { cpf: VALID_CPF, candidateName: 'John Doe' }, {
      phases: { basicData: true, processes: true, kyc: true, occupation: true },
      gate: { minNameSimilarity: 0.7 },
    });

    expect(result.status).toBe('DONE');
    expect(mocks.queryBigDataCorpCombined).toHaveBeenCalled();
  });
});

describe('runJuditEnrichmentPhase', () => {
  function makeJuditDeps(overrides = {}) {
    const queryLawsuitsSync = vi.fn();
    const checkCircuit = vi.fn(() => Promise.resolve({ open: false }));
    const registerJuditWebhookRequest = vi.fn(() => Promise.resolve());
    return {
      ...makeDeps({
        adapters: {
          queryLawsuitsSync,
          JuditError: class JuditError extends Error {
            constructor(message, statusCode) {
              super(message);
              this.statusCode = statusCode;
            }
          },
        },
        normalizers: {
          normalizeJuditLawsuits: vi.fn((data) => data || {}),
          normalizeJuditWarrants: vi.fn((data) => data || {}),
          normalizeJuditExecution: vi.fn((data) => data || {}),
        },
        helpers: {
          checkCircuit,
          recordSuccess: vi.fn(() => Promise.resolve()),
          recordFailure: vi.fn(() => Promise.resolve()),
          buildJuditCallbackUrl: vi.fn(() => 'https://example.com/callback'),
          registerJuditWebhookRequest,
          getJuditTribunais: vi.fn(() => []),
          buildCandidateUfs: vi.fn(() => []),
        },
      }),
      mocks: { queryLawsuitsSync, checkCircuit, registerJuditWebhookRequest },
      ...overrides,
    };
  }

  it('falha quando API key não configurada', async () => {
    const deps = makeDeps({ juditApiKey: { value: vi.fn(() => '') } });
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();
    const result = await phases.runJuditEnrichmentPhase(caseRef, 'c1', { cpf: VALID_CPF }, {});
    expect(result.status).toBe('FAILED');
  });

  it('usa gate BDC existente e pula Judit gate', async () => {
    const deps = makeDeps({
      helpers: {
        checkCircuit: vi.fn(() => Promise.resolve({ open: false })),
        recordSuccess: vi.fn(() => Promise.resolve()),
        recordFailure: vi.fn(() => Promise.resolve()),
        buildJuditCallbackUrl: vi.fn(() => 'https://example.com/callback'),
        registerJuditWebhookRequest: vi.fn(() => Promise.resolve()),
        getJuditTribunais: vi.fn(() => []),
        buildCandidateUfs: vi.fn(() => []),
      },
    });
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();

    const result = await phases.runJuditEnrichmentPhase(caseRef, 'c1', {
      cpf: VALID_CPF,
      bigdatacorpEnrichmentStatus: 'DONE',
      bigdatacorpGateResult: { passed: true, nameSimilarity: 0.95, cpfStatus: 'REGULAR' },
      juditGateResult: { passed: true, source: 'existing' },
    }, { phases: { lawsuits: false, warrant: false, execution: false } });

    expect(result.status).toBe('SKIPPED');
  });

  it('consulta lawsuits sync com sucesso', async () => {
    const { mocks, ...deps } = makeJuditDeps();
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();

    mocks.queryLawsuitsSync.mockResolvedValue({ responseData: [], requestId: 'r1', _request: {} });

    const result = await phases.runJuditEnrichmentPhase(caseRef, 'c1', { cpf: VALID_CPF }, {
      phases: { lawsuits: true, warrant: false, execution: false },
      filters: {},
      nameSearchSupplement: { enabled: false },
      persistence: { saveRawPayloads: false },
    }, { skipGate: true });

    expect(result.status).toBe('DONE');
    expect(mocks.queryLawsuitsSync).toHaveBeenCalled();
  });
});

describe('runDjenEnrichmentPhase', () => {
  function makeDjenDeps(overrides = {}) {
    const queryComunicacoesByProcesso = vi.fn();
    const queryComunicacoesByName = vi.fn();
    const checkCircuit = vi.fn(() => Promise.resolve({ open: false }));
    return {
      ...makeDeps({
        adapters: {
          queryComunicacoesByProcesso,
          queryComunicacoesByName,
          DjenError: class DjenError extends Error {
            constructor(message, statusCode) {
              super(message);
              this.statusCode = statusCode;
            }
          },
        },
        normalizers: {
          normalizeDjenComunicacoes: vi.fn((data) => data || {}),
        },
        helpers: {
          checkCircuit,
          recordSuccess: vi.fn(() => Promise.resolve()),
          recordFailure: vi.fn(() => Promise.resolve()),
        },
      }),
      mocks: { queryComunicacoesByProcesso, queryComunicacoesByName, checkCircuit },
      ...overrides,
    };
  }

  it('executa hybrid com sucesso', async () => {
    const { mocks, ...deps } = makeDjenDeps();
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();

    mocks.queryComunicacoesByProcesso.mockResolvedValue({ items: [], count: 0 });
    mocks.queryComunicacoesByName.mockResolvedValue({ items: [], count: 0 });

    const result = await phases.runDjenEnrichmentPhase(caseRef, 'c1', {
      cpf: VALID_CPF,
      candidateName: 'John Doe',
      juditProcessos: [{ cnj: '123456789012345' }],
    }, {
      searchStrategy: 'hybrid',
      filters: {},
    });

    expect(result.status).toBe('DONE');
    expect(mocks.queryComunicacoesByProcesso).toHaveBeenCalled();
    expect(mocks.queryComunicacoesByName).toHaveBeenCalled();
  });

  it('falha quando nome não disponível em estratégia byName', async () => {
    const deps = makeDeps();
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();

    const result = await phases.runDjenEnrichmentPhase(caseRef, 'c1', { cpf: VALID_CPF }, {
      searchStrategy: 'byName',
    });

    expect(result.status).toBe('FAILED');
  });
});

describe('runEscavador2EnrichmentPhase', () => {
  function makeEscavador2Deps(overrides = {}) {
    const checkCircuit = vi.fn(() => Promise.resolve({ open: false }));
    const recordSuccess = vi.fn(() => Promise.resolve());
    const recordFailure = vi.fn(() => Promise.resolve());
    const consultarEscavador2 = vi.fn();
    const normalizeEscavador2Response = vi.fn((data) => data);
    const deduplicateEscavador2Findings = vi.fn((data) => ({
      escavador2Processos: data.escavador2Processos || [],
      escavador2DuplicateCount: 0,
      escavador2NewFindingCount: data.escavador2Processos?.length || 0,
      escavador2HasNewMaterialRisk: false,
    }));
    return {
      ...makeDeps({
        escavador2ApiKey: { value: vi.fn(() => 'esc2-key') },
        adapters: {
          consultarEscavador2,
          Escavador2Error: class Escavador2Error extends Error {
            constructor(message, statusCode) {
              super(message);
              this.statusCode = statusCode;
            }
          },
        },
        normalizers: {
          normalizeEscavador2Response,
        },
        helpers: {
          deduplicateEscavador2Findings,
          checkCircuit,
          recordSuccess,
          recordFailure,
        },
      }),
      mocks: { checkCircuit, recordSuccess, recordFailure, consultarEscavador2, normalizeEscavador2Response, deduplicateEscavador2Findings },
      ...overrides,
    };
  }

  it('fails when ESCAVADOR2_API_KEY is missing and triggers classification', async () => {
    const deps = makeEscavador2Deps({ escavador2ApiKey: { value: vi.fn(() => '') } });
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();

    const result = await phases.runEscavador2EnrichmentPhase(caseRef, 'c1', { cpf: VALID_CPF, candidateName: 'John Doe' }, { enabled: true });

    expect(result.status).toBe('FAILED');
    expect(caseRef.update).toHaveBeenCalledWith(expect.objectContaining({
      escavador2EnrichmentStatus: 'FAILED',
      escavador2Error: 'ESCAVADOR2_API_KEY nao configurado.',
    }));
    expect(deps.maybeRunAutoClassifyAndAi).toHaveBeenCalledWith(caseRef, 'c1', 'Escavador2 failed');
  });

  it('stores normalized deduped data as DONE', async () => {
    const { mocks, ...deps } = makeEscavador2Deps();
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();
    mocks.consultarEscavador2.mockResolvedValue({ consulta: { status: 'DONE' }, processos: [] });
    mocks.normalizeEscavador2Response.mockReturnValue({
      escavador2ApiStatus: 'DONE',
      escavador2ProcessTotal: 1,
      escavador2Processos: [{ numeroCnj: '0001234-56.2024.8.26.0100', isMaterialRisk: true }],
      escavador2CriminalFlag: 'POSITIVE',
      escavador2CriminalCount: 1,
      escavador2LaborFlag: 'NEGATIVE',
      escavador2LaborCount: 0,
      escavador2CostBRL: 0,
    });
    mocks.deduplicateEscavador2Findings.mockReturnValue({
      escavador2Processos: [{ numeroCnj: '0001234-56.2024.8.26.0100', isNewEscavador2Finding: true }],
      escavador2DuplicateCount: 0,
      escavador2NewFindingCount: 1,
      escavador2HasNewMaterialRisk: true,
    });

    const result = await phases.runEscavador2EnrichmentPhase(caseRef, 'c1', { cpf: VALID_CPF, candidateName: 'John Doe' }, {
      enabled: true,
      async: { enabled: false },
      request: { detalhar: true, movimentacoes: 'risk_only', documentos: 'risk_only', limit_movimentacoes: 20, limit_documentos: 20 },
      dedupe: { dateToleranceDays: 90 },
    });

    expect(result.status).toBe('DONE');
    expect(mocks.consultarEscavador2).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'esc2-key' }));
    expect(caseRef.update).toHaveBeenCalledWith(expect.objectContaining({
      escavador2EnrichmentStatus: 'DONE',
      escavador2Error: null,
      escavador2NewFindingCount: 1,
      escavador2HasNewMaterialRisk: true,
      escavador2CostBRL: 0,
    }));
    expect(deps.maybeRunAutoClassifyAndAi).toHaveBeenCalledWith(caseRef, 'c1', 'Escavador2 completed');
  });

  it('reapplies the persisted budget after synchronous deduplication', async () => {
    const { mocks, ...deps } = makeEscavador2Deps();
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();
    const hugeUnicode = 'evidencia complementar çã 🚨 '.repeat(100);
    const processes = Array.from({ length: 120 }, (_, index) => ({
      escavador2Index: index,
      numeroCnj: `${String(index).padStart(7, '0')}-00.2026.5.01.0001`,
      isLabor: true,
      isNewEscavador2Finding: index === 119,
      parties: [{ name: `${hugeUnicode}${index}`, role: 'Polo Ativo', side: 'ACTIVE' }],
    }));
    mocks.consultarEscavador2.mockResolvedValue({ consulta: { status: 'DONE' } });
    mocks.normalizeEscavador2Response.mockReturnValue({
      escavador2ApiStatus: 'DONE',
      escavador2ProcessTotal: processes.length,
      escavador2Processos: processes.map((process) => Object.fromEntries(
        Object.entries(process).filter(([key]) => key !== 'parties'),
      )),
    });
    mocks.deduplicateEscavador2Findings.mockReturnValue({
      escavador2Processos: processes,
      escavador2DuplicateCount: 119,
      escavador2NewFindingCount: 1,
      escavador2HasNewMaterialRisk: false,
    });

    await phases.runEscavador2EnrichmentPhase(caseRef, 'c1', { cpf: VALID_CPF, candidateName: 'John Doe' }, {
      enabled: true,
      async: { enabled: false },
      request: {},
      dedupe: { dateToleranceDays: 90 },
    });

    const persisted = caseRef.update.mock.calls.find(([payload]) => payload.escavador2EnrichmentStatus === 'DONE')[0];
    const escavador2Fields = Object.fromEntries(Object.entries(persisted).filter(([key]) => key.startsWith('escavador2')));
    expect(Buffer.byteLength(JSON.stringify(escavador2Fields), 'utf8')).toBeLessThanOrEqual(320 * 1024);
    expect(persisted.escavador2Processos).toEqual(expect.arrayContaining([
      expect.objectContaining({ numeroCnj: '0000119-00.2026.5.01.0001', isNewEscavador2Finding: true }),
    ]));
    expect(persisted.escavador2ProcessOmissions).toEqual(expect.objectContaining({
      original: processes.length,
      omitted: expect.any(Number),
    }));
  });

  it('runs the real sync normalize-dedupe-enforce pipeline before omitting processes', async () => {
    const { mocks, ...deps } = makeEscavador2Deps();
    deps.normalizers = {};
    delete deps.helpers.deduplicateEscavador2Findings;
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();
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
    mocks.consultarEscavador2.mockResolvedValue({
      consulta: { status: 'DONE' },
      resumo: { total_processos: processCount },
      processos: rawProcesses,
    });
    const caseData = {
      cpf: VALID_CPF,
      candidateName: 'CANDIDATO TESTE',
      bigdatacorpProcessos: rawProcesses.slice(0, -1).map((_, index) => ({ numeroCnj: processNumber(index), area: 'LABOR' })),
    };

    await phases.runEscavador2EnrichmentPhase(caseRef, 'c1', caseData, {
      enabled: true,
      async: { enabled: false },
      request: {},
      dedupe: { dateToleranceDays: 90 },
    });

    const persisted = caseRef.update.mock.calls.find(([payload]) => payload.escavador2EnrichmentStatus === 'DONE')[0];
    const escavador2Fields = Object.fromEntries(Object.entries(persisted).filter(([key]) => key.startsWith('escavador2')));
    expect(persisted.escavador2NewFindingCount).toBe(1);
    expect(persisted.escavador2Processos).toEqual(expect.arrayContaining([
      expect.objectContaining({ numeroCnj: processNumber(processCount - 1), isNewEscavador2Finding: true }),
    ]));
    expect(Buffer.byteLength(JSON.stringify(escavador2Fields), 'utf8')).toBeLessThanOrEqual(320 * 1024);
  });

  it('deletes stale omission markers after a normal synchronous completion without omissions', async () => {
    const { mocks, ...deps } = makeEscavador2Deps();
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();
    mocks.consultarEscavador2.mockResolvedValue({ consulta: { status: 'DONE' } });
    mocks.normalizeEscavador2Response.mockReturnValue({ escavador2ApiStatus: 'DONE', escavador2Processos: [] });

    await phases.runEscavador2EnrichmentPhase(caseRef, 'c1', { cpf: VALID_CPF, candidateName: 'John Doe' }, {
      enabled: true,
      async: { enabled: false },
      request: {},
      dedupe: { dateToleranceDays: 90 },
    });

    expect(caseRef.update).toHaveBeenCalledWith(expect.objectContaining({
      escavador2ProcessOmissions: 'DELETE',
      escavador2TechnicalOmissions: 'DELETE',
      escavador2PersistenceTruncated: 'DELETE',
      escavador2PersistenceFallback: 'DELETE',
    }));
  });

  it('stores partial data as PARTIAL and does not fail the pipeline', async () => {
    const { mocks, ...deps } = makeEscavador2Deps();
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();
    mocks.consultarEscavador2.mockResolvedValue({ consulta: { status: 'PARTIAL' }, processos: [] });
    mocks.normalizeEscavador2Response.mockReturnValue({ escavador2ApiStatus: 'PARTIAL', escavador2ProcessTotal: 0, escavador2Processos: [] });

    const result = await phases.runEscavador2EnrichmentPhase(caseRef, 'c1', { cpf: VALID_CPF, candidateName: 'John Doe' }, { enabled: true, async: { enabled: false }, request: {}, dedupe: { dateToleranceDays: 90 } });

    expect(result.status).toBe('PARTIAL');
    expect(caseRef.update).toHaveBeenCalledWith(expect.objectContaining({ escavador2EnrichmentStatus: 'PARTIAL' }));
    expect(deps.maybeRunAutoClassifyAndAi).toHaveBeenCalledWith(caseRef, 'c1', 'Escavador2 completed');
  });

  it('marks FAILED on provider error and triggers classification', async () => {
    const { mocks, ...deps } = makeEscavador2Deps();
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();
    mocks.consultarEscavador2.mockRejectedValue(new Error('Escavador2 HTTP 502'));

    const result = await phases.runEscavador2EnrichmentPhase(caseRef, 'c1', { cpf: VALID_CPF, candidateName: 'John Doe' }, { enabled: true, async: { enabled: false }, request: {}, dedupe: { dateToleranceDays: 90 } });

    expect(result.status).toBe('FAILED');
    expect(caseRef.update).toHaveBeenCalledWith(expect.objectContaining({
      escavador2EnrichmentStatus: 'FAILED',
      escavador2Error: 'Escavador2 HTTP 502',
    }));
    expect(deps.maybeRunAutoClassifyAndAi).toHaveBeenCalledWith(caseRef, 'c1', 'Escavador2 failed');
  });

  it('skips when processos phase is disabled in config', async () => {
    const { mocks, ...deps } = makeEscavador2Deps();
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();

    const result = await phases.runEscavador2EnrichmentPhase(caseRef, 'c1', { cpf: VALID_CPF, candidateName: 'John Doe' }, { enabled: true, phases: { processos: false } });

    expect(result.status).toBe('SKIPPED');
    expect(mocks.consultarEscavador2).not.toHaveBeenCalled();
    expect(caseRef.update).toHaveBeenCalledWith(expect.objectContaining({
      escavador2EnrichmentStatus: 'SKIPPED',
      escavador2CostBRL: 0,
    }));
    expect(deps.maybeRunAutoClassifyAndAi).toHaveBeenCalledWith(caseRef, 'c1', 'Escavador2 phase disabled');
  });

  it('clears stale derived fields when phase starts running', async () => {
    const { mocks, ...deps } = makeEscavador2Deps();
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();
    mocks.consultarEscavador2.mockResolvedValue({ consulta: { status: 'DONE' }, processos: [] });
    mocks.normalizeEscavador2Response.mockReturnValue({ escavador2ApiStatus: 'DONE', escavador2ProcessTotal: 0, escavador2Processos: [] });

    await phases.runEscavador2EnrichmentPhase(caseRef, 'c1', { cpf: VALID_CPF, candidateName: 'John Doe' }, { enabled: true, async: { enabled: false }, request: {}, dedupe: { dateToleranceDays: 90 } });

    const runningUpdate = caseRef.update.mock.calls.find((call) => call[0].escavador2EnrichmentStatus === 'RUNNING');
    expect(runningUpdate).toBeDefined();
    expect(runningUpdate[0]).toMatchObject({
      escavador2ProcessTotal: 'DELETE',
      escavador2Processos: 'DELETE',
      escavador2CriminalCount: 'DELETE',
      escavador2LaborCount: 'DELETE',
      escavador2NewFindingCount: 'DELETE',
    });
  });

  it('clears derived fields on failure while preserving raw payloads', async () => {
    const { mocks, ...deps } = makeEscavador2Deps();
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef({ escavador2RawPayloads: { response: { old: true } } });
    mocks.consultarEscavador2.mockRejectedValue(new Error('Escavador2 HTTP 502'));

    await phases.runEscavador2EnrichmentPhase(caseRef, 'c1', { cpf: VALID_CPF, candidateName: 'John Doe' }, { enabled: true, async: { enabled: false }, request: {}, dedupe: { dateToleranceDays: 90 } });

    const failureUpdate = caseRef.update.mock.calls.find((call) => call[0].escavador2EnrichmentStatus === 'FAILED');
    expect(failureUpdate).toBeDefined();
    expect(failureUpdate[0]).toMatchObject({
      escavador2ProcessTotal: 'DELETE',
      escavador2Processos: 'DELETE',
      escavador2NewFindingCount: 'DELETE',
    });
    expect(failureUpdate[0].escavador2RawPayloads).toBeUndefined();
  });

  it('enqueues Escavador2 async and waits for callback before auto-classification', async () => {
    const updates = [];
    const caseRef = { update: vi.fn(async (payload) => updates.push(payload)) };
    const maybeRunAutoClassifyAndAi = vi.fn(async () => {});
    const registerEscavador2Task = vi.fn(async () => {});

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
});
