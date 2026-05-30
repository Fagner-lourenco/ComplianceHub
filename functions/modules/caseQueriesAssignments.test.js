/**
 * caseQueriesAssignments.test.js — Testes unitários para funções puras extraídas
 */

const {
  asDate,
  asIsoOrNull,
  normalizeSearchText,
  resolveOpsMetricsTenant,
  isGlobalOpsProfile,
  normalizeMetricsPeriod,
  getMetricCaseDate,
  diffHoursBackend,
  pctBackend,
  makeRunId,
  buildProviderRunIds,
  getOverallEnrichmentStatusBackend,
  getSlaStateBackend,
  compareOpsCases,
  compareClientCases,
  matchesClientCaseSearchFull,
  matchesClientCaseFiltersFull,
  matchesOpsCaseSearchFull,
  matchesOpsCaseFiltersFull,
  buildOpsMetricsFromCases,
  buildClientDashboardMetricsFromCases,
} = require('./caseQueriesAssignments');

/* =========================================================
   Helpers — Date / Text
   ========================================================= */

describe('asDate', () => {
  it('retorna null para valores falsy', () => {
    expect(asDate(null)).toBeNull();
    expect(asDate(undefined)).toBeNull();
    expect(asDate('')).toBeNull();
  });

  it('retorna Date quando recebe Date', () => {
    const d = new Date('2024-01-15T10:00:00.000Z');
    expect(asDate(d)).toBe(d);
  });

  it('converte string ISO', () => {
    const result = asDate('2024-01-15T10:00:00.000Z');
    expect(result instanceof Date).toBe(true);
    expect(result.toISOString()).toBe('2024-01-15T10:00:00.000Z');
  });

  it('converte string no formato BR dd/mm/yyyy', () => {
    const result = asDate('15/01/2024');
    expect(result instanceof Date).toBe(true);
    expect(result.toISOString().startsWith('2024-01-15')).toBe(true);
  });

  it('converte string no formato BR com hora', () => {
    const result = asDate('15/01/2024 14:30:00');
    expect(result instanceof Date).toBe(true);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
  });

  it('converte objeto com toDate (Firestore timestamp)', () => {
    const d = new Date('2024-06-01T12:00:00.000Z');
    expect(asDate({ toDate: () => d })).toBe(d);
  });

  it('retorna null para string inválida', () => {
    expect(asDate('not-a-date')).toBeNull();
  });
});

describe('asIsoOrNull', () => {
  it('retorna null para valor falsy', () => {
    expect(asIsoOrNull(null)).toBeNull();
  });

  it('retorna ISO string para Date válido', () => {
    expect(asIsoOrNull(new Date('2024-01-15T10:00:00.000Z'))).toBe('2024-01-15T10:00:00.000Z');
  });
});

describe('normalizeSearchText', () => {
  it('normaliza acentos e caixa', () => {
    expect(normalizeSearchText('João Silva')).toBe('joao silva');
  });

  it('remove espaços extras', () => {
    expect(normalizeSearchText('  Maria   Costa  ')).toBe('maria costa');
  });

  it('retorna string vazia para null', () => {
    expect(normalizeSearchText(null)).toBe('');
  });
});

/* =========================================================
   Tenant / Profile
   ========================================================= */

describe('isGlobalOpsProfile', () => {
  it('retorna true para admin sem tenantId', () => {
    expect(isGlobalOpsProfile({ role: 'admin' })).toBe(true);
  });

  it('retorna true para owner sem tenantId', () => {
    expect(isGlobalOpsProfile({ role: 'owner' })).toBe(true);
  });

  it('retorna false para admin com tenantId', () => {
    expect(isGlobalOpsProfile({ role: 'admin', tenantId: 't1' })).toBe(false);
  });

  it('retorna false para analyst', () => {
    expect(isGlobalOpsProfile({ role: 'analyst', tenantId: 't1' })).toBe(false);
  });

  it('retorna false para profile nulo', () => {
    expect(isGlobalOpsProfile(null)).toBe(false);
  });
});

