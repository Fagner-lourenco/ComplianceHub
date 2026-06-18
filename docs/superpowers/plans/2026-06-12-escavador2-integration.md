# Escavador2 Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Escavador2 as the final enrichment phase in ComplianceHub, using the internal Cloud Run API, without changing the existing official `escavador*` integration.

**Architecture:** Escavador2 is a separate provider with `escavador2*` fields, its own adapter, normalizer, dedupe helper, provider config, enrichment phase, trigger, rerun support, AI/homonym context, and report/prefill integration. The trigger runs after BigDataCorp, Judit, official Escavador when required, and DJEN settle; Escavador2 errors terminalize as `FAILED` and allow the pipeline to continue. Classification waits while Escavador2 is enabled and non-terminal, but proceeds when Escavador2 is `DONE`, `PARTIAL`, `SKIPPED`, or `FAILED`.

**Tech Stack:** Firebase Cloud Functions Gen2, Node.js 22, CommonJS backend modules, Vitest backend tests, Firestore, Firebase Secret Manager, React/Vite report builder mirror.

---

## Context And Rules

- Escavador oficial uses `escavador*` fields and must remain unchanged except for comparison/dedupe reads.
- Escavador2 must use only `escavador2*` field names for new persistence.
- Escavador2 API endpoint: `POST https://escavador2-api-dowqa75f4a-rj.a.run.app/escavador2/consultar`.
- Escavador2 header: `X-Internal-Api-Key: <ESCAVADOR2_API_KEY>`.
- Escavador2 body:

```json
{
  "cpf": "00000000000",
  "nome": "NOME DO CANDIDATO",
  "detalhar": true,
  "movimentacoes": "risk_only",
  "documentos": "risk_only",
  "limit_movimentacoes": 20,
  "limit_documentos": 20
}
```

- `consulta.status = "DONE"` maps to `escavador2EnrichmentStatus = "DONE"`.
- `consulta.status = "PARTIAL"` maps to `escavador2EnrichmentStatus = "PARTIAL"` and stores partial data.
- HTTP `502` or local API error maps to `escavador2EnrichmentStatus = "FAILED"`, stores `escavador2Error`, and calls `maybeRunAutoClassifyAndAi`.
- `escavador2CostBRL` is always `0`.
- Dedupe priority is full process number first, then extracted full process number, then metadata fallback with 90-day date tolerance.
- Public/client result snapshots must not include raw payloads.
- After code changes, run `graphify update .` from the repository root.

## File Structure

**New files**

- `functions/adapters/escavador2.js`: HTTP client for the Cloud Run Escavador2 API. It validates required inputs, builds the request body, sends the API key header, normalizes HTTP errors into `Escavador2Error`, and returns parsed JSON.
- `functions/adapters/escavador2.test.js`: Unit tests for request body, secret header, `DONE`, `PARTIAL`, and HTTP error behavior.
- `functions/normalizers/escavador2.js`: Pure mapper from Escavador2 response to internal `escavador2*` fields.
- `functions/normalizers/escavador2.test.js`: Unit tests for flags, counts, process mapping, raw source persistence shape, and cost.
- `functions/helpers/deduplicateEscavador2.js`: Pure helper that marks Escavador2 processes as duplicate/new compared with BigDataCorp, Judit, DJEN, and official Escavador.
- `functions/helpers/deduplicateEscavador2.test.js`: Unit tests for CNJ and 90-day metadata dedupe.
- `docs/audits/ADR-005-escavador2-integration.md`: Architecture decision record for keeping Escavador2 separate from official Escavador.

**Existing files to modify**

- `functions/modules/_shared/providerConfigs.js`: Add default config and loader for `enrichmentConfig.escavador2`.
- `functions/modules/enrichmentPhases.js`: Inject Escavador2 adapter/normalizer/dedupe and add `runEscavador2EnrichmentPhase`.
- `functions/modules/enrichmentPhases.test.js`: Add tests for successful, partial, disabled, missing secret, and failed Escavador2 runs.
- `functions/modules/enrichmentTriggers.js`: Add `createEnrichEscavador2OnCaseHandler`.
- `functions/modules/enrichmentTriggers.test.js`: Add trigger tests for post-DJEN, DJEN-disabled, disabled provider, and failure paths.
- `functions/modules/autoClassification.js`: Include Escavador2 in readiness, signature, and deterministic classification signals.
- `functions/modules/autoClassification.test.js`: Add readiness and signal tests.
- `functions/helpers/aiHomonym.js`: Add Escavador2 candidates and provider coverage.
- `functions/helpers/aiHomonym.test.js`: Add candidate and coverage tests.
- `functions/modules/aiOrchestrator.js`: Include Escavador2 in provider inclusion, compact context, review context, and prefill context.
- `functions/modules/aiOrchestrator.test.js`: Add provider/context tests.
- `functions/index.js`: Define `ESCAVADOR2_API_KEY`, wire phase/trigger, add function export, add rerun support.
- `functions/reportBuilder.cjs`: Render Escavador2-derived findings only when they introduce new non-duplicate evidence.
- `src/core/reportBuilder.js`: Mirror backend report builder behavior.
- `functions/modules/_shared/fieldConstants.js`: Ensure client/public field allowlists do not expose raw Escavador2 fields.
- `functions/modules/clientSolicitations.js`: Initialize/reset `escavador2*` fields in new/corrected submissions.
- `functions/modules/caseQueriesAssignments.js`: Include Escavador2 in metrics, status lists, full rerun reset, and manual rerun.
- `AGENTS.md`: Document Escavador2 as separate provider and remind future agents not to reuse `escavador*` fields.

---

### Task 1: Adapter For Escavador2 API

**Files:**
- Create: `functions/adapters/escavador2.js`
- Create: `functions/adapters/escavador2.test.js`

- [ ] **Step 1: Write the failing adapter tests**

Create `functions/adapters/escavador2.test.js` with this complete content:

```js
import { afterEach, describe, expect, it, vi } from 'vitest';
import { consultarEscavador2, Escavador2Error } from './escavador2.js';

const okResponse = {
  consulta: { cpf: '12345678901', nome: 'JOAO TESTE', status: 'DONE' },
  resumo: { total_processos: 0, tem_criminal: false, total_criminais: 0 },
  processos: [],
};

describe('consultarEscavador2', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts the recommended production payload with internal API key header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(okResponse),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await consultarEscavador2({
      cpf: '123.456.789-01',
      nome: 'Joao Teste',
      apiKey: 'secret-key',
    });

    expect(result).toEqual(okResponse);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://escavador2-api-dowqa75f4a-rj.a.run.app/escavador2/consultar',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Api-Key': 'secret-key',
        },
        body: JSON.stringify({
          cpf: '12345678901',
          nome: 'Joao Teste',
          detalhar: true,
          movimentacoes: 'risk_only',
          documentos: 'risk_only',
          limit_movimentacoes: 20,
          limit_documentos: 20,
        }),
      }),
    );
  });

  it('allows config overrides without changing secure defaults', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ ...okResponse, consulta: { ...okResponse.consulta, status: 'PARTIAL' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await consultarEscavador2({
      cpf: '12345678901',
      nome: 'Joao Teste',
      apiKey: 'secret-key',
      options: {
        detalhar: false,
        movimentacoes: 'none',
        documentos: 'none',
        limit_movimentacoes: 5,
        limit_documentos: 6,
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      cpf: '12345678901',
      nome: 'Joao Teste',
      detalhar: false,
      movimentacoes: 'none',
      documentos: 'none',
      limit_movimentacoes: 5,
      limit_documentos: 6,
    });
  });

  it('throws Escavador2Error for HTTP errors and preserves response body text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: vi.fn().mockResolvedValue('{"error":"upstream failed"}'),
    }));

    await expect(consultarEscavador2({ cpf: '12345678901', nome: 'Joao Teste', apiKey: 'secret-key' }))
      .rejects.toMatchObject({
        name: 'Escavador2Error',
        statusCode: 502,
        responseBody: '{"error":"upstream failed"}',
      });
  });

  it('throws before fetch when apiKey is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(consultarEscavador2({ cpf: '12345678901', nome: 'Joao Teste', apiKey: '' }))
      .rejects.toThrow('ESCAVADOR2_API_KEY nao configurado.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws before fetch when CPF is invalid length', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(consultarEscavador2({ cpf: '123', nome: 'Joao Teste', apiKey: 'secret-key' }))
      .rejects.toThrow('CPF invalido para Escavador2.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exports Escavador2Error as a class', () => {
    const err = new Escavador2Error('falha', 500, 'body');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('Escavador2Error');
    expect(err.statusCode).toBe(500);
    expect(err.responseBody).toBe('body');
  });
});
```

- [ ] **Step 2: Run adapter tests and verify failure**

Run from `functions/`:

```bash
npm test -- adapters/escavador2.test.js
```

Expected: FAIL because `functions/adapters/escavador2.js` does not exist.

- [ ] **Step 3: Implement the adapter**

Create `functions/adapters/escavador2.js` with this complete content:

```js
const DEFAULT_BASE_URL = 'https://escavador2-api-dowqa75f4a-rj.a.run.app';

class Escavador2Error extends Error {
  constructor(message, statusCode, responseBody) {
    super(message);
    this.name = 'Escavador2Error';
    this.statusCode = statusCode || null;
    this.responseBody = responseBody || null;
  }
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function buildEscavador2Payload({ cpf, nome, options = {} }) {
  return {
    cpf: onlyDigits(cpf),
    nome: String(nome || '').trim(),
    detalhar: options.detalhar ?? true,
    movimentacoes: options.movimentacoes || 'risk_only',
    documentos: options.documentos || 'risk_only',
    limit_movimentacoes: options.limit_movimentacoes ?? 20,
    limit_documentos: options.limit_documentos ?? 20,
  };
}

async function consultarEscavador2({ cpf, nome, apiKey, options = {}, baseUrl = DEFAULT_BASE_URL }) {
  const cleanCpf = onlyDigits(cpf);
  if (cleanCpf.length !== 11) {
    throw new Escavador2Error('CPF invalido para Escavador2.', 422, null);
  }
  if (!String(apiKey || '').trim()) {
    throw new Escavador2Error('ESCAVADOR2_API_KEY nao configurado.', null, null);
  }

  const response = await fetch(`${baseUrl}/escavador2/consultar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Api-Key': apiKey,
    },
    body: JSON.stringify(buildEscavador2Payload({ cpf: cleanCpf, nome, options })),
  });

  if (!response.ok) {
    const body = typeof response.text === 'function' ? await response.text() : '';
    throw new Escavador2Error(`Escavador2 HTTP ${response.status}`, response.status, body);
  }

  return response.json();
}

