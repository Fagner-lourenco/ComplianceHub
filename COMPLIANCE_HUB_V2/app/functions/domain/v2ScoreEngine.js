/**
 * Domain: V2 Score Engine
 * Calculates multi-dimensional risk scores from evidence items.
 *
 * Architecture:
 *   1. Signal Extraction: scan evidenceItems against SIGNAL_RULES
 *   2. Aggregation: weighted average across 6 dimensions
 *   3. Classification: low / medium / high / critical
 */

const SCORE_VERSION = 'v2-score-2026-04-24';

// =============================================================================
// SIGNAL RULES
// =============================================================================

const SIGNAL_RULES = [
  // === REGULADORES ===
  {
    code: 'PEP_LEVEL_1',
    category: 'reguladores',
    severity: 'critical',
    scoreImpact: 40,
    condition: (evidence) => {
      if (evidence.sectionKey !== 'kyc') return false;
      const pep = evidence.content?.PEPHistory || [];
      return pep.some(p => parseInt(p.Level) >= 1);
    },
    extract: (evidence) => {
      const pep = evidence.content?.PEPHistory || [];
      const level1 = pep.filter(p => parseInt(p.Level) >= 1);
      return level1.map(p => ({
        title: `PEP Nível ${p.Level}`,
        description: `${p.JobTitle} — ${p.Department} (${p.Source})`,
        sourceReference: p.Source,
      }));
    },
  },
  {
    code: 'PEP_LEVEL_2',
    category: 'reguladores',
    severity: 'warning',
    scoreImpact: 25,
    condition: (evidence) => {
      if (evidence.sectionKey !== 'kyc') return false;
      const pep = evidence.content?.PEPHistory || [];
      return pep.some(p => parseInt(p.Level) === 2);
    },
  },
  {
    code: 'SANCTION_CURRENT',
    category: 'reguladores',
    severity: 'critical',
    scoreImpact: 50,
    condition: (evidence) => evidence.content?.IsCurrentlySanctioned === true,
  },
  {
    code: 'SANCTION_PREVIOUS',
    category: 'reguladores',
    severity: 'warning',
    scoreImpact: 20,
    condition: (evidence) =>
      evidence.content?.WasPreviouslySanctioned === true &&
      evidence.content?.IsCurrentlySanctioned !== true,
  },
  {
    code: 'SANCTION_INTERNATIONAL',
    category: 'reguladores',
    severity: 'critical',
    scoreImpact: 45,
    condition: (evidence) => {
      const sanctions = evidence.content?.SanctionsHistory || [];
      const intl = ['INTERPOL', 'FBI', 'OFAC', 'EU', 'UNSC'];
      return sanctions.some(s => intl.includes(s.Source));
    },
  },

  // === JURÍDICO ===
  {
    code: 'PROCESS_CRIMINAL_AUTOR',
    category: 'juridico',
    severity: 'critical',
    scoreImpact: 35,
    condition: (evidence) => {
      if (evidence.evidenceType !== 'process_list') return false;
      const processes = evidence.content?.processes || [];
      return processes.some(p => p.area === 'criminal' && p.participation === 'autor');
    },
  },
  {
    code: 'PROCESS_CRIMINAL_REU',
    category: 'juridico',
    severity: 'critical',
    scoreImpact: 45,
    condition: (evidence) => {
      if (evidence.evidenceType !== 'process_list') return false;
      const processes = evidence.content?.processes || [];
      return processes.some(p => p.area === 'criminal' && p.participation === 'reu');
    },
  },
  {
    code: 'PROCESS_TRABALHISTA_REU',
    category: 'juridico',
    severity: 'warning',
    scoreImpact: 20,
    condition: (evidence) => {
      if (evidence.evidenceType !== 'process_list') return false;
      const processes = evidence.content?.processes || [];
      return processes.some(p => p.area === 'trabalhista' && p.participation === 'reu');
    },
  },
  {
    code: 'PROCESS_TRABALHISTA_AUTOR',
    category: 'juridico',
    severity: 'info',
    scoreImpact: 5,
    condition: (evidence) => {
      if (evidence.evidenceType !== 'process_list') return false;
      const processes = evidence.content?.processes || [];
      return processes.some(p => p.area === 'trabalhista' && p.participation === 'autor');
    },
  },
  {
    code: 'PROCESS_VALUE_HIGH',
    category: 'juridico',
    severity: 'warning',
    scoreImpact: 15,
    condition: (evidence) => {
      if (evidence.evidenceType !== 'process_list') return false;
      const processes = evidence.content?.processes || [];
      return processes.some(p => p.value > 10_000_000); // > R$ 100.000,00
    },
  },
  {
    code: 'PROCESS_MANY_ACTIVE',
    category: 'juridico',
    severity: 'warning',
    scoreImpact: 20,
    condition: (evidence) => {
      if (evidence.evidenceType !== 'process_list') return false;
      const processes = evidence.content?.processes || [];
      return processes.filter(p => p.status === 'Em tramitacao').length >= 5;
    },
    extract: (evidence) => {
      const processes = evidence.content?.processes || [];
      const active = processes.filter(p => p.status === 'Em tramitacao');
      return [{
        title: `${active.length} processos ativos`,
        description: `O alvo possui ${active.length} processos em tramitação`,
      }];
    },
  },
  {
    code: 'PROCESS_SECRET',
    category: 'juridico',
    severity: 'warning',
    scoreImpact: 15,
    condition: (evidence) => {
      if (evidence.evidenceType !== 'process_list') return false;
      const processes = evidence.content?.processes || [];
      return processes.some(p => p.isSecret);
    },
  },

  // === FINANCEIRO ===
  {
    code: 'DEBT_GOVERNMENT',
    category: 'financeiro',
    severity: 'critical',
    scoreImpact: 35,
    condition: (evidence) => evidence.content?.IsGovernmentDebtor === true,
  },
  {
    code: 'COLLECTION_PRESENT',
    category: 'financeiro',
    severity: 'warning',
    scoreImpact: 25,
    condition: (evidence) => evidence.content?.IsPresentInCollection === true,
  },
  {
    code: 'HIGH_FINANCIAL_RISK',
    category: 'financeiro',
    severity: 'critical',
    scoreImpact: 40,
    condition: (evidence) => {
      const risk = evidence.content?.FinancialRiskLevel;
      return risk === 'HIGH' || risk === 'VERY_HIGH';
    },
  },
  {
    code: 'PROBABLE_NEGATIVATION',
    category: 'financeiro',
    severity: 'warning',
    scoreImpact: 25,
    condition: (evidence) => evidence.content?.IndebtednessProbability === 'HIGH',
  },

  // === REPUTACIONAL ===
  {
    code: 'NEGATIVE_MEDIA_EXPOSURE',
    category: 'reputacional',
    severity: 'warning',
    scoreImpact: 20,
    condition: (evidence) => {
      if (evidence.sectionKey !== 'osint' && evidence.sectionKey !== 'digital') return false;
      const score = evidence.content?.NegativeExposureScore;
      return score && score > 70;
    },
  },

  // === CONFLITO DE INTERESSE ===
  {
    code: 'RELATIONSHIP_POLITICIAN',
    category: 'conflito_interesse',
    severity: 'warning',
    scoreImpact: 20,
    condition: (evidence) => {
      if (evidence.evidenceType !== 'relationship_graph') return false;
      // Placeholder: requires cross-referencing KYC of related nodes
      return false;
    },
  },
  {
    code: 'SHELL_COMPANY_LIKELY',
    category: 'conflito_interesse',
    severity: 'warning',
    scoreImpact: 30,
    condition: (evidence) => evidence.content?.ShellCompanyLikelyhood === true,
  },

  // === SOCIOAMBIENTAL ===
  {
    code: 'ESG_NEGATIVE',
    category: 'socioambiental',
    severity: 'warning',
    scoreImpact: 15,
    condition: (evidence) => {
      const conscience = evidence.content?.SocialConscienceScore;
      return conscience && conscience < 30;
    },
  },
];

