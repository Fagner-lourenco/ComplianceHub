/**
 * tenantUserManagement.test.js — Testes para tenantUserManagement.js
 */

import { describe, it, expect, vi } from 'vitest';
import {
    createOpsClientUserLogic,
    listTenantUsersLogic,
    createTenantUserLogic,
    updateTenantUserLogic,
    syncUserClaimsLogic,
    repairAllClaimsInner,
    listOpsUsersLogic,
    createOpsUserLogic,
    updateOpsUserLogic,
    updateOwnProfileLogic,
    normalizeTenantSlug,
    sanitizeDisplayName,
    normalizeUserStatus,
    canManageOpsUsers,
    assertOpsManager,
    getClientIp,
    OPS_ROLES,
    CLIENT_VIEW_ROLES,
    CLIENT_MANAGEABLE_ROLES,
    OPS_MANAGEABLE_ROLES,
} from './tenantUserManagement';

/* =========================================================
   Mocks comuns
   ========================================================= */
function buildMockDb(collections = {}) {
    return {
        collection: vi.fn((name) => ({
            doc: vi.fn((id) => ({
                get: vi.fn(async () => {
                    const col = collections[name] || {};
                    const doc = col[id];
                    return {
                        exists: !!doc,
                        data: () => doc || null,
                        id,
                    };
                }),
                set: vi.fn(async () => {}),
                update: vi.fn(async () => {}),
            })),
            where: vi.fn(function () {
                const args = Array.from(arguments);
                return {
                    get: vi.fn(async () => {
                        const col = collections[name] || {};
                        const docs = Object.entries(col)
                            .filter(([, d]) => {
                                if (args[0] === 'tenantId') return d.tenantId === args[2];
                                return true;
                            })
                            .map(([id, data]) => ({ id, data: () => data, exists: true }));
                        return {
                            empty: docs.length === 0,
                            forEach: (cb) => docs.forEach(cb),
                            docs,
                        };
                    }),
                    limit: vi.fn(function () {
                        return {
                            get: vi.fn(async () => {
                                const col = collections[name] || {};
                                const entries = Object.entries(col);
                                const docs = entries.map(([id, data]) => ({ id, data: () => data, exists: true }));
                                return {
                                    empty: docs.length === 0,
                                    forEach: (cb) => docs.forEach(cb),
                                    docs,
                                };
                            }),
                            startAfter: vi.fn(() => ({
                                get: vi.fn(async () => ({
                                    empty: true,
                                    forEach: () => {},
                                    docs: [],
                                })),
                            })),
                        };
                    }),
                    orderBy: vi.fn(function () { return this; }),
                    startAfter: vi.fn(function () { return this; }),
                };
            }),
        })),
    };
}

function buildMockAuth() {
    return {
        createUser: vi.fn(async ({ email }) => ({ uid: `uid-${email}`, email })),
        deleteUser: vi.fn(async () => {}),
        setCustomUserClaims: vi.fn(async () => {}),
        updateUser: vi.fn(async () => {}),
    };
}

const ACTOR_TYPE = { OPS_USER: 'OPS_USER', CLIENT_USER: 'CLIENT_USER' };
const SOURCE = { PORTAL_OPS: 'PORTAL_OPS', PORTAL_CLIENT: 'PORTAL_CLIENT' };

function buildDeps(overrides = {}) {
    const db = buildMockDb(overrides.collections || {});
    const auth = buildMockAuth();
    return {
        db,
        getAuth: () => auth,
        getOpsUserProfile: vi.fn(async (uid) => {
            const profile = (overrides.collections?.userProfiles || {})[uid];
            if (!profile || !OPS_ROLES.has(profile.role)) {
                const err = new Error('Perfil nao encontrado ou sem permissao');
                err.code = 'permission-denied';
                throw err;
            }
            if (profile.status === 'inactive') {
                const err = new Error('Conta desativada');
                err.code = 'permission-denied';
                throw err;
            }
            return profile;
        }),
        getClientUserProfile: vi.fn(async (uid) => {
            const profile = (overrides.collections?.userProfiles || {})[uid];
            if (!profile) {
                const err = new Error('Perfil nao encontrado');
                err.code = 'permission-denied';
                throw err;
            }
            if (!CLIENT_VIEW_ROLES.has(profile.role)) {
                const err = new Error('Sem permissao');
                err.code = 'permission-denied';
                throw err;
            }
            if (!profile.tenantId) {
                const err = new Error('Sem tenantId');
                err.code = 'failed-precondition';
                throw err;
            }
            if (profile.status === 'inactive') {
                const err = new Error('Conta desativada');
                err.code = 'permission-denied';
                throw err;
            }
            return profile;
        }),
        writeAuditEvent: vi.fn(async () => {}),
        ACTOR_TYPE,
        SOURCE,
        DEFAULT_ANALYSIS_CONFIG: { enableAutoClassify: true },
        ...overrides,
    };
}

