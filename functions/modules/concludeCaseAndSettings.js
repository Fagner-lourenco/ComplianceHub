/**
 * concludeCaseAndSettings.js — Conclusão de casos e configurações do tenant
 * Extraído do monolito index.js durante refatoração Phase C
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');

const {
  buildExpandedKeyFindings,
  buildExecutiveSummaryFallback,
  buildSourceSummary,
  buildStatusSummary,
  buildNextSteps,
  buildReportSlug,
  buildTimelineEvents,
  calculateTurnaroundHours,
  buildSanitizedPublicResultSnapshot,
  hasMeaningfulValue,
  resolveNarrativeField,
  sanitizeNarrativesForFlags,
} = require('./reportEngine');

const { stripUndefined } = require('../helpers/normalize');

/* =========================================================
   Constantes
   ========================================================= */

const ALLOWED_CONCLUDE_FIELDS = new Set([
  'assigneeId',
  'executiveSummary',
  'criminalFlag',
  'criminalSeverity',
  'criminalNotes',
  'laborFlag',
  'laborSeverity',
  'laborNotes',
  'warrantFlag',
  'warrantNotes',
  'osintLevel',
  'osintVectors',
  'osintNotes',
  'socialStatus',
  'socialReasons',
  'socialNotes',
  'digitalFlag',
  'digitalVectors',
  'digitalNotes',
  'conflictInterest',
  'conflictNotes',
  'finalVerdict',
  'keyFindings',
  'analystComment',
  'enabledPhases',
  'clientVerdictOverride',
  'identityBypassed',
  'identityBypassJustification',
]);

const ALLOWED_DRAFT_FIELDS = new Set([
  'executiveSummary',
  'criminalFlag',
  'criminalSeverity',
  'criminalNotes',
  'laborFlag',
  'laborSeverity',
  'laborNotes',
  'warrantFlag',
  'warrantNotes',
  'osintLevel',
  'osintVectors',
  'osintNotes',
  'socialStatus',
  'socialReasons',
  'socialNotes',
  'digitalFlag',
  'digitalVectors',
  'digitalNotes',
  'conflictInterest',
  'conflictNotes',
  'finalVerdict',
  'keyFindings',
  'analystComment',
  'riskLevel',
  'riskScore',
]);

const FINAL_CRIMINAL_FLAGS = new Set(['NEGATIVE', 'POSITIVE', 'INCONCLUSIVE']);
const REVIEW_DRAFT_ARRAY_FIELDS = new Set([
  'keyFindings',
  'osintVectors',
  'socialReasons',
  'digitalVectors',
]);

/* =========================================================
   Funções puras de sanitização / normalização
   ========================================================= */

function sanitizeAiOutput(text) {
  if (typeof text !== 'string') return '';
  // Remove caracteres de controle C0 exceto TAB (0x09), LF (0x0A) e CR (0x0D)
  const ranges = [
    [0x00, 0x08], [0x0B, 0x0C], [0x0E, 0x1F], [0x7F, 0x7F],
  ];
  let cleaned = text;
  for (const [start, end] of ranges) {
    for (let code = start; code <= end; code += 1) {
      cleaned = cleaned.replaceAll(String.fromCharCode(code), '');
    }
  }
  return cleaned.trim();
}

function sanitizeStructuredText(value, maxLength = 500) {
  if (typeof value !== 'string') return '';
  const normalized = sanitizeAiOutput(value)
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!normalized) return '';
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

function sanitizeStructuredList(value, maxItems = 8, maxLength = 220) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeAiOutput(String(item || '')).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => (item.length > maxLength ? `${item.slice(0, maxLength - 3)}...` : item));
}

function normalizeKeyFindingsValue(value) {
  if (Array.isArray(value)) {
    return sanitizeStructuredList(value, 8, 220);
  }
  if (typeof value === 'string') {
    return sanitizeStructuredList(
      value.split(/\r?\n|;/).map((item) => item.trim()),
      8,
      220,
    );
  }
  return [];
}

