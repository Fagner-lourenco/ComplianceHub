import { describe, expect, it } from 'vitest';
import {
    buildTimeKeys,
    buildUsageMetersForCase,
    buildUsageMeterFromProviderRequest,
    buildUsageMeterFromModuleRun,
    groupMeterIdsByModule,
} from './v2UsageMeters.js';

const BASE = {
    caseId: 'CASE-001',
    tenantId: 'tenant-abc',
    subjectId: 'subj_cpf_abc123',
    productKey: 'kye_employee',
    entitlementId: 'ent-001',
};

describe('v2UsageMeters', () => {
    it('gera chaves temporais para agregacao mensal', () => {
        expect(buildTimeKeys('2026-04-21T12:34:56.000Z')).toEqual({
            meteredAt: '2026-04-21T12:34:56.000Z',
            dayKey: '2026-04-21',
            monthKey: '2026-04',
        });
    });

    it('gera meter por provider request externo comercialmente cobrado', () => {
        const meters = buildUsageMetersForCase({
            ...BASE,
            providerRequests: [
                { id: 'pr-001', provider: 'bigdatacorp', moduleKey: 'identity_pf' },
            ],
        });
        const pr = meters.find((m) => m.providerRequestId === 'pr-001');
        expect(pr).toBeTruthy();
        expect(pr.commercialBillable).toBe(true);
        expect(pr.unit).toBe('provider_api_call');
        expect(pr.id).toBe('meter_pr_pr-001');
        expect(pr.moduleKey).toBe('identity_pf');
        expect(pr.monthKey).toMatch(/^\d{4}-\d{2}$/);
    });

    it('provider fontedata e interno nao e commercialBillable', () => {
        const meters = buildUsageMetersForCase({
            ...BASE,
            providerRequests: [{ id: 'pr-002', provider: 'fontedata', moduleKey: 'criminal' }],
        });
        const pr = meters.find((m) => m.providerRequestId === 'pr-002');
        expect(pr.commercialBillable).toBe(false);
        expect(pr.internalCost).toBe(true);
    });

    it('nao duplica meter ao reprocessar mesmo providerRequest id', () => {
        const sameReq = { id: 'pr-003', provider: 'judit', moduleKey: 'warrants' };
        const meters = buildUsageMetersForCase({
            ...BASE,
            providerRequests: [sameReq, sameReq],
        });
        expect(meters.filter((m) => m.providerRequestId === 'pr-003')).toHaveLength(1);
    });

    it('gera meter de execucao de modulo quando concluido', () => {
        const meters = buildUsageMetersForCase({
            ...BASE,
            meteredAt: '2026-04-21T08:00:00.000Z',
            moduleRuns: [
                { moduleKey: 'criminal', status: 'completed_with_findings', entitled: true },
            ],
        });
        const mr = meters.find((m) => m.unit === 'module_execution' && m.moduleKey === 'criminal');
        expect(mr).toBeTruthy();
        expect(mr.commercialBillable).toBe(true);
        expect(mr.id).toBe('meter_mr_CASE-001_criminal');
        expect(mr.dayKey).toBe('2026-04-21');
        expect(mr.monthKey).toBe('2026-04');
    });

    it('modulo skipped_reuse nao gera cobrança comercial', () => {
        const meters = buildUsageMetersForCase({
            ...BASE,
            moduleRuns: [{ moduleKey: 'labor', status: 'skipped_reuse', entitled: true }],
        });
        const mr = meters.find((m) => m.moduleKey === 'labor');
        expect(mr).toBeTruthy();
        expect(mr.commercialBillable).toBe(false);
        expect(mr.status).toBe('no_charge_reuse');
    });

    it('modulo nao executado nao gera meter de modulo', () => {
        const meters = buildUsageMetersForCase({
            ...BASE,
            moduleRuns: [
                { moduleKey: 'osint', status: 'pending', entitled: true },
                { moduleKey: 'social', status: 'failed_final', entitled: true },
            ],
        });
        expect(meters.filter((m) => m.unit === 'module_execution')).toHaveLength(0);
    });

    it('modulos internos decision e report_secure nao geram meter de modulo', () => {
        const meters = buildUsageMetersForCase({
            ...BASE,
            moduleRuns: [
                { moduleKey: 'decision', status: 'completed_no_findings', entitled: true },
                { moduleKey: 'report_secure', status: 'completed_no_findings', entitled: true },
            ],
        });
        expect(meters.filter((m) => m.unit === 'module_execution')).toHaveLength(0);
    });

    it('retorna lista vazia quando caseId e nulo', () => {
        expect(buildUsageMetersForCase({ caseId: null })).toHaveLength(0);
    });

    it('buildUsageMeterFromProviderRequest retorna null quando sem id', () => {
        expect(buildUsageMeterFromProviderRequest({ providerRequest: {}, caseId: 'X' })).toBeNull();
    });

    it('buildUsageMeterFromModuleRun retorna null para decision', () => {
        expect(buildUsageMeterFromModuleRun({
            moduleRun: { moduleKey: 'decision', status: 'completed_no_findings' },
            caseId: 'X',
        })).toBeNull();
    });

    it('groupMeterIdsByModule agrupa corretamente', () => {
        const meters = [
            { id: 'meter_pr_001', moduleKey: 'criminal' },
            { id: 'meter_mr_CASE_criminal', moduleKey: 'criminal' },
            { id: 'meter_pr_002', moduleKey: 'labor' },
        ];
        const grouped = groupMeterIdsByModule(meters);
        expect(grouped.criminal).toHaveLength(2);
        expect(grouped.labor).toHaveLength(1);
    });
});
