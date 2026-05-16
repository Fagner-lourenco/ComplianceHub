const {
    classifyRole,
    getRoleScoreImpact,
    isLowRiskRole,
    isHighRiskRole,
} = require('./roleClassifier');

describe('roleClassifier', () => {
    describe('classifyRole', () => {
        it('classifies criminal defendant as HIGH risk', () => {
            const result = classifyRole('Reu', 'Criminal');
            expect(result.category).toBe('DEFENDANT');
            expect(result.riskLevel).toBe('HIGH');
        });

        it('classifies criminal victim as LOW risk', () => {
            const result = classifyRole('Vitima', 'Criminal');
            expect(result.category).toBe('VICTIM');
            expect(result.riskLevel).toBe('LOW');
        });

        it('classifies labor plaintiff as HIGH risk', () => {
            const result = classifyRole('Reclamante', 'Trabalhista');
            expect(result.category).toBe('PLAINTIFF');
            expect(result.riskLevel).toBe('HIGH');
        });

        it('classifies labor defendant as LOW risk', () => {
            const result = classifyRole('Reclamado', 'Trabalhista');
            expect(result.category).toBe('DEFENDANT');
            expect(result.riskLevel).toBe('LOW');
        });

        it('classifies witness as IGNORE', () => {
            const result = classifyRole('Testemunha', 'Criminal');
            expect(result.category).toBe('WITNESS');
            expect(result.riskLevel).toBe('IGNORE');
        });

        it('classifies lawyer as IGNORE', () => {
            const result = classifyRole('Advogado', 'Civil');
            expect(result.category).toBe('LAWYER');
            expect(result.riskLevel).toBe('IGNORE');
        });

        it('classifies civil defendant as MEDIUM risk', () => {
            const result = classifyRole('Reu', 'Civil');
            expect(result.category).toBe('DEFENDANT');
            expect(result.riskLevel).toBe('MEDIUM');
        });

        it('classifies civil plaintiff as LOW risk', () => {
            const result = classifyRole('Autor', 'Civil');
            expect(result.category).toBe('PLAINTIFF');
            expect(result.riskLevel).toBe('LOW');
        });

        it('is conservative with unknown area', () => {
            const result = classifyRole('Autor', '');
            expect(result.riskLevel).toBe('NEUTRAL');
        });

        it('handles null/empty roles', () => {
            expect(classifyRole(null, 'Criminal').riskLevel).toBe('NEUTRAL');
            expect(classifyRole('', 'Criminal').riskLevel).toBe('NEUTRAL');
        });
    });

    describe('getRoleScoreImpact', () => {
        it('returns include=false for IGNORE roles', () => {
            const result = getRoleScoreImpact('Testemunha', 'Criminal');
            expect(result.include).toBe(false);
            expect(result.score).toBe(0);
        });

        it('returns HIGH score for criminal defendant', () => {
            const result = getRoleScoreImpact('Reu', 'Criminal');
            expect(result.include).toBe(true);
            expect(result.score).toBe(90);
            expect(result.flag).toBe('POSITIVE');
        });

        it('returns HIGH score for labor plaintiff', () => {
            const result = getRoleScoreImpact('Reclamante', 'Trabalhista');
            expect(result.include).toBe(true);
            expect(result.score).toBe(90);
            expect(result.flag).toBe('POSITIVE');
        });

        it('returns LOW score for labor defendant', () => {
            const result = getRoleScoreImpact('Reclamado', 'Trabalhista');
            expect(result.include).toBe(true);
            expect(result.score).toBe(0);
            expect(result.flag).toBe('NEGATIVE');
        });
    });

    describe('isLowRiskRole', () => {
        it('returns true for victim', () => {
            expect(isLowRiskRole('Vitima', 'Criminal')).toBe(true);
        });

        it('returns true for witness', () => {
            expect(isLowRiskRole('Testemunha', 'Criminal')).toBe(true);
        });

        it('returns false for criminal defendant', () => {
            expect(isLowRiskRole('Reu', 'Criminal')).toBe(false);
        });
    });

    describe('isHighRiskRole', () => {
        it('returns true for criminal defendant', () => {
            expect(isHighRiskRole('Reu', 'Criminal')).toBe(true);
        });

        it('returns true for labor plaintiff', () => {
            expect(isHighRiskRole('Reclamante', 'Trabalhista')).toBe(true);
        });

        it('returns false for victim', () => {
            expect(isHighRiskRole('Vitima', 'Criminal')).toBe(false);
        });
    });
});
