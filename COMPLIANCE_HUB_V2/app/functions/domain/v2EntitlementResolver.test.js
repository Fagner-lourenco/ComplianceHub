import { describe, expect, it } from 'vitest';
import {
    FEATURE_FLAGS,
    V2_ENTITLEMENT_RESOLVER_VERSION,
    getEffectiveTier,
    isTenantFeatureEnabled,
    resolveAllFeatureFlags,
    resolveTenantEntitlements,
} from './v2EntitlementResolver.js';

describe('v2EntitlementResolver - resolveTenantEntitlements', () => {
    it('retorna defaults seguros para documento nulo ou vazio', () => {
        expect(resolveTenantEntitlements(null)).toEqual({
            tier: 'basic',
            entitlementId: null,
            enabledModules: null,
            enabledProducts: null,
            featureOverrides: {},
            billingModel: 'per_case',
            maxCasesPerMonth: null,
            resolverVersion: V2_ENTITLEMENT_RESOLVER_VERSION,
        });

        expect(resolveTenantEntitlements({}).tier).toBe('basic');
    });

    it('normaliza documento tenantEntitlements direto com enabledModules e enabledProducts no topo', () => {
        const resolved = resolveTenantEntitlements({
            tenantId: 'tenant-1',
            tier: 'professional',
            enabledModules: { criminal: true, labor: false },
            enabledProducts: { dossier_pf_full: true },
            featureOverrides: { [FEATURE_FLAGS.WATCHLIST_MONITORING]: true },
            billingModel: 'postpaid',
            maxCasesPerMonth: 100,
            entitlementId: 'ent-tenant-1',
        });

        expect(resolved.tier).toBe('professional');
        expect(resolved.enabledModules).toEqual({ criminal: true, labor: false });
        expect(resolved.enabledProducts).toEqual({ dossier_pf_full: true });
        expect(resolved.featureOverrides[FEATURE_FLAGS.WATCHLIST_MONITORING]).toBe(true);
        expect(resolved.billingModel).toBe('postpaid');
        expect(resolved.maxCasesPerMonth).toBe(100);
        expect(resolved.entitlementId).toBe('ent-tenant-1');
    });

    it('usa fallback legado vindo de tenantSettings aninhado', () => {
        const resolved = resolveTenantEntitlements({
            tenantId: 'tenant-legacy',
            tenantSettings: {
                tier: 'standard',
                analysisConfig: {
                    criminal: { enabled: true },
                    labor: { enabled: false },
                },
            },
        });

        expect(resolved.tier).toBe('standard');
        expect(resolved.enabledModules).toEqual({
            criminal: { enabled: true },
            labor: { enabled: false },
        });
        expect(resolved.entitlementId).toBe('tenantEntitlements/tenant-legacy');
    });

    it('usa fallback legado quando o proprio documento tem shape de tenantSettings', () => {
        const resolved = resolveTenantEntitlements({
            tenantId: 'tenant-settings-direct',
            tier: 'professional',
            analysisConfig: {
                criminal: { enabled: true },
                warrant: { enabled: true },
            },
        });

        expect(resolved.tier).toBe('professional');
        expect(resolved.enabledModules).toEqual({
            criminal: { enabled: true },
            warrant: { enabled: true },
        });
    });

    it('aplica precedencia contract > entitlements > settings para tier', () => {
        expect(resolveTenantEntitlements({
            settings: { tier: 'standard' },
            entitlements: { tier: 'professional' },
            contract: { tier: 'premium' },
        }).tier).toBe('premium');

        expect(resolveTenantEntitlements({
            settings: { tier: 'standard' },
            entitlements: { tier: 'professional' },
        }).tier).toBe('professional');
    });

    it('ignora tier invalido e usa o proximo candidato valido', () => {
        expect(resolveTenantEntitlements({
            contract: { tier: 'enterprise' },
            entitlements: { tier: 'standard' },
        }).tier).toBe('standard');

        expect(resolveTenantEntitlements({ tier: 'unknown' }).tier).toBe('basic');
    });
});

