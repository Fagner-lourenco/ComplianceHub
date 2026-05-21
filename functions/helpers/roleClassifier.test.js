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

        it.each([
            ['RÉU', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['REU/RE', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['ACUSADO(A)', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['DENUNCIADO(A)', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['AUTOR DO FATO', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['AUTOR FATO', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['AUTUADO', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['FLAGRANTEADO(A)', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['SENTENCIADO', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['APELANTE', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['APELADO', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['RECORRENTE', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['RECORRIDO', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['PACIENTE', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['VÍTIMA', 'Criminal', 'VICTIM', 'LOW'],
            ['VÍTIMA DO FATO', 'Criminal', 'VICTIM', 'LOW'],
            ['OFENDIDO', 'Criminal', 'VICTIM', 'LOW'],
            ['TESTEMUNHA DO JUÍZO', 'Criminal', 'WITNESS', 'IGNORE'],
            ['TESTEMUNHA - POLO ATIVO', 'Criminal', 'WITNESS', 'IGNORE'],
            ['REQUERENTE', 'Criminal', 'PLAINTIFF', 'LOW'],
            ['IMPETRANTE', 'Criminal', 'PLAINTIFF', 'LOW'],
        ])('classifies real criminal role %s', (role, area, category, riskLevel) => {
            const result = classifyRole(role, area);
            expect(result.category).toBe(category);
            expect(result.riskLevel).toBe(riskLevel);
        });

        it.each([
            ['RECLAMANTE', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['AUTOR', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['RECORRENTE', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['RECORRIDO', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['AGRAVANTE', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['AGRAVADO', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['POLO ATIVO (PRINCIPAL)', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['REQTE', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['RECLAMADO', 'Trabalhista', 'DEFENDANT', 'LOW'],
            ['RÉU', 'Trabalhista', 'DEFENDANT', 'LOW'],
            ['POLO PASSIVO', 'Trabalhista', 'DEFENDANT', 'LOW'],
            ['REQDO', 'Trabalhista', 'DEFENDANT', 'LOW'],
            ['TESTEMUNHA', 'Trabalhista', 'WITNESS', 'IGNORE'],
        ])('classifies real labor role %s', (role, area, category, riskLevel) => {
            const result = classifyRole(role, area);
            expect(result.category).toBe(category);
            expect(result.riskLevel).toBe(riskLevel);
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
