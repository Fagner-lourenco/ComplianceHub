/**
 * systemHealth.js — Módulo de saúde do sistema e quotas
 * Extraído do monolito index.js
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const { formatDateKey, formatMonthKey } = require('./utilityHelpers');

/**
 * Lógica pura: retorna o status de saúde dos providers
 */
async function getSystemHealthLogic({ db, getOpsUserProfile, circuitBreaker }) {
    const profile = await getOpsUserProfile();
    if (!['analyst', 'supervisor', 'admin'].includes(profile?.role)) {
        throw new HttpsError('permission-denied', 'Apenas analistas podem acessar.');
    }

    const { COLLECTION: healthCollection } = circuitBreaker;
    const snapshot = await db.collection(healthCollection).get();
    const providers = {};
    snapshot.forEach((doc) => {
        const data = doc.data();
        providers[doc.id] = {
            providerId: doc.id,
            failCount: data.failCount || 0,
            lastSuccess: data.lastSuccess || null,
            lastFailure: data.lastFailure || null,
            lastError: data.lastError || null,
            disabledUntil: data.disabledUntil || null,
            updatedAt: data.updatedAt || null,
        };
    });
    return { providers };
}

/**
 * Factory: cria o handler onCall para getSystemHealth
 */
function createGetSystemHealthHandler({ db, getOpsUserProfile, circuitBreaker }) {
    return onCall(
        { region: 'southamerica-east1', cors: true },
        async (request) => {
            if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessario.');
            return getSystemHealthLogic({ db, getOpsUserProfile: () => getOpsUserProfile(request.auth.uid), circuitBreaker });
        },
    );
}

/**
 * Lógica pura: retorna o status de quota do cliente
 */
async function getClientQuotaStatusInner({
    db,
    getClientUserProfile,
    getTenantSettingsData,
    uid,
}) {
    const profile = await getClientUserProfile(uid);
    const tenantId = profile.tenantId;

    const tenantData = await getTenantSettingsData(tenantId);
    const dailyLimit = tenantData?.dailyLimit ?? null;
    const monthlyLimit = tenantData?.monthlyLimit ?? null;
    const allowDailyExceedance = tenantData?.allowDailyExceedance !== false;
    const allowMonthlyExceedance = tenantData?.allowMonthlyExceedance === true;

    if (dailyLimit == null && monthlyLimit == null) {
        return {
            hasLimits: false,
            dailyLimit: null,
            monthlyLimit: null,
            dailyCount: 0,
            monthlyCount: 0,
        };
    }

    const now = new Date();
    const dayKey = formatDateKey(now);
    const monthKey = formatMonthKey(now);

    const usageSnap = await db.collection('tenantUsage').doc(tenantId).get();
    const usage = usageSnap.exists ? usageSnap.data() : {};

    const dailyCount = (usage.dayKey === dayKey) ? (usage.dailyCount || 0) : 0;
    const monthlyCount = (usage.monthKey === monthKey) ? (usage.monthlyCount || 0) : 0;

    return {
        hasLimits: true,
        dailyLimit,
        monthlyLimit,
        dailyCount,
        monthlyCount,
        allowDailyExceedance,
        allowMonthlyExceedance,
    };
}

/**
 * Factory: cria o handler onCall para getClientQuotaStatus
 */
function createGetClientQuotaStatusHandler({ db, getClientUserProfile, getTenantSettingsData }) {
    return onCall(
        { region: 'southamerica-east1', cors: [/\.vercel\.app$/, /localhost/] },
        async (request) => {
            if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessario.');
            return getClientQuotaStatusInner({
                db,
                getClientUserProfile,
                getTenantSettingsData,
                uid: request.auth.uid,
            });
        },
    );
}

module.exports = {
    getSystemHealthLogic,
    createGetSystemHealthHandler,
    getClientQuotaStatusInner,
    createGetClientQuotaStatusHandler,
};
