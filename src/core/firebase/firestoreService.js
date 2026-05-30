import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    limitToLast,
    onSnapshot,
    orderBy,
    query,
    startAfter,
    where,
} from 'firebase/firestore';
import { auth, db } from './config';
import { CLIENT_ROLES } from '../rbac/permissions';

// Mock messages for demo mode
const MOCK_CASE_MESSAGES = {
    'CASE-001': [
        { id: 'msg-1', caseId: 'CASE-001', tenantId: 'TEN-001', senderRole: 'client', senderName: 'Paula Andrade', content: 'Bom dia! Gostaria de saber se ha alguma previsao de conclusao para a analise da Ana Paula.', createdAt: new Date('2026-03-20T10:30:00') },
        { id: 'msg-2', caseId: 'CASE-001', tenantId: 'TEN-001', senderRole: 'analyst', senderName: 'Analista Compliance', content: 'Bom dia, Paula! A analise esta em fase final de revisao. Prevemos conclusao ainda hoje.', createdAt: new Date('2026-03-20T11:00:00') },
        { id: 'msg-3', caseId: 'CASE-001', tenantId: 'TEN-001', senderRole: 'client', senderName: 'Paula Andrade', content: 'Otimo, agradeço o retorno!', createdAt: new Date('2026-03-20T11:15:00') },
    ],
    'CASE-002': [
        { id: 'msg-4', caseId: 'CASE-002', tenantId: 'TEN-001', senderRole: 'analyst', senderName: 'Analista Compliance', content: 'Prezados, identificamos achados graves na analise do candidato Carlos Eduardo Santos. Recomendamos agendamento de call para discutir.', createdAt: new Date('2026-03-19T14:00:00') },
        { id: 'msg-5', caseId: 'CASE-002', tenantId: 'TEN-001', senderRole: 'client', senderName: 'Paula Andrade', content: 'Vamos agendar sim. Obrigada pelo alerta.', createdAt: new Date('2026-03-19T14:30:00') },
    ],
    'CASE-003': [
        { id: 'msg-6', caseId: 'CASE-003', tenantId: 'TEN-001', senderRole: 'client', senderName: 'Paula Andrade', content: 'A candidata mudou de endereco recentemente. Precisam de alguma informacao adicional?', createdAt: new Date('2026-04-01T10:30:00') },
        { id: 'msg-7', caseId: 'CASE-003', tenantId: 'TEN-001', senderRole: 'analyst', senderName: 'Analista Compliance', content: 'Obrigada, Paula. Por enquanto nao e necessario. A consulta de mandados esta em andamento.', createdAt: new Date('2026-04-01T11:00:00') },
    ],
    'CASE-004': [
        { id: 'msg-8', caseId: 'CASE-004', tenantId: 'TEN-001', senderRole: 'analyst', senderName: 'Analista Compliance', content: 'O tribunal de MG apresentou instabilidade. A consulta criminal ficou inconclusiva.', createdAt: new Date('2026-03-25T15:00:00') },
        { id: 'msg-9', caseId: 'CASE-004', tenantId: 'TEN-001', senderRole: 'client', senderName: 'Paula Andrade', content: 'Entendido. O candidato ja trabalhou conosco antes, entao podemos prosseguir.', createdAt: new Date('2026-03-25T15:30:00') },
    ],
    'CASE-005': [
        { id: 'msg-5a', caseId: 'CASE-005', tenantId: 'TEN-001', senderRole: 'client', senderName: 'Paula Andrade', content: 'Bom dia! Gostaria de incluir Lucas Henrique na fila de analise para a vaga de Analista Financeiro.', createdAt: new Date('2026-04-03T09:00:00') },
        { id: 'msg-5b', caseId: 'CASE-005', tenantId: 'TEN-001', senderRole: 'analyst', senderName: 'Analista Compliance', content: 'Bom dia, Paula! Recebemos a solicitacao. O caso sera analisado em breve.', createdAt: new Date('2026-04-03T09:30:00') },
    ],
    'CASE-011': [
        { id: 'msg-10', caseId: 'CASE-011', tenantId: 'TEN-001', senderRole: 'analyst', senderName: 'Analista Compliance', content: 'Identificamos divergencia no CPF informado. Podem confirmar o numero correto?', createdAt: new Date('2026-04-05T09:00:00') },
        { id: 'msg-11', caseId: 'CASE-011', tenantId: 'TEN-001', senderRole: 'client', senderName: 'Paula Andrade', content: 'Vou verificar com o RH e retorno assim que possivel.', createdAt: new Date('2026-04-05T09:30:00') },
    ],
    'CASE-012': [
        { id: 'msg-12', caseId: 'CASE-012', tenantId: 'TEN-001', senderRole: 'analyst', senderName: 'Analista Compliance', content: 'Analise concluida. Identificamos achados graves que impedem a aprovacao. Relatorio detalhado disponivel.', createdAt: new Date('2026-03-22T16:00:00') },
        { id: 'msg-13', caseId: 'CASE-012', tenantId: 'TEN-001', senderRole: 'client', senderName: 'Paula Andrade', content: 'Agradecemos o retorno. Vamos analisar internamente antes de prosseguir.', createdAt: new Date('2026-03-22T16:15:00') },
    ],
    'CASE-013': [
        { id: 'msg-14', caseId: 'CASE-013', tenantId: 'TEN-001', senderRole: 'analyst', senderName: 'Analista Compliance', content: 'Pedro tem varias publicacoes politicas nas redes. Recomendamos atencao.', createdAt: new Date('2026-04-08T11:00:00') },
        { id: 'msg-15', caseId: 'CASE-013', tenantId: 'TEN-001', senderRole: 'client', senderName: 'Paula Andrade', content: 'Vamos considerar isso na entrevista. Obrigada pelo alerta.', createdAt: new Date('2026-04-08T11:30:00') },
    ],
    'CASE-006': [
        { id: 'msg-16', caseId: 'CASE-006', tenantId: 'TEN-002', senderRole: 'client', senderName: 'Felipe Duarte', content: 'Bruna e para a vaga de PLD. Precisamos de prioridade.', createdAt: new Date('2026-03-24T09:30:00') },
        { id: 'msg-17', caseId: 'CASE-006', tenantId: 'TEN-002', senderRole: 'analyst', senderName: 'Analista Compliance', content: 'Entendido, Felipe. Caso marcado como prioridade.', createdAt: new Date('2026-03-24T10:00:00') },
    ],
    'CASE-007': [
        { id: 'msg-18', caseId: 'CASE-007', tenantId: 'TEN-002', senderRole: 'analyst', senderName: 'Analista Compliance', content: 'Identificamos processo trabalhista em andamento. Detalhes no relatorio.', createdAt: new Date('2026-03-27T14:00:00') },
        { id: 'msg-19', caseId: 'CASE-007', tenantId: 'TEN-002', senderRole: 'client', senderName: 'Felipe Duarte', content: 'Vamos analisar internamente antes de prosseguir.', createdAt: new Date('2026-03-27T14:30:00') },
    ],
    'CASE-008': [
        { id: 'msg-20', caseId: 'CASE-008', tenantId: 'TEN-002', senderRole: 'analyst', senderName: 'Analista Compliance', content: 'Caso concluido. Sem restricoes identificadas.', createdAt: new Date('2026-04-02T10:00:00') },
        { id: 'msg-21', caseId: 'CASE-008', tenantId: 'TEN-002', senderRole: 'client', senderName: 'Felipe Duarte', content: 'Otimas noticias! Pode liberar o relatorio?', createdAt: new Date('2026-04-02T10:15:00') },
    ],
    'CASE-009': [
        { id: 'msg-22', caseId: 'CASE-009', tenantId: 'TEN-002', senderRole: 'client', senderName: 'Felipe Duarte', content: 'Fernando tem experiencia em outro banco. Podem verificar se ha conflito?', createdAt: new Date('2026-04-06T09:00:00') },
        { id: 'msg-23', caseId: 'CASE-009', tenantId: 'TEN-002', senderRole: 'analyst', senderName: 'Analista Compliance', content: 'Verificamos e nao identificamos conflito de interesse. Relatorio em anexo.', createdAt: new Date('2026-04-06T09:30:00') },
    ],
    'CASE-010': [
        { id: 'msg-24', caseId: 'CASE-010', tenantId: 'TEN-002', senderRole: 'analyst', senderName: 'Analista Compliance', content: 'Solicitamos correcao do CPF. O numero informado nao foi localizado.', createdAt: new Date('2026-04-10T10:00:00') },
        { id: 'msg-25', caseId: 'CASE-010', tenantId: 'TEN-002', senderRole: 'client', senderName: 'Felipe Duarte', content: 'Vou confirmar com o candidato e retorno.', createdAt: new Date('2026-04-10T10:30:00') },
    ],
};

