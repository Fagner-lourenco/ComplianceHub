import { describe, it, expect } from 'vitest';
import {
    PRODUCT_PIPELINES,
    getPipelineConfig,
    getPipelineConfigStrict,
    isValidProductKey,
    listPipelines,
    getFamilyColor,
    getFamilyLabel,
} from './productPipelines';

describe('productPipelines', () => {
    it('getPipelineConfig retorna config para produto existente', () => {
        const config = getPipelineConfig('dossier_pf_basic');
        expect(config).toBeDefined();
        expect(config.productKey).toBe('dossier_pf_basic');
    });

    it('getPipelineConfig retorna fallback para produto inexistente', () => {
        const config = getPipelineConfig('inexistente');
        expect(config.productKey).toBe('dossier_pf_basic');
    });

    it('getPipelineConfigStrict lanca erro para produto inexistente', () => {
        expect(() => getPipelineConfigStrict('inexistente')).toThrow('Produto desconhecido');
    });

    it('isValidProductKey retorna true para chave valida', () => {
        expect(isValidProductKey('dossier_pf_basic')).toBe(true);
    });

    it('isValidProductKey retorna false para chave invalida', () => {
        expect(isValidProductKey('inexistente')).toBe(false);
    });

    it('listPipelines retorna array nao vazio', () => {
        const pipelines = listPipelines();
        expect(pipelines.length).toBeGreaterThan(0);
    });

    it('getFamilyColor retorna cor para familia conhecida', () => {
        expect(getFamilyColor('dossie')).toBe('#2563eb');
        expect(getFamilyColor('compliance')).toBe('#059669');
    });

    it('getFamilyColor retorna cor default para familia desconhecida', () => {
        expect(getFamilyColor('unknown')).toBe('#6b7280');
    });

    it('getFamilyLabel retorna label para familia conhecida', () => {
        expect(getFamilyLabel('dossie')).toBe('Dossiê');
        expect(getFamilyLabel('compliance')).toBe('Compliance');
    });

    it('getFamilyLabel retorna propria string para familia desconhecida', () => {
        expect(getFamilyLabel('unknown')).toBe('unknown');
    });

    it('PRODUCT_PIPELINES contem todos os produtos esperados', () => {
        const keys = Object.keys(PRODUCT_PIPELINES);
        expect(keys).toContain('dossier_pf_basic');
        expect(keys).toContain('dossier_pf_full');
        expect(keys).toContain('dossier_pj');
        expect(keys).toContain('kyc_individual');
        expect(keys).toContain('kyb_business');
        expect(keys).toContain('report_secure');
    });
});
