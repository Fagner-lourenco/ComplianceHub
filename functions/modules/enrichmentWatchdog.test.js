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
        escavador2StartedAt: minutesAgo(90),
        ...overrides,
    };
}

// O relogio do watchdog precisa medir a duracao DA FASE, nao a ociosidade do
// documento: updatedAt e bumpado por qualquer write no caso (outras fases, IA,
// edicao do analista), entao um caso movimentado nunca fechava a janela.
describe('relogio do watchdog', () => {
    it('usa escavador2StartedAt mesmo com updatedAt recente (reproduz o bug)', () => {
        const c = makeCase({ escavador2StartedAt: minutesAgo(90), updatedAt: minutesAgo(1) });
        expect(selectStuckEnrichmentCases([c], { now: NOW })).toHaveLength(1);
    });

    it('nao destrava fase recente mesmo com updatedAt antigo', () => {
        const c = makeCase({ escavador2StartedAt: minutesAgo(10), updatedAt: minutesAgo(300) });
        expect(selectStuckEnrichmentCases([c], { now: NOW })).toHaveLength(0);
    });

    it('ignora updatedAt como fonte quando nao ha escavador2StartedAt nem createdAt', () => {
        const c = makeCase({ escavador2StartedAt: undefined, updatedAt: minutesAgo(500) });
        expect(selectStuckEnrichmentCases([c], { now: NOW })).toHaveLength(0);
    });

    it('caso legado sem escavador2StartedAt usa createdAt com janela de 6h', () => {
        const velho = makeCase({ escavador2StartedAt: undefined, createdAt: minutesAgo(7 * 60) });
        const novo = makeCase({ escavador2StartedAt: undefined, createdAt: minutesAgo(2 * 60) });
        expect(selectStuckEnrichmentCases([velho], { now: NOW })).toHaveLength(1);
        expect(selectStuckEnrichmentCases([novo], { now: NOW })).toHaveLength(0);
    });

    it('e Firestore-Timestamp-safe em escavador2StartedAt', () => {
        const ts = { toDate: () => new Date(NOW.getTime() - 120 * 60000) };
        expect(selectStuckEnrichmentCases([makeCase({ escavador2StartedAt: ts })], { now: NOW })).toHaveLength(1);
    });
});

