import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'compliance-hub-test';
process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || '{}';

const require = createRequire(import.meta.url);
const mod = require('./index');

const {
    buildClientCasePayload,
    buildSanitizedPublicResultSnapshot,
} = mod.__test;

describe('public result privacy contract', () => {
    const baseCase = {
        status: 'DONE',
        candidateName: 'Ana Paula Silva',
        cpf: '27144599845',
        cpfMasked: '***.***.***-45',
        tenantId: 'tenant-1',
        createdAt: new Date('2026-01-01T12:00:00Z'),
        finalVerdict: 'FIT',
        executiveSummary: 'Sem apontamentos impeditivos.',
        keyFindings: ['Nenhum alerta crítico identificado.'],
        requestedBy: 'uid-interno',
        requestedByName: 'Solicitante Interno',
        requestedByEmail: 'solicitante@example.com',
        bigdatacorpMotherName: 'Nome Materno Sensivel',
        escavador2RawPayloads: { response: { secret: 'raw' } },
        escavador2Sources: { consulta: { cpf: '12345678901' } },
        escavador2Processos: [{ numeroCnj: '0001234-56.2024.8.26.0100' }],
    };

    it('mantem CPF completo no clientCases autenticado para busca por tenant', () => {
        const payload = buildClientCasePayload('case-1', baseCase);

        expect(payload.cpf).toBe('27144599845');
        expect(payload.cpfMasked).toBe('***.***.***-45');
    });

    it('nao publica CPF completo em publicResult/latest sem login', () => {
        const snapshot = buildSanitizedPublicResultSnapshot('case-1', baseCase);

        expect(snapshot.cpf).toBeUndefined();
        expect(snapshot.cpfMasked).toBe('***.***.***-45');
    });

    it('nao publica metadados internos ou filiacao sensivel em publicResult/latest', () => {
        const snapshot = buildSanitizedPublicResultSnapshot('case-1', baseCase);

        expect(snapshot.tenantId).toBeUndefined();
        expect(snapshot.bigdatacorpMotherName).toBeUndefined();
        expect(snapshot.escavador2RawPayloads).toBeUndefined();
        expect(snapshot.escavador2Sources).toBeUndefined();
        expect(snapshot.escavador2Processos).toBeUndefined();
    });

    it('publica indicativo de credito e omite custos/fontes em publicResult/latest', () => {
        const snapshot = buildSanitizedPublicResultSnapshot('case-1', {
            ...baseCase,
            enabledPhases: ['criminal', 'creditRestriction'],
            creditRestrictionFlag: 'RESTRICTED',
            creditQuantumScore: 480,
            creditRestrictionSummary: 'Restrições de crédito ativas: 2 negativação(ões) ativa(s).',
            creditRestrictionDetails: { activeNegativeAppointments: 2, registeredProtests: 0 },
            creditSources: { quodRisk: { dataset: 'partner_quod_credit_risk_details_person' } },
            creditCostBRL: 1.8,
            creditError: 'nada',
            creditEnrichmentStatus: 'DONE',
        });

        expect(snapshot.creditRestrictionFlag).toBe('RESTRICTED');
        expect(snapshot.creditQuantumScore).toBe(480);
        expect(snapshot.creditRestrictionSummary).toContain('Restrições');
        expect(snapshot.creditRestrictionDetails).toEqual(expect.objectContaining({ activeNegativeAppointments: 2 }));
        expect(snapshot.creditSources).toBeUndefined();
        expect(snapshot.creditCostBRL).toBeUndefined();
        expect(snapshot.creditError).toBeUndefined();
        expect(snapshot.creditEnrichmentStatus).toBeUndefined();
    });

    it('publica metadados do solicitante sanitizados em publicResult/latest', () => {
        const snapshot = buildSanitizedPublicResultSnapshot('case-1', baseCase);

        expect(snapshot.requestedBy).toBe('uid-interno');
        expect(snapshot.requestedByName).toBe('Solicitante Interno');
        expect(snapshot.requestedByEmail).toBe('solicitante@example.com');
    });
});
