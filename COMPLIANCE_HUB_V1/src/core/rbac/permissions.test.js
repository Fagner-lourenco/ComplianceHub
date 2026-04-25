import { describe, it, expect } from 'vitest';
import {
    ROLES,
    PERMISSIONS,
    CLIENT_ROLES,
    OPS_ROLES,
    hasPermission,
    getPortal,
    isClientRole,
    isOpsRole,
    formatRoleLabel,
} from './permissions';

describe('permissions — RBAC', () => {
    describe('hasPermission', () => {
        it('admin tem TODAS as permissoes', () => {
            for (const perm of Object.values(PERMISSIONS)) {
                expect(hasPermission(ROLES.ADMIN, perm)).toBe(true);
            }
        });

        it('analyst pode ler, escrever, exportar e ver auditoria — nao gerencia usuarios/settings', () => {
            expect(hasPermission(ROLES.ANALYST, PERMISSIONS.CASE_READ)).toBe(true);
            expect(hasPermission(ROLES.ANALYST, PERMISSIONS.CASE_WRITE)).toBe(true);
            expect(hasPermission(ROLES.ANALYST, PERMISSIONS.CASE_EXPORT)).toBe(true);
            expect(hasPermission(ROLES.ANALYST, PERMISSIONS.AUDIT_VIEW)).toBe(true);
            expect(hasPermission(ROLES.ANALYST, PERMISSIONS.USERS_MANAGE)).toBe(false);
            expect(hasPermission(ROLES.ANALYST, PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
            expect(hasPermission(ROLES.ANALYST, PERMISSIONS.CASE_CREATE_REQUEST)).toBe(false);
        });

        it('supervisor pode gerenciar usuarios mas nao settings', () => {
            expect(hasPermission(ROLES.SUPERVISOR, PERMISSIONS.USERS_MANAGE)).toBe(true);
            expect(hasPermission(ROLES.SUPERVISOR, PERMISSIONS.CASE_READ)).toBe(true);
            expect(hasPermission(ROLES.SUPERVISOR, PERMISSIONS.CASE_WRITE)).toBe(true);
            expect(hasPermission(ROLES.SUPERVISOR, PERMISSIONS.AUDIT_VIEW)).toBe(true);
            expect(hasPermission(ROLES.SUPERVISOR, PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
            expect(hasPermission(ROLES.SUPERVISOR, PERMISSIONS.TENANT_AUDIT_VIEW)).toBe(false);
        });

        it('client_manager pode criar solicitacoes, gerenciar usuarios, settings e ver audit tenant', () => {
            expect(hasPermission(ROLES.CLIENT_MANAGER, PERMISSIONS.CASE_READ)).toBe(true);
            expect(hasPermission(ROLES.CLIENT_MANAGER, PERMISSIONS.CASE_CREATE_REQUEST)).toBe(true);
            expect(hasPermission(ROLES.CLIENT_MANAGER, PERMISSIONS.CASE_EXPORT)).toBe(true);
            expect(hasPermission(ROLES.CLIENT_MANAGER, PERMISSIONS.USERS_MANAGE)).toBe(true);
            expect(hasPermission(ROLES.CLIENT_MANAGER, PERMISSIONS.SETTINGS_MANAGE)).toBe(true);
            expect(hasPermission(ROLES.CLIENT_MANAGER, PERMISSIONS.TENANT_AUDIT_VIEW)).toBe(true);
            // nao pode escrever casos nem ver auditoria ops
            expect(hasPermission(ROLES.CLIENT_MANAGER, PERMISSIONS.CASE_WRITE)).toBe(false);
            expect(hasPermission(ROLES.CLIENT_MANAGER, PERMISSIONS.AUDIT_VIEW)).toBe(false);
        });

        it('client_operator pode ler, criar solicitacoes e exportar — nao gerencia', () => {
            expect(hasPermission(ROLES.CLIENT_OPERATOR, PERMISSIONS.CASE_READ)).toBe(true);
            expect(hasPermission(ROLES.CLIENT_OPERATOR, PERMISSIONS.CASE_CREATE_REQUEST)).toBe(true);
            expect(hasPermission(ROLES.CLIENT_OPERATOR, PERMISSIONS.CASE_EXPORT)).toBe(true);
            expect(hasPermission(ROLES.CLIENT_OPERATOR, PERMISSIONS.USERS_MANAGE)).toBe(false);
            expect(hasPermission(ROLES.CLIENT_OPERATOR, PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
        });

        it('client_viewer so pode ler e exportar', () => {
            expect(hasPermission(ROLES.CLIENT_VIEWER, PERMISSIONS.CASE_READ)).toBe(true);
            expect(hasPermission(ROLES.CLIENT_VIEWER, PERMISSIONS.CASE_EXPORT)).toBe(true);
            expect(hasPermission(ROLES.CLIENT_VIEWER, PERMISSIONS.CASE_CREATE_REQUEST)).toBe(false);
            expect(hasPermission(ROLES.CLIENT_VIEWER, PERMISSIONS.USERS_MANAGE)).toBe(false);
        });

        it('LEGACY_CLIENT tem mesmas permissoes de client_operator (ler, criar, exportar)', () => {
            expect(hasPermission(ROLES.LEGACY_CLIENT, PERMISSIONS.CASE_READ)).toBe(true);
            expect(hasPermission(ROLES.LEGACY_CLIENT, PERMISSIONS.CASE_CREATE_REQUEST)).toBe(true);
            expect(hasPermission(ROLES.LEGACY_CLIENT, PERMISSIONS.CASE_EXPORT)).toBe(true);
            expect(hasPermission(ROLES.LEGACY_CLIENT, PERMISSIONS.USERS_MANAGE)).toBe(false);
        });

        it('retorna false para role nulo, undefined ou desconhecido', () => {
            expect(hasPermission(null, PERMISSIONS.CASE_READ)).toBe(false);
            expect(hasPermission(undefined, PERMISSIONS.CASE_READ)).toBe(false);
            expect(hasPermission('hacker', PERMISSIONS.CASE_READ)).toBe(false);
            expect(hasPermission('', PERMISSIONS.CASE_READ)).toBe(false);
        });

        it('retorna false para permissao inexistente mesmo com admin', () => {
            expect(hasPermission(ROLES.ADMIN, 'nonexistent.permission')).toBe(false);
        });
    });

    describe('getPortal', () => {
        it('todos os CLIENT_ROLES mapeiam para portal client', () => {
            for (const role of CLIENT_ROLES) {
                expect(getPortal(role)).toBe('client');
            }
        });

        it('todos os OPS_ROLES mapeiam para portal ops', () => {
            for (const role of OPS_ROLES) {
                expect(getPortal(role)).toBe('ops');
            }
        });

        it('retorna null para role desconhecido ou nulo', () => {
            expect(getPortal('unknown')).toBeNull();
            expect(getPortal(null)).toBeNull();
            expect(getPortal(undefined)).toBeNull();
        });
    });

    describe('isClientRole / isOpsRole', () => {
        it('identifica corretamente cada CLIENT_ROLE (incluindo LEGACY_CLIENT)', () => {
            for (const role of CLIENT_ROLES) {
                expect(isClientRole(role)).toBe(true);
                expect(isOpsRole(role)).toBe(false);
            }
        });

        it('identifica corretamente cada OPS_ROLE', () => {
            for (const role of OPS_ROLES) {
                expect(isOpsRole(role)).toBe(true);
                expect(isClientRole(role)).toBe(false);
            }
        });

        it('retorna false para roles invalidos', () => {
            expect(isClientRole('hacker')).toBe(false);
            expect(isOpsRole('hacker')).toBe(false);
        });
    });

    describe('formatRoleLabel', () => {
        it('retorna labels PT-BR corretos para todos os roles', () => {
            expect(formatRoleLabel(ROLES.ADMIN)).toBe('Administrador');
            expect(formatRoleLabel(ROLES.SUPERVISOR)).toBe('Supervisor');
            expect(formatRoleLabel(ROLES.ANALYST)).toBe('Analista');
            expect(formatRoleLabel(ROLES.CLIENT_MANAGER)).toBe('Gestor');
            expect(formatRoleLabel(ROLES.CLIENT_OPERATOR)).toBe('Operador');
            expect(formatRoleLabel(ROLES.CLIENT_VIEWER)).toBe('Visualizador');
            expect(formatRoleLabel(ROLES.LEGACY_CLIENT)).toBe('Cliente');
        });

        it('retorna fallback para role desconhecido', () => {
            expect(formatRoleLabel('unknown')).toBe('Permissoes em sincronizacao');
            expect(formatRoleLabel(undefined)).toBe('Permissoes em sincronizacao');
        });
    });

    describe('integridade dos enums', () => {
        it('CLIENT_ROLES e OPS_ROLES cobrem todos os ROLES sem sobreposicao', () => {
            const allRoles = [...CLIENT_ROLES, ...OPS_ROLES];
            const definedRoles = Object.values(ROLES);
            expect(allRoles).toHaveLength(definedRoles.length);
            expect(new Set(allRoles).size).toBe(allRoles.length); // sem duplicatas
            for (const role of definedRoles) {
                expect(allRoles).toContain(role);
            }
        });

        it('PERMISSIONS tem 8 permissoes distintas', () => {
            const perms = Object.values(PERMISSIONS);
            expect(perms).toHaveLength(8);
            expect(new Set(perms).size).toBe(8);
        });
    });
});