describe('selectStuckEnrichmentCases', () => {
    it('seleciona caso RUNNING parado alem da janela', () => {
        const result = selectStuckEnrichmentCases([makeCase()], { now: NOW });
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('c1');
    });

    it('ignora caso RUNNING recente (consulta legitima em andamento)', () => {
        const result = selectStuckEnrichmentCases([makeCase({ escavador2StartedAt: minutesAgo(5) })], { now: NOW });
        expect(result).toHaveLength(0);
    });

    it('usa a janela padrao de STUCK_AFTER_MINUTES', () => {
        const dentro = makeCase({ escavador2StartedAt: minutesAgo(STUCK_AFTER_MINUTES - 1) });
        const fora = makeCase({ escavador2StartedAt: minutesAgo(STUCK_AFTER_MINUTES + 1) });
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

    it('e Firestore-Timestamp-safe (escavador2StartedAt com toDate)', () => {
        const ts = { toDate: () => new Date(NOW.getTime() - 120 * 60000) };
        const result = selectStuckEnrichmentCases([makeCase({ escavador2StartedAt: ts })], { now: NOW });
        expect(result).toHaveLength(1);
    });

    it('cai para createdAt (janela legada) quando nao ha escavador2StartedAt', () => {
        const result = selectStuckEnrichmentCases(
            [makeCase({ escavador2StartedAt: null, createdAt: minutesAgo(7 * 60) })],
            { now: NOW },
        );
        expect(result).toHaveLength(1);
    });

    it('ignora caso sem nenhum timestamp', () => {
        const result = selectStuckEnrichmentCases(
            [makeCase({ escavador2StartedAt: null, updatedAt: null, createdAt: null })],
            { now: NOW },
        );
        expect(result).toHaveLength(0);
    });

    it('respeita janela customizada', () => {
        const c = makeCase({ escavador2StartedAt: minutesAgo(45) });
        expect(selectStuckEnrichmentCases([c], { now: NOW, stuckAfterMinutes: 30 })).toHaveLength(1);
        expect(selectStuckEnrichmentCases([c], { now: NOW, stuckAfterMinutes: 60 })).toHaveLength(0);
    });

    it('janela customizada nao afeta o fallback legado (createdAt usa 6h fixas)', () => {
        const c = makeCase({ escavador2StartedAt: null, createdAt: minutesAgo(120) });
        expect(selectStuckEnrichmentCases([c], { now: NOW, stuckAfterMinutes: 5 })).toHaveLength(0);
    });
});

describe('runEnrichmentWatchdogSweep', () => {
    const { runEnrichmentWatchdogSweep } = require('./enrichmentWatchdog');

    function makeDeps(caseDocs, { taskData = { status: 'QUEUED' }, freshCase = null } = {}) {
        const updates = [];
        const refFor = (collection, id) => ({ __collection: collection, __id: id });
        const db = {
            collection: (name) => ({
                where: () => ({
                    limit: () => ({
                        get: async () => ({
                            size: caseDocs.length,
                            docs: caseDocs.map((d) => ({ id: d.id, data: () => d })),
                        }),
                    }),
                }),
                doc: (id) => refFor(name, id),
            }),
            runTransaction: async (fn) => fn({
                get: async (ref) => {
                    if (ref.__collection === 'cases') {
                        const found = freshCase || caseDocs.find((d) => d.id === ref.__id);
                        return { exists: Boolean(found), data: () => found };
                    }
                    return { exists: Boolean(taskData), data: () => taskData };
                },
                update: (ref, payload) => { updates.push({ id: ref.__id, collection: ref.__collection, payload }); },
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
        const { deps } = makeDeps([makeCase({ id: 'c1', escavador2StartedAt: minutesAgo(2) })]);
        const result = await runEnrichmentWatchdogSweep(deps, NOW);

        expect(result.stuck).toBe(0);
        expect(deps.recordFailure).not.toHaveBeenCalled();
    });

    it('marca a task como STALE junto com o caso', async () => {
        const { deps, updates } = makeDeps([makeCase({ id: 'c1', tenantId: 't1', enrichmentGeneration: 2 })]);
        await runEnrichmentWatchdogSweep(deps, NOW);

        const taskUpdate = updates.find((u) => u.collection === 'escavador2Tasks');
        expect(taskUpdate.payload.status).toBe('STALE');
        expect(taskUpdate.payload.staleReason).toBe('watchdog_timeout');
    });

    it('aborta se o callback concluiu o caso entre a query e a transacao', async () => {
        const { deps, updates } = makeDeps(
            [makeCase({ id: 'c1', tenantId: 't1' })],
            { freshCase: { escavador2EnrichmentStatus: 'DONE', status: 'IN_PROGRESS' } },
        );
        const result = await runEnrichmentWatchdogSweep(deps, NOW);

        expect(result.closed).toBe(0);
        expect(result.skipped).toBe(1);
        expect(updates).toHaveLength(0);
        expect(deps.recordFailure).not.toHaveBeenCalled();
    });

    it('age mesmo sem doc de task (falha antes do registro)', async () => {
        const { deps, updates } = makeDeps([makeCase({ id: 'c1', tenantId: 't1' })], { taskData: null });
        const result = await runEnrichmentWatchdogSweep(deps, NOW);

        expect(result.closed).toBe(1);
        expect(updates.filter((u) => u.collection === 'escavador2Tasks')).toHaveLength(0);
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

// O watchdog usava caseRef.update() nao-transacional enquanto o callback usa
// runTransaction: entre a query e o update um callback legitimo podia fechar o
// caso como DONE e ser sobrescrito para FAILED, destruindo dado bom.
describe('decideWatchdogAction', () => {
    const { decideWatchdogAction } = require('./enrichmentWatchdog');

    const runningCase = () => ({ escavador2EnrichmentStatus: 'RUNNING', status: 'IN_PROGRESS' });

    it('age quando o caso continua RUNNING e a task esta pendente', () => {
        const r = decideWatchdogAction({ caseData: runningCase(), taskData: { status: 'QUEUED' } });
        expect(r.act).toBe(true);
    });

    it('aborta quando o caso saiu de RUNNING (callback venceu a corrida)', () => {
        const r = decideWatchdogAction({
            caseData: { escavador2EnrichmentStatus: 'DONE', status: 'IN_PROGRESS' },
            taskData: { status: 'QUEUED' },
        });
        expect(r.act).toBe(false);
        expect(r.reason).toBe('not_running');
    });

    it('aborta quando a task ja foi processada', () => {
        const r = decideWatchdogAction({
            caseData: runningCase(),
            taskData: { status: 'QUEUED', processedAt: 'ontem' },
        });
        expect(r.act).toBe(false);
        expect(r.reason).toBe('already_processed');
    });

    it.each(['DONE', 'PARTIAL', 'FAILED', 'STALE', 'SKIPPED'])('aborta quando a task esta em %s', (status) => {
        const r = decideWatchdogAction({ caseData: runningCase(), taskData: { status } });
        expect(r.act).toBe(false);
        expect(r.reason).toBe('already_processed');
    });

    it('age quando a task nao existe (falha antes do registro nao pode bloquear)', () => {
        const r = decideWatchdogAction({ caseData: runningCase(), taskData: null });
        expect(r.act).toBe(true);
    });

    it('aborta quando o caso nao existe mais', () => {
        const r = decideWatchdogAction({ caseData: null, taskData: { status: 'QUEUED' } });
        expect(r.act).toBe(false);
        expect(r.reason).toBe('case_not_found');
    });
});

describe('buildStuckTaskPayload', () => {
    const { buildStuckTaskPayload } = require('./enrichmentWatchdog');

    it('marca a task como STALE com motivo e processedAt', () => {
        const payload = buildStuckTaskPayload({ serverTimestamp: () => 'TS' });
        expect(payload.status).toBe('STALE');
        expect(payload.staleReason).toBe('watchdog_timeout');
        expect(payload.processedAt).toBe('TS');
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
