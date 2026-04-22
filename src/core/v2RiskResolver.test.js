import { describe, expect, it } from 'vitest';
import { resolveV2Risk } from './v2RiskResolver';

describe('resolveV2Risk', () => {
    it('retorna risco GREEN zerado quando nao ha sinais', () => {
        const result = resolveV2Risk([]);
        expect(result.riskScore).toBe(0);
        expect(result.riskLevel).toBe('GREEN');
        expect(result.signalCount).toBe(0);
        expect(result.topSignals).toHaveLength(0);
    });

    it('retorna risco GREEN zerado para entrada invalida', () => {
        expect(resolveV2Risk(null).riskLevel).toBe('GREEN');
        expect(resolveV2Risk(undefined).riskLevel).toBe('GREEN');
    });

    it('classifica RED quando ha sinal critical', () => {
        const result = resolveV2Risk([
            { id: 's1', kind: 'warrant_risk', severity: 'critical', scoreImpact: 50 },
        ]);
        expect(result.riskLevel).toBe('RED');
        expect(result.riskScore).toBeGreaterThanOrEqual(50);
    });

    it('classifica RED quando score >= 80 mesmo sem critical', () => {
        const result = resolveV2Risk([
            { id: 's1', kind: 'criminal_risk', severity: 'high', scoreImpact: 85 },
        ]);
        expect(result.riskLevel).toBe('RED');
    });

    it('classifica YELLOW quando ha sinal high', () => {
        const result = resolveV2Risk([
            { id: 's1', kind: 'criminal_risk', severity: 'high', scoreImpact: 35 },
        ]);
        expect(result.riskLevel).toBe('YELLOW');
        expect(result.riskScore).toBeGreaterThanOrEqual(30);
    });

    it('classifica GREEN para sinal low com scoreImpact baixo', () => {
        const result = resolveV2Risk([
            { id: 's1', kind: 'kyc_risk', severity: 'low', scoreImpact: 5 },
        ]);
        expect(result.riskLevel).toBe('GREEN');
        expect(result.riskScore).toBeLessThan(30);
    });

    it('usa scoreImpact do sinal quando presente', () => {
        const result = resolveV2Risk([
            { id: 's1', kind: 'labor_risk', severity: 'medium', scoreImpact: 18 },
        ]);
        expect(result.riskScore).toBeGreaterThanOrEqual(18);
    });

    it('usa severityToMinScore como fallback quando scoreImpact ausente', () => {
        const result = resolveV2Risk([
            { id: 's1', kind: 'criminal_risk', severity: 'high' },
        ]);
        expect(result.riskScore).toBeGreaterThanOrEqual(60);
    });

    it('retorna no maximo 3 topSignals ordenados por severidade', () => {
        const result = resolveV2Risk([
            { id: 's1', kind: 'kyc_risk', severity: 'low', scoreImpact: 5 },
            { id: 's2', kind: 'warrant_risk', severity: 'critical', scoreImpact: 50 },
            { id: 's3', kind: 'criminal_risk', severity: 'high', scoreImpact: 35 },
            { id: 's4', kind: 'labor_risk', severity: 'medium', scoreImpact: 18 },
        ]);
        expect(result.topSignals).toHaveLength(3);
        expect(result.topSignals[0].severity).toBe('critical');
        expect(result.topSignals[1].severity).toBe('high');
        expect(result.signalCount).toBe(4);
    });

    it('nao ultrapassa 100 no riskScore', () => {
        const signals = Array.from({ length: 10 }, (_, i) => ({
            id: `s${i}`,
            kind: 'criminal_risk',
            severity: 'critical',
            scoreImpact: 90,
        }));
        const result = resolveV2Risk(signals);
        expect(result.riskScore).toBeLessThanOrEqual(100);
    });
});