describe('resolveOpsMetricsTenant', () => {
  it('retorna tenantId para perfil global', () => {
    expect(resolveOpsMetricsTenant({ role: 'admin' }, 't1')).toBe('t1');
  });

  it('retorna tenantId do perfil para perfil não global', () => {
    expect(resolveOpsMetricsTenant({ role: 'analyst', tenantId: 't2' }, 't1')).toBe('t2');
  });

  it('retorna null quando perfil não global e sem tenantId', () => {
    expect(resolveOpsMetricsTenant({ role: 'analyst' }, 't1')).toBeNull();
  });
});

/* =========================================================
   Metrics helpers
   ========================================================= */

describe('normalizeMetricsPeriod', () => {
  it('aceita 0, 7, 30, 90, 365', () => {
    expect(normalizeMetricsPeriod(0)).toBe(0);
    expect(normalizeMetricsPeriod(7)).toBe(7);
    expect(normalizeMetricsPeriod(30)).toBe(30);
    expect(normalizeMetricsPeriod(90)).toBe(90);
    expect(normalizeMetricsPeriod(365)).toBe(365);
  });

  it('lança erro para período inválido', () => {
    try {
      normalizeMetricsPeriod(10);
      expect.fail('deveria ter lançado erro');
    } catch (err) {
      expect(err.code).toBe('invalid-argument');
    }
  });
});

describe('getMetricCaseDate', () => {
  it('retorna Date para string ISO', () => {
    const result = getMetricCaseDate({ createdAt: '2024-01-15T10:00:00.000Z' }, 'createdAt');
    expect(result instanceof Date).toBe(true);
  });

  it('retorna null para campo ausente', () => {
    expect(getMetricCaseDate({}, 'createdAt')).toBeNull();
  });
});

describe('diffHoursBackend', () => {
  it('calcula diferença em horas', () => {
    expect(diffHoursBackend('2024-01-15T10:00:00.000Z', '2024-01-15T12:00:00.000Z')).toBe(2);
  });

  it('retorna null quando start ausente', () => {
    expect(diffHoursBackend(null, '2024-01-15T12:00:00.000Z')).toBeNull();
  });

  it('retorna null quando end ausente', () => {
    expect(diffHoursBackend('2024-01-15T10:00:00.000Z', null)).toBeNull();
  });
});

describe('pctBackend', () => {
  it('calcula porcentagem corretamente', () => {
    expect(pctBackend(25, 100)).toBe(25);
    expect(pctBackend(1, 3)).toBe(33);
  });

  it('retorna 0 quando total é 0', () => {
    expect(pctBackend(5, 0)).toBe(0);
  });
});

describe('makeRunId', () => {
  it('retorna string única contendo caseId', () => {
    const id = makeRunId('case-123');
    expect(typeof id).toBe('string');
    expect(id.startsWith('case-123_')).toBe(true);
  });
});

describe('buildProviderRunIds', () => {
  it('retorna objeto com runIds para todos os providers', () => {
    const ids = buildProviderRunIds('case-123');
    expect(typeof ids.bigdatacorpRunId).toBe('string');
    expect(typeof ids.juditRunId).toBe('string');
    expect(typeof ids.escavadorRunId).toBe('string');
    expect(typeof ids.fontedataRunId).toBe('string');
    expect(typeof ids.djenRunId).toBe('string');
    expect(ids.bigdatacorpRunId.startsWith('bdc_case-123_')).toBe(true);
    expect(ids.juditRunId.startsWith('jud_case-123_')).toBe(true);
  });
});

/* =========================================================
   Enrichment status
   ========================================================= */

