/**
 * aiOrchestrator.js — Orquestração de chamadas à OpenAI e builders de prompts/payloads
 * Extraído do monolito index.js durante refatoração Phase C
 *
 * Separação de responsabilidades:
 * - Builders de prompts (funções puras)
 * - Handlers de execução (side effects: cache Firestore, chamadas HTTP)
 */

const { FieldValue } = require('firebase-admin/firestore');
const { selectTopProcessos } = require('../helpers/reportHelpers');
const {
  parseAiResponse,
  parseAiHomonymResponse,
  parseAiPrefillResponse,
  parseAiClassificationReviewResponse,
  sanitizeAiOutput,
} = require('./aiParsers');
const { stripUndefined } = require('../helpers/normalize');

/* =========================================================
   Constantes
   ========================================================= */

const AI_MODEL = 'gpt-5.4-nano';
const AI_MAX_TOKENS = 1200;
const AI_MAX_TOKENS_PREFILL = 2400;
const AI_PROMPT_VERSION = 'v3-evidence-based';
const AI_HOMONYM_PROMPT_VERSION = 'v1-homonym-dedicated';
const AI_HOMONYM_CONTEXT_VERSION = 'v1-derived-geo';
const AI_PREFILL_PROMPT_VERSION = 'v1-report-prefill';
const AI_CLASSIFICATION_REVIEW_PROMPT_VERSION = 'v1-autoclassification-review';
const AI_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Cost per 1M tokens (USD)
const AI_COST_INPUT = 0.20;
const AI_COST_OUTPUT = 1.25;

// Circuit breaker state (in-memory per instance)
let _aiCircuitFailures = 0;
let _aiCircuitOpenUntil = 0;
const AI_CIRCUIT_THRESHOLD = 3;
const AI_CIRCUIT_COOLDOWN_MS = 10 * 60 * 1000; // 10 min

const AI_JSON_SCHEMA = {
  resumo: 'string (max 500 chars)',
  inconsistencias: ['string'],
  evidencias: ['string'],
  evidenciasAmbiguas: ['string'],
  incertezas: ['string'],
  cobertura: 'HIGH_COVERAGE|PARTIAL_COVERAGE|LOW_COVERAGE',
  riscoHomonimo: 'ALTO|MEDIO|BAIXO|NENHUM',
  confianca: 'ALTO|MEDIO|BAIXO',
  revisaoManualSugerida: 'boolean',
  sugestaoScore: '0-100',
  sugestaoVeredito: 'FIT|ATTENTION|NOT_RECOMMENDED',
  justificativa: 'string (max 300 chars)',
  alertas: ['string'],
};

const AI_HOMONYM_JSON_SCHEMA = {
  decision: 'LIKELY_MATCH|LIKELY_HOMONYM|UNCERTAIN',
  confidence: 'HIGH|MEDIUM|LOW',
  homonymRisk: 'HIGH|MEDIUM|LOW|NONE',
  justification: 'string (max 300 chars)',
  evidenceFor: ['string'],
  evidenceAgainst: ['string'],
  unknowns: ['string'],
  recommendedAction: 'KEEP|DISCARD|MANUAL_REVIEW',
  processAssessments: [{
    cnj: 'string',
    decision: 'LIKELY_MATCH|LIKELY_HOMONYM|UNCERTAIN',
    reason: 'string',
  }],
};

const AI_PREFILL_JSON_SCHEMA = {
  executiveSummary: 'string (max 900 chars)',
  criminalNotes: 'string (max 2500 chars)',
  laborNotes: 'string (max 1200 chars)',
  warrantNotes: 'string (max 1500 chars)',
  keyFindings: ['string (max 12 items, each max 300 chars)'],
  finalJustification: 'string (max 900 chars)',
};

const AI_CLASSIFICATION_REVIEW_JSON_SCHEMA = {
  summary: 'string (max 700 chars)',
  identityAssessment: {
    status: 'CONFIRMED|ATTENTION|BLOCKED|UNKNOWN',
    rationale: 'string (max 350 chars)',
    homonymRisk: 'LOW|MEDIUM|HIGH|UNKNOWN',
  },
  classificationValidation: {
    criminal: {
      autoFlag: 'NEGATIVE|POSITIVE|INCONCLUSIVE|NOT_FOUND',
      assessment: 'AGREE|AGREE_WITH_CAUTION|DISAGREE|INSUFFICIENT_DATA',
      evidenceStrength: 'STRONG|MIXED|WEAK|INSUFFICIENT',
      rationale: 'string (max 400 chars)',
      possibleErrors: ['string'],
    },
    labor: {
      autoFlag: 'NEGATIVE|POSITIVE|INCONCLUSIVE|NOT_FOUND',
      assessment: 'AGREE|AGREE_WITH_CAUTION|DISAGREE|INSUFFICIENT_DATA',
      evidenceStrength: 'STRONG|MIXED|WEAK|INSUFFICIENT',
      rationale: 'string (max 400 chars)',
      possibleErrors: ['string'],
    },
    warrant: {
      autoFlag: 'NEGATIVE|POSITIVE|INCONCLUSIVE|NOT_FOUND',
      assessment: 'AGREE|AGREE_WITH_CAUTION|DISAGREE|INSUFFICIENT_DATA',
      evidenceStrength: 'STRONG|MIXED|WEAK|INSUFFICIENT',
      rationale: 'string (max 400 chars)',
      possibleErrors: ['string'],
    },
  },
  inconsistencies: ['string'],
  manualReviewPoints: ['string'],
  consultativeSuggestion: {
    action: 'MAINTAIN_AUTOCLASSIFICATION|REVIEW_BEFORE_CONCLUDING|CONTEST_AUTOCLASSIFICATION',
    rationale: 'string (max 400 chars)',
  },
  confidence: 'HIGH|MEDIUM|LOW',
};

const AI_GENERAL_SYSTEM_MESSAGE = `Voce e um analista de compliance especializado em due diligence de pessoas fisicas no Brasil.
Responda EXCLUSIVAMENTE em JSON valido conforme o schema abaixo. Nao inclua texto fora do JSON.
Baseie-se APENAS nos dados fornecidos. Nao invente informacoes.
Se dados insuficientes, indique confianca="BAIXO", preencha incertezas e justifique.
Fatos duros prevalecem: CPF exato em parte, mandado ativo e execucao penal positiva nao podem ser ignorados.

Schema de resposta (JSON):
${JSON.stringify(AI_JSON_SCHEMA, null, 2)}

Regras:
- resumo: analise executiva em ate 500 caracteres
- inconsistencias: lista de divergencias entre dados fornecidos e consultados
- evidencias: fatos objetivos que sustentam a analise
- evidenciasAmbiguas: achados fracos, por nome ou com risco de homonimo
- incertezas: lacunas ou limites dos dados fornecidos
- cobertura: classifique a cobertura das fontes como HIGH_COVERAGE, PARTIAL_COVERAGE ou LOW_COVERAGE
- riscoHomonimo: avalie se ha indicios de homonimia comparando nomes
- confianca: grau de confiabilidade geral dos dados disponiveis
- revisaoManualSugerida: true quando a decisao depender de evidencia fraca, cobertura insuficiente ou divergencia relevante
- sugestaoScore: score de risco 0 (nenhum) a 100 (maximo)
- sugestaoVeredito: FIT=apto | ATTENTION=atencao | NOT_RECOMMENDED=nao recomendado
- justificativa: fundamentacao do veredito em ate 300 caracteres
- alertas: pontos criticos que exigem atencao imediata do analista
- nao cite informacoes que nao estejam nos dados
- diferencie claramente evidencia confirmada, evidencia ambigua e cobertura insuficiente
- se houver analise especializada de homonimos, use-a como insumo consultivo sobre os achados ambiguos e cite-a explicitamente
- O CPF do candidato aparece parcialmente mascarado (ex: 050.***.***-36) por privacidade. Os digitos visiveis (prefixo e sufixo) SAO confirmados e devem ser usados para cruzamento parcial com registros das fontes.
- Quando a auto-classificacao ou os dados indicarem match por CPF exato (hasExactCpfMatch, matchType='CPF confirmado', evidencia 'HARD_FACT'), isso significa que o sistema ja verificou a correspondencia completa do CPF — trate como fato duro confirmado, NAO como incerteza.
- NAO trate o mascaramento do CPF como ausencia de CPF. O CPF existe, foi verificado pelo sistema de enriquecimento, e os achados com CPF confirmado sao do candidato.`;

const AI_HOMONYM_SYSTEM_MESSAGE = `Voce e um analista especializado em desambiguacao de homonimos em due diligence.
Responda EXCLUSIVAMENTE em JSON valido conforme o schema abaixo. Nao inclua texto fora do JSON.
Baseie-se APENAS nos fatos estruturados fornecidos. Nao invente campos, cidades, CPFs ou vinculos.
Se faltar dado, registre isso em unknowns.
Fatos duros prevalecem: CPF exato em parte, mandado ativo e execucao penal positiva nao podem ser relativizados.

Sobre CPF e hardFacts:
- Quando hardFacts incluir JUDIT_EXACT_CPF_MATCH, ESCAVADOR_EXACT_CPF_MATCH ou BDC_EXACT_CPF_MATCH, o candidato TEM CPF confirmado naquela fonte. NAO conclua que o candidato nao possui CPF.
- candidateProfile.cpfConfirmedInProvider=true significa que pelo menos um provider confirmou o CPF por match exato.
- Os ambiguousCandidates sao processos adicionais encontrados por nome ou match fraco — eles NAO invalidam os fatos duros do referenceCandidates.
- O CPF do candidato aparece mascarado (ex: 050.***.***-36) por privacidade. O sistema ja verificou a correspondencia completa — trate como fato duro.

Schema de resposta (JSON):
${JSON.stringify(AI_HOMONYM_JSON_SCHEMA, null, 2)}

Regras:
- decision: LIKELY_MATCH quando os sinais apontam fortemente para o mesmo individuo
- decision: LIKELY_HOMONYM quando os sinais apontam fortemente para homonimo
- decision: UNCERTAIN quando os dados nao forem suficientes
- evidenceFor: fatos que sustentam ser o mesmo individuo
- evidenceAgainst: fatos que sustentam ser homonimo
- unknowns: dados faltantes ou insuficientes
- recommendedAction: KEEP | DISCARD | MANUAL_REVIEW
- processAssessments: avalie apenas os processos mais relevantes e cite o CNJ quando existir
- justification: curta, objetiva e fiel aos dados
- nunca descarte automaticamente um fato duro`;

