/**
 * Testes de regressao para caseCommunication.js
 * Inclui findOpsNotificationRecipientsForTenant com suporte a admins globais
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const createFakeDocs = (docs) => docs.map((data, i) => ({
    id: `uid-${i}`,
    data: () => data,
}));

const createMockDb = (queries) => {
    let callIndex = 0;
    return {
        collection: vi.fn(() => ({
            where: vi.fn(() => ({
                where: vi.fn(() => ({
                    get: vi.fn(() => {
                        const result = queries[callIndex] || { docs: [], size: 0 };
                        callIndex++;
                        return Promise.resolve(result);
                    }),
                })),
                get: vi.fn(() => {
                    const result = queries[callIndex] || { docs: [], size: 0 };
                    callIndex++;
                    return Promise.resolve(result);
                }),
            })),
        })),
    };
};

// Importa o modulo
const { buildNotificationFunctions } = await import('./caseCommunication.js');

describe('caseCommunication', () => {
    let caseComm;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('findOpsNotificationRecipientsForTenant', () => {
        it('retorna vazio quando tenantId é nulo', async () => {
            const db = createMockDb([]);
            caseComm = buildNotificationFunctions(db);
            const result = await caseComm.findOpsNotificationRecipientsForTenant(null);
            expect(result).toEqual([]);
            expect(db.collection).not.toHaveBeenCalled();
        });

        it('inclui usuarios OPS do tenant especifico', async () => {
            const db = createMockDb([
                { docs: createFakeDocs([
                    { displayName: 'Ana', role: 'analyst', tenantId: 'tenant-1', status: 'active' },
                    { displayName: 'Beto', role: 'supervisor', tenantId: 'tenant-1', status: 'active' },
                ]), size: 2 },
                { docs: [], size: 0 },
            ]);
            caseComm = buildNotificationFunctions(db);
            const result = await caseComm.findOpsNotificationRecipientsForTenant('tenant-1');
            expect(result).toHaveLength(2);
            expect(result[0].displayName).toBe('Ana');
            expect(result[1].displayName).toBe('Beto');
        });

        it('inclui admins globais sem tenantId', async () => {
            const db = createMockDb([
                { docs: [], size: 0 },
                { docs: createFakeDocs([
                    { displayName: 'Admin Global', role: 'admin', status: 'active' },
                    { displayName: 'Owner Global', role: 'owner', status: 'active' },
                ]), size: 2 },
            ]);
            caseComm = buildNotificationFunctions(db);
            const result = await caseComm.findOpsNotificationRecipientsForTenant('tenant-1');
            expect(result).toHaveLength(2);
            expect(result[0].displayName).toBe('Admin Global');
            expect(result[1].displayName).toBe('Owner Global');
        });

        it('combina usuarios de tenant e admins globais', async () => {
            const db = createMockDb([
                { docs: [
                    { id: 'uid-1', data: () => ({ displayName: 'Ana', role: 'analyst', tenantId: 'tenant-1', status: 'active' }) },
                ], size: 1 },
                { docs: [
                    { id: 'uid-2', data: () => ({ displayName: 'Admin Global', role: 'admin', status: 'active' }) },
                ], size: 1 },
            ]);
            caseComm = buildNotificationFunctions(db);
            const result = await caseComm.findOpsNotificationRecipientsForTenant('tenant-1');
            expect(result).toHaveLength(2);
            expect(result.map(r => r.displayName)).toContain('Ana');
            expect(result.map(r => r.displayName)).toContain('Admin Global');
        });

        it('nao duplica admins que tambem tem tenant especifico', async () => {
            const db = createMockDb([
                { docs: createFakeDocs([
                    { displayName: 'Admin Tenant', role: 'admin', tenantId: 'tenant-1', status: 'active' },
                ]), size: 1 },
                { docs: createFakeDocs([
                    { displayName: 'Admin Tenant', role: 'admin', tenantId: 'tenant-1', status: 'active' },
                    { displayName: 'Admin Global', role: 'admin', status: 'active' },
                ]), size: 2 },
            ]);
            caseComm = buildNotificationFunctions(db);
            const result = await caseComm.findOpsNotificationRecipientsForTenant('tenant-1');
            expect(result).toHaveLength(2);
            const uids = result.map(r => r.uid);
            expect(new Set(uids).size).toBe(2);
        });

        it('ignora usuarios inativos', async () => {
            const db = createMockDb([
                { docs: createFakeDocs([
                    { displayName: 'Ativo', role: 'analyst', tenantId: 'tenant-1', status: 'active' },
                    { displayName: 'Inativo', role: 'analyst', tenantId: 'tenant-1', status: 'inactive' },
                ]), size: 2 },
                { docs: createFakeDocs([
                    { displayName: 'Admin Inativo', role: 'admin', status: 'inactive' },
                    { displayName: 'Admin Ativo', role: 'admin', status: 'active' },
                ]), size: 2 },
            ]);
            caseComm = buildNotificationFunctions(db);
            const result = await caseComm.findOpsNotificationRecipientsForTenant('tenant-1');
            expect(result).toHaveLength(2);
            expect(result.map(r => r.displayName)).toContain('Ativo');
            expect(result.map(r => r.displayName)).toContain('Admin Ativo');
            expect(result.map(r => r.displayName)).not.toContain('Inativo');
            expect(result.map(r => r.displayName)).not.toContain('Admin Inativo');
        });

        it('ignora admins globais que tem tenantId definido', async () => {
            const db = createMockDb([
                { docs: [], size: 0 },
                { docs: createFakeDocs([
                    { displayName: 'Admin Com Tenant', role: 'admin', tenantId: 'tenant-2', status: 'active' },
                    { displayName: 'Admin Global', role: 'admin', status: 'active' },
                ]), size: 2 },
            ]);
            caseComm = buildNotificationFunctions(db);
            const result = await caseComm.findOpsNotificationRecipientsForTenant('tenant-1');
            expect(result).toHaveLength(1);
            expect(result[0].displayName).toBe('Admin Global');
        });
    });
});
