import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    startAfter,
    where,
} from 'firebase/firestore';
import { auth, db } from './config';
import { CLIENT_ROLES } from '../rbac/permissions';

const FIRESTORE_QUERY_TIMEOUT_MS = 5000;
const REST_FALLBACK_DELAY_MS = 2000;

export const DEFAULT_ANALYSIS_CONFIG = {
    criminal:         { enabled: true },
    labor:            { enabled: true },
    warrant:          { enabled: true },
    osint:            { enabled: true },
    social:           { enabled: true },
    digital:          { enabled: true },
    conflictInterest: { enabled: true },
    kyc:              { enabled: true },
    judicial:         { enabled: true },
    relationship:     { enabled: true },
};

export const ANALYSIS_PHASE_LABELS = {
    criminal:         'Criminal',
    labor:            'Trabalhista',
    warrant:          'Mandado de Prisao',
    osint:            'OSINT',
    social:           'Social',
    digital:          'Perfil Digital',
    conflictInterest: 'Conflito de Interesse',
    kyc:              'KYC e Listas',
    judicial:         'Judicial',
    relationship:     'Relacionamentos',
    identity_pf:      'Identificacao PF',
    identity_pj:      'Identificacao PJ',
    ongoing_monitoring: 'Monitoramento',
    decision:         'Decisao',
    report_secure:    'Relatorio',
};

function mapProfilesToTenantDirectory(profiles) {
    const tenantMap = new Map();

    profiles.forEach((profile) => {
        if (!profile?.tenantId) {
            return;
        }

        if (!tenantMap.has(profile.tenantId)) {
            tenantMap.set(profile.tenantId, {
                id: profile.tenantId,
                name: profile.tenantName || profile.tenantId,
            });
        }
    });

    return [...tenantMap.values()];
}

function decodeFirestoreValue(value) {
    if (!value || typeof value !== 'object') {
        return null;
    }

    if ('stringValue' in value) return value.stringValue;
    if ('nullValue' in value) return null;
    if ('booleanValue' in value) return value.booleanValue;
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return Number(value.doubleValue);
    if ('timestampValue' in value) return value.timestampValue;
    if ('arrayValue' in value) {
        return (value.arrayValue.values || []).map(decodeFirestoreValue);
    }
    if ('mapValue' in value) {
        return decodeFirestoreFields(value.mapValue.fields || {});
    }

    return null;
}

function decodeFirestoreFields(fields) {
    return Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)]),
    );
}

function withFirestoreTimeout(promise, message) {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            window.setTimeout(() => {
                reject(new Error(message));
            }, FIRESTORE_QUERY_TIMEOUT_MS);
        }),
    ]);
}

function formatFirestoreDate(value) {
    if (value?.toDate?.()) {
        return value.toDate().toISOString().split('T')[0];
    }

    if (typeof value === 'string') {
        return value.includes('T') ? value.split('T')[0] : value;
    }

    return value || '';
}

function mapClientProfile(uid, profile) {
    return {
        uid,
        ...profile,
        createdAt: formatFirestoreDate(profile.createdAt),
    };
}

function mapCaseDocument(id, data) {
    return {
        id,
        ...data,
        createdAt: formatFirestoreDate(data.createdAt),
    };
}

function mapCandidateDocument(id, data) {
    return {
        id,
        ...data,
        candidateName: data.candidateName || data.fullName || '',
        candidatePosition: data.candidatePosition || data.position || '',
        createdAt: formatFirestoreDate(data.createdAt),
    };
}

function formatFirestoreDateTime(value) {
    if (value?.toDate?.()) {
        return value.toDate().toISOString().replace('T', ' ').substring(0, 19);
    }

    if (typeof value === 'string') {
        return value.includes('T')
            ? value.replace('T', ' ').substring(0, 19)
            : value;
    }

    return value || '';
}

function formatFirestoreMinuteDateTime(value) {
    if (value?.toDate?.()) {
        return value.toDate().toISOString().replace('T', ' ').substring(0, 16);
    }

    if (typeof value === 'string') {
        return value.includes('T')
            ? value.replace('T', ' ').substring(0, 16)
            : value;
    }

    return value || '';
}

function mapAuditLogDocument(id, data) {
    return {
        id,
        ...data,
        // v2 uses occurredAt; v1 uses timestamp — normalize
        timestamp: formatFirestoreDateTime(data.occurredAt || data.timestamp),
        // v2 actor compat
        user: data.actor?.email || data.userEmail || data.user || null,
        // v2 entity → target compat
        target: data.entity?.id || data.target || null,
        // v2 fields pass-through
        category: data.category || null,
        searchText: data.searchText || '',
    };
}

function mapExportDocument(id, data) {
    return {
        id,
        ...data,
        createdAt: formatFirestoreMinuteDateTime(data.createdAt),
    };
}

function mapModuleRunDocument(id, data) {
    return {
        id,
        ...data,
        updatedAt: formatFirestoreDateTime(data.updatedAt),
    };
}

function createRestDocumentSnapshot(data) {
    return {
        exists: () => Boolean(data),
        data: () => data,
        metadata: { fromCache: false },
    };
}

