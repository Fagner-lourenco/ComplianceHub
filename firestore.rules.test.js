import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

function blockFor(matchPath) {
    const start = rules.indexOf(`match /${matchPath}`);
    expect(start, `match /${matchPath} not found`).toBeGreaterThanOrEqual(0);
    const next = rules.indexOf('\n    match /', start + 1);
    return rules.slice(start, next === -1 ? rules.length : next);
}

describe('firestore.rules V2 tenant isolation contracts', () => {
    it('declares tenant-safe helpers for ops reads and raw reads', () => {
        expect(rules).toContain('function canReadTenantDoc(tenantId)');
        expect(rules).toContain('function canReadRawTenantDoc(tenantId)');
        expect(rules).toContain('isGlobalAdmin()');
    });

    it.each([
        'decisions/{decisionId}',
        'reportSnapshots/{snapshotId}',
        'moduleRuns/{moduleRunId}',
        'subjects/{subjectId}',
        'persons/{personId}',
        'companies/{companyId}',
        'facts/{factId}',
        'relationships/{relationshipId}',
        'timelineEvents/{eventId}',
        'providerDivergences/{divergenceId}',
        'providerRequests/{requestId}',
        'evidenceItems/{evidenceId}',
        'riskSignals/{signalId}',
        'usageMeters/{usageMeterId}',
        'billingSettlements/{settlementId}',
        'watchlists/{watchlistId}',
        'monitoringSubscriptions/{subscriptionId}',
        'alerts/{alertId}',
    ])('%s reads are tenant-scoped', (path) => {
        expect(blockFor(path)).toContain('allow read: if canReadTenantDoc(');
    });

    it.each([
        'rawSnapshots/{snapshotId}',
        'providerRecords/{recordId}',
    ])('%s reads require raw permission and tenant scope', (path) => {
        expect(blockFor(path)).toContain('allow read: if canReadRawTenantDoc(resource.data.tenantId)');
    });

    it('prevents direct client SDK writes to auditLogs and tenantSettings', () => {
        expect(blockFor('auditLogs/{logId}')).toContain('allow create: if false');
        expect(blockFor('tenantSettings/{tenantId}')).toContain('allow create, update: if false');
    });

    it('keeps publicReports backend-owned for mutation', () => {
        const block = blockFor('publicReports/{token}');
        expect(block).toContain('allow create: if false');
        expect(block).toContain('allow update: if false');
    });
});
