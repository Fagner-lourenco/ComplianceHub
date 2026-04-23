import { describe, it, expect } from 'vitest';
import {
    PRODUCT_LABELS,
    MODULE_LABELS,
    CAPABILITY_LABELS,
    getProductLabel,
    getModuleLabel,
    getCapabilityLabel,
    listContractProducts,
    listContractModules,
    listContractCapabilities,
} from './productLabels';

describe('productLabels', () => {
    it('covers all known vendable products', () => {
        const keys = Object.keys(PRODUCT_LABELS);
        expect(keys).toEqual(expect.arrayContaining([
            'dossier_pf_basic',
            'dossier_pf_full',
            'dossier_pj',
            'report_secure',
            'ongoing_monitoring',
        ]));
    });

    it('covers v2 module registry core keys', () => {
        const keys = Object.keys(MODULE_LABELS);
        expect(keys).toEqual(expect.arrayContaining([
            'identity_pf',
            'identity_pj',
            'criminal',
            'labor',
            'warrants',
            'judicial',
        ]));
    });

    it('getProductLabel returns commercial label or falls back to raw key', () => {
        expect(getProductLabel('dossier_pf_full')).toBe('Dossie PF Completo');
        expect(getProductLabel('unknown_product')).toBe('unknown_product');
        expect(getProductLabel(null)).toBe('');
    });

    it('getModuleLabel returns label or raw key', () => {
        expect(getModuleLabel('criminal')).toBe('Criminal');
        expect(getModuleLabel('unknown')).toBe('unknown');
    });

    it('getCapabilityLabel returns label or raw key', () => {
        expect(getCapabilityLabel('senior_review')).toBe('Revisao senior');
        expect(getCapabilityLabel('unknown_cap')).toBe('unknown_cap');
    });

    it('list helpers return {key,label} pairs', () => {
        expect(listContractProducts().length).toBe(Object.keys(PRODUCT_LABELS).length);
        expect(listContractProducts()[0]).toHaveProperty('key');
        expect(listContractProducts()[0]).toHaveProperty('label');
        expect(listContractModules().length).toBeGreaterThan(0);
        expect(listContractCapabilities().length).toBeGreaterThan(0);
    });

    it('has no duplicate label values across products', () => {
        const labels = Object.values(PRODUCT_LABELS);
        expect(new Set(labels).size).toBe(labels.length);
    });
});
