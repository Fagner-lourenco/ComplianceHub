import { describe, it, expect } from 'vitest';
import { diffRiskSignals, severityRank, signalKey } from './v2MonitoringDiff.js';

describe('v2MonitoringDiff', () => {
    describe('severityRank', () => {
        it('orders severities low<medium<high<critical', () => {
            expect(severityRank('low')).toBe(0);
            expect(severityRank('medium')).toBe(1);
            expect(severityRank('high')).toBe(2);
            expect(severityRank('critical')).toBe(3);
        });

        it('returns -1 for unknown severity', () => {
            expect(severityRank('bogus')).toBe(-1);
        });
    });

    describe('signalKey', () => {
        it('composes moduleKey::kind', () => {
            expect(signalKey({ moduleKey: 'criminal', kind: 'criminal_risk' })).toBe('criminal::criminal_risk');
        });

        it('handles missing fields', () => {
            expect(signalKey({})).toBe('unknown::generic');
        });
    });

    describe('diffRiskSignals', () => {
        const context = { tenantId: 't1', subjectId: 'subj1', caseId: 'case1', watchlistId: 'wl1' };

        it('returns no alerts when signals unchanged', () => {
            const prev = [{ id: 's1', moduleKey: 'criminal', kind: 'criminal_risk', severity: 'high' }];
            const curr = [{ id: 's2', moduleKey: 'criminal', kind: 'criminal_risk', severity: 'high' }];
            const alerts = diffRiskSignals({ previousSignals: prev, currentSignals: curr, context });
            expect(alerts).toHaveLength(0);
        });

        it('emits finding alert for brand-new signal', () => {
            const alerts = diffRiskSignals({
                previousSignals: [],
                currentSignals: [{ id: 's1', moduleKey: 'criminal', kind: 'criminal_risk', severity: 'high', reason: 'Achado criminal.' }],
                context,
            });
            expect(alerts).toHaveLength(1);
            expect(alerts[0]).toMatchObject({
                tenantId: 't1',
                subjectId: 'subj1',
                caseId: 'case1',
                watchlistId: 'wl1',
                kind: 'watchlist_finding',
                severity: 'high',
                moduleKey: 'criminal',
                signalKind: 'criminal_risk',
                previousSeverity: null,
                state: 'unread',
                signalId: 's1',
            });
            expect(alerts[0].message).toContain('high');
        });

        it('emits escalation alert when severity climbs', () => {
            const prev = [{ id: 's1', moduleKey: 'labor', kind: 'labor_risk', severity: 'low' }];
            const curr = [{ id: 's2', moduleKey: 'labor', kind: 'labor_risk', severity: 'high', reason: 'Escalada trabalhista.' }];
            const alerts = diffRiskSignals({ previousSignals: prev, currentSignals: curr, context });
            expect(alerts).toHaveLength(1);
            expect(alerts[0].kind).toBe('watchlist_escalation');
            expect(alerts[0].previousSeverity).toBe('low');
            expect(alerts[0].severity).toBe('high');
            expect(alerts[0].message).toMatch(/low/);
            expect(alerts[0].message).toMatch(/high/);
        });

        it('does not emit when severity de-escalates', () => {
            const prev = [{ id: 's1', moduleKey: 'labor', kind: 'labor_risk', severity: 'high' }];
            const curr = [{ id: 's2', moduleKey: 'labor', kind: 'labor_risk', severity: 'low' }];
            const alerts = diffRiskSignals({ previousSignals: prev, currentSignals: curr, context });
            expect(alerts).toHaveLength(0);
        });

        it('handles multiple signals independently', () => {
            const prev = [
                { id: 'p1', moduleKey: 'criminal', kind: 'criminal_risk', severity: 'medium' },
            ];
            const curr = [
                { id: 'c1', moduleKey: 'criminal', kind: 'criminal_risk', severity: 'critical' },
                { id: 'c2', moduleKey: 'sanctions', kind: 'sanctions_hit', severity: 'high' },
            ];
            const alerts = diffRiskSignals({ previousSignals: prev, currentSignals: curr, context });
            expect(alerts).toHaveLength(2);
            const byKind = new Map(alerts.map((a) => [a.moduleKey, a]));
            expect(byKind.get('criminal').kind).toBe('watchlist_escalation');
            expect(byKind.get('sanctions').kind).toBe('watchlist_finding');
        });

        it('keeps highest severity when duplicates share the same key', () => {
            const curr = [
                { id: 'a', moduleKey: 'warrant', kind: 'warrant_risk', severity: 'medium' },
                { id: 'b', moduleKey: 'warrant', kind: 'warrant_risk', severity: 'critical' },
            ];
            const alerts = diffRiskSignals({ previousSignals: [], currentSignals: curr, context });
            expect(alerts).toHaveLength(1);
            expect(alerts[0].severity).toBe('critical');
        });
    });
});
