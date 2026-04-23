import { describe, expect, it } from 'vitest';
import {
    V2_TENANT_ENTITLEMENTS_VERSION,
    buildTenantEntitlementAuditDiff,
    sanitizeTenantEntitlementPayload,
} from './v2TenantEntitlements.cjs';

describe('v2TenantEntitlements', () => {
    it('exporta versao do contrato', () => {
        expect(V2_TENANT_ENTITLEMENTS_VERSION).toContain('v2-tenant-entitlements');
    });

    it('sanitiza apenas campos contratuais de tenantEntitlements', () => {
        const payload = sanitizeTenantEntitlementPayload({
            contractId: ' contract-1 ',
            presetKey: 'professional',
            tier: 'Premium',
            enabledProducts: { dossier_pf_full: true },
            enabledModules: { criminal: true, labor: false },
            enabledCapabilities: { report_public_link: true },
            featureOverrides: { relationship_graph: false },
            policyOverrides: { seniorApproval: 'high_risk' },
            billingOverrides: { billableModules: { criminal: true } },
            reportOverrides: { sections: { timeline: true } },
            billingModel: 'postpaid',
            maxCasesPerMonth: '120',
            effectiveFrom: '2026-04-01',
            effectiveTo: '2027-04-01',
            status: 'ACTIVE',
            analysisConfig: { criminal: { enabled: false } },
            enrichmentConfig: { provider: 'legacy' },
            dailyLimit: 3,
        });

        expect(payload).toEqual({
            contractId: 'contract-1',
            presetKey: 'professional',
            tier: 'premium',
            enabledProducts: { dossier_pf_full: true },
            enabledModules: { criminal: true, labor: false },
            enabledCapabilities: { report_public_link: true },
            featureOverrides: { relationship_graph: false },
            policyOverrides: { seniorApproval: 'high_risk' },
            billingOverrides: { billableModules: { criminal: true } },
            reportOverrides: { sections: { timeline: true } },
            billingModel: 'postpaid',
            maxCasesPerMonth: 120,
            effectiveFrom: '2026-04-01',
            effectiveTo: '2027-04-01',
            status: 'active',
        });
    });

    it('ignora tier/status invalidos e entradas nao objeto', () => {
        expect(sanitizeTenantEntitlementPayload(null)).toEqual({});
        expect(sanitizeTenantEntitlementPayload({
            tier: 'enterprise',
            status: 'deleted',
            enabledModules: ['criminal'],
        })).toEqual({});
    });

    it('monta diff before/after apenas para campos alterados', () => {
        const diff = buildTenantEntitlementAuditDiff(
            {
                tier: 'standard',
                enabledModules: { criminal: true, labor: false },
                billingModel: 'per_case',
            },
            {
                tier: 'professional',
                enabledModules: { criminal: true, labor: false },
                billingModel: 'postpaid',
            },
        );

        expect(diff.changedFields).toEqual(['tier', 'billingModel']);
        expect(diff.before).toEqual({
            tier: 'standard',
            billingModel: 'per_case',
        });
        expect(diff.after).toEqual({
            tier: 'professional',
            billingModel: 'postpaid',
        });
    });
});
