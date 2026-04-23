import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { normalizeBigDataCorpKyc } = require('./bigdatacorp');

describe('normalizeBigDataCorpKyc', () => {
    const BASE_KYC = {
        IsPEP: false,
        PEPHistory: [],
        SanctionsHistory: [],
        IsCurrentlySanctioned: false,
        WasPreviouslySanctioned: false,
    };

    describe('P6+P11: isSanctioned false when BDC flag is true but no international sanctions pass filter', () => {
        it('should set isSanctioned=false when IsCurrentlySanctioned=true but all matches have low MatchRate', () => {
            const kycData = {
                ...BASE_KYC,
                IsCurrentlySanctioned: true,
                WasPreviouslySanctioned: true,
                SanctionsHistory: [
                    { Source: 'INTERPOL', MatchRate: 50, StandardizedSanctionType: 'WANTED', IsCurrentlyPresentOnSource: true },
                    { Source: 'FBI', MatchRate: 60, StandardizedSanctionType: 'WANTED', IsCurrentlyPresentOnSource: true },
                ],
            };
            const result = normalizeBigDataCorpKyc(kycData);
            expect(result.bigdatacorpIsSanctioned).toBe(false);
            expect(result.bigdatacorpSanctionCount).toBe(0);
            expect(result.bigdatacorpKycNotes).toContain('Sem sancoes detectadas');
            expect(result.bigdatacorpKycNotes).not.toContain('SANCIONADO ATUALMENTE');
        });

        it('should set isSanctioned=true when international sanctions pass MatchRate filter', () => {
            const kycData = {
                ...BASE_KYC,
                IsCurrentlySanctioned: true,
                SanctionsHistory: [
                    { Source: 'INTERPOL', MatchRate: 95, StandardizedSanctionType: 'WANTED', IsCurrentlyPresentOnSource: true },
                ],
            };
            const result = normalizeBigDataCorpKyc(kycData);
            expect(result.bigdatacorpIsSanctioned).toBe(true);
            expect(result.bigdatacorpSanctionCount).toBe(1);
            expect(result.bigdatacorpKycNotes).toContain('SANCIONADO ATUALMENTE: INTERPOL');
        });

        it('should set isSanctioned=false when only domestic CNJ entries pass filter', () => {
            const kycData = {
                ...BASE_KYC,
                IsCurrentlySanctioned: true,
                SanctionsHistory: [
                    { Source: 'CNJ', MatchRate: 100, StandardizedSanctionType: 'ARREST WARRANTS', IsCurrentlyPresentOnSource: true, Details: { ProcessNumber: '0204723542022806016701000326' } },
                ],
            };
            const result = normalizeBigDataCorpKyc(kycData);
            expect(result.bigdatacorpIsSanctioned).toBe(false);
            expect(result.bigdatacorpSanctionCount).toBe(0);
            expect(result.bigdatacorpKycNotes).toContain('Sem sancoes detectadas');
        });
    });

    describe('P7: hasArrestWarrant includes domestic CNJ warrants', () => {
        it('should set hasArrestWarrant=true when domestic CNJ has arrest warrants', () => {
            const kycData = {
                ...BASE_KYC,
                SanctionsHistory: [
                    { Source: 'CNJ', MatchRate: 100, StandardizedSanctionType: 'ARREST WARRANTS', IsCurrentlyPresentOnSource: true, Details: { ProcessNumber: '020472354', ImprisonmentKind: 'CIVIL' } },
                    { Source: 'CNJ', MatchRate: 95, StandardizedSanctionType: 'ARREST WARRANTS', IsCurrentlyPresentOnSource: true, Details: { ProcessNumber: '020472355', ImprisonmentKind: 'CIVIL' } },
                ],
            };
            const result = normalizeBigDataCorpKyc(kycData);
            expect(result.bigdatacorpHasArrestWarrant).toBe(true);
            expect(result.bigdatacorpActiveWarrants).toHaveLength(2);
            expect(result.bigdatacorpActiveWarrants[0].isDomestic).toBe(true);
            expect(result.bigdatacorpActiveWarrants[1].isDomestic).toBe(true);
            // isSanctioned still false (only domestic, no international)
            expect(result.bigdatacorpIsSanctioned).toBe(false);
        });

        it('should set hasArrestWarrant=false when no warrants in any source', () => {
            const kycData = {
                ...BASE_KYC,
                SanctionsHistory: [
                    { Source: 'CNJ', MatchRate: 100, StandardizedSanctionType: 'FINANCIAL_INFRACTION', IsCurrentlyPresentOnSource: true },
                ],
            };
            const result = normalizeBigDataCorpKyc(kycData);
            expect(result.bigdatacorpHasArrestWarrant).toBe(false);
            expect(result.bigdatacorpActiveWarrants).toHaveLength(0);
        });

        it('should mark international warrants as isDomestic=false', () => {
            const kycData = {
                ...BASE_KYC,
                SanctionsHistory: [
                    { Source: 'INTERPOL', MatchRate: 95, StandardizedSanctionType: 'ARREST_WARRANT', IsCurrentlyPresentOnSource: true, Details: { ProcessNumber: 'INT-001' } },
                ],
            };
            const result = normalizeBigDataCorpKyc(kycData);
            expect(result.bigdatacorpHasArrestWarrant).toBe(true);
            expect(result.bigdatacorpActiveWarrants).toHaveLength(1);
            expect(result.bigdatacorpActiveWarrants[0].isDomestic).toBe(false);
        });
    });

    describe('notes generation', () => {
        it('should include domestic warrant alert in notes', () => {
            const kycData = {
                ...BASE_KYC,
                SanctionsHistory: [
                    { Source: 'CNJ', MatchRate: 100, StandardizedSanctionType: 'ARREST WARRANTS', IsCurrentlyPresentOnSource: true, Details: {} },
                ],
            };
            const result = normalizeBigDataCorpKyc(kycData);
            expect(result.bigdatacorpKycNotes).toContain('ALERTA: 1 mandado(s) de prisao');
        });
    });
});