async function runFirestoreRestQuery(structuredQuery, errorMessage) {
    const projectId = auth.app.options.projectId;
    const currentUser = auth.currentUser;

    if (!projectId || !currentUser) {
        throw new Error(errorMessage);
    }

    const idToken = await currentUser.getIdToken();
    const response = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/compliance-hub-v2/documents:runQuery`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${idToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ structuredQuery }),
        },
    );

    if (!response.ok) {
        throw new Error(`${errorMessage} (status ${response.status}).`);
    }

    return response.json();
}

export async function getFirestoreDocumentViaRest(collectionId, documentId, errorMessage) {
    const projectId = auth.app.options.projectId;
    const currentUser = auth.currentUser;

    if (!projectId || !currentUser) {
        throw new Error(errorMessage);
    }

    const idToken = await currentUser.getIdToken();
    const response = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/compliance-hub-v2/documents/${collectionId}/${encodeURIComponent(documentId)}`,
        {
            headers: {
                Authorization: `Bearer ${idToken}`,
            },
        },
    );

    if (response.status === 404) {
        return createRestDocumentSnapshot(null);
    }

    if (!response.ok) {
        throw new Error(`${errorMessage} (status ${response.status}).`);
    }

    const payload = await response.json();
    return createRestDocumentSnapshot(decodeFirestoreFields(payload.fields || {}));
}

const DEFAULT_QUERY_LIMIT = 500;

function buildTenantCollectionQuery(collectionId, tenantId, orderField, queryLimit = DEFAULT_QUERY_LIMIT) {
    return tenantId
        ? query(collection(db, collectionId), where('tenantId', '==', tenantId), orderBy(orderField, 'desc'), limit(queryLimit))
        : query(collection(db, collectionId), orderBy(orderField, 'desc'), limit(queryLimit));
}

function buildCaseScopedQuery(collectionId, caseId, tenantId, queryLimit = DEFAULT_QUERY_LIMIT) {
    const constraints = [where('caseId', '==', caseId)];
    if (tenantId) constraints.push(where('tenantId', '==', tenantId));
    constraints.push(limit(queryLimit));
    return query(collection(db, collectionId), ...constraints);
}

function buildTenantStructuredQuery(collectionId, tenantId, orderField, queryLimit = DEFAULT_QUERY_LIMIT) {
    const structuredQuery = {
        from: [{ collectionId }],
        orderBy: [
            {
                field: { fieldPath: orderField },
                direction: 'DESCENDING',
            },
        ],
        limit: { value: queryLimit },
    };

    if (tenantId) {
        structuredQuery.where = {
            fieldFilter: {
                field: { fieldPath: 'tenantId' },
                op: 'EQUAL',
                value: { stringValue: tenantId },
            },
        };
    }

    return structuredQuery;
}

function mapRestQueryDocuments(payload, mapper) {
    return payload
        .map((item) => {
            if (!item.document) {
                return null;
            }

            const documentData = decodeFirestoreFields(item.document.fields || {});
            const documentId = item.document.name.split('/').pop();
            return mapper(documentId, documentData);
        })
        .filter(Boolean);
}

async function fetchOrderedCollection({
    collectionId,
    tenantId,
    orderField,
    timeoutMessage,
    fallbackMessage,
    mapper,
}) {
    const sdkPromise = withFirestoreTimeout(
        getDocs(buildTenantCollectionQuery(collectionId, tenantId, orderField)),
        timeoutMessage,
    ).then((snapshot) => snapshot.docs.map((documentSnapshot) => mapper(documentSnapshot.id, documentSnapshot.data())));

    const restPromise = new Promise((resolve) => {
        window.setTimeout(resolve, REST_FALLBACK_DELAY_MS);
    }).then(() => runFirestoreRestQuery(
        buildTenantStructuredQuery(collectionId, tenantId, orderField),
        fallbackMessage,
    )).then((payload) => mapRestQueryDocuments(payload, mapper));

    try {
        return await Promise.any([sdkPromise, restPromise]);
    } catch {
        return [];
    }
}

/* =========================================================
   USER PROFILES & CLIENTS
   ========================================================= */

/**
 * Fetch all client users.
 */
export async function fetchClients() {
    const q = query(collection(db, 'userProfiles'), where('role', 'in', CLIENT_ROLES));

    try {
        const snapshot = await withFirestoreTimeout(
            getDocs(q),
            'Firestore clients query timeout.',
        );

        return snapshot.docs
            .map((documentSnapshot) => mapClientProfile(documentSnapshot.id, documentSnapshot.data()))
            .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
    } catch (sdkError) {
        const payload = await runFirestoreRestQuery({
            from: [{ collectionId: 'userProfiles' }],
            where: {
                fieldFilter: {
                    field: { fieldPath: 'role' },
                    op: 'IN',
                    value: {
                        arrayValue: {
                            values: CLIENT_ROLES.map((role) => ({ stringValue: role })),
                        },
                    },
                },
            },
        }, sdkError.message || 'Firestore clients REST fallback failed.');

        return payload
            .map((item) => {
                if (!item.document) {
                    return null;
                }

                const profile = decodeFirestoreFields(item.document.fields || {});
                const uid = item.document.name.split('/').pop();
                return mapClientProfile(uid, profile);
            })
            .filter(Boolean)
            .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
    }
}

export function subscribeToTenantDirectory(callback) {
    const q = query(collection(db, 'userProfiles'), where('role', 'in', CLIENT_ROLES));

    return onSnapshot(q, (snapshot) => {
        callback(mapProfilesToTenantDirectory(snapshot.docs.map((documentSnapshot) => documentSnapshot.data())), null);
    }, (error) => {
        console.error('Error subscribing to tenant directory:', error);
        callback([], error);
    });
}

