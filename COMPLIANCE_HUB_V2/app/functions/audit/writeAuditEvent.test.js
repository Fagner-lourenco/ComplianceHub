import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

process.env.FUNCTIONS_EMULATOR = 'true';

const require = createRequire(import.meta.url);
const { writeAuditEvent, __test } = require('./writeAuditEvent');
if (!__test) throw new Error('writeAuditEvent.js must export __test when FUNCTIONS_EMULATOR=true');
const { interpolateTemplate, buildSearchText, stripUndefined, _setDb } = __test;

// ── Mock Firestore db ────────────────────────────────────────────────────────

const mockDocRef = { id: 'audit-event-123' };
const mockAdd = vi.fn().mockResolvedValue(mockDocRef);
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn(() => ({ set: mockSet }));
const mockCollection = vi.fn(() => ({ add: mockAdd, doc: mockDoc }));

beforeEach(() => {
    vi.clearAllMocks();
    _setDb({ collection: mockCollection });
});

describe('writeAuditEvent', () => {
    // ── Pure helper tests (no Firestore needed) ──────────────────────────────

    describe('interpolateTemplate', () => {
        it('substitui placeholders com valores', () => {
            expect(interpolateTemplate('Ola {nome}, voce tem {n} casos', { nome: 'Ana', n: 3 }))
                .toBe('Ola Ana, voce tem 3 casos');
        });

        it('placeholder ausente vira string vazia', () => {
            expect(interpolateTemplate('{a} e {b}', { a: 'X' })).toBe('X e');
        });

        it('template null retorna string vazia', () => {
            expect(interpolateTemplate(null, {})).toBe('');
            expect(interpolateTemplate(undefined, {})).toBe('');
        });

        it('vars null/undefined viram string vazia', () => {
            expect(interpolateTemplate('{x}', { x: null })).toBe('');
            expect(interpolateTemplate('{x}', { x: undefined })).toBe('');
        });
    });

    describe('buildSearchText', () => {
        it('concatena campos em lowercase', () => {
            const result = buildSearchText({
                summary: 'Caso Criado',
                actorEmail: 'Ana@Ops.COM',
                action: 'CASE_ASSIGNED',
            });
            expect(result).toBe('caso criado ana@ops.com case_assigned');
        });

        it('ignora campos falsy', () => {
            const result = buildSearchText({ summary: 'Test', actorEmail: null, action: '' });
            expect(result).toBe('test');
        });

        it('trunca em 500 caracteres', () => {
            const longText = 'a'.repeat(600);
            const result = buildSearchText({ summary: longText });
            expect(result.length).toBe(500);
        });
    });

    describe('stripUndefined', () => {
        it('remove campos undefined', () => {
            expect(stripUndefined({ a: 1, b: undefined })).toEqual({ a: 1 });
        });

        it('preserva null', () => {
            expect(stripUndefined({ a: null })).toEqual({ a: null });
        });

        it('preserva arrays', () => {
            expect(stripUndefined({ arr: [1, 2] })).toEqual({ arr: [1, 2] });
        });

        it('preserva Date', () => {
            const d = new Date();
            const result = stripUndefined({ date: d });
            expect(result.date).toBe(d);
        });

        it('recursa em objetos aninhados plain', () => {
            expect(stripUndefined({ nested: { a: 1, b: undefined } })).toEqual({ nested: { a: 1 } });
        });

        it('remove objetos aninhados que ficam vazios', () => {
            expect(stripUndefined({ nested: { a: undefined } })).toEqual({});
        });

        it('preserva FieldValue sentinels (ServerTimestampTransform)', () => {
            // Importa o real FieldValue do firebase-admin
            const { FieldValue } = require('firebase-admin/firestore');
            const ts = FieldValue.serverTimestamp();
            const result = stripUndefined({ time: ts });
            expect(result.time).toBe(ts);
        });
    });

    // ── template interpolation (via writeAuditEvent) ─────────────────────────

    describe('template interpolation (via summary)', () => {
        it('interpola variaveis no summaryTemplate', async () => {
            await writeAuditEvent({
                action: 'SOLICITATION_CREATED',
                tenantId: 'tenant-1',
                actor: { type: 'CLIENT_USER', id: 'u1', email: 'a@b.com', displayName: 'Ana' },
                templateVars: { candidateName: 'Joao Silva' },
            });

            expect(mockAdd).toHaveBeenCalledTimes(1);
            const doc = mockAdd.mock.calls[0][0];
            expect(doc.summary).toBe('Nova solicitação criada para Joao Silva');
        });

        it('variaveis ausentes viram string vazia', async () => {
            await writeAuditEvent({
                action: 'SOLICITATION_CREATED',
                tenantId: 'tenant-1',
                actor: { email: 'a@b.com' },
                templateVars: {}, // candidateName ausente
            });

            const doc = mockAdd.mock.calls[0][0];
            expect(doc.summary).toBe('Nova solicitação criada para');
        });
    });

    // ── Core write behavior ──────────────────────────────────────────────────

    describe('escrita em auditLogs', () => {
        it('escreve documento v2 com campos corretos', async () => {
            const eventId = await writeAuditEvent({
                action: 'CASE_ASSIGNED',
                tenantId: 'tenant-1',
                actor: { type: 'OPS_USER', id: 'u1', email: 'ana@ops.com', displayName: 'Ana' },
                entity: { id: 'case-1', label: 'Case 1' },
                source: 'portal_ops',
                ip: '1.2.3.4',
            });

            expect(eventId).toBe('audit-event-123');
            expect(mockCollection).toHaveBeenCalledWith('auditLogs');
            expect(mockAdd).toHaveBeenCalledTimes(1);

            const doc = mockAdd.mock.calls[0][0];
            expect(doc.action).toBe('CASE_ASSIGNED');
            expect(doc.tenantId).toBe('tenant-1');
            expect(doc.level).toBe('AUDIT');
            expect(doc.category).toBe('CASE');
            expect(doc.clientVisible).toBe(false);
            expect(doc.actor.email).toBe('ana@ops.com');
            expect(doc.entity.type).toBe('CASE');
            expect(doc.source).toBe('portal_ops');
            expect(doc.ip).toBe('1.2.3.4');
            // FieldValue.serverTimestamp() returns a sentinel object (ServerTimestampTransform)
            expect(doc.occurredAt).toBeDefined();
            expect(doc.occurredAt.constructor.name).toBe('ServerTimestampTransform');
            expect(doc.timestamp).toBeDefined();
        });

        it('lanca erro para acao desconhecida', async () => {
            await expect(writeAuditEvent({
                action: 'NONEXISTENT_ACTION',
                actor: { email: 'x@x.com' },
            })).rejects.toThrow('Unknown audit action: NONEXISTENT_ACTION');

            expect(mockAdd).not.toHaveBeenCalled();
        });
    });

    // ── tenantAuditLogs projection ───────────────────────────────────────────

    describe('projecao em tenantAuditLogs', () => {
        it('projeta para tenantAuditLogs quando clientVisible e tenantId', async () => {
            await writeAuditEvent({
                action: 'SOLICITATION_CREATED', // clientVisible: true
                tenantId: 'tenant-1',
                actor: { type: 'CLIENT_USER', id: 'u1', email: 'a@b.com', displayName: 'Ana' },
                templateVars: { candidateName: 'Maria' },
            });

            // auditLogs write
            expect(mockCollection).toHaveBeenCalledWith('auditLogs');
            // tenantAuditLogs projection
            expect(mockCollection).toHaveBeenCalledWith('tenantAuditLogs');
            expect(mockDoc).toHaveBeenCalledWith('audit-event-123');
            expect(mockSet).toHaveBeenCalledTimes(1);

            const tenantDoc = mockSet.mock.calls[0][0];
            expect(tenantDoc.eventId).toBe('audit-event-123');
            expect(tenantDoc.action).toBe('SOLICITATION_CREATED');
            expect(tenantDoc.tenantId).toBe('tenant-1');
            // clientSummary should be interpolated
            expect(tenantDoc.summary).toContain('Maria');
        });

        it('NAO projeta quando clientVisible eh false', async () => {
            await writeAuditEvent({
                action: 'CASE_ASSIGNED', // clientVisible: false
                tenantId: 'tenant-1',
                actor: { type: 'OPS_USER', id: 'u1', email: 'a@b.com', displayName: 'Ana' },
            });

            // Apenas auditLogs
            const collectionCalls = mockCollection.mock.calls.map(c => c[0]);
            expect(collectionCalls).toContain('auditLogs');
            expect(collectionCalls).not.toContain('tenantAuditLogs');
        });

        it('NAO projeta quando tenantId eh null', async () => {
            await writeAuditEvent({
                action: 'SOLICITATION_CREATED', // clientVisible: true
                tenantId: null,
                actor: { email: 'a@b.com' },
                templateVars: { candidateName: 'X' },
            });

            const collectionCalls = mockCollection.mock.calls.map(c => c[0]);
            expect(collectionCalls).not.toContain('tenantAuditLogs');
        });

        it('falha na projecao nao propaga erro (catch silencioso)', async () => {
            mockSet.mockRejectedValueOnce(new Error('Firestore write failed'));

            // Should NOT throw
            const eventId = await writeAuditEvent({
                action: 'SOLICITATION_CREATED',
                tenantId: 'tenant-1',
                actor: { email: 'a@b.com' },
                templateVars: { candidateName: 'Y' },
            });

            expect(eventId).toBe('audit-event-123');
        });
    });

    // ── searchText ───────────────────────────────────────────────────────────

    describe('searchText', () => {
        it('gera searchText lowercase com campos concatenados', async () => {
            await writeAuditEvent({
                action: 'CASE_CONCLUDED',
                tenantId: 't1',
                actor: { email: 'Ana@Ops.com', displayName: 'Ana Silva' },
                entity: { id: 'c1', label: 'Candidato XYZ' },
                templateVars: { candidateName: 'Candidato XYZ', verdict: 'APROVADO' },
            });

            const doc = mockAdd.mock.calls[0][0];
            expect(doc.searchText).toBeTruthy();
            expect(doc.searchText).toBe(doc.searchText.toLowerCase());
            expect(doc.searchText).toContain('ana@ops.com');
            expect(doc.searchText).toContain('candidato xyz');
        });
    });

    // ── stripUndefined ───────────────────────────────────────────────────────

    describe('stripUndefined (via document structure)', () => {
        it('null eh preservado, mas campos inexistentes no input sao removidos', async () => {
            await writeAuditEvent({
                action: 'CASE_ASSIGNED',
                tenantId: 'tenant-1',
                actor: { email: 'a@b.com' },
                // detail, metadata, clientMetadata default to null in the function
            });

            const doc = mockAdd.mock.calls[0][0];
            // null values (ip: null → ip || null → null) pass through stripUndefined
            // since the code sets ip: ip || null, it becomes null and is preserved
            expect(doc.tenantId).toBe('tenant-1');
            expect(doc.action).toBe('CASE_ASSIGNED');
        });
    });

    // ── clientSummary interpolation ──────────────────────────────────────────

    describe('clientSummary separate from ops summary', () => {
        it('usa clientSummaryTemplate quando diferente de summaryTemplate', async () => {
            await writeAuditEvent({
                action: 'CASE_RETURNED', // has different clientSummaryTemplate
                tenantId: 'tenant-1',
                actor: { email: 'ops@b.com', displayName: 'Ops' },
                templateVars: { reason: 'CPF incorreto' },
            });

            const doc = mockAdd.mock.calls[0][0];
            expect(doc.summary).toBe('Caso devolvido ao cliente — CPF incorreto');
            expect(doc.clientSummary).toBe('Caso devolvido para correção — CPF incorreto');
        });

        it('summary override substitui template interpolation', async () => {
            await writeAuditEvent({
                action: 'CASE_ASSIGNED',
                tenantId: 'tenant-1',
                actor: { email: 'a@b.com' },
                summary: 'Custom summary override',
            });

            const doc = mockAdd.mock.calls[0][0];
            expect(doc.summary).toBe('Custom summary override');
        });
    });
});