describe('getOverallEnrichmentStatusBackend', () => {
  it('retorna RUNNING se algum status for RUNNING', () => {
    expect(getOverallEnrichmentStatusBackend({
      juditEnrichmentStatus: 'DONE',
      escavadorEnrichmentStatus: 'RUNNING',
    })).toBe('RUNNING');
  });

  it('retorna BLOCKED se algum status for BLOCKED', () => {
    expect(getOverallEnrichmentStatusBackend({
      enrichmentStatus: 'BLOCKED',
    })).toBe('BLOCKED');
  });

  it('retorna PARTIAL se algum status for PARTIAL', () => {
    expect(getOverallEnrichmentStatusBackend({
      juditEnrichmentStatus: 'PARTIAL',
    })).toBe('PARTIAL');
  });

  it('retorna PARTIAL quando há FAILED e DONE', () => {
    expect(getOverallEnrichmentStatusBackend({
      juditEnrichmentStatus: 'FAILED',
      enrichmentStatus: 'DONE',
    })).toBe('PARTIAL');
  });

  it('retorna FAILED quando há apenas FAILED', () => {
    expect(getOverallEnrichmentStatusBackend({
      juditEnrichmentStatus: 'FAILED',
    })).toBe('FAILED');
  });

  it('retorna DONE quando todos são DONE', () => {
    expect(getOverallEnrichmentStatusBackend({
      juditEnrichmentStatus: 'DONE',
      escavadorEnrichmentStatus: 'DONE',
    })).toBe('DONE');
  });

  it('retorna SKIPPED quando todos são SKIPPED', () => {
    expect(getOverallEnrichmentStatusBackend({
      juditEnrichmentStatus: 'SKIPPED',
      escavadorEnrichmentStatus: 'SKIPPED',
    })).toBe('SKIPPED');
  });

  it('retorna PENDING quando não há status', () => {
    expect(getOverallEnrichmentStatusBackend({})).toBe('PENDING');
  });
});

/* =========================================================
   SLA
   ========================================================= */

describe('getSlaStateBackend', () => {
  it('retorna no_sla quando createdAt ausente', () => {
    expect(getSlaStateBackend({})).toBe('no_sla');
  });

  it('retorna completed_on_time quando concluído dentro do SLA', () => {
    const now = new Date('2024-01-15T12:00:00.000Z');
    const createdAt = '2024-01-15T10:00:00.000Z';
    const concludedAt = '2024-01-15T11:00:00.000Z';
    expect(getSlaStateBackend({ createdAt, concludedAt, status: 'DONE' }, now)).toBe('completed_on_time');
  });

  it('retorna completed_late quando concluído após SLA', () => {
    const now = new Date('2024-01-17T12:00:00.000Z');
    const createdAt = '2024-01-15T10:00:00.000Z';
    const concludedAt = '2024-01-17T11:00:00.000Z';
    expect(getSlaStateBackend({ createdAt, concludedAt, status: 'DONE', slaHours: 24 }, now)).toBe('completed_late');
  });

  it('retorna overdue quando passou do prazo', () => {
    const now = new Date('2024-01-17T12:00:00.000Z');
    const createdAt = '2024-01-15T10:00:00.000Z';
    expect(getSlaStateBackend({ createdAt, status: 'PENDING', slaHours: 24 }, now)).toBe('overdue');
  });

  it('retorna warning quando 75% ou mais do SLA passou', () => {
    const createdAt = new Date('2024-01-15T10:00:00.000Z');
    const now = new Date(createdAt.getTime() + 40 * 60 * 60 * 1000); // 40h de 48h
    expect(getSlaStateBackend({ createdAt, status: 'PENDING', slaHours: 48 }, now)).toBe('warning');
  });

  it('retorna on_time quando menos de 75% do SLA passou', () => {
    const createdAt = new Date('2024-01-15T10:00:00.000Z');
    const now = new Date(createdAt.getTime() + 10 * 60 * 60 * 1000); // 10h de 48h
    expect(getSlaStateBackend({ createdAt, status: 'PENDING', slaHours: 48 }, now)).toBe('on_time');
  });
});

/* =========================================================
   Comparação
   ========================================================= */

