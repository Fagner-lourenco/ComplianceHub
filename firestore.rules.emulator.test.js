import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
    deleteDoc,
    doc,
    getDoc,
    setDoc,
    Timestamp,
    updateDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'compliance-hub-br';

let testEnv;

function opsContext(role = 'analyst', tenantId = 'tenant-a') {
    return testEnv.authenticatedContext(`ops-${role}-${tenantId || 'global'}`, { role, tenantId });
}

function clientContext(role = 'client_manager', tenantId = 'tenant-a') {
    return testEnv.authenticatedContext(`client-${role}-${tenantId}`, { role, tenantId });
}

function publicContext() {
    return testEnv.unauthenticatedContext();
}

async function seed(path, data) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), path), data);
    });
}

describe('firestore.rules emulator - tenant isolation e V2 contracts', () => {
    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId: PROJECT_ID,
            firestore: {
                rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
            },
        });
    });

    afterAll(async () => {
        await testEnv.cleanup();
    });

    beforeEach(async () => {
        await testEnv.clearFirestore();
    });

    it.each([
        ['clientProjections/proj-a', { tenantId: 'tenant-a', status: 'DONE' }],
        ['alerts/alert-a', { tenantId: 'tenant-a', state: 'unread' }],
        ['quoteRequests/quote-a', { tenantId: 'tenant-a', status: 'REQUESTED' }],
    ])('client tenant A reads own client-safe document %s and not tenant B', async (path, payload) => {
        const otherPath = path.replace('-a', '-b');
        await seed(path, payload);
        await seed(otherPath, { ...payload, tenantId: 'tenant-b' });

        const clientDb = clientContext('client_manager', 'tenant-a').firestore();
        await assertSucceeds(getDoc(doc(clientDb, path)));
        await assertFails(getDoc(doc(clientDb, otherPath)));
    });

    it.each([
        'decisions/decision-a',
        'reportSnapshots/snapshot-a',
        'moduleRuns/module-a',
        'subjects/subject-a',
        'persons/person-a',
        'companies/company-a',
        'facts/fact-a',
        'relationships/relationship-a',
        'timelineEvents/event-a',
        'providerDivergences/divergence-a',
        'providerRequests/request-a',
        'evidenceItems/evidence-a',
        'riskSignals/signal-a',
        'usageMeters/meter-a',
        'billingSettlements/settlement-a',
        'watchlists/watchlist-a',
        'seniorReviewRequests/senior-a',
    ])('analyst tenant A reads own internal document but not tenant B: %s', async (path) => {
        const otherPath = path.replace('-a', '-b');
        await seed(path, { tenantId: 'tenant-a', status: 'ok' });
        await seed(otherPath, { tenantId: 'tenant-b', status: 'ok' });

        const analystDb = opsContext('analyst', 'tenant-a').firestore();
        await assertSucceeds(getDoc(doc(analystDb, path)));
        await assertFails(getDoc(doc(analystDb, otherPath)));
    });

    it('rawSnapshots and providerRecords require senior raw permission and tenant scope', async () => {
        await seed('rawSnapshots/raw-a', { tenantId: 'tenant-a', payloadRef: 'raw/a.json' });
        await seed('rawSnapshots/raw-b', { tenantId: 'tenant-b', payloadRef: 'raw/b.json' });
        await seed('providerRecords/record-a', { tenantId: 'tenant-a', normalized: true });

        const analystDb = opsContext('analyst', 'tenant-a').firestore();
        const seniorDb = opsContext('senior_analyst', 'tenant-a').firestore();

        await assertFails(getDoc(doc(analystDb, 'rawSnapshots/raw-a')));
        await assertSucceeds(getDoc(doc(seniorDb, 'rawSnapshots/raw-a')));
        await assertFails(getDoc(doc(seniorDb, 'rawSnapshots/raw-b')));
        await assertSucceeds(getDoc(doc(seniorDb, 'providerRecords/record-a')));
    });

    it('blocks direct client SDK writes for backend-owned governance collections', async () => {
        const analystDb = opsContext('admin', 'tenant-a').firestore();
        const clientDb = clientContext('client_manager', 'tenant-a').firestore();

        await assertFails(setDoc(doc(analystDb, 'auditLogs/log-a'), { tenantId: 'tenant-a' }));
        await assertFails(updateDoc(doc(analystDb, 'tenantSettings/tenant-a'), { dailyLimit: 10 }));
        await assertFails(setDoc(doc(analystDb, 'tenantEntitlements/tenant-a'), { tier: 'premium' }));
        await assertFails(setDoc(doc(analystDb, 'exports/export-a'), { tenantId: 'tenant-a' }));
        await assertFails(setDoc(doc(clientDb, 'quoteRequests/quote-direct'), { tenantId: 'tenant-a' }));
        await assertFails(setDoc(doc(analystDb, 'watchlists/watch-direct'), { tenantId: 'tenant-a' }));
        await assertFails(setDoc(doc(analystDb, 'seniorReviewRequests/senior-direct'), { tenantId: 'tenant-a' }));
    });

    it('publicReports read only active and non-expired tokens, never direct writes', async () => {
        const future = Timestamp.fromDate(new Date(Date.now() + 60 * 60 * 1000));
        const past = Timestamp.fromDate(new Date(Date.now() - 60 * 60 * 1000));
        await seed('publicReports/token-ready', { active: true, expiresAt: future, tenantId: 'tenant-a' });
        await seed('publicReports/token-expired', { active: true, expiresAt: past, tenantId: 'tenant-a' });
        await seed('publicReports/token-revoked', { active: false, expiresAt: future, tenantId: 'tenant-a' });

        const db = publicContext().firestore();
        await assertSucceeds(getDoc(doc(db, 'publicReports/token-ready')));
        await assertFails(getDoc(doc(db, 'publicReports/token-expired')));
        await assertFails(getDoc(doc(db, 'publicReports/token-revoked')));
        await assertFails(deleteDoc(doc(opsContext('admin', 'tenant-a').firestore(), 'publicReports/token-ready')));
    });
});