/* =========================================================
   TENANT SETTINGS
   ========================================================= */

export async function getTenantSettings(tenantId) {
    if (!tenantId) return { analysisConfig: { ...DEFAULT_ANALYSIS_CONFIG }, dailyLimit: null, monthlyLimit: null, enrichmentConfig: null };

    const snapshot = await getDoc(doc(db, 'tenantSettings', tenantId));
    if (!snapshot.exists()) return { analysisConfig: { ...DEFAULT_ANALYSIS_CONFIG }, dailyLimit: null, monthlyLimit: null, enrichmentConfig: null };

    const data = snapshot.data();
    return {
        tenantName: data.tenantName ?? null,
        analysisConfig: { ...DEFAULT_ANALYSIS_CONFIG, ...data.analysisConfig },
        dailyLimit: data.dailyLimit ?? null,
        monthlyLimit: data.monthlyLimit ?? null,
        allowDailyExceedance: data.allowDailyExceedance ?? null,
        allowMonthlyExceedance: data.allowMonthlyExceedance ?? null,
        enrichmentConfig: data.enrichmentConfig ?? null,
    };
}

// AUD-019: Removed dead updateTenantSettings — was using setDoc (not imported).
// Tenant settings are updated via the backend callable updateTenantSettingsByAnalyst.

export async function getTenantUsage(tenantId) {
    if (!tenantId) return null;
    const snapshot = await getDoc(doc(db, 'tenantUsage', tenantId));
    if (!snapshot.exists()) return { dailyCount: 0, monthlyCount: 0, dayKey: null, monthKey: null };
    const data = snapshot.data();
    return {
        dailyCount: data.dailyCount ?? 0,
        monthlyCount: data.monthlyCount ?? 0,
        dayKey: data.dayKey ?? null,
        monthKey: data.monthKey ?? null,
        lastSubmissionAt: data.lastSubmissionAt ?? null,
    };
}

export function getEnabledPhases(analysisConfig) {
    return Object.entries(analysisConfig || DEFAULT_ANALYSIS_CONFIG)
        .filter(([, value]) => value?.enabled)
        .map(([key]) => key);
}

export async function fetchTenantDirectory() {
    const q = query(collection(db, 'userProfiles'), where('role', 'in', CLIENT_ROLES));

    try {
        const snapshot = await withFirestoreTimeout(
            getDocs(q),
            'Firestore tenant directory timeout.',
        );

        return mapProfilesToTenantDirectory(snapshot.docs.map((documentSnapshot) => documentSnapshot.data()));
    } catch (sdkError) {
        const payload = await runFirestoreRestQuery({
            from: [{ collectionId: 'userProfiles' }],
            where: {
                fieldFilter: {
                    field: { fieldPath: 'role' },
                    op: 'IN',
                    value: {
                        arrayValue: {
                            values: CLIENT_ROLES.map((role) => ({ stringValue: role })),
                        },
                    },
                },
            },
        }, sdkError.message || 'Firestore tenant REST fallback failed.');

        const profiles = payload
            .map((item) => (item.document ? decodeFirestoreFields(item.document.fields || {}) : null))
            .filter(Boolean);

        return mapProfilesToTenantDirectory(profiles);
    }
}

/* =========================================================
   CASES
   ========================================================= */

export function subscribeToCases(tenantId, callback) {
    const q = buildTenantCollectionQuery('cases', tenantId, 'createdAt');

    return onSnapshot(q, (snapshot) => {
        const cases = snapshot.docs.map((documentSnapshot) => mapCaseDocument(documentSnapshot.id, documentSnapshot.data()));
        callback(cases, null);
    }, (error) => {
        console.error('Error subscribing to cases:', error);
        callback([], error);
    });
}

export function subscribeToClientCases(tenantId, callback) {
    const legacyQuery = tenantId
        ? query(collection(db, 'clientCaseList'), where('tenantId', '==', tenantId), limit(DEFAULT_QUERY_LIMIT))
        : query(collection(db, 'clientCaseList'), limit(DEFAULT_QUERY_LIMIT));
    const projectionQuery = tenantId
        ? query(collection(db, 'clientProjections'), where('tenantId', '==', tenantId), limit(DEFAULT_QUERY_LIMIT))
        : query(collection(db, 'clientProjections'), limit(DEFAULT_QUERY_LIMIT));

    let legacyCases = [];
    let projectedCases = [];
    let legacyReady = false;
    let projectionReady = false;

    const emitCases = () => {
        if (!projectionReady) return;
        const sourceCases = projectedCases.length > 0
            ? projectedCases.map((caseData) => ({ ...caseData, clientDataSource: 'clientProjections', legacyFallbackUsed: false, legacyFallbackSource: null }))
            : (legacyReady ? legacyCases.map((caseData) => ({
                ...caseData,
                clientDataSource: 'legacyFallback:clientCaseList',
                legacyFallbackUsed: true,
                legacyFallbackSource: 'clientCaseList',
            })) : []);

        const sorted = sourceCases.sort((left, right) => {
            const leftDate = left.createdAt?.seconds || new Date(left.createdAt || left.updatedAt || 0).getTime() || 0;
            const rightDate = right.createdAt?.seconds || new Date(right.createdAt || right.updatedAt || 0).getTime() || 0;
            return rightDate - leftDate;
        });

        callback(sorted, null);
    };

    const unsubscribeLegacy = onSnapshot(legacyQuery, (snapshot) => {
        legacyCases = snapshot.docs.map((documentSnapshot) => mapCaseDocument(documentSnapshot.id, documentSnapshot.data()));
        legacyReady = true;
        emitCases();
    }, (error) => {
        console.error('clientCaseList fallback subscription error:', error);
        legacyCases = [];
        legacyReady = true;
        emitCases();
    });

    const unsubscribeProjection = onSnapshot(projectionQuery, (snapshot) => {
        projectedCases = snapshot.docs.map((documentSnapshot) => mapCaseDocument(documentSnapshot.id, documentSnapshot.data()));
        projectionReady = true;
        emitCases();
    }, (error) => {
        console.error('clientProjections subscription error:', error);
        callback([], error);
    });

    return () => {
        unsubscribeLegacy?.();
        unsubscribeProjection?.();
    };
}

