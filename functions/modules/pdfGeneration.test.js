/**
 * Testes para pdfGeneration.js
 */

import { describe, it, expect, vi } from 'vitest';
import {
    makeSafePdfFilename,
    asIsoForFilename,
    generateClientCasePdfLogic,
    generatePublicReportPdfLogic,
} from './pdfGeneration';

describe('makeSafePdfFilename', () => {
    it('normaliza nome com acentos', () => {
        expect(makeSafePdfFilename('João Silva')).toBe('Joao Silva');
    });

    it('substitui caracteres especiais por underscore', () => {
        expect(makeSafePdfFilename('Maria@Silva#123')).toBe('Maria_Silva_123');
    });

    it('retorna relatorio quando vazio', () => {
        expect(makeSafePdfFilename('')).toBe('relatorio');
    });

    it('trunca em 80 caracteres', () => {
        const longName = 'A'.repeat(100);
        expect(makeSafePdfFilename(longName).length).toBe(80);
    });
});

describe('asIsoForFilename', () => {
    it('formata data para ISO sem caracteres invalidos', () => {
        const date = new Date('2026-05-30T14:30:00.000Z');
        const result = asIsoForFilename(date);
        expect(result).not.toContain(':');
        expect(result).not.toContain('.');
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
    });

    it('aceita string de data', () => {
        const result = asIsoForFilename('2026-05-30');
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
});

describe('generateClientCasePdfLogic', () => {
    it('retorna signedUrl quando upload bem-sucedido', async () => {
        const mockPdfBuffer = Buffer.from('pdf-data');
        const prepareCanonicalReport = vi.fn(async () => ({ html: '<html></html>' }));
        const renderHtmlToPdfBuffer = vi.fn(async () => mockPdfBuffer);
        const injectPdfExportCss = vi.fn((html) => html);
        const hasPublicReportMinimumContent = vi.fn(() => true);
        const writeAuditEvent = vi.fn();
        const getClientIp = vi.fn(() => '127.0.0.1');
        const savePdfAndCreateSignedUrl = vi.fn(async () => ({
            signedUrl: 'https://storage/signed-url',
            filePath: 'path/to/file.pdf',
            filename: 'file.pdf',
        }));

        const setFn = vi.fn();
        const collectionPdfExports = vi.fn(() => ({
            doc: vi.fn(() => ({ set: setFn })),
        }));
        const caseRef = {
            get: vi.fn(async () => ({
                exists: true,
                data: () => ({
                    status: 'DONE',
                    tenantId: 't1',
                    candidateName: 'John Doe',
                }),
            })),
            collection: collectionPdfExports,
        };
        const db = {
            collection: vi.fn(() => ({
                doc: vi.fn(() => caseRef),
            })),
        };

        const result = await generateClientCasePdfLogic({
            db,
            caseId: 'c1',
            uid: 'u1',
            profile: { tenantId: 't1', email: 'a@b.com' },
            request: {},
            prepareCanonicalReport,
            renderHtmlToPdfBuffer,
            injectPdfExportCss,
            hasPublicReportMinimumContent,
            writeAuditEvent,
            ACTOR_TYPE: { CLIENT_USER: 'CLIENT_USER' },
            SOURCE: { PORTAL_CLIENT: 'PORTAL_CLIENT' },
            getClientIp,
            savePdfAndCreateSignedUrl,
        });

        expect(result.url).toContain('signed-url');
        expect(result.expiresInSeconds).toBe(900);
    });

    it('retorna base64 fallback quando upload falha com bucket missing', async () => {
        const mockPdfBuffer = Buffer.from('pdf-data');
        const prepareCanonicalReport = vi.fn(async () => ({ html: '<html></html>' }));
        const renderHtmlToPdfBuffer = vi.fn(async () => mockPdfBuffer);
        const injectPdfExportCss = vi.fn((html) => html);
        const hasPublicReportMinimumContent = vi.fn(() => true);
        const writeAuditEvent = vi.fn();
        const getClientIp = vi.fn(() => '127.0.0.1');
        const savePdfAndCreateSignedUrl = vi.fn(async () => {
            const err = new Error('bucket does not exist');
            err.code = 404;
            throw err;
        });

        const caseRef = {
            get: vi.fn(async () => ({
                exists: true,
                data: () => ({
                    status: 'DONE',
                    tenantId: 't1',
                    candidateName: 'John Doe',
                }),
            })),
        };
        const db = {
            collection: vi.fn(() => ({
                doc: vi.fn(() => caseRef),
            })),
        };

        const result = await generateClientCasePdfLogic({
            db,
            caseId: 'c1',
            uid: 'u1',
            profile: { tenantId: 't1', email: 'a@b.com' },
            request: {},
            prepareCanonicalReport,
            renderHtmlToPdfBuffer,
            injectPdfExportCss,
            hasPublicReportMinimumContent,
            writeAuditEvent,
            ACTOR_TYPE: { CLIENT_USER: 'CLIENT_USER' },
            SOURCE: { PORTAL_CLIENT: 'PORTAL_CLIENT' },
            getClientIp,
            savePdfAndCreateSignedUrl,
        });

        expect(result.url).toContain('data:application/pdf;base64');
        expect(result.fallback).toBe('base64');
    });

    it('lança erro quando caso não está DONE', async () => {
        const caseRef = {
            get: vi.fn(async () => ({
                exists: true,
                data: () => ({
                    status: 'IN_PROGRESS',
                    tenantId: 't1',
                }),
            })),
        };
        const db = {
            collection: vi.fn(() => ({
                doc: vi.fn(() => caseRef),
            })),
        };

        await expect(
            generateClientCasePdfLogic({
                db,
                caseId: 'c1',
                uid: 'u1',
                profile: { tenantId: 't1' },
                request: {},
                prepareCanonicalReport: vi.fn(),
                renderHtmlToPdfBuffer: vi.fn(),
                injectPdfExportCss: vi.fn(),
                hasPublicReportMinimumContent: vi.fn(),
                writeAuditEvent: vi.fn(),
                ACTOR_TYPE: {},
                SOURCE: {},
                getClientIp: vi.fn(),
            })
        ).rejects.toThrow('PDF disponivel apenas para casos concluidos');
    });
});

describe('generatePublicReportPdfLogic', () => {
    it('retorna signedUrl quando upload bem-sucedido', async () => {
        const mockPdfBuffer = Buffer.from('pdf-data');
        const renderHtmlToPdfBuffer = vi.fn(async () => mockPdfBuffer);
        const injectPdfExportCss = vi.fn((html) => html);
        const resolvePublicReportStatus = vi.fn(() => 'ACTIVE');
        const writeAuditEvent = vi.fn();
        const getClientIp = vi.fn(() => '127.0.0.1');
        const savePdfAndCreateSignedUrl = vi.fn(async () => ({
            signedUrl: 'https://storage/signed-url',
            filePath: 'path/to/file.pdf',
            filename: 'file.pdf',
        }));

        const setFn = vi.fn();
        const collectionPdfExports = vi.fn(() => ({
            doc: vi.fn(() => ({ set: setFn })),
        }));
        const reportRef = {
            get: vi.fn(async () => ({
                exists: true,
                data: () => ({
                    html: '<html></html>',
                    active: true,
                    candidateName: 'Jane Doe',
                    caseId: 'c1',
                }),
            })),
            collection: collectionPdfExports,
        };
        const db = {
            collection: vi.fn((name) => ({
                doc: vi.fn(() => {
                    if (name === 'publicReports') return reportRef;
                    return {
                        get: vi.fn(async () => ({
                            exists: true,
                            data: () => ({ status: 'DONE' }),
                        })),
                    };
                }),
            })),
        };

        const result = await generatePublicReportPdfLogic({
            db,
            token: 'token-123',
            request: {},
            renderHtmlToPdfBuffer,
            injectPdfExportCss,
            resolvePublicReportStatus,
            writeAuditEvent,
            ACTOR_TYPE: { PUBLIC_LINK: 'PUBLIC_LINK' },
            SOURCE: { PUBLIC_REPORT: 'PUBLIC_REPORT' },
            getClientIp,
            savePdfAndCreateSignedUrl,
        });

        expect(result.url).toContain('signed-url');
        expect(result.expiresInSeconds).toBe(900);
    });

    it('lança erro quando relatório expirado', async () => {
        const resolvePublicReportStatus = vi.fn(() => 'EXPIRED');
        const reportRef = {
            get: vi.fn(async () => ({
                exists: true,
                data: () => ({ active: true }),
            })),
        };
        const db = {
            collection: vi.fn(() => ({
                doc: vi.fn(() => reportRef),
            })),
        };

        await expect(
            generatePublicReportPdfLogic({
                db,
                token: 'token-123',
                request: {},
                renderHtmlToPdfBuffer: vi.fn(),
                injectPdfExportCss: vi.fn(),
                resolvePublicReportStatus,
                writeAuditEvent: vi.fn(),
                ACTOR_TYPE: {},
                SOURCE: {},
                getClientIp: vi.fn(),
            })
        ).rejects.toThrow('Link expirado');
    });
});