function buildRequest(data = {}, uid = 'caller-uid') {
    return {
        auth: { uid },
        data,
        rawRequest: { ip: '127.0.0.1', headers: {} },
    };
}

/* =========================================================
   Helpers
   ========================================================= */
describe('Helpers', () => {
    it('normalizeTenantSlug gera slug válido', () => {
        expect(normalizeTenantSlug('Acme Inc')).toBe('acme-inc');
        expect(normalizeTenantSlug('  ')).toBe('');
    });

    it('sanitizeDisplayName remove espaços duplos', () => {
        expect(sanitizeDisplayName('  João   Silva  ')).toBe('João Silva');
    });

    it('normalizeUserStatus retorna active como padrão', () => {
        expect(normalizeUserStatus('')).toBe('active');
        expect(normalizeUserStatus('INACTIVE')).toBe('inactive');
        expect(normalizeUserStatus('unknown')).toBe('active');
    });

    it('canManageOpsUsers verifica roles corretamente', () => {
        expect(canManageOpsUsers({ role: 'analyst' })).toBe(false);
        expect(canManageOpsUsers({ role: 'supervisor' })).toBe(true);
        expect(canManageOpsUsers({ role: 'admin' })).toBe(true);
    });

    it('assertOpsManager lança erro quando não é manager', () => {
        expect(() => assertOpsManager({ role: 'analyst' })).toThrow('Sem permissao');
        expect(() => assertOpsManager({ role: 'admin' })).not.toThrow();
    });

    it('getClientIp extrai IP do request', () => {
        expect(getClientIp({ rawRequest: { ip: '1.2.3.4' } })).toBe('1.2.3.4');
        expect(getClientIp({ rawRequest: { headers: { 'x-forwarded-for': '5.6.7.8, 1.1.1.1' } } })).toBe('5.6.7.8');
        expect(getClientIp(null)).toBe(null);
    });
});

/* =========================================================
   createOpsClientUserLogic
   ========================================================= */
describe('createOpsClientUserLogic', () => {
    it('cria cliente com tenantId existente', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: {
                    'caller-uid': { role: 'admin', email: 'admin@test.com', tenantId: 't1' },
                },
                tenantSettings: {
                    'acme': { name: 'Acme' },
                },
            },
        });
        const request = buildRequest({
            email: 'client@test.com',
            password: '123456',
            displayName: 'Client',
            tenantId: 'acme',
            role: 'client_manager',
        });

        const result = await createOpsClientUserLogic({ ...deps, request });
        expect(result.tenantId).toBe('acme');
        expect(deps.getAuth().createUser).toHaveBeenCalled();
        expect(deps.writeAuditEvent).toHaveBeenCalled();
    });

    it('rejeita role inválida', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: { 'caller-uid': { role: 'admin', email: 'admin@test.com' } },
            },
        });
        const request = buildRequest({ email: 'c@test.com', password: '123', displayName: 'C', role: 'analyst' });
        await expect(createOpsClientUserLogic({ ...deps, request })).rejects.toThrow('Role invalida');
    });

    it('rejeita quando tenant já existe ao criar novo', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: { 'caller-uid': { role: 'admin', email: 'admin@test.com' } },
                tenantSettings: { 'acme': { name: 'Acme' } },
            },
        });
        const request = buildRequest({ email: 'c@test.com', password: '123', displayName: 'C', tenantName: 'Acme' });
        await expect(createOpsClientUserLogic({ ...deps, request })).rejects.toThrow('ja existe');
    });

    it('faz rollback se writeAuditEvent falhar', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: { 'caller-uid': { role: 'admin', email: 'admin@test.com' } },
            },
        });
        deps.writeAuditEvent = vi.fn(async () => { throw new Error('audit fail'); });
        const request = buildRequest({ email: 'c@test.com', password: '123', displayName: 'C', tenantId: 't1' });
        await expect(createOpsClientUserLogic({ ...deps, request })).rejects.toThrow('audit fail');
        expect(deps.getAuth().deleteUser).toHaveBeenCalled();
    });
});