export function subscribeToClientProjections(tenantId, callback) {
    const projectionQuery = tenantId
        ? query(collection(db, 'clientProjections'), where('tenantId', '==', tenantId), limit(DEFAULT_QUERY_LIMIT))
        : query(collection(db, 'clientProjections'), limit(DEFAULT_QUERY_LIMIT));

    return onSnapshot(projectionQuery, (snapshot) => {
        const projectedCases = snapshot.docs
            .map((documentSnapshot) => ({
                ...mapCaseDocument(documentSnapshot.id, documentSnapshot.data()),
                clientDataSource: 'clientProjections',
            }))
            .sort((left, right) => {
                const leftDate = left.createdAt?.seconds || new Date(left.createdAt || left.updatedAt || 0).getTime() || 0;
                const rightDate = right.createdAt?.seconds || new Date(right.createdAt || right.updatedAt || 0).getTime() || 0;
                return rightDate - leftDate;
            });
        callback(projectedCases, null);
    }, (error) => {
        console.error('Error subscribing to client projections:', error);
        callback([], error);
    });
}

export function fetchCases(tenantId) {
    return fetchOrderedCollection({
        collectionId: 'cases',
        tenantId,
        orderField: 'createdAt',
        timeoutMessage: 'Firestore cases query timeout.',
        fallbackMessage: 'Firestore cases REST fallback failed.',
        mapper: mapCaseDocument,
    });
}

export function fetchClientCases(tenantId) {
    return fetchOrderedCollection({
        collectionId: 'clientCaseList',
        tenantId,
        orderField: 'createdAt',
        timeoutMessage: 'Firestore client case list query timeout.',
        fallbackMessage: 'Firestore client case list REST fallback failed.',
        mapper: mapCaseDocument,
    }).then((cases) => cases.map((caseData) => ({
        ...caseData,
        clientDataSource: 'legacyFallback:clientCaseList',
        legacyFallbackUsed: true,
        legacyFallbackSource: 'clientCaseList',
    })));
}

export async function getCase(caseId) {
    let snapshot;

    try {
        snapshot = await withFirestoreTimeout(
            getDoc(doc(db, 'cases', caseId)),
            'Firestore case lookup timeout.',
        );

        if (!snapshot.exists() && snapshot.metadata?.fromCache) {
            snapshot = await getFirestoreDocumentViaRest('cases', caseId, 'Firestore case REST fallback failed.');
        }
    } catch {
        snapshot = await getFirestoreDocumentViaRest('cases', caseId, 'Firestore case REST fallback failed.');
    }

    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    return {
        id: caseId,
        ...data,
        createdAt: data.createdAt?.toDate?.()
            ? data.createdAt.toDate().toISOString().split('T')[0]
            : data.createdAt || '',
    };
}

export function subscribeToCaseDoc(caseId, callback) {
    return onSnapshot(doc(db, 'cases', caseId), (snapshot) => {
        if (!snapshot.exists()) {
            callback(null, null);
            return;
        }
        const data = snapshot.data();
        callback({
            id: caseId,
            ...data,
            createdAt: data.createdAt?.toDate?.()
                ? data.createdAt.toDate().toISOString().split('T')[0]
                : data.createdAt || '',
        }, null);
    }, (error) => {
        console.error('Error subscribing to case doc:', error);
        callback(null, error);
    });
}

export function subscribeToModuleRunsForCase(caseId, callback, tenantId = null) {
    if (!caseId) {
        callback([], null);
        return () => {};
    }

    const q = buildCaseScopedQuery('moduleRuns', caseId, tenantId);
    return onSnapshot(q, (snapshot) => {
        const moduleRuns = snapshot.docs
            .map((documentSnapshot) => mapModuleRunDocument(documentSnapshot.id, documentSnapshot.data()))
            .sort((left, right) => String(left.moduleKey || '').localeCompare(String(right.moduleKey || '')));
        callback(moduleRuns, null);
    }, (error) => {
        console.error('Error subscribing to module runs:', error);
        callback([], error);
    });
}

export async function fetchModuleRunsForCase(caseId, tenantId = null) {
    if (!caseId) return [];
    const q = buildCaseScopedQuery('moduleRuns', caseId, tenantId);
    const snapshot = await withFirestoreTimeout(
        getDocs(q),
        'Firestore moduleRuns query timeout.',
    );
    return snapshot.docs
        .map((documentSnapshot) => mapModuleRunDocument(documentSnapshot.id, documentSnapshot.data()))
        .sort((left, right) => String(left.moduleKey || '').localeCompare(String(right.moduleKey || '')));
}

