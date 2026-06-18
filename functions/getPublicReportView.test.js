import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'compliance-hub-test';
process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || '{}';

const require = createRequire(import.meta.url);
const { getPublicReportViewInner } = require('./modules/exportJobsAndReports');
const { REPORT_BUILD_VERSION } = require('./reportBuilder.cjs');

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

describe('getPublicReportViewInner', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('serve relatório válido sem invalidar por hash diferente do caso atual', async () => {
        const db = buildMockDb({
            reportData: {
                html: '<html><body>Relatório publicado</body></html>',
                active: true,
                expiresAt: new Date('2099-01-01T00:00:00.000Z'),
                caseId: 'case-123',
                tenantId: 'tenant-1',
                candidateName: 'Maria Silva',
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                reportBuildVersion: REPORT_BUILD_VERSION,
                publicSnapshotHash: 'hash-salvo-do-relatorio',
            },
            caseData: {
                status: 'DONE',
                candidateName: 'Maria Silva Atualizada',
                updatedAt: new Date('2026-01-02T00:00:00.000Z'),
                finalVerdict: 'APROVADO',
                executiveSummary: 'Conteúdo atual do caso mudou depois da publicação.',
            },
        });

        const result = await getPublicReportViewInner('token-123', { db, REPORT_BUILD_VERSION, asDate: (v) => v });

        expect(result.html).toContain('Relatório publicado');
        expect(result.publicSnapshotHash).toBe('hash-salvo-do-relatorio');
        expect(result.candidateName).toBe('Maria Silva');
    });

    it('continua rejeitando relatório com template desatualizado', async () => {
        const db = buildMockDb({
            reportData: {
                html: '<html><body>Relatório publicado</body></html>',
                active: true,
                expiresAt: new Date('2099-01-01T00:00:00.000Z'),
                caseId: 'case-123',
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                reportBuildVersion: REPORT_BUILD_VERSION - 1,
                publicSnapshotHash: 'hash-salvo-do-relatorio',
            },
            caseData: {
                status: 'DONE',
                candidateName: 'Maria Silva',
            },
        });

        await expect(getPublicReportViewInner('token-123', { db, REPORT_BUILD_VERSION, asDate: (v) => v })).rejects.toThrow('Relatorio desatualizado');
    });
});
