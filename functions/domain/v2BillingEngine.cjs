'use strict';

const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { summarizeUsageMeters } = require('./v2BillingResolver.cjs');

/** Lazy getter for Firestore */
let _db;
function db() {
    if (!_db) _db = getFirestore();
    return _db;
}

/**
 * Closes the billing period for a tenant for a specific month.
 */
async function closeBillingPeriod(tenantId, monthKey, options = {}) {
    console.log(`v2BillingEngine: Closing billing for ${tenantId} / ${monthKey}`);

    // 1. Fetch all usage meters for the period
    const metersSnapshot = await db().collection('usageMeters')
        .where('tenantId', '==', tenantId)
        .where('monthKey', '==', monthKey)
        .get();

    const meters = metersSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // 2. Aggregate usage
    const summary = summarizeUsageMeters(meters);

    // 3. Create the Invoice/Settlement document
    const settlementId = `billing_${tenantId}_${monthKey}`;
    const settlementRef = db().collection('billingSettlements').doc(settlementId);

    const settlementData = {
        tenantId,
        monthKey,
        summary,
        status: 'PENDING_REVIEW',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        totalAmountBrl: summary.totalInternalCostBrl, // Base cost, margin applied in UI or next step
        itemCount: meters.length,
        source: 'usageMeters',
        closedBy: options.actor?.uid || null,
        closedByEmail: options.actor?.email || null,
    };

    await settlementRef.set(settlementData, { merge: true });

    return { settlementId, summary, itemCount: meters.length, status: settlementData.status };
}

module.exports = {
    closeBillingPeriod,
    _setDb(mockDb) {
        _db = mockDb;
    },
};