/* =========================================================
   listTenantUsersLogic
   ========================================================= */
describe('listTenantUsersLogic', () => {
    it('lista usuários do tenant do caller', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: {
                    'caller-uid': { role: 'client_manager', tenantId: 't1' },
                    'u1': { role: 'client_viewer', tenantId: 't1', email: 'u1@test.com' },
                    'u2': { role: 'client_operator', tenantId: 't1', email: 'u2@test.com' },
                    'u3': { role: 'analyst', tenantId: 't1', email: 'u3@test.com' },
                },
            },
        });
        const request = buildRequest({}, 'caller-uid');
        const result = await listTenantUsersLogic({ ...deps, request });
        expect(result.users).toHaveLength(3);
        expect(result.users.map((u) => u.uid)).toContain('u1');
        expect(result.users.map((u) => u.uid)).toContain('u2');
        expect(result.users.map((u) => u.uid)).toContain('caller-uid');
    });

    it('rejeita não gestor', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: { 'caller-uid': { role: 'client_viewer', tenantId: 't1' } },
            },
        });
        const request = buildRequest({}, 'caller-uid');
        await expect(listTenantUsersLogic({ ...deps, request })).rejects.toThrow('gestores');
    });
});

/* =========================================================
   createTenantUserLogic
   ========================================================= */
describe('createTenantUserLogic', () => {
    it('cria usuário do tenant', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: {
                    'caller-uid': { role: 'client_manager', tenantId: 't1', tenantName: 'T1', email: 'mgr@test.com' },
                },
            },
        });
        const request = buildRequest({ email: 'u@test.com', password: '123', displayName: 'User' }, 'caller-uid');
        const result = await createTenantUserLogic({ ...deps, request });
        expect(result.uid).toBeDefined();
        expect(deps.writeAuditEvent).toHaveBeenCalled();
    });

    it('rejeita role inválida', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: { 'caller-uid': { role: 'client_manager', tenantId: 't1', tenantName: 'T1' } },
            },
        });
        const request = buildRequest({ email: 'u@test.com', password: '123', displayName: 'User', role: 'analyst' }, 'caller-uid');
        await expect(createTenantUserLogic({ ...deps, request })).rejects.toThrow('Role invalida');
    });
});

/* =========================================================
   updateTenantUserLogic
   ========================================================= */
describe('updateTenantUserLogic', () => {
    it('atualiza role do usuário', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: {
                    'caller-uid': { role: 'client_manager', tenantId: 't1', email: 'mgr@test.com' },
                    'target-uid': { role: 'client_viewer', tenantId: 't1', email: 'tgt@test.com' },
                },
            },
        });
        const request = buildRequest({ targetUid: 'target-uid', role: 'client_operator' }, 'caller-uid');
        const result = await updateTenantUserLogic({ ...deps, request });
        expect(result.success).toBe(true);
        expect(deps.db.collection).toHaveBeenCalledWith('userProfiles');
    });

    it('rejeita alterar próprio papel para não gestor', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: {
                    'caller-uid': { role: 'client_manager', tenantId: 't1', email: 'mgr@test.com' },
                },
            },
        });
        const request = buildRequest({ targetUid: 'caller-uid', role: 'client_viewer' }, 'caller-uid');
        await expect(updateTenantUserLogic({ ...deps, request })).rejects.toThrow('proprio acesso');
    });

    it('desativa usuário', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: {
                    'caller-uid': { role: 'client_manager', tenantId: 't1', email: 'mgr@test.com' },
                    'target-uid': { role: 'client_viewer', tenantId: 't1', email: 'tgt@test.com' },
                },
            },
        });
        const request = buildRequest({ targetUid: 'target-uid', status: 'inactive' }, 'caller-uid');
        await updateTenantUserLogic({ ...deps, request });
        expect(deps.getAuth().updateUser).toHaveBeenCalledWith('target-uid', { disabled: true });
    });
});

/* =========================================================
   syncUserClaimsLogic
   ========================================================= */
