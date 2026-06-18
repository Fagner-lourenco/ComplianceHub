/**
 * Testes para publishAndSync.js
 */

import { describe, it, expect, vi } from 'vitest';
import {
    buildClientCasePayload,
    clientPayloadChanged,
    isAutoClassifyOnlyChange,
    shouldSkipClientCaseMirrorSync,
    syncClientCaseOnCreateLogic,
    syncClientCaseOnUpdateLogic,
    syncClientCaseOnDeleteLogic,
    publishResultOnCaseDoneLogic,
} from './publishAndSync';

describe('buildClientCasePayload', () => {
    it('inclui campos resultantes quando DONE', () => {
        const payload = buildClientCasePayload('c1', {
            status: 'DONE',
            candidateName: 'John Doe',
            criminalFlag: 'POSITIVE',
            riskScore: 80,
            createdAt: new Date('2026-01-15T12:00:00.000Z'),
        });
        expect(payload.caseId).toBe('c1');
        expect(payload.candidateName).toBe('John Doe');
        expect(payload.criminalFlag).toBe('POSITIVE');
        expect(payload.riskScore).toBe(80);
        expect(payload.createdDateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(payload.reportReady).toBe(true);
    });

    it('oculta campos resultantes antes de DONE', () => {
        const payload = buildClientCasePayload('c1', {
            status: 'IN_PROGRESS',
            candidateName: 'John Doe',
            criminalFlag: 'POSITIVE',
            riskScore: 80,
        });
        expect(payload.candidateName).toBe('John Doe');
        expect(payload.criminalFlag).toBeUndefined();
        expect(payload.riskScore).toBeUndefined();
        expect(payload.reportReady).toBe(false);
    });

    it('sanitiza CPF', () => {
        const payload = buildClientCasePayload('c1', {
            status: 'DONE',
            cpf: '123.456.789-00',
        });
        expect(payload.cpf).toBe('12345678900');
    });

    it('detecta hasEvidence via keyFindings', () => {
        const payload = buildClientCasePayload('c1', {
            status: 'DONE',
            keyFindings: [{ title: 'X' }],
        });
        expect(payload.hasEvidence).toBe(true);
    });

    it('detecta hasNotes via analystComment', () => {
        const payload = buildClientCasePayload('c1', {
            status: 'DONE',
            analystComment: 'ok',
        });
        expect(payload.hasNotes).toBe(true);
    });
});

describe('clientPayloadChanged', () => {
    it('ignora timestamps diferentes', () => {
        const payload = { name: 'John', updatedAt: new Date('2026-01-01') };
        const existing = { name: 'John', updatedAt: new Date('2026-01-02') };
        expect(clientPayloadChanged(payload, existing)).toBe(false);
    });

    it('detecta flag diferente', () => {
        const payload = { criminalFlag: 'POSITIVE' };
        const existing = { criminalFlag: 'NEGATIVE' };
        expect(clientPayloadChanged(payload, existing)).toBe(true);
    });

    it('detecta array diferente', () => {
        const payload = { warrants: [{ id: 1 }] };
        const existing = { warrants: [{ id: 1 }, { id: 2 }] };
        expect(clientPayloadChanged(payload, existing)).toBe(true);
    });

    it('ignora arrays iguais', () => {
        const payload = { warrants: [{ id: 1 }] };
        const existing = { warrants: [{ id: 1 }] };
        expect(clientPayloadChanged(payload, existing)).toBe(false);
    });

    it('detecta objeto diferente', () => {
        const payload = { meta: { score: 10 } };
        const existing = { meta: { score: 20 } };
        expect(clientPayloadChanged(payload, existing)).toBe(true);
    });

    it('ignora objeto igual', () => {
        const payload = { meta: { score: 10 } };
        const existing = { meta: { score: 10 } };
        expect(clientPayloadChanged(payload, existing)).toBe(false);
    });

    it('detecta primitivo diferente', () => {
        const payload = { name: 'John' };
        const existing = { name: 'Jane' };
        expect(clientPayloadChanged(payload, existing)).toBe(true);
    });

    it('ignora primitivo igual', () => {
        const payload = { name: 'John' };
        const existing = { name: 'John' };
        expect(clientPayloadChanged(payload, existing)).toBe(false);
    });

    it('detecta chave nova', () => {
        const payload = { name: 'John', age: 30 };
        const existing = { name: 'John' };
        expect(clientPayloadChanged(payload, existing)).toBe(true);
    });

    it('detecta chave removida', () => {
        const payload = { name: 'John' };
        const existing = { name: 'John', age: 30 };
        expect(clientPayloadChanged(payload, existing)).toBe(true);
    });
});

describe('isAutoClassifyOnlyChange', () => {
    it('retorna true quando apenas riskScore muda', () => {
        const before = { name: 'John', riskScore: 30 };
        const after = { name: 'John', riskScore: 50 };
        expect(isAutoClassifyOnlyChange(before, after)).toBe(true);
    });

    it('retorna false quando status muda', () => {
        const before = { name: 'John', status: 'PENDING' };
        const after = { name: 'John', status: 'IN_PROGRESS' };
        expect(isAutoClassifyOnlyChange(before, after)).toBe(false);
    });

    it('retorna false quando misto (auto + status)', () => {
        const before = { name: 'John', status: 'PENDING', riskScore: 30 };
        const after = { name: 'John', status: 'IN_PROGRESS', riskScore: 50 };
        expect(isAutoClassifyOnlyChange(before, after)).toBe(false);
    });

    it('retorna true quando múltiplos campos auto mudam', () => {
        const before = { name: 'John', riskScore: 30, criminalFlag: 'NEGATIVE' };
        const after = { name: 'John', riskScore: 50, criminalFlag: 'POSITIVE' };
        expect(isAutoClassifyOnlyChange(before, after)).toBe(true);
    });

    it('retorna true quando não há mudanças', () => {
        const before = { name: 'John', riskScore: 30 };
        const after = { name: 'John', riskScore: 30 };
        expect(isAutoClassifyOnlyChange(before, after)).toBe(true);
    });

    it('retorna false quando campo não-auto é adicionado', () => {
        const before = { name: 'John' };
        const after = { name: 'John', analystComment: 'Note' };
        expect(isAutoClassifyOnlyChange(before, after)).toBe(false);
    });

    it('retorna false quando campo não-auto é removido', () => {
        const before = { name: 'John', analystComment: 'Note' };
        const after = { name: 'John' };
        expect(isAutoClassifyOnlyChange(before, after)).toBe(false);
    });
});

describe('shouldSkipClientCaseMirrorSync', () => {
    it('pula sync antes de DONE quando apenas campos auto mudam', () => {
        const before = { status: 'IN_PROGRESS', riskScore: 30 };
        const after = { status: 'IN_PROGRESS', riskScore: 50 };
        expect(shouldSkipClientCaseMirrorSync(before, after)).toBe(true);
    });

    it('nao pula sync em DONE mesmo quando apenas campos visiveis de classificacao mudam', () => {
        const before = { status: 'DONE', riskScore: 30, finalVerdict: 'ATTENTION' };
        const after = { status: 'DONE', riskScore: 50, finalVerdict: 'NOT_RECOMMENDED' };
        expect(shouldSkipClientCaseMirrorSync(before, after)).toBe(false);
    });
});

describe('syncClientCaseOnCreateLogic', () => {
    it('escreve mirror no create', async () => {
        const setFn = vi.fn();
        const db = {
            collection: vi.fn(() => ({
                doc: vi.fn(() => ({
                    get: vi.fn(async () => ({ exists: false, data: () => ({}) })),
                    set: setFn,
                })),
            })),
        };

        await syncClientCaseOnCreateLogic({ db, caseId: 'c1', caseData: { status: 'DONE', candidateName: 'X' } });
        expect(setFn).toHaveBeenCalled();
    });
});

describe('syncClientCaseOnUpdateLogic', () => {
    it('pula sync quando apenas auto-classify muda antes de DONE', async () => {
        const setFn = vi.fn();
        const db = {
            collection: vi.fn(() => ({
                doc: vi.fn(() => ({
                    get: vi.fn(async () => ({ exists: false, data: () => ({}) })),
                    set: setFn,
                })),
            })),
        };

        await syncClientCaseOnUpdateLogic({
            db,
            caseId: 'c1',
            before: { status: 'IN_PROGRESS', riskScore: 30 },
            after: { status: 'IN_PROGRESS', riskScore: 50 },
        });
        expect(setFn).not.toHaveBeenCalled();
    });

    it('sync quando status muda para DONE', async () => {
        const setFn = vi.fn();
        const db = {
            collection: vi.fn(() => ({
                doc: vi.fn(() => ({
                    get: vi.fn(async () => ({ exists: false, data: () => ({}) })),
                    set: setFn,
                })),
            })),
        };

        await syncClientCaseOnUpdateLogic({
            db,
            caseId: 'c1',
            before: { status: 'IN_PROGRESS', candidateName: 'X' },
            after: { status: 'DONE', candidateName: 'X' },
        });
        expect(setFn).toHaveBeenCalled();
    });
});

describe('syncClientCaseOnDeleteLogic', () => {
    it('deleta documento mirror', async () => {
        const deleteFn = vi.fn(() => Promise.resolve());
        const db = {
            collection: vi.fn(() => ({
                doc: vi.fn(() => ({
                    delete: deleteFn,
                })),
            })),
        };

        await syncClientCaseOnDeleteLogic({ db, caseId: 'c1' });
        expect(deleteFn).toHaveBeenCalled();
    });
});

describe('publishResultOnCaseDoneLogic', () => {
    it('publica quando entra em DONE com conteúdo mínimo', async () => {
        const syncPublicResultLatest = vi.fn(async () => ({ id: 'c1' }));
        const hasPublicReportMinimumContent = vi.fn(() => true);
        const db = {
            collection: vi.fn(() => ({
                doc: vi.fn(() => ({
                    collection: vi.fn(() => ({
                        doc: vi.fn(() => ({
                            get: vi.fn(async () => ({ exists: false })),
                        })),
                    })),
                })),
            })),
        };

        await publishResultOnCaseDoneLogic({
            db,
            caseId: 'c1',
            before: { status: 'IN_PROGRESS' },
            after: { status: 'DONE', concludedAt: new Date() },
            hasPublicReportMinimumContent,
            syncPublicResultLatest,
            revokeCasePublicationArtifacts: vi.fn(),
        });

        expect(hasPublicReportMinimumContent).toHaveBeenCalled();
        expect(syncPublicResultLatest).toHaveBeenCalled();
    });

    it('revoga quando sai de DONE', async () => {
        const revokeCasePublicationArtifacts = vi.fn();
        const hasPublicReportMinimumContent = vi.fn(() => true);

        await publishResultOnCaseDoneLogic({
            db: {},
            caseId: 'c1',
            before: { status: 'DONE' },
            after: { status: 'CORRECTION_NEEDED' },
            hasPublicReportMinimumContent,
            syncPublicResultLatest: vi.fn(),
            revokeCasePublicationArtifacts,
        });

        expect(revokeCasePublicationArtifacts).toHaveBeenCalled();
    });

    it('nao publica sem conteudo minimo', async () => {
        const syncPublicResultLatest = vi.fn();
        const hasPublicReportMinimumContent = vi.fn(() => false);

        await publishResultOnCaseDoneLogic({
            db: {},
            caseId: 'c1',
            before: { status: 'IN_PROGRESS' },
            after: { status: 'DONE' },
            hasPublicReportMinimumContent,
            syncPublicResultLatest,
            revokeCasePublicationArtifacts: vi.fn(),
        });

        expect(hasPublicReportMinimumContent).toHaveBeenCalled();
        expect(syncPublicResultLatest).not.toHaveBeenCalled();
    });
});