const FIRESTORE_QUERY_TIMEOUT_MS = 5000;
const REST_FALLBACK_DELAY_MS = 2000;
let firebaseFunctionsModulePromise = null;

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
    criminal:         'Análise criminal',
    labor:            'Trabalhista',
    warrant:          'Mandado de prisão',
    osint:            'Perfis públicos',
    social:           'Social',
    digital:          'Perfil digital',
    conflictInterest: 'Conflito de interesse',
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
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
            reject(new Error(message));
        }, FIRESTORE_QUERY_TIMEOUT_MS);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        window.clearTimeout(timeoutId);
    });
}

function loadFirebaseFunctionsModule() {
    if (!firebaseFunctionsModulePromise) {
        firebaseFunctionsModulePromise = import('firebase/functions');
    }

    return firebaseFunctionsModulePromise;
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

function formatFirestoreTimestamp(value) {
    if (value?.toDate?.()) {
        return value.toDate().toISOString();
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
        createdAt: formatFirestoreTimestamp(data.createdAt),
        updatedAt: formatFirestoreTimestamp(data.updatedAt),
        concludedAt: formatFirestoreTimestamp(data.concludedAt),
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
const CASE_QUERY_LIMIT = 5000;
const MESSAGE_QUERY_LIMIT = 50;

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
    try {
        const snapshot = await withFirestoreTimeout(
            getDocs(buildTenantCollectionQuery(collectionId, tenantId, orderField)),
            timeoutMessage,
        );
        return snapshot.docs.map((documentSnapshot) => mapper(documentSnapshot.id, documentSnapshot.data()));
    } catch (sdkError) {
        console.warn(`[fetchOrderedCollection] SDK query failed for ${collectionId}, using REST fallback:`, sdkError.message);
        await new Promise((resolve) => {
            window.setTimeout(resolve, REST_FALLBACK_DELAY_MS);
        });

        try {
            const payload = await runFirestoreRestQuery(
                buildTenantStructuredQuery(collectionId, tenantId, orderField),
                fallbackMessage,
            );
            return mapRestQueryDocuments(payload, mapper);
        } catch (restError) {
            console.warn(`[fetchOrderedCollection] REST fallback failed for ${collectionId}:`, restError.message);
            return [];
        }
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
    if (!tenantId) return { analysisConfig: { ...DEFAULT_ANALYSIS_CONFIG }, dailyLimit: null, monthlyLimit: null, enrichmentConfig: null, slaHours: 48 };

    const snapshot = await getDoc(doc(db, 'tenantSettings', tenantId));
    if (!snapshot.exists()) return { analysisConfig: { ...DEFAULT_ANALYSIS_CONFIG }, dailyLimit: null, monthlyLimit: null, enrichmentConfig: null, slaHours: 48 };

    const data = snapshot.data();
    return {
        tenantName: data.tenantName ?? null,
        analysisConfig: { ...DEFAULT_ANALYSIS_CONFIG, ...data.analysisConfig },
        dailyLimit: data.dailyLimit ?? null,
        monthlyLimit: data.monthlyLimit ?? null,
        allowDailyExceedance: data.allowDailyExceedance ?? null,
        allowMonthlyExceedance: data.allowMonthlyExceedance ?? null,
        enrichmentConfig: data.enrichmentConfig ?? null,
        slaHours: data.slaHours ?? 48,
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
    const q = buildTenantCollectionQuery('cases', tenantId, 'createdAt', CASE_QUERY_LIMIT);

    return onSnapshot(q, (snapshot) => {
        const cases = snapshot.docs.map((documentSnapshot) => mapCaseDocument(documentSnapshot.id, documentSnapshot.data()));
        callback(cases, null);
    }, (error) => {
        console.error('Error subscribing to cases:', error);
        callback([], error);
    });
}

export function subscribeToClientCases(tenantId, callback) {
    const q = buildTenantCollectionQuery('clientCases', tenantId, 'createdAt', CASE_QUERY_LIMIT);

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
        createdAt: formatFirestoreTimestamp(data.createdAt),
        updatedAt: formatFirestoreTimestamp(data.updatedAt),
        concludedAt: formatFirestoreTimestamp(data.concludedAt),
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
            createdAt: formatFirestoreTimestamp(data.createdAt),
            updatedAt: formatFirestoreTimestamp(data.updatedAt),
            concludedAt: formatFirestoreTimestamp(data.concludedAt),
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
    const q = buildTenantCollectionQuery('auditLogs', tenantId, 'occurredAt');

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
        orderField: 'occurredAt',
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

export async function fetchClientPublicReports(cursor = null, pageSize = 50) {
    const payload = {};
    if (cursor) payload.lastCreatedAt = cursor;
    if (pageSize) payload.pageSize = Math.min(Math.max(Number(pageSize), 1), 200);
    const result = await callBackendFunction('listClientPublicReports', payload);
    return {
        reports: Array.isArray(result?.reports) ? result.reports : [],
        hasMore: Boolean(result?.hasMore),
        nextCursor: result?.nextCursor || null,
    };
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

export async function callRerunEnrichmentPhase(caseId, phase, scope = 'cascade', options = {}) {
    const { getFunctions, httpsCallable } = await loadFirebaseFunctionsModule();
    const functions = getFunctions(undefined, 'southamerica-east1');
    const fn = httpsCallable(functions, 'rerunEnrichmentPhase');
    const result = await fn({ caseId, phase, scope, ...options });
    return result.data;
}

export async function callRerunAiAnalysis(caseId) {
    return callRerunEnrichmentPhase(caseId, 'ai');
}

export async function callRerunFullEnrichment(caseId, options = {}) {
    return callRerunEnrichmentPhase(caseId, 'all', 'cascade', options);
}

async function callBackendFunction(name, payload) {
    const { getFunctions, httpsCallable } = await loadFirebaseFunctionsModule();
    const functions = getFunctions(undefined, 'southamerica-east1');
    const fn = httpsCallable(functions, name);
    const result = await fn(payload);
    return result.data;
}

export async function callGetClientGeoIp(clientIp = null) {
    return callBackendFunction('getClientGeoIp', clientIp ? { clientIp } : {});
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

export async function callListOpsUsers(payload = {}) {
    return callBackendFunction('listOpsUsers', payload);
}
export async function callCreateOpsUser(payload) {
    return callBackendFunction('createOpsUser', payload);
}
export async function callUpdateOpsUser(payload) {
    return callBackendFunction('updateOpsUser', payload);
}
export async function callAssignCaseToAnalyst(payload) {
    return callBackendFunction('assignCaseToAnalyst', payload);
}
export async function callUnassignCase(payload) {
    return callBackendFunction('unassignCase', payload);
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
    // Demo mode: return mock quota
    if (typeof window !== 'undefined' && window.location?.pathname?.startsWith('/demo')) {
        return {
            hasLimits: true,
            dailyLimit: 10,
            monthlyLimit: 100,
            dailyCount: 3,
            monthlyCount: 15,
            dailyRemaining: 7,
            monthlyRemaining: 85,
            resetAt: new Date(Date.now() + 86400000).toISOString(),
        };
    }
    return callBackendFunction('getClientQuotaStatus', {});
}

export async function callGetOpsCaseMetrics(payload = {}) {
    return callBackendFunction('getOpsCaseMetrics', payload);
}

export async function callGetClientDashboardMetrics() {
    return callBackendFunction('getClientDashboardMetrics', {});
}

export async function callListClientCases(payload = {}) {
    return callBackendFunction('listClientCases', payload);
}

export async function callListOpsCases(payload = {}) {
    return callBackendFunction('listOpsCases', payload);
}

export async function callGetClientExportCases(payload = {}) {
    return callBackendFunction('getClientExportCases', payload);
}

// Export assíncrono — Phase B
export async function callCreateExportJob(payload = {}) {
    return callBackendFunction('createExportJob', payload);
}

export async function callGetExportJobStatus(jobId) {
    return callBackendFunction('getExportJobStatus', { jobId });
}

export async function callListExportJobs(payload = {}) {
    return callBackendFunction('listExportJobs', payload);
}

export async function callCancelExportJob(jobId) {
    return callBackendFunction('cancelExportJob', { jobId });
}

export async function callGetClientCaseById(caseId) {
    const result = await callBackendFunction('getClientCaseById', { caseId });
    return result?.case || null;
}

export async function getClientCaseReportHtml(caseId) {
    const result = await callBackendFunction('getClientCaseReportHtml', { caseId });
    if (!result?.html) throw new Error('Backend nao retornou HTML do relatorio.');
    return result;
}

export async function getOpsCaseReportHtml(caseId) {
    const result = await callBackendFunction('getOpsCaseReportHtml', { caseId });
    if (!result?.html) throw new Error('Backend nao retornou HTML do relatorio.');
    return result;
}

export async function getOpsCaseReportPreview(caseId) {
    const result = await callBackendFunction('getOpsCaseReportPreview', { caseId });
    if (!result?.html) throw new Error('Backend nao retornou HTML da previa.');
    return result;
}

export async function getPublicReportView(token) {
    const result = await callBackendFunction('getPublicReportView', { token });
    if (!result?.html) throw new Error('Relatorio publico indisponivel.');
    return result;
}

export async function fetchOpsPublicReports(tenantId, pageSize = 100) {
    const result = await callBackendFunction('listOpsPublicReports', { tenantId: tenantId || null, pageSize });
    return Array.isArray(result?.reports) ? result.reports : [];
}

export async function generateClientCasePdf(caseId) {
    const result = await callBackendFunction('generateClientCasePdf', { caseId });
    if (!result?.url) throw new Error('Backend nao retornou URL do PDF.');
    return result;
}

export async function generatePublicReportPdf(token) {
    const result = await callBackendFunction('generatePublicReportPdf', { token });
    if (!result?.url) throw new Error('Backend nao retornou URL do PDF publico.');
    return result;
}

export function triggerPdfDownload(url, filename) {
    if (!url) throw new Error('URL do PDF vazia.');
    let objectUrl = null;
    try {
        if (url.startsWith('data:')) {
            const commaIdx = url.indexOf(',');
            if (commaIdx === -1) throw new Error('Data URL malformada (sem virgula).');
            const header = url.slice(0, commaIdx);
            const base64Raw = url.slice(commaIdx + 1);
            const mime = header.match(/data:([^;]+)/)?.[1] || 'application/pdf';
            // Strip any whitespace/newlines that may have been introduced
            const base64 = base64Raw.replace(/\s/g, '');
            // Validate base64 charset before atob
            if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
                throw new Error(`Base64 invalido (chars fora do alfabeto). Prefixo: ${base64.slice(0, 40)}`);
            }
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: mime });
            if (blob.size < 100) {
                throw new Error(`PDF decodificado vazio (${blob.size} bytes).`);
            }
            objectUrl = URL.createObjectURL(blob);
        }
        const link = document.createElement('a');
        link.href = objectUrl || url;
        link.download = filename;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } finally {
        if (objectUrl) window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    }
}

// Case Communication
export function subscribeToCaseMessages(caseId, tenantId, callback) {
    if (!caseId || !tenantId) {
        callback([], null);
        return () => {};
    }
    // Demo mode: return mock messages
    if (caseId.startsWith('CASE-') && (tenantId === 'TEN-001' || tenantId === 'TEN-002')) {
        const mockMessages = MOCK_CASE_MESSAGES[caseId] || [];
        setTimeout(() => callback(mockMessages, null), 300);
        return () => {};
    }
    const q = query(
        collection(db, 'caseMessages'),
        where('caseId', '==', caseId),
        where('tenantId', '==', tenantId),
        orderBy('createdAt', 'asc'),
        limitToLast(MESSAGE_QUERY_LIMIT)
    );
    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
            };
        });
        callback(messages, null);
    }, (error) => {
        console.error('Error subscribing to case messages:', error);
        callback([], error);
    });
}

export async function callSendCaseMessage(payload) {
    const { caseId, tenantId } = payload || {};
    // Demo mode: simulate success
    if (caseId?.startsWith('CASE-') && tenantId === 'TEN-001') {
        return { ok: true, messageId: `demo-msg-${Date.now()}`, simulated: true };
    }
    return callBackendFunction('sendCaseMessage', payload);
}

export async function callMarkCaseCommunicationRead(payload) {
    return callBackendFunction('markCaseCommunicationRead', payload);
}
