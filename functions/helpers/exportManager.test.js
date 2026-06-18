import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const {
    EXPORT_JOB_STATUS,
    EXPORT_FORMATS,
    MAX_PENDING_JOBS_PER_USER,
    validateExportJobPayload,
    sanitizeFilename,
    buildCsvContent,
    escapeCsvField,
    buildExportFilename,
} = require('./exportManager');

describe('exportManager', () => {
    describe('constants', () => {
        it('EXPORT_JOB_STATUS tem os status esperados', () => {
            expect(EXPORT_JOB_STATUS.PENDING).toBe('pending');
            expect(EXPORT_JOB_STATUS.PROCESSING).toBe('processing');
            expect(EXPORT_JOB_STATUS.DONE).toBe('done');
            expect(EXPORT_JOB_STATUS.ERROR).toBe('error');
            expect(EXPORT_JOB_STATUS.CANCELLED).toBe('cancelled');
        });

        it('EXPORT_FORMATS aceita csv, xlsx, pdf', () => {
            expect(EXPORT_FORMATS.has('csv')).toBe(true);
            expect(EXPORT_FORMATS.has('xlsx')).toBe(true);
            expect(EXPORT_FORMATS.has('pdf')).toBe(true);
            expect(EXPORT_FORMATS.has('invalid')).toBe(false);
        });

        it('MAX_PENDING_JOBS_PER_USER é 3', () => {
            expect(MAX_PENDING_JOBS_PER_USER).toBe(3);
        });
    });

    describe('validateExportJobPayload', () => {
        it('aceita formato csv por padrão', () => {
            const result = validateExportJobPayload({});
            expect(result.format).toBe('csv');
        });

        it('aceita formato xlsx', () => {
            const result = validateExportJobPayload({ format: 'xlsx' });
            expect(result.format).toBe('xlsx');
        });

        it('rejeita formato inválido', () => {
            expect(() => validateExportJobPayload({ format: 'txt' }))
                .toThrow('Formato invalido');
        });

        it('rejeita filtros desconhecidos', () => {
            expect(() => validateExportJobPayload({
                filters: { unknownField: 'value' },
            })).toThrow('Filtros desconhecidos');
        });

        it('aceita filtros permitidos', () => {
            const result = validateExportJobPayload({
                filters: { status: 'DONE', dateFrom: '2024-01-01', scopeCode: 'ALL' },
            });
            expect(result.filters).toBeDefined();
        });
    });

    describe('sanitizeFilename', () => {
        it('remove caracteres especiais', () => {
            expect(sanitizeFilename('arquivo@teste!')).toBe('arquivo_teste_');
        });

        it('limita a 100 caracteres', () => {
            const long = 'a'.repeat(200);
            expect(sanitizeFilename(long).length).toBe(100);
        });
    });

    describe('escapeCsvField', () => {
        it('não altera campo simples', () => {
            expect(escapeCsvField('Joao Silva')).toBe('Joao Silva');
        });

        it('escapa ponto-e-vírgula', () => {
            expect(escapeCsvField('Joao;Silva')).toBe('"Joao;Silva"');
        });

        it('escapa aspas', () => {
            expect(escapeCsvField('Joao "J" Silva')).toBe('"Joao ""J"" Silva"');
        });

        it('normaliza quebras de linha', () => {
            expect(escapeCsvField('Joao\nSilva')).toBe('Joao Silva');
        });

        it('previne injection de fórmula', () => {
            expect(escapeCsvField('=SUM(A1)')).toBe("'=SUM(A1)");
        });
    });

    describe('buildCsvContent', () => {
        it('gera CSV com BOM e headers', () => {
            const rows = [{ name: 'Joao', age: 30 }];
            const csv = buildCsvContent(rows, ['name', 'age']);
            expect(csv.startsWith('\uFEFF')).toBe(true);
            expect(csv).toContain('name;age');
            expect(csv).toContain('Joao;30');
        });
    });

    describe('buildExportFilename', () => {
        it('gera path com tenant, timestamp e extensão', () => {
            const date = new Date('2024-01-15T10:30:00.000Z');
            const filename = buildExportFilename('tenant-1', 'csv', date);
            expect(filename).toMatch(/^exports\/tenant-1\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/);
        });
    });
});
