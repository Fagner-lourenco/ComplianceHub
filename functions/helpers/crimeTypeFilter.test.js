import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
    isExcludedCrimeType,
    hasIdentifiableClassOrSubject,
    hasCriminalIndicator,
    TRANSITO,
    AMBIENTAL,
    HTE,
    CARTA_PRECATORIA_NOISE,
    CONSUMER_CIVIL_NOISE,
} = require('./crimeTypeFilter');

const baseProcess = { area: 'CRIMINAL', classe: 'ACAO PENAL', assunto: 'ROUBO' };

describe('isExcludedCrimeType', () => {
    it('returns null for a normal criminal process', () => {
        expect(isExcludedCrimeType(baseProcess)).toBeNull();
    });

    it('does not exclude drug personal use (art. 28) in flagrante context', () => {
        expect(isExcludedCrimeType({
            area: 'CRIMINAL',
            classe: 'AUTO DE PRISAO EM FLAGRANTE',
            assunto: 'Posse de Drogas para Consumo Pessoal (Lei 11.343/06, art. 28)',
        })).toBeNull();
    });

    it('detects transito by Lei 9.503', () => {
        expect(isExcludedCrimeType({
            area: 'CRIMINAL',
            classe: 'Infracao de Transito',
            assunto: 'Embriaguez ao Volante (Lei 9.503/97, art. 306)',
        })).toBe(TRANSITO);
    });

    it('does NOT detect transito for HOMICIDIO even with CTB', () => {
        expect(isExcludedCrimeType({
            area: 'CRIMINAL',
            classe: 'ACAO PENAL',
            assunto: 'HOMICIDIO no transito (Lei 9.503/97, art. 302)',
        })).toBeNull();
    });

    it('detects ambiental by Lei 9.605', () => {
        expect(isExcludedCrimeType({
            area: 'CRIMINAL',
            classe: 'Crime Ambiental',
            assunto: 'Lei 9.605/98',
        })).toBe(AMBIENTAL);
    });

    it('detects HTE by classe', () => {
        expect(isExcludedCrimeType({ area: 'LABOR', classe: 'HOMOLOGACAO DA TRANSACAO EXTRAJUDICIAL' })).toBe(HTE);
    });

    it('detects carta precatoria noise', () => {
        expect(isExcludedCrimeType({
            area: 'CRIMINAL',
            classe: 'CARTA PRECATORIA CRIMINAL',
            assunto: 'INTIMACAO de testemunha',
        })).toBe(CARTA_PRECATORIA_NOISE);
    });

    it('does not exclude drug personal use (art. 28) by assunto', () => {
        expect(isExcludedCrimeType({
            area: 'CRIMINAL',
            classe: 'TERMO CIRCUNSTANCIADO',
            assunto: 'Posse de Drogas para Consumo Pessoal',
        })).toBeNull();
    });

    it('detects consumer/civil noise (Escavador2 mis-flags as criminal)', () => {
        expect(isExcludedCrimeType({
            area: 'CRIMINAL',
            classe: 'PROCEDIMENTO COMUM CIVEL',
            assunto: 'Indenizacao por Dano - Acidente de Transito',
        })).toBe(CONSUMER_CIVIL_NOISE);
    });

    it('detects JECriminal as consumer/civil', () => {
        expect(isExcludedCrimeType({
            area: 'CRIMINAL',
            classe: 'JUIZADO ESPECIAL CIVEL',
            assunto: 'Cobranca indevida',
        })).toBe(CONSUMER_CIVIL_NOISE);
    });

    it('inspects subjects[] array as fallback', () => {
        expect(isExcludedCrimeType({
            area: 'CRIMINAL',
            classe: 'ACAO PENAL',
            subjects: ['Lei 9.605/98'],
        })).toBe(AMBIENTAL);
    });

    it('does not exclude drug personal use from classifications[] fallback', () => {
        expect(isExcludedCrimeType({
            area: 'CRIMINAL',
            classifications: ['Posse de Drogas para Consumo Pessoal'],
        })).toBeNull();
    });

    it('returns null for empty process', () => {
        expect(isExcludedCrimeType({})).toBeNull();
    });

    it('does not treat genuine criminal case as consumer noise when a criminal indicator is present', () => {
        // "Estelionato / Cartao de Credito" — crime real cuja modalidade cita
        // termo de consumo; nao pode ser descartado como ruido civel.
        expect(isExcludedCrimeType({
            area: 'CRIMINAL',
            classe: 'Acao Penal',
            assunto: 'Estelionato / Cartao de Credito',
        })).toBeNull();
        expect(isExcludedCrimeType({
            area: 'CRIMINAL',
            classe: 'Inquerito Policial',
            assunto: 'Roubo / Cobranca',
        })).toBeNull();
    });

    it('returns null when only area is CRIMINAL with no transito/ambiental markers', () => {
        expect(isExcludedCrimeType({
            area: 'CRIMINAL',
            classe: 'ACAO PENAL',
            assunto: 'Roubo Majorado',
        })).toBeNull();
    });

    it('detects Execucao Fiscal / IPTU as consumer/civil', () => {
        expect(isExcludedCrimeType({
            area: 'CRIMINAL',
            classe: '1116 - Execucao Fiscal',
            assunto: '5952 - IPTU/ Imposto Predial e Territorial Urbano',
        })).toBe(CONSUMER_CIVIL_NOISE);
    });

    it('detects Alienacao Fiduciaria as consumer/civil', () => {
        expect(isExcludedCrimeType({
            area: 'CRIMINAL',
            classe: '81 - Busca e Apreensao em Alienacao Fiduciaria',
            assunto: '9582 - Alienacao Fiduciaria',
        })).toBe(CONSUMER_CIVIL_NOISE);
    });

    it('detects Prisao Civil / Alimentos as consumer/civil', () => {
        expect(isExcludedCrimeType({
            area: 'CRIMINAL',
            classe: 'Cumprimento Provisorio de Sentenca',
            assunto: 'DIREITO PROCESSUAL CIVIL E DO TRABALHO - Prisao Civil - Alimentos',
        })).toBe(CONSUMER_CIVIL_NOISE);
    });

    it('detects Peticao Civel generic as consumer/civil', () => {
        expect(isExcludedCrimeType({
            area: 'CRIMINAL',
            classe: '241 - Peticao Civel',
            assunto: '9582 - Alienacao Fiduciaria',
        })).toBe(CONSUMER_CIVIL_NOISE);
    });
});

