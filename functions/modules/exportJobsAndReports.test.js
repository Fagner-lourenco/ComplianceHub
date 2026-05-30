import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'compliance-hub-test';
process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || '{}';

const require = createRequire(import.meta.url);
const {
    resolvePublicReportStatus,
    serializeManagedPublicReport,
    sanitizePublicReportMeta,
    asDate,
    getPublicReportViewInner,
} = require('./exportJobsAndReports');

describe('resolvePublicReportStatus', () => {
    it('returns ACTIVE for valid report', () => {
        expect(resolvePublicReportStatus({ active: true, expiresAt: new Date('2099-01-01') })).toBe('ACTIVE');
    });

    it('returns REVOKED for inactive report', () => {
        expect(resolvePublicReportStatus({ active: false })).toBe('REVOKED');
    });

    it('returns EXPIRED for expired report', () => {
        expect(resolvePublicReportStatus({ active: true, expiresAt: new Date('2000-01-01') })).toBe('EXPIRED');
    });
});

describe('serializeManagedPublicReport', () => {
    it('serializes report doc correctly', () => {
        const docSnap = {
            id: 'token-123',
            data: () => ({
                caseId: 'case-1',
                tenantId: 'tenant-1',
                candidateName: 'João Silva',
                active: true,
                createdAt: new Date('2026-01-01'),
                expiresAt: new Date('2099-01-01'),
                reportBuildVersion: 42,
                publicSnapshotHash: 'abc123',
            }),
        };

        const result = serializeManagedPublicReport(docSnap);
        expect(result.id).toBe('token-123');
        expect(result.status).toBe('ACTIVE');
        expect(result.candidateName).toBe('João Silva');
    });
});

describe('sanitizePublicReportMeta', () => {
    it('defaults type to single', () => {
        expect(sanitizePublicReportMeta({}).type).toBe('single');
    });

    it('accepts batch type', () => {
        expect(sanitizePublicReportMeta({ type: 'batch' }).type).toBe('batch');
    });

    it('truncates candidateName', () => {
        const longName = 'a'.repeat(200);
        expect(sanitizePublicReportMeta({ candidateName: longName }).candidateName.length).toBe(160);
    });
});

describe('asDate', () => {
    it('returns Date for string', () => {
        const result = asDate('2026-01-01');
        expect(result instanceof Date).toBe(true);
    });

    it('returns null for invalid string', () => {
        expect(asDate('invalid')).toBeNull();
    });

    it('returns Date for Firestore timestamp', () => {
        const date = new Date('2026-01-01');
        expect(asDate({ toDate: () => date })).toEqual(date);
    });
});

describe('getPublicReportViewInner', () => {
    function buildMockDb({ reportData, caseData }) {
        return {
            collection: vi.fn((collectionName) => ({
                doc: vi.fn((docId) => ({
                    get: vi.fn(async () => {
                        if (collectionName === 'publicReports' && docId === 'token-123') {
                            return reportData
                                ? { exists: true, data: () => reportData }
                                : { exists: false, data: () => ({}) };
                        }
                        if (collectionName === 'cases' && docId === 'case-123') {
                            return caseData
                                ? { exists: true, data: () => caseData }
                                : { exists: false, data: () => ({}) };
                        }
                        return { exists: false, data: () => ({}) };
                    }),
                })),
            })),
        };
    }

    it('returns report for valid token', async () => {
        const db = buildMockDb({
            reportData: {
                html: '<html>test</html>',
                active: true,
                expiresAt: new Date('2099-01-01'),
                caseId: 'case-123',
                tenantId: 'tenant-1',
                candidateName: 'Test',
                createdAt: new Date('2026-01-01'),
                reportBuildVersion: 42,
            },
            caseData: {
                status: 'DONE',
                candidateName: 'Test User',
            },
        });

        const result = await getPublicReportViewInner('token-123', { db, REPORT_BUILD_VERSION: 42, asDate: (v) => v });
        expect(result.html).toBe('<html>test</html>');
        expect(result.candidateName).toBe('Test');
    });

    it('throws for revoked report', async () => {
        const db = buildMockDb({
            reportData: {
                html: '<html>test</html>',
                active: false,
                caseId: 'case-123',
            },
            caseData: { status: 'DONE' },
        });

        await expect(getPublicReportViewInner('token-123', { db, REPORT_BUILD_VERSION: 42, asDate: (v) => v }))
            .rejects.toThrow('Relatorio revogado');
    });

    it('throws for expired report', async () => {
        const db = buildMockDb({
            reportData: {
                html: '<html>test</html>',
                active: true,
                expiresAt: new Date('2000-01-01'),
                caseId: 'case-123',
            },
            caseData: { status: 'DONE' },
        });

        await expect(getPublicReportViewInner('token-123', { db, REPORT_BUILD_VERSION: 42, asDate: (v) => v }))
            .rejects.toThrow('Link expirado');
    });

    it('throws for outdated template', async () => {
        const db = buildMockDb({
            reportData: {
                html: '<html>test</html>',
                active: true,
                expiresAt: new Date('2099-01-01'),
                caseId: 'case-123',
                reportBuildVersion: 41,
            },
            caseData: { status: 'DONE' },
        });

        await expect(getPublicReportViewInner('token-123', { db, REPORT_BUILD_VERSION: 42, asDate: (v) => v }))
            .rejects.toThrow('Relatorio desatualizado');
    });
});
