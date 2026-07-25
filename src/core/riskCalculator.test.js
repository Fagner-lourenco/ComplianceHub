import { describe, expect, it } from 'vitest';
import { calculateRisk, LEGACY_PHASES } from './riskCalculator';

// =============================================================================
// SYNC: Estes testes devem ser idênticos a functions/shared/riskCalculator.test.js.
// Garantem que as implementações CJS (backend) e ESM (frontend) produzem
// os mesmos resultados para os mesmos inputs.
// =============================================================================

describe('calculateRisk — creditRestriction (fase informativa)', () => {
    it('creditRestriction em enabledPhases nao altera o score', () => {
        const form = { criminalFlag: 'POSITIVE', criminalSeverity: 'HIGH', laborFlag: 'NEGATIVE' };
        const withCredit = calculateRisk(form, [...LEGACY_PHASES, 'creditRestriction']);
        const withoutCredit = calculateRisk(form, [...LEGACY_PHASES]);
        expect(withCredit).toEqual(withoutCredit);
    });
});

describe('calculateRisk — casos limpos', () => {
    it('tudo NEGATIVE sem CPF pendente → score 0, GREEN, FIT', () => {
        const r = calculateRisk({
            criminalFlag: 'NEGATIVE', laborFlag: 'NEGATIVE', warrantFlag: 'NEGATIVE',
        });
        expect(r.riskScore).toBe(0);
        expect(r.riskLevel).toBe('GREEN');
        expect(r.suggestedVerdict).toBe('FIT');
    });

    it('tudo NEGATIVE com CPF pendente → score 30, YELLOW, ATTENTION', () => {
        const r = calculateRisk({
            criminalFlag: 'NEGATIVE', laborFlag: 'NEGATIVE', warrantFlag: 'NEGATIVE',
            cpfPendingRegularization: true,
        });
        expect(r.riskScore).toBe(30);
        expect(r.riskLevel).toBe('YELLOW');
        expect(r.suggestedVerdict).toBe('ATTENTION');
    });

    it('CPF pendente sozinho (sem flags) → score 30, YELLOW, ATTENTION', () => {
        const r = calculateRisk({ cpfPendingRegularization: true });
        expect(r.riskScore).toBe(30);
        expect(r.riskLevel).toBe('YELLOW');
        expect(r.suggestedVerdict).toBe('ATTENTION');
    });

    it('CPF pendente false não altera resultado limpo', () => {
        const r = calculateRisk({ criminalFlag: 'NEGATIVE', cpfPendingRegularization: false });
        expect(r.riskScore).toBe(0);
        expect(r.riskLevel).toBe('GREEN');
        expect(r.suggestedVerdict).toBe('FIT');
    });
});

