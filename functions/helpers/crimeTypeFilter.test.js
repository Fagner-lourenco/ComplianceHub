import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
    isExcludedCrimeType,
    hasIdentifiableClassOrSubject,
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

    it('returns null when only area is CRIMINAL with no transito/ambiental markers', () => {
        expect(isExcludedCrimeType({
            area: 'CRIMINAL',
            classe: 'ACAO PENAL',
            assunto: 'Roubo Majorado',
        })).toBeNull();
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