function normalizeNarrativeValue(field, value, { defaultAnalysisConfig } = {}) {
  if (value === undefined) return undefined;
  if (field === 'enabledPhases') {
    const allowed = new Set(Object.keys(defaultAnalysisConfig || {}));
    return Array.isArray(value) ? value.filter((item) => allowed.has(item)) : [];
  }
  if (field === 'keyFindings') return normalizeKeyFindingsValue(value);
  if (REVIEW_DRAFT_ARRAY_FIELDS.has(field)) return Array.isArray(value) ? value.filter(Boolean) : [];
  if (typeof value === 'string') {
    const maxLength = field === 'executiveSummary' ? 900 : field === 'analystComment' ? 900 : 1400;
    return sanitizeStructuredText(value, maxLength);
  }
  return value;
}

/* =========================================================
   pickConcludePayload / pickDraftPayload
   ========================================================= */

function pickConcludePayload(payload = {}, { defaultAnalysisConfig } = {}) {
  const result = {};
  for (const [key, value] of Object.entries(payload || {})) {
    if (ALLOWED_CONCLUDE_FIELDS.has(key)) {
      result[key] = normalizeNarrativeValue(key, value, { defaultAnalysisConfig });
    }
  }
  result.status = 'DONE';
  result.concludedAt = FieldValue.serverTimestamp();
  result.correctionReason = FieldValue.delete();
  result.correctionNotes = FieldValue.delete();
  result.correctionRequestedAt = FieldValue.delete();
  result.correctionRequestedBy = FieldValue.delete();
  result.reviewDraft = FieldValue.delete();
  result.draftSavedAt = FieldValue.delete();
  result.updatedAt = FieldValue.serverTimestamp();
  return result;
}