export function subscribeToEvidenceItemsForCase(caseId, callback, tenantId = null) {
    if (!caseId) {
        callback([], null);
        return () => {};
    }
    const q = buildCaseScopedQuery('evidenceItems', caseId, tenantId);
    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => String(a.moduleKey || '').localeCompare(String(b.moduleKey || '')));
        callback(items, null);
    }, (error) => {
        console.error('evidenceItems subscription error:', error);
        callback([], error);
    });
}

export function subscribeToRiskSignalsForCase(caseId, callback, tenantId = null) {
    if (!caseId) {
        callback([], null);
        return () => {};
    }
    const q = buildCaseScopedQuery('riskSignals', caseId, tenantId);
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return onSnapshot(q, (snapshot) => {
        const signals = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));
        callback(signals, null);
    }, (error) => {
        console.error('riskSignals subscription error:', error);
        callback([], error);
    });
}

export function subscribeToSubjectForCase(subjectId, callback) {
    if (!subjectId) {
        callback(null, null);
        return () => {};
    }
    const ref = doc(db, 'subjects', subjectId);
    return onSnapshot(ref, (snapshot) => {
        callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null, null);
    }, (error) => {
        console.error('subject subscription error:', error);
        callback(null, error);
    });
}

export function subscribeToRelationshipsForCase(caseId, callback, tenantId = null) {
    if (!caseId) {
        callback([], null);
        return () => {};
    }
    const q = buildCaseScopedQuery('relationships', caseId, tenantId);
    const confidenceOrder = { exact: 0, high: 1, medium: 2, low: 3 };
    return onSnapshot(q, (snapshot) => {
        const relationships = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => {
                const confidenceDiff = (confidenceOrder[a.confidence] ?? 4) - (confidenceOrder[b.confidence] ?? 4);
                if (confidenceDiff !== 0) return confidenceDiff;
                return String(a.type || '').localeCompare(String(b.type || ''));
            });
        callback(relationships, null);
    }, (error) => {
        console.error('relationships subscription error:', error);
        callback([], error);
    });
}

export function subscribeToTimelineEventsForCase(caseId, callback, limitCount = DEFAULT_QUERY_LIMIT, tenantId = null) {
    if (!caseId) {
        callback([], null);
        return () => {};
    }
    const q = buildCaseScopedQuery('timelineEvents', caseId, tenantId, limitCount);
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const eventOrder = {
        risk_signal_raised: 0,
        provider_divergence: 1,
        decision_made: 2,
        report_generated: 3,
        module_run_completed: 4,
        evidence_created: 5,
    };
    return onSnapshot(q, (snapshot) => {
        const events = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => {
                const eventDiff = (eventOrder[a.eventType] ?? 9) - (eventOrder[b.eventType] ?? 9);
                if (eventDiff !== 0) return eventDiff;
                const severityDiff = (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
                if (severityDiff !== 0) return severityDiff;
                return String(b.occurredAt || b.createdAt || '').localeCompare(String(a.occurredAt || a.createdAt || ''));
            });
        callback(events, null);
    }, (error) => {
        console.error('timelineEvents subscription error:', error);
        callback([], error);
    });
}

export function subscribeToProviderDivergencesForCase(caseId, callback, limitCount = DEFAULT_QUERY_LIMIT, tenantId = null) {
    if (!caseId) {
        callback([], null);
        return () => {};
    }
    const q = buildCaseScopedQuery('providerDivergences', caseId, tenantId, limitCount);
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return onSnapshot(q, (snapshot) => {
        const divergences = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => {
                const blockingDiff = Number(b.blocksPublication === true) - Number(a.blocksPublication === true);
                if (blockingDiff !== 0) return blockingDiff;
                return (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
            });
        callback(divergences, null);
    }, (error) => {
        console.error('providerDivergences subscription error:', error);
        callback([], error);
    });
}

// Fetches previous cases for same subject (excludes currentCaseId), ordered by createdAt desc.
export async function fetchSubjectHistory(subjectId, currentCaseId, limit_ = 5, tenantId = null) {
    if (!subjectId) return [];
    try {
        const constraints = [where('subjectId', '==', subjectId)];
        if (tenantId) constraints.push(where('tenantId', '==', tenantId));
        constraints.push(orderBy('createdAt', 'desc'), limit(limit_ + 1));
        const q = query(collection(db, 'cases'), ...constraints);
        const snap = await getDocs(q);
        return snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((c) => c.id !== currentCaseId)
            .slice(0, limit_);
    } catch {
        return [];
    }
}

/* =========================================================
   CANDIDATES
   ========================================================= */

export function subscribeToCandidates(tenantId, callback) {
    const q = buildTenantCollectionQuery('candidates', tenantId, 'createdAt');

    return onSnapshot(q, (snapshot) => {
        const candidates = snapshot.docs.map((documentSnapshot) => mapCandidateDocument(documentSnapshot.id, documentSnapshot.data()));
        callback(candidates, null);
    }, (error) => {
        console.error('Error subscribing to candidates:', error);
        callback([], error);
    });
}

export function fetchCandidates(tenantId) {
    return fetchOrderedCollection({
        collectionId: 'candidates',
        tenantId,
        orderField: 'createdAt',
        timeoutMessage: 'Firestore candidates query timeout.',
        fallbackMessage: 'Firestore candidates REST fallback failed.',
        mapper: mapCandidateDocument,
    });
}

/* =========================================================
   AUDIT LOGS
   ========================================================= */