const AI_PREFILL_SYSTEM_MESSAGE = `Voce e um analista de compliance redator de relatorios finais para due diligence de pessoas fisicas no Brasil.
Sua funcao e transformar os dados estruturados e as analises de IA em textos de pre-preenchimento para revisao do analista humano.
Responda EXCLUSIVAMENTE em JSON valido conforme o schema abaixo. Nao inclua texto fora do JSON.
Baseie-se APENAS nos dados fornecidos. Nao invente fatos, CPFs, tribunais, datas, processos ou conclusoes ausentes.

Schema de resposta (JSON):
${JSON.stringify(AI_PREFILL_JSON_SCHEMA, null, 2)}

Regras:
- executiveSummary: visao DESCRITIVA e consolidada do caso para o relatorio final (max 900 chars). Deve resumir os achados principais, a cobertura das fontes e os riscos identificados. NAO inclua recomendacao ou veredito aqui.
- criminalNotes: texto estruturado sobre processos criminais/penais seguindo este modelo:
  1. Quantidade total e fontes consultadas
  2. Processos confirmados por CPF vs achados apenas por nome (risco de homonimia)
  3. Para cada processo relevante: CNJ, area, status, papel do candidato (reu/testemunha/vitima), tribunal
  4. Decisoes judiciais quando disponiveis
  5. Divergencias entre providers sobre os mesmos processos
  6. Conclusao sobre a materialidade criminal
- laborNotes: texto estruturado sobre processos trabalhistas seguindo este modelo:
  1. Quantidade total e fontes consultadas
  2. Papel predominante (reclamante vs reclamado)
  3. Processos confirmados por CPF vs achados apenas por nome
  4. Conclusao sobre a materialidade trabalhista
- warrantNotes: texto estruturado sobre mandados de prisao e execucoes penais:
  1. Quantidade total e fontes consultadas
  2. Status atual (ativo, cumprido, revogado)
  3. Tipo de mandado e regime
  4. Conclusao sobre risco atual
- keyFindings: lista de achados mais relevantes (max 12, cada um max 300 chars)
- finalJustification: justificativa final consolidada (max 900 chars)`;

const AI_CLASSIFICATION_REVIEW_SYSTEM_MESSAGE = `Voce e um analista senior de compliance revisando a autoclassificacao deterministica de um caso de due diligence de pessoa fisica no Brasil.
Responda EXCLUSIVAMENTE em JSON valido conforme o schema abaixo. Nao inclua texto fora do JSON.
Baseie-se APENAS nos dados fornecidos. Nao invente fatos, CPFs, tribunais, datas ou conclusoes ausentes.

Schema de resposta (JSON):
${JSON.stringify(AI_CLASSIFICATION_REVIEW_JSON_SCHEMA, null, 2)}

Regras:
- summary: resumo executivo do caso em ate 700 caracteres
- identityAssessment: avaliacao da identidade do candidato (CONFIRMED, ATTENTION, BLOCKED, UNKNOWN)
- classificationValidation: validacao da autoclassificacao por eixo (criminal, labor, warrant)
  - autoFlag: flag da autoclassificacao para este eixo
  - assessment: AGREE (concorda), AGREE_WITH_CAUTION (concorda com ressalvas), DISAGREE (discorda), INSUFFICIENT_DATA (dados insuficientes)
  - evidenceStrength: STRONG (evidencia forte), MIXED (mista), WEAK (fraca), INSUFFICIENT (insuficiente)
  - rationale: justificativa em ate 400 caracteres
  - possibleErrors: lista de possiveis erros ou inconsistencias
- inconsistencies: lista de inconsistencias gerais
- manualReviewPoints: pontos que o analista humano deve revisar antes de concluir
- consultativeSuggestion: sugestao consultiva
  - action: MAINTAIN_AUTOCLASSIFICATION (manter autoclassificacao), REVIEW_BEFORE_CONCLUDING (revisar antes de concluir), CONTEST_AUTOCLASSIFICATION (contestar autoclassificacao)
  - rationale: justificativa em ate 400 caracteres
- confidence: grau de confianca da revisao (HIGH, MEDIUM, LOW)`;

/* =========================================================
   Funções puras — utilitários
   ========================================================= */

