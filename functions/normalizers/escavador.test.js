const { normalizeEscavadorProcessos } = require('./escavador');

describe('normalizeEscavadorProcessos side fallback', () => {
    it('classifies unknown role with polo P as DEFENDANT/HIGH in criminal', () => {
        const result = normalizeEscavadorProcessos({
            envolvido: { quantidade_processos: 1 },
            items: [{
                numero_cnj: '0000000-00.0000.0.00.0000',
                data_inicio: '2024-01-01',
                fontes: [{
                    capa: { area: 'Direito Penal', classe: 'Ação Penal' },
                    envolvidos: [{
                        cpf: '12345678900',
                        tipo: 'ENVOLVIDO',
                        tipo_normalizado: 'ENVOLVIDO',
                        polo: 'P',
                    }],
                }],
            }],
            totalPages: 1,
        }, '12345678900');

        expect(result.escavadorProcessos).toHaveLength(1);
        expect(result.escavadorProcessos[0].roleClassification).toEqual({
            category: 'DEFENDANT',
            riskLevel: 'HIGH',
            reason: expect.stringContaining('lado passivo'),
        });
        expect(result.escavadorProcessos[0].isDefendant).toBe(true);
    });

    it('classifies unknown role with polo A as PLAINTIFF/LOW in criminal', () => {
        const result = normalizeEscavadorProcessos({
            envolvido: { quantidade_processos: 1 },
            items: [{
                numero_cnj: '0000000-00.0000.0.00.0000',
                data_inicio: '2024-01-01',
                fontes: [{
                    capa: { area: 'Direito Penal', classe: 'Ação Penal' },
                    envolvidos: [{
                        cpf: '12345678900',
                        tipo: 'ENVOLVIDO',
                        tipo_normalizado: 'ENVOLVIDO',
                        polo: 'A',
                    }],
                }],
            }],
            totalPages: 1,
        }, '12345678900');

        expect(result.escavadorProcessos[0].roleClassification).toEqual({
            category: 'PLAINTIFF',
            riskLevel: 'LOW',
            reason: expect.stringContaining('lado ativo'),
        });
        expect(result.escavadorProcessos[0].isPlaintiff).toBe(true);
    });
});