describe('compareOpsCases', () => {
  const a = { id: '1', candidateName: 'Ana Silva', createdAt: '2024-01-10', status: 'DONE' };
  const b = { id: '2', candidateName: 'Bruno Costa', createdAt: '2024-01-11', status: 'PENDING' };

  it('ordena por candidateName asc', () => {
    expect(compareOpsCases(a, b, 'candidateName', 'asc')).toBeLessThan(0);
    expect(compareOpsCases(b, a, 'candidateName', 'asc')).toBeGreaterThan(0);
  });

  it('ordena por candidateName desc', () => {
    expect(compareOpsCases(a, b, 'candidateName', 'desc')).toBeGreaterThan(0);
  });

  it('ordena por createdAt desc por padrão', () => {
    expect(compareOpsCases(a, b, 'createdAt', 'desc')).toBeGreaterThan(0);
  });

  it('usa id como tie-breaker', () => {
    const x = { id: '1', candidateName: 'Same' };
    const y = { id: '2', candidateName: 'Same' };
    expect(compareOpsCases(x, y, 'candidateName', 'asc')).toBeLessThan(0);
  });
});

describe('compareClientCases', () => {
  const a = { id: '1', candidateName: 'Ana', createdAt: '2024-01-10' };
  const b = { id: '2', candidateName: 'Bruno', createdAt: '2024-01-11' };

  it('ordena por candidateName asc', () => {
    expect(compareClientCases(a, b, 'candidateName', 'asc')).toBeLessThan(0);
  });

  it('ordena por createdAt desc', () => {
    expect(compareClientCases(a, b, 'createdAt', 'desc')).toBeGreaterThan(0);
  });
});

/* =========================================================
   Filtros — Client
   ========================================================= */

describe('matchesClientCaseSearchFull', () => {
  const caseData = {
    candidateName: 'João Silva',
    cpf: '123.456.789-00',
    caseId: 'CASE-001',
    id: 'doc1',
  };

  it('retorna true quando termo vazio', () => {
    expect(matchesClientCaseSearchFull(caseData, '')).toBe(true);
    expect(matchesClientCaseSearchFull(caseData, null)).toBe(true);
  });

  it('match por nome', () => {
    expect(matchesClientCaseSearchFull(caseData, 'joao')).toBe(true);
    expect(matchesClientCaseSearchFull(caseData, 'silva')).toBe(true);
  });

  it('match por caseId', () => {
    expect(matchesClientCaseSearchFull(caseData, 'CASE-001')).toBe(true);
    expect(matchesClientCaseSearchFull(caseData, 'case-001')).toBe(true);
  });

  it('match por CPF (mínimo 3 dígitos)', () => {
    expect(matchesClientCaseSearchFull(caseData, '123')).toBe(true);
    expect(matchesClientCaseSearchFull(caseData, '456')).toBe(true);
  });

  it('não match por CPF com menos de 3 dígitos', () => {
    expect(matchesClientCaseSearchFull(caseData, '12')).toBe(false);
  });

  it('não match para termo inexistente', () => {
    expect(matchesClientCaseSearchFull(caseData, 'inexistente')).toBe(false);
  });
});

describe('matchesClientCaseFiltersFull', () => {
  const caseData = {
    status: 'DONE',
    finalVerdict: 'FIT',
    createdAt: '2024-01-15T10:00:00.000Z',
  };

  it('retorna true sem filtros', () => {
    expect(matchesClientCaseFiltersFull(caseData, {})).toBe(true);
  });

  it('filtra por status', () => {
    expect(matchesClientCaseFiltersFull(caseData, { status: 'DONE' })).toBe(true);
    expect(matchesClientCaseFiltersFull(caseData, { status: 'PENDING' })).toBe(false);
  });

  it('filtra por verdict', () => {
    expect(matchesClientCaseFiltersFull(caseData, { verdict: 'FIT' })).toBe(true);
    expect(matchesClientCaseFiltersFull(caseData, { verdict: 'ATTENTION' })).toBe(false);
  });

  it('filtra por dateFrom', () => {
    expect(matchesClientCaseFiltersFull(caseData, { dateFrom: '2024-01-10' })).toBe(true);
    expect(matchesClientCaseFiltersFull(caseData, { dateFrom: '2024-01-20' })).toBe(false);
  });

  it('filtra por dateTo', () => {
    expect(matchesClientCaseFiltersFull(caseData, { dateTo: '2024-01-20' })).toBe(true);
    expect(matchesClientCaseFiltersFull(caseData, { dateTo: '2024-01-10' })).toBe(false);
  });

  it('filtra por searchTerm', () => {
    expect(matchesClientCaseFiltersFull({ ...caseData, candidateName: 'Joao' }, { searchTerm: 'joao' })).toBe(true);
    expect(matchesClientCaseFiltersFull({ ...caseData, candidateName: 'Joao' }, { searchTerm: 'maria' })).toBe(false);
  });
});

