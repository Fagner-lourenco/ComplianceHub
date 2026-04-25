import { describe, expect, it } from 'vitest';
import {
    MODULE_RUN_STATUSES,
    buildModuleRunsForCase,
    getModuleContract,
    normalizeModuleKey,
    resolveCaseEntitlements,
    summarizeModuleRuns,
    inferRequestedModuleKeys,
    getProductContract,
} from './v2Modules.js';

describe('v2Modules registry and entitlements', () => {
    it('normaliza aliases legados para moduleKeys oficiais', () => {
        expect(normalizeModuleKey('warrant')).toBe('warrants');
        expect(normalizeModuleKey('processos')).toBe('judicial');
        expect(normalizeModuleKey('basicData')).toBe('identity_pf');
        expect(getModuleContract('warrant')?.moduleKey).toBe('warrants');
    });

    it('getModuleContract retorna null para modulo inexistente', () => {
        expect(getModuleContract('modulo_inexistente')).toBeNull();
    });

    it('usa tenantEntitlements como fonte efetiva quando existe enabledModules', () => {
        const resolution = resolveCaseEntitlements({
            caseData: {
                tenantId: 'tenant-1',
                productKey: 'dossier_pf_basic',
                requestedModuleKeys: ['criminal', 'labor', 'warrant'],
            },
            tenantEntitlements: {
                tenantId: 'tenant-1',
                contractId: 'contract-1',
                enabledProducts: { dossier_pf_basic: true },
                enabledModules: {
                    criminal: true,
                    labor: false,
                    warrants: true,
                },
            },
        });

        expect(resolution.requestedModuleKeys).toEqual(['criminal', 'labor', 'warrants']);
        expect(resolution.effectiveModuleKeys).toContain('criminal');
        expect(resolution.effectiveModuleKeys).toContain('warrants');
        expect(resolution.effectiveModuleKeys).toContain('identity_pf');
        expect(resolution.effectiveModuleKeys).not.toContain('labor');
        expect(resolution.moduleDecisions.labor.reasonCode).toBe('module_not_entitled');
    });

    it('isola fallback legado em tenantSettings quando nao ha tenantEntitlements V2', () => {
        const resolution = resolveCaseEntitlements({
            caseData: {
                tenantId: 'tenant-1',
                enabledPhases: ['criminal', 'labor', 'warrant'],
            },
            tenantSettings: {
                analysisConfig: {
                    criminal: { enabled: true },
                    labor: { enabled: false },
                    warrant: { enabled: true },
                },
            },
        });

        expect(resolution.effectiveModuleKeys).toContain('criminal');
        expect(resolution.effectiveModuleKeys).toContain('warrants');
        expect(resolution.effectiveModuleKeys).not.toContain('labor');
        expect(resolution.moduleDecisions.criminal.reasonCode).toBe('legacy_tenant_settings_fallback');
    });

    it('resolveCaseEntitlements inclui modulos obrigatorios mesmo nao solicitados', () => {
        const resolution = resolveCaseEntitlements({
            caseData: {
                tenantId: 'tenant-1',
                productKey: 'dossier_pf_basic',
                requestedModuleKeys: ['criminal'],
            },
            tenantEntitlements: {
                tenantId: 'tenant-1',
                enabledProducts: { dossier_pf_basic: true },
                enabledModules: { criminal: true },
            },
        });
        expect(resolution.effectiveModuleKeys).toContain('identity_pf');
    });

    it('cria moduleRuns minimos com bloqueio para modulo solicitado sem entitlement', () => {
        const moduleRuns = buildModuleRunsForCase({
            caseId: 'case-1',
            caseData: {
                tenantId: 'tenant-1',
                productKey: 'dossier_pf_basic',
                requestedModuleKeys: ['criminal', 'labor'],
                status: 'PENDING',
            },
            tenantEntitlements: {
                tenantId: 'tenant-1',
                enabledProducts: { dossier_pf_basic: true },
                enabledModules: { criminal: true, labor: false },
            },
        });
        const laborRun = moduleRuns.find((run) => run.moduleKey === 'labor');
        const summary = summarizeModuleRuns(moduleRuns);

        expect(laborRun.status).toBe(MODULE_RUN_STATUSES.NOT_ENTITLED);
        expect(laborRun.requested).toBe(true);
        expect(laborRun.effective).toBe(false);
        expect(laborRun.blocksDecision).toBe(true);
        expect(summary.blockedModuleKeys).toContain('labor');
    });

    it('deriva executedModuleKeys a partir de statuses de moduleRuns', () => {
        const moduleRuns = buildModuleRunsForCase({
            caseId: 'case-1',
            caseData: {
                tenantId: 'tenant-1',
                productKey: 'dossier_pf_basic',
                requestedModuleKeys: ['criminal', 'warrants'],
                status: 'DONE',
                criminalFlag: 'NEGATIVE',
                warrantFlag: 'POSITIVE',
                juditRequestIds: { warrant: 'judit-warrant-1' },
            },
            tenantEntitlements: {
                tenantId: 'tenant-1',
                enabledProducts: { dossier_pf_basic: true },
                enabledModules: { criminal: true, warrants: true },
            },
        });
        const summary = summarizeModuleRuns(moduleRuns);
        const warrantsRun = moduleRuns.find((run) => run.moduleKey === 'warrants');

        expect(summary.executedModuleKeys).toContain('criminal');
        expect(summary.executedModuleKeys).toContain('warrants');
        expect(warrantsRun.status).toBe(MODULE_RUN_STATUSES.COMPLETED_WITH_FINDINGS);
        expect(warrantsRun.providerRequestIds).toContain('judit-warrant-1');
    });

    it('summarizeModuleRuns conta modulos corretamente', () => {
        const moduleRuns = buildModuleRunsForCase({
            caseId: 'case-1',
            caseData: {
                tenantId: 'tenant-1',
                productKey: 'dossier_pf_basic',
                requestedModuleKeys: ['criminal', 'warrants', 'labor'],
                status: 'DONE',
                criminalFlag: 'NEGATIVE',
                warrantFlag: 'POSITIVE',
                laborFlag: 'NEGATIVE',
            },
            tenantEntitlements: {
                tenantId: 'tenant-1',
                enabledProducts: { dossier_pf_basic: true },
                enabledModules: { criminal: true, warrants: true, labor: true },
            },
        });
        const summary = summarizeModuleRuns(moduleRuns);
        expect(summary.total).toBeGreaterThanOrEqual(3);
        expect(summary.executedCount).toBeGreaterThanOrEqual(3);
    });

    it('inferRequestedModuleKeys retorna modulos unicos', () => {
        const modules = inferRequestedModuleKeys({
            requestedModuleKeys: ['identity_pf', 'identity_pf', 'criminal'],
        });
        expect(modules).toEqual(['identity_pf', 'criminal']);
    });

    it('getProductContract retorna contrato para produto existente', () => {
        const contract = getProductContract('dossier_pf_basic');
        expect(contract).toBeDefined();
        expect(contract.requiredModules).toBeDefined();
    });

    it('getProductContract retorna fallback dossier_pf_basic para produto inexistente', () => {
        const contract = getProductContract('produto_inexistente');
        expect(contract).toBeDefined();
        expect(contract.productKey).toBe('dossier_pf_basic');
    });
});
