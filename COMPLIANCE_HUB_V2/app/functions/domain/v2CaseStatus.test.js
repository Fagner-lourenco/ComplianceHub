import { describe, it, expect } from 'vitest';
import {
    CASE_STATUS_V2,
    mapLegacyStatusToV2,
    mapV2StatusToLegacy,
    isValidTransition,
    transitionCaseStatus,
    getInitialV2Status,
    deriveV2StatusFromEnrichment,
} from './v2CaseStatus.js';

describe('v2CaseStatus', () => {
    it('getInitialV2Status returns received', () => {
        expect(getInitialV2Status()).toBe('received');
    });

    it('maps legacy statuses to V2 correctly', () => {
        expect(mapLegacyStatusToV2('PENDING')).toBe(CASE_STATUS_V2.RECEIVED);
        expect(mapLegacyStatusToV2('RUNNING')).toBe(CASE_STATUS_V2.ENRICHING);
        expect(mapLegacyStatusToV2('IN_PROGRESS')).toBe(CASE_STATUS_V2.ENRICHING);
        expect(mapLegacyStatusToV2('DONE', { finalVerdict: 'APPROVED' })).toBe(CASE_STATUS_V2.PUBLISHED);
        expect(mapLegacyStatusToV2('DONE', {})).toBe(CASE_STATUS_V2.READY);
        expect(mapLegacyStatusToV2('PARTIAL', {})).toBe(CASE_STATUS_V2.READY);
        expect(mapLegacyStatusToV2('CORRECTION_NEEDED')).toBe(CASE_STATUS_V2.CORRECTION_NEEDED);
        expect(mapLegacyStatusToV2('BLOCKED')).toBe(CASE_STATUS_V2.CORRECTION_NEEDED);
    });

    it('maps V2 statuses back to legacy', () => {
        expect(mapV2StatusToLegacy(CASE_STATUS_V2.RECEIVED)).toBe('PENDING');
        expect(mapV2StatusToLegacy(CASE_STATUS_V2.ENRICHING)).toBe('RUNNING');
        expect(mapV2StatusToLegacy(CASE_STATUS_V2.READY)).toBe('PARTIAL');
        expect(mapV2StatusToLegacy(CASE_STATUS_V2.PUBLISHED)).toBe('DONE');
        expect(mapV2StatusToLegacy(CASE_STATUS_V2.CORRECTION_NEEDED)).toBe('CORRECTION_NEEDED');
    });

    it('allows valid transitions', () => {
        expect(isValidTransition('received', 'enriching')).toBe(true);
        expect(isValidTransition('enriching', 'ready')).toBe(true);
        expect(isValidTransition('ready', 'published')).toBe(true);
        expect(isValidTransition('ready', 'enriching')).toBe(true);
        expect(isValidTransition('correction_needed', 'enriching')).toBe(true);
    });

    it('rejects invalid transitions', () => {
        expect(isValidTransition('received', 'published')).toBe(false);
        expect(isValidTransition('received', 'ready')).toBe(false);
        expect(isValidTransition('published', 'received')).toBe(false);
    });

    it('transitionCaseStatus returns changed=true on valid move', () => {
        const result = transitionCaseStatus('received', 'enriching');
        expect(result.changed).toBe(true);
        expect(result.status).toBe('enriching');
        expect(result.error).toBeUndefined();
    });

    it('transitionCaseStatus returns changed=false on same status', () => {
        const result = transitionCaseStatus('received', 'received');
        expect(result.changed).toBe(false);
        expect(result.status).toBe('received');
    });

    it('transitionCaseStatus returns error on invalid move', () => {
        const result = transitionCaseStatus('received', 'published');
        expect(result.changed).toBe(false);
        expect(result.status).toBe('received');
        expect(result.error).toContain('Transicao invalida');
    });

    it('deriveV2StatusFromEnrichment maps provider statuses', () => {
        expect(deriveV2StatusFromEnrichment('RUNNING')).toBe('enriching');
        expect(deriveV2StatusFromEnrichment('DONE')).toBe('ready');
        expect(deriveV2StatusFromEnrichment('DONE', { finalVerdict: 'APPROVED' })).toBe('published');
        expect(deriveV2StatusFromEnrichment('BLOCKED')).toBe('correction_needed');
    });
});
