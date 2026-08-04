/**
 * enrichmentWatchdog.test.js — watchdog de provedores assíncronos travados
 */
import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    selectStuckEnrichmentCases,
    buildStuckUpdatePayload,
    STUCK_AFTER_MINUTES,
} = require('./enrichmentWatchdog');

const NOW = new Date('2026-08-04T22:00:00.000Z');
const minutesAgo = (m) => new Date(NOW.getTime() - m * 60000).toISOString();

function makeCase(overrides = {}) {
    return {
        id: 'c1',
        status: 'IN_PROGRESS',
        escavador2EnrichmentStatus: 'RUNNING',
        updatedAt: minutesAgo(90),
        ...overrides,
    };
}

describe('selectStuckEnrichmentCases', () => {
    it('seleciona caso RUNNING parado alem da janela', () => {
        const result = selectStuckEnrichmentCases([makeCase()], { now: NOW });
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('c1');
    });

    it('ignora caso RUNNING recente (consulta legitima em andamento)', () => {
        const result = selectStuckEnrichmentCases([makeCase({ updatedAt: minutesAgo(5) })], { now: NOW });
        expect(result).toHaveLength(0);
    });

    it('usa a janela padrao de STUCK_AFTER_MINUTES', () => {
        const dentro = makeCase({ updatedAt: minutesAgo(STUCK_AFTER_MINUTES - 1) });
        const fora = makeCase({ updatedAt: minutesAgo(STUCK_AFTER_MINUTES + 1) });
        expect(selectStuckEnrichmentCases([dentro], { now: NOW })).toHaveLength(0);
        expect(selectStuckEnrichmentCases([fora], { now: NOW })).toHaveLength(1);
    });

    it('ignora status terminais do escavador2', () => {
        for (const st of ['DONE', 'PARTIAL', 'FAILED', 'SKIPPED', 'BLOCKED']) {
            const result = selectStuckEnrichmentCases([makeCase({ escavador2EnrichmentStatus: st })], { now: NOW });
            expect(result, st).toHaveLength(0);
        }
    });

    it('ignora casos ja concluidos ou devolvidos ao cliente', () => {
        for (const st of ['DONE', 'CORRECTION_NEEDED', 'CANCELLED', 'ARCHIVED']) {
            const result = selectStuckEnrichmentCases([makeCase({ status: st })], { now: NOW });
            expect(result, st).toHaveLength(0);
        }
    });

    it('aceita PENDING, IN_PROGRESS e WAITING_INFO', () => {
        for (const st of ['PENDING', 'IN_PROGRESS', 'WAITING_INFO']) {
            const result = selectStuckEnrichmentCases([makeCase({ status: st })], { now: NOW });
            expect(result, st).toHaveLength(1);
        }
    });

    it('e Firestore-Timestamp-safe (updatedAt com toDate)', () => {
        const ts = { toDate: () => new Date(NOW.getTime() - 120 * 60000) };
        const result = selectStuckEnrichmentCases([makeCase({ updatedAt: ts })], { now: NOW });
        expect(result).toHaveLength(1);
    });

    it('cai para createdAt quando nao ha updatedAt', () => {
        const result = selectStuckEnrichmentCases(
            [makeCase({ updatedAt: null, createdAt: minutesAgo(200) })],
            { now: NOW },
        );
        expect(result).toHaveLength(1);
    });

    it('ignora caso sem nenhum timestamp', () => {
        const result = selectStuckEnrichmentCases([makeCase({ updatedAt: null, createdAt: null })], { now: NOW });
        expect(result).toHaveLength(0);
    });

    it('respeita janela customizada', () => {
        const c = makeCase({ updatedAt: minutesAgo(45) });
        expect(selectStuckEnrichmentCases([c], { now: NOW, stuckAfterMinutes: 30 })).toHaveLength(1);
        expect(selectStuckEnrichmentCases([c], { now: NOW, stuckAfterMinutes: 60 })).toHaveLength(0);
    });
});

describe('runEnrichmentWatchdogSweep', () => {
    const { runEnrichmentWatchdogSweep } = require('./enrichmentWatchdog');

    function makeDeps(caseDocs) {
        const updates = [];
        const db = {
            collection: () => ({
                where: () => ({
                    limit: () => ({
                        get: async () => ({
                            size: caseDocs.length,
                            docs: caseDocs.map((d) => ({ id: d.id, data: () => d })),
                        }),
                    }),
                }),
                doc: (id) => ({ update: async (payload) => { updates.push({ id, payload }); } }),
            }),
        };
        return {
            updates,
            deps: {
                db,
                maybeRunAutoClassifyAndAi: vi.fn(async () => {}),
                writeAuditEvent: vi.fn(async () => {}),
                recordFailure: vi.fn(async () => {}),
            },
        };
    }

    it('registra falha no circuito ao encerrar caso travado', async () => {
        const { deps, updates } = makeDeps([makeCase({ id: 'c1', tenantId: 't1' })]);
        const result = await runEnrichmentWatchdogSweep(deps, NOW);

        expect(result.closed).toBe(1);
        expect(updates[0].payload.escavador2EnrichmentStatus).toBe('FAILED');
        expect(deps.recordFailure).toHaveBeenCalledWith('escavador2', expect.stringMatching(/watchdog/i));
        expect(deps.maybeRunAutoClassifyAndAi).toHaveBeenCalled();
    });

    it('nao registra falha quando nao ha caso travado', async () => {
        const { deps } = makeDeps([makeCase({ id: 'c1', updatedAt: minutesAgo(2) })]);
        const result = await runEnrichmentWatchdogSweep(deps, NOW);

        expect(result.stuck).toBe(0);
        expect(deps.recordFailure).not.toHaveBeenCalled();
    });

    it('falha do circuito nao impede o destrave do caso', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { deps, updates } = makeDeps([makeCase({ id: 'c1', tenantId: 't1' })]);
        deps.recordFailure = vi.fn(async () => { throw new Error('systemHealth fora'); });

        const result = await runEnrichmentWatchdogSweep(deps, NOW);

        expect(result.closed).toBe(1);
        expect(updates[0].payload.escavador2EnrichmentStatus).toBe('FAILED');
        consoleSpy.mockRestore();
    });
});

describe('buildStuckUpdatePayload', () => {
    it('marca escavador2 como FAILED com motivo auditavel', () => {
        const payload = buildStuckUpdatePayload({ serverTimestamp: () => 'TS' }, 95);
        expect(payload.escavador2EnrichmentStatus).toBe('FAILED');
        expect(payload.escavador2CallbackStatus).toBe('FAILED');
        expect(payload.escavador2Error).toMatch(/watchdog/i);
        expect(payload.escavador2Error).toMatch(/95/);
        expect(payload.updatedAt).toBe('TS');
    });
});
