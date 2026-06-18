/**
 * Testes para functions/modules/_shared/auth.js
 */

import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Mock HttpsError
function HttpsError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

const OPS_ROLES = new Set(['analyst', 'supervisor', 'admin', 'owner']);
const CLIENT_REQUESTER_ROLES = new Set(['CLIENT', 'client_operator', 'client_manager']);
const CLIENT_VIEW_ROLES = new Set(['CLIENT', 'client_viewer', 'client_operator', 'client_manager']);

function createMockDb(profileMap = {}) {
    return {
        collection: () => ({
            doc: (uid) => ({
                get: vi.fn(async () => {
                    const data = profileMap[uid];
                    if (data === undefined) {
                        return { exists: false, data: () => null };
                    }
                    return { exists: true, data: () => data };
                }),
            }),
        }),
    };
}

function setupAuth(profileMap) {
    const db = createMockDb(profileMap);
    const createAuth = require('./auth.js');
    return createAuth({ db, HttpsError, OPS_ROLES, CLIENT_REQUESTER_ROLES, CLIENT_VIEW_ROLES });
}

describe('auth module', () => {
    describe('canAssignCases', () => {
        it('returns true for supervisor, admin, owner', () => {
            const { canAssignCases } = setupAuth({});
            expect(canAssignCases({ role: 'supervisor' })).toBe(true);
            expect(canAssignCases({ role: 'admin' })).toBe(true);
            expect(canAssignCases({ role: 'owner' })).toBe(true);
        });

        it('returns false for analyst and client roles', () => {
            const { canAssignCases } = setupAuth({});
            expect(canAssignCases({ role: 'analyst' })).toBe(false);
            expect(canAssignCases({ role: 'client_manager' })).toBe(false);
            expect(canAssignCases({})).toBe(false);
        });
    });

    describe('assertCanAssignCase', () => {
        it('does not throw for supervisor', () => {
            const { assertCanAssignCase } = setupAuth({});
            expect(() => assertCanAssignCase({ role: 'supervisor' })).not.toThrow();
        });

        it('throws permission-denied for analyst', () => {
            const { assertCanAssignCase } = setupAuth({});
            expect(() => assertCanAssignCase({ role: 'analyst' })).toThrow('Sem permissao para atribuir casos.');
        });
    });

    describe('getOpsUserProfile', () => {
        it('returns profile for active ops user', async () => {
            const { getOpsUserProfile } = setupAuth({
                uid1: { role: 'analyst', status: 'active', tenantId: 't1' },
            });
            const profile = await getOpsUserProfile('uid1');
            expect(profile.role).toBe('analyst');
        });

        it('throws permission-denied when profile does not exist', async () => {
            const { getOpsUserProfile } = setupAuth({});
            await expect(getOpsUserProfile('uid1')).rejects.toThrow('Apenas analistas podem re-executar fases do pipeline.');
        });

        it('throws permission-denied for non-ops role', async () => {
            const { getOpsUserProfile } = setupAuth({
                uid1: { role: 'client_manager', status: 'active' },
            });
            await expect(getOpsUserProfile('uid1')).rejects.toThrow('Apenas analistas podem re-executar fases do pipeline.');
        });

        it('throws permission-denied for inactive account', async () => {
            const { getOpsUserProfile } = setupAuth({
                uid1: { role: 'analyst', status: 'inactive' },
            });
            await expect(getOpsUserProfile('uid1')).rejects.toThrow('Conta desativada. Contate o gestor da franquia.');
        });
    });

    describe('assertOpsCanAccessCase', () => {
        it('does not throw when tenant matches', () => {
            const { assertOpsCanAccessCase } = setupAuth({});
            expect(() => assertOpsCanAccessCase({ tenantId: 't1', role: 'analyst' }, { tenantId: 't1' }, 'c1')).not.toThrow();
        });

        it('throws not-found when caseData is missing', () => {
            const { assertOpsCanAccessCase } = setupAuth({});
            expect(() => assertOpsCanAccessCase({ tenantId: 't1' }, null, 'c1')).toThrow('Caso nao encontrado.');
        });

        it('throws failed-precondition when case has no tenantId', () => {
            const { assertOpsCanAccessCase } = setupAuth({});
            expect(() => assertOpsCanAccessCase({ tenantId: 't1' }, {}, 'c1')).toThrow('Caso c1 sem tenantId.');
        });

        it('allows admin/owner without tenantId to access any case', () => {
            const { assertOpsCanAccessCase } = setupAuth({});
            expect(() => assertOpsCanAccessCase({ role: 'admin' }, { tenantId: 't1' }, 'c1')).not.toThrow();
            expect(() => assertOpsCanAccessCase({ role: 'owner' }, { tenantId: 't2' }, 'c1')).not.toThrow();
        });

        it('throws permission-denied for tenant mismatch', () => {
            const { assertOpsCanAccessCase } = setupAuth({});
            expect(() => assertOpsCanAccessCase({ tenantId: 't1', role: 'analyst' }, { tenantId: 't2' }, 'c1')).toThrow('Sem permissao para operar neste caso.');
        });
    });

    describe('getClientUserProfile', () => {
        it('returns profile for active client viewer', async () => {
            const { getClientUserProfile } = setupAuth({
                uid1: { role: 'client_viewer', status: 'active', tenantId: 't1' },
            });
            const profile = await getClientUserProfile('uid1');
            expect(profile.role).toBe('client_viewer');
        });

        it('throws permission-denied when profile does not exist', async () => {
            const { getClientUserProfile } = setupAuth({});
            await expect(getClientUserProfile('uid1')).rejects.toThrow('Perfil do cliente nao encontrado.');
        });

        it('throws permission-denied for disallowed role', async () => {
            const { getClientUserProfile } = setupAuth({
                uid1: { role: 'analyst', status: 'active', tenantId: 't1' },
            });
            await expect(getClientUserProfile('uid1')).rejects.toThrow('Perfil do cliente sem permissao para esta operacao.');
        });

        it('throws failed-precondition when tenantId is missing', async () => {
            const { getClientUserProfile } = setupAuth({
                uid1: { role: 'client_viewer', status: 'active' },
            });
            await expect(getClientUserProfile('uid1')).rejects.toThrow('Cliente sem tenantId associado.');
        });

        it('throws permission-denied for inactive account', async () => {
            const { getClientUserProfile } = setupAuth({
                uid1: { role: 'client_viewer', status: 'inactive', tenantId: 't1' },
            });
            await expect(getClientUserProfile('uid1')).rejects.toThrow('Conta desativada. Contate o gestor da franquia.');
        });

        it('requires requester role when requireRequester=true', async () => {
            const { getClientUserProfile } = setupAuth({
                uid1: { role: 'client_viewer', status: 'active', tenantId: 't1' },
            });
            await expect(getClientUserProfile('uid1', { requireRequester: true })).rejects.toThrow('Perfil do cliente sem permissao para esta operacao.');

            const { getClientUserProfile: getClientUserProfile2 } = setupAuth({
                uid2: { role: 'client_operator', status: 'active', tenantId: 't1' },
            });
            const profile = await getClientUserProfile2('uid2', { requireRequester: true });
            expect(profile.role).toBe('client_operator');
        });
    });

    describe('assertClientManager', () => {
        it('does not throw for client_manager', () => {
            const { assertClientManager } = setupAuth({});
            expect(() => assertClientManager({ role: 'client_manager' })).not.toThrow();
        });

        it('throws permission-denied for non-client_manager', () => {
            const { assertClientManager } = setupAuth({});
            expect(() => assertClientManager({ role: 'client_operator' })).toThrow('Operacao disponivel apenas para gestores.');
            expect(() => assertClientManager(null)).toThrow('Operacao disponivel apenas para gestores.');
        });
    });
});