// =============================================================================
// WEIGHTS
// =============================================================================

const CATEGORY_WEIGHTS = {
  reguladores: 0.30,
  juridico: 0.25,
  financeiro: 0.20,
  reputacional: 0.10,
  conflito_interesse: 0.10,
  socioambiental: 0.05,
};

const MAX_SCORE_PER_CATEGORY = 100;

// =============================================================================
// SCORE CALCULATION
// =============================================================================

/**
 * Calculate score from evidence items.
 * @param {string} caseId
 * @param {Array} evidenceItems
 * @param {Array} moduleRuns
 * @returns {object} score object
 */
function calculateScore(caseId, evidenceItems, moduleRuns) {
  // 1. Extract signals
  const signals = [];
  for (const evidence of evidenceItems) {
    for (const rule of SIGNAL_RULES) {
      if (rule.condition(evidence)) {
        const extractions = rule.extract
          ? rule.extract(evidence)
          : [{ title: rule.code, description: 'Sinal de risco detectado' }];

        for (const ex of extractions) {
          signals.push({
            code: rule.code,
            category: rule.category,
            severity: rule.severity,
            scoreImpact: rule.scoreImpact,
            title: ex.title,
            description: ex.description,
            sourceKey: evidence.sourceKey,
            sourceReference: ex.sourceReference || null,
            requiresReview: rule.severity === 'critical',
          });
        }
      }
    }
  }

  // 2. Dimension scores
  const dimensionScores = {};
  for (const [category, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    const categorySignals = signals.filter(s => s.category === category);
    const maxImpact = categorySignals.length > 0
      ? Math.max(...categorySignals.map(s => s.scoreImpact))
      : 0;
    const bonus = Math.min((categorySignals.length - 1) * 5, 20);
    dimensionScores[category] = Math.min(maxImpact + bonus, MAX_SCORE_PER_CATEGORY);
  }

  // 3. Overall score
  const overallScore = Object.entries(CATEGORY_WEIGHTS).reduce((sum, [cat, weight]) => {
    return sum + (dimensionScores[cat] || 0) * weight;
  }, 0);

  // 4. Classification
  let category = 'low';
  if (overallScore >= 75) category = 'critical';
  else if (overallScore >= 50) category = 'high';
  else if (overallScore >= 25) category = 'medium';

  return {
    overall: Math.round(overallScore),
    category,
    dimensions: dimensionScores,
    signals,
    calculatedAt: new Date(),
    version: SCORE_VERSION,
  };
}

/**
 * Recalculate score for a case and persist to Firestore.
 * @param {object} db — Firestore instance
 * @param {string} caseId
 * @returns {Promise<object>} score
 */
async function recalculateAndSaveScore(db, caseId) {
  const { COLLECTIONS } = require('../constants/collections');

  const [caseDoc, evidenceSnap, moduleSnap] = await Promise.all([
    db.collection(COLLECTIONS.CASES).doc(caseId).get(),
    db.collection(COLLECTIONS.EVIDENCE_ITEMS).where('caseId', '==', caseId).get(),
    db.collection(COLLECTIONS.MODULE_RUNS).where('caseId', '==', caseId).get(),
  ]);

  if (!caseDoc.exists) throw new Error('Case not found');

  const evidenceItems = evidenceSnap.docs.map(d => d.data());
  const moduleRuns = moduleSnap.docs.map(d => d.data());

  const score = calculateScore(caseId, evidenceItems, moduleRuns);

  // Save score to case
  await db.collection(COLLECTIONS.CASES).doc(caseId).update({
    score,
    updatedAt: new Date(),
  });

  // Save/update risk signals
  const batch = db.batch();
  const existingSignalsSnap = await db.collection(COLLECTIONS.RISK_SIGNALS)
    .where('caseId', '==', caseId)
    .get();

  // Delete old signals
  for (const doc of existingSignalsSnap.docs) {
    batch.delete(doc.ref);
  }

  // Create new signals
  const newSignalIds = [];
  for (const signal of score.signals) {
    const ref = db.collection(COLLECTIONS.RISK_SIGNALS).doc();
    batch.set(ref, {
      ...signal,
      caseId,
      tenantId: caseDoc.data().tenantId,
      createdAt: new Date(),
    });
    newSignalIds.push(ref.id);
  }

  await batch.commit();

  // Update case with new signal IDs
  await db.collection(COLLECTIONS.CASES).doc(caseId).update({
    riskSignalIds: newSignalIds,
  });

  return score;
}

module.exports = {
  SCORE_VERSION,
  SIGNAL_RULES,
  CATEGORY_WEIGHTS,
  calculateScore,
  recalculateAndSaveScore,
};