module.exports = {
  DEFAULT_BASE_URL,
  Escavador2Error,
  buildEscavador2Payload,
  consultarEscavador2,
};
```

- [ ] **Step 4: Run adapter tests and verify pass**

Run from `functions/`:

```bash
npm test -- adapters/escavador2.test.js
```

Expected: PASS for all tests in `escavador2.test.js`.

- [ ] **Step 5: Commit adapter**

```bash
git add functions/adapters/escavador2.js functions/adapters/escavador2.test.js
git commit -m "feat: adiciona adapter escavador2"
```

---

### Task 2: Normalizer For Escavador2 Response

**Files:**
- Create: `functions/normalizers/escavador2.js`
- Create: `functions/normalizers/escavador2.test.js`

- [ ] **Step 1: Write the failing normalizer tests**

Create `functions/normalizers/escavador2.test.js` with this complete content:

```js
import { describe, expect, it } from 'vitest';
import { normalizeEscavador2Response } from './escavador2.js';

const response = {
  consulta: { cpf: '12345678901', nome: 'JOAO TESTE', status: 'PARTIAL' },
  resumo: {
    total_processos: 2,
    tem_criminal: true,
    total_criminais: 1,
    tem_trabalhista: true,
    total_trabalhistas: 1,
    total_riscos_materiais: 1,
    total_cnj_mascarado: 1,
    total_cnj_completo_extraido: 1,
  },
  processos: [
    {
      status: { detalhes: 'DONE', movimentacoes: 'DONE', documentos: 'DONE' },
      cnj: {
        valor: '000xxxx-00.2024.8.26.0100',
        mascarado: true,
        valor_completo_extraido: '0001234-56.2024.8.26.0100',
        status_resolucao: 'FULL_FROM_RAW',
      },
      classificacao: { area: 'CRIMINAL', risco_material: true },
      papel_candidato: { tipo_principal: 'Reu', polo_principal: 'PASSIVO', categoria: 'DEFENDANT' },
      normalizado: {
        match: { tipo: 'CPF', confirmado_por: 'consulta_cpf', has_exact_cpf_match: true },
        dados: {
          classe: 'Acao Penal',
          assunto: 'Furto',
          tribunal_sigla: 'TJSP',
          uf: 'SP',
          data_inicio: '2024-01-01',
          ultima_movimentacao: '2026-06-01',
        },
      },
      movimentacoes_resumo: { total: 20, coletadas: 20 },
      documentos_resumo: { total: 2, coletados: 2 },
    },
    {
      cnj: { valor: '0009999-00.2023.5.09.0001', mascarado: false, status_resolucao: 'FULL_FROM_LIST' },
      classificacao: { area: 'LABOR', risco_material: false },
      papel_candidato: { tipo_principal: 'Reclamado', polo_principal: 'PASSIVO', categoria: 'DEFENDANT' },
      normalizado: {
        match: { has_exact_cpf_match: true },
        dados: { classe: 'Reclamacao Trabalhista', assunto: 'Verbas Rescisorias', tribunal_sigla: 'TRT9', uf: 'PR', data_inicio: '2023-03-10' },
      },
    },
  ],
  erros_parciais: [{ processo: 'x', erro: 'documento indisponivel' }],
  estatisticas: { elapsed_ms: 1234 },
};

describe('normalizeEscavador2Response', () => {
  it('maps response aggregates and statuses to escavador2 fields', () => {
    const normalized = normalizeEscavador2Response(response);

    expect(normalized.escavador2ApiStatus).toBe('PARTIAL');
    expect(normalized.escavador2ProcessTotal).toBe(2);
    expect(normalized.escavador2CriminalFlag).toBe('POSITIVE');
    expect(normalized.escavador2CriminalCount).toBe(1);
    expect(normalized.escavador2LaborFlag).toBe('POSITIVE');
    expect(normalized.escavador2LaborCount).toBe(1);
    expect(normalized.escavador2MaterialRiskCount).toBe(1);
    expect(normalized.escavador2CnjMaskedCount).toBe(1);
    expect(normalized.escavador2CnjExtractedCount).toBe(1);
    expect(normalized.escavador2CostBRL).toBe(0);
    expect(normalized.escavador2PartialErrors).toEqual(response.erros_parciais);
  });

  it('maps process-level normalized fields and source evidence', () => {
    const normalized = normalizeEscavador2Response(response);
    const first = normalized.escavador2Processos[0];

    expect(first).toEqual(expect.objectContaining({
      numeroCnj: '0001234-56.2024.8.26.0100',
      numeroCnjMascarado: '000xxxx-00.2024.8.26.0100',
      numeroCnjCompletoExtraido: '0001234-56.2024.8.26.0100',
      cnjResolutionStatus: 'FULL_FROM_RAW',
      area: 'CRIMINAL',
      isCriminal: true,
      isLabor: false,
      isMaterialRisk: true,
      tribunalSigla: 'TJSP',
      processUf: 'SP',
      classe: 'Acao Penal',
      assunto: 'Furto',
      dataInicio: '2024-01-01',
      ultimaMovimentacao: '2026-06-01',
      roleCategory: 'DEFENDANT',
      tipoPrincipal: 'Reu',
      polo: 'PASSIVO',
      hasExactCpfMatch: true,
    }));
    expect(first._sourceEscavador2).toEqual(expect.objectContaining({ provider: 'escavador2' }));
  });

  it('returns negative defaults for empty or missing resumo', () => {
    const normalized = normalizeEscavador2Response({ consulta: { status: 'DONE' }, processos: [] });

    expect(normalized.escavador2ProcessTotal).toBe(0);
    expect(normalized.escavador2CriminalFlag).toBe('NEGATIVE');
    expect(normalized.escavador2LaborFlag).toBe('NEGATIVE');
    expect(normalized.escavador2Processos).toEqual([]);
    expect(normalized.escavador2CostBRL).toBe(0);
  });
});
```

- [ ] **Step 2: Run normalizer tests and verify failure**

Run from `functions/`:

```bash
npm test -- normalizers/escavador2.test.js
```

Expected: FAIL because `functions/normalizers/escavador2.js` does not exist.

- [ ] **Step 3: Implement the normalizer**

Create `functions/normalizers/escavador2.js` with this complete content:

```js
function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function positiveFlag(value, count) {
  return value === true || Number(count || 0) > 0 ? 'POSITIVE' : 'NEGATIVE';
}

function normalizeArea(value) {
  const area = String(value || '').trim().toUpperCase();
  if (area === 'CRIMINAL') return 'CRIMINAL';
  if (area === 'LABOR') return 'LABOR';
  if (area === 'CIVIL') return 'CIVIL';
  return 'UNKNOWN';
}

function mapProcess(processo = {}, index = 0) {
  const cnj = processo.cnj || {};
  const dados = processo.normalizado?.dados || {};
  const match = processo.normalizado?.match || {};
  const papel = processo.papel_candidato || {};
  const area = normalizeArea(processo.classificacao?.area);
  const fullCnj = cnj.valor_completo_extraido || (!cnj.mascarado ? cnj.valor : null);

  return {
    escavador2Index: index,
    numeroCnj: fullCnj || cnj.valor || null,
    numeroCnjMascarado: cnj.mascarado ? cnj.valor || null : null,
    numeroCnjCompletoExtraido: cnj.valor_completo_extraido || null,
    cnjResolutionStatus: cnj.status_resolucao || null,
    area,
    isCriminal: area === 'CRIMINAL',
    isLabor: area === 'LABOR',
    isMaterialRisk: processo.classificacao?.risco_material === true,
    tribunalSigla: dados.tribunal_sigla || null,
    processUf: dados.uf || null,
    classe: dados.classe || null,
    assunto: dados.assunto || null,
    dataInicio: dados.data_inicio || null,
    ultimaMovimentacao: dados.ultima_movimentacao || null,
    roleCategory: papel.categoria || 'UNKNOWN',
    tipoPrincipal: papel.tipo_principal || null,
    polo: papel.polo_principal || null,
    hasExactCpfMatch: match.has_exact_cpf_match === true,
    matchType: match.tipo || null,
    status: processo.status || {},
    movimentacoesResumo: processo.movimentacoes_resumo || null,
    documentosResumo: processo.documentos_resumo || null,
    _sourceEscavador2: {
      provider: 'escavador2',
      cnj,
      classificacao: processo.classificacao || null,
      papel_candidato: papel,
      normalizado: processo.normalizado || null,
    },
  };
}

function normalizeEscavador2Response(response = {}) {
  const resumo = response.resumo || {};
  const processos = asArray(response.processos).map(mapProcess);
  const criminalCount = Number(resumo.total_criminais ?? processos.filter((item) => item.isCriminal).length);
  const laborCount = Number(resumo.total_trabalhistas ?? processos.filter((item) => item.isLabor).length);

  return {
    escavador2ApiStatus: response.consulta?.status || null,
    escavador2ProcessTotal: Number(resumo.total_processos ?? processos.length),
    escavador2Processos: processos,
    escavador2CriminalFlag: positiveFlag(resumo.tem_criminal, criminalCount),
    escavador2CriminalCount: criminalCount,
    escavador2LaborFlag: positiveFlag(resumo.tem_trabalhista, laborCount),
    escavador2LaborCount: laborCount,
    escavador2MaterialRiskCount: Number(resumo.total_riscos_materiais || 0),
    escavador2CnjMaskedCount: Number(resumo.total_cnj_mascarado || 0),
    escavador2CnjExtractedCount: Number(resumo.total_cnj_completo_extraido || 0),
    escavador2PartialErrors: asArray(response.erros_parciais),
    escavador2Stats: response.estatisticas || {},
    escavador2Sources: {
      consulta: response.consulta || null,
      perfil: response.perfil || null,
      resumo,
      consultedAt: new Date().toISOString(),
    },
    escavador2RawPayloads: {
      response,
    },
    escavador2CostBRL: 0,
  };
}

module.exports = {
  normalizeEscavador2Response,
  normalizeArea,
};
```

- [ ] **Step 4: Run normalizer tests and verify pass**

Run from `functions/`:

```bash
npm test -- normalizers/escavador2.test.js
```

Expected: PASS for all tests in `escavador2.test.js`.

- [ ] **Step 5: Commit normalizer**

```bash
git add functions/normalizers/escavador2.js functions/normalizers/escavador2.test.js
git commit -m "feat: normaliza resposta escavador2"
```

---

### Task 3: Dedupe Helper For Escavador2 Findings

**Files:**
- Create: `functions/helpers/deduplicateEscavador2.js`
- Create: `functions/helpers/deduplicateEscavador2.test.js`

- [ ] **Step 1: Write the failing dedupe tests**

Create `functions/helpers/deduplicateEscavador2.test.js` with this complete content:

```js
import { describe, expect, it } from 'vitest';
import { deduplicateEscavador2Findings, normalizeCnjDigits } from './deduplicateEscavador2.js';

describe('normalizeCnjDigits', () => {
  it('keeps only digits from CNJ values', () => {
    expect(normalizeCnjDigits('0001234-56.2024.8.26.0100')).toBe('00012345620248260100');
  });

  it('returns null for masked CNJ with x characters', () => {
    expect(normalizeCnjDigits('000xxxx-00.2024.8.26.0100')).toBeNull();
  });
});