describe('hasCriminalIndicator', () => {
    it('returns false for Execucao Fiscal / IPTU', () => {
        expect(hasCriminalIndicator({ area: 'CRIMINAL', classe: 'Execucao Fiscal', assunto: 'IPTU' })).toBe(false);
    });

    it('returns false for Alienacao Fiduciaria', () => {
        expect(hasCriminalIndicator({ area: 'CRIMINAL', classe: 'Busca e Apreensao', assunto: 'Alienacao Fiduciaria' })).toBe(false);
    });

    it('returns true for Ameaca (real criminal)', () => {
        expect(hasCriminalIndicator({ area: 'CRIMINAL', classe: 'Juizado Especial Criminal', assunto: 'Ameaca' })).toBe(true);
    });

    it('returns true for Trafico de Drogas', () => {
        expect(hasCriminalIndicator({ area: 'CRIMINAL', classe: 'Lei Antitoxicos', assunto: 'Trafico de Drogas' })).toBe(true);
    });

    it('returns true for Acao Penal / Roubo', () => {
        expect(hasCriminalIndicator({ area: 'CRIMINAL', classe: 'Acao Penal', assunto: 'Roubo' })).toBe(true);
    });

    it('returns true for Lesao Corporal', () => {
        expect(hasCriminalIndicator({ area: 'CRIMINAL', classe: 'Acao Penal', assunto: 'Lesao Corporal' })).toBe(true);
    });

    it('returns false for Alimentos / Pensao Alimenticia', () => {
        expect(hasCriminalIndicator({ area: 'CRIMINAL', classe: 'Alimentos - Lei Especial', assunto: 'Fixacao' })).toBe(false);
    });
});

