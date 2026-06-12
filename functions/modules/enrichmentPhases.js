/**
 * enrichmentPhases.js — Módulo de fases de enriquecimento
 * Extraído do monolito index.js
 *
 * Orquestra chamadas aos adapters: FonteData, Escavador, BigDataCorp, Judit, DJEN.
 */

const {
  queryWarrant: default_queryWarrant,
  queryLabor: default_queryLabor,
  queryIdentity: default_queryIdentity,
  queryReceitaFederal: default_queryReceitaFederal,
  queryProcessosAgrupada: default_queryProcessosAgrupada,
  queryProcessosCompleta: default_queryProcessosCompleta,
  FonteDataError: default_FonteDataError,
} = require('../adapters/fontedata');
const {
  normalizeReceitaFederal: default_normalizeReceitaFederal,
  normalizeIdentity: default_normalizeIdentity,
  normalizeProcessos: default_normalizeProcessos,
  normalizeProcessosCompleta: default_normalizeProcessosCompleta,
  normalizeWarrant: default_normalizeWarrant,
  normalizeLabor: default_normalizeLabor,
} = require('../normalizers/phases');
const {
  queryProcessosByPerson: default_queryProcessosByPerson,
  EscavadorError: default_EscavadorError,
} = require('../adapters/escavador');
const {
  normalizeEscavadorProcessos: default_normalizeEscavadorProcessos,
} = require('../normalizers/escavador');
const {
  queryLawsuitsSync: default_queryLawsuitsSync,
  queryLawsuitsSyncByName: default_queryLawsuitsSyncByName,
  queryLawsuitsAsync: default_queryLawsuitsAsync,
  queryWarrantAsync: default_queryWarrantAsync,
  queryExecutionAsync: default_queryExecutionAsync,
  queryEntityDataLake: default_queryEntityDataLake,
  queryLawsuitsByNameAsync: default_queryLawsuitsByNameAsync,
  JuditError: default_JuditError,
} = require('../adapters/judit');
const {
  normalizeJuditLawsuits: default_normalizeJuditLawsuits,
  normalizeJuditWarrants: default_normalizeJuditWarrants,
  normalizeJuditExecution: default_normalizeJuditExecution,
  normalizeJuditEntity: default_normalizeJuditEntity,
} = require('../normalizers/judit');
const {
  queryCombined: default_queryBigDataCorpCombined,
  BigDataCorpError: default_BigDataCorpError,
} = require('../adapters/bigdatacorp');
const {
  normalizeBigDataCorpBasicData: default_normalizeBigDataCorpBasicData,
  normalizeBigDataCorpProcesses: default_normalizeBigDataCorpProcesses,
  normalizeBigDataCorpKyc: default_normalizeBigDataCorpKyc,
  normalizeBigDataCorpProfession: default_normalizeBigDataCorpProfession,
} = require('../normalizers/bigdatacorp');
const {
  queryComunicacoesByName: default_queryComunicacoesByName,
  queryComunicacoesByProcesso: default_queryComunicacoesByProcesso,
  DjenError: default_DjenError,
} = require('../adapters/djen');
const {
  normalizeDjenComunicacoes: default_normalizeDjenComunicacoes,
} = require('../normalizers/djen');
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
const {
  checkCircuit: default_checkCircuit,
  recordSuccess: default_recordSuccess,
  recordFailure: default_recordFailure,
} = require('../helpers/circuitBreaker');
const {
  getEscavadorTribunais: default_getEscavadorTribunais,
  getJuditTribunais: default_getJuditTribunais,
  buildCandidateUfs: default_buildCandidateUfs,
} = require('../helpers/tribunalMap');
const { computeNameSimilarity: default_computeNameSimilarity } = require('./utilityHelpers');
const {
  buildJuditCallbackUrl: default_buildJuditCallbackUrl,
  registerJuditWebhookRequest: default_registerJuditWebhookRequest,
} = require('./juditWebhookAndFallback');
const { maskCpf } = require('./_shared/sanitizers');

/* =========================================================
   FACTORY: dependências injetadas do index.js
   ========================================================= */

