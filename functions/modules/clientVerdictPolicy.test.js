import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildClientVerdictPolicy } = require('./clientVerdictPolicy');

function buildCaseWithCriminalProcess(process) {
    return {
        candidateName: 'CANDIDATO TESTE',
        bigdatacorpProcessos: [
            {
                numero: '00000000020248190000',
                isCriminal: true,
                isDirectCpfMatch: true,
                courtType: 'CRIMINAL',
                courtDistrict: 'RIO DE JANEIRO',
                ...process,
            },
        ],
    };
}

describe('clientVerdictPolicy', () => {
    it('requires ATTENTION for confirmed criminal finding with neutral role', () => {
        const policy = buildClientVerdictPolicy(buildCaseWithCriminalProcess({
            specificRole: 'INTERESSADO',
            assunto: 'HOMICIDIO QUALIFICADO',
            isDefendant: false,
            isVictim: false,
            isWitness: false,
        }));

        expect(policy.requiredVerdict).toBe('ATTENTION');
        expect(policy.reasons.join('\n')).toMatch(/revisao|aten[cç][aã]o/i);
    });

    it('requires NOT_RECOMMENDED for material non-traffic criminal defendant finding', () => {
        const policy = buildClientVerdictPolicy(buildCaseWithCriminalProcess({
            specificRole: 'REU',
            assunto: 'ROUBO',
            isDefendant: true,
        }));

        expect(policy.requiredVerdict).toBe('NOT_RECOMMENDED');
    });

    it('requires ATTENTION for material traffic or environmental criminal finding', () => {
        const policy = buildClientVerdictPolicy(buildCaseWithCriminalProcess({
            specificRole: 'REU',
            assunto: 'EMBRIAGUEZ AO VOLANTE',
            isDefendant: true,
        }));

        expect(policy.requiredVerdict).toBe('ATTENTION');
    });

    it('records criminal attention reason even when labor rule already required ATTENTION', () => {
        const policy = buildClientVerdictPolicy({
            candidateName: 'CANDIDATO TESTE',
            bigdatacorpProcessos: [
                {
                    numero: '00000000020248190000',
                    isCriminal: true,
                    isDirectCpfMatch: true,
                    courtType: 'CRIMINAL',
                    courtDistrict: 'RIO DE JANEIRO',
                    specificRole: 'INTERESSADO',
                    assunto: 'HOMICIDIO QUALIFICADO',
                    isDefendant: false,
                    isVictim: false,
                    isWitness: false,
                },
                {
                    numero: '00000000120245010000',
                    isLabor: true,
                    isCriminal: false,
                    isDirectCpfMatch: true,
                    courtType: 'TRABALHISTA',
                    specificRole: 'RECLAMANTE',
                    assunto: 'Verbas Rescisorias',
                },
            ],
        });

        expect(policy.requiredVerdict).toBe('ATTENTION');
        expect(policy.reasons.join('\n')).toMatch(/trabalhista/i);
        expect(policy.reasons.join('\n')).toMatch(/criminal confirmado com papel neutro/i);
        expect(policy.evidence.some((item) => item.area === 'criminal')).toBe(true);
    });
});