function pickDraftPayload(payload = {}, existingReviewDraft = {}) {
  const reviewDraft = { ...(existingReviewDraft || {}) };
  for (const [key, value] of Object.entries(payload || {})) {
    if (ALLOWED_DRAFT_FIELDS.has(key)) {
      reviewDraft[key] = normalizeNarrativeValue(key, value);
    }
  }
  reviewDraft.__source = 'analyst';
  return {
    reviewDraft: stripUndefined(reviewDraft),
    draftSavedAt: new Date().toISOString(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

/* =========================================================
   Validação de flags finais
   ========================================================= */

function validateConcludeFinalFlags(payload = {}) {
  if (hasMeaningfulValue(payload.criminalFlag) && !FINAL_CRIMINAL_FLAGS.has(payload.criminalFlag)) {
    throw new HttpsError(
      'invalid-argument',
      'Selecione um resultado criminal final para concluir: Sem apontamento, Com apontamento ou Inconclusivo.',
    );
  }
}

/* =========================================================
   Validação completa do payload de conclusão (pura)
   ========================================================= */

function validateConcludePayload({
  caseData,
  payload,
  profile,
  tenantAnalysisConfig,
  canAssignCases,
  canBypassIdentityGate,
  isIdentityGateBlocked,
}) {
  // P2-015: assignee
  if (caseData.assigneeId && caseData.assigneeId !== profile.uid && !canAssignCases(profile)) {
    throw new HttpsError('permission-denied', 'Apenas o analista responsavel ou gestor pode concluir este caso.');
  }

  // P2-012: enabledPhases
  const requiredPhases = Object.entries(tenantAnalysisConfig || {})
    .filter(([, value]) => value?.enabled)
    .map(([key]) => key);
  const payloadEnabledPhases = Array.isArray(payload.enabledPhases) ? payload.enabledPhases : [];
  if (payloadEnabledPhases.length > 0) {
    const missingRequired = requiredPhases.filter((phase) => !payloadEnabledPhases.includes(phase));
    if (missingRequired.length > 0) {
      throw new HttpsError('invalid-argument', `enabledPhases deve conter as fases obrigatorias configuradas: ${missingRequired.join(', ')}.`);
    }
  }

  // Identity gate
  const identityGateBlocked = isIdentityGateBlocked(caseData);
  const identityBypassRequested = payload.identityBypassed === true;
  let identityBypassJustification = null;

  if (identityGateBlocked && !identityBypassRequested) {
    throw new HttpsError(
      'failed-precondition',
      'Este caso possui o gate de identidade bloqueado. Corrija os dados do candidato ou solicite o bypass administrativo de um supervisor.',
    );
  }

  if (identityBypassRequested) {
    if (!canBypassIdentityGate(profile)) {
      throw new HttpsError('permission-denied', 'Apenas supervisores e administradores podem realizar o bypass do gate de identidade.');
    }
    if (!identityGateBlocked) {
      throw new HttpsError('failed-precondition', 'Bypass de identidade so pode ser usado quando ha gate de identidade bloqueado.');
    }
    identityBypassJustification = String(payload.identityBypassJustification || '').trim();
    if (identityBypassJustification.length < 15) {
      throw new HttpsError('invalid-argument', 'A justificativa para o bypass de identidade deve conter no minimo 15 caracteres.');
    }
  }

  // Status
  const allowedConcludeStatuses = ['PENDING', 'IN_PROGRESS', 'ANALYSIS_READY'];
  if (identityBypassRequested) {
    allowedConcludeStatuses.push('CORRECTION_NEEDED');
  }
  if (!allowedConcludeStatuses.includes(caseData.status)) {
    throw new HttpsError('failed-precondition', `Caso nao pode ser concluido (status: ${caseData.status || 'desconhecido'}).`);
  }

  // Dependências de campos
  const dependencyRules = [
    { field: 'criminalSeverity', requires: 'criminalFlag', message: 'Severidade criminal requer flag criminal.' },
    { field: 'laborSeverity', requires: 'laborFlag', message: 'Severidade trabalhista requer flag trabalhista.' },
    { field: 'criminalNotes', requires: 'criminalFlag', message: 'Notas criminal requerem flag criminal.' },
    { field: 'laborNotes', requires: 'laborFlag', message: 'Notas trabalhista requerem flag trabalhista.' },
    { field: 'warrantNotes', requires: 'warrantFlag', message: 'Notas de mandado requerem flag de mandado.' },
    { field: 'osintVectors', requires: 'osintLevel', message: 'Vetores OSINT requerem nivel OSINT.' },
    { field: 'socialReasons', requires: 'socialStatus', message: 'Razoes social requerem status social.' },
    { field: 'digitalVectors', requires: 'digitalFlag', message: 'Vetores digital requerem flag digital.' },
  ];
  for (const rule of dependencyRules) {
    if (hasMeaningfulValue(payload[rule.field]) && !hasMeaningfulValue(payload[rule.requires])) {
      throw new HttpsError('invalid-argument', rule.message);
    }
  }

  // analystComment obrigatório
  if (!hasMeaningfulValue(payload.analystComment)) {
    throw new HttpsError('invalid-argument', 'Justificativa final (analystComment) é obrigatória para conclusão do caso.');
  }

  // Mandados ativos
  const juditActiveWarrants = caseData.juditActiveWarrantCount || 0;
  const bdcActiveWarrants = Array.isArray(caseData.bigdatacorpActiveWarrants)
    ? caseData.bigdatacorpActiveWarrants.filter((w) => w?.isActive !== false).length
    : 0;
  const totalActiveWarrants = juditActiveWarrants + bdcActiveWarrants;
  const effectiveWarrantFlag =
    payload.warrantFlag ||
    caseData.reviewDraft?.warrantFlag ||
    caseData.warrantFlag ||
    null;
  if (totalActiveWarrants > 0 && !['POSITIVE', 'INCONCLUSIVE'].includes(effectiveWarrantFlag)) {
    throw new HttpsError('failed-precondition', `Caso possui ${totalActiveWarrants} mandado(s) ativo(s). O campo Mandado de Prisao deve ser POSITIVO ou INCONCLUSIVO para concluir.`);
  }

  // Execução penal
  const hasPenalExecution =
    caseData.juditExecutionFlag === 'POSITIVE' ||
    Number(caseData.juditExecutionCount || 0) > 0;
  const effectiveCriminalFlag =
    payload.criminalFlag ||
    caseData.reviewDraft?.criminalFlag ||
    caseData.criminalFlag ||
    null;
  if (hasPenalExecution && !['POSITIVE', 'INCONCLUSIVE'].includes(effectiveCriminalFlag)) {
    throw new HttpsError('failed-precondition', 'Caso possui execucao penal positiva. Revise o campo criminal antes de concluir.');
  }

  return { identityBypassRequested, identityBypassJustification };
}

/* =========================================================
   Construção do updatePayload de conclusão (pura)
   ========================================================= */

function buildConcludeUpdatePayload({
  caseData,
  payload,
  conclusionTimestamp,
  calculateRiskScore,
  defaultAnalysisConfig,
}) {
  const updatePayload = pickConcludePayload(payload, { defaultAnalysisConfig });

  // Identity bypass
  if (payload.identityBypassed === true) {
    updatePayload.identityBypassed = true;
    updatePayload.identityBypassJustification = payload.identityBypassJustification;
    updatePayload.identityBypassedBy = payload.profileEmail || payload.profileUid;
    updatePayload.identityBypassedAt = new Date().toISOString();
  }

  if (!updatePayload.assigneeId) {
    updatePayload.assigneeId = caseData.assigneeId || payload.profileUid;
  }

  // Narrativas
  updatePayload.executiveSummary = resolveNarrativeField(caseData, payload, 'executiveSummary', {
    fallbackValue: () => buildExecutiveSummaryFallback({ ...caseData, ...updatePayload }),
  });
  updatePayload.keyFindings = resolveNarrativeField(caseData, payload, 'keyFindings', {
    fallbackValue: () => buildExpandedKeyFindings({ ...caseData, ...updatePayload }, updatePayload),
    defaultValue: [],
  });
  updatePayload.criminalNotes = resolveNarrativeField(caseData, payload, 'criminalNotes');
  updatePayload.laborNotes = resolveNarrativeField(caseData, payload, 'laborNotes');
  updatePayload.warrantNotes = resolveNarrativeField(caseData, payload, 'warrantNotes');
  updatePayload.osintNotes = resolveNarrativeField(caseData, payload, 'osintNotes');
  updatePayload.socialNotes = resolveNarrativeField(caseData, payload, 'socialNotes');
  updatePayload.digitalNotes = resolveNarrativeField(caseData, payload, 'digitalNotes');
  updatePayload.conflictNotes = resolveNarrativeField(caseData, payload, 'conflictNotes');
  updatePayload.analystComment = resolveNarrativeField(caseData, payload, 'analystComment', {
    prefillKey: 'finalJustification',
  });

  // Sanitização de narrativas
  const narrativeConsistency = sanitizeNarrativesForFlags({ ...caseData, ...updatePayload }, {
    criminalNotes: updatePayload.criminalNotes,
    laborNotes: updatePayload.laborNotes,
    warrantNotes: updatePayload.warrantNotes,
  });
  updatePayload.criminalNotes = narrativeConsistency.narratives.criminalNotes;
  updatePayload.laborNotes = narrativeConsistency.narratives.laborNotes;
  updatePayload.warrantNotes = narrativeConsistency.narratives.warrantNotes;
  if (narrativeConsistency.warnings.length > 0) {
    updatePayload.narrativeConsistencyWarnings = narrativeConsistency.warnings;
  }

  // Flags fallback do reviewDraft
  const reviewDraft = caseData?.reviewDraft || {};
  const flagFields = [
    'criminalFlag', 'criminalSeverity', 'laborFlag', 'laborSeverity',
    'warrantFlag', 'osintLevel', 'socialStatus', 'digitalFlag',
    'conflictInterest', 'finalVerdict', 'riskLevel', 'riskScore',
  ];
  for (const ff of flagFields) {
    if (!hasMeaningfulValue(updatePayload[ff]) && hasMeaningfulValue(reviewDraft[ff])) {
      updatePayload[ff] = reviewDraft[ff];
    }
  }
  validateConcludeFinalFlags(updatePayload);

  // Array fields fallback
  const arrayFlagFields = ['osintVectors', 'socialReasons', 'digitalVectors'];
  for (const af of arrayFlagFields) {
    if (!hasMeaningfulValue(updatePayload[af]) && hasMeaningfulValue(reviewDraft[af])) {
      updatePayload[af] = reviewDraft[af];
    }
  }

  // Segunda passada de sanitização
  const finalNarrativeConsistency = sanitizeNarrativesForFlags({ ...caseData, ...updatePayload }, {
    criminalNotes: updatePayload.criminalNotes,
    laborNotes: updatePayload.laborNotes,
    warrantNotes: updatePayload.warrantNotes,
  });
  updatePayload.criminalNotes = finalNarrativeConsistency.narratives.criminalNotes;
  updatePayload.laborNotes = finalNarrativeConsistency.narratives.laborNotes;
  updatePayload.warrantNotes = finalNarrativeConsistency.narratives.warrantNotes;
  const allNarrativeWarnings = [
    ...(updatePayload.narrativeConsistencyWarnings || []),
    ...finalNarrativeConsistency.warnings,
  ];
  if (allNarrativeWarnings.length > 0) {
    updatePayload.narrativeConsistencyWarnings = allNarrativeWarnings;
  }

  // Cálculo de risco
  {
    const riskInput = {
      criminalFlag:     updatePayload.criminalFlag     || caseData.criminalFlag,
      criminalSeverity: updatePayload.criminalSeverity || caseData.criminalSeverity,
      laborFlag:        updatePayload.laborFlag        || caseData.laborFlag,
      warrantFlag:      updatePayload.warrantFlag      || caseData.warrantFlag,
      osintLevel:       updatePayload.osintLevel       || caseData.osintLevel,
      socialStatus:     updatePayload.socialStatus     || caseData.socialStatus,
      digitalFlag:      updatePayload.digitalFlag      || caseData.digitalFlag,
      conflictInterest: updatePayload.conflictInterest || caseData.conflictInterest,
      cpfPendingRegularization: caseData.cpfPendingRegularization === true,
    };
    const phases = caseData.enabledPhases || updatePayload.enabledPhases;
    const riskResult = calculateRiskScore(riskInput, phases);
    updatePayload.riskScore = riskResult.riskScore;
    updatePayload.riskLevel = riskResult.riskLevel;
    updatePayload.suggestedVerdict = riskResult.suggestedVerdict;
  }

  // Campos derivados de publicação
  const derivedCaseForPublish = { ...caseData, ...updatePayload, status: 'DONE' };
  updatePayload.sourceSummary = buildSourceSummary(derivedCaseForPublish);
  updatePayload.statusSummary = hasMeaningfulValue(updatePayload.statusSummary)
    ? updatePayload.statusSummary
    : buildStatusSummary(derivedCaseForPublish);
  updatePayload.nextSteps = Array.isArray(updatePayload.nextSteps) && updatePayload.nextSteps.length > 0
    ? sanitizeStructuredList(updatePayload.nextSteps, 6, 220)
    : buildNextSteps(derivedCaseForPublish);
  updatePayload.timelineEvents = buildTimelineEvents(derivedCaseForPublish, {
    concludedAtOverride: conclusionTimestamp,
  });
  updatePayload.reportSlug = hasMeaningfulValue(caseData.reportSlug)
    ? caseData.reportSlug
    : buildReportSlug(caseData.id || payload.caseId, derivedCaseForPublish);
  const turnaroundHours = calculateTurnaroundHours(caseData, conclusionTimestamp);
  if (turnaroundHours != null) {
    updatePayload.turnaroundHours = turnaroundHours;
  }

  const hasMinContent = hasMeaningfulValue(updatePayload.finalVerdict) &&
    (
      hasMeaningfulValue(updatePayload.executiveSummary)
      || (Array.isArray(updatePayload.keyFindings) && updatePayload.keyFindings.length > 0)
      || hasMeaningfulValue(updatePayload.analystComment)
    );
  updatePayload.reportReady = hasMinContent;

  // P3-002: hasNotes server-side
  updatePayload.hasNotes = Boolean(
    updatePayload.analystComment || updatePayload.executiveSummary || caseData.clientNotes
  );

  return updatePayload;
}

/* =========================================================
   syncPublicResultLatest
   ========================================================= */

async function syncPublicResultLatest(caseId, caseData, payload = {}, options = {}, db) {
  const publicData = buildSanitizedPublicResultSnapshot(caseId, caseData, payload, options);
  const writePayload = {
    ...publicData,
    publishedAt: FieldValue.serverTimestamp(),
  };
  if (!writePayload.concludedAt) {
    writePayload.concludedAt = options.concludedAtOverride || FieldValue.serverTimestamp();
  }
  await db.collection('cases').doc(caseId).collection('publicResult').doc('latest').set(writePayload);
  return publicData;
}

/* =========================================================
   Factories de handlers onCall
   ========================================================= */

function createConcludeCaseByAnalystHandler({
  db,
  getOpsUserProfile,
  assertOpsCanAccessCase,
  canAssignCases,
  canBypassIdentityGate,
  isIdentityGateBlocked,
  getTenantSettingsData,
  calculateRiskScore,
  createCaseCompletedNotifications,
  writeAuditEvent,
  getClientIp,
  defaultAnalysisConfig,
  ACTOR_TYPE,
  SOURCE,
}) {
  return onCall(
    { region: 'southamerica-east1', timeoutSeconds: 120, cors: true },
    async (request) => {
      const uid = request.auth?.uid;
      if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

      const profile = await getOpsUserProfile(uid);
      const caseId = String(request.data?.caseId || '').trim();
      const payload = request.data?.payload || {};
      if (!caseId) throw new HttpsError('invalid-argument', 'caseId obrigatorio.');

      const caseRef = db.collection('cases').doc(caseId);
      const caseDoc = await caseRef.get();
      if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');
      const caseData = caseDoc.data() || {};

      assertOpsCanAccessCase(profile, caseData, caseId);

      const tenantData = await getTenantSettingsData(caseData.tenantId);
      const tenantAnalysisConfig = tenantData?.analysisConfig || defaultAnalysisConfig;

      const { identityBypassRequested, identityBypassJustification } = validateConcludePayload({
        caseData,
        payload,
        profile: { ...profile, uid },
        tenantAnalysisConfig,
        canAssignCases,
        canBypassIdentityGate,
        isIdentityGateBlocked,
      });

      const conclusionTimestamp = new Date();
      const updatePayload = buildConcludeUpdatePayload({
        caseData,
        payload: {
          ...payload,
          identityBypassed: identityBypassRequested,
          identityBypassJustification,
          profileEmail: profile.email,
          profileUid: uid,
        },
        conclusionTimestamp,
        calculateRiskScore,
        defaultAnalysisConfig,
      });

      const publicData = buildSanitizedPublicResultSnapshot(caseId, caseData, updatePayload, {
        concludedAtOverride: conclusionTimestamp,
      });
      const publicWritePayload = {
        ...publicData,
        publishedAt: FieldValue.serverTimestamp(),
        concludedAt: publicData.concludedAt || conclusionTimestamp,
      };

      const concludeBatch = db.batch();
      concludeBatch.update(caseRef, updatePayload);
      concludeBatch.set(caseRef.collection('publicResult').doc('latest'), publicWritePayload);
      await concludeBatch.commit();

      await writeAuditEvent({
        action: 'CASE_CONCLUDED',
        tenantId: caseData.tenantId || null,
        actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
        entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
        related: { caseId },
        source: SOURCE.PORTAL_OPS,
        ip: getClientIp(request),
        detail: `Caso concluido para ${caseData.candidateName || caseId}`,
      });

      if (identityBypassRequested) {
        await writeAuditEvent({
          action: 'CASE_IDENTITY_BYPASSED',
          tenantId: caseData.tenantId || null,
          actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
          entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
          related: { caseId },
          source: SOURCE.PORTAL_OPS,
          ip: getClientIp(request),
          detail: `Bypass do gate de identidade realizado por ${profile.email || uid}. Justificativa: ${identityBypassJustification}`,
          templateVars: {
            justification: identityBypassJustification,
            actorName: profile.displayName || profile.email || uid,
          },
        });
      }

      try {
        const concludedCaseSnap = await caseRef.get();
        if (concludedCaseSnap.exists) {
          await createCaseCompletedNotifications(caseId, concludedCaseSnap.data());
        }
      } catch (err) {
        console.warn('[notifications] failed to create case completed notifications', err);
      }

      return { success: true };
    },
  );
}

function createUpdateTenantSettingsByAnalystHandler({
  db,
  getOpsUserProfile,
  writeAuditEvent,
  getClientIp,
  ACTOR_TYPE,
  SOURCE,
}) {
  return onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60, cors: true },
    async (request) => {
      const uid = request.auth?.uid;
      if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

      const profile = await getOpsUserProfile(uid);
      if (profile.role !== 'admin' && profile.role !== 'owner') {
        throw new HttpsError('permission-denied', 'Apenas administradores podem alterar configuracoes do tenant.');
      }

      const tenantId = String(request.data?.tenantId || '').trim();
      const analysisConfig = request.data?.analysisConfig || {};
      const limits = request.data?.limits || {};
      const enrichmentConfig = request.data?.enrichmentConfig;

      if (!tenantId) throw new HttpsError('invalid-argument', 'tenantId obrigatorio.');

      const tenantExists = await db.collection('tenantSettings').doc(tenantId).get();
      if (!tenantExists.exists) {
        throw new HttpsError('not-found', `Tenant "${tenantId}" nao encontrado.`);
      }

      if (limits.dailyLimit !== null && limits.dailyLimit !== undefined) {
        const daily = Number(limits.dailyLimit);
        if (Number.isNaN(daily) || daily < 0 || !Number.isFinite(daily)) {
          throw new HttpsError('invalid-argument', 'Limite diario invalido.');
        }
      }
      if (limits.monthlyLimit !== null && limits.monthlyLimit !== undefined) {
        const monthly = Number(limits.monthlyLimit);
        if (Number.isNaN(monthly) || monthly < 0 || !Number.isFinite(monthly)) {
          throw new HttpsError('invalid-argument', 'Limite mensal invalido.');
        }
      }

      const payload = {
        analysisConfig,
        updatedAt: FieldValue.serverTimestamp(),
        dailyLimit: limits.dailyLimit ?? null,
        monthlyLimit: limits.monthlyLimit ?? null,
        allowDailyExceedance: limits.allowDailyExceedance !== false,
        allowMonthlyExceedance: limits.allowMonthlyExceedance === true,
      };
      if (enrichmentConfig !== undefined) {
        payload.enrichmentConfig = enrichmentConfig;
      }
      if (limits.slaHours !== null && limits.slaHours !== undefined) {
        const sla = Number(limits.slaHours);
        if (Number.isNaN(sla) || sla < 1 || !Number.isFinite(sla)) {
          throw new HttpsError('invalid-argument', 'SLA invalido. Deve ser um numero positivo de horas.');
        }
        payload.slaHours = sla;
      }

      await db.collection('tenantSettings').doc(tenantId).set(payload, { merge: true });

      await writeAuditEvent({
        action: 'TENANT_CONFIG_UPDATED',
        tenantId,
        actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
        entity: { type: 'SETTINGS', id: tenantId, label: tenantId },
        source: SOURCE.PORTAL_OPS,
        ip: getClientIp(request),
        detail: `Configuracoes atualizadas para ${tenantId}`,
        templateVars: { tenantId },
      });

      return { success: true };
    },
  );
}

function createSaveCaseDraftByAnalystHandler({
  db,
  getOpsUserProfile,
  assertOpsCanAccessCase,
  writeAuditEvent,
  getClientIp,
  ACTOR_TYPE,
  SOURCE,
}) {
  return onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60, cors: true },
    async (request) => {
      const uid = request.auth?.uid;
      if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

      const profile = await getOpsUserProfile(uid);
      const caseId = String(request.data?.caseId || '').trim();
      const payload = request.data?.payload || {};
      if (!caseId) throw new HttpsError('invalid-argument', 'caseId obrigatorio.');

      const caseRef = db.collection('cases').doc(caseId);
      const caseDoc = await caseRef.get();
      if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');
      const caseData = caseDoc.data() || {};

      assertOpsCanAccessCase(profile, caseData, caseId);

      if (['DONE', 'CORRECTION_NEEDED', 'WAITING_INFO'].includes(caseData.status)) {
        throw new HttpsError('failed-precondition', 'Nao e possivel salvar rascunho neste status do caso.');
      }
      if (
        caseData.assigneeId &&
        caseData.assigneeId !== uid &&
        !['supervisor', 'admin', 'owner'].includes(profile.role)
      ) {
        throw new HttpsError('permission-denied', 'Caso atribuido a outro analista. Assuma ou redistribua o caso antes de salvar rascunho.');
      }

      const updatePayload = pickDraftPayload(payload, caseData.reviewDraft || {});
      await caseRef.update(updatePayload);

      await writeAuditEvent({
        action: 'CASE_DRAFT_SAVED',
        tenantId: caseData.tenantId || null,
        actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
        entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
        related: { caseId },
        source: SOURCE.PORTAL_OPS,
        ip: getClientIp(request),
        detail: `Rascunho salvo para ${caseData.candidateName || caseId}`,
      });

      return { success: true };
    },
  );
}

