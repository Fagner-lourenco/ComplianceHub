import { describe, it, expect } from 'vitest';
import { computeDemoUrgencyRank, compareDemoOpsCases } from './useOpsCasesQuery';

describe('computeDemoUrgencyRank', () => {
    it('rankeia caso sem createdAt por ultimo (paridade com backend)', () => {
        const now = new Date('2026-07-23T12:00:00Z');
        const onTimeCase = {
            createdAt: '2026-07-23T09:00:00Z',
            slaHours: 24,
            status: 'PENDING',
        };
        const missingCreatedAtCase = {
            createdAt: null,
            slaHours: 24,
            status: 'PENDING',
        };

        const onTimeRank = computeDemoUrgencyRank(onTimeCase, now);
        const missingRank = computeDemoUrgencyRank(missingCreatedAtCase, now);

        expect(missingRank).toBe(Number.MAX_SAFE_INTEGER);
        expect(missingRank).toBeGreaterThan(onTimeRank);
    });
});

describe('compareDemoOpsCases urgency', () => {
    const now = new Date('2026-07-23T12:00:00Z');

    it('CORRECTION_NEEDED vencido vai depois de PENDING dentro do prazo', () => {
        const correctionNeeded = { id: 'corr', createdAt: '2026-01-01T00:00:00Z', slaHours: 48, status: 'CORRECTION_NEEDED' };
        const pendingOnTime = { id: 'pending', createdAt: '2026-07-23T00:00:00Z', slaHours: 48, status: 'PENDING' };
        const sorted = [correctionNeeded, pendingOnTime].sort((a, b) => compareDemoOpsCases(a, b, 'urgency', 'asc', now));
        expect(sorted.map((c) => c.id)).toEqual(['pending', 'corr']);
    });

    it('WAITING_INFO vencido vai depois de PENDING dentro do prazo', () => {
        const waitingInfo = { id: 'wait', createdAt: '2026-01-01T00:00:00Z', slaHours: 48, status: 'WAITING_INFO' };
        const pendingOnTime = { id: 'pending', createdAt: '2026-07-23T00:00:00Z', slaHours: 48, status: 'PENDING' };
        const sorted = [waitingInfo, pendingOnTime].sort((a, b) => compareDemoOpsCases(a, b, 'urgency', 'asc', now));
        expect(sorted.map((c) => c.id)).toEqual(['pending', 'wait']);
    });

    it('dois casos bloqueados entre si mantem ordem por mais vencido primeiro', () => {
        const olderBlocked = { id: 'older-blocked', createdAt: '2026-07-19T12:00:00Z', slaHours: 48, status: 'CORRECTION_NEEDED' };
        const newerBlocked = { id: 'newer-blocked', createdAt: '2026-07-20T12:00:00Z', slaHours: 48, status: 'WAITING_INFO' };
        const sorted = [newerBlocked, olderBlocked].sort((a, b) => compareDemoOpsCases(a, b, 'urgency', 'asc', now));
        expect(sorted.map((c) => c.id)).toEqual(['older-blocked', 'newer-blocked']);
    });
});
