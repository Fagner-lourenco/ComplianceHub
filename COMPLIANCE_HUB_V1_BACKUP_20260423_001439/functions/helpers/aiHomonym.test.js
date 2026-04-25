import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const {
    buildCandidateProfile,
    getGeoConsistencyBucket,
    buildHomonymAnalysisInput,
} = require('./aiHomonym');

describe('aiHomonym helpers', () => {
    it('buildCandidateProfile derives UFs, cities and DDDs from minimized case data', () => {
        const profile = buildCandidateProfile({
            hiringUf: 'PR',
            juditAllUfs: ['PR'],
            enrichmentContact: {
                primaryUf: 'PR',
                allUfs: ['PR'],
                phones: ['(44) 99136-0336'],
                addresses: ['AVENIDA NAPOLEAO MOREIRA DA SILVA, 480, CENTRO, TERRA BOA, PR, 87240-000'],
            },
        });

        expect(profile.primaryUf).toBe('PR');
        expect(profile.allUfs).toEqual(['PR']);
        expect(profile.dddPrefixes).toEqual(['44']);
        expect(profile.cities).toContain('TERRA BOA');
    });

    it('getGeoConsistencyBucket marks distant regions when geography diverges', () => {
        const bucket = getGeoConsistencyBucket(
            { allUfs: ['PR'], cities: ['TERRA BOA'] },
            'CE',
            'Sobral',
        );

        expect(bucket).toBe('DISTANT_REGION');
    });

    it('buildHomonymAnalysisInput triggers analysis for weak name-based ambiguous matches', () => {
        const result = buildHomonymAnalysisInput({
            hiringUf: 'SP',
            escavadorCpfsComEsseNome: 8,
            juditProcessTotal: 0,
            escavadorProcessTotal: 14,
            escavadorCriminalCount: 7,
            escavadorProcessos: [
                {
                    numeroCnj: '0000478-49.2023.8.26.0536',
                    area: 'CRIME',
                    tribunalSigla: 'TJSP',
                    processUf: 'SP',
                    processCity: 'Campinas',
                    hasExactCpfMatch: false,
                    tipoNormalizado: 'Reu',
                    matchDocumentoPor: 'NOME_EXATO_UNICO',
                },
                {
                    numeroCnj: '0300092-91.2018.8.05.0022',
                    area: 'CRIME',
                    tribunalSigla: 'TJBA',
                    processUf: 'BA',
                    processCity: 'Euclides da Cunha',
                    hasExactCpfMatch: false,
                    tipoNormalizado: 'Autor do Fato',
                    matchDocumentoPor: 'NOME_EXATO_UNICO',
                },
            ],
            enrichmentContact: {
                allUfs: ['SP'],
                primaryUf: 'SP',
                phones: ['(13) 99203-6849'],
                addresses: ['RUA R ANTONIO RIBEIRAO, 1, JOSE MENINO, SANTOS, SP, 11065-290'],
            },
        });

        expect(result.needsAnalysis).toBe(true);
        expect(result.ambiguityReasons).toContain('MULTIPLE_CPFS_SAME_NAME');
        expect(result.ambiguityReasons).toContain('NAME_BASED_MATCH_PRESENT');
        expect(result.ambiguityReasons).toContain('CRIMINAL_WEAK_MATCH');
    });

    it('buildHomonymAnalysisInput does not trigger for hard facts with exact CPF and active warrant', () => {
        const result = buildHomonymAnalysisInput({
            hiringUf: 'CE',
            juditActiveWarrantCount: 1,
            juditExecutionFlag: 'NEGATIVE',
            juditProcessTotal: 1,
            juditCriminalCount: 1,
            juditRoleSummary: [
                {
                    code: '0202743-72.2022.8.06.0167',
                    area: 'DIREITO PENAL',
                    tribunalAcronym: 'TJCE',
                    state: 'CE',
                    city: 'SOBRAL',
                    hasExactCpfMatch: true,
                    personType: 'REU',
                    isCriminal: true,
                    isPossibleHomonym: false,
                },
            ],
            juditAllUfs: ['CE'],
            juditIdentity: {
                addresses: [{ city: 'Sobral', state: 'CE' }],
            },
        });

        expect(result.needsAnalysis).toBe(false);
        expect(result.hardFacts.sort()).toEqual(['ACTIVE_WARRANT', 'JUDIT_EXACT_CPF_MATCH']);
    });
});