function createEnrichmentPhases(deps) {
  const {
    db,
    FieldValue,
    fontedataApiKey,
    escavadorApiToken,
    juditApiKey,
    bigdatacorpAccessToken,
    bigdatacorpTokenId,
    escavador2ApiKey,
    maybeRunAutoClassifyAndAi,
    returnCaseForIdentityGateBlock,
    // Adapters e helpers injetáveis para testes
    adapters = {},
    normalizers = {},
    helpers = {},
  } = deps;

  // Adapters com fallback para imports padrão
  const queryWarrant = adapters.queryWarrant || default_queryWarrant;
  const queryLabor = adapters.queryLabor || default_queryLabor;
  const queryIdentity = adapters.queryIdentity || default_queryIdentity;
  const queryReceitaFederal = adapters.queryReceitaFederal || default_queryReceitaFederal;
  const queryProcessosAgrupada = adapters.queryProcessosAgrupada || default_queryProcessosAgrupada;
  const queryProcessosCompleta = adapters.queryProcessosCompleta || default_queryProcessosCompleta;
  const FonteDataError = adapters.FonteDataError || default_FonteDataError;

  const queryProcessosByPerson = adapters.queryProcessosByPerson || default_queryProcessosByPerson;
  const EscavadorError = adapters.EscavadorError || default_EscavadorError;

  const queryBigDataCorpCombined = adapters.queryBigDataCorpCombined || default_queryBigDataCorpCombined;
  const BigDataCorpError = adapters.BigDataCorpError || default_BigDataCorpError;

  const queryLawsuitsSync = adapters.queryLawsuitsSync || default_queryLawsuitsSync;
  const queryLawsuitsSyncByName = adapters.queryLawsuitsSyncByName || default_queryLawsuitsSyncByName;
  const queryLawsuitsAsync = adapters.queryLawsuitsAsync || default_queryLawsuitsAsync;
  const queryWarrantAsync = adapters.queryWarrantAsync || default_queryWarrantAsync;
  const queryExecutionAsync = adapters.queryExecutionAsync || default_queryExecutionAsync;
  const queryEntityDataLake = adapters.queryEntityDataLake || default_queryEntityDataLake;
  const queryLawsuitsByNameAsync = adapters.queryLawsuitsByNameAsync || default_queryLawsuitsByNameAsync;
  const JuditError = adapters.JuditError || default_JuditError;

  const queryComunicacoesByName = adapters.queryComunicacoesByName || default_queryComunicacoesByName;
  const queryComunicacoesByProcesso = adapters.queryComunicacoesByProcesso || default_queryComunicacoesByProcesso;
  const DjenError = adapters.DjenError || default_DjenError;

  const consultarEscavador2 = adapters.consultarEscavador2 || default_consultarEscavador2;
  const Escavador2Error = adapters.Escavador2Error || default_Escavador2Error;

  // Normalizers com fallback
  const normalizeReceitaFederal = normalizers.normalizeReceitaFederal || default_normalizeReceitaFederal;
  const normalizeIdentity = normalizers.normalizeIdentity || default_normalizeIdentity;
  const normalizeProcessos = normalizers.normalizeProcessos || default_normalizeProcessos;
  const normalizeProcessosCompleta = normalizers.normalizeProcessosCompleta || default_normalizeProcessosCompleta;
  const normalizeWarrant = normalizers.normalizeWarrant || default_normalizeWarrant;
  const normalizeLabor = normalizers.normalizeLabor || default_normalizeLabor;

  const normalizeEscavadorProcessos = normalizers.normalizeEscavadorProcessos || default_normalizeEscavadorProcessos;

  const normalizeBigDataCorpBasicData = normalizers.normalizeBigDataCorpBasicData || default_normalizeBigDataCorpBasicData;
  const normalizeBigDataCorpProcesses = normalizers.normalizeBigDataCorpProcesses || default_normalizeBigDataCorpProcesses;
  const normalizeBigDataCorpKyc = normalizers.normalizeBigDataCorpKyc || default_normalizeBigDataCorpKyc;
  const normalizeBigDataCorpProfession = normalizers.normalizeBigDataCorpProfession || default_normalizeBigDataCorpProfession;

  const normalizeJuditLawsuits = normalizers.normalizeJuditLawsuits || default_normalizeJuditLawsuits;
  const normalizeJuditWarrants = normalizers.normalizeJuditWarrants || default_normalizeJuditWarrants;
  const normalizeJuditExecution = normalizers.normalizeJuditExecution || default_normalizeJuditExecution;
  const normalizeJuditEntity = normalizers.normalizeJuditEntity || default_normalizeJuditEntity;

  const normalizeDjenComunicacoes = normalizers.normalizeDjenComunicacoes || default_normalizeDjenComunicacoes;
  const normalizeEscavador2Response = normalizers.normalizeEscavador2Response || default_normalizeEscavador2Response;

  // Helpers com fallback
  const checkCircuit = helpers.checkCircuit || default_checkCircuit;
  const recordSuccess = helpers.recordSuccess || default_recordSuccess;
  const recordFailure = helpers.recordFailure || default_recordFailure;
  const getEscavadorTribunais = helpers.getEscavadorTribunais || default_getEscavadorTribunais;
  const getJuditTribunais = helpers.getJuditTribunais || default_getJuditTribunais;
  const buildCandidateUfs = helpers.buildCandidateUfs || default_buildCandidateUfs;
  const computeNameSimilarity = helpers.computeNameSimilarity || default_computeNameSimilarity;
  const buildJuditCallbackUrl = helpers.buildJuditCallbackUrl || default_buildJuditCallbackUrl;
  const registerJuditWebhookRequest = helpers.registerJuditWebhookRequest || default_registerJuditWebhookRequest;
  const deduplicateEscavador2Findings = helpers.deduplicateEscavador2Findings || default_deduplicateEscavador2Findings;

  /* =========================================================
     FONTEDATA — Enrichment Phase
     ========================================================= */

  async function runFonteDataEnrichmentPhase(caseRef, caseId, caseData, enrichmentConfig) {
    const cpf = (caseData.cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11) {
      const error = 'CPF invalido para consulta.';
      console.warn(`Case ${caseId}: invalid CPF length (${cpf.length}), skipping.`);
      await caseRef.update({
        enrichmentStatus: 'FAILED',
        enrichmentError: error,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: 'FAILED', error };
    }

    await caseRef.update({
      enrichmentStatus: 'RUNNING',
      enrichmentError: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const apiKey = fontedataApiKey.value();
    const phases = enrichmentConfig.phases;

    let gateResult;
    try {
      gateResult = normalizeReceitaFederal(await queryReceitaFederal(cpf, apiKey));
    } catch (err) {
      const errMsg = err instanceof FonteDataError
        ? `${err.message} (${err.statusCode})`
        : (err.message || 'Erro desconhecido');
      const error = `Gate de identidade falhou: ${errMsg}`;
      console.error(`Case ${caseId}: identity gate query failed:`, errMsg);
      await caseRef.update({
        enrichmentStatus: 'FAILED',
        enrichmentError: error,
        enrichmentSources: { gate: { error: errMsg, consultedAt: new Date().toISOString() } },
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: 'FAILED', error };
    }

    const { enrichmentIdentity } = gateResult;
    const gateSource = gateResult._source;
    const nameFromAPI = enrichmentIdentity?.name || '';
    const nameProvided = caseData.candidateName || '';
    const minSim = enrichmentConfig.gate?.minNameSimilarity ?? 0.7;

    const cpfStatusNormalized = (enrichmentIdentity?.cpfStatus || '').toUpperCase();
    const isCpfRegular = cpfStatusNormalized === 'REGULAR';
    const isCpfPending = cpfStatusNormalized.includes('PENDENTE');
    const isCpfCancelled = /CANCEL/.test(cpfStatusNormalized);
    const cpfPasses = isCpfRegular || isCpfPending;
    const nameSim = computeNameSimilarity(nameFromAPI, nameProvided);
    const namePasses = minSim <= 0 || nameSim >= minSim;
    const gatePassed = cpfPasses && namePasses;
    const hasDeathRecord = enrichmentIdentity?.hasDeathRecord === true;
    const gatePassedFinal = gatePassed && !hasDeathRecord;

    let gateReason = null;
    if (isCpfCancelled) gateReason = `CPF com situacao "${cpfStatusNormalized}" (cancelado).`;
    else if (!cpfPasses) gateReason = `CPF com situacao "${cpfStatusNormalized}" (esperado: REGULAR).`;
    else if (hasDeathRecord) gateReason = `CPF possui registro de obito (ano: ${enrichmentIdentity.deathYear || 'N/A'}).`;
    else if (!namePasses) gateReason = `Similaridade de nome ${(nameSim * 100).toFixed(0)}% abaixo do limiar ${(minSim * 100).toFixed(0)}%.`;

    const enrichmentGateResult = {
      passed: gatePassedFinal,
      cpfStatus: cpfStatusNormalized,
      cpfPendingRegularization: isCpfPending,
      nameSimilarity: parseFloat(nameSim.toFixed(4)),
      nameProvided,
      nameFound: nameFromAPI,
      hasDeathRecord,
      reason: gateReason,
      consultedAt: new Date().toISOString(),
    };

    if (!gatePassedFinal) {
      console.log(`Case ${caseId}: identity gate BLOCKED. ${gateReason}`);
      await caseRef.update({
        enrichmentStatus: 'BLOCKED',
        enrichmentError: null,
        enrichmentIdentity,
        enrichmentGateResult,
        enrichmentSources: { gate: gateSource },
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: 'BLOCKED', error: gateReason || null };
    }

    console.log(`Case ${caseId}: identity gate PASSED (similarity: ${(nameSim * 100).toFixed(0)}%).`);

    const uf = enrichmentConfig.filters?.uf || caseData.hiringUf || null;
    const tasks = [];

    const fontedataCircuit = await checkCircuit('fontedata');
    if (fontedataCircuit.open) {
      console.warn(`Case ${caseId}: FonteData circuit OPEN — skipping. ${fontedataCircuit.reason}`);
      await caseRef.update({
        enrichmentStatus: 'PARTIAL',
        enrichmentError: fontedataCircuit.reason,
        enrichmentSources: { gate: gateSource, fontedata: { circuitOpen: true } },
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: 'PARTIAL', error: fontedataCircuit.reason };
    }

    if (!fontedataCircuit.open && phases.identity !== false) {
      tasks.push({
        key: 'identity',
        promise: queryIdentity(cpf, apiKey).then(normalizeIdentity),
      });
    }

    if (!fontedataCircuit.open && phases.criminal !== false) {
      tasks.push({
        key: 'criminal',
        promise: queryProcessosAgrupada(cpf, apiKey).then(normalizeProcessos),
      });
    }

    if (!fontedataCircuit.open && phases.warrant !== false) {
      tasks.push({
        key: 'warrant',
        promise: queryWarrant(cpf, apiKey).then(normalizeWarrant),
      });
    }

    if (!fontedataCircuit.open && phases.labor !== false) {
      tasks.push({
        key: 'labor',
        promise: queryLabor(cpf, apiKey, uf).then(normalizeLabor),
      });
    }

    const results = tasks.length > 0
      ? await Promise.allSettled(tasks.map((task) => task.promise))
      : [];

    const updatePayload = {};
    const enrichmentSources = { gate: gateSource };
    const enrichmentOriginalValues = {};
    const phaseResults = {};
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (let i = 0; i < tasks.length; i++) {
      const { key } = tasks[i];
      const result = results[i];

      if (result.status === 'fulfilled') {
        successCount++;
        const normalized = result.value;
        const { _source, ...fields } = normalized;
        enrichmentSources[key] = _source;
        phaseResults[key] = normalized;

        for (const [field, value] of Object.entries(fields)) {
          if (value !== undefined && value !== null) {
            updatePayload[field] = value;
            enrichmentOriginalValues[field] = value;
          }
        }
      } else {
        failCount++;
        const err = result.reason;
        const errMsg = err instanceof FonteDataError
          ? `${err.message} (${err.statusCode})`
          : (err.message || 'Erro desconhecido');
        errors.push(`${key}: ${errMsg}`);
        enrichmentSources[key] = { error: errMsg, consultedAt: new Date().toISOString() };
        console.error(`Case ${caseId}: enrichment phase ${key} failed:`, errMsg);
      }
    }

    if (tasks.length > 0 && !fontedataCircuit.open) {
      if (failCount === 0) {
        await recordSuccess('fontedata');
      } else if (failCount > 0 && successCount === 0) {
        await recordFailure('fontedata', errors[0] || 'All phases failed');
      }
    }

    const escalation = enrichmentConfig.escalation || {};
    if (escalation.enabled !== false) {
      const triggers = escalation.triggers || ['criminal', 'warrant', 'highProcessCount'];
      let shouldEscalate = false;
      const escalationReasons = [];

      if (triggers.includes('criminal') && phaseResults.criminal?.criminalFlag === 'POSITIVE') {
        shouldEscalate = true;
        escalationReasons.push('criminal_detected');
      }
      if (triggers.includes('warrant') && phaseResults.warrant?.warrantFlag === 'POSITIVE') {
        shouldEscalate = true;
        escalationReasons.push('warrant_detected');
      }
      if (triggers.includes('highProcessCount')) {
        const threshold = escalation.processCountThreshold || 5;
        const total = phaseResults.criminal?.processTotal || 0;
        if (total >= threshold) {
          shouldEscalate = true;
          escalationReasons.push(`process_count_${total}>=${threshold}`);
        }
      }

      if (shouldEscalate) {
        console.log(`Case ${caseId}: ESCALATING to processos-completa. Reasons: ${escalationReasons.join(', ')}`);
        try {
          const completaResult = normalizeProcessosCompleta(await queryProcessosCompleta(cpf, apiKey));
          const { _source, ...fields } = completaResult;
          enrichmentSources['processos-completa'] = _source;
          phaseResults['processos-completa'] = completaResult;
          for (const [field, value] of Object.entries(fields)) {
            if (value !== undefined && value !== null) {
              updatePayload[field] = value;
              enrichmentOriginalValues[field] = value;
            }
          }
          successCount++;
        } catch (err) {
          const errMsg = err instanceof FonteDataError
            ? `${err.message} (${err.statusCode})`
            : (err.message || 'Erro desconhecido');
          errors.push(`processos-completa: ${errMsg}`);
          enrichmentSources['processos-completa'] = { error: errMsg, consultedAt: new Date().toISOString() };
          console.error(`Case ${caseId}: escalation failed:`, errMsg);
        }
      }

      updatePayload.escalation = {
        triggered: shouldEscalate,
        reasons: escalationReasons,
      };
    }

    const totalPhases = tasks.length;
    let enrichmentStatus;
    if (totalPhases === 0) {
      enrichmentStatus = 'DONE';
    } else if (failCount === 0) {
      enrichmentStatus = 'DONE';
    } else if (successCount > 0) {
      enrichmentStatus = 'PARTIAL';
    } else {
      enrichmentStatus = 'FAILED';
    }

    const identityContact = phaseResults.identity?.enrichmentContact;
    const enrichmentPrimaryUf = identityContact?.primaryUf || uf || null;
    const enrichmentAllUfs = identityContact?.allUfs || (uf ? [uf] : []);
    const error = errors.length > 0 ? errors.join('; ') : null;

    await caseRef.update({
      ...updatePayload,
      enrichmentStatus,
      enrichmentIdentity,
      enrichmentGateResult,
      enrichmentSources,
      enrichmentOriginalValues,
      enrichmentPrimaryUf,
      enrichmentAllUfs,
      enrichmentError: error,
      enrichedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const totalCost = Object.values(enrichmentSources)
      .map((source) => parseFloat(source.cost) || 0)
      .reduce((sum, value) => sum + value, 0);

    console.log(
      `Case ${caseId}: enrichment ${enrichmentStatus}. ` +
      `Success: ${successCount + 1}/${totalPhases + 1}. ` +
      `Cost: R$ ${totalCost.toFixed(2)}.`,
    );

    return { status: enrichmentStatus, error, enrichmentPrimaryUf, enrichmentAllUfs };
  }

  /* =========================================================
     ESCAVADOR — Enrichment Phase
     ========================================================= */

  async function runEscavadorEnrichmentPhase(caseRef, caseId, caseData, escavadorConfig, options = {}) {
    const cpf = (caseData.cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11) {
      const error = 'CPF invalido.';
      await caseRef.update({
        escavadorEnrichmentStatus: 'FAILED',
        escavadorError: error,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: 'FAILED', error };
    }

    await caseRef.update({
      escavadorEnrichmentStatus: 'RUNNING',
      escavadorError: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const token = escavadorApiToken.value();
    if (!token) {
      const error = 'ESCAVADOR_API_TOKEN nao configurado.';
      await caseRef.update({
        escavadorEnrichmentStatus: 'FAILED',
        escavadorError: error,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: 'FAILED', error };
    }

    const escCircuit = await checkCircuit('escavador');
    if (escCircuit.open) {
      console.warn(`Case ${caseId} [Escavador]: circuit OPEN — skipping. ${escCircuit.reason}`);
      await caseRef.update({
        escavadorEnrichmentStatus: 'SKIPPED',
        escavadorError: escCircuit.reason,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: 'SKIPPED', error: escCircuit.reason };
    }

    try {
      const filters = escavadorConfig.filters || {};
      const ufs = caseData.juditAllUfs || caseData.enrichmentAllUfs || (caseData.juditPrimaryUf ? [caseData.juditPrimaryUf] : caseData.enrichmentPrimaryUf ? [caseData.enrichmentPrimaryUf] : (caseData.hiringUf ? [caseData.hiringUf] : []));
      let tribunais = filters.tribunais?.length > 0 ? filters.tribunais : [];
      if (tribunais.length === 0 && filters.autoTribunais === true && ufs.length > 0) {
        tribunais = getEscavadorTribunais(ufs);
      }

      const queryOptions = {
        limit: 100,
        incluirHomonimos: filters.incluirHomonimos !== false,
        tribunais: tribunais.length > 0 ? tribunais : undefined,
        status: filters.status || undefined,
      };

      console.log(`Case ${caseId} [Escavador]: querying CPF=${maskCpf(cpf)}, UFs=${ufs.join(',')}, tribunais=${tribunais.join(',') || 'all'}`);

      const rawItems = await queryProcessosByPerson(cpf, token, queryOptions);
      const normalized = normalizeEscavadorProcessos(rawItems, cpf);
      const { _source, ...fields } = normalized;

      const totalProcessos = fields.escavadorProcessTotal || rawItems.items?.length || 0;
      const escavadorCostBRL = Math.max(1, Math.ceil(totalProcessos / 200)) * 3.00;

      await caseRef.update({
        ...fields,
        escavadorEnrichmentStatus: 'DONE',
        escavadorError: null,
        escavadorSources: _source,
        escavadorCostBRL,
        escavadorEnrichedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(
        `Case ${caseId} [Escavador]: DONE. ` +
        `Processos: ${fields.escavadorProcessTotal || 0}, ` +
        `Criminal: ${fields.escavadorCriminalFlag || 'NEGATIVE'}, ` +
        `Tribunais filter: [${tribunais.join(',')}].`,
      );

      await recordSuccess('escavador');

      if (!options.skipAutoClassify) {
        await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Escavador', options);
      }

      return { status: 'DONE', error: null };
    } catch (err) {
      const errMsg = err instanceof EscavadorError
        ? `${err.message} (${err.statusCode})`
        : (err.message || 'Erro desconhecido');
      console.error(`Case ${caseId} [Escavador]: failed:`, errMsg);
      await recordFailure('escavador', errMsg);
      await caseRef.update({
        escavadorEnrichmentStatus: 'FAILED',
        escavadorError: errMsg,
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (!options.skipAutoClassify) {
        await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Escavador failure', options);
      }

      return { status: 'FAILED', error: errMsg };
    }
  }

  /* =========================================================
     BIGDATACORP — Enrichment Phase
     ========================================================= */

  async function runBigDataCorpEnrichmentPhase(caseRef, caseId, caseData, bdcConfig, options = {}) {
    const cpf = (caseData.cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11) {
      const error = 'CPF invalido.';
      await caseRef.update({
        bigdatacorpEnrichmentStatus: 'FAILED',
        bigdatacorpError: error,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: 'FAILED', error };
    }

    await caseRef.update({
      bigdatacorpEnrichmentStatus: 'RUNNING',
      bigdatacorpError: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const accessToken = bigdatacorpAccessToken.value();
    const tokenId = bigdatacorpTokenId.value();
    if (!accessToken || !tokenId) {
      const error = 'BIGDATACORP_ACCESS_TOKEN ou BIGDATACORP_TOKEN_ID nao configurado.';
      await caseRef.update({
        bigdatacorpEnrichmentStatus: 'FAILED',
        bigdatacorpError: error,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: 'FAILED', error };
    }

    const bdcCircuit = await checkCircuit('bigdatacorp');
    if (bdcCircuit.open) {
      console.warn(`Case ${caseId} [BigDataCorp]: circuit OPEN — skipping. ${bdcCircuit.reason}`);
      await caseRef.update({
        bigdatacorpEnrichmentStatus: 'SKIPPED',
        bigdatacorpError: bdcCircuit.reason,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: 'SKIPPED', error: bdcCircuit.reason };
    }

    try {
      const credentials = { accessToken, tokenId };
      const processLimit = bdcConfig.processLimit || 100;

      console.log(`Case ${caseId} [BigDataCorp]: querying CPF=${maskCpf(cpf)}, processLimit=${processLimit}`);

      const bdcPhases = bdcConfig.phases || {};
      const datasets = {
        basicData: bdcPhases.basicData !== false,
        processes: bdcPhases.processes !== false,
        kyc: bdcPhases.kyc !== false,
        occupation: bdcPhases.occupation !== false,
      };

      const result = await queryBigDataCorpCombined(cpf, credentials, { processLimit, datasets });

      const phases = bdcConfig.phases || {};
      const updatePayload = {};
      const sources = {};
      let costBRL = 0;

      if (phases.basicData !== false) {
        const basicNorm = normalizeBigDataCorpBasicData(result.basicData);
        const { _source: basicSource, ...basicFields } = basicNorm;
        Object.assign(updatePayload, basicFields);
        sources.basicData = basicSource;
        costBRL += 0.03;
      }

      if (!options.skipGate && phases.basicData !== false && updatePayload.bigdatacorpCpfStatus !== undefined) {
        const nameFromBDC = updatePayload.bigdatacorpName || '';
        const nameProvided = caseData.candidateName || '';
        const minSim = bdcConfig.gate?.minNameSimilarity ?? 0.7;
        const cpfStatusBDC = (updatePayload.bigdatacorpCpfStatus || '').toUpperCase();
        const isCpfRegular = cpfStatusBDC === 'REGULAR';
        const isCpfPending = cpfStatusBDC.includes('PENDENTE');
        const isCpfCancelled = /CANCEL/.test(cpfStatusBDC);
        const cpfPasses = isCpfRegular || isCpfPending;
        const nameSim = computeNameSimilarity(nameFromBDC, nameProvided);
        const namePasses = minSim <= 0 || nameSim >= minSim;
        const hasDeathRecord = updatePayload.bigdatacorpHasDeathRecord === true;
        const gatePassed = cpfPasses && namePasses && !hasDeathRecord;

        const gateReason = isCpfCancelled ? `CPF status ${cpfStatusBDC} (cancelado)`
          : !cpfPasses ? `CPF status ${cpfStatusBDC}`
          : !namePasses ? `Similaridade insuficiente: ${nameSim.toFixed(2)} < ${minSim}`
          : hasDeathRecord ? 'Indicacao de obito'
          : 'OK';

        const bigdatacorpGateResult = {
          passed: gatePassed,
          cpfStatus: cpfStatusBDC,
          cpfPendingRegularization: isCpfPending,
          nameSimilarity: nameSim,
          nameProvided,
          nameFound: nameFromBDC,
          hasDeathRecord,
          reason: gateReason,
          source: 'bigdatacorp-basicdata',
          consultedAt: new Date().toISOString(),
        };

        if (!gatePassed) {
          return returnCaseForIdentityGateBlock({
            caseRef,
            caseId,
            caseData,
            provider: 'bigdatacorp',
            providerLabel: 'BigDataCorp',
            gateReason,
            updateFields: {
              ...updatePayload,
              bigdatacorpGateResult,
              bigdatacorpEnrichmentStatus: 'BLOCKED',
              bigdatacorpError: `Gate bloqueado: ${gateReason}`,
              bigdatacorpSources: sources,
              bigdatacorpCostBRL: costBRL,
              bigdatacorpElapsedMs: result.elapsedMs,
              bigdatacorpQueryDate: new Date().toISOString(),
            },
          });
        }

        updatePayload.bigdatacorpGateResult = bigdatacorpGateResult;
      }

      if (phases.processes !== false) {
        const processNorm = normalizeBigDataCorpProcesses(result.processes, cpf);
        const { _source: processSource, ...processFields } = processNorm;
        Object.assign(updatePayload, processFields);
        sources.processes = processSource;
        costBRL += 0.07;
      }

      if (phases.kyc !== false) {
        const kycNorm = normalizeBigDataCorpKyc(result.kycData);
        const { _source: kycSource, ...kycFields } = kycNorm;
        Object.assign(updatePayload, kycFields);
        sources.kyc = kycSource;
        costBRL += 0.05;
      }

      if (phases.occupation !== false) {
        const profNorm = normalizeBigDataCorpProfession(result.professionData);
        const { _source: profSource, ...profFields } = profNorm;
        Object.assign(updatePayload, profFields);
        sources.occupation = profSource;
        costBRL += 0.05;
      }

      await caseRef.update({
        ...updatePayload,
        bigdatacorpEnrichmentStatus: 'DONE',
        bigdatacorpError: null,
        bigdatacorpSources: sources,
        bigdatacorpCostBRL: costBRL,
        bigdatacorpElapsedMs: result.elapsedMs,
        bigdatacorpQueryDate: new Date().toISOString(),
        bigdatacorpEnrichedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(
        `Case ${caseId} [BigDataCorp]: DONE in ${result.elapsedMs}ms. ` +
        `Processos: ${updatePayload.bigdatacorpProcessTotal || 0}, ` +
        `Criminal: ${updatePayload.bigdatacorpCriminalFlag || 'NEGATIVE'}, ` +
        `PEP: ${updatePayload.bigdatacorpIsPep || false}, ` +
        `Sanctioned: ${updatePayload.bigdatacorpIsSanctioned || false}.`,
      );

      await recordSuccess('bigdatacorp');

      if (!options.skipAutoClassify) {
        await maybeRunAutoClassifyAndAi(caseRef, caseId, 'BigDataCorp', options);
      }

      return { status: 'DONE', error: null };
    } catch (err) {
      const errMsg = err instanceof BigDataCorpError
        ? `${err.message} (${err.statusCode})`
        : (err.message || 'Erro desconhecido');
      console.error(`Case ${caseId} [BigDataCorp]: failed:`, errMsg);
      await recordFailure('bigdatacorp', errMsg);
      await caseRef.update({
        bigdatacorpEnrichmentStatus: 'FAILED',
        bigdatacorpError: errMsg,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: 'FAILED', error: errMsg };
    }
  }

  /* =========================================================
     JUDIT — Enrichment Phase
     ========================================================= */

  async function runJuditEnrichmentPhase(caseRef, caseId, caseData, juditConfig, options = {}) {
    const cpf = (caseData.cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11) {
      const error = 'CPF invalido.';
      await caseRef.update({
        juditEnrichmentStatus: 'FAILED',
        juditError: error,
        juditPendingAsyncPhases: FieldValue.delete(),
        juditPendingAsyncCount: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: 'FAILED', error };
    }

    await caseRef.update({
      juditEnrichmentStatus: 'RUNNING',
      juditError: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const apiKey = juditApiKey.value();
    if (!apiKey) {
      const error = 'JUDIT_API_KEY nao configurado.';
      await caseRef.update({
        juditEnrichmentStatus: 'FAILED',
        juditError: error,
        juditPendingAsyncPhases: FieldValue.delete(),
        juditPendingAsyncCount: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: 'FAILED', error };
    }

    const juditCircuit = await checkCircuit('judit');
    if (juditCircuit.open) {
      console.warn(`Case ${caseId} [Judit]: circuit OPEN — skipping. ${juditCircuit.reason}`);
      await caseRef.update({
        juditEnrichmentStatus: 'SKIPPED',
        juditError: juditCircuit.reason,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: 'SKIPPED', error: juditCircuit.reason };
    }

    const phases = { ...(juditConfig.phases || {}) };
    const juditFilters = juditConfig.filters || {};

    let gateEntityData = null;
    let entityUfs = [];
    const bdcGatePassed = caseData.bigdatacorpEnrichmentStatus === 'DONE' && caseData.bigdatacorpGateResult?.passed === true;
    const shouldRunIdentityGate = !options.skipGate;
    if (shouldRunIdentityGate) {
      const existingGate = caseData.juditGateResult;
      if (existingGate?.passed === true) {
        console.log(`Case ${caseId} [Judit]: gate already passed (source: ${existingGate.source}), skipping gate.`);
        entityUfs = caseData.juditAllUfs || [];
      } else if (bdcGatePassed) {
        const bdcGate = caseData.bigdatacorpGateResult;
        console.log(`Case ${caseId} [Judit]: using BigDataCorp identity gate (similarity: ${((bdcGate.nameSimilarity || 0) * 100).toFixed(0)}%).`);

        const juditGateResult = {
          passed: true,
          cpfActive: true,
          cpfStatus: bdcGate.cpfStatus || 'REGULAR',
          cpfPendingRegularization: bdcGate.cpfPendingRegularization || false,
          nameSimilarity: bdcGate.nameSimilarity,
          nameProvided: bdcGate.nameProvided,
          nameFound: bdcGate.nameFound,
          hasDeathRecord: bdcGate.hasDeathRecord || false,
          reason: null,
          source: 'bigdatacorp-primary',
          consultedAt: new Date().toISOString(),
        };
        const fallbackIdentity = {
          name: caseData.bigdatacorpName || bdcGate.nameFound || '',
          cpfActive: true,
          cpfStatus: bdcGate.cpfStatus || 'REGULAR',
          birthDate: caseData.bigdatacorpBirthDate || null,
          hasDeathRecord: bdcGate.hasDeathRecord || false,
          consultedAt: new Date().toISOString(),
        };

        if (phases.entity !== false || juditFilters.autoTribunals === true) {
          try {
            const entityRaw = await queryEntityDataLake(cpf, apiKey);
            gateEntityData = normalizeJuditEntity(entityRaw, cpf);
            entityUfs = gateEntityData.juditAllUfs || [];
            console.log(`Case ${caseId} [Judit]: Entity UFs fetched: [${entityUfs.join(', ')}].`);

            await caseRef.update({
              juditIdentity: fallbackIdentity,
              juditGateResult,
              juditPrimaryUf: gateEntityData.juditPrimaryUf,
              juditAllUfs: entityUfs,
              juditHasLawsuits: gateEntityData.juditHasLawsuits,
              updatedAt: FieldValue.serverTimestamp(),
            });
          } catch (entityErr) {
            const uf = caseData.hiringUf || null;
            entityUfs = uf ? [uf] : [];
            console.warn(`Case ${caseId} [Judit]: Entity UF query failed (${entityErr.message}), using hiringUf=[${entityUfs.join(', ')}].`);

            await caseRef.update({
              juditIdentity: fallbackIdentity,
              juditGateResult,
              juditPrimaryUf: uf,
              juditAllUfs: entityUfs,
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        } else {
          const uf = caseData.hiringUf || null;
          entityUfs = Array.isArray(caseData.juditAllUfs) && caseData.juditAllUfs.length > 0
            ? caseData.juditAllUfs
            : (uf ? [uf] : []);
          console.log(`Case ${caseId} [Judit]: BDC gate reused; Judit Entity skipped by config. UFs=[${entityUfs.join(', ')}].`);
          await caseRef.update({
            juditIdentity: fallbackIdentity,
            juditGateResult,
            juditPrimaryUf: uf,
            juditAllUfs: entityUfs,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      } else {
        const bdcStatus = caseData.bigdatacorpEnrichmentStatus || 'N/A';
        console.log(`Case ${caseId} [Judit]: BDC status=${bdcStatus}, running Judit identity gate as fallback.`);
        try {
          const entityRaw = await queryEntityDataLake(cpf, apiKey);
          gateEntityData = normalizeJuditEntity(entityRaw, cpf);

          const { juditIdentity } = gateEntityData;
          const cpfActive = juditIdentity.cpfActive === true;
          const nameFromJudit = juditIdentity.name || '';
          const nameProvided = caseData.candidateName || '';
          const minSim = juditConfig.gate?.minNameSimilarity ?? 0.7;
          const nameSim = computeNameSimilarity(nameFromJudit, nameProvided);
          const namePasses = minSim <= 0 || nameSim >= minSim;
          const gatePassed = cpfActive && namePasses;

          let gateReason = null;
          if (!cpfActive) gateReason = 'CPF inativo na Receita Federal (Judit Entity).';
          else if (!namePasses) gateReason = `Similaridade de nome ${(nameSim * 100).toFixed(0)}% abaixo do limiar ${(minSim * 100).toFixed(0)}%.`;

          const juditGateResult = {
            passed: gatePassed,
            cpfActive,
            nameSimilarity: parseFloat(nameSim.toFixed(4)),
            nameProvided,
            nameFound: nameFromJudit,
            reason: gateReason,
            source: 'judit-entity',
            consultedAt: new Date().toISOString(),
          };

          if (!gatePassed) {
            return returnCaseForIdentityGateBlock({
              caseRef,
              caseId,
              caseData,
              provider: 'judit',
              providerLabel: 'Judit',
              gateReason,
              updateFields: {
                juditEnrichmentStatus: 'BLOCKED',
                juditError: null,
                juditIdentity,
                juditGateResult,
                juditPrimaryUf: gateEntityData.juditPrimaryUf,
                juditAllUfs: gateEntityData.juditAllUfs,
                juditSources: { entity: gateEntityData._source },
              },
            });
          }

          console.log(`Case ${caseId} [Judit]: gate PASSED (similarity: ${(nameSim * 100).toFixed(0)}%, CPF active).`);
          entityUfs = gateEntityData.juditAllUfs || [];

          await caseRef.update({
            juditIdentity,
            juditGateResult,
            juditPrimaryUf: gateEntityData.juditPrimaryUf,
            juditAllUfs: gateEntityData.juditAllUfs,
            juditHasLawsuits: gateEntityData.juditHasLawsuits,
            updatedAt: FieldValue.serverTimestamp(),
          });

        } catch (gateErr) {
          const gateErrMsg = gateErr instanceof JuditError
            ? `${gateErr.message} (${gateErr.statusCode})`
            : (gateErr.message || 'Erro desconhecido');
          console.warn(`Case ${caseId} [Judit]: entity gate failed: ${gateErrMsg}. Trying FonteData fallback.`);

          try {
            const fdApiKey = fontedataApiKey.value();
            if (fdApiKey) {
              const fdGate = normalizeReceitaFederal(await queryReceitaFederal(cpf, fdApiKey));
              const { enrichmentIdentity } = fdGate;
              const cpfStatus = (enrichmentIdentity?.cpfStatus || '').toUpperCase();
              const isCpfRegular = cpfStatus === 'REGULAR';
              const isCpfPending = cpfStatus.includes('PENDENTE');
              const isCpfCancelled = /CANCEL/.test(cpfStatus);
              const cpfActive = isCpfRegular || isCpfPending;
              const nameFromFD = enrichmentIdentity?.name || '';
              const nameProvided = caseData.candidateName || '';
              const minSim = juditConfig.gate?.minNameSimilarity ?? 0.7;
              const nameSim = computeNameSimilarity(nameFromFD, nameProvided);
              const namePasses = minSim <= 0 || nameSim >= minSim;
              const hasDeathRecord = enrichmentIdentity?.hasDeathRecord === true;
              const gatePassed = cpfActive && namePasses && !hasDeathRecord;

              let gateReason = null;
              if (isCpfCancelled) gateReason = `CPF com situacao "${cpfStatus}" (cancelado).`;
              else if (!cpfActive) gateReason = `CPF com situacao "${cpfStatus}" (esperado: REGULAR).`;
              else if (hasDeathRecord) gateReason = `CPF possui registro de obito (ano: ${enrichmentIdentity.deathYear || 'N/A'}).`;
              else if (!namePasses) gateReason = `Similaridade de nome ${(nameSim * 100).toFixed(0)}% abaixo do limiar ${(minSim * 100).toFixed(0)}%.`;

              const juditGateResult = {
                passed: gatePassed,
                cpfActive,
                cpfStatus,
                cpfPendingRegularization: isCpfPending,
                nameSimilarity: parseFloat(nameSim.toFixed(4)),
                nameProvided,
                nameFound: nameFromFD,
                hasDeathRecord,
                reason: gateReason,
                source: 'fontedata-fallback',
                consultedAt: new Date().toISOString(),
              };

              const fallbackIdentity = {
                name: nameFromFD,
                cpfActive: cpfActive,
                cpfStatus,
                birthDate: enrichmentIdentity?.birthDate || null,
                hasDeathRecord,
                consultedAt: new Date().toISOString(),
              };

              const uf = caseData.hiringUf || null;

              if (!gatePassed) {
                return returnCaseForIdentityGateBlock({
                  caseRef,
                  caseId,
                  caseData,
                  provider: 'fontedata-fallback',
                  providerLabel: 'FonteData fallback',
                  gateReason,
                  updateFields: {
                    juditEnrichmentStatus: 'BLOCKED',
                    juditError: null,
                    juditIdentity: fallbackIdentity,
                    juditGateResult,
                    enrichmentIdentity,
                    enrichmentGateResult: juditGateResult,
                    juditPrimaryUf: uf,
                    juditAllUfs: uf ? [uf] : [],
                    juditSources: { entity: { error: gateErrMsg, fallback: 'fontedata', ...fdGate._source } },
                  },
                });
              }

              console.log(`Case ${caseId} [Judit]: FonteData fallback gate PASSED.`);
              entityUfs = uf ? [uf] : [];
              await caseRef.update({
                juditIdentity: fallbackIdentity,
                juditGateResult,
                enrichmentIdentity,
                enrichmentGateResult: juditGateResult,
                juditPrimaryUf: uf,
                juditAllUfs: entityUfs,
                juditSources: { entity: { fallback: 'fontedata', ...fdGate._source } },
                updatedAt: FieldValue.serverTimestamp(),
              });
            } else {
              throw new Error('FONTEDATA_API_KEY nao configurado para fallback.');
            }
          } catch (fbErr) {
            const fbMsg = fbErr.message || 'Erro desconhecido';
            const error = `Gate falhou (Judit: ${gateErrMsg}; FonteData fallback: ${fbMsg})`;
            console.error(`Case ${caseId} [Judit]: both gates failed.`);
            await caseRef.update({
              juditEnrichmentStatus: 'FAILED',
              juditError: error,
              juditSources: { entity: { error: gateErrMsg, fallbackError: fbMsg, consultedAt: new Date().toISOString() } },
              juditPendingAsyncPhases: FieldValue.delete(),
              juditPendingAsyncCount: FieldValue.delete(),
              updatedAt: FieldValue.serverTimestamp(),
            });
            return { status: 'FAILED', error };
          }
        }
      }
    } else if (options.skipGate) {
      entityUfs = caseData.juditAllUfs || [];
    }

    const ufs = entityUfs.length > 0 ? entityUfs : (caseData.hiringUf ? [caseData.hiringUf] : []);
    let tribunals = juditFilters.tribunals?.length > 0 ? juditFilters.tribunals : [];
    if (tribunals.length === 0 && juditFilters.autoTribunals === true && ufs.length > 0) {
      tribunals = getJuditTribunais(ufs);
    }

    const isRerun = options.skipGate === true;
    const cacheTtlDays = isRerun ? (juditFilters.cacheTtlDays ?? 7) : 0;
    const savePersistence = juditConfig.persistence?.saveRawPayloads !== false;
    const useWebhook = juditFilters.useWebhook !== false;
    const callbackUrl = useWebhook ? buildJuditCallbackUrl() : null;

    console.log(`Case ${caseId} [Judit]: datalake-first strategy. CPF=${maskCpf(cpf)}, UFs=${ufs.join(',')}, tribunals=${tribunals.join(',') || 'all'}, cacheTtl=${cacheTtlDays}d, async=${juditFilters.useAsync === true ? 'FORCED' : 'off'}, webhook=${useWebhook ? 'on' : 'off'}`);

    const errors = [];
    let successCount = 0;
    let failCount = 0;
    let pendingCount = 0;

    const updatePayload = {};
    const juditSources = {};
    const juditRawPayloads = {};
    const juditRequestIds = { ...(caseData.juditRequestIds || {}) };
    const pendingAsyncPhases = [];
    const pendingWebhookRegistrations = [];
    if (gateEntityData) {
      juditSources.entity = gateEntityData._source;
    } else if (caseData.juditSources?.entity) {
      juditSources.entity = caseData.juditSources.entity;
    }

    if (phases.lawsuits !== false) {
      const useAsync = juditFilters.useAsync === true;
      try {
        let lawsuitsRaw;
        if (useAsync) {
          console.log(`Case ${caseId} [Judit]: lawsuits via ASYNC (datalake R$1.50/1k ou on_demand R$6.00/1k) — explicitly forced.`);
          lawsuitsRaw = await queryLawsuitsAsync(cpf, apiKey, { tribunals, cacheTtlDays });
        } else {
          console.log(`Case ${caseId} [Judit]: lawsuits via SYNC datalake (R$0.50) — default path.`);
          lawsuitsRaw = await queryLawsuitsSync(cpf, apiKey);
        }

        const lawsuitsNormalized = normalizeJuditLawsuits(lawsuitsRaw, cpf);
        const { _source: lawSource, ...lawFields } = lawsuitsNormalized;
        juditSources.lawsuits = lawSource;
        if (lawsuitsRaw.requestId) juditRequestIds.lawsuits = lawsuitsRaw.requestId;
        for (const [field, value] of Object.entries(lawFields)) {
          if (value !== undefined && value !== null) updatePayload[field] = value;
        }

        if (savePersistence) {
          juditRawPayloads.lawsuits = {
            requestId: lawsuitsRaw.requestId || null,
            request: lawsuitsRaw._request || null,
            method: useAsync ? 'async' : 'sync',
            responseCount: (lawsuitsRaw.responseData || []).length,
            consultedAt: new Date().toISOString(),
          };
        }
        successCount++;
      } catch (lawErr) {
        failCount++;
        const errMsg = lawErr instanceof JuditError
          ? `${lawErr.message} (${lawErr.statusCode})`
          : (lawErr.message || 'Erro desconhecido');
        errors.push(`lawsuits: ${errMsg}`);
        juditSources.lawsuits = { error: errMsg, consultedAt: new Date().toISOString() };
        console.error(`Case ${caseId} [Judit]: lawsuits failed:`, errMsg);
      }
    }

    let warrantSkippedByBdc = false;
    if (phases.warrant !== false) {
      if (
        ['DONE', 'PARTIAL'].includes(caseData.bigdatacorpEnrichmentStatus) &&
        caseData.bigdatacorpHasArrestWarrant === true
      ) {
        warrantSkippedByBdc = true;
        phases.warrant = false;
        console.log(`Case ${caseId} [Judit]: Warrant search SKIPPED — BigDataCorp already confirmed arrest warrant(s). Saving R$1.00.`);
      }
    }

    const parallelTasks = [];
    if (phases.warrant !== false) {
      parallelTasks.push({
        key: 'warrant',
        promise: queryWarrantAsync(cpf, apiKey, { tribunals, cacheTtlDays, callbackUrl })
          .then((data) => ({ raw: data, normalized: normalizeJuditWarrants(data) })),
      });
    }
    if (phases.execution !== false) {
      parallelTasks.push({
        key: 'execution',
        promise: queryExecutionAsync(cpf, apiKey, { tribunals, cacheTtlDays, callbackUrl })
          .then((data) => ({ raw: data, normalized: normalizeJuditExecution(data) })),
      });
    }

    if (parallelTasks.length > 0) {
      const parallelResults = await Promise.allSettled(parallelTasks.map((t) => t.promise));
      for (let i = 0; i < parallelTasks.length; i++) {
        const { key } = parallelTasks[i];
        const result = parallelResults[i];

        if (result.status === 'fulfilled') {
          const { raw, normalized } = result.value;
          if (raw?.requestId) juditRequestIds[key] = raw.requestId;

          if (raw?.webhookPending) {
            pendingCount++;
            pendingAsyncPhases.push(key);
            juditSources[key] = {
              provider: 'judit',
              endpoint: key,
              requestId: raw.requestId || null,
              status: 'PENDING_CALLBACK',
              callbackUrl,
              consultedAt: new Date().toISOString(),
            };
            if (key === 'warrant' && !updatePayload.juditWarrantNotes) {
              updatePayload.juditWarrantNotes = 'Consulta de mandados enviada a Judit e aguardando callback assincrono.';
            }
            if (key === 'execution' && !updatePayload.juditExecutionNotes) {
              updatePayload.juditExecutionNotes = 'Consulta de execucao penal enviada a Judit e aguardando callback assincrono.';
            }
            pendingWebhookRegistrations.push(
              registerJuditWebhookRequest({ db, FieldValue, requestId: raw.requestId, caseId, phaseType: key, payload: {
                tenantId: caseData.tenantId || null,
                callbackUrl,
                request: raw._request || null,
              } }),
            );
          } else {
            successCount++;
            const { _source, ...fields } = normalized;
            juditSources[key] = _source;
            for (const [field, value] of Object.entries(fields)) {
              if (value !== undefined && value !== null) updatePayload[field] = value;
            }
          }
          if (savePersistence) {
            juditRawPayloads[key] = {
              requestId: raw.requestId || null,
              request: raw._request || null,
              method: raw?.webhookPending ? 'async-callback' : 'async',
              webhookPending: raw?.webhookPending === true,
              callbackUrl: raw?.webhookPending ? callbackUrl : null,
              responseCount: Array.isArray(raw.responseData) ? raw.responseData.length : (Array.isArray(raw) ? raw.length : 0),
              consultedAt: new Date().toISOString(),
            };
          }
        } else {
          failCount++;
          const err = result.reason;
          const errMsg = err instanceof JuditError
            ? `${err.message} (${err.statusCode})`
            : (err.message || 'Erro desconhecido');
          errors.push(`${key}: ${errMsg}`);
          juditSources[key] = { error: errMsg, consultedAt: new Date().toISOString() };
          console.error(`Case ${caseId} [Judit]: phase ${key} failed:`, errMsg);
        }
      }
    }

    if (pendingWebhookRegistrations.length > 0) {
      await Promise.all(pendingWebhookRegistrations);
    }

    if (warrantSkippedByBdc) {
      successCount++;
      juditSources.warrant = {
        provider: 'judit',
        endpoint: 'warrant',
        status: 'SKIPPED_BDC_COVERED',
        reason: 'BigDataCorp already confirmed arrest warrant(s)',
        consultedAt: new Date().toISOString(),
      };
      if (!updatePayload.juditWarrantNotes) {
        updatePayload.juditWarrantNotes = 'Busca de mandados Judit omitida — BigDataCorp ja confirmou mandado(s) de prisao ativo(s).';
      }
    }

    const totalPhases = (phases.lawsuits !== false ? 1 : 0) + parallelTasks.length + (warrantSkippedByBdc ? 1 : 0);

    const nameConfig = juditConfig.nameSearchSupplement || {};
    const cpfLawsuitCount = updatePayload.juditProcessTotal || 0;
    const candidateName = caseData.candidateName || '';
    if (
      nameConfig.enabled !== false &&
      cpfLawsuitCount === 0 &&
      candidateName.length > 5 &&
      phases.lawsuits !== false
    ) {
      const maxCpfs = nameConfig.maxCpfsComNome ?? 3;
      const entityHomonymCount = gateEntityData?.juditIdentity?.cpfsComNome ?? null;
      const shouldSearch = entityHomonymCount !== null && entityHomonymCount <= maxCpfs;

      if (shouldSearch) {
        try {
          console.log(`Case ${caseId} [Judit]: CPF found 0 lawsuits. Supplementing with name search (nameLength=${candidateName.length}, maxCpfs=${maxCpfs}).`);

          const preferSync = nameConfig.preferSync !== false;
          let nameData;
          if (preferSync) {
            nameData = await queryLawsuitsSyncByName(candidateName, apiKey);
          } else {
            nameData = await queryLawsuitsByNameAsync(candidateName, apiKey, { cacheTtlDays });
          }

          const nameNormalized = normalizeJuditLawsuits(nameData, cpf);
          const { _source: nameSource, ...nameFields } = nameNormalized;

          const nameProcessCount = nameFields.juditProcessTotal || 0;
          if (nameProcessCount > 0) {
            updatePayload.juditNameSearchProcessTotal = nameProcessCount;
            updatePayload.juditNameSearchCriminalCount = nameFields.juditCriminalCount || 0;
            updatePayload.juditNameSearchFlag = 'FOUND';
            updatePayload.juditNameSearchSource = 'name';
            updatePayload.juditNameSearchMethod = preferSync ? 'sync' : 'async';
            juditSources.lawsuits_by_name = nameSource;

            if (!updatePayload.juditProcessTotal) {
              for (const [field, value] of Object.entries(nameFields)) {
                if (value !== undefined && value !== null) {
                  updatePayload[field] = value;
                }
              }
            }
            successCount++;
            console.log(`Case ${caseId} [Judit]: name search found ${nameProcessCount} lawsuit(s), ${nameFields.juditCriminalCount || 0} criminal.`);
          } else {
            console.log(`Case ${caseId} [Judit]: name search also found 0 lawsuits.`);
          }

          if (savePersistence) {
            juditRawPayloads.lawsuits_by_name = {
              requestId: nameData.requestId || null,
              request: nameData._request || null,
              method: preferSync ? 'sync' : 'async',
              responseCount: (nameData.responseData || []).length,
              consultedAt: new Date().toISOString(),
            };
          }
        } catch (nameErr) {
          const nameErrMsg = nameErr instanceof JuditError
            ? `${nameErr.message} (${nameErr.statusCode})`
            : (nameErr.message || 'Erro desconhecido');
          console.error(`Case ${caseId} [Judit]: name search supplement failed:`, nameErrMsg);
          juditSources.lawsuits_by_name = { error: nameErrMsg, consultedAt: new Date().toISOString() };
        }
      } else {
        if (entityHomonymCount === null) {
          console.log(`Case ${caseId} [Judit]: name search skipped — homonym count unavailable (Gate cadastral inactive or failed). Set juditNameSearchFlag=SKIPPED_HOMONYMS.`);
        } else {
          console.log(`Case ${caseId} [Judit]: name search skipped — ${entityHomonymCount} CPFs with same name exceeds max ${maxCpfs}.`);
        }
        updatePayload.juditNameSearchFlag = 'SKIPPED_HOMONYMS';
        updatePayload.juditNameSearchCpfsComNome = entityHomonymCount;
      }
    }

    let juditStatus;
    if (totalPhases === 0) {
      juditStatus = 'SKIPPED';
    } else if (pendingCount > 0) {
      juditStatus = 'RUNNING';
    } else if (failCount === 0) {
      juditStatus = 'DONE';
    } else if (successCount > 0) {
      juditStatus = 'PARTIAL';
    } else {
      juditStatus = 'FAILED';
    }

    const needsEscavador = evaluateEscavadorNeed(updatePayload, juditConfig);

    const error = errors.length > 0 ? errors.join('; ') : null;
    const persistencePayload = savePersistence ? { juditRawPayloads } : {};

    let juditCostBRL = 0;
    if (gateEntityData) juditCostBRL += 0.12;
    if (juditSources.lawsuits && !juditSources.lawsuits.error) {
      juditCostBRL += juditFilters.useAsync === true ? 1.50 : 0.50;
    }
    if (juditSources.warrant && !juditSources.warrant.error && juditSources.warrant.status !== 'SKIPPED_BDC_COVERED') juditCostBRL += 1.00;
    if (juditSources.execution && !juditSources.execution.error) juditCostBRL += 0.50;
    if (juditSources.lawsuits_by_name && !juditSources.lawsuits_by_name.error) juditCostBRL += 0.50;

    await caseRef.update({
      ...updatePayload,
      ...persistencePayload,
      juditEnrichmentStatus: juditStatus,
      juditEnrichmentStrategy: juditFilters.useAsync === true ? 'async' : 'datalake',
      juditPendingAsyncPhases: pendingAsyncPhases.length > 0 ? pendingAsyncPhases : FieldValue.delete(),
      juditPendingAsyncCount: pendingCount > 0 ? pendingCount : FieldValue.delete(),
      juditRequestIds: Object.keys(juditRequestIds).length > 0 ? juditRequestIds : FieldValue.delete(),
      juditSources,
      juditError: error,
      juditNeedsEscavador: needsEscavador,
      juditCostBRL,
      juditEnrichedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (!options.skipAutoClassify && (juditStatus === 'DONE' || juditStatus === 'PARTIAL')) {
      try {
        await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Judit completion');
      } catch (classifyErr) {
        console.error(`Case ${caseId} [AutoClassify]: error:`, classifyErr.message);
      }
    }

    console.log(
      `Case ${caseId} [Judit]: ${juditStatus} (strategy: ${juditFilters.useAsync === true ? 'async' : 'datalake'}). ` +
      `Phases: ${successCount}/${totalPhases}. ` +
      `Pending async: ${pendingCount}. ` +
      `Warrant: ${warrantSkippedByBdc ? 'SKIPPED_BDC' : (updatePayload.juditWarrantFlag || 'N/A')}, ` +
      `Processos: ${updatePayload.juditProcessTotal || 0}, ` +
      `NeedsEscavador: ${needsEscavador}, ` +
      `Tribunals filter: [${tribunals.join(',')}].`,
    );

    if (juditStatus === 'DONE' || juditStatus === 'PARTIAL') {
      await recordSuccess('judit');
    } else if (juditStatus === 'FAILED') {
      await recordFailure('judit', error || 'All phases failed');
    }

    return { status: juditStatus, error, needsEscavador };
  }

  /* =========================================================
     DJEN — Enrichment Phase
     ========================================================= */

  async function runDjenEnrichmentPhase(caseRef, caseId, caseData, djenConfig, options = {}) {
    await caseRef.update({
      djenEnrichmentStatus: 'RUNNING',
      djenError: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    try {
      const candidateName = caseData.candidateName || '';
      const candidateCpf = (caseData.cpf || '').replace(/\D/g, '');
      const strategy = djenConfig.searchStrategy || 'hybrid';

      const knownProcesses = extractKnownProcessNumbers(caseData);
      const knownProcessSet = new Set(knownProcesses);

      const allItems = [];
      const seenIds = new Set();
      let totalApiCount = 0;

      if (strategy === 'byProcess' || strategy === 'hybrid') {
        if (knownProcesses.length > 0) {
          console.log(`Case ${caseId} [DJEN]: phase 1 — querying ${knownProcesses.length} process(es) by number.`);

          for (const cnj of knownProcesses) {
            const result = await queryComunicacoesByProcesso(cnj);
            for (const item of result.items) {
              const key = item.id || item.numero_processo;
              if (!seenIds.has(key)) {
                seenIds.add(key);
                allItems.push(item);
              }
            }
            totalApiCount += result.count;
            if (knownProcesses.indexOf(cnj) < knownProcesses.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }
        } else if (strategy === 'byProcess') {
          console.log(`Case ${caseId} [DJEN]: no known processes to search, skipping.`);
          await caseRef.update({
            djenEnrichmentStatus: 'SKIPPED',
            djenError: null,
            djenNotes: 'Nenhum processo conhecido para buscar no DJEN.',
            updatedAt: FieldValue.serverTimestamp(),
          });
          return { status: 'SKIPPED', error: null };
        }
      }

      if (strategy === 'byName' || strategy === 'hybrid') {
        if (!candidateName) {
          if (strategy === 'byName') {
            await caseRef.update({
              djenEnrichmentStatus: 'FAILED',
              djenError: 'Nome do candidato não disponível.',
              updatedAt: FieldValue.serverTimestamp(),
            });
            return { status: 'FAILED', error: 'Nome do candidato não disponível.' };
          }
          console.log(`Case ${caseId} [DJEN]: no candidate name, skipping byName phase.`);
        } else {
          console.log(`Case ${caseId} [DJEN]: phase 2 — querying by name (nameLength=${candidateName.length})`);
          const nameResult = await queryComunicacoesByName(candidateName, {
            maxPages: djenConfig.maxPages || 3,
            siglaTribunal: djenConfig.filters?.siglaTribunal || undefined,
          });
          totalApiCount += nameResult.count;

          for (const item of nameResult.items) {
            const key = item.id || item.numero_processo;
            if (!seenIds.has(key)) {
              seenIds.add(key);
              allItems.push(item);
            }
          }
        }
      }

      const apiResult = {
        count: totalApiCount,
        items: allItems,
        _request: {
          endpoint: '/comunicacao',
          params: { strategy, processCount: knownProcesses.length, name: candidateName || null },
          duration: 0,
        },
      };

      const namesakeCount = caseData.bigdatacorpNamesakeCount || 0;
      const strictNameMatch = namesakeCount > 10;

      const candidateUfs = buildCandidateUfs(caseData);

      const normalized = normalizeDjenComunicacoes(apiResult, candidateName, candidateCpf, knownProcessSet, { strictNameMatch, candidateUfs, namesakeCount });
      const { _source, ...fields } = normalized;

      await caseRef.update({
        ...fields,
        djenEnrichmentStatus: 'DONE',
        djenError: null,
        djenSources: _source,
        djenEnrichedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(
        `Case ${caseId} [DJEN]: DONE (${strategy}). ` +
        `API total: ${apiResult.count}, Confirmed: ${fields.djenConfirmedTotal || 0}, ` +
        `Filtered out: ${fields.djenFilteredOutCount || 0}, ` +
        `Criminal: ${fields.djenCriminalFlag || 'NEGATIVE'}.`,
      );

      if (!options.skipAutoClassify) {
        try {
          await maybeRunAutoClassifyAndAi(caseRef, caseId, 'DJEN', options);
        } catch (classifyErr) {
          console.error(`Case ${caseId} [AutoClassify via DJEN]: error:`, classifyErr.message);
        }
      }

      return { status: 'DONE', error: null };
    } catch (err) {
      const errMsg = err instanceof DjenError
        ? `${err.message} (${err.statusCode})`
        : (err.message || 'Erro desconhecido');
      console.error(`Case ${caseId} [DJEN]: failed:`, errMsg);
      await caseRef.update({
        djenEnrichmentStatus: 'FAILED',
        djenError: errMsg,
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (!options.skipAutoClassify) {
        await maybeRunAutoClassifyAndAi(caseRef, caseId, 'DJEN failure', options);
      }

      return { status: 'FAILED', error: errMsg };
    }
  }

  /* =========================================================
     ESCAVADOR2 — Enrichment Phase
     ========================================================= */

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

  return {
    runFonteDataEnrichmentPhase,
    runEscavadorEnrichmentPhase,
    runBigDataCorpEnrichmentPhase,
    runJuditEnrichmentPhase,
    runDjenEnrichmentPhase,
    runEscavador2EnrichmentPhase,
  };
}

/* =========================================================
   FUNÇÕES PURAS (não precisam de dependências injetadas)
   ========================================================= */

function evaluateEscavadorNeed(juditResults, juditConfig) {
  const triggers = juditConfig.escalation?.triggerEscavador || ['criminal', 'warrant', 'execution', 'highProcessCount'];
  const threshold = juditConfig.escalation?.processCountThreshold || 5;

  if (triggers.includes('criminal') && juditResults.juditCriminalFlag === 'POSITIVE') return true;
  if (triggers.includes('warrant') && juditResults.juditWarrantFlag === 'POSITIVE') return true;
  if (triggers.includes('execution') && juditResults.juditExecutionFlag === 'POSITIVE') return true;
  if (triggers.includes('highProcessCount') && (juditResults.juditProcessTotal || 0) >= threshold) return true;

  return false;
}

function evaluateNegativePartialSafetyNet(caseData, autoClassification = {}) {
  const escavadorStatus = caseData.escavadorEnrichmentStatus;
  const escavadorAlreadyHandled = ['RUNNING', 'DONE', 'PARTIAL', 'FAILED', 'SKIPPED'].includes(escavadorStatus);
  const criminalFlag = autoClassification.criminalFlag;
  const criminalEvidenceQuality = autoClassification.criminalEvidenceQuality;
  const reasons = [];

  const hasCoverageRisk = autoClassification.coverageLevel === 'LOW_COVERAGE'
    || autoClassification.providerDivergence === 'HIGH'
    || ['NEGATIVE_WITH_PARTIAL_COVERAGE', 'LOW_COVERAGE_ONLY'].includes(criminalEvidenceQuality)
    || autoClassification.reviewRecommended === true;

  if (!['NEGATIVE', 'INCONCLUSIVE'].includes(criminalFlag) || !hasCoverageRisk) {
    return { eligible: false, reasons: [], action: 'NONE' };
  }

  if (escavadorAlreadyHandled) {
    return { eligible: false, reasons: [], action: 'NONE' };
  }

  if (autoClassification.coverageLevel === 'LOW_COVERAGE') {
    reasons.push('LOW_COVERAGE');
  }
  if (autoClassification.providerDivergence === 'HIGH') {
    reasons.push('HIGH_PROVIDER_DIVERGENCE');
  }
  if ((caseData.juditProcessTotal || 0) === 0) {
    reasons.push('JUDIT_ZERO_PROCESS');
  }
  if (caseData.juditNameSearchFlag === 'SKIPPED_HOMONYMS') {
    reasons.push('NAME_SEARCH_SKIPPED_HOMONYMS');
  }
  if (caseData.juditNameSearchFlag === 'FOUND') {
    reasons.push('NAME_SEARCH_ONLY_RESULT');
  }
  if (autoClassification.reviewRecommended) {
    reasons.push('MANUAL_REVIEW_RECOMMENDED');
  }

  return {
    eligible: reasons.length > 0,
    reasons,
    action: reasons.length > 0 ? 'RUN_ESCAVADOR' : 'NONE',
  };
}

function extractKnownProcessNumbers(caseData) {
  const numbers = new Set();

  const juditProcessos = caseData.juditProcessos || caseData.juditRoleSummary || [];
  for (const p of juditProcessos) {
    const cnj = p.cnj || p.numero || p.numeroCnj;
    if (cnj) numbers.add(cnj.replace(/\D/g, ''));
  }

  const escProcessos = caseData.escavadorProcessos || [];
  for (const p of escProcessos) {
    const cnj = p.numeroCnj || p.cnj;
    if (cnj) numbers.add(cnj.replace(/\D/g, ''));
  }

  const bdcProcessos = caseData.bigdatacorpProcessos || [];
  for (const p of bdcProcessos) {
    const cnj = p.numeroCnj || p.Number;
    if (cnj) numbers.add(cnj.replace(/\D/g, ''));
  }

  return [...numbers].filter((n) => n.length >= 15);
}

module.exports = {
  createEnrichmentPhases,
  evaluateEscavadorNeed,
  evaluateNegativePartialSafetyNet,
  extractKnownProcessNumbers,
};