function createSetAiDecisionByAnalystHandler({
  db,
  getOpsUserProfile,
  assertOpsCanAccessCase,
  writeAuditEvent,
  getClientIp,
  ACTOR_TYPE,
  SOURCE,
}) {
  return onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60, cors: true },
    async (request) => {
      const uid = request.auth?.uid;
      if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

      const profile = await getOpsUserProfile(uid);
      const caseId = String(request.data?.caseId || '').trim();
      const decision = String(request.data?.decision || '').trim();
      const allowedDecisions = new Set(['ACCEPTED', 'ADJUSTED', 'IGNORED']);

      if (!caseId || !allowedDecisions.has(decision)) {
        throw new HttpsError('invalid-argument', 'caseId e aiDecision validos sao obrigatorios.');
      }

      const caseRef = db.collection('cases').doc(caseId);
      const caseDoc = await caseRef.get();
      if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');
      const caseData = caseDoc.data() || {};
      assertOpsCanAccessCase(profile, caseData, caseId);

      const updateFields = {
        aiDecision: decision,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (decision === 'ACCEPTED' && caseData.aiStructured) {
        const ai = caseData.aiStructured;
        if (typeof ai.sugestaoScore === 'number') {
          updateFields.aiAcceptedScore = ai.sugestaoScore;
        }
        if (ai.sugestaoVeredito) {
          updateFields.aiAcceptedVeredito = ai.sugestaoVeredito;
        }
      }
      await caseRef.update(updateFields);

      await writeAuditEvent({
        action: 'AI_DECISION_SET',
        tenantId: caseData.tenantId || null,
        actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
        entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
        related: { caseId },
        source: SOURCE.PORTAL_OPS,
        ip: getClientIp(request),
        detail: `Decisao IA atualizada para ${decision} em ${caseData.candidateName || caseId}`,
        templateVars: { decision },
      });

      return { success: true };
    },
  );
}

/* =========================================================
   Exports
   ========================================================= */

module.exports = {
  // Constantes
  ALLOWED_CONCLUDE_FIELDS,
  ALLOWED_DRAFT_FIELDS,
  FINAL_CRIMINAL_FLAGS,
  REVIEW_DRAFT_ARRAY_FIELDS,

  // Funções puras
  sanitizeAiOutput,
  sanitizeStructuredText,
  sanitizeStructuredList,
  normalizeKeyFindingsValue,
  normalizeNarrativeValue,
  pickConcludePayload,
  pickDraftPayload,
  validateConcludeFinalFlags,
  validateConcludePayload,
  buildConcludeUpdatePayload,
  syncPublicResultLatest,

  // Handlers
  createConcludeCaseByAnalystHandler,
  createUpdateTenantSettingsByAnalystHandler,
  createSaveCaseDraftByAnalystHandler,
  createSetAiDecisionByAnalystHandler,
};
