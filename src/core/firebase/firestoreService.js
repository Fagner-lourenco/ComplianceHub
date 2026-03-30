import {
    collection,
    deleteField,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { auth, db, secondaryAuth } from './config';
import { CLIENT_ROLES, ROLES } from '../rbac/permissions';

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
        timestamp: formatFirestoreDateTime(data.timestamp),
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

/**
 * Creates a new Auth user (using secondary app) and their Firestore profile.
 */
export async function createClientUser({
    email,
    password,
    displayName,
    tenantName,
    tenantId: existingTenantId = null,
    role = ROLES.CLIENT_MANAGER,
}) {
    try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const newUid = userCredential.user.uid;
        const tenantId = existingTenantId || tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

        await updateProfile(userCredential.user, { displayName });

        await setDoc(doc(db, 'userProfiles', newUid), {
            email,
            displayName,
            role,
            tenantId,
            tenantName,
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        await initializeTenantSettings(tenantId);

        return { uid: newUid, tenantId };
    } finally {
        await signOut(secondaryAuth).catch(() => {});
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
    if (!tenantId) return { analysisConfig: { ...DEFAULT_ANALYSIS_CONFIG }, dailyLimit: null, monthlyLimit: null };

    const snapshot = await getDoc(doc(db, 'tenantSettings', tenantId));
    if (!snapshot.exists()) return { analysisConfig: { ...DEFAULT_ANALYSIS_CONFIG }, dailyLimit: null, monthlyLimit: null };

    const data = snapshot.data();
    return {
        analysisConfig: { ...DEFAULT_ANALYSIS_CONFIG, ...data.analysisConfig },
        dailyLimit: data.dailyLimit ?? null,
        monthlyLimit: data.monthlyLimit ?? null,
    };
}

export function updateTenantSettings(tenantId, analysisConfig, limits) {
    const payload = { analysisConfig, updatedAt: serverTimestamp() };
    if (limits) {
        payload.dailyLimit = limits.dailyLimit ?? null;
        payload.monthlyLimit = limits.monthlyLimit ?? null;
    }
    setDoc(doc(db, 'tenantSettings', tenantId), payload, { merge: true }).catch((error) => console.error('Tenant settings write failed:', error));
}

async function initializeTenantSettings(tenantId) {
    const snapshot = await getDoc(doc(db, 'tenantSettings', tenantId));
    if (snapshot.exists()) return;

    await setDoc(doc(db, 'tenantSettings', tenantId), {
        analysisConfig: { ...DEFAULT_ANALYSIS_CONFIG },
        updatedAt: serverTimestamp(),
    });
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

export async function createCase(data) {
    const ref = doc(collection(db, 'cases'));
    await setDoc(ref, {
        ...data,
        status: 'PENDING',
        assigneeId: null,
        criminalFlag: null,
        laborFlag: null,
        laborSeverity: null,
        laborNotes: '',
        warrantFlag: null,
        warrantNotes: '',
        osintLevel: null,
        socialStatus: null,
        digitalFlag: null,
        conflictInterest: null,
        finalVerdict: 'PENDING',
        riskLevel: null,
        riskScore: 0,
        hasNotes: false,
        hasEvidence: false,
        enabledPhases: data.enabledPhases || Object.keys(DEFAULT_ANALYSIS_CONFIG),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
}

export async function updateCase(caseId, data) {
    await updateDoc(doc(db, 'cases', caseId), {
        ...data,
        updatedAt: serverTimestamp(),
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

export async function createCandidate(data) {
    const ref = doc(collection(db, 'candidates'));
    await setDoc(ref, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
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

export function logAuditEvent({ tenantId, userId, userEmail, action, target, detail }) {
    const ref = doc(collection(db, 'auditLogs'));
    return setDoc(ref, {
        tenantId: tenantId || null,
        userId,
        user: userEmail,
        action,
        target,
        detail,
        ip: 'browser',
        timestamp: serverTimestamp(),
    }).catch((error) => console.error('Audit log write sync failed:', error));
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

export async function createExport(data) {
    const ref = doc(collection(db, 'exports'));
    await setDoc(ref, {
        ...data,
        status: 'READY',
        createdAt: serverTimestamp(),
    });
    return ref.id;
}

/* =========================================================
   PUBLIC REPORTS
   ========================================================= */

export async function savePublicReport(html, meta = {}) {
    const ref = doc(collection(db, 'publicReports'));
    await setDoc(ref, {
        html,
        createdAt: serverTimestamp(),
        ...meta,
    });
    return ref.id;
}

export async function getPublicReport(token) {
    const ref = doc(db, 'publicReports', token);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
}