describe('deduplicateEscavador2Findings', () => {
  it('marks duplicate by full process number against BigDataCorp', () => {
    const result = deduplicateEscavador2Findings({
      escavador2Processos: [{ numeroCnj: '0001234-56.2024.8.26.0100', area: 'CRIMINAL', isMaterialRisk: true }],
      bigdatacorpProcessos: [{ numero: '0001234-56.2024.8.26.0100' }],
    });

    expect(result.escavador2Processos[0]).toEqual(expect.objectContaining({
      isDuplicate: true,
      duplicateOfProvider: 'bigdatacorp',
      duplicateMatchStrength: 'CNJ_FULL',
      isNewEscavador2Finding: false,
    }));
    expect(result.escavador2DuplicateCount).toBe(1);
    expect(result.escavador2NewFindingCount).toBe(0);
    expect(result.escavador2HasNewMaterialRisk).toBe(false);
  });

  it('marks duplicate by extracted full CNJ against Judit role summary', () => {
    const result = deduplicateEscavador2Findings({
      escavador2Processos: [{ numeroCnjCompletoExtraido: '0001234-56.2024.8.26.0100', area: 'CRIMINAL' }],
      juditRoleSummary: [{ code: '0001234-56.2024.8.26.0100' }],
    });

    expect(result.escavador2Processos[0].duplicateOfProvider).toBe('judit');
    expect(result.escavador2Processos[0].duplicateMatchStrength).toBe('CNJ_FULL');
  });

  it('marks duplicate by metadata when dates are within 90 days', () => {
    const result = deduplicateEscavador2Findings({
      escavador2Processos: [{
        area: 'LABOR',
        tribunalSigla: 'TRT9',
        processUf: 'PR',
        classe: 'Reclamacao Trabalhista',
        assunto: 'Verbas Rescisorias',
        dataInicio: '2024-03-01',
      }],
      escavadorProcessos: [{
        area: 'Trabalhista',
        tribunalSigla: 'TRT9',
        processUf: 'PR',
        tipo: 'Reclamacao Trabalhista',
        assunto: 'Verbas Rescisorias',
        dataInicio: '2024-05-15',
      }],
    }, { dateToleranceDays: 90 });

    expect(result.escavador2Processos[0].isDuplicate).toBe(true);
    expect(result.escavador2Processos[0].duplicateOfProvider).toBe('escavador');
    expect(result.escavador2Processos[0].duplicateMatchStrength).toBe('METADATA_90D');
  });

  it('keeps material risk as new when metadata date is outside tolerance', () => {
    const result = deduplicateEscavador2Findings({
      escavador2Processos: [{
        area: 'CRIMINAL',
        isMaterialRisk: true,
        tribunalSigla: 'TJSP',
        processUf: 'SP',
        classe: 'Acao Penal',
        assunto: 'Furto',
        dataInicio: '2024-01-01',
      }],
      djenComunicacoes: [{
        area: 'CRIMINAL',
        tribunal: 'TJSP',
        classe: 'Acao Penal',
        assunto: 'Furto',
        dataDisponibilizacao: '2024-06-15',
      }],
    }, { dateToleranceDays: 90 });

    expect(result.escavador2Processos[0].isDuplicate).toBe(false);
    expect(result.escavador2Processos[0].isNewEscavador2Finding).toBe(true);
    expect(result.escavador2NewFindingCount).toBe(1);
    expect(result.escavador2HasNewMaterialRisk).toBe(true);
  });
});
```

- [ ] **Step 2: Run dedupe tests and verify failure**

Run from `functions/`:

```bash
npm test -- helpers/deduplicateEscavador2.test.js
```

Expected: FAIL because `functions/helpers/deduplicateEscavador2.js` does not exist.

- [ ] **Step 3: Implement the dedupe helper**

Create `functions/helpers/deduplicateEscavador2.js` with this complete content:

```js
function normalizeCnjDigits(value) {
  const text = String(value || '');
  if (!text || /x/i.test(text)) return null;
  const digits = text.replace(/\D/g, '');
  return digits.length >= 15 ? digits : null;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(a, b) {
  const dateA = parseDate(a);
  const dateB = parseDate(b);
  if (!dateA || !dateB) return null;
  return Math.abs(dateA.getTime() - dateB.getTime()) / 86400000;
}

function areaBucket(value) {
  const text = normalizeText(value);
  if (/CRIM|PENAL|CRIME/.test(text)) return 'CRIMINAL';
  if (/TRABALH|LABOR/.test(text)) return 'LABOR';
  if (text) return 'OTHER';
  return null;
}

function collectKnownProcesses(caseData = {}) {
  const known = [];
  const push = (provider, item, mapped) => known.push({ provider, original: item, ...mapped });

  for (const item of Array.isArray(caseData.bigdatacorpProcessos) ? caseData.bigdatacorpProcessos : []) {
    push('bigdatacorp', item, {
      cnj: normalizeCnjDigits(item.numero || item.Number || item.processNumber),
      area: areaBucket(item.area || item.courtType || item.cnjBroadSubject),
      tribunal: normalizeText(item.tribunalSigla || item.courtName),
      uf: normalizeText(item.estado || item.uf),
      classe: normalizeText(item.tipo || item.cnjProcedure),
      assunto: normalizeText(item.assunto || item.cnjSubject),
      date: item.dataInicio || item.startDate || item.lastUpdateDate,
    });
  }

  for (const item of Array.isArray(caseData.juditRoleSummary) ? caseData.juditRoleSummary : []) {
    push('judit', item, {
      cnj: normalizeCnjDigits(item.code || item.numero || item.cnj),
      area: areaBucket(item.area),
      tribunal: normalizeText(item.tribunalAcronym || item.tribunal),
      uf: normalizeText(item.state || item.uf),
      classe: normalizeText(item.className || item.classe),
      assunto: normalizeText(Array.isArray(item.subjects) ? item.subjects.join(' ') : item.subject),
      date: item.distributionDate || item.lastStepDate,
    });
  }

  for (const item of Array.isArray(caseData.juditProcessos) ? caseData.juditProcessos : []) {
    push('judit', item, {
      cnj: normalizeCnjDigits(item.code || item.numero || item.cnj),
      area: areaBucket(item.area),
      tribunal: normalizeText(item.tribunalAcronym || item.tribunal),
      uf: normalizeText(item.state || item.uf),
      classe: normalizeText(item.className || item.classe),
      assunto: normalizeText(Array.isArray(item.subjects) ? item.subjects.join(' ') : item.subject),
      date: item.distributionDate || item.lastStepDate,
    });
  }

  for (const item of Array.isArray(caseData.escavadorProcessos) ? caseData.escavadorProcessos : []) {
    push('escavador', item, {
      cnj: normalizeCnjDigits(item.numeroCnj || item.cnj),
      area: areaBucket(item.area),
      tribunal: normalizeText(item.tribunalSigla || item.tribunal),
      uf: normalizeText(item.processUf || item.uf),
      classe: normalizeText(item.tipo || item.tipoNormalizado || item.classe),
      assunto: normalizeText(item.assunto),
      date: item.dataInicio || item.distributionDate || item.lastStepDate,
    });
  }

  for (const item of Array.isArray(caseData.djenComunicacoes) ? caseData.djenComunicacoes : []) {
    push('djen', item, {
      cnj: normalizeCnjDigits(item.numeroProcesso || item.numeroProcessoMascara),
      area: areaBucket(item.area || item.inferredArea),
      tribunal: normalizeText(item.tribunal || item.siglaTribunal),
      uf: normalizeText(item.uf),
      classe: normalizeText(item.classe),
      assunto: normalizeText(item.assunto),
      date: item.dataDisponibilizacao || item.disponibilizadoEm || item.dataEnvio,
    });
  }

  return known;
}

function metadataMatches(processo, known, toleranceDays) {
  const sameArea = areaBucket(processo.area) && areaBucket(processo.area) === known.area;
  const sameTribunal = normalizeText(processo.tribunalSigla || processo.tribunal) && normalizeText(processo.tribunalSigla || processo.tribunal) === known.tribunal;
  const sameUf = !processo.processUf || !known.uf || normalizeText(processo.processUf) === known.uf;
  const sameClass = normalizeText(processo.classe) && normalizeText(processo.classe) === known.classe;
  const sameSubject = normalizeText(processo.assunto) && normalizeText(processo.assunto) === known.assunto;
  const delta = daysBetween(processo.dataInicio || processo.ultimaMovimentacao, known.date);
  const dateOk = delta == null ? false : delta <= toleranceDays;
  return sameArea && sameTribunal && sameUf && (sameClass || sameSubject) && dateOk;
}

function findDuplicate(processo, knownProcesses, toleranceDays) {
  const processoCnj = normalizeCnjDigits(processo.numeroCnjCompletoExtraido || processo.numeroCnj);
  if (processoCnj) {
    const found = knownProcesses.find((item) => item.cnj === processoCnj);
    if (found) return { provider: found.provider, strength: 'CNJ_FULL', processNumber: processo.numeroCnjCompletoExtraido || processo.numeroCnj };
  }

  const metadataFound = knownProcesses.find((item) => metadataMatches(processo, item, toleranceDays));
  if (metadataFound) return { provider: metadataFound.provider, strength: `METADATA_${toleranceDays}D`, processNumber: metadataFound.cnj || null };
  return null;
}

function deduplicateEscavador2Findings(caseData = {}, options = {}) {
  const toleranceDays = Number(options.dateToleranceDays ?? 90);
  const knownProcesses = collectKnownProcesses(caseData);
  const processos = (Array.isArray(caseData.escavador2Processos) ? caseData.escavador2Processos : []).map((processo) => {
    const duplicate = findDuplicate(processo, knownProcesses, toleranceDays);
    return {
      ...processo,
      isDuplicate: Boolean(duplicate),
      duplicateOfProvider: duplicate?.provider || null,
      duplicateOfProcessNumber: duplicate?.processNumber || null,
      duplicateMatchStrength: duplicate?.strength || null,
      isNewEscavador2Finding: !duplicate,
    };
  });
  const duplicateCount = processos.filter((item) => item.isDuplicate).length;
  const newFindings = processos.filter((item) => item.isNewEscavador2Finding);

  return {
    escavador2Processos: processos,
    escavador2DuplicateCount: duplicateCount,
    escavador2NewFindingCount: newFindings.length,
    escavador2HasNewMaterialRisk: newFindings.some((item) => item.isMaterialRisk === true),
  };
}

module.exports = {
  normalizeCnjDigits,
  deduplicateEscavador2Findings,
};
```

- [ ] **Step 4: Run dedupe tests and verify pass**

Run from `functions/`:

```bash
npm test -- helpers/deduplicateEscavador2.test.js
```

Expected: PASS for all tests in `deduplicateEscavador2.test.js`.

- [ ] **Step 5: Commit dedupe helper**

```bash
git add functions/helpers/deduplicateEscavador2.js functions/helpers/deduplicateEscavador2.test.js
git commit -m "feat: desduplica achados escavador2"
```

---

### Task 4: Provider Config Loader

**Files:**
- Modify: `functions/modules/_shared/providerConfigs.js`
- Test: `functions/modules/_shared/providerConfigs.test.js`

- [ ] **Step 1: Add failing config tests**

Modify `functions/modules/_shared/providerConfigs.test.js` by importing the new exports and adding these tests:

```js
import {
  DEFAULT_ESCAVADOR2_CONFIG,
  loadEscavador2Config,
} from './providerConfigs.js';

describe('loadEscavador2Config', () => {
  it('returns safe disabled defaults when tenant has no escavador2 config', async () => {
    const config = await loadEscavador2Config('tenant-without-config');

    expect(config).toEqual(DEFAULT_ESCAVADOR2_CONFIG);
    expect(config.enabled).toBe(false);
    expect(config.request).toEqual({
      detalhar: true,
      movimentacoes: 'risk_only',
      documentos: 'risk_only',
      limit_movimentacoes: 20,
      limit_documentos: 20,
    });
    expect(config.dedupe.dateToleranceDays).toBe(90);
  });

  it('merges tenant escavador2 config with defaults', async () => {
    const db = {
      collection: () => ({
        doc: () => ({
          get: async () => ({
            exists: true,
            data: () => ({
              enrichmentConfig: {
                escavador2: {
                  enabled: true,
                  request: { limit_movimentacoes: 10 },
                  dedupe: { dateToleranceDays: 45 },
                },
              },
            }),
          }),
        }),
      }),
    };
    const providerConfigs = await import('./providerConfigs.js');
    providerConfigs._setDb(db);

    const config = await loadEscavador2Config('tenant-enabled');

    expect(config.enabled).toBe(true);
    expect(config.request.limit_movimentacoes).toBe(10);
    expect(config.request.limit_documentos).toBe(20);
    expect(config.dedupe.dateToleranceDays).toBe(45);
  });
});
```

If `providerConfigs.test.js` already has imports from `./providerConfigs.js`, merge the new names into the existing import instead of creating a duplicate import block.

- [ ] **Step 2: Run config tests and verify failure**

Run from `functions/`:

```bash
npm test -- modules/_shared/providerConfigs.test.js
```

Expected: FAIL because `DEFAULT_ESCAVADOR2_CONFIG` and `loadEscavador2Config` are not exported.

- [ ] **Step 3: Implement config defaults and loader**

Modify `functions/modules/_shared/providerConfigs.js`.

Add this block after `DEFAULT_DJEN_CONFIG`:

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
    dedupe: {
        dateToleranceDays: 90,
    },
    persistence: {
        saveRawPayloads: true,
    },
};
```

Add this loader after `loadDjenConfig`:

```js
async function loadEscavador2Config(tenantId) {
    const tenantData = await getTenantSettingsData(tenantId);
    const rawConfig = tenantData?.enrichmentConfig?.escavador2;
    if (!rawConfig) return { ...DEFAULT_ESCAVADOR2_CONFIG };

    return {
        ...DEFAULT_ESCAVADOR2_CONFIG,
        ...rawConfig,
        phases: {
            ...DEFAULT_ESCAVADOR2_CONFIG.phases,
            ...(rawConfig.phases || {}),
        },
        request: {
            ...DEFAULT_ESCAVADOR2_CONFIG.request,
            ...(rawConfig.request || {}),
        },
        dedupe: {
            ...DEFAULT_ESCAVADOR2_CONFIG.dedupe,
            ...(rawConfig.dedupe || {}),
        },
        persistence: {
            ...DEFAULT_ESCAVADOR2_CONFIG.persistence,
            ...(rawConfig.persistence || {}),
        },
    };
}
```

Add these names to `module.exports`:

```js
DEFAULT_ESCAVADOR2_CONFIG,
loadEscavador2Config,
```

- [ ] **Step 4: Run config tests and verify pass**

Run from `functions/`:

```bash
npm test -- modules/_shared/providerConfigs.test.js
```

Expected: PASS for provider config tests.

- [ ] **Step 5: Commit provider config**

```bash
git add functions/modules/_shared/providerConfigs.js functions/modules/_shared/providerConfigs.test.js
git commit -m "feat: adiciona config escavador2 por tenant"
```

---

### Task 5: Enrichment Phase For Escavador2

**Files:**
- Modify: `functions/modules/enrichmentPhases.js`
- Modify: `functions/modules/enrichmentPhases.test.js`

- [ ] **Step 1: Add failing phase tests**

Append this test block to `functions/modules/enrichmentPhases.test.js`:

```js
describe('runEscavador2EnrichmentPhase', () => {
  function makeEscavador2Deps(overrides = {}) {
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
        },
      }),
      mocks: { consultarEscavador2, normalizeEscavador2Response, deduplicateEscavador2Findings },
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

  it('stores partial data as PARTIAL and does not fail the pipeline', async () => {
    const { mocks, ...deps } = makeEscavador2Deps();
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();
    mocks.consultarEscavador2.mockResolvedValue({ consulta: { status: 'PARTIAL' }, processos: [] });
    mocks.normalizeEscavador2Response.mockReturnValue({ escavador2ApiStatus: 'PARTIAL', escavador2ProcessTotal: 0, escavador2Processos: [] });

    const result = await phases.runEscavador2EnrichmentPhase(caseRef, 'c1', { cpf: VALID_CPF, candidateName: 'John Doe' }, { enabled: true, request: {}, dedupe: { dateToleranceDays: 90 } });

    expect(result.status).toBe('PARTIAL');
    expect(caseRef.update).toHaveBeenCalledWith(expect.objectContaining({ escavador2EnrichmentStatus: 'PARTIAL' }));
    expect(deps.maybeRunAutoClassifyAndAi).toHaveBeenCalledWith(caseRef, 'c1', 'Escavador2 completed');
  });

  it('marks FAILED on provider error and triggers classification', async () => {
    const { mocks, ...deps } = makeEscavador2Deps();
    const phases = createEnrichmentPhases(deps);
    const caseRef = makeCaseRef();
    mocks.consultarEscavador2.mockRejectedValue(new Error('Escavador2 HTTP 502'));

    const result = await phases.runEscavador2EnrichmentPhase(caseRef, 'c1', { cpf: VALID_CPF, candidateName: 'John Doe' }, { enabled: true, request: {}, dedupe: { dateToleranceDays: 90 } });

    expect(result.status).toBe('FAILED');
    expect(caseRef.update).toHaveBeenCalledWith(expect.objectContaining({
      escavador2EnrichmentStatus: 'FAILED',
      escavador2Error: 'Escavador2 HTTP 502',
    }));
    expect(deps.maybeRunAutoClassifyAndAi).toHaveBeenCalledWith(caseRef, 'c1', 'Escavador2 failed');
  });
});
```

- [ ] **Step 2: Run phase tests and verify failure**

Run from `functions/`:

```bash
npm test -- modules/enrichmentPhases.test.js -t Escavador2
```

Expected: FAIL because `runEscavador2EnrichmentPhase` is not exported by `createEnrichmentPhases`.

- [ ] **Step 3: Wire imports and injected dependencies**

Modify `functions/modules/enrichmentPhases.js`.

Add imports near the other adapter and normalizer imports:

```js
const {
  consultarEscavador2: default_consultarEscavador2,
  Escavador2Error: default_Escavador2Error,
} = require('../adapters/escavador2');
const {
  normalizeEscavador2Response: default_normalizeEscavador2Response,
} = require('../normalizers/escavador2');
const {
  deduplicateEscavador2Findings: default_deduplicateEscavador2Findings,
} = require('../helpers/deduplicateEscavador2');
```

Add `escavador2ApiKey` to the destructuring inside `createEnrichmentPhases`:

```js
    escavador2ApiKey,
```

Add injected dependency bindings after DJEN adapter bindings:

```js
  const consultarEscavador2 = adapters.consultarEscavador2 || default_consultarEscavador2;
  const Escavador2Error = adapters.Escavador2Error || default_Escavador2Error;
```

Add normalizer/helper bindings near the other bindings:

```js
  const normalizeEscavador2Response = normalizers.normalizeEscavador2Response || default_normalizeEscavador2Response;
  const deduplicateEscavador2Findings = helpers.deduplicateEscavador2Findings || default_deduplicateEscavador2Findings;
```

- [ ] **Step 4: Add minimal Escavador2 phase implementation**

Add this function inside `createEnrichmentPhases`, after `runDjenEnrichmentPhase` and before the final `return`:

```js
  async function runEscavador2EnrichmentPhase(caseRef, caseId, caseData, escavador2Config = {}) {
    const cpf = String(caseData.cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11) {
      const error = 'CPF invalido para Escavador2.';
      await caseRef.update({
        escavador2EnrichmentStatus: 'FAILED',
        escavador2Error: error,
        updatedAt: FieldValue.serverTimestamp(),
      });
      await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Escavador2 failed');
      return { status: 'FAILED', error };
    }

    const apiKey = escavador2ApiKey?.value ? escavador2ApiKey.value() : '';
    if (!apiKey) {
      const error = 'ESCAVADOR2_API_KEY nao configurado.';
      await caseRef.update({
        escavador2EnrichmentStatus: 'FAILED',
        escavador2Error: error,
        updatedAt: FieldValue.serverTimestamp(),
      });
      await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Escavador2 failed');
      return { status: 'FAILED', error };
    }

    await caseRef.update({
      escavador2EnrichmentStatus: 'RUNNING',
      escavador2Error: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    try {
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
        escavador2Error: null,
        escavador2CostBRL: 0,
        escavador2EnrichedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (escavador2Config.persistence?.saveRawPayloads === false) {
        delete updatePayload.escavador2RawPayloads;
      }
      await caseRef.update(updatePayload);
      await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Escavador2 completed');
      return { status, error: null };
    } catch (err) {
      const errMsg = err instanceof Escavador2Error
        ? `${err.message}${err.statusCode ? ` (${err.statusCode})` : ''}`
        : (err.message || 'Erro desconhecido no Escavador2');
      await caseRef.update({
        escavador2EnrichmentStatus: 'FAILED',
        escavador2Error: errMsg,
        escavador2EnrichedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Escavador2 failed');
      return { status: 'FAILED', error: errMsg };
    }
  }
```

Add `runEscavador2EnrichmentPhase` to the object returned by `createEnrichmentPhases`.

- [ ] **Step 5: Run phase tests and verify pass**

Run from `functions/`:

```bash
npm test -- modules/enrichmentPhases.test.js -t Escavador2
```

Expected: PASS for the Escavador2 phase tests.

- [ ] **Step 6: Commit phase implementation**

```bash
git add functions/modules/enrichmentPhases.js functions/modules/enrichmentPhases.test.js
git commit -m "feat: adiciona fase escavador2"
```

---

### Task 6: Trigger Escavador2 As Final Pipeline Phase

**Files:**
- Modify: `functions/modules/enrichmentTriggers.js`
- Modify: `functions/modules/enrichmentTriggers.test.js`

- [ ] **Step 1: Add failing trigger tests**

Modify `functions/modules/enrichmentTriggers.test.js` import to include `createEnrichEscavador2OnCaseHandler`, add these defaults to `makeDeps`, and append the tests.

Add to `makeDeps` return object:

```js
        loadEscavador2Config: vi.fn().mockResolvedValue({ enabled: true, request: {}, dedupe: { dateToleranceDays: 90 } }),
        runEscavador2EnrichmentPhase: vi.fn().mockResolvedValue(undefined),
```

Append this block:

```js
describe('createEnrichEscavador2OnCaseHandler', () => {
    it('runs after DJEN settles and all upstream providers are terminal', async () => {
        const deps = makeDeps();
        const handler = createEnrichEscavador2OnCaseHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: {
                before: { data: () => ({ djenEnrichmentStatus: 'RUNNING' }) },
                after: { data: () => ({
                    tenantId: 't1',
                    status: 'PENDING',
                    bigdatacorpEnrichmentStatus: 'DONE',
                    juditEnrichmentStatus: 'DONE',
                    escavadorEnrichmentStatus: 'SKIPPED',
                    djenEnrichmentStatus: 'DONE',
                    escavador2EnrichmentStatus: 'PENDING',
                }) },
            },
        };

        await handler(event);

        expect(deps.acquirePhaseRun).toHaveBeenCalledWith(expect.anything(), 'escavador2EnrichmentStatus');
        expect(deps.runEscavador2EnrichmentPhase).toHaveBeenCalled();
    });

    it('waits while DJEN is still running', async () => {
        const deps = makeDeps();
        const handler = createEnrichEscavador2OnCaseHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: {
                before: { data: () => ({ djenEnrichmentStatus: 'PENDING' }) },
                after: { data: () => ({
                    tenantId: 't1',
                    status: 'PENDING',
                    bigdatacorpEnrichmentStatus: 'DONE',
                    juditEnrichmentStatus: 'DONE',
                    escavadorEnrichmentStatus: 'SKIPPED',
                    djenEnrichmentStatus: 'RUNNING',
                    escavador2EnrichmentStatus: 'PENDING',
                }) },
            },
        };

        await handler(event);

        expect(deps.runEscavador2EnrichmentPhase).not.toHaveBeenCalled();
    });

    it('marks SKIPPED and classifies when Escavador2 is disabled for tenant', async () => {
        const deps = makeDeps({ loadEscavador2Config: vi.fn().mockResolvedValue({ enabled: false }) });
        const handler = createEnrichEscavador2OnCaseHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: {
                before: { data: () => ({ djenEnrichmentStatus: 'RUNNING' }) },
                after: { data: () => ({
                    tenantId: 't1',
                    status: 'PENDING',
                    bigdatacorpEnrichmentStatus: 'DONE',
                    juditEnrichmentStatus: 'DONE',
                    escavadorEnrichmentStatus: 'SKIPPED',
                    djenEnrichmentStatus: 'DONE',
                    escavador2EnrichmentStatus: 'PENDING',
                }) },
            },
        };

        await handler(event);

        const caseRef = deps.db.collection('cases').doc('c1');
        expect(caseRef.update).toHaveBeenCalledWith(expect.objectContaining({
            escavador2EnrichmentStatus: 'SKIPPED',
            escavador2Error: null,
        }));
        expect(deps.maybeRunAutoClassifyAndAi).toHaveBeenCalledWith(caseRef, 'c1', 'Escavador2 disabled');
    });

    it('marks FAILED and classifies when trigger setup fails', async () => {
        const deps = makeDeps({ runEscavador2EnrichmentPhase: vi.fn().mockRejectedValue(new Error('phase exploded')) });
        const handler = createEnrichEscavador2OnCaseHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: {
                before: { data: () => ({ djenEnrichmentStatus: 'RUNNING' }) },
                after: { data: () => ({
                    tenantId: 't1',
                    status: 'PENDING',
                    bigdatacorpEnrichmentStatus: 'DONE',
                    juditEnrichmentStatus: 'DONE',
                    escavadorEnrichmentStatus: 'SKIPPED',
                    djenEnrichmentStatus: 'DONE',
                    escavador2EnrichmentStatus: 'PENDING',
                }) },
            },
        };

        await handler(event);

        const caseRef = deps.db.collection('cases').doc('c1');
        expect(caseRef.update).toHaveBeenCalledWith(expect.objectContaining({
            escavador2EnrichmentStatus: 'FAILED',
            escavador2Error: 'phase exploded',
        }));
        expect(deps.maybeRunAutoClassifyAndAi).toHaveBeenCalledWith(caseRef, 'c1', 'Escavador2 trigger failure');
    });
});
```

- [ ] **Step 2: Run trigger tests and verify failure**

Run from `functions/`:

```bash
npm test -- modules/enrichmentTriggers.test.js -t Escavador2
```

Expected: FAIL because `createEnrichEscavador2OnCaseHandler` is not exported.

- [ ] **Step 3: Implement the trigger factory**

Add this function to `functions/modules/enrichmentTriggers.js` before `module.exports`:

```js
function createEnrichEscavador2OnCaseHandler(deps) {
    const {
        db,
        FieldValue,
        acquirePhaseRun,
        loadEscavador2Config,
        runEscavador2EnrichmentPhase,
        isSettledProviderStatus,
        maybeRunAutoClassifyAndAi,
        writeAuditEvent,
        ACTOR_TYPE,
        SOURCE,
    } = deps;

    return async (event) => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        if (!before || !after) return;

        const watchedFields = [
            'bigdatacorpEnrichmentStatus',
            'juditEnrichmentStatus',
            'escavadorEnrichmentStatus',
            'djenEnrichmentStatus',
        ];
        const relevantChange = watchedFields.some((field) => before[field] !== after[field]);
        if (!relevantChange) return;

        const escavador2Status = after.escavador2EnrichmentStatus;
        if (escavador2Status && escavador2Status !== 'PENDING') return;
        if (after.status === 'DONE' || after.status === 'CORRECTION_NEEDED') return;
        if (!isSettledProviderStatus(after.bigdatacorpEnrichmentStatus)) return;
        if (!isSettledProviderStatus(after.juditEnrichmentStatus)) return;
        if (after.juditNeedsEscavador === true && !isSettledProviderStatus(after.escavadorEnrichmentStatus)) return;
        if (after.djenEnrichmentStatus && !isSettledProviderStatus(after.djenEnrichmentStatus)) return;

        const caseData = after;
        const caseId = event.params.caseId;
        const caseRef = db.collection('cases').doc(caseId);
        const tenantId = caseData.tenantId;
        if (!tenantId) return;

        try {
            const escavador2Config = await loadEscavador2Config(tenantId);
            if (!escavador2Config.enabled) {
                await caseRef.update({
                    escavador2EnrichmentStatus: 'SKIPPED',
                    escavador2Error: null,
                    updatedAt: FieldValue.serverTimestamp(),
                });
                await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Escavador2 disabled');
                return;
            }

            const runLock = await acquirePhaseRun(caseRef, 'escavador2EnrichmentStatus');
            if (!runLock.acquired) return;

            await runEscavador2EnrichmentPhase(caseRef, caseId, runLock.caseData || caseData, escavador2Config);

            try {
                const refreshed = (await caseRef.get()).data() || {};
                await writeAuditEvent({
                    action: 'ENRICHMENT_AUTO_TRIGGERED',
                    tenantId,
                    actor: { type: ACTOR_TYPE.SYSTEM },
                    entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
                    related: { caseId },
                    source: SOURCE.CLOUD_FUNCTION,
                    metadata: { phase: 'escavador2', status: refreshed.escavador2EnrichmentStatus, trigger: 'upstream_settled' },
                    templateVars: { candidateName: caseData.candidateName || caseId, phase: 'escavador2', status: refreshed.escavador2EnrichmentStatus || 'UNKNOWN' },
                });
            } catch { }
        } catch (err) {
            await caseRef.update({
                escavador2EnrichmentStatus: 'FAILED',
                escavador2Error: err.message || 'Erro desconhecido no Escavador2.',
                updatedAt: FieldValue.serverTimestamp(),
            });
            await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Escavador2 trigger failure');
        }
    };
}
```

Add `createEnrichEscavador2OnCaseHandler` to `module.exports`.

- [ ] **Step 4: Run trigger tests and verify pass**

Run from `functions/`:

```bash
npm test -- modules/enrichmentTriggers.test.js -t Escavador2
```

Expected: PASS for Escavador2 trigger tests.

- [ ] **Step 5: Commit trigger**

```bash
git add functions/modules/enrichmentTriggers.js functions/modules/enrichmentTriggers.test.js
git commit -m "feat: aciona escavador2 ao final do pipeline"
```

---

### Task 7: Auto-Classification Readiness And Signals

**Files:**
- Modify: `functions/modules/autoClassification.js`
- Modify: `functions/modules/autoClassification.test.js`

- [ ] **Step 1: Add failing auto-classification tests**

Append these tests to `functions/modules/autoClassification.test.js`:

```js
describe('Escavador2 pipeline readiness', () => {
    it('blocks final classification while Escavador2 is PENDING', () => {
        const result = canRunFinalClassification({
            bigdatacorpEnrichmentStatus: 'DONE',
            juditEnrichmentStatus: 'DONE',
            djenEnrichmentStatus: 'DONE',
            escavador2EnrichmentStatus: 'PENDING',
        });

        expect(result).toEqual({ ok: false, reason: 'escavador2_PENDING' });
    });

    it('allows final classification when Escavador2 failed terminally', () => {
        const result = canRunFinalClassification({
            bigdatacorpEnrichmentStatus: 'DONE',
            juditEnrichmentStatus: 'DONE',
            djenEnrichmentStatus: 'DONE',
            escavador2EnrichmentStatus: 'FAILED',
        });

        expect(result).toEqual({ ok: true, reason: 'ready' });
    });

    it('includes Escavador2 fields in auto-classify signature', () => {
        const hashInputs = [];
        const signature = computeAutoClassifySignature({
            bigdatacorpEnrichmentStatus: 'DONE',
            juditEnrichmentStatus: 'DONE',
            escavador2EnrichmentStatus: 'DONE',
            escavador2ProcessTotal: 1,
            escavador2NewFindingCount: 1,
            escavador2CriminalCount: 1,
        }, {
            computeSimpleHash: (value) => {
                hashInputs.push(value);
                return 'hash';
            },
        });

        expect(signature).toBe('hash');
        expect(hashInputs[0]).toContain('escavador2EnrichmentStatus');
        expect(hashInputs[0]).toContain('escavador2NewFindingCount');
    });
});
```

- [ ] **Step 2: Run auto-classification tests and verify failure**

Run from `functions/`:

```bash
npm test -- modules/autoClassification.test.js -t Escavador2
```

Expected: FAIL because Escavador2 readiness and signature fields are not handled.

- [ ] **Step 3: Update readiness gate**

In `functions/modules/autoClassification.js`, add this block after the DJEN readiness block in `canRunFinalClassification`:

```js
    if (caseData.escavador2EnrichmentStatus && !isProviderTerminalForPipelineFn(caseData.escavador2EnrichmentStatus)) {
        return { ok: false, reason: `escavador2_${caseData.escavador2EnrichmentStatus}` };
    }
```

- [ ] **Step 4: Update signature fields**

In `computeAutoClassifySignature`, add these field names after DJEN fields:

```js
        'escavador2EnrichmentStatus',
        'escavador2ProcessTotal',
        'escavador2CriminalCount',
        'escavador2LaborCount',
        'escavador2NewFindingCount',
        'escavador2DuplicateCount',
        'escavador2HasNewMaterialRisk',
```

- [ ] **Step 5: Add Escavador2 signal notes without inflating duplicates**

Inside `computeAutoClassification`, after the DJEN signal constants, add:

```js
    const escavador2Done = caseData.escavador2EnrichmentStatus === 'DONE' || caseData.escavador2EnrichmentStatus === 'PARTIAL';
    const escavador2NewProcesses = escavador2Done
        ? (Array.isArray(caseData.escavador2Processos) ? caseData.escavador2Processos : []).filter((item) => item.isNewEscavador2Finding === true)
        : [];
    const escavador2NewCriminalCount = escavador2NewProcesses.filter((item) => item.isCriminal === true).length;
    const escavador2NewLaborCount = escavador2NewProcesses.filter((item) => item.isLabor === true).length;
```

In the criminal note section, add a note only for new Escavador2 findings:

```js
    if (escavador2NewCriminalCount > 0) {
        pushUnique(criminalNotes, `Escavador2 encontrou ${escavador2NewCriminalCount} processo(s) criminal(is) novo(s) nao identificado(s) pelos demais provedores.`);
    }
```

In the labor note section, add:

```js
    if (escavador2NewLaborCount > 0) {
        pushUnique(laborNotes, `Escavador2 encontrou ${escavador2NewLaborCount} processo(s) trabalhista(s) novo(s) nao identificado(s) pelos demais provedores.`);
    }
```

- [ ] **Step 6: Run auto-classification tests and verify pass**

Run from `functions/`:

```bash
npm test -- modules/autoClassification.test.js -t Escavador2
```

Expected: PASS for Escavador2 readiness tests.

- [ ] **Step 7: Commit auto-classification changes**

```bash
git add functions/modules/autoClassification.js functions/modules/autoClassification.test.js
git commit -m "feat: considera escavador2 na classificacao"
```

---

### Task 8: Homonym Analysis Escavador2 Candidates

**Files:**
- Modify: `functions/helpers/aiHomonym.js`
- Modify: `functions/helpers/aiHomonym.test.js`

- [ ] **Step 1: Add failing homonym tests**

Append these tests to `functions/helpers/aiHomonym.test.js`:

```js
it('buildHomonymAnalysisInput includes Escavador2 new exact CPF candidates', () => {
    const result = buildHomonymAnalysisInput({
        hiringUf: 'SP',
        escavador2EnrichmentStatus: 'DONE',
        escavador2ProcessTotal: 1,
        escavador2NewFindingCount: 1,
        escavador2Processos: [
            {
                numeroCnj: '0001234-56.2024.8.26.0100',
                area: 'CRIMINAL',
                tribunalSigla: 'TJSP',
                processUf: 'SP',
                hasExactCpfMatch: true,
                isCriminal: true,
                tipoPrincipal: 'Reu',
                roleCategory: 'DEFENDANT',
                isNewEscavador2Finding: true,
            },
        ],
        enrichmentContact: { allUfs: ['SP'], primaryUf: 'SP' },
    });

    const escavador2Candidates = result.processCandidates.filter((candidate) => candidate.source === 'Escavador2');
    expect(escavador2Candidates).toHaveLength(1);
    expect(escavador2Candidates[0]).toEqual(expect.objectContaining({
        sourceKey: 'escavador2',
        evidenceStrength: 'HARD_FACT',
        analysisScope: 'REFERENCE_ONLY',
    }));
});

it('buildHomonymAnalysisInput skips Escavador2 duplicate-only candidates', () => {
    const result = buildHomonymAnalysisInput({
        escavador2EnrichmentStatus: 'DONE',
        escavador2ProcessTotal: 1,
        escavador2NewFindingCount: 0,
        escavador2Processos: [
            {
                numeroCnj: '0001234-56.2024.8.26.0100',
                area: 'CRIMINAL',
                hasExactCpfMatch: true,
                isCriminal: true,
                isNewEscavador2Finding: false,
                isDuplicate: true,
            },
        ],
    });

    const escavador2Candidates = result.processCandidates.filter((candidate) => candidate.source === 'Escavador2');
    expect(escavador2Candidates).toHaveLength(0);
});
```

- [ ] **Step 2: Run homonym tests and verify failure**

Run from `functions/`:

```bash
npm test -- helpers/aiHomonym.test.js -t Escavador2
```

Expected: FAIL because Escavador2 candidates are not included.

- [ ] **Step 3: Include Escavador2 in candidate profile CPF confirmation**

In `buildCandidateProfile`, extend `cpfConfirmedInProvider`:

```js
            || (caseData.escavador2Processos || []).some((item) => item?.hasExactCpfMatch)
```

- [ ] **Step 4: Add `buildEscavador2ProcessCandidates`**

Add this function after `buildEscavadorProcessCandidates`:

```js
function buildEscavador2ProcessCandidates(caseData, candidateProfile) {
    if (!['DONE', 'PARTIAL'].includes(caseData.escavador2EnrichmentStatus)) return [];
    const processes = Array.isArray(caseData.escavador2Processos) ? caseData.escavador2Processos : [];

    return processes
        .filter((processo) => processo.isNewEscavador2Finding === true)
        .map((processo) => {
            const hasExactCpfMatch = processo.hasExactCpfMatch === true;
            const viaNameOnly = !hasExactCpfMatch;
            const geoConsistency = getGeoConsistencyBucket(candidateProfile, processo.processUf, null);
            const roleValue = processo.tipoPrincipal || processo.roleCategory || processo.polo;
            const roleClassification = classifyRole(roleValue, processo.area);
            const lowRiskRole = hasLowRiskRole(roleValue, processo.area);
            const matchStrength = hasExactCpfMatch ? 'EXACT_CPF' : 'NAME_ONLY';
            const evidenceOrigin = resolveEvidenceOrigin('Escavador2', hasExactCpfMatch, viaNameOnly, matchStrength);
            const evidenceStrength = resolveEvidenceStrength({
                hasExactCpfMatch,
                hasDivergentCpf: false,
                lowRiskRole,
                geoConsistency,
                matchStrength,
                cpfsComEsseNome: getCpfsComNome(caseData),
            });
            const homonymRiskSignals = [];
            if (viaNameOnly) homonymRiskSignals.push('NO_EXACT_CPF_MATCH');
            if (geoConsistency === 'DISTANT_REGION') homonymRiskSignals.push('DISTANT_GEOGRAPHY');
            if (lowRiskRole) homonymRiskSignals.push('LOW_RISK_ROLE');
            if (processo.isMaterialRisk) homonymRiskSignals.push('ESCAVADOR2_MATERIAL_RISK');

            return {
                source: 'Escavador2',
                sourceKey: 'escavador2',
                cnj: processo.numeroCnj || null,
                area: processo.area || null,
                isCriminal: processo.isCriminal === true,
                tribunal: processo.tribunalSigla || null,
                processUf: processo.processUf || null,
                processCity: null,
                hasExactCpfMatch,
                hasDivergentCpf: false,
                matchedRole: roleValue || null,
                roleClassification,
                lowRiskRole,
                matchStrength,
                evidenceOrigin,
                evidenceStrength,
                analysisScope: resolveAnalysisScope(evidenceStrength),
                geoConsistency,
                identityConsistency: hasExactCpfMatch ? 'HIGH' : 'LOW',
                viaNameOnly,
                homonymRiskSignals,
            };
        });
}
```

- [ ] **Step 5: Add Escavador2 to `buildHomonymAnalysisInput` process candidates**

Find where `processCandidates` is built from Judit, Escavador, and BigDataCorp, then include:

```js
        ...buildEscavador2ProcessCandidates(caseData, candidateProfile),
```

Export `buildEscavador2ProcessCandidates` in `module.exports`.

- [ ] **Step 6: Run homonym tests and verify pass**

Run from `functions/`:

```bash
npm test -- helpers/aiHomonym.test.js -t Escavador2
```

Expected: PASS for Escavador2 homonym tests.

- [ ] **Step 7: Commit homonym integration**

```bash
git add functions/helpers/aiHomonym.js functions/helpers/aiHomonym.test.js
git commit -m "feat: inclui escavador2 na triagem de homonimos"
```

---

### Task 9: AI Orchestrator Context And Provider Inclusion

**Files:**
- Modify: `functions/modules/aiOrchestrator.js`
- Modify: `functions/modules/aiOrchestrator.test.js`

- [ ] **Step 1: Add failing AI context tests**

Append these tests to `functions/modules/aiOrchestrator.test.js`:

```js
describe('Escavador2 AI context', () => {
  it('getAiProvidersIncluded includes Escavador2 when DONE', () => {
    expect(getAiProvidersIncluded({ escavador2EnrichmentStatus: 'DONE' })).toContain('Escavador2');
  });

  it('buildAiClassificationReviewContext includes Escavador2 source counts', () => {
    const context = buildAiClassificationReviewContext({
      bigdatacorpEnrichmentStatus: 'DONE',
      juditEnrichmentStatus: 'DONE',
      escavador2EnrichmentStatus: 'DONE',
      escavador2CriminalCount: 1,
      escavador2LaborCount: 0,
      escavador2NewFindingCount: 1,
      escavador2Processos: [{ numeroCnj: '0001234-56.2024.8.26.0100', isCriminal: true, isNewEscavador2Finding: true }],
    });

    expect(context.sources.criminal.some((source) => source.name === 'Escavador2' && source.findingCount === 1)).toBe(true);
  });
});
```

If the test file does not import `getAiProvidersIncluded` or `buildAiClassificationReviewContext`, merge those names into the existing import from `./aiOrchestrator.js`.

- [ ] **Step 2: Run AI tests and verify failure**

Run from `functions/`:

```bash
npm test -- modules/aiOrchestrator.test.js -t Escavador2
```

Expected: FAIL because Escavador2 is absent from provider inclusion/context.

- [ ] **Step 3: Add compact Escavador2 process context**

In `functions/modules/aiOrchestrator.js`, add this function after `compactEscavadorProcessos`:

```js
function compactEscavador2Processos(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item?.isNewEscavador2Finding === true)
    .slice(0, 10)
    .map((item) => stripUndefined({
      numeroCnj: item.numeroCnj || null,
      area: item.area || null,
      tribunal: item.tribunalSigla || null,
      uf: item.processUf || null,
      classe: item.classe || null,
      assunto: item.assunto || null,
      roleCategory: item.roleCategory || null,
      polo: item.polo || null,
      hasExactCpfMatch: item.hasExactCpfMatch === true,
      isMaterialRisk: item.isMaterialRisk === true,
      isCriminal: item.isCriminal === true,
      isLabor: item.isLabor === true,
      duplicateOfProvider: item.duplicateOfProvider || null,
    }));
}
```

- [ ] **Step 4: Include Escavador2 in providers and review sources**

In `getAiProvidersIncluded`, add:

```js
    isDoneOrPartial(caseData.escavador2EnrichmentStatus) ? 'Escavador2' : null,
```

In `buildAiClassificationReviewContext`, add counts near the other provider counts:

```js
  const criminalEscavador2Count = (Array.isArray(caseData.escavador2Processos) ? caseData.escavador2Processos : [])
    .filter((item) => item?.isNewEscavador2Finding === true && item?.isCriminal === true)
    .length;
  const laborEscavador2Count = (Array.isArray(caseData.escavador2Processos) ? caseData.escavador2Processos : [])
    .filter((item) => item?.isNewEscavador2Finding === true && item?.isLabor === true)
    .length;
```

Add Escavador2 to the criminal and labor source arrays:

```js
      buildReviewSource('Escavador2', caseData.escavador2EnrichmentStatus, criminalEscavador2Count),
```

```js
      buildReviewSource('Escavador2', caseData.escavador2EnrichmentStatus, laborEscavador2Count),
```

Add an `escavador2` context object next to the existing `escavador` object:

```js
      escavador2: {
        processTotal: caseData.escavador2ProcessTotal || 0,
        newFindingCount: caseData.escavador2NewFindingCount || 0,
        duplicateCount: caseData.escavador2DuplicateCount || 0,
        criminalFlag: caseData.escavador2CriminalFlag || null,
        criminalCount: caseData.escavador2CriminalCount || 0,
        laborFlag: caseData.escavador2LaborFlag || null,
        laborCount: caseData.escavador2LaborCount || 0,
        processos: compactEscavador2Processos(caseData.escavador2Processos),
      },
```

- [ ] **Step 5: Run AI tests and verify pass**

Run from `functions/`:

```bash
npm test -- modules/aiOrchestrator.test.js -t Escavador2
```

Expected: PASS for Escavador2 AI context tests.

- [ ] **Step 6: Commit AI context**

```bash
git add functions/modules/aiOrchestrator.js functions/modules/aiOrchestrator.test.js
git commit -m "feat: inclui escavador2 no contexto de IA"
```

---

### Task 10: Firebase Wiring And Manual Rerun

**Files:**
- Modify: `functions/index.js`
- Modify: `functions/modules/caseQueriesAssignments.js`
- Test: `functions/listOpsCasesV2.test.js` if list field assertions exist
- Test: `functions/modules/caseQueriesAssignments.test.js`

- [ ] **Step 1: Add failing rerun validation test**

In `functions/modules/caseQueriesAssignments.test.js`, add a test that calls the rerun handler with `phase: 'escavador2'` if this file already tests rerun. If rerun tests live only through `functions/index.js`, add a contract assertion to the existing rerun test file that expects `escavador2` to be accepted in the valid phase list.

Use this assertion in the relevant test:

```js
expect(['fontedata', 'escavador', 'escavador2', 'judit', 'bigdatacorp', 'djen', 'ai', 'all']).toContain('escavador2');
```

- [ ] **Step 2: Run rerun-related tests and verify failure**

Run from `functions/`:

```bash
npm test -- modules/caseQueriesAssignments.test.js
```

Expected: FAIL or no coverage for rerun validation until `escavador2` is wired in `index.js`. If the test file does not instantiate `index.js`, continue with the implementation and rely on the full backend test in Step 8.

- [ ] **Step 3: Define and pass Escavador2 secret**

In `functions/index.js`, add after existing secrets:

```js
const escavador2ApiKey = defineSecret('ESCAVADOR2_API_KEY');
```

Add `loadEscavador2Config` to the provider config import.

Add `escavador2ApiKey` to `createEnrichmentPhases` deps.

Add `runEscavador2EnrichmentPhase` to the destructuring result from `createEnrichmentPhases`.

Add these dependencies to `enrichmentTriggerDeps`:

```js
    loadEscavador2Config,
    runEscavador2EnrichmentPhase,
```

- [ ] **Step 4: Export the Escavador2 trigger**

Add after `exports.enrichDjenOnCase`:

```js
exports.enrichEscavador2OnCase = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1', timeoutSeconds: 540, memory: '512MiB', secrets: [escavador2ApiKey, openaiApiKey] },
    enrichmentTriggers.createEnrichEscavador2OnCaseHandler(enrichmentTriggerDeps),
);
```

- [ ] **Step 5: Add Escavador2 to rerun phase validation and secrets**

In `exports.rerunEnrichmentPhase`, add `escavador2ApiKey` to the `secrets` array.

Change the phase validation list to:

```js
if (!['fontedata', 'escavador', 'escavador2', 'judit', 'bigdatacorp', 'djen', 'ai', 'all'].includes(phase)) {
    throw new HttpsError('invalid-argument', 'Fase invalida para rerun.');
}
```

Add Escavador2 running status to `runningProviders`:

```js
caseData.escavador2EnrichmentStatus === 'RUNNING' ? 'Escavador2' : null,
```

Add to full rerun `resetPayload`:

```js
escavador2EnrichmentStatus: 'PENDING',
escavador2Error: null,
```

Add `escavador2RunId` in `buildProviderRunIds` in `functions/modules/caseQueriesAssignments.js`:

```js
escavador2RunId: `escavador2_${runId}`,
```

- [ ] **Step 6: Add Escavador2 data field reset list**

In `functions/index.js`, add this list after `djenDataFields`:

```js
const escavador2DataFields = [
    'escavador2ApiStatus', 'escavador2ProcessTotal', 'escavador2Processos',
    'escavador2CriminalFlag', 'escavador2CriminalCount', 'escavador2LaborFlag', 'escavador2LaborCount',
    'escavador2MaterialRiskCount', 'escavador2CnjMaskedCount', 'escavador2CnjExtractedCount',
    'escavador2DuplicateCount', 'escavador2NewFindingCount', 'escavador2HasNewMaterialRisk',
    'escavador2Notes', 'escavador2PartialErrors', 'escavador2Stats', 'escavador2Sources',
    'escavador2RawPayloads', 'escavador2CostBRL', 'escavador2EnrichedAt',
];
```

In `applyCascadeReset`, when current phase is `bigdatacorp`, `judit`, or `djen`, set:

```js
target.escavador2EnrichmentStatus = 'PENDING';
target.escavador2Error = null;
applyDeleteFields(target, escavador2DataFields);
```

Add `escavador2` to `phaseMeta`:

```js
escavador2: { statusField: 'escavador2EnrichmentStatus', errorField: 'escavador2Error', label: 'Escavador2', derived: aiDerivedFields },
```

Add phase execution block after DJEN block:

```js
if (phase === 'escavador2') {
    const escavador2Config = await loadEscavador2Config(caseData.tenantId);
    if (!escavador2Config.enabled) {
        throw new HttpsError('failed-precondition', 'Escavador2 desabilitado para este tenant.');
    }
    if (scope === 'cascade') {
        const invalidateFields = {};
        for (const field of phaseMeta.escavador2.derived) {
            invalidateFields[field] = field === 'reportReady' ? false : FieldValue.delete();
        }
        invalidateFields.updatedAt = FieldValue.serverTimestamp();
        await caseRef.update(invalidateFields);
    }
    await runEscavador2EnrichmentPhase(caseRef, caseId, await getFreshCaseData(), escavador2Config);
}
```

- [ ] **Step 7: Add list/metric fields**

In `functions/modules/caseQueriesAssignments.js`, add `escavador2EnrichmentStatus` to `OPS_METRIC_FIELDS`, `OPS_CASE_LIST_FIELDS`, and `METRIC_PROVIDERS`:

```js
{ key: 'escavador2', field: 'escavador2EnrichmentStatus' },
```

Add all Escavador2 data fields to `FULL_RERUN_DERIVED_FIELDS` near DJEN fields.

- [ ] **Step 8: Run wiring tests**

Run from `functions/`:

```bash
npm test -- modules/enrichmentTriggers.test.js modules/enrichmentPhases.test.js modules/caseQueriesAssignments.test.js
```

Expected: PASS for listed test files.

- [ ] **Step 9: Commit Firebase wiring**

```bash
git add functions/index.js functions/modules/caseQueriesAssignments.js functions/modules/caseQueriesAssignments.test.js
git commit -m "feat: integra escavador2 ao wiring firebase"
```

---

### Task 11: Report Builder And Client/Public Exposure Guardrails

**Files:**
- Modify: `functions/reportBuilder.cjs`
- Modify: `src/core/reportBuilder.js`
- Modify: `functions/modules/_shared/fieldConstants.js`
- Test: `functions/publicResultPrivacy.test.js`
- Test: `frontendBackendContract.test.js`

- [ ] **Step 1: Add privacy regression test**

In `functions/publicResultPrivacy.test.js`, add Escavador2 raw fields to the input case and assert they are omitted:

```js
expect(snapshot.escavador2RawPayloads).toBeUndefined();
expect(snapshot.escavador2Sources).toBeUndefined();
expect(snapshot.escavador2Processos).toBeUndefined();
```

Use this case data addition in the same test:

```js
escavador2RawPayloads: { response: { secret: 'raw' } },
escavador2Sources: { consulta: { cpf: '12345678901' } },
escavador2Processos: [{ numeroCnj: '0001234-56.2024.8.26.0100' }],
```

- [ ] **Step 2: Run privacy test and verify current behavior**

Run from repository root:

```bash
cd functions && npm test -- publicResultPrivacy.test.js
```

Expected: PASS if allowlists already omit unknown fields; FAIL if report snapshot helper copies unexpected fields. If it passes, still keep the regression assertions.

- [ ] **Step 3: Add report builder helper in backend**

In `functions/reportBuilder.cjs`, add a helper near process-rendering helpers:

```js
function getEscavador2NewFindings(caseData = {}) {
  return (Array.isArray(caseData.escavador2Processos) ? caseData.escavador2Processos : [])
    .filter((item) => item?.isNewEscavador2Finding === true)
    .slice(0, 5);
}
```

Find the report section that renders process evidence and add Escavador2 only when `getEscavador2NewFindings(caseData).length > 0`:

```js
const escavador2NewFindings = getEscavador2NewFindings(caseData);
if (escavador2NewFindings.length > 0) {
  sections.push(`
    <section class="report-section">
      <h2>Achados complementares Escavador2</h2>
      <p>O Escavador2 identificou processo(s) novo(s) nao encontrado(s) nas demais fontes automatizadas.</p>
      <ul>
        ${escavador2NewFindings.map((item) => `<li>${escapeHtml(item.numeroCnj || 'Processo sem CNJ completo')} — ${escapeHtml(item.area || 'Area nao identificada')} — ${escapeHtml(item.tribunalSigla || 'Tribunal nao identificado')}</li>`).join('')}
      </ul>
    </section>
  `);
}
```

Use the existing section accumulation variable name in the file. If it is not named `sections`, add the HTML block at the existing point where provider-specific evidence sections are concatenated.

- [ ] **Step 4: Mirror report helper in frontend**

Apply the same helper and rendering rule to `src/core/reportBuilder.js` using the same function name `getEscavador2NewFindings` and same text.

- [ ] **Step 5: Confirm allowlists do not expose raw fields**

In `functions/modules/_shared/fieldConstants.js`, do not add `escavador2RawPayloads`, `escavador2Sources`, or `escavador2Processos` to `PUBLIC_RESULT_FIELDS`.

If product wants status cards in client mirrors later, add only non-raw derived fields to `CLIENT_SAFE_PUBLICATION_FIELDS`:

```js
'escavador2EnrichmentStatus',
'escavador2NewFindingCount',
'escavador2DuplicateCount',
```

If no client UI reads these fields now, do not add them.

- [ ] **Step 6: Run report and contract tests**

Run from repository root:

```bash
cd functions && npm test -- publicResultPrivacy.test.js
npm test -- frontendBackendContract.test.js
```

Expected: PASS for privacy and frontend/backend contract tests.

- [ ] **Step 7: Commit report changes**

```bash
git add functions/reportBuilder.cjs src/core/reportBuilder.js functions/modules/_shared/fieldConstants.js functions/publicResultPrivacy.test.js frontendBackendContract.test.js
git commit -m "feat: exibe achados novos do escavador2 com privacidade"
```

---

### Task 12: Client Solicitation Reset And Case Creation Defaults

**Files:**
- Modify: `functions/modules/clientSolicitations.js`
- Modify: related tests in `functions/modules/clientSolicitations.test.js`

- [ ] **Step 1: Add failing reset/default tests**

In `functions/modules/clientSolicitations.test.js`, add assertions to existing creation/correction tests:

```js
expect(createdCase.escavador2EnrichmentStatus).toBe('PENDING');
expect(createdCase.escavador2Error).toBeNull();
```

For correction/reset payload assertions, add:

```js
expect(updatePayload.escavador2EnrichmentStatus).toBe('PENDING');
expect(updatePayload.escavador2Error).toBeNull();
expect(updatePayload.escavador2Processos).toEqual(expect.anything());
```

When using Firestore delete sentinels, assert deletion with the test's existing sentinel value:

```js
expect(updatePayload.escavador2Processos).toBe('DELETE');
```

- [ ] **Step 2: Run client solicitation tests and verify failure**

Run from `functions/`:

```bash
npm test -- modules/clientSolicitations.test.js
```

Expected: FAIL because `escavador2*` defaults/resets are not present.

- [ ] **Step 3: Add Escavador2 defaults on case creation**

In `functions/modules/clientSolicitations.js`, find the new case payload and add:

```js
escavador2EnrichmentStatus: 'PENDING',
escavador2Error: null,
```

- [ ] **Step 4: Add Escavador2 resets on correction**

In the correction/reset payload builder, add:

```js
escavador2EnrichmentStatus: 'PENDING',
escavador2Error: null,
escavador2ApiStatus: FieldValue.delete(),
escavador2ProcessTotal: FieldValue.delete(),
escavador2Processos: FieldValue.delete(),
escavador2CriminalFlag: FieldValue.delete(),
escavador2CriminalCount: FieldValue.delete(),
escavador2LaborFlag: FieldValue.delete(),
escavador2LaborCount: FieldValue.delete(),
escavador2MaterialRiskCount: FieldValue.delete(),
escavador2CnjMaskedCount: FieldValue.delete(),
escavador2CnjExtractedCount: FieldValue.delete(),
escavador2DuplicateCount: FieldValue.delete(),
escavador2NewFindingCount: FieldValue.delete(),
escavador2HasNewMaterialRisk: FieldValue.delete(),
escavador2PartialErrors: FieldValue.delete(),
escavador2Stats: FieldValue.delete(),
escavador2Sources: FieldValue.delete(),
escavador2RawPayloads: FieldValue.delete(),
escavador2CostBRL: FieldValue.delete(),
escavador2EnrichedAt: FieldValue.delete(),
```

Use the local Firestore sentinel object already used in that module. If the module receives `FieldValue` through dependencies, use that dependency instead of importing a new one.

- [ ] **Step 5: Run client solicitation tests and verify pass**

Run from `functions/`:

```bash
npm test -- modules/clientSolicitations.test.js
```

Expected: PASS for client solicitation tests.

- [ ] **Step 6: Commit creation/reset changes**

```bash
git add functions/modules/clientSolicitations.js functions/modules/clientSolicitations.test.js
git commit -m "feat: inicializa e reseta escavador2 em solicitacoes"
```

---

### Task 13: Documentation And Agent Guardrails

**Files:**
- Create: `docs/audits/ADR-005-escavador2-integration.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Create ADR**

Create `docs/audits/ADR-005-escavador2-integration.md` with this complete content:

```md
# ADR-005: Escavador2 como provedor complementar separado

## Status

Aceito em 2026-06-12.

## Contexto

O ComplianceHub ja possui uma integracao oficial com Escavador usando campos `escavador*`. Essa integracao esta desativada para o fluxo principal, mas seus campos e comportamento ainda existem para compatibilidade operacional e historica.

O novo servico Escavador2 e uma API propria hospedada no Cloud Run em `https://escavador2-api-dowqa75f4a-rj.a.run.app/escavador2/consultar`. Ele consulta por CPF, retorna processos normalizados, pode retornar CNJ mascarado e pode extrair CNJ completo a partir de payload bruto.

## Decisao

Escavador2 sera implementado como provedor complementar separado, usando exclusivamente campos com prefixo `escavador2*`.

Escavador2 roda em todos os casos quando `tenantSettings/{tenantId}.enrichmentConfig.escavador2.enabled === true`, apos BigDataCorp, Judit, Escavador oficial quando requerido, e DJEN estarem em estado terminal.

Escavador2 nao altera nem reutiliza campos `escavador*`.

## Regras

- Secret obrigatorio: `ESCAVADOR2_API_KEY` no Firebase Secret Manager.
- Custo persistido: `escavador2CostBRL = 0`.
- `PARTIAL` e terminal e preserva dados parciais.
- `FAILED` e terminal e nao bloqueia classificacao final.
- A classificacao final aguarda Escavador2 enquanto `escavador2EnrichmentStatus` nao estiver terminal.
- Dedupe usa CNJ completo primeiro, CNJ completo extraido segundo, e metadados com tolerancia de 90 dias quando CNJ completo nao existe.
- Dados brutos `escavador2RawPayloads` nunca entram em relatorio publico, publicResult ou clientCases.

## Consequencias

O pipeline ganha mais uma chamada externa propria e pode demorar mais nos casos com muitos processos. O trigger da Cloud Function usa timeout de 540 segundos para reduzir falhas por tempo.

O relatorio final menciona Escavador2 apenas quando houver achados novos relevantes nao identificados pelos demais provedores. Quando Escavador2 retorna somente duplicatas, os dados permanecem para auditoria/cards internos.
```

- [ ] **Step 2: Update AGENTS.md guardrails**

In `AGENTS.md`, add this subsection under external APIs or architecture notes:

```md
### Escavador2

- Escavador2 e uma integracao complementar propria via Cloud Run, separada do Escavador oficial.
- Nunca reutilizar campos `escavador*` para dados Escavador2; usar somente `escavador2*`.
- Toggle por tenant: `tenantSettings/{tenantId}.enrichmentConfig.escavador2.enabled`.
- Secret Firebase: `ESCAVADOR2_API_KEY`.
- Escavador2 roda como ultima fase de enriquecimento antes da classificacao final.
- `PARTIAL`, `FAILED`, `SKIPPED` e `DONE` sao terminais para liberar classificacao final.
- Raw payloads `escavador2RawPayloads` sao apenas auditoria interna e nao devem ser publicados em `publicResult` ou `clientCases`.
```

- [ ] **Step 3: Commit docs**

```bash
git add docs/audits/ADR-005-escavador2-integration.md AGENTS.md
git commit -m "docs: registra decisao escavador2"
```

---

### Task 14: Full Verification And Graph Update

**Files:**
- Modify: generated `graphify-out/*` if `graphify update .` changes the graph

- [ ] **Step 1: Run focused backend tests**

Run from `functions/`:

```bash
npm test -- adapters/escavador2.test.js normalizers/escavador2.test.js helpers/deduplicateEscavador2.test.js modules/enrichmentPhases.test.js modules/enrichmentTriggers.test.js modules/autoClassification.test.js helpers/aiHomonym.test.js modules/aiOrchestrator.test.js
```

Expected: PASS for all focused backend tests.

- [ ] **Step 2: Run full backend tests**

Run from `functions/`:

```bash
npm test
```

Expected: PASS for the backend suite.

- [ ] **Step 3: Run backend lint**

Run from `functions/`:

```bash
npm run lint
```

Expected: PASS with zero lint errors.

- [ ] **Step 4: Run frontend/report contract tests**

Run from repository root:

```bash
npm test -- frontendBackendContract.test.js
```

Expected: PASS.

- [ ] **Step 5: Run frontend build**

Run from repository root:

```bash
npm run build
```

Expected: production build completes successfully.

- [ ] **Step 6: Run root lint**

Run from repository root:

```bash
npm run lint
```

Expected: zero errors. Existing warnings in `src/portals/ops/ExportacoesPage.jsx` may remain if unrelated.

- [ ] **Step 7: Update graphify graph**

Run from repository root:

```bash
graphify update .
```

Expected: graph update completes without error. Review changed files under `graphify-out/` and include them in the final commit if the graph changed.

- [ ] **Step 8: Final status check**

Run from repository root:

```bash
git status --short
```

Expected: only intentional Escavador2 files and graphify outputs are modified.

- [ ] **Step 9: Commit verification graph update**

```bash
git add graphify-out
git commit -m "chore: atualiza grafo apos escavador2"
```

If `graphify update .` produced no changes, skip this commit.

---

## Deployment Checklist

- Confirm the Firebase Secret Manager secret exists:

```bash
firebase functions:secrets:access ESCAVADOR2_API_KEY
```

Expected: command returns a secret value or opens the configured access flow. Do not paste the value into logs, commits, or tickets.

- If the secret does not exist, create it before deploy:

```bash
firebase functions:secrets:set ESCAVADOR2_API_KEY
```

Expected: Firebase CLI prompts for the value and stores it.

- Deploy only after tests and build pass:

```bash
firebase deploy --only functions
```

Expected: deploy succeeds and includes `enrichEscavador2OnCase` plus updated `rerunEnrichmentPhase`.

---

## Self-Review

**Spec coverage:**

- Runs Escavador2 in all enabled cases: Tasks 4, 5, 6, 10, 12.
- Tenant config pattern: Task 4.
- Process-number dedupe and 90-day tolerance: Task 3.
- Client/public exposure rule: Task 11.
- Secret handling: Tasks 1, 5, 10, Deployment Checklist.
- `PARTIAL` and retry/manual rerun behavior: Tasks 5 and 10.
- Cost `0`: Tasks 2 and 5.
- Final AI wait with failure release: Tasks 5, 6, 7.
- Official Escavador untouched: File structure, ADR, and AGENTS guardrails.
- Raw/normalized persistence, duplicate flags, aggregates, `_sourceEscavador2`: Tasks 2, 3, 5, 11.

**Placeholder scan:**

- The plan avoids undefined future work markers and gives concrete file paths, code snippets, commands, and expected outcomes.

**Type consistency:**

- Provider status field is consistently `escavador2EnrichmentStatus`.
- Error field is consistently `escavador2Error`.
- Process array is consistently `escavador2Processos`.
- Dedupe flags are consistently `isDuplicate`, `duplicateOfProvider`, `duplicateOfProcessNumber`, `duplicateMatchStrength`, `isNewEscavador2Finding`, `escavador2DuplicateCount`, `escavador2NewFindingCount`, `escavador2HasNewMaterialRisk`.
- Cost field is consistently `escavador2CostBRL`.
