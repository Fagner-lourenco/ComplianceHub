import { describe, it, expect } from 'vitest';
import {
    computeProgress,
    resolveRiskBucket,
    maxSeverity,
    buildModuleCards,
    deriveStatusMessage,
    isAnalysisComplete,
    moduleDisplay,
} from './analysisProgress';

describe('analysisProgress', () => {
    describe('computeProgress', () => {
        it('returns 100 when case is DONE', () => {
            expect(computeProgress({ caseData: { status: 'DONE' }, moduleRuns: [] })).toBe(100);
        });

        it('returns baseline when no moduleRuns yet', () => {
            expect(computeProgress({ caseData: { status: 'PENDING' } })).toBe(6);
            expect(computeProgress({ caseData: null })).toBe(3);
        });

        it('ignores not_entitled modules', () => {
            const moduleRuns = [
                { moduleKey: 'a', status: 'not_entitled' },
                { moduleKey: 'b', status: 'completed_no_findings' },
                { moduleKey: 'c', status: 'running' },
            ];
            const progress = computeProgress({ caseData: { status: 'IN_PROGRESS' }, moduleRuns });
            // 1 terminal + 0.5 running of 2 executable = 75%
            expect(progress).toBe(75);
        });

        it('caps running-only scenarios below 100', () => {
            const moduleRuns = [
                { moduleKey: 'a', status: 'running' },
                { moduleKey: 'b', status: 'running' },
            ];
            expect(computeProgress({ caseData: { status: 'IN_PROGRESS' }, moduleRuns })).toBe(50);
        });

        it('does not return 100 unless DONE', () => {
            const moduleRuns = [
                { moduleKey: 'a', status: 'completed_no_findings' },
                { moduleKey: 'b', status: 'completed_with_findings' },
            ];
            expect(computeProgress({ caseData: { status: 'IN_PROGRESS' }, moduleRuns })).toBe(99);
        });
    });

    describe('resolveRiskBucket', () => {
        it('defaults to low when no signals', () => {
            expect(resolveRiskBucket()).toMatchObject({ key: 'low' });
        });

        it('promotes to attention on medium', () => {
            expect(resolveRiskBucket({ riskSignals: [{ severity: 'medium' }] })).toMatchObject({ key: 'attention' });
        });

        it('promotes to moderate on high', () => {
            expect(resolveRiskBucket({ riskSignals: [{ severity: 'high' }, { severity: 'low' }] })).toMatchObject({ key: 'moderate' });
        });

        it('promotes to high on critical', () => {
            expect(resolveRiskBucket({ riskSignals: [{ severity: 'critical' }] })).toMatchObject({ key: 'high' });
        });
    });

    describe('maxSeverity', () => {
        it('returns numeric rank from signals', () => {
            expect(maxSeverity([{ severity: 'low' }, { severity: 'high' }])).toBe(3);
            expect(maxSeverity([])).toBe(0);
        });
    });

    describe('buildModuleCards', () => {
        it('hides not_entitled and translates statuses', () => {
            const cards = buildModuleCards({
                moduleRuns: [
                    { moduleKey: 'identity_pf', status: 'completed_no_findings' },
                    { moduleKey: 'criminal', status: 'running' },
                    { moduleKey: 'kyc', status: 'not_entitled' },
                    { moduleKey: 'labor', status: 'completed_with_findings' },
                ],
                riskSignals: [
                    { moduleKey: 'labor', severity: 'medium', reason: 'Achado trabalhista' },
                ],
            });
            expect(cards).toHaveLength(3);
            expect(cards.find((c) => c.moduleKey === 'criminal').uiState).toBe('running');
            expect(cards.find((c) => c.moduleKey === 'identity_pf').uiState).toBe('ok');
            const laborCard = cards.find((c) => c.moduleKey === 'labor');
            expect(laborCard.uiState).toBe('watch');
            expect(laborCard.topSignalReason).toBe('Achado trabalhista');
        });

        it('maps blocked/failed/reused to distinct states', () => {
            const cards = buildModuleCards({
                moduleRuns: [
                    { moduleKey: 'criminal', status: 'blocked' },
                    { moduleKey: 'labor', status: 'failed_final' },
                    { moduleKey: 'kyc', status: 'skipped_reuse' },
                ],
            });
            const byKey = Object.fromEntries(cards.map((c) => [c.moduleKey, c]));
            expect(byKey.criminal.uiState).toBe('blocked');
            expect(byKey.labor.uiState).toBe('failed');
            expect(byKey.kyc.uiState).toBe('reused');
        });
    });

    describe('deriveStatusMessage', () => {
        it('reflects DONE with risk bucket label', () => {
            const msg = deriveStatusMessage({
                progress: 100,
                caseData: { status: 'DONE' },
                riskSignals: [{ severity: 'high' }],
            });
            expect(msg.toLowerCase()).toContain('concluida');
            expect(msg.toLowerCase()).toContain('risco moderado');
        });

        it('handles CORRECTION_NEEDED', () => {
            expect(deriveStatusMessage({ progress: 20, caseData: { status: 'CORRECTION_NEEDED' } }))
                .toMatch(/devolvida/i);
        });

        it('escalates copy as progress grows', () => {
            expect(deriveStatusMessage({ progress: 5 })).toMatch(/iniciando/i);
            expect(deriveStatusMessage({ progress: 40, moduleRuns: [{ status: 'running' }, { status: 'running' }] })).toMatch(/paralelo/i);
            expect(deriveStatusMessage({ progress: 70, riskSignals: [{ severity: 'medium' }] })).toMatch(/sinal/i);
            expect(deriveStatusMessage({ progress: 96 })).toMatch(/finalizando/i);
        });
    });

    describe('isAnalysisComplete', () => {
        it('returns true only when status DONE', () => {
            expect(isAnalysisComplete({ status: 'DONE' })).toBe(true);
            expect(isAnalysisComplete({ status: 'IN_PROGRESS' })).toBe(false);
            expect(isAnalysisComplete(null)).toBe(false);
        });
    });

    describe('moduleDisplay', () => {
        it('falls back to raw key', () => {
            expect(moduleDisplay('unknown')).toMatchObject({ title: 'unknown' });
            expect(moduleDisplay('criminal').title).toBe('Criminal');
        });
    });
});
