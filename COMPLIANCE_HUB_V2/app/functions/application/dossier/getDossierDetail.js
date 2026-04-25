/**
 * Application: Get Dossier Detail Use Case
 * Builds a complete, UI-ready dossier projection.
 */

const { getFirestore } = require('firebase-admin/firestore');
const { COLLECTIONS } = require('../../constants/collections');
const { buildDossierProjection } = require('../../domain/dossierSchema');

const db = getFirestore();

/**
 * Get dossier detail.
 * @param {object} params
 * @param {string} params.caseId
 * @param {string} params.tenantId
 * @param {string} [params.mode='analitico']
 * @returns {Promise<object>}
 */
async function execute(params) {
  const { caseId, tenantId, mode = 'analitico' } = params;

  const caseDoc = await db.collection(COLLECTIONS.CASES).doc(caseId).get();
  if (!caseDoc.exists || caseDoc.data().tenantId !== tenantId) {
    const error = new Error('Dossiê não encontrado.');
    error.code = 'DOSSIER_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const caseData = caseDoc.data();

  // Fetch related data in parallel
  const [subjectSnap, moduleRunsSnap, evidenceSnap, riskSnap, commentSnap] = await Promise.all([
    db.collection(COLLECTIONS.SUBJECTS).doc(caseData.subjectId).get(),
    db.collection(COLLECTIONS.MODULE_RUNS).where('caseId', '==', caseId).orderBy('createdAt', 'asc').get(),
    db.collection(COLLECTIONS.EVIDENCE_ITEMS).where('caseId', '==', caseId).orderBy('createdAt', 'asc').get(),
    db.collection(COLLECTIONS.RISK_SIGNALS).where('caseId', '==', caseId).orderBy('severity', 'desc').get(),
    db.collection('comments').where('caseId', '==', caseId).orderBy('createdAt', 'desc').get(),
  ]);

  const subject = subjectSnap.exists ? subjectSnap.data() : null;
  const moduleRuns = moduleRunsSnap.docs.map(d => d.data());
  const evidenceItems = evidenceSnap.docs.map(d => d.data());
  const riskSignals = riskSnap.docs.map(d => d.data());
  const comments = commentSnap.docs.map(d => d.data());

  // Build schema projection
  const projection = buildDossierProjection({
    schemaKey: caseData.schemaKey,
    moduleKeys: caseData.requestedSectionKeys,
    moduleRuns,
    requestedSectionKeys: caseData.requestedSectionKeys,
    requestedMacroAreaKeys: caseData.requestedMacroAreaKeys,
  });

  // Analytics
  const analytics = mode === 'analitico' ? buildAnalytics(evidenceItems) : null;

  return {
    id: caseDoc.id,
    numero: caseData.dossierNumber,
    modo: mode,
    alvo: {
      tipo: caseData.subjectType?.toUpperCase(),
      documento: caseData.documentFormatted,
      nome: caseData.name,
      idade: subject?.basicData?.age || null,
      data_nascimento: subject?.basicData?.birthDate || null,
    },
    metadata: {
      data_criacao: formatDate(caseData.createdAt),
      usuario_criador: caseData.createdByName,
      fontes_com_resultados: projection.summary?.sourcesWithResults || 0,
      fontes_sem_resultados: (projection.summary?.totalSources || 0) - (projection.summary?.sourcesWithResults || 0),
      perfil_consulta: caseData.presetKey,
      ultimo_processamento: formatDate(caseData.lastProcessedAt),
      homonimos: 'Único',
      flags: caseData.flags,
    },
    macro_areas: projection.macroAreas.map(area => ({
      areaKey: area.areaKey,
      label: area.label,
      icon: area.icon,
      order: area.order,
      totalSources: area.totalSources,
      sourcesWithResults: area.sourcesWithResults,
      sourcesUnavailable: area.sourcesUnavailable,
      sections: area.sections.map(s => ({
        sectionKey: s.sectionKey,
        label: s.label,
        executionStatus: s.executionStatus,
        statusLabel: s.statusLabel,
        statusVariant: s.statusVariant,
        hasFindings: s.hasFindings,
        resultCount: s.resultCount,
      })),
    })),
    processos_judiciais: extractProcesses(evidenceItems),
    metricas_analiticas: analytics,
    score: caseData.score || null,
    analise: {
      conclusiva: caseData.analysis?.conclusive || null,
      status_aprovacao: caseData.analysis?.status || 'pendente',
      comentarios: comments.map(c => ({
        id: c.id || '',
        texto: c.text,
        autor: c.authorName,
        data: formatDate(c.createdAt),
        relevante: c.isRelevant,
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(timestamp) {
  if (!timestamp) return null;
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('pt-BR');
}

function buildAnalytics(evidenceItems) {
  const processes = extractProcesses(evidenceItems);

  const statusCounts = {};
  const tribunalCounts = {};
  const assuntoCounts = {};
  const varaCounts = {};
  const classeCounts = {};

  for (const p of processes) {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    tribunalCounts[p.court] = (tribunalCounts[p.court] || 0) + 1;
    assuntoCounts[p.subject] = (assuntoCounts[p.subject] || 0) + 1;
    varaCounts[p.courtUnit] = (varaCounts[p.courtUnit] || 0) + 1;
    classeCounts[p.className] = (classeCounts[p.className] || 0) + 1;
  }

  return {
    total_processos: processes.length,
    processos_autor: processes.filter(p => p.participation === 'autor').length,
    processos_reu: processes.filter(p => p.participation === 'reu').length,
    processos_envolvido: processes.filter(p => p.participation === 'envolvido').length,
    processos_segredo: processes.filter(p => p.isSecret).length,
    graficos: {
      status_processos: statusCounts,
      por_tribunal: Object.entries(tribunalCounts).map(([nome, quantidade]) => ({ nome, quantidade })),
      por_assunto: Object.entries(assuntoCounts).map(([nome, quantidade]) => ({ nome, quantidade })),
      por_vara: Object.entries(varaCounts).map(([nome, quantidade]) => ({ nome, quantidade })),
      por_classe: Object.entries(classeCounts).map(([nome, quantidade]) => ({ nome, quantidade })),
    },
  };
}

function extractProcesses(evidenceItems) {
  const processes = [];
  for (const item of evidenceItems) {
    if (item.evidenceType === 'process_list' && item.content?.processes) {
      processes.push(...item.content.processes);
    }
  }
  return processes;
}

module.exports = { execute };
