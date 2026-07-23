import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase-admin before importing index.js
vi.mock('firebase-admin', () => ({
    initializeApp: vi.fn(),
    credential: { cert: vi.fn() },
    firestore: {
        FieldValue: {
            serverTimestamp: vi.fn(() => 'mock-timestamp'),
            delete: vi.fn(() => 'mock-delete'),
        },
    },
}));

vi.mock('firebase-functions/v2/https', () => ({
    onCall: vi.fn((opts, handler) => handler),
    HttpsError: class extends Error {
        constructor(code, message) {
            super(message);
            this.code = code;
        }
    },
}));

vi.mock('firebase-functions/logger', () => ({
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
}));

vi.mock('firebase-functions/params', () => ({
    defineSecret: vi.fn(() => ({ value: vi.fn() })),
}));

vi.mock('./caseCommunication.js', () => ({
    createSystemCaseMessage: vi.fn(),
    buildNotificationFunctions: vi.fn(() => ({
        NOTIFICATION_TYPES: { CASE_RETURNED: 'CASE_RETURNED' },
        createNotification: vi.fn(),
        findClientNotificationRecipientsForCase: vi.fn(() => Promise.resolve([])),
        sendCaseMessage: vi.fn(),
        markCaseCommunicationRead: vi.fn(),
    })),
}));

vi.mock('./audit/writeAuditEvent.js', () => ({
    __esModule: true,
    default: vi.fn(() => Promise.resolve()),
}));

vi.mock('./helpers/circuitBreaker.js', () => ({
    checkCircuit: vi.fn(() => Promise.resolve({ open: false })),
    recordSuccess: vi.fn(() => Promise.resolve()),
}));

// We need to import the _test exports after mocking
const mod = require('./index.js');
const { isIdentityGateBlocked, canBypassIdentityGate, buildIdentityGateCorrectionMessage, returnCaseForIdentityGateBlock } = mod.__test;

describe('identityGate helpers', () => {
    describe('isIdentityGateBlocked', () => {
        it('returns false when no gate is blocked', () => {
            expect(isIdentityGateBlocked({})).toBe(false);
            expect(isIdentityGateBlocked({ bigdatacorpGateResult: { passed: true } })).toBe(false);
        });

        it('returns true when bigdatacorpGateResult.passed === false', () => {
            expect(isIdentityGateBlocked({ bigdatacorpGateResult: { passed: false } })).toBe(true);
        });

        it('returns true when juditGateResult.passed === false', () => {
            expect(isIdentityGateBlocked({ juditGateResult: { passed: false } })).toBe(true);
        });

        it('returns true when enrichmentGateResult.passed === false', () => {
            expect(isIdentityGateBlocked({ enrichmentGateResult: { passed: false } })).toBe(true);
        });

        it('returns true when bigdatacorpEnrichmentStatus === BLOCKED', () => {
            expect(isIdentityGateBlocked({ bigdatacorpEnrichmentStatus: 'BLOCKED' })).toBe(true);
        });

        it('returns true when juditEnrichmentStatus === BLOCKED', () => {
            expect(isIdentityGateBlocked({ juditEnrichmentStatus: 'BLOCKED' })).toBe(true);
        });

        it('returns true when enrichmentStatus === BLOCKED', () => {
            expect(isIdentityGateBlocked({ enrichmentStatus: 'BLOCKED' })).toBe(true);
        });
    });

    describe('canBypassIdentityGate', () => {
        it('returns false for analyst', () => {
            expect(canBypassIdentityGate({ role: 'analyst' })).toBe(false);
        });

        it('returns true for supervisor', () => {
            expect(canBypassIdentityGate({ role: 'supervisor' })).toBe(true);
        });

        it('returns true for admin', () => {
            expect(canBypassIdentityGate({ role: 'admin' })).toBe(true);
        });

        it('returns true for owner', () => {
            expect(canBypassIdentityGate({ role: 'owner' })).toBe(true);
        });

        it('returns false for undefined/null', () => {
            expect(canBypassIdentityGate()).toBe(false);
            expect(canBypassIdentityGate(null)).toBe(false);
        });
    });

    describe('buildIdentityGateCorrectionMessage', () => {
        it('builds message with provider and reason', () => {
            const msg = buildIdentityGateCorrectionMessage('BigDataCorp', 'CPF cancelado');
            expect(msg).toContain('BigDataCorp');
            expect(msg).toContain('CPF cancelado');
        });

        it('uses default reason when none provided', () => {
            const msg = buildIdentityGateCorrectionMessage('Judit', null);
            expect(msg).toContain('Gate de identidade bloqueado');
        });
    });

    describe('returnCaseForIdentityGateBlock', () => {
        let caseRef;

        beforeEach(() => {
            caseRef = {
                update: vi.fn(() => Promise.resolve()),
            };
        });

        it('updates case with CORRECTION_NEEDED and blocked fields', async () => {
            const result = await returnCaseForIdentityGateBlock({
                caseRef,
                caseId: 'test-case',
                caseData: { tenantId: 't1', candidateName: 'Joao' },
                provider: 'bigdatacorp',
                providerLabel: 'BigDataCorp',
                gateReason: 'CPF cancelado',
                updateFields: { bigdatacorpEnrichmentStatus: 'BLOCKED' },
            });

            expect(caseRef.update).toHaveBeenCalledTimes(1);
            const updateCall = caseRef.update.mock.calls[0][0];
            expect(updateCall.status).toBe('CORRECTION_NEEDED');
            expect(updateCall.correctionReason).toBe('identity_gate_blocked');
            expect(updateCall.correctionNotes).toBe('CPF cancelado');
            expect(updateCall.correctionRequestedBy).toBe('system_gate');
            expect(updateCall.bigdatacorpEnrichmentStatus).toBe('BLOCKED');
            expect(typeof updateCall.correctionRequestedAt).toBe('string');
            expect(new Date(updateCall.correctionRequestedAt).toString()).not.toBe('Invalid Date');
            expect(result.status).toBe('BLOCKED');
            expect(result.error).toBe('CPF cancelado');
        });

        it('continues even if messaging/audit fail', async () => {
            caseRef.update.mockRejectedValueOnce(new Error('Firestore error'));

            await expect(returnCaseForIdentityGateBlock({
                caseRef,
                caseId: 'test-case',
                caseData: { tenantId: 't1', candidateName: 'Joao' },
                provider: 'bigdatacorp',
                providerLabel: 'BigDataCorp',
                gateReason: 'CPF cancelado',
                updateFields: {},
            })).rejects.toThrow('Firestore error');
        });
    });
});