describe('calculateRisk — flags POSITIVE', () => {
    it('criminal POSITIVE (severity MEDIUM) → score 90, RED, NOT_RECOMMENDED', () => {
        const r = calculateRisk({ criminalFlag: 'POSITIVE', criminalSeverity: 'MEDIUM' });
        expect(r.riskScore).toBe(90);
        expect(r.riskLevel).toBe('RED');
        expect(r.suggestedVerdict).toBe('NOT_RECOMMENDED');
    });

    it('criminal POSITIVE (severity HIGH) → score 95, RED, NOT_RECOMMENDED', () => {
        const r = calculateRisk({ criminalFlag: 'POSITIVE', criminalSeverity: 'HIGH' });
        expect(r.riskScore).toBe(95);
        expect(r.riskLevel).toBe('RED');
        expect(r.suggestedVerdict).toBe('NOT_RECOMMENDED');
    });

    it('criminal POSITIVE (severity LOW) → score 75, RED, NOT_RECOMMENDED', () => {
        const r = calculateRisk({ criminalFlag: 'POSITIVE', criminalSeverity: 'LOW' });
        expect(r.riskScore).toBe(75);
        expect(r.riskLevel).toBe('RED');  // score >= 70 → RED (alinhado com NOT_RECOMMENDED)
        expect(r.suggestedVerdict).toBe('NOT_RECOMMENDED');
    });

    it('criminal POSITIVE sem severity → score 90, RED', () => {
        const r = calculateRisk({ criminalFlag: 'POSITIVE' });
        expect(r.riskScore).toBe(90);
        expect(r.riskLevel).toBe('RED');
    });

    it('labor POSITIVE → score 90, RED, NOT_RECOMMENDED', () => {
        const r = calculateRisk({ laborFlag: 'POSITIVE' });
        expect(r.riskScore).toBe(90);
        expect(r.riskLevel).toBe('RED');
        expect(r.suggestedVerdict).toBe('NOT_RECOMMENDED');
    });

    it('labor POSITIVE (severity LOW) → score 50, YELLOW, ATTENTION', () => {
        const r = calculateRisk({ laborFlag: 'POSITIVE', laborSeverity: 'LOW' });
        expect(r.riskScore).toBe(50);
        expect(r.riskLevel).toBe('YELLOW');
        expect(r.suggestedVerdict).toBe('ATTENTION');
    });

    it('labor POSITIVE (severity MEDIUM) → score 90, RED, NOT_RECOMMENDED', () => {
        const r = calculateRisk({ laborFlag: 'POSITIVE', laborSeverity: 'MEDIUM' });
        expect(r.riskScore).toBe(90);
        expect(r.riskLevel).toBe('RED');
        expect(r.suggestedVerdict).toBe('NOT_RECOMMENDED');
    });

    it('labor POSITIVE (severity HIGH) → score 95, RED, NOT_RECOMMENDED', () => {
        const r = calculateRisk({ laborFlag: 'POSITIVE', laborSeverity: 'HIGH' });
        expect(r.riskScore).toBe(95);
        expect(r.riskLevel).toBe('RED');
        expect(r.suggestedVerdict).toBe('NOT_RECOMMENDED');
    });

    // Regressão crítica: o bug da imagem (score 90 + riskLevel GREEN nunca pode ocorrer)
    it('NUNCA produz riskScore >= 80 com riskLevel GREEN', () => {
        const positiveInputs = [
            { criminalFlag: 'POSITIVE' },
            { laborFlag: 'POSITIVE' },
            { warrantFlag: 'POSITIVE' },
            { criminalFlag: 'POSITIVE', criminalSeverity: 'HIGH' },
            { criminalFlag: 'POSITIVE', criminalSeverity: 'LOW' },
        ];
        for (const input of positiveInputs) {
            const r = calculateRisk(input);
            expect(r.riskLevel, `${JSON.stringify(input)} gerou riskLevel GREEN com score ${r.riskScore}`).not.toBe('GREEN');
        }
    });
});

describe('calculateRisk — flags INCONCLUSIVE / cobertura parcial', () => {
    it('criminal INCONCLUSIVE sozinho → score 40, YELLOW, ATTENTION', () => {
        const r = calculateRisk({ criminalFlag: 'INCONCLUSIVE' });
        expect(r.riskScore).toBe(40);
        expect(r.riskLevel).toBe('YELLOW');
        expect(r.suggestedVerdict).toBe('ATTENTION');
    });

    it('criminal INCONCLUSIVE + labor INCONCLUSIVE → score 55 (40+15), YELLOW', () => {
        const r = calculateRisk({ criminalFlag: 'INCONCLUSIVE', laborFlag: 'INCONCLUSIVE' });
        expect(r.riskScore).toBe(55);
        expect(r.riskLevel).toBe('YELLOW');
    });

    it('NEGATIVE com cobertura parcial sozinho → score 0, GREEN, FIT', () => {
        const r = calculateRisk({ criminalFlag: 'NEGATIVE', criminalEvidenceQuality: 'NEGATIVE_WITH_PARTIAL_COVERAGE' });
        expect(r.riskScore).toBe(0);
        expect(r.riskLevel).toBe('GREEN');
        expect(r.suggestedVerdict).toBe('FIT');
    });

    it('criminal NEGATIVE com cobertura parcial + CPF pendente → score mínimo cadastral 30, YELLOW', () => {
        const r = calculateRisk({ criminalFlag: 'NEGATIVE', criminalEvidenceQuality: 'NEGATIVE_WITH_PARTIAL_COVERAGE', cpfPendingRegularization: true });
        expect(r.riskScore).toBe(30);
        expect(r.riskLevel).toBe('YELLOW');
        expect(r.suggestedVerdict).toBe('ATTENTION');
    });

    it('CPF pendente + criminal INCONCLUSIVE → score 55 (40+15), YELLOW', () => {
        const r = calculateRisk({ criminalFlag: 'INCONCLUSIVE', cpfPendingRegularization: true });
        expect(r.riskScore).toBe(55);
        expect(r.riskLevel).toBe('YELLOW');
        expect(r.suggestedVerdict).toBe('ATTENTION');
    });

    it('social CONCERN sozinho → score 50, YELLOW, ATTENTION', () => {
        const r = calculateRisk({ socialStatus: 'CONCERN' });
        expect(r.riskScore).toBe(50);
        expect(r.riskLevel).toBe('YELLOW');
        expect(r.suggestedVerdict).toBe('ATTENTION');
    });
});

