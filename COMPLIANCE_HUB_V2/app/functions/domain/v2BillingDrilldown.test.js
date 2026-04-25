import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
    buildBillingDrilldown,
    buildBillingDrilldownExport,
} = require('./v2BillingDrilldown.js');

const meters = [
    {
        id: 'meter-1',
        tenantId: 'tenant-1',
        monthKey: '2026-04',
        caseId: 'case-1',
        subjectId: 'subj-1',
        productKey: 'dossier_pf',
        moduleKey: 'criminal',
        unit: 'module_execution',
        quantity: 1,
        commercialBillable: true,
        internalCost: false,
        meteredAt: '2026-04-22T10:00:00.000Z',
        status: 'recorded',
    },
    {
        id: 'meter-2',
        tenantId: 'tenant-1',
        monthKey: '2026-04',
        caseId: 'case-1',
        subjectId: 'subj-1',
        productKey: 'dossier_pf',
        moduleKey: 'criminal',
        providerRequestId: 'pr-1',
        provider: 'bigdatacorp',
        unit: 'provider_api_call',
        quantity: 1,
        commercialBillable: true,
        internalCost: true,
        meteredAt: '2026-04-22T10:01:00.000Z',
        status: 'recorded',
    },
    {
        id: 'meter-3',
        tenantId: 'tenant-1',
        monthKey: '2026-04',
        caseId: 'case-2',
        subjectId: 'subj-2',
        productKey: 'dossier_pj',
        moduleKey: 'identity_pj',
        unit: 'module_execution',
        quantity: 1,
        commercialBillable: true,
        internalCost: false,
        meteredAt: '2026-04-22T11:00:00.000Z',
        status: 'recorded',
    },
];

describe('v2BillingDrilldown', () => {
    it('agrega usageMeters por modulo, produto, caso e providerRequest', () => {
        const drilldown = buildBillingDrilldown({ usageMeters: meters, includeInternalCost: true });

        expect(drilldown.source).toBe('usageMeters');
        expect(drilldown.totals).toMatchObject({
            meters: 3,
            totalQuantity: 3,
            commercialBillableQuantity: 3,
        });
        expect(drilldown.byModule.find((item) => item.key === 'criminal')).toMatchObject({
            quantity: 2,
            meters: 2,
        });
        expect(drilldown.byProduct.find((item) => item.key === 'dossier_pf')).toMatchObject({
            quantity: 2,
        });
        expect(drilldown.byCase.find((item) => item.key === 'case-1')).toMatchObject({
            quantity: 2,
        });
        expect(drilldown.byProviderRequest.find((item) => item.key === 'pr-1')).toMatchObject({
            quantity: 1,
        });
        expect(drilldown.items[1]).toHaveProperty('internalCostBrl');
    });

    it('oculta custo interno quando perfil nao tem permissao', () => {
        const drilldown = buildBillingDrilldown({ usageMeters: meters, includeInternalCost: false });

        expect(drilldown.internalCostVisible).toBe(false);
        expect(drilldown.totals).not.toHaveProperty('totalInternalCostBrl');
        expect(drilldown.items[1]).not.toHaveProperty('internalCostBrl');
    });

    it('exporta CSV e JSON a partir do drilldown', () => {
        const drilldown = buildBillingDrilldown({ usageMeters: meters, includeInternalCost: true });
        const csv = buildBillingDrilldownExport({ drilldown, format: 'csv' });
        const json = buildBillingDrilldownExport({ drilldown, format: 'json' });

        expect(csv.mimeType).toBe('text/csv');
        expect(csv.content).toContain('providerRequestId');
        expect(csv.content).toContain('pr-1');
        expect(json.mimeType).toBe('application/json');
        expect(JSON.parse(json.content).items).toHaveLength(3);
    });
});
