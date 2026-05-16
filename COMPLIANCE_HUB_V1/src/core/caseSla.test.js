import { describe, expect, it } from 'vitest';
import { getSlaDeadline, getSlaStatus, getSlaColor } from './caseSla';

describe('getSlaDeadline', () => {
    it('returns deadline based on createdAt + slaHours', () => {
        const created = new Date('2026-05-01T10:00:00-03:00');
        const result = getSlaDeadline({ createdAt: created.toISOString(), slaHours: 3 });
        expect(result).toEqual(new Date('2026-05-01T13:00:00-03:00'));
    });

    it('uses default 48h when slaHours is missing', () => {
        const created = new Date('2026-05-01T10:00:00-03:00');
        const result = getSlaDeadline({ createdAt: created.toISOString() });
        expect(result).toEqual(new Date('2026-05-03T10:00:00-03:00'));
    });

    it('returns null when createdAt is missing', () => {
        expect(getSlaDeadline({ slaHours: 3 })).toBeNull();
    });
});

describe('getSlaStatus', () => {
    const base = {
        createdAt: '2026-05-01T10:00:00-03:00',
        slaHours: 3,
        status: 'PENDING',
    };

    it('returns on_time when well within SLA', () => {
        const now = new Date('2026-05-01T11:00:00-03:00'); // 1h elapsed of 3h
        const result = getSlaStatus(base, now);
        expect(result.state).toBe('on_time');
        expect(result.remainingText).toBe('2h');
        expect(result.percentElapsed).toBeCloseTo(33.3, 0);
    });

    it('returns warning when in last 25% of SLA', () => {
        const now = new Date('2026-05-01T12:20:00-03:00'); // ~2h20m elapsed of 3h (>75%)
        const result = getSlaStatus(base, now);
        expect(result.state).toBe('warning');
        expect(result.remainingText).toMatch(/40min/);
    });

    it('returns overdue when past deadline', () => {
        const now = new Date('2026-05-01T14:00:00-03:00'); // 1h past
        const result = getSlaStatus(base, now);
        expect(result.state).toBe('overdue');
        expect(result.remainingText).toBe('Vencido há 1h');
        expect(result.remainingMs).toBeLessThan(0);
    });

    it('returns completed_on_time when done within SLA', () => {
        const done = {
            ...base,
            status: 'DONE',
            concludedAt: '2026-05-01T12:00:00-03:00', // 2h of 3h
            turnaroundHours: 2,
        };
        const result = getSlaStatus(done);
        expect(result.state).toBe('completed_on_time');
        expect(result.remainingText).toBe('Concluído em 2h');
    });

    it('returns completed_late when done past SLA', () => {
        const done = {
            ...base,
            status: 'DONE',
            concludedAt: '2026-05-01T15:00:00-03:00', // 5h of 3h
            turnaroundHours: 5,
        };
        const result = getSlaStatus(done);
        expect(result.state).toBe('completed_late');
        expect(result.remainingText).toBe('Atrasado 2h');
    });

    it('handles Firestore Timestamp objects', () => {
        const created = new Date('2026-05-01T10:00:00-03:00');
        const fsTimestamp = {
            toDate: () => created,
        };
        const result = getSlaStatus({ createdAt: fsTimestamp, slaHours: 3 });
        expect(result.deadline).toEqual(new Date('2026-05-01T13:00:00-03:00'));
    });

    it('returns no_sla when createdAt is missing', () => {
        const result = getSlaStatus({ slaHours: 3 });
        expect(result.state).toBe('no_sla');
        expect(result.remainingText).toBe('—');
    });
});

describe('getSlaColor', () => {
    it('maps states to colors correctly', () => {
        expect(getSlaColor('on_time')).toBe('green');
        expect(getSlaColor('completed_on_time')).toBe('green');
        expect(getSlaColor('warning')).toBe('yellow');
        expect(getSlaColor('overdue')).toBe('red');
        expect(getSlaColor('completed_late')).toBe('red');
        expect(getSlaColor('no_sla')).toBe('gray');
    });
});
