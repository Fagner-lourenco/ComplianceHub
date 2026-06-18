import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'compliance-hub-test';
process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || '{}';

vi.mock('firebase-functions/v2/https', () => ({
    HttpsError: class HttpsError extends Error {
        constructor(code, message) {
            super(message);
            this.code = code;
        }
    },
}));

const require = createRequire(import.meta.url);
const {
    resolvePublicReportStatus,
    serializeManagedPublicReport,
    sanitizePublicReportMeta,
    asDate,
    getPublicReportViewInner,
    createExportJobHandler,
    createGetExportJobStatusHandler,
    createListExportJobsHandler,
    createCancelExportJobHandler,
    createProcessExportJobHandler,
} = require('./exportJobsAndReports');
const { FieldValue } = require('firebase-admin/firestore');

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
        expect(result.tenantId).toBeUndefined();
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

// ── Export Job Handler Tests (Phase B) ──

const EXPORT_JOB_STATUS = { PENDING: 'pending', PROCESSING: 'processing', DONE: 'done', FAILED: 'failed', CANCELLED: 'cancelled' };
const MAX_PENDING_JOBS_PER_USER = 5;

function makeExportDeps(overrides = {}) {
    return {
        db: { collection: vi.fn() },
        getClientUserProfile: vi.fn().mockResolvedValue({ uid: 'u1', tenantId: 't1', role: 'client_manager' }),
        assertClientManager: vi.fn(),
        validateExportJobPayload: vi.fn((d) => ({ format: d?.format || 'csv', filters: d?.filters || {} })),
        EXPORT_JOB_STATUS,
        MAX_PENDING_JOBS_PER_USER,
        FieldValue,
        getStorage: vi.fn().mockReturnValue({ bucket: vi.fn() }),
        buildCsvContent: vi.fn().mockReturnValue('csv,data'),
        buildExportFilename: vi.fn().mockReturnValue('exports/t1/file.csv'),
        serializeClientCaseDocument: vi.fn(),
        matchesClientCaseFilters: vi.fn().mockReturnValue(true),
        ...overrides,
    };
}

function makeRequest(overrides = {}) {
    return { auth: { uid: 'u1', token: {} }, data: {}, ...overrides };
}

describe('createExportJobHandler', () => {
    it('retorna job criado com sucesso', async () => {
        const deps = makeExportDeps();
        const jobRef = { id: 'job-123', set: vi.fn().mockResolvedValue(undefined) };
        deps.db.collection = vi.fn().mockReturnValue({ doc: vi.fn().mockReturnValue(jobRef) });
        const countQuery = { data: () => ({ count: 0 }), get: vi.fn().mockResolvedValue({ data: () => ({ count: 0 }) }) };
        deps.db.collection = vi.fn((name) => {
            if (name === 'exportJobs') return {
                where: vi.fn().mockReturnThis(),
                orderBy: vi.fn().mockReturnThis(),
                count: vi.fn().mockReturnValue(countQuery),
                doc: vi.fn().mockReturnValue(jobRef),
            };
        });

        const handler = createExportJobHandler(deps);
        const result = await handler(makeRequest());
        expect(result).toEqual({ jobId: 'job-123', status: 'pending' });
    });

    it('rejeita usuario sem autenticacao', async () => {
        const handler = createExportJobHandler(makeExportDeps());
        await expect(handler(makeRequest({ auth: null }))).rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('rejeita scope invalido', async () => {
        const handler = createExportJobHandler(makeExportDeps());
        await expect(handler(makeRequest({ data: { scopeCode: 'INVALIDO' } }))).rejects.toMatchObject({ code: 'invalid-argument' });
    });
});

describe('createGetExportJobStatusHandler', () => {
    it('rejeita jobId ausente', async () => {
        const handler = createGetExportJobStatusHandler(makeExportDeps());
        await expect(handler(makeRequest())).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('rejeita usuario sem autenticacao', async () => {
        const handler = createGetExportJobStatusHandler(makeExportDeps());
        await expect(handler(makeRequest({ auth: null }))).rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('rejeita job nao encontrado', async () => {
        const deps = makeExportDeps();
        deps.db.collection = vi.fn().mockReturnValue({
            doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: false }) }),
        });
        const handler = createGetExportJobStatusHandler(deps);
        await expect(handler(makeRequest({ data: { jobId: 'j1' } }))).rejects.toMatchObject({ code: 'not-found' });
    });
});

describe('createListExportJobsHandler', () => {
    it('rejeita usuario sem autenticacao', async () => {
        const handler = createListExportJobsHandler(makeExportDeps());
        await expect(handler(makeRequest({ auth: null }))).rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('lista jobs com sucesso', async () => {
        const deps = makeExportDeps();
        const mockQuery = {
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
                docs: [{
                    id: 'j1',
                    data: () => ({ status: 'pending', format: 'csv', scopeCode: 'ALL', createdAt: { toDate: () => new Date() } }),
                }],
            }),
        };
        deps.db.collection = vi.fn().mockReturnValue(mockQuery);
        const handler = createListExportJobsHandler(deps);
        const result = await handler(makeRequest());
        expect(result.jobs).toHaveLength(1);
    });
});

describe('createCancelExportJobHandler', () => {
    it('rejeita jobId ausente', async () => {
        const handler = createCancelExportJobHandler(makeExportDeps());
        await expect(handler(makeRequest())).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('rejeita job ja concluido', async () => {
        const deps = makeExportDeps();
        deps.db.collection = vi.fn().mockReturnValue({
            doc: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ status: 'done', tenantId: 't1' }) }),
            }),
        });
        const handler = createCancelExportJobHandler(deps);
        await expect(handler(makeRequest({ data: { jobId: 'j1' } }))).rejects.toMatchObject({ code: 'failed-precondition' });
    });
});

describe('createProcessExportJobHandler', () => {
    it('rejeita jobId ausente', async () => {
        const deps = makeExportDeps();
        deps.db.collection = vi.fn().mockReturnValue({
            doc: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({ exists: false }),
            }),
        });
        const handler = createProcessExportJobHandler(deps);
        await expect(handler(makeRequest({ data: { jobId: '' } }))).rejects.toMatchObject({ code: 'invalid-argument' });
    });
});
