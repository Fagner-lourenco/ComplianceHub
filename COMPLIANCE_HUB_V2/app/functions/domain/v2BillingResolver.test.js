import { describe, it, expect } from 'vitest';
import {
    BILLING_UNITS,
    COMMERCIAL_PRESETS,
    buildBillingEntry,
    summarizeTenantUsage,
    summarizeUsageMeters,
    summarizeBillingOverview,
    resolveCommercialPreset,
} from './v2BillingResolver.js';

describe('v2BillingResolver', () => {
    describe('BILLING_UNITS', () => {
        it('cobre todos os modulos criticos', () => {
            const required = ['identity', 'criminal', 'labor', 'warrant', 'osint', 'sanctions', 'pep'];
            for (const key of required) {
                expect(BILLING_UNITS).toHaveProperty(key);
                expect(typeof BILLING_UNITS[key].internalCostBrl).toBe('number');
                expect(BILLING_UNITS[key].internalCostBrl).toBeGreaterThan(0);
            }
        });

        it('cada unidade tem label comercial', () => {
            for (const [key, unit] of Object.entries(BILLING_UNITS)) {
                expect(unit.commercialUnitLabel, `${key} sem label`).toBeTruthy();
            }
        });
    });

    describe('COMMERCIAL_PRESETS', () => {
        it('define os 4 presets obrigatorios', () => {
            expect(COMMERCIAL_PRESETS).toHaveProperty('start');
            expect(COMMERCIAL_PRESETS).toHaveProperty('professional');
            expect(COMMERCIAL_PRESETS).toHaveProperty('investigative');
            expect(COMMERCIAL_PRESETS).toHaveProperty('premium');
        });

        it('premium inclui mais modulos que start', () => {
            expect(COMMERCIAL_PRESETS.premium.modules.length).toBeGreaterThan(
                COMMERCIAL_PRESETS.start.modules.length
            );
        });

        it('cada preset tem marginMultiplier > 1', () => {
            for (const [key, preset] of Object.entries(COMMERCIAL_PRESETS)) {
                expect(preset.marginMultiplier, `${key} sem margin`).toBeGreaterThan(1);
            }
        });
    });

    describe('buildBillingEntry', () => {
        it('gera entrada com custo correto para moduleKey conhecido', () => {
            const entry = buildBillingEntry('identity', { quantity: 1 });
            expect(entry).not.toBeNull();
            expect(entry.moduleKey).toBe('identity');
            expect(entry.quantity).toBe(1);
            expect(entry.internalCostBrl).toBe(BILLING_UNITS.identity.internalCostBrl);
        });

        it('multiplica custo por quantidade', () => {
            const entry = buildBillingEntry('criminal', { quantity: 3 });
            expect(entry.internalCostBrl).toBeCloseTo(BILLING_UNITS.criminal.internalCostBrl * 3, 4);
            expect(entry.quantity).toBe(3);
        });

        it('retorna null para moduleKey desconhecido', () => {
            expect(buildBillingEntry('unknown_module')).toBeNull();
        });

        it('inclui executedAt quando fornecido', () => {
            const ts = '2026-04-21T00:00:00.000Z';
            const entry = buildBillingEntry('warrant', { executedAt: ts });
            expect(entry.executedAt).toBe(ts);
        });
    });

    describe('summarizeTenantUsage', () => {
        it('agrega entradas por modulo', () => {
            const entries = [
                buildBillingEntry('identity', { quantity: 2 }),
                buildBillingEntry('identity', { quantity: 3 }),
                buildBillingEntry('criminal', { quantity: 1 }),
            ];
            const summary = summarizeTenantUsage(entries);
            expect(summary.totalQuantity).toBe(6);
            const identityModule = summary.byModule.find((m) => m.moduleKey === 'identity');
            expect(identityModule.quantity).toBe(5);
        });

        it('retorna zeros para lista vazia', () => {
            const summary = summarizeTenantUsage([]);
            expect(summary.totalQuantity).toBe(0);
            expect(summary.totalInternalCostBrl).toBe(0);
            expect(summary.byModule).toHaveLength(0);
        });

        it('ignora entradas nulas ou invalidas', () => {
            const entries = [buildBillingEntry('identity', { quantity: 1 }), null, undefined];
            const summary = summarizeTenantUsage(entries);
            expect(summary.totalQuantity).toBe(1);
        });
    });

    describe('summarizeUsageMeters', () => {
        it('agrega usageMeters por modulo e separa billable/internal cost', () => {
            const summary = summarizeUsageMeters([
                {
                    id: 'meter-1',
                    moduleKey: 'identity_pf',
                    unit: 'provider_api_call',
                    quantity: 1,
                    commercialBillable: true,
                    internalCost: true,
                },
                {
                    id: 'meter-2',
                    moduleKey: 'identity_pf',
                    unit: 'module_execution',
                    quantity: 1,
                    commercialBillable: true,
                    internalCost: false,
                },
                {
                    id: 'meter-3',
                    moduleKey: 'labor',
                    unit: 'module_execution',
                    quantity: 1,
                    commercialBillable: false,
                    internalCost: false,
                },
            ]);

            expect(summary.source).toBe('usageMeters');
            expect(summary.totalQuantity).toBe(3);
            expect(summary.commercialBillableQuantity).toBe(2);
            expect(summary.internalCostQuantity).toBe(1);
            expect(summary.totalInternalCostBrl).toBeGreaterThan(0);
            expect(summary.byModule.find((item) => item.moduleKey === 'identity_pf').quantity).toBe(2);
        });
    });

    describe('summarizeBillingOverview', () => {
        it('prefere usageMeters quando existem mesmo com billingEntries presentes', () => {
            const summary = summarizeBillingOverview({
                usageMeters: [
                    { id: 'meter-1', moduleKey: 'criminal', quantity: 1, commercialBillable: true, internalCost: false },
                ],
                billingEntries: [
                    buildBillingEntry('identity', { quantity: 10 }),
                ],
            });

            expect(summary.source).toBe('usageMeters');
            expect(summary.fallbackUsed).toBe(false);
            expect(summary.totalQuantity).toBe(1);
            expect(summary.byModule[0].moduleKey).toBe('criminal');
        });

        it('usa billingEntries como fallback quando nao ha usageMeters', () => {
            const summary = summarizeBillingOverview({
                usageMeters: [],
                billingEntries: [
                    buildBillingEntry('identity', { quantity: 2 }),
                ],
            });

            expect(summary.source).toBe('billingEntries');
            expect(summary.fallbackUsed).toBe(true);
            expect(summary.totalQuantity).toBe(2);
        });
    });

    describe('resolveCommercialPreset', () => {
        it('retorna preset completo com custos por modulo', () => {
            const preset = resolveCommercialPreset('start');
            expect(preset.presetKey).toBe('start');
            expect(preset.modules).toContain('identity');
            expect(preset.moduleCosts).toHaveLength(preset.modules.length);
            expect(preset.totalInternalCostBrl).toBeGreaterThan(0);
            expect(preset.totalCommercialCostBrl).toBeGreaterThan(preset.totalInternalCostBrl);
        });

        it('custo comercial = custo interno * marginMultiplier para cada modulo', () => {
            const preset = resolveCommercialPreset('professional');
            for (const moduleCost of preset.moduleCosts) {
                const expected = parseFloat((moduleCost.internalCostBrl * preset.marginMultiplier).toFixed(4));
                expect(moduleCost.commercialCostBrl).toBeCloseTo(expected, 3);
            }
        });

        it('retorna null para preset desconhecido', () => {
            expect(resolveCommercialPreset('unknown')).toBeNull();
        });

        it('premium tem custo comercial total maior que start', () => {
            const start = resolveCommercialPreset('start');
            const premium = resolveCommercialPreset('premium');
            expect(premium.totalCommercialCostBrl).toBeGreaterThan(start.totalCommercialCostBrl);
        });
    });
});