describe('calculateRisk — fases habilitadas (enabledPhases)', () => {
    it('fase criminal desabilitada ignora criminalFlag', () => {
        const r = calculateRisk(
            { criminalFlag: 'POSITIVE' },
            ['labor', 'warrant'],
        );
        expect(r.riskScore).toBe(0);
        expect(r.riskLevel).toBe('GREEN');
    });

    it('fase labor desabilitada ignora laborFlag POSITIVE', () => {
        const r = calculateRisk(
            { criminalFlag: 'NEGATIVE', laborFlag: 'POSITIVE' },
            ['criminal'],
        );
        expect(r.riskScore).toBe(0);
    });

    it('enabledPhases vazio usa LEGACY_PHASES', () => {
        const r1 = calculateRisk({ criminalFlag: 'POSITIVE' }, []);
        const r2 = calculateRisk({ criminalFlag: 'POSITIVE' }, LEGACY_PHASES);
        expect(r1.riskScore).toBe(r2.riskScore);
        expect(r1.riskLevel).toBe(r2.riskLevel);
    });

    it('enabledPhases undefined usa LEGACY_PHASES', () => {
        const r1 = calculateRisk({ criminalFlag: 'POSITIVE' });
        const r2 = calculateRisk({ criminalFlag: 'POSITIVE' }, LEGACY_PHASES);
        expect(r1.riskScore).toBe(r2.riskScore);
    });
});

describe('calculateRisk — limites e consistência', () => {
    it('score não ultrapassa 100', () => {
        const r = calculateRisk({
            criminalFlag: 'INCONCLUSIVE', laborFlag: 'INCONCLUSIVE',
            warrantFlag: 'INCONCLUSIVE', osintLevel: 'MEDIUM',
            socialStatus: 'CONCERN', digitalFlag: 'ALERT',
            cpfPendingRegularization: true,
        });
        expect(r.riskScore).toBeLessThanOrEqual(100);
    });

    it('score nunca é negativo', () => {
        const r = calculateRisk({});
        expect(r.riskScore).toBeGreaterThanOrEqual(0);
    });

    it('riskLevel é sempre um dos três valores válidos', () => {
        const valid = ['GREEN', 'YELLOW', 'RED'];
        const cases = [
            {},
            { criminalFlag: 'POSITIVE' },
            { criminalFlag: 'NEGATIVE', cpfPendingRegularization: true },
            { criminalFlag: 'INCONCLUSIVE', laborFlag: 'INCONCLUSIVE' },
        ];
        for (const input of cases) {
            const r = calculateRisk(input);
            expect(valid).toContain(r.riskLevel);
        }
    });

    it('suggestedVerdict é sempre um dos três valores válidos', () => {
        const valid = ['FIT', 'ATTENTION', 'NOT_RECOMMENDED'];
        const cases = [
            {},
            { criminalFlag: 'POSITIVE' },
            { criminalFlag: 'NEGATIVE', cpfPendingRegularization: true },
            { osintLevel: 'MEDIUM', socialStatus: 'CONCERN' },
        ];
        for (const input of cases) {
            const r = calculateRisk(input);
            expect(valid).toContain(r.suggestedVerdict);
        }
    });

    it('RED implica NOT_RECOMMENDED', () => {
        const r = calculateRisk({ criminalFlag: 'POSITIVE' });
        if (r.riskLevel === 'RED') {
            expect(r.suggestedVerdict).toBe('NOT_RECOMMENDED');
        }
    });

    it('score >= 70 implica riskLevel RED não GREEN nem YELLOW', () => {
        const r = calculateRisk({ criminalFlag: 'POSITIVE', criminalSeverity: 'LOW' });
        expect(r.riskScore).toBe(75);
        expect(r.riskLevel).toBe('RED');
        expect(r.riskLevel).not.toBe('GREEN');
    });
});