/* =========================================================
   Filtros — Ops
   ========================================================= */

describe('matchesOpsCaseSearchFull', () => {
  const caseData = {
    candidateName: 'Carlos Souza',
    cpfMasked: '987.654.321-00',
    caseId: 'OPS-001',
    id: 'doc2',
  };

  it('retorna true quando termo vazio', () => {
    expect(matchesOpsCaseSearchFull(caseData, '')).toBe(true);
  });

  it('match por nome', () => {
    expect(matchesOpsCaseSearchFull(caseData, 'carlos')).toBe(true);
  });

  it('match por caseId', () => {
    expect(matchesOpsCaseSearchFull(caseData, 'OPS-001')).toBe(true);
  });

  it('match por CPF', () => {
    expect(matchesOpsCaseSearchFull(caseData, '987')).toBe(true);
  });
});

describe('matchesOpsCaseFiltersFull', () => {
  const baseCase = {
    status: 'PENDING',
    riskLevel: 'HIGH',
    finalVerdict: null,
    createdAt: '2024-01-15T10:00:00.000Z',
    assigneeId: null,
    juditEnrichmentStatus: 'DONE',
    escavadorEnrichmentStatus: 'SKIPPED',
    enrichmentStatus: 'DONE',
    bigdatacorpEnrichmentStatus: 'DONE',
    djenEnrichmentStatus: 'PENDING',
    aiStatus: null,
  };

  it('retorna true sem filtros', () => {
    expect(matchesOpsCaseFiltersFull(baseCase, {})).toBe(true);
  });

  it('filtra por status', () => {
    expect(matchesOpsCaseFiltersFull(baseCase, { status: 'PENDING' })).toBe(true);
    expect(matchesOpsCaseFiltersFull(baseCase, { status: 'DONE' })).toBe(false);
  });

  it('filtra por risk', () => {
    expect(matchesOpsCaseFiltersFull(baseCase, { risk: 'HIGH' })).toBe(true);
    expect(matchesOpsCaseFiltersFull(baseCase, { risk: 'LOW' })).toBe(false);
  });

  it('filtra por verdict', () => {
    expect(matchesOpsCaseFiltersFull({ ...baseCase, finalVerdict: 'FIT' }, { verdict: 'FIT' })).toBe(true);
    expect(matchesOpsCaseFiltersFull(baseCase, { verdict: 'FIT' })).toBe(false);
  });

  it('filtra por enrichment', () => {
    expect(matchesOpsCaseFiltersFull(baseCase, { enrichment: 'RUNNING' })).toBe(false);
  });

  it('filtra por queueOnly', () => {
    expect(matchesOpsCaseFiltersFull({ ...baseCase, status: 'DONE' }, {}, { queueOnly: true })).toBe(false);
    expect(matchesOpsCaseFiltersFull(baseCase, {}, { queueOnly: true })).toBe(true);
  });

  it('filtra por assignment UNASSIGNED', () => {
    expect(matchesOpsCaseFiltersFull(baseCase, { assignment: 'UNASSIGNED' })).toBe(true);
    expect(matchesOpsCaseFiltersFull({ ...baseCase, assigneeId: 'u1' }, { assignment: 'UNASSIGNED' })).toBe(false);
  });

  it('filtra por assignment MINE', () => {
    expect(matchesOpsCaseFiltersFull({ ...baseCase, assigneeId: 'u1' }, { assignment: 'MINE' }, { assigneeUid: 'u1' })).toBe(true);
    expect(matchesOpsCaseFiltersFull(baseCase, { assignment: 'MINE' }, { assigneeUid: 'u1' })).toBe(false);
  });

  it('filtra por dateFrom/dateTo', () => {
    expect(matchesOpsCaseFiltersFull(baseCase, { dateFrom: '2024-01-10', dateTo: '2024-01-20' })).toBe(true);
    expect(matchesOpsCaseFiltersFull(baseCase, { dateFrom: '2024-01-20' })).toBe(false);
  });

  it('filtra por searchTerm', () => {
    expect(matchesOpsCaseFiltersFull({ ...baseCase, candidateName: 'Joao' }, { searchTerm: 'joao' })).toBe(true);
    expect(matchesOpsCaseFiltersFull({ ...baseCase, candidateName: 'Joao' }, { searchTerm: 'maria' })).toBe(false);
  });

  it('filtra por SLA', () => {
    const now = new Date('2024-01-20T12:00:00.000Z');
    const overdueCase = { ...baseCase, createdAt: '2024-01-10T10:00:00.000Z', status: 'PENDING', slaHours: 24 };
    expect(matchesOpsCaseFiltersFull(overdueCase, { sla: 'OVERDUE' }, {}, now)).toBe(true);
    expect(matchesOpsCaseFiltersFull(overdueCase, { sla: 'ON_TIME' }, {}, now)).toBe(false);
  });
});

