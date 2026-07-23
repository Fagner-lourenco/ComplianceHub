import { createRequire } from 'node:module';
import { describe, it, expect, vi } from 'vitest';

const require = createRequire(import.meta.url);

const {
    DEFAULT_AUTO_EXPIRE_HOURS,
    selectExpiredCorrectionCases,
    runAutoExpireCorrections,
} = require('./correctionExpiry');

const NOW = new Date('2026-07-23T12:00:00.000Z');

describe('selectExpiredCorrectionCases', () => {
    it('seleciona caso CORRECTION_NEEDED com correctionRequestedAt > 48h', () => {
        const cases = [{ id: 'a', status: 'CORRECTION_NEEDED', correctionRequestedAt: '2026-07-21T11:00:00.000Z' }];
        expect(selectExpiredCorrectionCases(cases, { now: NOW })).toEqual([
            expect.objectContaining({ id: 'a' }),
        ]);
    });

    it('nao seleciona caso dentro da janela', () => {
        const cases = [{ id: 'a', status: 'CORRECTION_NEEDED', correctionRequestedAt: '2026-07-22T13:00:00.000Z' }];
        expect(selectExpiredCorrectionCases(cases, { now: NOW })).toEqual([]);
    });

    it('usa fallback updatedAt e depois createdAt quando correctionRequestedAt ausente (casos legados)', () => {
        const cases = [
            { id: 'legacy-upd', status: 'CORRECTION_NEEDED', updatedAt: '2026-07-19T00:00:00.000Z' },
            { id: 'legacy-created', status: 'CORRECTION_NEEDED', createdAt: '2026-07-18T00:00:00.000Z' },
        ];
        expect(selectExpiredCorrectionCases(cases, { now: NOW }).map((c) => c.id)).toEqual(['legacy-upd', 'legacy-created']);
    });

    it('ignora status diferente de CORRECTION_NEEDED', () => {
        expect(selectExpiredCorrectionCases([{ id: 'a', status: 'PENDING', createdAt: '2026-07-01T00:00:00.000Z' }], { now: NOW })).toEqual([]);
    });

    it('ignora caso sem nenhuma data de referencia', () => {
        expect(selectExpiredCorrectionCases([{ id: 'a', status: 'CORRECTION_NEEDED' }], { now: NOW })).toEqual([]);
    });

    it('e Firestore-Timestamp-safe para correctionRequestedAt', () => {
        const cases = [{
            id: 'a',
            status: 'CORRECTION_NEEDED',
            correctionRequestedAt: { toDate: () => new Date('2026-07-21T11:00:00.000Z') },
        }];
        expect(selectExpiredCorrectionCases(cases, { now: NOW }).map((c) => c.id)).toEqual(['a']);
    });

    it('usa DEFAULT_AUTO_EXPIRE_HOURS = 48', () => {
        expect(DEFAULT_AUTO_EXPIRE_HOURS).toBe(48);
    });
});

