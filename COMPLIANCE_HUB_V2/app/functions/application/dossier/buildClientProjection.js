/**
 * Application: Build Client Projection
 * Pre-computes UI-ready data and stores in clientProjections collection.
 */

const { getFirestore } = require('firebase-admin/firestore');
const { COLLECTIONS } = require('../../constants/collections');
const { buildDossierProjection } = require('../../domain/dossierSchema');

const db = getFirestore();

/**
 * Build and save a client projection for a case.
 * @param {string} caseId
 * @returns {Promise<object>}
 */
async function execute(caseId) {
  const caseDoc = await db.collection(COLLECTIONS.CASES).doc(caseId).get();
  if (!caseDoc.exists) return null;

  const caseData = caseDoc.data();
  const tenantId = caseData.tenantId;

  // Fetch related data
  const [moduleRunsSnap, evidenceSnap, riskSnap, commentSnap] = await Promise.all([
    db.collection(COLLECTIONS.MODULE_RUNS).where('caseId', '==', caseId).orderBy('createdAt', 'asc').get(),
    db.collection(COLLECTIONS.EVIDENCE_ITEMS).where('caseId', '==', caseId).orderBy('createdAt', 'asc').get(),
    db.collection(COLLECTIONS.RISK_SIGNALS).where('caseId', '==', caseId).orderBy('severity', 'desc').get(),
    db.collection('comments').where('caseId', '==', caseId).orderBy('createdAt', 'desc').get(),
  ]);

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

  // Build list item (lightweight)
  const dossierListItem = {
    id: caseDoc.id,
    numero: caseData.dossierNumber,
    data_criacao: formatDate(caseData.createdAt),
    tag: caseData.tag || null,
    criterio: caseData.name || caseData.documentFormatted,
    progresso: caseData.progress || 0,
    status: mapStatusToLabel(caseData.status),
    monitoria: caseData.flags?.monitoria || false,
    workflow: caseData.flags?.workflow || false,
    score: caseData.score?.overall || null,
    usuario_criador: caseData.createdByName,
    perfil_consulta: caseData.presetKey,
  };

  // Build detail (full)
  const processes = extractProcesses(evidenceItems);
  const analytics = buildAnalytics(processes);

  const dossierDetail = {
    id: caseDoc.id,
    numero: caseData.dossierNumber,
    modo: 'analitico',
    alvo: {
      tipo: caseData.subjectType?.toUpperCase(),
      documento: caseData.documentFormatted,
      nome: caseData.name,
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
    processos_judiciais: processes,
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

  // Save projection
  const projRef = db.collection('clientProjections').doc(caseDoc.id);
  await projRef.set({
    tenantId,
    caseId,
    dossierListItem,
    dossierDetail,
    version: 'v2-projection-2026-04-24',
    generatedAt: new Date(),
    invalidatedAt: null,
  });

  return { projectionId: projRef.id, dossierListItem, dossierDetail };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(timestamp) {
  if (!timestamp) return null;
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('pt-BR');
}

function mapStatusToLabel(status) {
  const map = {
    received: 'Iniciar',
    enriching: 'Processando',
    ready: 'Concluído',
    published: 'Publicado',
    correction_needed: 'Correção necessária',
  };
  return map[status] || status;
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

function buildAnalytics(processes) {
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

module.exports = { execute };