/* =========================================================
   Métricas — Ops
   ========================================================= */

describe('buildOpsMetricsFromCases', () => {
  it('retorna métricas vazias para array vazio', () => {
    const result = buildOpsMetricsFromCases([]);
    expect(result.total).toBe(0);
    expect(result.done).toBe(0);
    expect(result.running).toBe(0);
    expect(result.verdicts).toEqual({ FIT: 0, ATTENTION: 0, NOT_RECOMMENDED: 0, INCONCLUSIVE: 0 });
  });

  it('conta casos por status e veredicto', () => {
    const cases = [
      { status: 'DONE', finalVerdict: 'FIT', juditEnrichmentStatus: 'DONE', enrichmentStatus: 'DONE' },
      { status: 'DONE', finalVerdict: 'ATTENTION', juditEnrichmentStatus: 'DONE', enrichmentStatus: 'DONE' },
      { status: 'PENDING', juditEnrichmentStatus: 'PENDING' },
    ];
    const result = buildOpsMetricsFromCases(cases);
    expect(result.total).toBe(3);
    expect(result.done).toBe(2);
    expect(result.running).toBe(1);
    expect(result.verdicts.FIT).toBe(1);
    expect(result.verdicts.ATTENTION).toBe(1);
  });

  it('calcula completionRate e avgDays', () => {
    const cases = [
      { status: 'DONE', createdAt: '2024-01-15T10:00:00.000Z', concludedAt: '2024-01-15T14:00:00.000Z', turnaroundHours: 4, juditEnrichmentStatus: 'DONE' },
      { status: 'DONE', createdAt: '2024-01-15T10:00:00.000Z', concludedAt: '2024-01-15T22:00:00.000Z', turnaroundHours: 12, juditEnrichmentStatus: 'DONE' },
    ];
    const result = buildOpsMetricsFromCases(cases);
    expect(result.completionRate).toBe(100);
    expect(result.avgDays).toBe('0.3'); // (4+12)/2 / 24 = 0.333... arredondado para 1 casa = 0.3? Não, toFixed(1) = "0.3"
  });

  it('calcula estatísticas de providers', () => {
    const cases = [
      { status: 'DONE', juditEnrichmentStatus: 'DONE' },
      { status: 'DONE', juditEnrichmentStatus: 'FAILED' },
    ];
    const result = buildOpsMetricsFromCases(cases);
    expect(result.prov.judit.calls).toBe(2);
    expect(result.prov.judit.done).toBe(1);
    expect(result.prov.judit.failed).toBe(1);
  });

  it('agrupa por tenant quando showAllTenants=true', () => {
    const cases = [
      { status: 'DONE', tenantName: 'Tenant A', aiCostUsd: 1 },
      { status: 'DONE', tenantName: 'Tenant B', aiCostUsd: 2 },
    ];
    const result = buildOpsMetricsFromCases(cases, { showAllTenants: true });
    expect(result.byTenant.length).toBe(2);
  });
});

/* =========================================================
   Métricas — Client Dashboard
   ========================================================= */

