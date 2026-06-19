/**
 * Helper central para verificar se a IA está habilitada para um tenant,
 * considerando o toggle de configuração e o orçamento mensal.
 */

/**
 * Verifica se a IA pode ser executada para o tenant.
 *
 * @param {string} tenantId
 * @param {object} db - Firebase Admin Firestore instance
 * @returns {Promise<{enabled: boolean, reason?: string, totalCost?: number, budget?: number}>}
 */
async function isAiEnabledForTenant(tenantId, db) {
  if (!tenantId || !db) {
    return { enabled: false, reason: 'Tenant ou banco de dados não informado.' };
  }

  let tenantData;
  try {
    const tenantDoc = await db.collection('tenantSettings').doc(tenantId).get();
    tenantData = tenantDoc.exists ? tenantDoc.data() : null;
  } catch (err) {
    console.warn(`[isAiEnabledForTenant] Tenant ${tenantId}: falha ao ler configurações:`, err.message);
    return { enabled: false, reason: 'Falha ao ler configurações do tenant.' };
  }

  const aiConfig = tenantData?.enrichmentConfig?.ai || { enabled: false };
  if (aiConfig.enabled !== true) {
    return { enabled: false, reason: 'IA desabilitada para este tenant.' };
  }

  const budget = aiConfig.monthlyBudgetUsd;
  if (!budget || !Number.isFinite(budget) || budget <= 0) {
    return { enabled: true };
  }

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  try {
    const ledgerRef = db.collection('tenantSettings').doc(tenantId).collection('aiCostLedger').doc(monthKey);
    const ledgerSnap = await ledgerRef.get();
    let totalCost = 0;
    if (ledgerSnap.exists) {
      totalCost = ledgerSnap.data().totalCostUsd || 0;
    } else {
      console.warn(`[AI Budget] Tenant ${tenantId}: aiCostLedger ausente para ${monthKey}. Usando scan de casos (fallback).`);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const costSnapshot = await db.collection('cases')
        .where('tenantId', '==', tenantId)
        .where('aiExecutedAt', '>=', monthStart)
        .select('aiCostUsd', 'aiHomonymCostUsd', 'aiClassificationReviewCostUsd')
        .get();
      costSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        totalCost += (data.aiCostUsd || 0)
          + (data.aiHomonymCostUsd || 0)
          + (data.aiClassificationReviewCostUsd || 0);
      });
    }

    if (totalCost >= budget) {
      const reason = `Budget mensal excedido ($${totalCost.toFixed(4)}/$${budget})`;
      console.warn(`[isAiEnabledForTenant] Tenant ${tenantId}: ${reason}`);
      return { enabled: false, reason, totalCost, budget };
    }

    return { enabled: true, totalCost, budget };
  } catch (err) {
    console.warn(`[isAiEnabledForTenant] Tenant ${tenantId}: falha ao verificar budget:`, err.message);
    return { enabled: false, reason: 'Falha ao verificar budget de IA.' };
  }
}

module.exports = {
  isAiEnabledForTenant,
};