describe('syncUserClaimsLogic', () => {
    it('sincroniza claims de usuário', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: {
                    'caller-uid': { role: 'admin', tenantId: 't1' },
                    'target-uid': { role: 'client_manager', tenantId: 't1' },
                },
            },
        });
        const request = buildRequest({ targetUid: 'target-uid' }, 'caller-uid');
        const result = await syncUserClaimsLogic({ ...deps, request });
        expect(result.success).toBe(true);
        expect(deps.getAuth().setCustomUserClaims).toHaveBeenCalledWith('target-uid', {
            role: 'client_manager',
            tenantId: 't1',
        });
    });

    it('rejeita não admin', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: { 'caller-uid': { role: 'analyst', tenantId: 't1' } },
            },
        });
        const request = buildRequest({ targetUid: 'target-uid' }, 'caller-uid');
        await expect(syncUserClaimsLogic({ ...deps, request })).rejects.toThrow('administradores');
    });
});

/* =========================================================
   repairAllClaimsInner
   ========================================================= */
describe('repairAllClaimsInner', () => {
    it('repara claims em massa', async () => {
        const entries = [
            ['caller-uid', { role: 'admin', tenantId: 't1' }],
            ['u1', { role: 'client_manager', tenantId: 't1' }],
            ['u2', { role: 'analyst', tenantId: 't2' }],
            ['u3', { role: null, tenantId: 't1' }],
        ];
        const docs = entries.map(([id, data]) => ({ id, data: () => data, exists: true }));
        const db = {
            collection: vi.fn(() => ({
                doc: vi.fn((id) => ({
                    get: vi.fn(async () => {
                        const col = { 'caller-uid': { role: 'admin', tenantId: 't1' } };
                        const doc = col[id];
                        return { exists: !!doc, data: () => doc || null, id };
                    }),
                })),
                orderBy: vi.fn(() => ({
                    limit: vi.fn((n) => ({
                        get: vi.fn(async () => ({
                            empty: docs.length === 0,
                            docs: docs.slice(0, n),
                            forEach: (cb) => docs.slice(0, n).forEach(cb),
                        })),
                        startAfter: vi.fn(() => ({
                            get: vi.fn(async () => ({
                                empty: true,
                                docs: [],
                                forEach: () => {},
                            })),
                        })),
                    })),
                })),
            })),
        };
        const auth = buildMockAuth();
        const request = buildRequest({}, 'caller-uid');
        const result = await repairAllClaimsInner({ db, getAuth: () => auth, request });
        expect(result.total).toBe(4);
        expect(result.fixed).toBe(3);
        expect(result.skipped).toBe(1);
    });

    it('rejeita não owner/admin', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: { 'caller-uid': { role: 'supervisor', tenantId: 't1' } },
            },
        });
        const request = buildRequest({}, 'caller-uid');
        await expect(repairAllClaimsInner({ ...deps, request })).rejects.toThrow('administradores');
    });
});

/* =========================================================
   listOpsUsersLogic
   ========================================================= */
describe('listOpsUsersLogic', () => {
    it('lista usuários ops', async () => {
        const db = {
            collection: vi.fn(() => ({
                where: vi.fn(() => ({
                    get: vi.fn(async () => ({
                        empty: false,
                        forEach: (cb) => {
                            cb({ id: 'caller-uid', data: () => ({ role: 'admin', tenantId: null, email: 'admin@test.com' }) });
                            cb({ id: 'u1', data: () => ({ role: 'analyst', tenantId: 't1', email: 'a1@test.com' }) });
                            cb({ id: 'u2', data: () => ({ role: 'client_manager', tenantId: 't1', email: 'c1@test.com' }) });
                        },
                    })),
                })),
                get: vi.fn(async () => ({
                    empty: false,
                    forEach: (cb) => {
                        cb({ id: 'caller-uid', data: () => ({ role: 'admin', tenantId: null, email: 'admin@test.com' }) });
                        cb({ id: 'u1', data: () => ({ role: 'analyst', tenantId: 't1', email: 'a1@test.com' }) });
                        cb({ id: 'u2', data: () => ({ role: 'client_manager', tenantId: 't1', email: 'c1@test.com' }) });
                    },
                })),
            })),
        };
        const request = buildRequest({}, 'caller-uid');
        const result = await listOpsUsersLogic({ db, getOpsUserProfile: async () => ({ role: 'admin' }), request });
        expect(result.users).toHaveLength(2);
        expect(result.users.map((u) => u.uid)).toContain('u1');
        expect(result.users.map((u) => u.uid)).toContain('caller-uid');
    });

    it('supervisor vê apenas seu tenant', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: {
                    'caller-uid': { role: 'supervisor', tenantId: 't1', email: 'sup@test.com' },
                    'u1': { role: 'analyst', tenantId: 't1', email: 'a1@test.com' },
                    'u2': { role: 'analyst', tenantId: 't2', email: 'a2@test.com' },
                },
            },
        });
        const request = buildRequest({}, 'caller-uid');
        const result = await listOpsUsersLogic({ ...deps, request });
        expect(result.users).toHaveLength(2);
        expect(result.users.map((u) => u.uid)).toContain('u1');
        expect(result.users.map((u) => u.uid)).toContain('caller-uid');
    });
});

