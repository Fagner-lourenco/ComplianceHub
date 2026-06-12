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
    });

    it('publica metadados do solicitante sanitizados em publicResult/latest', () => {
        const snapshot = buildSanitizedPublicResultSnapshot('case-1', baseCase);

        expect(snapshot.requestedBy).toBe('uid-interno');
        expect(snapshot.requestedByName).toBe('Solicitante Interno');
        expect(snapshot.requestedByEmail).toBe('solicitante@example.com');
    });
});
