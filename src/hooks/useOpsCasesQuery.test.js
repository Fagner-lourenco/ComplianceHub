import { describe, it, expect } from 'vitest';
import { computeDemoUrgencyRank } from './useOpsCasesQuery';

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