function compactErrorMessage(message, maxLength = 180) {
  const normalized = String(message || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function extractApiErrorMessage(bodyText) {
  if (!bodyText) return '';
  try {
    const parsed = JSON.parse(bodyText);
    return compactErrorMessage(parsed?.error?.message || parsed?.message || bodyText);
  } catch {
    return compactErrorMessage(bodyText);
  }
}

function formatOpenAiError(status, bodyText) {
  const detail = extractApiErrorMessage(bodyText);

  if (status === 400) {
    if (/context length|maximum context length|max tokens|prompt is too long|too many tokens/i.test(detail)) {
      return `IA rejeitou a solicitacao por excesso de contexto (HTTP 400). ${detail}`;
    }
    return `IA rejeitou a solicitacao (HTTP 400). ${detail || 'Verifique o payload enviado ao provedor.'}`;
  }

  if (status === 401 || status === 403) {
    return `Falha de autenticacao com o provedor de IA (HTTP ${status}).`;
  }

  if (status === 429) {
    return 'IA indisponivel temporariamente por limite de taxa do provedor (HTTP 429).';
  }

  if (status >= 500) {
    return `IA indisponivel temporariamente no provedor (HTTP ${status}).`;
  }

  return `Falha na chamada da IA (HTTP ${status}). ${detail || 'Erro nao detalhado pelo provedor.'}`;
}

function formatAiRuntimeError(error) {
  if (error?.name === 'AbortError') {
    return 'IA excedeu o tempo limite de 30s e nao concluiu a resposta.';
  }
  if (error?.message === 'fetch failed') {
    return 'Falha de rede ao consultar a IA.';
  }
  return compactErrorMessage(error?.message || 'Falha inesperada na analise de IA.') || 'Falha inesperada na analise de IA.';
}

function isDoneOrPartial(status) {
  return status === 'DONE' || status === 'PARTIAL';
}

function computeSimpleHash(value) {
  const crypto = require('crypto');
  const input = String(value || '');
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function computeAiCacheKey(caseData, options = {}) {
  const { kind = 'general', context = null, prompt = null } = options;
  const promptVersion = kind === 'homonym'
    ? AI_HOMONYM_PROMPT_VERSION
    : kind === 'classificationReview'
      ? AI_CLASSIFICATION_REVIEW_PROMPT_VERSION
      : kind === 'prefill'
        ? AI_PREFILL_PROMPT_VERSION
        : AI_PROMPT_VERSION;

  const basePayload = {
    model: AI_MODEL,
    kind,
    promptVersion,
    contextVersion: kind === 'homonym' ? AI_HOMONYM_CONTEXT_VERSION : null,
    prompt: prompt || '',
    context: context || null,
  };

  return `ai_${kind}_${computeSimpleHash(JSON.stringify(basePayload))}`;
}

function estimateAiCostUsd(inputTokens, outputTokens) {
  return (inputTokens / 1_000_000) * AI_COST_INPUT + (outputTokens / 1_000_000) * AI_COST_OUTPUT;
}

function getAiProvidersIncluded(caseData) {
  return [
    isDoneOrPartial(caseData.enrichmentStatus) ? 'FonteData' : null,
    isDoneOrPartial(caseData.escavadorEnrichmentStatus) ? 'Escavador' : null,
    isDoneOrPartial(caseData.juditEnrichmentStatus) ? 'Judit' : null,
    isDoneOrPartial(caseData.bigdatacorpEnrichmentStatus) ? 'BigDataCorp' : null,
  ].filter(Boolean);
}

function maskCpfForAi(cpf, fallback = null) {
  const d = String(cpf || '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4');
  return fallback || null;
}

function compactJuditRoleSummary(items = []) {
  return (Array.isArray(items) ? items : []).slice(0, 12).map((item) => stripUndefined({
    code: item.code || null,
    area: item.area || null,
    status: item.status || null,
    phase: item.phase || null,
    tribunal: item.tribunalAcronym || item.tribunal || null,
    personType: item.personType || null,
    side: item.side || null,
    hasExactCpfMatch: item.hasExactCpfMatch === true,
    hasDivergentCpf: item.hasDivergentCpf === true,
    isCriminal: item.isCriminal === true,
    isLabor: item.isLabor === true,
    isDefendant: item.isDefendant === true,
    isPlaintiff: item.isPlaintiff === true,
    isVictim: item.isVictim === true,
    isWitness: item.isWitness === true,
    isPossibleHomonym: item.isPossibleHomonym === true,
    subjects: Array.isArray(item.subjects) ? item.subjects.slice(0, 4) : [],
    classifications: Array.isArray(item.classifications) ? item.classifications.slice(0, 3) : [],
    lastStepDate: item.lastStepDate || null,
    lastStep: item.lastStep ? String(item.lastStep).slice(0, 220) : null,
  }));
}

function compactBigDataCorpProcessos(items = []) {
  return (Array.isArray(items) ? items : []).slice(0, 12).map((item) => stripUndefined({
    numero: item.numero || null,
    tipo: item.tipo || null,
    assunto: item.assunto || item.cnjSubject || null,
    courtType: item.courtType || null,
    courtName: item.courtName || null,
    status: item.status || null,
    isDirectCpfMatch: item.isDirectCpfMatch === true,
    matchType: item.matchType || null,
    polo: item.polo || null,
    partyType: item.partyType || null,
    specificRole: item.specificRole || null,
    isCriminal: item.isCriminal === true,
    isLabor: item.isLabor === true,
    isDefendant: item.isDefendant === true,
    isPlaintiff: item.isPlaintiff === true,
    isVictim: item.isVictim === true,
    isLawyer: item.isLawyer === true,
    cnjProcedure: item.cnjProcedure || null,
    decisions: Array.isArray(item.decisions)
      ? item.decisions.slice(0, 2).map((decision) => ({
        date: decision.date || null,
        content: decision.content ? String(decision.content).slice(0, 220) : null,
      }))
      : [],
  }));
}

function compactEscavadorProcessos(items = []) {
  return (Array.isArray(items) ? items : []).slice(0, 10).map((item) => stripUndefined({
    numeroCnj: item.numeroCnj || item.cnj || null,
    area: item.area || null,
    tribunal: item.tribunalSigla || item.tribunal || null,
    tipoNormalizado: item.tipoNormalizado || null,
    polo: item.polo || null,
    hasExactCpfMatch: item.hasExactCpfMatch === true,
    matchDocumentoPor: item.matchDocumentoPor || item.matchType || null,
    isCriminal: item.isCriminal === true,
    isLabor: item.isLabor === true,
  }));
}

function compactDjenComunicacoes(items = []) {
  return (Array.isArray(items) ? items : []).slice(0, 10).map((item) => stripUndefined({
    area: item.area || item.inferredArea || null,
    classe: item.classe || null,
    tribunal: item.tribunal || null,
    polo: item.polo || null,
    isDefendant: item.isDefendant === true,
    confirmationLevel: item.confirmationLevel || null,
    probabilityScore: item.probabilityScore ?? null,
    geoMatch: item.geoMatch ?? null,
    matchType: item.matchType || null,
    numeroProcessoMascara: item.numeroProcessoMascara || null,
  }));
}

function countItems(value) {
  return Array.isArray(value) ? value.length : Number(value || 0);
}

function isNegativeFlag(flag) {
  return ['NEGATIVE', 'NOT_FOUND'].includes(String(flag || '').toUpperCase());
}

function isPositiveFlag(flag) {
  return String(flag || '').toUpperCase() === 'POSITIVE';
}

function buildReviewSource(name, status, findingCount, options = {}) {
  const normalizedStatus = status || null;
  const count = countItems(findingCount);
  return stripUndefined({
    name,
    status: normalizedStatus,
    findingCount: count,
    isWeak: options.isWeak === true,
    isDone: normalizedStatus === 'DONE',
    isPartial: normalizedStatus === 'PARTIAL',
    isFailed: ['FAILED', 'BLOCKED'].includes(normalizedStatus),
    isSkipped: normalizedStatus === 'SKIPPED',
    isZeroFinding: normalizedStatus === 'DONE' && count === 0,
    hasFinding: count > 0,
  });
}

function summarizeAxisCoverage(sources) {
  const queriedSources = sources.filter((source) => source.status && !['PENDING', 'RUNNING'].includes(source.status));
  const successfulSources = queriedSources.filter((source) => source.isDone);
  const partialSources = queriedSources.filter((source) => source.isPartial);
  const failedSources = queriedSources.filter((source) => source.isFailed);
  const zeroFindingSources = successfulSources
    .filter((source) => source.isZeroFinding)
    .map((source) => source.name);
  const materialFindingSources = queriedSources
    .filter((source) => source.hasFinding && !source.isWeak)
    .map((source) => source.name);
  const weakFindingSources = queriedSources
    .filter((source) => source.hasFinding && source.isWeak)
    .map((source) => source.name);
  const sourceCoverageStatus = failedSources.length > 0 || partialSources.length > 0
    ? 'PARTIAL'
    : successfulSources.length > 0
      ? 'COMPLETE'
      : 'UNKNOWN';

  return {
    sourceCoverageStatus,
    queriedSources: queriedSources.map((source) => source.name),
    zeroFindingSources,
    failedSources: failedSources.map((source) => source.name),
    partialSources: partialSources.map((source) => source.name),
    materialFindingSources,
    weakFindingSources,
  };
}

function buildAxisReviewContext(axis, autoFlag, sources, options = {}) {
  const coverage = summarizeAxisCoverage(sources);
  const hasMaterialFinding = coverage.materialFindingSources.length > 0 || options.hasMaterialFinding === true;
  const hasWeakNameOnlyFinding = coverage.weakFindingSources.length > 0 || options.hasWeakNameOnlyFinding === true;
  const hasProviderConflict = options.hasProviderConflict === true;
  const reasons = [
    coverage.sourceCoverageStatus === 'PARTIAL' ? 'Fonte relevante falhou ou retornou resultado parcial.' : null,
    coverage.sourceCoverageStatus === 'UNKNOWN' ? 'Nenhuma fonte concluida para este eixo.' : null,
    hasProviderConflict ? 'Fontes divergem sobre achado material deste eixo.' : null,
    options.hasAmbiguousRole ? 'Papel processual exige confirmacao manual.' : null,
    options.hasHomonymRisk ? 'Achado por nome ou risco de homonimo exige revisao.' : null,
    String(autoFlag || '').includes('INCONCLUSIVE') ? 'A flag final esta inconclusiva.' : null,
  ].filter(Boolean);

  return stripUndefined({
    axis,
    autoFlag: autoFlag || null,
    sourceCoverageStatus: coverage.sourceCoverageStatus,
    queriedSources: coverage.queriedSources,
    zeroFindingSources: coverage.zeroFindingSources,
    failedSources: coverage.failedSources,
    partialSources: coverage.partialSources,
    hasMaterialFinding,
    hasWeakNameOnlyFinding,
    hasProviderConflict,
    hasAmbiguousRole: options.hasAmbiguousRole === true,
    hasHomonymRisk: options.hasHomonymRisk === true,
    shouldRequireCaution: reasons.length > 0,
    cautionReason: reasons[0] || null,
  });
}

function hasCriminalLowRiskRoleOnly(caseData = {}) {
  const roles = Array.isArray(caseData.juditRoleSummary) ? caseData.juditRoleSummary : [];
  const criminalRoles = roles.filter((item) => item?.isCriminal === true || /penal|criminal/i.test(String(item?.area || '')));
  if (criminalRoles.length === 0) return false;
  return criminalRoles.every((item) => item?.isVictim === true || item?.isWitness === true || item?.isDefendant === false);
}

function isGenericCautionText(text) {
  const normalized = String(text || '').toLowerCase();
  return /cobertura parcial|detalhamento alem do retornado|pode esconder achados|outra base|revisar cobertura|dados insuficientes/.test(normalized);
}

function applyAxisReviewGuardrail(axis, context) {
  if (!axis || typeof axis !== 'object') return axis;
  const next = { ...axis };
  const negativeWellSupported = isNegativeFlag(next.autoFlag)
    && context?.sourceCoverageStatus === 'COMPLETE'
    && context?.hasMaterialFinding !== true
    && context?.shouldRequireCaution !== true;

  if (negativeWellSupported) {
    next.assessment = 'AGREE';
    next.evidenceStrength = context.zeroFindingSources?.length > 0 ? 'STRONG' : 'MIXED';
    next.possibleErrors = [];
    if (!next.rationale || isGenericCautionText(next.rationale)) {
      const sourceText = context.zeroFindingSources?.length > 0
        ? ` nas fontes consultadas (${context.zeroFindingSources.join(', ')})`
        : ' nas fontes consultadas';
      next.rationale = `Nao ha achado material${sourceText}. A ausencia de retorno nessas fontes sustenta a flag negativa.`;
    }
  }

  if (!context?.shouldRequireCaution && Array.isArray(next.possibleErrors)) {
    next.possibleErrors = next.possibleErrors.filter((item) => !isGenericCautionText(item));
  }

  return next;
}

function applyAiClassificationReviewGuardrails(review, caseData = {}) {
  if (!review || typeof review !== 'object') return review;
  const context = buildAiClassificationReviewContext(caseData);
  const validation = review.classificationValidation || {};
  const guarded = {
    ...review,
    classificationValidation: {
      ...validation,
      criminal: applyAxisReviewGuardrail(validation.criminal, context.criminal),
      labor: applyAxisReviewGuardrail(validation.labor, context.labor),
      warrant: applyAxisReviewGuardrail(validation.warrant, context.warrant),
    },
  };
  const axes = Object.values(guarded.classificationValidation || {});
  const needsReview = axes.some((axis) => ['AGREE_WITH_CAUTION', 'DISAGREE', 'INSUFFICIENT_DATA'].includes(axis?.assessment));
  if (!needsReview && guarded.consultativeSuggestion?.action === 'REVIEW_BEFORE_CONCLUDING') {
    guarded.consultativeSuggestion = {
      action: 'MAINTAIN_AUTOCLASSIFICATION',
      rationale: 'Nao ha ressalva material por eixo nos dados estruturados disponiveis.',
    };
  }
  return guarded;
}

/* =========================================================
   Funções puras — builders de prompts
   ========================================================= */

function buildAiPrompt(caseData) {
  const enrichmentIdentity = caseData.enrichmentIdentity;
  const parts = [
    '--- DADOS DO CANDIDATO ---',
    `Nome informado: ${caseData.candidateName || 'N/A'}`,
    `CPF: ${(caseData.cpf || '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4')}`,
    `Cargo pretendido: ${caseData.candidatePosition || 'N/A'}`,
    `UF contratacao: ${caseData.hiringUf || 'N/A'}`,
  ];

  if (enrichmentIdentity) {
    parts.push('', '--- RECEITA FEDERAL ---');
    parts.push(`Nome RF: ${enrichmentIdentity.name || 'N/A'}`);
    parts.push(`Situacao cadastral: ${enrichmentIdentity.cpfStatus || 'N/A'}`);
    parts.push(`Data nascimento: ${enrichmentIdentity.birthDate || 'N/A'}`);
  }

  const juditIdentity = caseData.juditIdentity;
  if (juditIdentity) {
    parts.push('', '--- JUDIT IDENTIDADE (GATE) ---');
    parts.push(`Nome: ${juditIdentity.name || 'N/A'}`);
    parts.push(`CPF ativo: ${juditIdentity.cpfActive ? 'SIM' : 'NAO'}`);
    parts.push(`Data nascimento: ${juditIdentity.birthDate || 'N/A'}`);
    parts.push(`Genero: ${juditIdentity.gender || 'N/A'}`);
    parts.push(`Nacionalidade: ${juditIdentity.nationality || 'N/A'}`);
  }

  const fdPhases = ['identity', 'criminal', 'warrant', 'labor'];
  for (const key of fdPhases) {
    const src = caseData.enrichmentSources?.[key];
    if (!src || src.error) continue;
    parts.push('', `--- FONTEDATA ${key.toUpperCase()} ---`);
    const prefix = `fontedata${key.charAt(0).toUpperCase() + key.slice(1)}`;
    for (const [field, value] of Object.entries(caseData)) {
      if (!field.startsWith(prefix) && !field.startsWith(`${key}Flag`) && !field.startsWith(`${key}Notes`)) continue;
      if (field.endsWith('_source') || value === undefined || value === null || value === '') continue;
      const display = typeof value === 'string' && value.length > 500 ? value.slice(0, 500) + '...' : value;
      parts.push(`${field}: ${typeof display === 'object' ? JSON.stringify(display) : display}`);
    }
  }

  if (caseData.escavadorEnrichmentStatus === 'DONE' || caseData.escavadorEnrichmentStatus === 'PARTIAL') {
    parts.push('', '--- ESCAVADOR ---');
    parts.push(`Total processos: ${caseData.escavadorProcessTotal || 0}`);
    parts.push(`Criminal: ${caseData.escavadorCriminalFlag || 'NEGATIVE'} (${caseData.escavadorCriminalCount || 0})`);
    if (caseData.escavadorCpfsComEsseNome != null) parts.push(`CPFs com este nome: ${caseData.escavadorCpfsComEsseNome}`);
    if (caseData.escavadorNotes) parts.push(`Resumo: ${caseData.escavadorNotes.slice(0, 500)}`);
  }

  if (caseData.juditEnrichmentStatus === 'DONE' || caseData.juditEnrichmentStatus === 'PARTIAL') {
    parts.push('', '--- JUDIT ---');
    if (caseData.juditProcessTotal != null) parts.push(`Total processos: ${caseData.juditProcessTotal}`);
    parts.push(`Criminal: ${caseData.juditCriminalFlag || 'NEGATIVE'} (${caseData.juditCriminalCount || 0})`);
    parts.push(`Mandado: ${caseData.juditWarrantFlag || 'NEGATIVE'} (ativos: ${caseData.juditActiveWarrantCount || 0})`);
    if (caseData.juditExecutionFlag) parts.push(`Execucao penal: ${caseData.juditExecutionFlag} (${caseData.juditExecutionCount || 0})`);
    if (caseData.juditHomonymFlag) parts.push('ALERTA HOMONIMO: sim');
  }

  if (caseData.bigdatacorpEnrichmentStatus === 'DONE' || caseData.bigdatacorpEnrichmentStatus === 'PARTIAL') {
    parts.push('', '--- BIGDATACORP ---');
    parts.push(`Nome BDC: ${caseData.bigdatacorpName || 'N/A'}`);
    if (caseData.bigdatacorpNameUniqueness != null) parts.push(`Unicidade do nome: ${caseData.bigdatacorpNameUniqueness}`);
    if (caseData.bigdatacorpHasDeathRecord) parts.push('ALERTA: indicacao de obito na Receita Federal.');
    parts.push(`Total processos: ${caseData.bigdatacorpProcessTotal || 0}`);
    parts.push(`Criminal: ${caseData.bigdatacorpCriminalFlag || 'NEGATIVE'} (${caseData.bigdatacorpCriminalCount || 0})`);
    parts.push(`Trabalhista: ${caseData.bigdatacorpLaborFlag || 'NEGATIVE'} (${caseData.bigdatacorpLaborCount || 0})`);
    if (caseData.bigdatacorpIsPep) parts.push(`PEP: SIM (nivel: ${caseData.bigdatacorpPepLevel || 'N/A'})`);
    if (caseData.bigdatacorpIsSanctioned) parts.push(`SANCIONADO ATUALMENTE: ${caseData.bigdatacorpSanctionCount || 0} sancao(oes)`);
    else if (caseData.bigdatacorpWasSanctioned) parts.push(`Historico de sancao: ${caseData.bigdatacorpSanctionCount || 0} (nao ativa)`);
    if (caseData.bigdatacorpSanctionTypes?.length) parts.push(`Tipos de sancao: ${caseData.bigdatacorpSanctionTypes.join(', ')}`);
    const bdcWarrants = Array.isArray(caseData.bigdatacorpActiveWarrants) ? caseData.bigdatacorpActiveWarrants : [];
    if (bdcWarrants.length > 0) {
      parts.push(`MANDADOS BDC: ${bdcWarrants.length} mandado(s) ativo(s)`);
      bdcWarrants.slice(0, 3).forEach((w, i) => {
        const wParts = [w.processNumber, w.status, w.imprisonmentKind, w.magistrate, w.agency].filter(Boolean);
        parts.push(`  Mandado ${i + 1}: ${wParts.join(' | ')}`);
        if (w.decision) parts.push(`  Decisao: ${w.decision.slice(0, 300)}`);
      });
    }
    const bdcCrim = (caseData.bigdatacorpProcessos || []).filter(p => p.isCriminal);
    if (bdcCrim.length > 0) {
      parts.push(`Processos criminais BDC: ${bdcCrim.length}`);
      bdcCrim.slice(0, 3).forEach((p, i) => {
        const pParts = [p.numero, p.cnjSubject || p.assunto, p.specificRole, p.status].filter(Boolean);
        parts.push(`  Criminal ${i + 1}: ${pParts.join(' | ')}`);
        if (p.decisions?.length > 0) {
          p.decisions.slice(0, 2).forEach(d => {
            parts.push(`    Decisao (${d.date || 'N/A'}): ${d.content.slice(0, 200)}`);
          });
        }
      });
    }
    if (caseData.bigdatacorpProcessNotes) parts.push(`Resumo processos: ${caseData.bigdatacorpProcessNotes.slice(0, 500)}`);
    if (caseData.bigdatacorpKycNotes) parts.push(`KYC: ${caseData.bigdatacorpKycNotes.slice(0, 300)}`);
  }

  const topProcessos = selectTopProcessos(caseData, 10);
  if (topProcessos.length > 0) {
    parts.push('', '--- TOP PROCESSOS DETALHADOS ---');
    for (const p of topProcessos) {
      const extras = [p.matchType, p.specificRole, p.decisionSummary ? `Decisao: ${p.decisionSummary}` : null].filter(Boolean);
      parts.push(`${p.cnj} | ${p.area} | ${p.status} | ${p.polo} | ${p.tribunal} | ${p.data} | Fonte: ${p.fonte}${extras.length ? ` | ${extras.join(' | ')}` : ''}`);
    }
  }

  const warrants = caseData.juditWarrants || [];
  if (warrants.length > 0) {
    parts.push('', '--- MANDADOS DE PRISAO ---');
    for (const w of warrants.slice(0, 5)) {
      const wParts = [w.code, w.warrantType, w.arrestType, w.status, w.tribunalAcronym, w.issueDate].filter(Boolean);
      parts.push(wParts.join(' | '));
    }
  }

  const executions = caseData.juditExecutions || [];
  if (executions.length > 0) {
    parts.push('', '--- EXECUCOES PENAIS ---');
    for (const e of executions.slice(0, 5)) {
      const eParts = [e.code, e.name, e.status, e.regime, e.tribunalAcronym].filter(Boolean);
      parts.push(eParts.join(' | '));
    }
  }

  if (caseData.criminalFlag) parts.push('', '--- AUTO-CLASSIFICACAO ---',
    `Criminal: ${caseData.criminalFlag}`,
    `Mandado: ${caseData.warrantFlag || 'N/A'}`,
    `Trabalhista: ${caseData.laborFlag || 'N/A'}`,
    `PEP: ${caseData.pepFlag || 'N/A'}`,
    `Sancoes: ${caseData.sanctionFlag || 'N/A'}`);
  if (caseData.coverageLevel) parts.push(`Cobertura das fontes: ${caseData.coverageLevel}`);
  if (caseData.providerDivergence) parts.push(`Divergencia entre providers: ${caseData.providerDivergence}`);
  if (caseData.criminalEvidenceQuality) parts.push(`Qualidade da evidencia criminal: ${caseData.criminalEvidenceQuality}`);
  if (Array.isArray(caseData.coverageNotes) && caseData.coverageNotes.length > 0) {
    parts.push(`Notas de cobertura: ${caseData.coverageNotes.join(' | ')}`);
  }
  if (Array.isArray(caseData.ambiguityNotes) && caseData.ambiguityNotes.length > 0) {
    parts.push(`Achados ambiguos: ${caseData.ambiguityNotes.join(' | ')}`);
  }
  if (caseData.criminalNotes) parts.push(`Notas criminal: ${caseData.criminalNotes.slice(0, 300)}`);
  if (caseData.warrantNotes) parts.push(`Notas mandado: ${caseData.warrantNotes.slice(0, 300)}`);
  if (caseData.laborNotes) parts.push(`Notas trabalhista: ${caseData.laborNotes.slice(0, 300)}`);

  if (caseData.aiHomonymStructuredOk && caseData.aiHomonymStructured) {
    parts.push('', '--- ANALISE ESPECIALIZADA DE HOMONIMOS (CONSULTIVA) ---');
    parts.push(`Decisao: ${caseData.aiHomonymStructured.decision || 'N/A'}`);
    parts.push(`Confianca: ${caseData.aiHomonymStructured.confidence || 'N/A'}`);
    parts.push(`Risco de homonimo: ${caseData.aiHomonymStructured.homonymRisk || 'N/A'}`);
    if (caseData.aiHomonymStructured.justification) parts.push(`Justificativa: ${caseData.aiHomonymStructured.justification}`);
    if (caseData.aiHomonymStructured.evidenceFor?.length) parts.push(`Evidencias a favor: ${caseData.aiHomonymStructured.evidenceFor.join(' | ')}`);
    if (caseData.aiHomonymStructured.evidenceAgainst?.length) parts.push(`Evidencias contra: ${caseData.aiHomonymStructured.evidenceAgainst.join(' | ')}`);
    if (caseData.aiHomonymStructured.unknowns?.length) parts.push(`Incertezas: ${caseData.aiHomonymStructured.unknowns.join(' | ')}`);
    if (caseData.aiHomonymStructured.recommendedAction) parts.push(`Acao recomendada: ${caseData.aiHomonymStructured.recommendedAction}`);
  }

  parts.push('', 'Analise todos os dados acima e responda EXCLUSIVAMENTE no JSON conforme o schema solicitado.');
  parts.push('Sempre justifique com fatos observaveis, registre evidencias e incertezas, e nao invente dados ausentes.');
  return parts.join('\n');
}

function buildAiHomonymPrompt(homonymInput) {
  const payload = {
    contextVersion: AI_HOMONYM_CONTEXT_VERSION,
    analysisTarget: homonymInput.analysisTarget,
    candidateProfile: homonymInput.candidateProfile,
    providerCoverage: homonymInput.providerCoverage,
    ambiguityReasons: homonymInput.ambiguityReasons,
    hardFacts: homonymInput.hardFacts,
    ambiguousCandidates: (homonymInput.ambiguousCandidates || []).slice(0, 12),
    referenceCandidates: (homonymInput.referenceCandidates || []).slice(0, 8),
    totalCandidatesAnalyzed: homonymInput.processCandidates?.length || 0,
  };

  return [
    'Avalie APENAS a evidencia ambigua abaixo.',
    'A tarefa nao e reavaliar o caso inteiro: voce deve decidir se os achados ambiguos por nome ou match fraco parecem do mesmo individuo ou de homonimos.',
    'Use APENAS o contexto estruturado abaixo.',
    'Se faltar dado para decidir, retorne UNCERTAIN e explique em unknowns.',
    'referenceCandidates e hardFacts sao contexto de apoio e NAO devem ser descartados.',
    'Nao relativize fatos duros como CPF exato em parte, mandado ativo ou execucao penal positiva.',
    '',
    JSON.stringify(payload, null, 2),
  ].join('\n');
}

function buildAiPrefillPrompt(caseData) {
  const juditWarrants = (caseData.juditWarrants || []).slice(0, 6).map((item) => ({
    code: item.code || null,
    status: item.status || null,
    court: item.court || item.tribunalAcronym || null,
    processNumber: item.processNumber || null,
    issueDate: item.issueDate || null,
    warrantType: item.warrantType || null,
    arrestType: item.arrestType || null,
  }));
  const juditExecutions = (caseData.juditExecutions || []).slice(0, 4).map((item) => ({
    processNumber: item.processNumber || item.code || null,
    status: item.status || null,
    court: item.court || item.tribunalAcronym || null,
    phase: item.phase || null,
    source: item.source || 'Judit',
  }));
  const promptPayload = {
    candidate: {
      name: caseData.candidateName || null,
      cpfMasked: (caseData.cpf || '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4') || caseData.cpfMasked || null,
      position: caseData.candidatePosition || null,
      hiringUf: caseData.hiringUf || null,
    },
    caseContext: {
      status: caseData.status || null,
      tenantName: caseData.tenantName || null,
    },
    classification: {
      criminalFlag: caseData.criminalFlag || null,
      criminalSeverity: caseData.criminalSeverity || null,
      laborFlag: caseData.laborFlag || null,
      laborSeverity: caseData.laborSeverity || null,
      warrantFlag: caseData.warrantFlag || null,
      pepFlag: caseData.pepFlag || null,
      sanctionFlag: caseData.sanctionFlag || null,
      riskScore: caseData.riskScore ?? null,
      riskLevel: caseData.riskLevel || null,
      finalVerdict: caseData.finalVerdict || caseData.aiStructured?.sugestaoVeredito || null,
      reviewRecommended: caseData.reviewRecommended || false,
    },
    coverage: {
      coverageLevel: caseData.coverageLevel || null,
      coverageNotes: caseData.coverageNotes || [],
      providerDivergence: caseData.providerDivergence || null,
      ambiguityNotes: caseData.ambiguityNotes || [],
      criminalEvidenceQuality: caseData.criminalEvidenceQuality || null,
    },
    aiStructured: caseData.aiStructured || null,
    aiHomonymStructured: caseData.aiHomonymStructuredOk ? caseData.aiHomonymStructured : null,
    currentPhaseNotes: {
      criminalNotes: caseData.criminalNotes || null,
      laborNotes: caseData.laborNotes || null,
      warrantNotes: caseData.warrantNotes || null,
    },
    judit: {
      roleSummary: (caseData.juditRoleSummary || []).slice(0, 10),
      warrants: juditWarrants,
      executions: juditExecutions,
    },
    escavador: {
      totalProcessos: caseData.escavadorProcessTotal || 0,
      processos: (caseData.escavadorProcessos || []).slice(0, 10),
    },
    fontedata: {
      criminalFlag: caseData.fontedataCriminalFlag || null,
      criminalNotes: caseData.fontedataCriminalNotes || null,
      laborFlag: caseData.fontedataLaborFlag || null,
      laborNotes: caseData.fontedataLaborNotes || null,
      warrantFlag: caseData.fontedataWarrantFlag || null,
      warrantNotes: caseData.fontedataWarrantNotes || null,
    },
    bigdatacorp: {
      totalProcessos: caseData.bigdatacorpProcessTotal || 0,
      criminalFlag: caseData.bigdatacorpCriminalFlag || null,
      laborFlag: caseData.bigdatacorpLaborFlag || null,
      nameUniqueness: caseData.bigdatacorpNameUniqueness ?? null,
      hasDeathRecord: caseData.bigdatacorpHasDeathRecord || false,
      isPep: caseData.bigdatacorpIsPep || false,
      pepLevel: caseData.bigdatacorpPepLevel || null,
      pepDetails: (caseData.bigdatacorpPepDetails || []).slice(0, 3),
      isSanctioned: caseData.bigdatacorpIsSanctioned || false,
      sanctionCount: caseData.bigdatacorpSanctionCount || 0,
      sanctionTypes: caseData.bigdatacorpSanctionTypes || [],
      sanctionSources: caseData.bigdatacorpSanctionSources || [],
      sanctionDetails: (caseData.bigdatacorpSanctionDetails || []).slice(0, 5),
      activeWarrants: (caseData.bigdatacorpActiveWarrants || []).slice(0, 5),
      processos: (caseData.bigdatacorpProcessos || []).slice(0, 10),
      professionNotes: caseData.bigdatacorpProfessionNotes || null,
    },
  };

  return [
    'Monte textos de pre-preenchimento para o formulario final do analista.',
    'Os textos devem aproveitar a analise de homonimos, cobertura, divergencia entre providers e os detalhes dos processos/mandados quando isso for material.',
    'Nao invente fatos. Nao use linguagem de debug.',
    'Quando houver ambiguidade, explicite a ambiguidade. Quando houver fato duro confirmado, explicite o fato duro.',
    '',
    JSON.stringify(promptPayload, null, 2),
  ].join('\n');
}

function buildAiClassificationReviewContext(caseData = {}) {
  const criminalJuditCount = countItems(caseData.juditCriminalCount);
  const criminalBdcCount = countItems(caseData.bigdatacorpCriminalCount || caseData.bigdatacorpDirectCriminalCount);
  const criminalEscavadorCount = countItems(caseData.escavadorCriminalCount);
  const criminalDjenCount = (Array.isArray(caseData.djenComunicacoes) ? caseData.djenComunicacoes : [])
    .filter((item) => isPositiveFlag(caseData.djenCriminalFlag) || /penal|criminal/i.test(String(item?.area || item?.inferredArea || '')))
    .length;
  const laborBdcCount = countItems(caseData.bigdatacorpLaborCount || caseData.bigdatacorpDirectLaborCount);
  const laborEscavadorCount = (Array.isArray(caseData.escavadorProcessos) ? caseData.escavadorProcessos : [])
    .filter((item) => item?.isLabor === true || /trabalh/i.test(String(item?.area || item?.tribunal || '')))
    .length;
  const laborDjenCount = (Array.isArray(caseData.djenComunicacoes) ? caseData.djenComunicacoes : [])
    .filter((item) => isPositiveFlag(caseData.djenLaborFlag) || /trabalh/i.test(String(item?.area || item?.inferredArea || item?.classe || '')))
    .length;
  const bdcWarrantCount = countItems(caseData.bigdatacorpActiveWarrants);
  const juditWarrantCount = countItems(caseData.juditActiveWarrantCount || (caseData.juditWarrants || []).filter((item) => /ativo|active/i.test(String(item?.status || ''))));

  const criminalConflict = (isPositiveFlag(caseData.juditCriminalFlag) && isNegativeFlag(caseData.bigdatacorpCriminalFlag))
    || (isPositiveFlag(caseData.bigdatacorpCriminalFlag) && isNegativeFlag(caseData.juditCriminalFlag));
  const laborConflict = isPositiveFlag(caseData.bigdatacorpLaborFlag) && isNegativeFlag(caseData.laborFlag);
  const warrantConflict = (bdcWarrantCount > 0 || juditWarrantCount > 0) && isNegativeFlag(caseData.warrantFlag);
  const lowRiskCriminalOnly = hasCriminalLowRiskRoleOnly(caseData);

  return {
    criminal: buildAxisReviewContext('criminal', caseData.criminalFlag, [
      buildReviewSource('Judit', caseData.juditEnrichmentStatus, criminalJuditCount),
      buildReviewSource('BigDataCorp', caseData.bigdatacorpEnrichmentStatus, criminalBdcCount),
      buildReviewSource('Escavador', caseData.escavadorEnrichmentStatus, criminalEscavadorCount),
      buildReviewSource('DJEN', caseData.djenEnrichmentStatus, criminalDjenCount, { isWeak: true }),
    ], {
      hasMaterialFinding: (criminalJuditCount > 0 || criminalBdcCount > 0 || criminalEscavadorCount > 0) && !lowRiskCriminalOnly,
      hasProviderConflict: criminalConflict,
      hasAmbiguousRole: lowRiskCriminalOnly && criminalConflict,
      hasHomonymRisk: caseData.aiHomonymRisk === 'HIGH' || caseData.aiHomonymStructured?.homonymRisk === 'HIGH',
    }),
    labor: buildAxisReviewContext('labor', caseData.laborFlag, [
      buildReviewSource('BigDataCorp', caseData.bigdatacorpEnrichmentStatus, laborBdcCount),
      buildReviewSource('Escavador', caseData.escavadorEnrichmentStatus, laborEscavadorCount),
      buildReviewSource('DJEN', caseData.djenEnrichmentStatus, laborDjenCount, { isWeak: true }),
    ], {
      hasProviderConflict: laborConflict,
    }),
    warrant: buildAxisReviewContext('warrant', caseData.warrantFlag, [
      buildReviewSource('Judit', caseData.juditEnrichmentStatus, juditWarrantCount),
      buildReviewSource('BigDataCorp', caseData.bigdatacorpEnrichmentStatus, bdcWarrantCount),
    ], {
      hasProviderConflict: warrantConflict,
    }),
    identity: {
      status: caseData.bigdatacorpGateResult?.passed === false || caseData.juditGateResult?.passed === false || caseData.enrichmentGateResult?.passed === false
        ? 'BLOCKED'
        : caseData.juditIdentity || caseData.enrichmentIdentity || caseData.bigdatacorpName ? 'CONFIRMED' : 'UNKNOWN',
      hasHomonymRisk: ['HIGH', 'MEDIUM'].includes(caseData.aiHomonymRisk || caseData.aiHomonymStructured?.homonymRisk),
    },
  };
}

function buildAiClassificationReviewPrompt(caseData) {
  const reviewContext = buildAiClassificationReviewContext(caseData);
  const promptPayload = {
    promptVersion: AI_CLASSIFICATION_REVIEW_PROMPT_VERSION,
    candidate: {
      name: caseData.candidateName || null,
      cpfMasked: maskCpfForAi(caseData.cpf, caseData.cpfMasked),
      position: caseData.candidatePosition || null,
      hiringUf: caseData.hiringUf || null,
    },
    identity: {
      judit: caseData.juditIdentity ? {
        name: caseData.juditIdentity.name || null,
        cpfActive: caseData.juditIdentity.cpfActive ?? null,
        birthDate: caseData.juditIdentity.birthDate || null,
        primaryUf: caseData.juditPrimaryUf || null,
      } : null,
      receitaFederal: caseData.enrichmentIdentity ? {
        name: caseData.enrichmentIdentity.name || null,
        cpfStatus: caseData.enrichmentIdentity.cpfStatus || null,
        birthDate: caseData.enrichmentIdentity.birthDate || null,
        hasDeathRecord: caseData.enrichmentIdentity.hasDeathRecord || false,
      } : null,
      bigdatacorp: {
        name: caseData.bigdatacorpName || null,
        cpfStatus: caseData.bigdatacorpCpfStatus || null,
        birthDate: caseData.bigdatacorpBirthDate || null,
        nameUniqueness: caseData.bigdatacorpNameUniqueness ?? null,
        namesakeCount: caseData.bigdatacorpNamesakeCount ?? null,
        hasDeathRecord: caseData.bigdatacorpHasDeathRecord || false,
      },
      gate: {
        bigdatacorp: caseData.bigdatacorpGateResult || null,
        judit: caseData.juditGateResult || null,
        fallback: caseData.enrichmentGateResult || null,
      },
    },
    autoClassification: {
      criminalFlag: caseData.criminalFlag || null,
      criminalSeverity: caseData.criminalSeverity || null,
      laborFlag: caseData.laborFlag || null,
      laborSeverity: caseData.laborSeverity || null,
      warrantFlag: caseData.warrantFlag || null,
      pepFlag: caseData.pepFlag || null,
      sanctionFlag: caseData.sanctionFlag || null,
      riskScore: caseData.riskScore ?? null,
      riskLevel: caseData.riskLevel || null,
      reviewRecommended: caseData.reviewRecommended || false,
    },
    coverage: {
      coverageLevel: caseData.coverageLevel || null,
      providerDivergence: caseData.providerDivergence || null,
      criminalEvidenceQuality: caseData.criminalEvidenceQuality || null,
      coverageNotes: caseData.coverageNotes || [],
      ambiguityNotes: caseData.ambiguityNotes || [],
      negativePartialSafetyNetTriggered: caseData.negativePartialSafetyNetTriggered || false,
      negativePartialSafetyNetReasons: caseData.negativePartialSafetyNetReasons || [],
      negativePartialSafetyNetAction: caseData.negativePartialSafetyNetAction || null,
    },
    reviewContext,
    evidence: {
      judit: {
        processTotal: caseData.juditProcessTotal || 0,
        criminalFlag: caseData.juditCriminalFlag || null,
        criminalCount: caseData.juditCriminalCount || 0,
        warrantFlag: caseData.juditWarrantFlag || null,
        activeWarrantCount: caseData.juditActiveWarrantCount || 0,
        executionFlag: caseData.juditExecutionFlag || null,
        executionCount: caseData.juditExecutionCount || 0,
        roleSummary: compactJuditRoleSummary(caseData.juditRoleSummary),
        warrants: (caseData.juditWarrants || []).slice(0, 5).map((item) => stripUndefined({
          code: item.code || null,
          status: item.status || null,
          court: item.court || item.tribunalAcronym || null,
          issueDate: item.issueDate || null,
          warrantType: item.warrantType || null,
          arrestType: item.arrestType || null,
        })),
        executions: (caseData.juditExecutions || []).slice(0, 4).map((item) => stripUndefined({
          processNumber: item.processNumber || item.code || null,
          status: item.status || null,
          court: item.court || item.tribunalAcronym || null,
          phase: item.phase || null,
        })),
      },
      bigdatacorp: {
        processTotal: caseData.bigdatacorpProcessTotal || 0,
        criminalFlag: caseData.bigdatacorpCriminalFlag || null,
        criminalCount: caseData.bigdatacorpCriminalCount || 0,
        directCriminalCount: caseData.bigdatacorpDirectCriminalCount || 0,
        laborFlag: caseData.bigdatacorpLaborFlag || null,
        laborCount: caseData.bigdatacorpLaborCount || 0,
        directLaborCount: caseData.bigdatacorpDirectLaborCount || 0,
        activeWarrants: (caseData.bigdatacorpActiveWarrants || []).slice(0, 5),
        isPep: caseData.bigdatacorpIsPep || false,
        isSanctioned: caseData.bigdatacorpIsSanctioned || false,
        sanctionTypes: caseData.bigdatacorpSanctionTypes || [],
        processos: compactBigDataCorpProcessos(caseData.bigdatacorpProcessos),
      },
      escavador: {
        processTotal: caseData.escavadorProcessTotal || 0,
        criminalFlag: caseData.escavadorCriminalFlag || null,
        criminalCount: caseData.escavadorCriminalCount || 0,
        cpfsComEsseNome: caseData.escavadorCpfsComEsseNome ?? null,
        notes: caseData.escavadorNotes ? String(caseData.escavadorNotes).slice(0, 500) : null,
        processos: compactEscavadorProcessos(caseData.escavadorProcessos),
      },
      djen: {
        comunicacaoTotal: caseData.djenComunicacaoTotal || 0,
        confirmedTotal: caseData.djenConfirmedTotal || 0,
        criminalFlag: caseData.djenCriminalFlag || null,
        laborFlag: caseData.djenLaborFlag || null,
        notes: caseData.djenNotes ? String(caseData.djenNotes).slice(0, 500) : null,
        comunicacoes: compactDjenComunicacoes(caseData.djenComunicacoes),
      },
    },
    homonymReview: caseData.aiHomonymStructuredOk ? caseData.aiHomonymStructured : null,
  };

  return [
    'Revise a autoclassificacao deterministica abaixo como segundo analista consultivo.',
    'Tarefas:',
    '1. Resuma o caso em linguagem operacional.',
    '2. Valide cada flag da autoclassificacao: criminal, trabalhista e mandado.',
    '3. Aponte possiveis erros ou inconsistencias.',
    '4. Liste pontos que o analista humano deve revisar antes de concluir.',
    '5. De uma sugestao consultiva: manter, revisar antes de concluir ou contestar a autoclassificacao.',
    '6. Nao altere flags. Apenas avalie a coerencia delas.',
    '7. Use reviewContext como regra operacional: fonte concluida com zero achados sustenta negativo; ressalva exige shouldRequireCaution=true no eixo.',
    '',
    JSON.stringify(promptPayload, null, 2),
  ].join('\n');
}

/* =========================================================
   Funções puras — builders de payloads
   ========================================================= */

function buildAiUpdatePayload(caseData, aiResult, options = {}) {
  const schemaFailed = !aiResult.error && !aiResult.structuredOk;
  const payload = {
    aiModel: aiResult.model || AI_MODEL,
    aiPromptVersion: AI_PROMPT_VERSION,
    aiExecutedAt: FieldValue.serverTimestamp(),
    aiProvidersIncluded: getAiProvidersIncluded(caseData),
    aiFromCache: !!aiResult.fromCache,
    aiError: aiResult.error || (schemaFailed ? 'Schema validation failed — raw response saved for inspection' : null),
    aiStatus: aiResult.error
      ? 'FAILED'
      : aiResult.structuredOk
        ? 'DONE'
        : 'FAILED_SCHEMA',
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (options.aiRunCount !== undefined) {
    payload.aiRunCount = options.aiRunCount;
  }

  if (Object.prototype.hasOwnProperty.call(aiResult, 'analysis')) {
    payload.aiRawResponse = aiResult.analysis || null;
    payload.aiStructured = aiResult.structured || null;
    payload.aiStructuredOk = aiResult.structuredOk || false;
  }

  const costUsd = aiResult.fromCache ? 0 : estimateAiCostUsd(aiResult.inputTokens || 0, aiResult.outputTokens || 0);
  payload.aiCostUsd = parseFloat(costUsd.toFixed(6));
  payload.aiTokens = { input: aiResult.inputTokens || 0, output: aiResult.outputTokens || 0 };
  return stripUndefined(payload);
}

function buildAiClassificationReviewUpdatePayload(aiResult, options = {}) {
  const schemaFailed = !aiResult.error && !aiResult.structuredOk;
  const payload = {
    aiClassificationReviewModel: aiResult.model || AI_MODEL,
    aiClassificationReviewPromptVersion: AI_CLASSIFICATION_REVIEW_PROMPT_VERSION,
    aiClassificationReviewExecutedAt: FieldValue.serverTimestamp(),
    aiClassificationReviewFromCache: !!aiResult.fromCache,
    aiClassificationReviewError: aiResult.error || (schemaFailed ? 'Schema validation failed — raw response saved for inspection' : null),
    aiClassificationReviewStatus: aiResult.error
      ? 'FAILED'
      : aiResult.structuredOk
        ? 'DONE'
        : 'FAILED_SCHEMA',
    aiStatus: aiResult.error
      ? 'FAILED'
      : aiResult.structuredOk
        ? 'DONE'
        : 'FAILED_SCHEMA',
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (options.aiRunCount !== undefined) {
    payload.aiRunCount = options.aiRunCount;
  }

  if (Object.prototype.hasOwnProperty.call(aiResult, 'analysis')) {
    payload.aiClassificationReviewRawResponse = aiResult.analysis || null;
    payload.aiClassificationReview = aiResult.structuredOk ? (aiResult.structured || null) : null;
    payload.aiClassificationReviewOk = aiResult.structuredOk || false;
  }

  const costUsd = aiResult.fromCache ? 0 : estimateAiCostUsd(aiResult.inputTokens || 0, aiResult.outputTokens || 0);
  payload.aiClassificationReviewCostUsd = parseFloat(costUsd.toFixed(6));
  payload.aiClassificationReviewTokens = { input: aiResult.inputTokens || 0, output: aiResult.outputTokens || 0 };
  return stripUndefined(payload);
}

function buildAiHomonymResetPayload(homonymInput) {
  return stripUndefined({
    aiHomonymTriggered: false,
    aiHomonymContextVersion: AI_HOMONYM_CONTEXT_VERSION,
    aiHomonymAmbiguityReasons: homonymInput?.ambiguityReasons || [],
    aiHomonymHardFacts: homonymInput?.hardFacts || [],
    aiHomonymExecutedAt: FieldValue.serverTimestamp(),
    aiHomonymDecision: FieldValue.delete(),
    aiHomonymConfidence: FieldValue.delete(),
    aiHomonymRisk: FieldValue.delete(),
    aiHomonymRecommendedAction: FieldValue.delete(),
    aiHomonymRawResponse: FieldValue.delete(),
    aiHomonymStructured: FieldValue.delete(),
    aiHomonymStructuredOk: FieldValue.delete(),
    aiHomonymCostUsd: FieldValue.delete(),
    aiHomonymTokens: FieldValue.delete(),
    aiHomonymFromCache: FieldValue.delete(),
    aiHomonymError: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

function buildAiHomonymUpdatePayload(caseData, homonymInput, aiResult) {
  const payload = {
    aiHomonymTriggered: !!homonymInput?.needsAnalysis,
    aiHomonymContextVersion: AI_HOMONYM_CONTEXT_VERSION,
    aiHomonymAmbiguityReasons: homonymInput?.ambiguityReasons || [],
    aiHomonymHardFacts: homonymInput?.hardFacts || [],
    aiHomonymExecutedAt: FieldValue.serverTimestamp(),
    aiHomonymFromCache: !!aiResult?.fromCache,
    aiHomonymError: aiResult?.error || null,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (Object.prototype.hasOwnProperty.call(aiResult || {}, 'analysis')) {
    payload.aiHomonymRawResponse = aiResult.analysis || null;
    payload.aiHomonymStructured = aiResult.structured || null;
    payload.aiHomonymStructuredOk = aiResult.structuredOk || false;
  }

  if (aiResult?.structuredOk && aiResult?.structured) {
    payload.aiHomonymDecision = aiResult.structured.decision || null;
    payload.aiHomonymConfidence = aiResult.structured.confidence || null;
    payload.aiHomonymRisk = aiResult.structured.homonymRisk || null;
    payload.aiHomonymRecommendedAction = aiResult.structured.recommendedAction || null;
  } else {
    payload.aiHomonymDecision = 'UNCERTAIN';
    payload.aiHomonymConfidence = 'LOW';
    payload.aiHomonymRisk = homonymInput?.needsAnalysis ? 'MEDIUM' : null;
    payload.aiHomonymRecommendedAction = homonymInput?.needsAnalysis ? 'MANUAL_REVIEW' : null;
  }

  const costUsd = aiResult?.fromCache ? 0 : estimateAiCostUsd(aiResult?.inputTokens || 0, aiResult?.outputTokens || 0);
  payload.aiHomonymCostUsd = parseFloat(costUsd.toFixed(6));
  payload.aiHomonymTokens = { input: aiResult?.inputTokens || 0, output: aiResult?.outputTokens || 0 };
  return stripUndefined(payload);
}

function buildAiPrefillUpdatePayload(aiResult) {
  const metadata = {
    model: aiResult?.model || AI_MODEL,
    promptVersion: AI_PREFILL_PROMPT_VERSION,
    executedAt: new Date().toISOString(),
    ok: Boolean(aiResult?.structuredOk && aiResult?.structured),
    fromCache: !!aiResult?.fromCache,
    error: aiResult?.error || null,
  };

  return stripUndefined({
    prefillNarratives: {
      ...(aiResult?.structured || {}),
      metadata,
    },
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/* =========================================================
   Handlers de execução — side effects
   ========================================================= */

async function runStructuredAiAnalysis({
  caseData,
  apiKey,
  prompt,
  systemMessage,
  cacheDocId,
  cacheKey,
  parser,
  skipCache = false,
  maxTokens = AI_MAX_TOKENS,
  responseFormat = null,
  db,
}) {
  if (Date.now() < _aiCircuitOpenUntil) {
    console.warn('AI circuit breaker OPEN - skipping analysis.');
    return { error: 'Circuit breaker aberto. IA temporariamente desativada.', inputTokens: 0, outputTokens: 0 };
  }

  const inputEstimate = Math.ceil(prompt.length / 3.5);
  const caseRef = db.collection('cases').doc(caseData.id || caseData._caseId);

  if (!skipCache) {
    try {
      const cacheDoc = await caseRef.collection('aiCache').doc(cacheDocId).get();
      if (cacheDoc.exists) {
        const cached = cacheDoc.data();
        const cacheAge = Date.now() - (cached.cachedAt?.toMillis?.() || 0);
        if (cacheAge < AI_CACHE_TTL_MS && cached.cacheKey === cacheKey) {
          console.log(`AI cache HIT (${cacheDocId}) for case ${caseData.id || caseData._caseId}`);
          return {
            analysis: cached.aiRawResponse,
            structured: cached.aiStructured,
            structuredOk: cached.aiStructuredOk,
            inputTokens: cached.aiTokens?.input || 0,
            outputTokens: cached.aiTokens?.output || 0,
            model: cached.aiModel,
            fromCache: true,
          };
        }
      }
    } catch (cacheErr) {
      console.warn(`AI cache read failed (${cacheDocId}):`, cacheErr.message);
    }
  }

  let lastError = null;
  let shouldTripCircuit = false;
  let disableResponseFormat = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      const requestBody = {
        model: AI_MODEL,
        max_completion_tokens: maxTokens,
        temperature: 0.1,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt },
        ],
      };
      if (responseFormat && !disableResponseFormat) {
        requestBody.response_format = responseFormat;
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        lastError = formatOpenAiError(response.status, body);
        console.error(`AI analysis attempt ${attempt + 1} failed (${cacheDocId}): ${response.status} ${body}`);
        if (response.status === 400 && responseFormat && !disableResponseFormat && /response_format|json_object|json schema/i.test(body)) {
          disableResponseFormat = true;
          continue;
        }
        if (response.status === 429 || response.status >= 500) {
          shouldTripCircuit = true;
          continue;
        }
        return { error: lastError, inputTokens: inputEstimate, outputTokens: 0 };
      }

      _aiCircuitFailures = 0;

      const json = await response.json();
      const usage = json.usage || {};
      const rawContent = json.choices?.[0]?.message?.content || '';
      const sanitized = sanitizeAiOutput(rawContent);
      const parsed = parser(sanitized);

      const result = {
        analysis: sanitized,
        structured: parsed.structured,
        structuredOk: parsed.ok,
        inputTokens: usage.prompt_tokens || inputEstimate,
        outputTokens: usage.completion_tokens || Math.ceil(rawContent.length / 3.5),
        model: AI_MODEL,
        fromCache: false,
      };

      caseRef.collection('aiCache').doc(cacheDocId).set({
        aiRawResponse: result.analysis,
        aiStructured: result.structured || null,
        aiStructuredOk: result.structuredOk,
        aiModel: result.model,
        aiTokens: { input: result.inputTokens, output: result.outputTokens },
        cacheKey,
        cachedAt: FieldValue.serverTimestamp(),
      }).catch((err) => console.warn(`AI cache write failed (${cacheDocId}):`, err.message));

      return result;
    } catch (err) {
      lastError = formatAiRuntimeError(err);
      shouldTripCircuit = true;
      console.error(`AI analysis attempt ${attempt + 1} error (${cacheDocId}):`, err.message);
    }
  }

  if (shouldTripCircuit) {
    _aiCircuitFailures++;
    if (_aiCircuitFailures >= AI_CIRCUIT_THRESHOLD) {
      _aiCircuitOpenUntil = Date.now() + AI_CIRCUIT_COOLDOWN_MS;
      console.error('AI circuit breaker OPENED after consecutive failures.');
    }
  }
  return { error: lastError, inputTokens: inputEstimate, outputTokens: 0 };
}

async function runAiAnalysis(caseData, apiKey, options = {}, db) {
  const prompt = buildAiPrompt(caseData);
  return runStructuredAiAnalysis({
    caseData,
    apiKey,
    prompt,
    systemMessage: AI_GENERAL_SYSTEM_MESSAGE,
    cacheDocId: 'latest',
    cacheKey: computeAiCacheKey(caseData, { kind: 'general', prompt }),
    parser: parseAiResponse,
    skipCache: options.skipCache === true,
    db,
  });
}

async function runAiClassificationReviewAnalysis(caseData, apiKey, options = {}, db) {
  const prompt = buildAiClassificationReviewPrompt(caseData);
  const result = await runStructuredAiAnalysis({
    caseData,
    apiKey,
    prompt,
    systemMessage: AI_CLASSIFICATION_REVIEW_SYSTEM_MESSAGE,
    cacheDocId: 'classification_review',
    cacheKey: computeAiCacheKey(caseData, { kind: 'classificationReview', prompt }),
    parser: parseAiClassificationReviewResponse,
    skipCache: options.skipCache === true,
    maxTokens: AI_MAX_TOKENS_PREFILL,
    responseFormat: { type: 'json_object' },
    db,
  });
  if (result?.structuredOk && result.structured) {
    result.structured = applyAiClassificationReviewGuardrails(result.structured, caseData);
  }
  return result;
}

async function runAiHomonymAnalysis(caseData, homonymInput, apiKey, options = {}, db) {
  const prompt = buildAiHomonymPrompt(homonymInput);
  const cacheKey = computeAiCacheKey(caseData, { kind: 'homonym', context: homonymInput });
  return runStructuredAiAnalysis({
    caseData,
    apiKey,
    prompt,
    systemMessage: AI_HOMONYM_SYSTEM_MESSAGE,
    cacheDocId: 'homonym',
    cacheKey,
    parser: parseAiHomonymResponse,
    skipCache: options.skipCache === true,
    db,
  });
}

async function runAiPrefillAnalysis(caseData, apiKey, options = {}, db) {
  const prompt = buildAiPrefillPrompt(caseData);
  return runStructuredAiAnalysis({
    caseData,
    apiKey,
    prompt,
    systemMessage: AI_PREFILL_SYSTEM_MESSAGE,
    cacheDocId: 'report_prefill',
    cacheKey: computeAiCacheKey(caseData, { kind: 'general', prompt: `${AI_PREFILL_PROMPT_VERSION}:${prompt}` }),
    parser: parseAiPrefillResponse,
    skipCache: options.skipCache === true,
    maxTokens: AI_MAX_TOKENS_PREFILL,
    db,
  });
}

async function recordAiCostLedger(tenantId, updatePayload = {}, db) {
  if (!tenantId) return;
  const totalCost = Number(updatePayload.aiCostUsd || 0)
    + Number(updatePayload.aiHomonymCostUsd || 0)
    + Number(updatePayload.aiClassificationReviewCostUsd || 0);
  if (!Number.isFinite(totalCost) || totalCost <= 0) return;
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const ledgerRef = db.collection('tenantSettings').doc(tenantId).collection('aiCostLedger').doc(monthKey);

  await ledgerRef.set({
    tenantId,
    monthKey,
    totalCostUsd: FieldValue.increment(Number(totalCost.toFixed(6))),
    runs: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

/* =========================================================
   Exports
   ========================================================= */

module.exports = {
  // Constantes
  AI_MODEL,
  AI_MAX_TOKENS,
  AI_MAX_TOKENS_PREFILL,
  AI_PROMPT_VERSION,
  AI_HOMONYM_PROMPT_VERSION,
  AI_HOMONYM_CONTEXT_VERSION,
  AI_PREFILL_PROMPT_VERSION,
  AI_CLASSIFICATION_REVIEW_PROMPT_VERSION,
  AI_CACHE_TTL_MS,
  AI_COST_INPUT,
  AI_COST_OUTPUT,
  AI_CIRCUIT_THRESHOLD,
  AI_CIRCUIT_COOLDOWN_MS,

  // Utilitários puros
  compactErrorMessage,
  extractApiErrorMessage,
  formatOpenAiError,
  formatAiRuntimeError,
  isDoneOrPartial,
  computeSimpleHash,
  computeAiCacheKey,
  estimateAiCostUsd,
  getAiProvidersIncluded,
  maskCpfForAi,
  compactJuditRoleSummary,
  compactBigDataCorpProcessos,
  compactEscavadorProcessos,
  compactDjenComunicacoes,
  countItems,
  isNegativeFlag,
  isPositiveFlag,
  buildReviewSource,
  summarizeAxisCoverage,
  buildAxisReviewContext,
  hasCriminalLowRiskRoleOnly,
  isGenericCautionText,
  applyAxisReviewGuardrail,
  applyAiClassificationReviewGuardrails,

  // Builders de prompts
  buildAiPrompt,
  buildAiHomonymPrompt,
  buildAiPrefillPrompt,
  buildAiClassificationReviewPrompt,
  buildAiClassificationReviewContext,

  // Builders de payloads
  buildAiUpdatePayload,
  buildAiHomonymResetPayload,
  buildAiHomonymUpdatePayload,
  buildAiPrefillUpdatePayload,
  buildAiClassificationReviewUpdatePayload,

  // Handlers de execução
  runStructuredAiAnalysis,
  runAiAnalysis,
  runAiHomonymAnalysis,
  runAiPrefillAnalysis,
  runAiClassificationReviewAnalysis,
  recordAiCostLedger,
};
