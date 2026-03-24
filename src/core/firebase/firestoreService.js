import {
    collection, doc, addDoc, getDoc, updateDoc, onSnapshot,
    query, where, orderBy, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db } from './config';

/* =========================================================
   CASES
   ========================================================= */

/**
 * Subscribe to cases in real-time.
 * @param {string|null} tenantId - If null, returns ALL cases (ops portal). If set, filters by tenant.
 * @param {Function} callback - (cases[]) => void
 * @returns {Function} unsubscribe
 */
export function subscribeToCases(tenantId, callback) {
    let q;
    if (tenantId) {
        q = query(
            collection(db, 'cases'),
            where('tenantId', '==', tenantId),
            orderBy('createdAt', 'desc')
        );
    } else {
        q = query(collection(db, 'cases'), orderBy('createdAt', 'desc'));
    }

    return onSnapshot(q, (snapshot) => {
        const cases = snapshot.docs.map(d => ({
            id: d.id,
            ...d.data(),
            // Convert Firestore Timestamp to ISO string for display
            createdAt: d.data().createdAt?.toDate?.()
                ? d.data().createdAt.toDate().toISOString().split('T')[0]
                : d.data().createdAt || '',
        }));
        callback(cases);
    }, (error) => {
        console.error('Error subscribing to cases:', error);
        callback([]);
    });
}

/**
 * Get a single case by ID.
 */
export async function getCase(caseId) {
    const snap = await getDoc(doc(db, 'cases', caseId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
        id: snap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()
            ? data.createdAt.toDate().toISOString().split('T')[0]
            : data.createdAt || '',
    };
}

/**
 * Create a new case.
 */
export async function createCase(data) {
    const ref = await addDoc(collection(db, 'cases'), {
        ...data,
        status: 'PENDING',
        assigneeId: null,
        criminalFlag: null,
        osintLevel: null,
        socialStatus: null,
        digitalFlag: null,
        conflictInterest: null,
        finalVerdict: 'PENDING',
        riskLevel: null,
        riskScore: 0,
        hasNotes: false,
        hasEvidence: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
}

/**
 * Update a case (partial update).
 */
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
    let q;
    if (tenantId) {
        q = query(collection(db, 'candidates'), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'));
    } else {
        q = query(collection(db, 'candidates'), orderBy('createdAt', 'desc'));
    }

    return onSnapshot(q, (snapshot) => {
        const candidates = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(candidates);
    }, (error) => {
        console.error('Error subscribing to candidates:', error);
        callback([]);
    });
}

export async function createCandidate(data) {
    const ref = await addDoc(collection(db, 'candidates'), {
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
    let q;
    if (tenantId) {
        q = query(collection(db, 'auditLogs'), where('tenantId', '==', tenantId), orderBy('timestamp', 'desc'));
    } else {
        q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'));
    }

    return onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                timestamp: data.timestamp?.toDate?.()
                    ? data.timestamp.toDate().toISOString().replace('T', ' ').substring(0, 19)
                    : data.timestamp || '',
            };
        });
        callback(logs);
    }, (error) => {
        console.error('Error subscribing to audit logs:', error);
        callback([]);
    });
}

export async function logAuditEvent({ tenantId, userId, userEmail, action, target, detail }) {
    await addDoc(collection(db, 'auditLogs'), {
        tenantId: tenantId || null,
        userId,
        user: userEmail,
        action,
        target,
        detail,
        ip: 'browser',
        timestamp: serverTimestamp(),
    });
}

/* =========================================================
   EXPORTS
   ========================================================= */

export function subscribeToExports(tenantId, callback) {
    let q;
    if (tenantId) {
        q = query(collection(db, 'exports'), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'));
    } else {
        q = query(collection(db, 'exports'), orderBy('createdAt', 'desc'));
    }

    return onSnapshot(q, (snapshot) => {
        const exports = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(exports);
    });
}

export async function createExport(data) {
    const ref = await addDoc(collection(db, 'exports'), {
        ...data,
        status: 'READY',
        createdAt: serverTimestamp(),
    });
    return ref.id;
}
