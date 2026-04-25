import { describe, it, expect } from 'vitest';
import {
    FRESHNESS_TTL_DAYS,
    DEFAULT_TTL_DAYS,
    getFreshnessPolicy,
    isSnapshotFresh,
    shouldReuseSnapshot,
} from './v2FreshnessPolicy.js';

const DAY = 86_400_000;

describe('v2FreshnessPolicy', () => {
    describe('getFreshnessPolicy', () => {
        it('retorna TTL correto para moduleKey conhecido', () => {
            expect(getFreshnessPolicy('identity').ttlDays).toBe(30);
            expect(getFreshnessPolicy('warrant').ttlDays).toBe(1);
            expect(getFreshnessPolicy('criminal').ttlDays).toBe(7);
        });

        it('retorna TTL default para moduleKey desconhecido', () => {
            const policy = getFreshnessPolicy('unknown_module');
            expect(policy.ttlDays).toBe(DEFAULT_TTL_DAYS);
            expect(policy.ttlMs).toBe(DEFAULT_TTL_DAYS * DAY);
        });

        it('retorna ttlMs = ttlDays * DAY', () => {
            const policy = getFreshnessPolicy('sanctions');
            expect(policy.ttlMs).toBe(policy.ttlDays * DAY);
        });

        it('FRESHNESS_TTL_DAYS cobre modulos criticos com TTL <= 1 dia', () => {
            expect(FRESHNESS_TTL_DAYS.warrant).toBe(1);
            expect(FRESHNESS_TTL_DAYS.sanctions).toBe(1);
            expect(FRESHNESS_TTL_DAYS.pep).toBe(1);
        });
    });

    describe('isSnapshotFresh', () => {
        it('retorna true para snapshot dentro do TTL', () => {
            const now = Date.now();
            const snapshot = { capturedAt: { seconds: Math.floor((now - 12 * 60 * 60 * 1000) / 1000) } };
            expect(isSnapshotFresh(snapshot, 'warrant', now)).toBe(true);
        });

        it('retorna false para snapshot alem do TTL', () => {
            const now = Date.now();
            const snapshot = { capturedAt: { seconds: Math.floor((now - 2 * DAY) / 1000) } };
            expect(isSnapshotFresh(snapshot, 'warrant', now)).toBe(false);
        });

        it('usa createdAt quando capturedAt ausente', () => {
            const now = Date.now();
            const snapshot = { createdAt: new Date(now - 3 * DAY).toISOString() };
            expect(isSnapshotFresh(snapshot, 'identity', now)).toBe(true);
            expect(isSnapshotFresh(snapshot, 'warrant', now)).toBe(false);
        });

        it('retorna false para snapshot null/undefined', () => {
            expect(isSnapshotFresh(null, 'criminal')).toBe(false);
            expect(isSnapshotFresh(undefined, 'criminal')).toBe(false);
        });

        it('retorna false quando timestamp invalido', () => {
            const snapshot = { capturedAt: 'nao-e-data' };
            expect(isSnapshotFresh(snapshot, 'criminal')).toBe(false);
        });
    });

    describe('shouldReuseSnapshot', () => {
        it('retorna true para snapshot fresco com status valido', () => {
            const now = Date.now();
            const snapshot = { capturedAt: { seconds: Math.floor((now - 6 * 60 * 60 * 1000) / 1000) }, status: 'SUCCESS' };
            expect(shouldReuseSnapshot(snapshot, 'criminal', now)).toBe(true);
        });

        it('retorna false para snapshot com status ERROR mesmo fresco', () => {
            const now = Date.now();
            const snapshot = { capturedAt: { seconds: Math.floor(now / 1000) }, status: 'ERROR' };
            expect(shouldReuseSnapshot(snapshot, 'criminal', now)).toBe(false);
        });

        it('retorna false para snapshot com status PENDING', () => {
            const now = Date.now();
            const snapshot = { capturedAt: { seconds: Math.floor(now / 1000) }, status: 'PENDING' };
            expect(shouldReuseSnapshot(snapshot, 'criminal', now)).toBe(false);
        });

        it('retorna false para snapshot null', () => {
            expect(shouldReuseSnapshot(null, 'criminal')).toBe(false);
        });

        it('retorna false para snapshot expirado com status SUCCESS', () => {
            const now = Date.now();
            const snapshot = { capturedAt: { seconds: Math.floor((now - 10 * DAY) / 1000) }, status: 'SUCCESS' };
            expect(shouldReuseSnapshot(snapshot, 'criminal', now)).toBe(false);
        });
    });
});