describe('runAutoExpireCorrections handler', () => {
    function buildDb({ queryCases, transactionCases }) {
        const effectiveTransactionCases = transactionCases || queryCases;
        const updates = [];

        const db = {
            collection: vi.fn((name) => {
                if (name !== 'cases') throw new Error(`unexpected collection ${name}`);
                return {
                    where: vi.fn(() => ({
                        get: vi.fn(async () => ({
                            docs: queryCases.map((c) => ({ id: c.id, data: () => ({ ...c }) })),
                        })),
                    })),
                    doc: vi.fn((id) => ({
                        id,
                        update: vi.fn(async (payload) => { updates.push({ id, payload }); }),
                    })),
                };
            }),
            runTransaction: vi.fn(async (fn) => fn({
                get: async (ref) => {
                    const current = effectiveTransactionCases.find((c) => c.id === ref.id);
                    return { exists: !!current, data: () => (current ? { ...current } : undefined) };
                },
                update: (ref, payload) => ref.update(payload),
            })),
        };

        return { db, updates };
    }

    it('expira caso vencido: DONE + AUTO_EXPIRED_CORRECTION, sem finalVerdict, com mensagem de sistema e auditoria', async () => {
        const queryCases = [{
            id: 'case-1',
            status: 'CORRECTION_NEEDED',
            correctionRequestedAt: '2026-07-21T11:00:00.000Z',
            correctionReason: 'CPF divergente',
            createdAt: '2026-07-15T00:00:00.000Z',
            tenantId: 'tenant-1',
            candidateName: 'Fulano de Tal',
        }];
        const { db, updates } = buildDb({ queryCases });
        const createSystemCaseMessage = vi.fn(async () => 'msg-1');
        const writeAuditEvent = vi.fn(async () => 'audit-1');

        const result = await runAutoExpireCorrections({ db, createSystemCaseMessage, writeAuditEvent }, NOW);

        expect(updates).toHaveLength(1);
        const payload = updates[0].payload;
        expect(payload.status).toBe('DONE');
        expect(payload.conclusionType).toBe('AUTO_EXPIRED_CORRECTION');
        expect(typeof payload.concludedAt).toBe('string');
        expect(new Date(payload.concludedAt).toISOString()).toBe(payload.concludedAt);
        expect(payload.autoExpiredAt).toBe(payload.concludedAt);
        expect(payload.turnaroundHours).toBe(204); // 15/07 00:00 -> 23/07 12:00 = 204h
        expect(payload).not.toHaveProperty('finalVerdict');
        expect(payload).toHaveProperty('updatedAt');

        expect(createSystemCaseMessage).toHaveBeenCalledTimes(1);
        expect(createSystemCaseMessage).toHaveBeenCalledWith(expect.objectContaining({
            caseId: 'case-1',
            tenantId: 'tenant-1',
            systemType: 'CORRECTION_EXPIRED',
            body: expect.stringContaining('CPF divergente'),
        }));

        expect(writeAuditEvent).toHaveBeenCalledTimes(1);
        expect(writeAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            tenantId: 'tenant-1',
            entity: expect.objectContaining({ type: 'CASE', id: 'case-1' }),
        }));

        expect(result).toEqual({ expiredCount: 1, candidateCount: 1 });
    });

    it('nao expira caso dentro da janela', async () => {
        const queryCases = [{
            id: 'case-2',
            status: 'CORRECTION_NEEDED',
            correctionRequestedAt: '2026-07-22T13:00:00.000Z',
        }];
        const { db, updates } = buildDb({ queryCases });
        const createSystemCaseMessage = vi.fn();
        const writeAuditEvent = vi.fn();

        const result = await runAutoExpireCorrections({ db, createSystemCaseMessage, writeAuditEvent }, NOW);

        expect(updates).toHaveLength(0);
        expect(createSystemCaseMessage).not.toHaveBeenCalled();
        expect(writeAuditEvent).not.toHaveBeenCalled();
        expect(result).toEqual({ expiredCount: 0, candidateCount: 0 });
    });

    it('re-checa status dentro da transaction e nao atualiza se o cliente ja corrigiu entre a query e a transaction', async () => {
        const queryCases = [{
            id: 'case-3',
            status: 'CORRECTION_NEEDED',
            correctionRequestedAt: '2026-07-21T11:00:00.000Z',
        }];
        // Simula corrida: entre o fetch inicial e a transaction, o cliente corrigiu o caso.
        const transactionCases = [{ ...queryCases[0], status: 'PENDING' }];
        const { db, updates } = buildDb({ queryCases, transactionCases });
        const createSystemCaseMessage = vi.fn();
        const writeAuditEvent = vi.fn();

        const result = await runAutoExpireCorrections({ db, createSystemCaseMessage, writeAuditEvent }, NOW);

        expect(updates).toHaveLength(0);
        expect(createSystemCaseMessage).not.toHaveBeenCalled();
        expect(writeAuditEvent).not.toHaveBeenCalled();
        expect(result).toEqual({ expiredCount: 0, candidateCount: 1 });
    });

    it('continua funcionando quando createSystemCaseMessage ou writeAuditEvent falham', async () => {
        const queryCases = [{
            id: 'case-4',
            status: 'CORRECTION_NEEDED',
            correctionRequestedAt: '2026-07-21T11:00:00.000Z',
            tenantId: 'tenant-1',
        }];
        const { db, updates } = buildDb({ queryCases });
        const createSystemCaseMessage = vi.fn(async () => { throw new Error('boom'); });
        const writeAuditEvent = vi.fn(async () => { throw new Error('boom2'); });

        await expect(runAutoExpireCorrections({ db, createSystemCaseMessage, writeAuditEvent }, NOW)).resolves.toEqual({
            expiredCount: 1,
            candidateCount: 1,
        });
        expect(updates).toHaveLength(1);
    });

    it('caso sem createdAt gera turnaroundHours null', async () => {
        const queryCases = [{
            id: 'case-5',
            status: 'CORRECTION_NEEDED',
            correctionRequestedAt: '2026-07-21T11:00:00.000Z',
        }];
        const { db, updates } = buildDb({ queryCases });
        const createSystemCaseMessage = vi.fn();
        const writeAuditEvent = vi.fn();

        await runAutoExpireCorrections({ db, createSystemCaseMessage, writeAuditEvent }, NOW);

        expect(updates[0].payload.turnaroundHours).toBeNull();
    });
});
