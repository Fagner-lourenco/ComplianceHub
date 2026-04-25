import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rules = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8');

describe('firestore.rules V1 safety contract', () => {
    it('keeps raw cases ops-only and publicResult function-owned', () => {
        expect(rules).toContain('match /cases/{caseId}');
        expect(rules).toContain('Client portal must consume the sanitized mirror in /clientCases.');
        expect(rules).toContain('allow read: if isAuthenticated() && isAnalyst();');
        expect(rules).toContain('match /publicResult/{docId}');
        expect(rules).toContain('Only Cloud Functions write here');
    });

    it('keeps client-facing mirrors tenant scoped and function-owned', () => {
        expect(rules).toContain('match /clientCases/{caseId}');
        expect(rules).toContain('(isClient() && isSameTenant(resource.data.tenantId))');
        expect(rules).toContain('match /tenantAuditLogs/{logId}');
        expect(rules).toContain('Only Cloud Functions write here (via writeAuditEvent projection)');
    });

    it('blocks direct client SDK mutation of sensitive operational collections', () => {
        expect(rules).toContain('match /auditLogs/{logId}');
        expect(rules).toContain('Complete audit trail is written by Cloud Functions');
        expect(rules).toContain('match /tenantSettings/{tenantId}');
        expect(rules).toContain('allow create, update: if false;');
        expect(rules).toContain('match /exports/{exportId}');
        expect(rules).toContain('Export registration is owned by registerClientExport.');
        expect(rules).toContain('match /tenantUsage/{tenantId}');
    });

    it('allows public reports only by active non-expired token and blocks direct writes', () => {
        expect(rules).toContain('match /publicReports/{token}');
        expect(rules).toContain('resource.data.expiresAt is timestamp');
        expect(rules).toContain('request.time < resource.data.expiresAt');
        expect(rules).toContain('resource.data.active != false');
        expect(rules).toContain('allow create: if false;');
        expect(rules).toContain('allow update: if false;');
    });
});
