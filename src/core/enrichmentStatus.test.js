import { describe, it, expect } from 'vitest';
import { getOverallEnrichmentStatus } from './enrichmentStatus';

describe('getOverallEnrichmentStatus', () => {
    it('returns PENDING when no statuses are set', () => {
        expect(getOverallEnrichmentStatus({})).toBe('PENDING');
        expect(getOverallEnrichmentStatus(null)).toBe('PENDING');
    });

    it('returns RUNNING if any provider is RUNNING', () => {
        expect(getOverallEnrichmentStatus({ juditEnrichmentStatus: 'DONE', bigdatacorpEnrichmentStatus: 'RUNNING' })).toBe('RUNNING');
    });

    it('returns BLOCKED if any provider is BLOCKED', () => {
        expect(getOverallEnrichmentStatus({ juditEnrichmentStatus: 'BLOCKED' })).toBe('BLOCKED');
    });

    it('returns PARTIAL if any provider is PARTIAL', () => {
        expect(getOverallEnrichmentStatus({ juditEnrichmentStatus: 'DONE', escavadorEnrichmentStatus: 'PARTIAL' })).toBe('PARTIAL');
    });

    it('returns PARTIAL when DONE + FAILED coexist (BUG-6)', () => {
        expect(getOverallEnrichmentStatus({ juditEnrichmentStatus: 'DONE', enrichmentStatus: 'FAILED' })).toBe('PARTIAL');
    });

    it('returns FAILED when only FAILED statuses exist', () => {
        expect(getOverallEnrichmentStatus({ juditEnrichmentStatus: 'FAILED', enrichmentStatus: 'FAILED' })).toBe('FAILED');
    });

    it('returns DONE when all providers are DONE', () => {
        expect(getOverallEnrichmentStatus({ juditEnrichmentStatus: 'DONE', bigdatacorpEnrichmentStatus: 'DONE' })).toBe('DONE');
    });

    // P12: BigDataCorp was previously missing from the status array
    it('reflects bigdatacorpEnrichmentStatus RUNNING (P12 fix)', () => {
        expect(getOverallEnrichmentStatus({ juditEnrichmentStatus: 'DONE', escavadorEnrichmentStatus: 'DONE', bigdatacorpEnrichmentStatus: 'RUNNING' })).toBe('RUNNING');
    });

    it('reflects bigdatacorpEnrichmentStatus FAILED mixed with DONE (P12 fix)', () => {
        expect(getOverallEnrichmentStatus({ juditEnrichmentStatus: 'DONE', bigdatacorpEnrichmentStatus: 'FAILED' })).toBe('PARTIAL');
    });

    it('reflects bigdatacorpEnrichmentStatus BLOCKED (P12 fix)', () => {
        expect(getOverallEnrichmentStatus({ bigdatacorpEnrichmentStatus: 'BLOCKED' })).toBe('BLOCKED');
    });

    // DJEN integration
    it('reflects djenEnrichmentStatus RUNNING', () => {
        expect(getOverallEnrichmentStatus({ juditEnrichmentStatus: 'DONE', djenEnrichmentStatus: 'RUNNING' })).toBe('RUNNING');
    });

    it('reflects djenEnrichmentStatus FAILED mixed with DONE', () => {
        expect(getOverallEnrichmentStatus({ juditEnrichmentStatus: 'DONE', djenEnrichmentStatus: 'FAILED' })).toBe('PARTIAL');
    });
});
