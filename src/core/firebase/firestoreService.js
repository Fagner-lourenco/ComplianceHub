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
};

export const ANALYSIS_PHASE_LABELS = {
    criminal:         'Criminal',
    labor:            'Trabalhista',
    warrant:          'Mandado de Prisao',
    osint:            'OSINT',
    social:           'Social',
    digital:          'Perfil Digital',
    conflictInterest: 'Conflito de Interesse',
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
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
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
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionId}/${encodeURIComponent(documentId)}`,
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
    const q = buildTenantCollectionQuery('clientCases', tenantId, 'createdAt');

    return onSnapshot(q, (snapshot) => {
        const cases = snapshot.docs.map((documentSnapshot) => mapCaseDocument(documentSnapshot.id, documentSnapshot.data()));
        callback(cases, null);
    }, (error) => {
        console.error('Error subscribing to client cases:', error);
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
        collectionId: 'clientCases',
        tenantId,
        orderField: 'createdAt',
        timeoutMessage: 'Firestore client cases query timeout.',
        fallbackMessage: 'Firestore client cases REST fallback failed.',
        mapper: mapCaseDocument,
    });
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
    const fn = httpsCallable(functions, 'rerunEnrichmentPhase');
    const result = await fn({ caseId, phase });
    return result.data;
}

export async function callRerunAiAnalysis(caseId) {
    return callRerunEnrichmentPhase(caseId, 'ai');
}

async function callBackendFunction(name, payload) {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions(undefined, 'southamerica-east1');
    const fn = httpsCallable(functions, name);
    const result = await fn(payload);
    return result.data;
}

export async function callCreateClientSolicitation(payload) {
    return callBackendFunction('createClientSolicitation', payload);
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
