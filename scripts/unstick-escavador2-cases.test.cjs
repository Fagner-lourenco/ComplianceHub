/**
 * unstick-escavador2-cases.test.cjs — predicado de seleção do destrave
 * Vitest globals habilitados em vite.config.js (globals: true).
 */
const { shouldUnstickCase } = require('./unstick-escavador2-cases.cjs');

const NOW = new Date('2026-08-04T21:00:00.000Z').getTime();
const minutesAgo = (m) => new Date(NOW - m * 60000).toISOString();

function makeCase(overrides = {}) {
    return {
        status: 'IN_PROGRESS',
        escavador2EnrichmentStatus: 'RUNNING',
        escavador2CallbackStatus: 'QUEUED',
        updatedAt: minutesAgo(60),
        ...overrides,
    };
}

describe('shouldUnstickCase', () => {
    it('elegivel: RUNNING parado ha mais que o limite', () => {
        expect(shouldUnstickCase(makeCase(), { now: NOW }).eligible).toBe(true);
    });

    it('nao elegivel: RUNNING recente (consulta legitimamente em andamento)', () => {
        const r = shouldUnstickCase(makeCase({ updatedAt: minutesAgo(5) }), { now: NOW });
        expect(r.eligible).toBe(false);
        expect(r.reason).toMatch(/em_andamento/);
    });

    it('respeita minAgeMinutes customizado', () => {
        const c = makeCase({ updatedAt: minutesAgo(30) });
        expect(shouldUnstickCase(c, { now: NOW, minAgeMinutes: 20 }).eligible).toBe(true);
        expect(shouldUnstickCase(c, { now: NOW, minAgeMinutes: 45 }).eligible).toBe(false);
    });

    it('nao elegivel: escavador2 ja terminal', () => {
        for (const st of ['DONE', 'FAILED', 'SKIPPED', 'PARTIAL']) {
            const r = shouldUnstickCase(makeCase({ escavador2EnrichmentStatus: st }), { now: NOW });
            expect(r.eligible, st).toBe(false);
            expect(r.reason).toBe('escavador2_not_running');
        }
    });

    it('nao elegivel: caso concluido ou devolvido ao cliente', () => {
        for (const st of ['DONE', 'CORRECTION_NEEDED', 'CANCELLED', 'ARCHIVED']) {
            const r = shouldUnstickCase(makeCase({ status: st }), { now: NOW });
            expect(r.eligible, st).toBe(false);
            expect(r.reason).toMatch(/^case_status_/);
        }
    });

    it('aceita casos PENDING e WAITING_INFO', () => {
        for (const st of ['PENDING', 'IN_PROGRESS', 'WAITING_INFO']) {
            expect(shouldUnstickCase(makeCase({ status: st }), { now: NOW }).eligible, st).toBe(true);
        }
    });

    it('prioriza escavador2StartedAt sobre updatedAt', () => {
        const c = makeCase({ escavador2StartedAt: minutesAgo(90), updatedAt: minutesAgo(1) });
        expect(shouldUnstickCase(c, { now: NOW }).eligible).toBe(true);
    });

    it('usa createdAt quando nao ha updatedAt', () => {
        const c = makeCase({ updatedAt: undefined, createdAt: minutesAgo(90) });
        expect(shouldUnstickCase(c, { now: NOW }).eligible).toBe(true);
    });

    it('nao elegivel: sem nenhum timestamp', () => {
        const c = makeCase({ updatedAt: undefined, createdAt: undefined });
        const r = shouldUnstickCase(c, { now: NOW });
        expect(r.eligible).toBe(false);
        expect(r.reason).toBe('sem_timestamp');
    });
});
