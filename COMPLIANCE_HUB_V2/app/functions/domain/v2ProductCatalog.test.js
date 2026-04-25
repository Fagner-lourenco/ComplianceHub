import { describe, it, expect } from 'vitest';
import {
    PRODUCT_CATALOG,
    listCatalog,
    getProductMetadata,
    normalizeEnabledProducts,
    tierIndex,
    buildClientProductCatalog,
} from './v2ProductCatalog.js';

describe('v2ProductCatalog — registry', () => {
    it('has all expected product keys', () => {
        const keys = Object.keys(PRODUCT_CATALOG).sort();
        expect(keys).toContain('dossier_pf_basic');
        expect(keys).toContain('dossier_pj');
        expect(keys).toContain('ongoing_monitoring');
        expect(keys).toContain('report_secure');
    });

    it('every product has required metadata fields', () => {
        for (const product of listCatalog()) {
            expect(product.productKey).toBeTruthy();
            expect(product.commercialName).toBeTruthy();
            expect(['pf', 'pj', 'mixed']).toContain(product.subjectType);
            expect(product.shortDescription).toBeTruthy();
            expect(product.minTier).toBeTruthy();
        }
    });

    it('getProductMetadata returns null for unknown key', () => {
        expect(getProductMetadata('unknown_product')).toBeNull();
    });
});

describe('v2ProductCatalog — helpers', () => {
    it('normalizeEnabledProducts handles arrays', () => {
        expect([...normalizeEnabledProducts(['dossier_pf_basic', 'dossier_pj'])]).toEqual(
            ['dossier_pf_basic', 'dossier_pj'],
        );
    });

    it('normalizeEnabledProducts handles object maps with booleans', () => {
        const set = normalizeEnabledProducts({ dossier_pf_basic: true, dossier_pj: false, kye_employee: true });
        expect(set.has('dossier_pf_basic')).toBe(true);
        expect(set.has('kye_employee')).toBe(true);
        expect(set.has('dossier_pj')).toBe(false);
    });

    it('normalizeEnabledProducts returns empty set for null/undefined', () => {
        expect(normalizeEnabledProducts(null).size).toBe(0);
        expect(normalizeEnabledProducts(undefined).size).toBe(0);
    });

    it('tierIndex respects canonical order basic < standard < professional < premium', () => {
        expect(tierIndex('basic')).toBeLessThan(tierIndex('standard'));
        expect(tierIndex('standard')).toBeLessThan(tierIndex('professional'));
        expect(tierIndex('professional')).toBeLessThan(tierIndex('premium'));
        expect(tierIndex('unknown')).toBe(0);
    });
});

describe('v2ProductCatalog — buildClientProductCatalog', () => {
    it('splits products into contracted/available/upsell by tier', () => {
        const result = buildClientProductCatalog({
            entitlements: {
                tier: 'professional',
                enabledProducts: ['dossier_pf_basic', 'dossier_pj'],
            },
            fallbackUsed: false,
        });

        const contractedKeys = result.contracted.map((p) => p.productKey);
        expect(contractedKeys).toContain('dossier_pf_basic');
        expect(contractedKeys).toContain('dossier_pj');

        // Professional tier has access to basic + standard + professional products as "available"
        const availableKeys = result.available.map((p) => p.productKey);
        expect(availableKeys).toContain('kye_employee'); // basic tier, not in enabledProducts
        expect(availableKeys).toContain('dossier_pf_full'); // professional tier

        // Premium-only products must be upsell for a professional tenant
        const upsellKeys = result.upsell.map((p) => p.productKey);
        expect(upsellKeys).toContain('ongoing_monitoring');
        expect(upsellKeys).toContain('tpr_third_party');
        expect(upsellKeys).toContain('reputational_risk');
    });

    it('on fallback (no entitlements doc) everything non-contracted becomes upsell', () => {
        const result = buildClientProductCatalog({
            entitlements: null,
            fallbackUsed: true,
        });
        expect(result.contracted).toEqual([]);
        expect(result.available).toEqual([]);
        expect(result.upsell.length).toBe(Object.keys(PRODUCT_CATALOG).length);
        expect(result.fallbackUsed).toBe(true);
    });

    it('supports object-map enabledProducts (V1 legacy format)', () => {
        const result = buildClientProductCatalog({
            entitlements: {
                tier: 'basic',
                enabledProducts: { dossier_pf_basic: true, report_secure: true },
            },
            fallbackUsed: false,
        });

        const contractedKeys = result.contracted.map((p) => p.productKey);
        expect(contractedKeys).toContain('dossier_pf_basic');
        expect(contractedKeys).toContain('report_secure');
    });

    it('basic tier tenant sees only basic products as available', () => {
        const result = buildClientProductCatalog({
            entitlements: {
                tier: 'basic',
                enabledProducts: [],
            },
            fallbackUsed: false,
        });

        const availableKeys = result.available.map((p) => p.productKey);
        const upsellKeys = result.upsell.map((p) => p.productKey);

        expect(availableKeys).toContain('dossier_pf_basic');
        expect(availableKeys).toContain('kye_employee');
        expect(upsellKeys).toContain('dossier_pj'); // professional
        expect(upsellKeys).toContain('ongoing_monitoring'); // premium
    });
});
