const {
    classifyRole,
    getRoleScoreImpact,
    isLowRiskRole,
    isHighRiskRole,
    normalizeSideForClassifier,
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
            ['REQUERIDO', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['REQUERIDO', 'Civil', 'DEFENDANT', 'MEDIUM'],
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
            ['EXECTDO', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['EXECTDA', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['EXECDO', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['EXECDA', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['RE', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['REU S', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['REU RE', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['AUTOR A DO FATO', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['AUTORA DO FATO', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['INDICIADO A', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['INDICIADA', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['INVESTIGADO A', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['INVESTIGADA', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['FLAGRANTEADA', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['DENUNCIADO', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['NOTICIADO', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['ACUSADO A', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['PROMOVIDO', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['PASSIVO', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['POLO PASSIVO', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['DEPRECADO', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['DEPRECADO A', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['INFRATOR', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['CORREU', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['REQUERENTES', 'Criminal', 'PLAINTIFF', 'LOW'],
            ['POLO ATIVO PRINCIPAL', 'Criminal', 'PLAINTIFF', 'LOW'],
            ['POLO ATIVO', 'Criminal', 'PLAINTIFF', 'LOW'],
            ['EXEQUENTE', 'Criminal', 'PLAINTIFF', 'LOW'],
            ['EXEQTE', 'Criminal', 'PLAINTIFF', 'LOW'],
            ['REQTE', 'Criminal', 'PLAINTIFF', 'LOW'],
            ['DEMANDANTE', 'Criminal', 'PLAINTIFF', 'LOW'],
            ['PROMOVENTE', 'Criminal', 'PLAINTIFF', 'LOW'],
            ['PARTE AUTORA', 'Criminal', 'PLAINTIFF', 'LOW'],
            ['RECTE', 'Criminal', 'PLAINTIFF', 'LOW'],
            ['AUTOR A', 'Criminal', 'PLAINTIFF', 'LOW'],
            ['AUTORA', 'Criminal', 'PLAINTIFF', 'LOW'],
            ['REU 2', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['REU 2º', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['REU A', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['RECORRIDA', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['RECORRIDO A', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['AGRAVADO A', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['APELADA', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['OFENSOR', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['EMBARGADO', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['EMBARGANTE', 'Criminal', 'DEFENDANT', 'HIGH'],
            ['AUTOR DO FATO VITIMA', 'Criminal', 'VICTIM', 'LOW'],
        ])('classifies real criminal role %s', (role, area, category, riskLevel) => {
            const result = classifyRole(role, area);
            expect(result.category).toBe(category);
            expect(result.riskLevel).toBe(riskLevel);
        });

        it.each([
            ['RECLAMANTE', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['AUTOR', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['AUTOR A', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['REQUERENTE', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['REQUERENTES', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['DEMANDANTE', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['PROMOVENTE', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['RECORRENTE', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['RECORRIDO', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['AGRAVANTE', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['AGRAVADO', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['AGRAVADO A', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['POLO ATIVO (PRINCIPAL)', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['REQTE', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['RECLAMADO', 'Trabalhista', 'DEFENDANT', 'LOW'],
            ['RÉU', 'Trabalhista', 'DEFENDANT', 'LOW'],
            ['REU RE', 'Trabalhista', 'DEFENDANT', 'LOW'],
            ['DEMANDADO', 'Trabalhista', 'DEFENDANT', 'LOW'],
            ['DEMANDADO A', 'Trabalhista', 'DEFENDANT', 'LOW'],
            ['POLO PASSIVO', 'Trabalhista', 'DEFENDANT', 'LOW'],
            ['REQDO', 'Trabalhista', 'DEFENDANT', 'LOW'],
            ['TESTEMUNHA', 'Trabalhista', 'WITNESS', 'IGNORE'],
            ['CONSIGNATARIO', 'Trabalhista', 'OTHER', 'IGNORE'],
            ['REPRESENTANTE', 'Trabalhista', 'OTHER', 'IGNORE'],
            ['DEPRECANTE', 'Trabalhista', 'AUTHORITY', 'IGNORE'],
            ['EMBARGADO', 'Trabalhista', 'DEFENDANT', 'LOW'],
            ['EMBARGANTE', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
            ['RECTE', 'Trabalhista', 'PLAINTIFF', 'HIGH'],
        ])('classifies real labor role %s', (role, area, category, riskLevel) => {
            const result = classifyRole(role, area);
            expect(result.category).toBe(category);
            expect(result.riskLevel).toBe(riskLevel);
        });

        it.each([
            ['VITIMA', 'Criminal', 'VICTIM', 'LOW'],
            ['V', 'Criminal', 'VICTIM', 'LOW'],
            ['TESTEMUNHA', 'Criminal', 'WITNESS', 'IGNORE'],
            ['TESTEMUNHA POLO PASSIVO', 'Criminal', 'WITNESS', 'IGNORE'],
            ['TESTEMUNHA DE ACUSACAO', 'Criminal', 'WITNESS', 'IGNORE'],
            ['ADVOGADO', 'Criminal', 'LAWYER', 'IGNORE'],
            ['ADVOGADO REQTE', 'Criminal', 'LAWYER', 'IGNORE'],
            ['TERCEIRO', 'Criminal', 'OTHER', 'IGNORE'],
            ['INTERESSADO', 'Criminal', 'OTHER', 'IGNORE'],
            ['INTERESSADAS', 'Criminal', 'OTHER', 'IGNORE'],
            ['AUTOR', 'Criminal', 'PLAINTIFF', 'LOW'],
            ['QUERELANTE', 'Criminal', 'PLAINTIFF', 'LOW'],
            ['ATIVO', 'Criminal', 'PLAINTIFF', 'LOW'],
            ['POLO ATIVO', 'Criminal', 'PLAINTIFF', 'LOW'],
            ['HERDEIRO', 'Criminal', 'OTHER', 'IGNORE'],
            ['INVENTARIANTE', 'Criminal', 'OTHER', 'IGNORE'],
            ['TERINTCER', 'Criminal', 'OTHER', 'IGNORE'],
            ['ESPOLIO REQUERIDO', 'Criminal', 'OTHER', 'IGNORE'],
            ['ALIMENTADO', 'Criminal', 'OTHER', 'IGNORE'],
            ['PARTES', 'Criminal', 'OTHER', 'IGNORE'],
        ])('mantem papel de baixo risco/ignorado %s', (role, area, category, riskLevel) => {
            const result = classifyRole(role, area);
            expect(result.category).toBe(category);
            expect(result.riskLevel).toBe(riskLevel);
        });

        describe('side/polo fallback', () => {
            it('classifies unknown passive role in criminal as DEFENDANT/HIGH', () => {
                const result = classifyRole('ENVOLVIDO', 'Criminal', 'Passive');
                expect(result.category).toBe('DEFENDANT');
                expect(result.riskLevel).toBe('HIGH');
            });

            it('classifies unknown active role in criminal as PLAINTIFF/LOW', () => {
                const result = classifyRole('REPRESENTADO', 'Criminal', 'Active');
                expect(result.category).toBe('PLAINTIFF');
                expect(result.riskLevel).toBe('LOW');
            });

            it('classifies unknown passive role in labor as DEFENDANT/LOW', () => {
                const result = classifyRole('LITISCONSORTE', 'Trabalhista', 'Passive');
                expect(result.category).toBe('DEFENDANT');
                expect(result.riskLevel).toBe('LOW');
            });

            it('classifies unknown active role in labor as PLAINTIFF/HIGH', () => {
                const result = classifyRole('REPRESENTADO', 'Trabalhista', 'Active');
                expect(result.category).toBe('PLAINTIFF');
                expect(result.riskLevel).toBe('HIGH');
            });

            it('does not fallback for witnesses', () => {
                const result = classifyRole('TESTEMUNHA POLO PASSIVO', 'Criminal', 'Passive');
                expect(result.category).toBe('WITNESS');
                expect(result.riskLevel).toBe('IGNORE');
            });

            it('does not fallback for victims', () => {
                const result = classifyRole('VITIMA DO FATO', 'Criminal', 'Passive');
                expect(result.category).toBe('VICTIM');
                expect(result.riskLevel).toBe('LOW');
            });

            it('does not fallback for lawyers', () => {
                const result = classifyRole('ADVOGADO REQTE', 'Criminal', 'Passive');
                expect(result.category).toBe('LAWYER');
                expect(result.riskLevel).toBe('IGNORE');
            });

            it('does not fallback for neutral roles', () => {
                const result = classifyRole('TERCEIRO INTERESSADO', 'Criminal', 'Passive');
                expect(result.category).toBe('OTHER');
                expect(result.riskLevel).toBe('IGNORE');
            });

            it('keeps UNKNOWN for neutral side', () => {
                const result = classifyRole('ENVOLVIDO', 'Criminal', 'Neutral');
                expect(result.category).toBe('UNKNOWN');
                expect(result.riskLevel).toBe('NEUTRAL');
            });

            it('keeps UNKNOWN when side is missing', () => {
                const result = classifyRole('ENVOLVIDO', 'Criminal');
                expect(result.category).toBe('UNKNOWN');
                expect(result.riskLevel).toBe('NEUTRAL');
            });

            it('normalizes BDC polo values', () => {
                const result = classifyRole('REPRESENTADO', 'Criminal', 'PASSIVE');
                expect(result.category).toBe('DEFENDANT');
                expect(result.riskLevel).toBe('HIGH');
            });

            it('normalizes active BDC polo values', () => {
                const result = classifyRole('REPRESENTADO', 'Trabalhista', 'ACTIVE');
                expect(result.category).toBe('PLAINTIFF');
                expect(result.riskLevel).toBe('HIGH');
            });

            it('known defendant with active side still returns DEFENDANT/HIGH', () => {
                const result = classifyRole('REU', 'Criminal', 'Active');
                expect(result.category).toBe('DEFENDANT');
                expect(result.riskLevel).toBe('HIGH');
            });

            it('accented side values work', () => {
                const result = classifyRole('ENVOLVIDO', 'Criminal', 'Passivo');
                expect(result.category).toBe('DEFENDANT');
                expect(result.riskLevel).toBe('HIGH');
            });

            it('null/undefined side is treated as missing', () => {
                const result = classifyRole('ENVOLVIDO', 'Criminal', null);
                expect(result.category).toBe('UNKNOWN');
                expect(result.riskLevel).toBe('NEUTRAL');
            });

            it('whitespace-trimmed side works', () => {
                const result = classifyRole('ENVOLVIDO', 'Criminal', '  Passive  ');
                expect(result.category).toBe('DEFENDANT');
                expect(result.riskLevel).toBe('HIGH');
            });
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

    describe('normalizeSideForClassifier', () => {
        it('normalizes P to Passive', () => {
            expect(normalizeSideForClassifier('P')).toBe('Passive');
        });

        it('normalizes A to Active', () => {
            expect(normalizeSideForClassifier('A')).toBe('Active');
        });

        it('normalizes Passivo to Passive', () => {
            expect(normalizeSideForClassifier('Passivo')).toBe('Passive');
        });

        it('normalizes Ativo to Active', () => {
            expect(normalizeSideForClassifier('Ativo')).toBe('Active');
        });

        it('returns raw value for unknown side', () => {
            expect(normalizeSideForClassifier('Unknown')).toBe('Unknown');
        });

        it('returns null for empty side', () => {
            expect(normalizeSideForClassifier('')).toBeNull();
        });

        it('does not match impassive as passive', () => {
            expect(normalizeSideForClassifier('impassive')).toBe('impassive');
        });

        it('does not match inativo as active', () => {
            expect(normalizeSideForClassifier('inativo')).toBe('inativo');
        });
    });
});