describe('buildClientDashboardMetricsFromCases', () => {
  it('retorna métricas vazias para array vazio', () => {
    const result = buildClientDashboardMetricsFromCases([]);
    expect(result.total).toBe(0);
    expect(result.done).toBe(0);
    expect(result.months.length).toBe(6);
  });

  it('conta status corretamente', () => {
    const cases = [
      { status: 'DONE', finalVerdict: 'FIT', createdAt: '2024-01-15T10:00:00.000Z' },
      { status: 'IN_PROGRESS', createdAt: '2024-01-15T10:00:00.000Z' },
      { status: 'PENDING', createdAt: '2024-01-15T10:00:00.000Z' },
      { status: 'CORRECTION_NEEDED', createdAt: '2024-01-15T10:00:00.000Z' },
      { status: 'WAITING_INFO', createdAt: '2024-01-15T10:00:00.000Z' },
    ];
    const result = buildClientDashboardMetricsFromCases(cases);
    expect(result.total).toBe(5);
    expect(result.done).toBe(1);
    expect(result.inProgress).toBe(2); // IN_PROGRESS + WAITING_INFO
    expect(result.pending).toBe(1);
    expect(result.corrections).toBe(1);
    expect(result.waitingInfo).toBe(1);
  });

  it('calcula completionRate', () => {
    const cases = [
      { status: 'DONE', createdAt: '2024-01-15T10:00:00.000Z' },
      { status: 'PENDING', createdAt: '2024-01-15T10:00:00.000Z' },
    ];
    const result = buildClientDashboardMetricsFromCases(cases);
    expect(result.completionRate).toBe(50);
  });

  it('calcula avgTurnaroundHours', () => {
    const cases = [
      { status: 'DONE', createdAt: '2024-01-15T10:00:00.000Z', concludedAt: '2024-01-15T14:00:00.000Z', turnaroundHours: 4 },
      { status: 'DONE', createdAt: '2024-01-15T10:00:00.000Z', concludedAt: '2024-01-15T22:00:00.000Z', turnaroundHours: 12 },
    ];
    const result = buildClientDashboardMetricsFromCases(cases);
    expect(result.avgTurnaroundHours).toBe(8);
  });

  it('calcula topFlags', () => {
    const cases = [
      { status: 'DONE', finalVerdict: 'ATTENTION', criminalFlag: 'POSITIVE', laborFlag: 'NEGATIVE', createdAt: '2024-01-15T10:00:00.000Z' },
      { status: 'DONE', finalVerdict: 'NOT_RECOMMENDED', criminalFlag: 'POSITIVE', laborFlag: 'POSITIVE', createdAt: '2024-01-15T10:00:00.000Z' },
    ];
    const result = buildClientDashboardMetricsFromCases(cases);
    expect(result.topFlags.length).toBeGreaterThan(0);
    expect(result.topFlags[0].label).toBe('Antecedentes criminais');
    expect(result.topFlags[0].count).toBe(2);
  });

  it('retorna recentCompletedCases ordenados', () => {
    const cases = [
      { status: 'DONE', concludedAt: '2024-01-15T14:00:00.000Z', createdAt: '2024-01-15T10:00:00.000Z' },
      { status: 'DONE', concludedAt: '2024-01-15T16:00:00.000Z', createdAt: '2024-01-15T10:00:00.000Z' },
    ];
    const result = buildClientDashboardMetricsFromCases(cases);
    expect(result.recentCompletedCases.length).toBe(2);
    expect(result.recentCompletedCases[0].concludedAt).toBe('2024-01-15T16:00:00.000Z');
  });

  it('limita topFlags a 6 itens', () => {
    const cases = [
      { status: 'DONE', finalVerdict: 'ATTENTION', criminalFlag: 'POSITIVE', laborFlag: 'POSITIVE', warrantFlag: 'POSITIVE', osintLevel: 'HIGH', socialStatus: 'CONCERN', digitalFlag: 'ALERT', conflictInterest: 'YES', createdAt: '2024-01-15T10:00:00.000Z' },
    ];
    const result = buildClientDashboardMetricsFromCases(cases);
    expect(result.topFlags.length).toBeLessThanOrEqual(6);
  });
});