export function subscribeToAuditLogs(tenantId, callback) {
    const q = buildTenantCollectionQuery('auditLogs', tenantId, 'timestamp');

    return onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map((documentSnapshot) => mapAuditLogDocument(documentSnapshot.id, documentSnapshot.data()));
        callback(logs, null);
    }, (error) => {
        console.error('Error subscribing to audit logs:', error);
        callback([], error);
    });
}

export function fetchAuditLogs(tenantId) {
    return fetchOrderedCollection({
        collectionId: 'auditLogs',
        tenantId,
        orderField: 'timestamp',
        timeoutMessage: 'Firestore audit logs query timeout.',
        fallbackMessage: 'Firestore audit logs REST fallback failed.',
        mapper: mapAuditLogDocument,
    });
}

export function subscribeToCaseAuditLogs(caseId, callback) {
    const q = query(
        collection(db, 'auditLogs'),
        where('related.caseId', '==', caseId),
        orderBy('occurredAt', 'desc'),
        limit(50),
    );
    return onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map((d) => mapAuditLogDocument(d.id, d.data()));
        callback(logs, null);
    }, (error) => {
        console.error('Error subscribing to case audit logs:', error);
        callback([], error);
    });
}

const TENANT_AUDIT_QUERY_LIMIT = 200;

export function subscribeToTenantAuditLogs(tenantId, callback, options = {}) {
    const { category, cursor, pageSize = TENANT_AUDIT_QUERY_LIMIT } = options;
    const constraints = [
        where('tenantId', '==', tenantId),
    ];
    if (category) {
        constraints.push(where('category', '==', category));
    }
    constraints.push(orderBy('occurredAt', 'desc'));
    if (cursor) {
        constraints.push(startAfter(cursor));
    }
    constraints.push(limit(pageSize));

    const q = query(collection(db, 'tenantAuditLogs'), ...constraints);
    return onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map((d) => mapAuditLogDocument(d.id, d.data()));
        const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
        callback(logs, null, lastDoc);
    }, (error) => {
        console.error('Error subscribing to tenant audit logs:', error);
        callback([], error, null);
    });
}