describe('hasIdentifiableClassOrSubject', () => {
    it('returns true when classe and assunto are real', () => {
        expect(hasIdentifiableClassOrSubject({
            classe: 'ACAO PENAL',
            assunto: 'ROUBO',
        })).toBe(true);
    });

    it('returns true when only subjects[] is present', () => {
        expect(hasIdentifiableClassOrSubject({
            classifications: ['ACAO PENAL'],
        })).toBe(true);
    });

    it('returns false when classe=PROCESSO and assunto=SEM ASSUNTO', () => {
        expect(hasIdentifiableClassOrSubject({
            classe: 'PROCESSO',
            assunto: 'SEM ASSUNTO',
        })).toBe(false);
    });

    it('returns false for empty process', () => {
        expect(hasIdentifiableClassOrSubject({})).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Inversao da politica de crime (decisao do produto, 2026-09):
// crime e TUDO que a fonte classifica como criminal, EXCETO as exclusoes
// taxativas. A lista CRIMINAL_INDICATOR_PATTERN deixa de ser o portao de
// entrada e passa a ser o desempate contra o ruido civel/consumo.
// ─────────────────────────────────────────────────────────────────────────────
describe('politica: pegar todo e qualquer crime, so com excecoes taxativas', () => {
    describe('crimes que hoje escapam da lista branca', () => {
        const crimesQueDevemSerReconhecidos = [
            ['Acao Penal', 'Apropriacao Indebita'],
            ['Acao Penal', 'Falsidade Ideologica'],
            ['Acao Penal', 'Uso de Documento Falso'],
            ['Acao Penal', 'Peculato'],
            ['Acao Penal', 'Corrupcao Passiva'],
            ['Acao Penal', 'Lavagem de Dinheiro'],
            ['Acao Penal', 'Organizacao Criminosa'],
            ['Acao Penal', 'Porte Ilegal de Arma de Fogo'],
            ['Acao Penal', 'Latrocinio'],
            ['Acao Penal', 'Feminicidio'],
            ['Apelacao Criminal', 'Nao definido'],
            ['Execucao da Pena', 'Regime Inicial - Fechado'],
            ['Comunicado de Mandado de Prisao', 'Cumprimento do mandado'],
            ['Relaxamento de Prisao', 'Prisao Preventiva'],
        ];

        it.each(crimesQueDevemSerReconhecidos)('reconhece %s / %s como indicador criminal', (classe, assunto) => {
            expect(hasCriminalIndicator({ area: 'CRIMINAL', classe, assunto })).toBe(true);
        });

        it.each(crimesQueDevemSerReconhecidos)('nao exclui %s / %s por nenhum tier', (classe, assunto) => {
            expect(isExcludedCrimeType({ area: 'CRIMINAL', classe, assunto })).toBeNull();
        });
    });

    describe('civel rotulado como criminal pela API continua fora', () => {
        const civeisQueDevemSerExcluidos = [
            ['Alvara Judicial - Lei 6858/80', 'Inventario e Partilha / Levantamento de Valor'],
            ['Procedimento Comum Civel', 'Divorcio Consensual'],
            ['Procedimento Comum Civel', 'Guarda de Menor'],
            ['Usucapiao', 'Propriedade'],
            ['Acao Monitoria', 'Cheque'],
            ['Arrolamento Sumario', 'Inventario'],
            ['Interdicao', 'Curatela'],
        ];

        it.each(civeisQueDevemSerExcluidos)('exclui %s / %s como ruido civel', (classe, assunto) => {
            expect(isExcludedCrimeType({ area: 'CRIMINAL', classe, assunto })).toBe(CONSUMER_CIVIL_NOISE);
        });
    });

    describe('crime real que menciona termo civel nao pode ser engolido pela exclusao', () => {
        it('mantem estelionato com cartao de credito', () => {
            expect(isExcludedCrimeType({ area: 'CRIMINAL', classe: 'Acao Penal', assunto: 'Estelionato / Cartao de Credito' })).toBeNull();
        });

        it('mantem apropriacao indebita em acao de cobranca', () => {
            expect(isExcludedCrimeType({ area: 'CRIMINAL', classe: 'Acao Penal', assunto: 'Apropriacao Indebita / Cobranca' })).toBeNull();
        });
    });

    describe('carta precatoria de mero ato processual', () => {
        it.each([['Depoimento'], ['Oitiva de Testemunha'], ['Inquiricao']])('exclui carta precatoria de %s', (assunto) => {
            expect(isExcludedCrimeType({ area: 'CRIMINAL', classe: 'Carta Precatoria Criminal', assunto })).toBe(CARTA_PRECATORIA_NOISE);
        });

        it('NAO exclui carta precatoria criminal para ato de instrucao real', () => {
            expect(isExcludedCrimeType({ area: 'CRIMINAL', classe: 'Carta Precatoria Criminal', assunto: 'Acao Penal - Roubo' })).toBeNull();
        });
    });
});