describe('v2EntitlementResolver - getEffectiveTier', () => {
    it.each([
        ['basic', 'basic'],
        ['standard', 'standard'],
        ['professional', 'professional'],
        ['premium', 'premium'],
    ])('retorna tier efetivo %s', (tier, expected) => {
        expect(getEffectiveTier({ tier })).toBe(expected);
    });

    it('retorna basic para entradas parciais ou invalidas', () => {
        expect(getEffectiveTier(null)).toBe('basic');
        expect(getEffectiveTier({ contract: { tier: '' } })).toBe('basic');
    });
});

describe('v2EntitlementResolver - isTenantFeatureEnabled', () => {
    it('habilita features conforme tier minimo', () => {
        expect(isTenantFeatureEnabled({ tier: 'basic' }, FEATURE_FLAGS.CASE_CREATION)).toBe(true);
        expect(isTenantFeatureEnabled({ tier: 'basic' }, FEATURE_FLAGS.EVIDENCE_ITEMS)).toBe(false);
        expect(isTenantFeatureEnabled({ tier: 'standard' }, FEATURE_FLAGS.EVIDENCE_ITEMS)).toBe(true);
        expect(isTenantFeatureEnabled({ tier: 'professional' }, FEATURE_FLAGS.BILLING_DASHBOARD)).toBe(true);
        expect(isTenantFeatureEnabled({ tier: 'professional' }, FEATURE_FLAGS.WATCHLIST_MONITORING)).toBe(false);
        expect(isTenantFeatureEnabled({ tier: 'premium' }, FEATURE_FLAGS.WATCHLIST_MONITORING)).toBe(true);
    });

    it('aceita tanto o nome da constante quanto o valor da flag', () => {
        expect(isTenantFeatureEnabled({ tier: 'basic' }, 'CASE_CREATION')).toBe(true);
        expect(isTenantFeatureEnabled({ tier: 'standard' }, FEATURE_FLAGS.RISK_SIGNALS)).toBe(true);
    });

    it('override true habilita recurso acima do tier', () => {
        const resolved = {
            tier: 'basic',
            featureOverrides: { [FEATURE_FLAGS.WATCHLIST_MONITORING]: true },
        };

        expect(isTenantFeatureEnabled(resolved, FEATURE_FLAGS.WATCHLIST_MONITORING)).toBe(true);
    });

    it('override false desabilita recurso mesmo quando tier permitiria', () => {
        const resolved = {
            tier: 'premium',
            featureOverrides: { [FEATURE_FLAGS.ALERT_SUBSCRIPTIONS]: false },
        };

        expect(isTenantFeatureEnabled(resolved, FEATURE_FLAGS.ALERT_SUBSCRIPTIONS)).toBe(false);
    });

    it('retorna false para flag desconhecida', () => {
        expect(isTenantFeatureEnabled({ tier: 'premium' }, 'unknown_flag')).toBe(false);
        expect(isTenantFeatureEnabled({ tier: 'premium' }, null)).toBe(false);
    });
});

describe('v2EntitlementResolver - resolveAllFeatureFlags', () => {
    it('resolve todas as flags conhecidas com defaults de tier', () => {
        const flags = resolveAllFeatureFlags({ tier: 'standard' });

        expect(Object.keys(flags).sort()).toEqual(Object.values(FEATURE_FLAGS).sort());
        expect(flags[FEATURE_FLAGS.CASE_CREATION]).toBe(true);
        expect(flags[FEATURE_FLAGS.TIMELINE_VIEW]).toBe(true);
        expect(flags[FEATURE_FLAGS.BILLING_DASHBOARD]).toBe(false);
        expect(flags[FEATURE_FLAGS.RELATIONSHIP_GRAPH]).toBe(false);
    });

    it('aplica overrides durante a resolucao completa', () => {
        const flags = resolveAllFeatureFlags({
            tier: 'professional',
            featureOverrides: {
                [FEATURE_FLAGS.BILLING_DASHBOARD]: false,
                [FEATURE_FLAGS.RELATIONSHIP_GRAPH]: true,
            },
        });

        expect(flags[FEATURE_FLAGS.BILLING_DASHBOARD]).toBe(false);
        expect(flags[FEATURE_FLAGS.RELATIONSHIP_GRAPH]).toBe(true);
    });
});