export async function fetchPublicReports(tenantId) {
    const constraints = [orderBy('createdAt', 'desc'), limit(200)];
    if (tenantId) constraints.unshift(where('tenantId', '==', tenantId));
    const q = query(collection(db, 'publicReports'), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function revokePublicReport(token) {
    await callBackendFunction('revokePublicReport', { token });
}

export async function fetchClientPublicReports() {
    const result = await callBackendFunction('listClientPublicReports', {});
    return Array.isArray(result?.reports) ? result.reports : [];
}

export async function revokeClientPublicReport(token) {
    await callBackendFunction('revokeClientPublicReport', { token });
}

/* =========================================================
   EXPORTS
   ========================================================= */

export function subscribeToExports(tenantId, callback) {
    const q = buildTenantCollectionQuery('exports', tenantId, 'createdAt');

    return onSnapshot(q, (snapshot) => {
        const exports = snapshot.docs.map((documentSnapshot) => mapExportDocument(documentSnapshot.id, documentSnapshot.data()));
        callback(exports, null);
    }, (error) => {
        console.error('Error subscribing to exports:', error);
        callback([], error);
    });
}

export function fetchExports(tenantId) {
    return fetchOrderedCollection({
        collectionId: 'exports',
        tenantId,
        orderField: 'createdAt',
        timeoutMessage: 'Firestore exports query timeout.',
        fallbackMessage: 'Firestore exports REST fallback failed.',
        mapper: mapExportDocument,
    });
}

/* =========================================================
   PUBLIC REPORTS
   ========================================================= */

export async function savePublicReport(html, meta = {}) {
    const result = await callBackendFunction('createAnalystPublicReport', { html: html || '', meta, caseId: meta.caseId || '' });
    if (!result?.token) {
        throw new Error('Backend did not return a public report token.');
    }
    return result.token;
}

export async function saveClientPublicReport(caseId) {
    const result = await callBackendFunction('createClientPublicReport', { caseId });
    if (!result?.token) {
        throw new Error('Backend did not return a public report token.');
    }
    return result.token;
}

export async function getPublicReport(token) {
    const ref = doc(db, 'publicReports', token);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
}

export async function getClientProjection(caseId) {
    try {
        const ref = doc(db, 'clientProjections', caseId);
        const snap = await getDoc(ref);
        return snap.exists() ? snap.data() : null;
    } catch (error) {
        console.warn('ClientProjection unavailable:', error);
        return null;
    }
}

export async function fetchSubjectDecisionHistory(subjectId, currentCaseId, limit_ = 8, tenantId = null) {
    if (!subjectId) return [];
    try {
        const decisionConstraints = [where('subjectId', '==', subjectId)];
        if (tenantId) decisionConstraints.push(where('tenantId', '==', tenantId));
        decisionConstraints.push(orderBy('approvedAt', 'desc'), limit(limit_ + 1));
        const decisionsQuery = query(collection(db, 'decisions'), ...decisionConstraints);
        const decisionsSnap = await getDocs(decisionsQuery);
        const decisions = decisionsSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((decision) => decision.caseId !== currentCaseId)
            .slice(0, limit_);

        if (decisions.length === 0) return [];

        const snapshotQueries = decisions.map(async (decision) => {
            if (!decision.caseId) return { decision, reportSnapshot: null };
            const snapshotConstraints = [where('caseId', '==', decision.caseId)];
            if (tenantId) snapshotConstraints.push(where('tenantId', '==', tenantId));
            snapshotConstraints.push(limit(1));
            const snapshotsQuery = query(collection(db, 'reportSnapshots'), ...snapshotConstraints);
            const snapshotsSnap = await getDocs(snapshotsQuery);
            const reportSnapshot = snapshotsSnap.docs[0]
                ? { id: snapshotsSnap.docs[0].id, ...snapshotsSnap.docs[0].data() }
                : null;
            return { decision, reportSnapshot };
        });

        const rows = await Promise.all(snapshotQueries);
        return rows.map(({ decision, reportSnapshot }, index) => {
            const previous = rows[index + 1]?.decision || null;
            const currentScore = Number(decision.riskScore ?? 0);
            const previousScore = previous ? Number(previous.riskScore ?? 0) : null;
            return {
                id: decision.id,
                caseId: decision.caseId || null,
                decisionId: decision.id,
                reportSnapshotId: reportSnapshot?.id || reportSnapshot?.reportSnapshotId || null,
                productKey: decision.productKey || reportSnapshot?.productKey || null,
                verdict: decision.verdict || null,
                riskScore: decision.riskScore ?? null,
                riskLevel: decision.riskLevel || null,
                approvedAt: decision.approvedAt || decision.createdAt || null,
                reportStatus: reportSnapshot?.status || null,
                reportModuleKeys: reportSnapshot?.reportModuleKeys || reportSnapshot?.moduleKeys || [],
                scoreDeltaFromPrevious: previousScore == null ? null : currentScore - previousScore,
            };
        });
    } catch (error) {
        console.warn('Subject decision history unavailable:', error);
        return [];
    }
}

/* =========================================================
   PUBLIC RESULT — Sanitized subcollection for client access
   ========================================================= */

export function subscribeToCasePublicResult(caseId, callback) {
    const ref = doc(db, 'cases', caseId, 'publicResult', 'latest');
    return onSnapshot(ref, (snapshot) => {
        if (!snapshot.exists()) {
            callback(null, null);
            return;
        }
        callback(snapshot.data(), null);
    }, (error) => {
        console.error('Error subscribing to publicResult:', error);
        callback(null, error);
    });
}

export async function getCasePublicResult(caseId) {
    const ref = doc(db, 'cases', caseId, 'publicResult', 'latest');
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
}

/* =========================================================
   AI RE-RUN — Callable function invocation
   ========================================================= */

export async function callRerunEnrichmentPhase(caseId, phase) {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions(undefined, 'southamerica-east1');
    const fn = httpsCallable(functions, resolveV2FunctionName('rerunEnrichmentPhase'));
    const result = await fn({ caseId, phase });
    return result.data;
}

export async function callRerunAiAnalysis(caseId) {
    return callRerunEnrichmentPhase(caseId, 'ai');
}

async function callBackendFunction(name, payload) {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions(undefined, 'southamerica-east1');
    const fn = httpsCallable(functions, resolveV2FunctionName(name));
    const result = await fn(payload);
    return result.data;
}

function resolveV2FunctionName(name) {
    // Functions are deployed without the v2 prefix in bootstrap.js exports.
    // Only functions already prefixed with v2 remain unchanged.
    if (String(name || '').startsWith('v2')) return name;
    return name;
}

export async function callCreateClientSolicitation(payload) {
    return callBackendFunction('createClientSolicitation', payload);
}

export async function callMarkProductIntroSeen(payload) {
    return callBackendFunction('markProductIntroSeen', payload);
}

export async function callSubmitClientCorrection(payload) {
    return callBackendFunction('submitClientCorrection', payload);
}

export async function callRegisterClientExport(payload) {
    return callBackendFunction('registerClientExport', payload);
}

export async function callCreateOpsClientUser(payload) {
    return callBackendFunction('createOpsClientUser', payload);
}

export async function callListTenantUsers() {
    return callBackendFunction('listTenantUsers', {});
}

export async function callCreateTenantUser(payload) {
    return callBackendFunction('createTenantUser', payload);
}

export async function callUpdateTenantUser(payload) {
    return callBackendFunction('updateTenantUser', payload);
}

export async function callUpdateOwnProfile(payload) {
    return callBackendFunction('updateOwnProfile', payload);
}

export async function callAssignCaseToCurrentAnalyst(payload) {
    return callBackendFunction('assignCaseToCurrentAnalyst', payload);
}

export async function callReturnCaseToClient(payload) {
    return callBackendFunction('returnCaseToClient', payload);
}

export async function callConcludeCaseByAnalyst(payload) {
    return callBackendFunction('concludeCaseByAnalyst', payload);
}

export async function callUpdateTenantSettingsByAnalyst(payload) {
    return callBackendFunction('updateTenantSettingsByAnalyst', payload);
}

export async function callSaveCaseDraftByAnalyst(payload) {
    return callBackendFunction('saveCaseDraftByAnalyst', payload);
}

export async function callSetAiDecisionByAnalyst(payload) {
    return callBackendFunction('setAiDecisionByAnalyst', payload);
}

export async function callGetSystemHealth() {
    return callBackendFunction('getSystemHealth', {});
}

export async function callGetClientQuotaStatus() {
    return callBackendFunction('getClientQuotaStatus', {});
}

export async function callGetClientProductCatalog() {
    return callBackendFunction('getClientProductCatalog', {});
}

export async function callMarkAlertAs(payload) {
    return callBackendFunction('markAlertAs', payload);
}

export async function callCreateQuoteRequest(payload) {
    return callBackendFunction('createQuoteRequest', payload);
}

export async function callResolveQuoteRequest(payload) {
    return callBackendFunction('resolveQuoteRequest', payload);
}

export async function callCreateWatchlist(payload) {
    return callBackendFunction('createWatchlist', payload);
}

export async function callPauseWatchlist(payload) {
    return callBackendFunction('pauseWatchlist', payload);
}

export async function callResumeWatchlist(payload) {
    return callBackendFunction('resumeWatchlist', payload);
}

export async function callDeleteWatchlist(payload) {
    return callBackendFunction('deleteWatchlist', payload);
}

export async function callRunWatchlistNow(payload) {
    return callBackendFunction('runWatchlistNow', payload);
}

export function subscribeToAlertsByTenant(tenantId, callback) {
    if (!tenantId) {
        callback([], null);
        return () => {};
    }
    const q = query(
        collection(db, 'alerts'),
        where('tenantId', '==', tenantId),
        orderBy('createdAt', 'desc'),
        limit(100),
    );
    return onSnapshot(q, (snapshot) => {
        const alerts = snapshot.docs.map((d) => {
            const data = d.data() || {};
            return {
                id: d.id,
                tenantId: data.tenantId,
                subjectId: data.subjectId || null,
                caseId: data.caseId || null,
                kind: data.kind || 'unknown',
                severity: data.severity || 'info',
                state: data.state || 'unread',
                message: data.message || '',
                createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || null,
                actionedAt: data.actionedAt?.toDate?.()?.toISOString?.() || data.actionedAt || null,
                actionedBy: data.actionedBy || null,
            };
        });
        callback(alerts, null);
    }, (error) => {
        console.error('Error subscribing to alerts:', error);
        callback([], error);
    });
}

export function subscribeToQuoteRequestsByTenant(tenantId, callback) {
    if (!tenantId) {
        callback([], null);
        return () => {};
    }
    const q = query(
        collection(db, 'quoteRequests'),
        where('tenantId', '==', tenantId),
        orderBy('requestedAt', 'desc'),
        limit(100),
    );
    return onSnapshot(q, (snapshot) => {
        const quotes = snapshot.docs.map((d) => {
            const data = d.data() || {};
            return {
                id: d.id,
                tenantId: data.tenantId,
                productKey: data.productKey,
                status: data.status || 'pending',
                notes: data.notes || '',
                responseNotes: data.responseNotes || null,
                requestedBy: data.requestedBy || null,
                requestedByEmail: data.requestedByEmail || null,
                reviewedBy: data.reviewedBy || null,
                reviewedByEmail: data.reviewedByEmail || null,
                requestedAt: data.requestedAt?.toDate?.()?.toISOString?.() || data.requestedAt || null,
                reviewedAt: data.reviewedAt?.toDate?.()?.toISOString?.() || data.reviewedAt || null,
            };
        });
        callback(quotes, null);
    }, (error) => {
        console.error('Error subscribing to quoteRequests:', error);
        callback([], error);
    });
}

export function subscribeToQuoteRequestsForAllTenants(callback) {
    const q = query(
        collection(db, 'quoteRequests'),
        orderBy('requestedAt', 'desc'),
        limit(200),
    );
    return onSnapshot(q, (snapshot) => {
        const quotes = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        callback(quotes, null);
    }, (error) => {
        console.error('Error subscribing to quoteRequests (all):', error);
        callback([], error);
    });
}

export function subscribeToWatchlistsByTenant(tenantId, callback) {
    if (!tenantId) {
        callback([], null);
        return () => {};
    }
    const q = query(
        collection(db, 'watchlists'),
        where('tenantId', '==', tenantId),
        limit(200),
    );
    return onSnapshot(q, (snapshot) => {
        const watchlists = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        callback(watchlists, null);
    }, (error) => {
        console.error('Error subscribing to watchlists:', error);
        callback([], error);
    });
}

export async function callGetTenantEntitlementsByAnalyst(payload) {
    return callBackendFunction('getTenantEntitlementsByAnalyst', payload);
}

export async function callUpdateTenantEntitlementsByAnalyst(payload) {
    return callBackendFunction('updateTenantEntitlementsByAnalyst', payload);
}

export async function callGetTenantBillingOverview(payload) {
    return callBackendFunction('getTenantBillingOverview', payload);
}

export async function callCloseTenantBillingPeriod(payload) {
    return callBackendFunction('closeTenantBillingPeriodByAnalyst', payload);
}

export async function callGetTenantBillingSettlement(payload) {
    return callBackendFunction('getTenantBillingSettlement', payload);
}

export async function callGetTenantBillingDrilldown(payload) {
    return callBackendFunction('getTenantBillingDrilldown', payload);
}

export async function callExportTenantBillingDrilldown(payload) {
    return callBackendFunction('exportTenantBillingDrilldown', payload);
}

export async function callGetOpsV2Metrics(payload = {}) {
    return callBackendFunction('getOpsV2Metrics', payload);
}

export async function callResolveProviderDivergenceByAnalyst(payload) {
    return callBackendFunction('resolveProviderDivergenceByAnalyst', payload);
}

export async function callMaterializeV2Artifacts(payload) {
    return callBackendFunction('materializeV2Artifacts', payload);
}
