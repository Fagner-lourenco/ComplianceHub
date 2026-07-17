import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildClientVerdictPolicy } = require('./clientVerdictPolicy');
const { normalizeEscavador2Response } = require('../normalizers/escavador2');
const { deduplicateEscavador2Findings } = require('../helpers/deduplicateEscavador2');

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

function buildCaseWithEscavador2LaborProcess({ exactCpf, role = 'Reclamante', side = 'ATIVO' }) {
    const normalized = normalizeEscavador2Response({
        consulta: { status: 'DONE', nome: 'CANDIDATO TESTE' },
        processos: [{
            cnj: { valor: '0000000-01.2026.5.01.0001', mascarado: false },
            lista: {
                polo_ativo: 'CANDIDATO TESTE',
                polo_passivo: 'MADERO INDUSTRIA E COMERCIO S.A.',
            },
            classificacao: { area: 'LABOR', risco_material: true },
            papel_candidato: { tipo_principal: role, polo_principal: side },
            normalizado: {
                match: { tipo: exactCpf ? 'CPF' : 'NOME', has_exact_cpf_match: exactCpf },
                dados: { classe: 'RECLAMACAO TRABALHISTA' },
            },
        }],
    });
    const deduped = deduplicateEscavador2Findings(normalized);
    return {
        candidateName: 'CANDIDATO TESTE',
        ...normalized,
        ...deduped,
    };
}

describe('clientVerdictPolicy', () => {
    it('does not promote verdict for an Escavador2 labor plaintiff matched only by name', () => {
        const policy = buildClientVerdictPolicy(buildCaseWithEscavador2LaborProcess({ exactCpf: false }));

        expect(policy.requiredVerdict).toBe('FIT');
        expect(policy.evidence).toEqual([]);
    });

    it('requires NOT_RECOMMENDED for an exact-CPF Escavador2 labor plaintiff against Madero', () => {
        const policy = buildClientVerdictPolicy(buildCaseWithEscavador2LaborProcess({ exactCpf: true }));

        expect(policy.requiredVerdict).toBe('NOT_RECOMMENDED');
        expect(policy.reasons.join('\n')).toMatch(/Madero/i);
    });

    it('keeps exact-CPF Escavador2 labor defendant at low risk', () => {
        const policy = buildClientVerdictPolicy(buildCaseWithEscavador2LaborProcess({
            exactCpf: true,
            role: 'Reclamado',
            side: 'PASSIVO',
        }));

        expect(policy.requiredVerdict).toBe('FIT');
    });

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