/* =========================================================
   createOpsUserLogic
   ========================================================= */
describe('createOpsUserLogic', () => {
    it('cria usuário ops', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: {
                    'caller-uid': { role: 'admin', tenantId: 't1', email: 'admin@test.com' },
                },
                tenantSettings: {
                    't1': { name: 'Tenant One' },
                },
            },
        });
        const request = buildRequest({ email: 'ops@test.com', password: '123', displayName: 'Ops', role: 'analyst' }, 'caller-uid');
        const result = await createOpsUserLogic({ ...deps, request });
        expect(result.uid).toBeDefined();
    });

    it('supervisor só pode criar analyst', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: {
                    'caller-uid': { role: 'supervisor', tenantId: 't1', email: 'sup@test.com' },
                },
            },
        });
        const request = buildRequest({ email: 'ops@test.com', password: '123', displayName: 'Ops', role: 'admin' }, 'caller-uid');
        await expect(createOpsUserLogic({ ...deps, request })).rejects.toThrow('Supervisor so pode criar analistas');
    });
});

/* =========================================================
   updateOpsUserLogic
   ========================================================= */
describe('updateOpsUserLogic', () => {
    it('atualiza status para inactive', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: {
                    'caller-uid': { role: 'admin', tenantId: 't1', email: 'admin@test.com' },
                    'target-uid': { role: 'analyst', tenantId: 't1', email: 'tgt@test.com' },
                },
            },
        });
        const request = buildRequest({ targetUid: 'target-uid', status: 'inactive' }, 'caller-uid');
        const result = await updateOpsUserLogic({ ...deps, request });
        expect(result.success).toBe(true);
        expect(deps.getAuth().updateUser).toHaveBeenCalledWith('target-uid', { disabled: true });
    });

    it('rejeita alterar próprio papel', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: {
                    'caller-uid': { role: 'admin', tenantId: 't1', email: 'a@test.com' },
                },
            },
        });
        const request = buildRequest({ targetUid: 'caller-uid', role: 'supervisor' }, 'caller-uid');
        await expect(updateOpsUserLogic({ ...deps, request })).rejects.toThrow('proprio papel');
    });
});

/* =========================================================
   updateOwnProfileLogic
   ========================================================= */
describe('updateOwnProfileLogic', () => {
    it('atualiza displayName', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: {
                    'caller-uid': { role: 'analyst', tenantId: 't1', email: 'a@test.com', displayName: 'Old' },
                },
            },
        });
        const request = buildRequest({ displayName: 'New Name' }, 'caller-uid');
        const result = await updateOwnProfileLogic({ ...deps, request });
        expect(result.displayName).toBe('New Name');
        expect(deps.getAuth().updateUser).toHaveBeenCalledWith('caller-uid', { displayName: 'New Name' });
    });

    it('rejeita nome curto', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: {
                    'caller-uid': { role: 'analyst', tenantId: 't1', email: 'a@test.com' },
                },
            },
        });
        const request = buildRequest({ displayName: 'A' }, 'caller-uid');
        await expect(updateOwnProfileLogic({ ...deps, request })).rejects.toThrow('pelo menos 2 caracteres');
    });

    it('rejeita nome muito longo', async () => {
        const deps = buildDeps({
            collections: {
                userProfiles: {
                    'caller-uid': { role: 'analyst', tenantId: 't1', email: 'a@test.com' },
                },
            },
        });
        const request = buildRequest({ displayName: 'a'.repeat(81) }, 'caller-uid');
        await expect(updateOwnProfileLogic({ ...deps, request })).rejects.toThrow('no maximo 80 caracteres');
    });
});
