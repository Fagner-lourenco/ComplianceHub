/**
 * exportJobsExportsContract.test.js — Teste de contrato: verifica que os callables
 * de exportação assíncrona estão registrados em functions/index.js.
 *
 * Executar: node node_modules/vitest/vitest.mjs run exportJobsExportsContract.test.js
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const index = require('./index.js');

describe('Contrato de exports de exportação assíncrona (Phase B)', () => {
    it('createExportJob está exportado', () => {
        expect(typeof index.createExportJob).toBe('function');
    });
    it('getExportJobStatus está exportado', () => {
        expect(typeof index.getExportJobStatus).toBe('function');
    });
    it('listExportJobs está exportado', () => {
        expect(typeof index.listExportJobs).toBe('function');
    });
    it('cancelExportJob está exportado', () => {
        expect(typeof index.cancelExportJob).toBe('function');
    });
    it('processExportJob está exportado', () => {
        expect(typeof index.processExportJob).toBe('function');
    });
});

describe('Contrato de exports legados (V1/V2) — permanecem intactos', () => {
    it('getClientExportCases (legado) permanece', () => {
        expect(typeof index.getClientExportCases).toBe('function');
    });
    it('registerClientExport permanece', () => {
        expect(typeof index.registerClientExport).toBe('function');
    });
    it('listClientCases permanece', () => {
        expect(typeof index.listClientCases).toBe('function');
    });
    it('listOpsCases permanece', () => {
        expect(typeof index.listOpsCases).toBe('function');
    });
    it('listClientCasesV2 permanece', () => {
        expect(typeof index.listClientCasesV2).toBe('function');
    });
    it('listOpsCasesV2 permanece', () => {
        expect(typeof index.listOpsCasesV2).toBe('function');
    });
});
