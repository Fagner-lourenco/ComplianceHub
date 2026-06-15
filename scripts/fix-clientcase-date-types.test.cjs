// Vitest globals are enabled in vite.config.js (globals: true), so
// describe/it/expect are injected as globals — we do NOT `require('vitest')`
// because Vitest 4.0+ explicitly throws when imported via require() in CJS
// (see node_modules/vitest/index.cjs). The script under test is CJS and is
// loaded via require() below.
const {
    isStringIsoDate,
    buildFixPayload,
    buildUpdateMask,
} = require('./fix-clientcase-date-types.cjs');

describe('isStringIsoDate', () => {
    it('returns true for ISO 8601 UTC string', () => {
        expect(isStringIsoDate({ stringValue: '2026-06-02T16:34:50.012Z' })).toBe(true);
    });
    it('returns true for ISO 8601 with millis', () => {
        expect(isStringIsoDate({ stringValue: '2026-01-01T00:00:00.000Z' })).toBe(true);
    });
    it('returns true for ISO 8601 without millis', () => {
        expect(isStringIsoDate({ stringValue: '2026-12-31T23:59:59Z' })).toBe(true);
    });
    it('returns false for timestampValue', () => {
        expect(isStringIsoDate({ timestampValue: '2026-06-02T16:34:50.012Z' })).toBe(false);
    });
    it('returns false for nullValue', () => {
        expect(isStringIsoDate({ nullValue: null })).toBe(false);
    });
    it('returns false for missing field (undefined)', () => {
        expect(isStringIsoDate(undefined)).toBe(false);
    });
    it('returns false for empty string', () => {
        expect(isStringIsoDate({ stringValue: '' })).toBe(false);
    });
    it('returns false for non-ISO string', () => {
        expect(isStringIsoDate({ stringValue: '02/06/2026' })).toBe(false);
    });
    it('returns false for non-date string', () => {
        expect(isStringIsoDate({ stringValue: 'hello' })).toBe(false);
    });
    it('returns false for ISO date that does not parse', () => {
        expect(isStringIsoDate({ stringValue: '2026-13-99T99:99:99Z' })).toBe(false);
    });
    it('returns false for plain text that mentions a date', () => {
        expect(isStringIsoDate({ stringValue: 'Caso criado em 2026-06-02' })).toBe(false);
    });
});

describe('buildFixPayload', () => {
    it('converts 3 string dates to timestampValue', () => {
        const fields = {
            createdAt: { stringValue: '2026-06-02T16:34:50.012Z' },
            updatedAt: { stringValue: '2026-06-14T23:53:00.923Z' },
            concludedAt: { stringValue: '2026-06-02T17:51:05.191Z' },
        };
        const payload = buildFixPayload(fields);
        expect(payload).toEqual({
            createdAt: { timestampValue: '2026-06-02T16:34:50.012Z' },
            updatedAt: { timestampValue: '2026-06-14T23:53:00.923Z' },
            concludedAt: { timestampValue: '2026-06-02T17:51:05.191Z' },
        });
    });
    it('converts only the fields that are string dates', () => {
        const fields = {
            createdAt: { stringValue: '2026-06-02T16:34:50.012Z' },
            updatedAt: { timestampValue: '2026-06-11T12:37:30.664Z' },
            concludedAt: { timestampValue: '2026-06-11T12:37:30.664Z' },
        };
        const payload = buildFixPayload(fields);
        expect(payload).toEqual({
            createdAt: { timestampValue: '2026-06-02T16:34:50.012Z' },
        });
    });
    it('returns empty object when no date fields need conversion', () => {
        const fields = {
            createdAt: { timestampValue: '2026-06-02T16:34:50.012Z' },
            updatedAt: { timestampValue: '2026-06-14T23:53:00.923Z' },
            concludedAt: { timestampValue: '2026-06-02T17:51:05.191Z' },
        };
        expect(buildFixPayload(fields)).toEqual({});
    });
    it('returns empty object when fields are missing', () => {
        expect(buildFixPayload({})).toEqual({});
    });
    it('NEVER includes non-date fields even if present in input', () => {
        const fields = {
            createdAt: { stringValue: '2026-06-02T16:34:50.012Z' },
            candidateName: { stringValue: 'JOAO DA SILVA' },
            cpf: { stringValue: '12345678901' },
            status: { stringValue: 'DONE' },
            riskScore: { integerValue: '0' },
        };
        const payload = buildFixPayload(fields);
        expect(payload).toEqual({
            createdAt: { timestampValue: '2026-06-02T16:34:50.012Z' },
        });
        expect(Object.keys(payload)).toEqual(['createdAt']);
    });
    it('preserves the exact ISO string value (no rounding or rewriting)', () => {
        const fields = {
            createdAt: { stringValue: '2026-06-02T16:34:50.012345Z' },
        };
        expect(buildFixPayload(fields)).toEqual({
            createdAt: { timestampValue: '2026-06-02T16:34:50.012345Z' },
        });
    });
    it('handles one of three fields missing', () => {
        const fields = {
            createdAt: { stringValue: '2026-06-02T16:34:50.012Z' },
            updatedAt: { stringValue: '2026-06-14T23:53:00.923Z' },
            // concludedAt missing
        };
        const payload = buildFixPayload(fields);
        expect(payload).toEqual({
            createdAt: { timestampValue: '2026-06-02T16:34:50.012Z' },
            updatedAt: { timestampValue: '2026-06-14T23:53:00.923Z' },
        });
    });
    it('ignores string fields that are not ISO dates (e.g. createdDateKey)', () => {
        const fields = {
            createdAt: { stringValue: '2026-06-02T16:34:50.012Z' },
            createdDateKey: { stringValue: '2026-06-02' },
            createdMonthKey: { stringValue: '2026-06' },
        };
        const payload = buildFixPayload(fields);
        expect(payload).toEqual({
            createdAt: { timestampValue: '2026-06-02T16:34:50.012Z' },
        });
    });
});

describe('buildUpdateMask', () => {
    it('encodes three fields', () => {
        const mask = buildUpdateMask(['createdAt', 'updatedAt', 'concludedAt']);
        expect(mask).toBe(
            'updateMask.fieldPaths=createdAt&updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=concludedAt'
        );
    });
    it('encodes one field', () => {
        const mask = buildUpdateMask(['createdAt']);
        expect(mask).toBe('updateMask.fieldPaths=createdAt');
    });
    it('encodes empty list as empty string', () => {
        expect(buildUpdateMask([])).toBe('');
    });
});
