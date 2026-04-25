import { describe, expect, it } from 'vitest';
import {
    OPS_ROLES,
    PERMISSIONS,
    ROLES,
    hasPermission,
    isClientRole,
    isOpsRole,
} from './v2Rbac.js';

describe('v2Rbac backend catalog', () => {
    it('inclui senior_analyst como role operacional', () => {
        expect(OPS_ROLES).toContain(ROLES.SENIOR_ANALYST);
        expect(isOpsRole(ROLES.SENIOR_ANALYST)).toBe(true);
        expect(isClientRole(ROLES.SENIOR_ANALYST)).toBe(false);
    });

    it('analyst aprova decisao operacional, mas nao publica manualmente, reabre caso, le raw ou ve custo interno', () => {
        expect(hasPermission(ROLES.ANALYST, PERMISSIONS.CASE_WRITE)).toBe(true);
        expect(hasPermission(ROLES.ANALYST, PERMISSIONS.DECISION_APPROVE)).toBe(true);
        expect(hasPermission(ROLES.ANALYST, PERMISSIONS.PROVIDER_DIVERGENCE_RESOLVE)).toBe(true);
        expect(hasPermission(ROLES.ANALYST, PERMISSIONS.REPORT_PUBLISH)).toBe(false);
        expect(hasPermission(ROLES.ANALYST, PERMISSIONS.REPORT_REVOKE)).toBe(false);
        expect(hasPermission(ROLES.ANALYST, PERMISSIONS.CASE_REOPEN)).toBe(false);
        expect(hasPermission(ROLES.ANALYST, PERMISSIONS.EVIDENCE_RAW_READ)).toBe(false);
        expect(hasPermission(ROLES.ANALYST, PERMISSIONS.BILLING_VIEW_INTERNAL_COST)).toBe(false);
    });

    it('senior_analyst aprova, publica, revoga, reabre e le raw sem gerir entitlements/custo', () => {
        expect(hasPermission(ROLES.SENIOR_ANALYST, PERMISSIONS.DECISION_APPROVE)).toBe(true);
        expect(hasPermission(ROLES.SENIOR_ANALYST, PERMISSIONS.REPORT_PUBLISH)).toBe(true);
        expect(hasPermission(ROLES.SENIOR_ANALYST, PERMISSIONS.REPORT_REVOKE)).toBe(true);
        expect(hasPermission(ROLES.SENIOR_ANALYST, PERMISSIONS.CASE_REOPEN)).toBe(true);
        expect(hasPermission(ROLES.SENIOR_ANALYST, PERMISSIONS.EVIDENCE_RAW_READ)).toBe(true);
        expect(hasPermission(ROLES.SENIOR_ANALYST, PERMISSIONS.PROVIDER_DIVERGENCE_RESOLVE)).toBe(true);
        expect(hasPermission(ROLES.SENIOR_ANALYST, PERMISSIONS.ENTITLEMENT_MANAGE)).toBe(false);
        expect(hasPermission(ROLES.SENIOR_ANALYST, PERMISSIONS.BILLING_VIEW_INTERNAL_COST)).toBe(false);
    });

    it('supervisor ve custo interno mas nao gerencia entitlement', () => {
        expect(hasPermission(ROLES.SUPERVISOR, PERMISSIONS.BILLING_VIEW_INTERNAL_COST)).toBe(true);
        expect(hasPermission(ROLES.SUPERVISOR, PERMISSIONS.ENTITLEMENT_MANAGE)).toBe(false);
    });

    it('admin tem todas as permissoes e entradas desconhecidas sao negadas', () => {
        for (const permission of Object.values(PERMISSIONS)) {
            expect(hasPermission(ROLES.ADMIN, permission)).toBe(true);
        }
        expect(hasPermission('unknown', PERMISSIONS.CASE_READ)).toBe(false);
        expect(hasPermission(ROLES.ADMIN, 'unknown.permission')).toBe(false);
    });
});
