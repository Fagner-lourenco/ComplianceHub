import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
    normalizeBigDataCorpBasicData,
    normalizeBigDataCorpProcesses,
    normalizeBigDataCorpKyc,
    normalizeBigDataCorpProfession,
} = require('./bigdatacorp');
const {
    normalizeFinancialRisk,
    buildFinancialRiskEvidence,
    normalizeIndebtedness,
    buildIndebtednessEvidence,
} = require('./bigdatacorp/risk');
const {
    normalizeMediaProfile,
    buildMediaProfileEvidence,
} = require('./bigdatacorp/mediaProfile');
const {
    normalizeLawsuitsDistribution,
    buildLawsuitsDistributionEvidence,
} = require('./bigdatacorp/lawsuitsDistribution');
const {
    normalizeHistoricalBasicData,
    buildHistoricalBasicDataEvidence,
} = require('./bigdatacorp/historicalBasicData');
const {
    normalizeEmployeesKyc,
    buildEmployeesKycEvidence,
} = require('./bigdatacorp/employeesKyc');
const {
    normalizeEconomicGroupKyc,
    buildEconomicGroupKycEvidence,
} = require('./bigdatacorp/economicGroupKyc');
const {
    normalizeDynamicQsa,
    buildDynamicQsaEvidence,
} = require('./bigdatacorp/dynamicQsa');
const {
    normalizeOwnersLawsuits,
    buildOwnersLawsuitsEvidence,
} = require('./bigdatacorp/ownersLawsuits');
const {
    normalizeHistoryBasicData,
    buildHistoryBasicDataEvidence,
} = require('./bigdatacorp/historyBasicData');
const {
    normalizeMerchantCategory,
    buildMerchantCategoryEvidence,
} = require('./bigdatacorp/merchantCategory');
const {
    normalizeSyndicateAgreements,
    buildSyndicateAgreementsEvidence,
} = require('./bigdatacorp/syndicateAgreements');
const {
    normalizeSocialConscience,
    buildSocialConscienceEvidence,
} = require('./bigdatacorp/socialConscience');
const {
    normalizeOnlineAds,
    buildOnlineAdsEvidence,
} = require('./bigdatacorp/onlineAds');

describe('bigdatacorp normalizers', () => {
    // ── basic_data ──────────────────────────────────────────────────────────

    it('normalizeBigDataCorpBasicData returns fields for found person', () => {
        const basicData = {
            Name: 'ANDRE LUIZ CRUZ DOS SANTOS',
            TaxIdStatus: 'REGULAR',
            Gender: 'M',
            BirthDate: '1997-07-24T00:00:00Z',
            MotherName: 'VALDINEIDE PINTO DA CRUZ',
            FatherName: 'JOSE LUIZ DOS SANTOS FILHO',
            Age: 28,
            NumberOfFullNameNamesakes: 8,
            NameUniquenessScore: 0.984,
            HasObitIndication: false,
            BirthCountry: 'BRASILEIRA',
            TaxIdFiscalRegion: 'SP',
        };

        const result = normalizeBigDataCorpBasicData(basicData);
        expect(result.bigdatacorpName).toBe('ANDRE LUIZ CRUZ DOS SANTOS');
        expect(result.bigdatacorpCpfStatus).toBe('REGULAR');
        expect(result.bigdatacorpGender).toBe('M');
        expect(result.bigdatacorpBirthDate).toBe('1997-07-24T00:00:00Z');
        expect(result.bigdatacorpMotherName).toBe('VALDINEIDE PINTO DA CRUZ');
        expect(result.bigdatacorpHasDeathRecord).toBe(false);
        expect(result._source.found).toBe(true);
    });

    it('normalizeBigDataCorpBasicData returns nulls for missing data', () => {
        const result = normalizeBigDataCorpBasicData(null);
        expect(result.bigdatacorpName).toBeNull();
        expect(result.bigdatacorpHasDeathRecord).toBe(false);
        expect(result._source.found).toBe(false);
    });

    // ── processes ───────────────────────────────────────────────────────────

    it('normalizeBigDataCorpProcesses counts criminal and labor flags with CPF match', () => {
        const processesData = {
            Lawsuits: [
                { CourtType: 'CRIMINAL', Parties: [{ Doc: '48052053854' }] },
                { CourtType: 'TRABALHISTA', Parties: [{ Doc: '48052053854' }] },
                { CourtType: 'CIVIL', Parties: [{ Doc: '480.520.538-54' }] },
            ],
            TotalLawsuits: 3,
        };

        const result = normalizeBigDataCorpProcesses(processesData, '48052053854');
        expect(result.bigdatacorpProcessTotal).toBe(3);
        expect(result.bigdatacorpCriminalFlag).toBe('POSITIVE');
        expect(result.bigdatacorpLaborFlag).toBe('POSITIVE');
        expect(result._source.totalProcessos).toBe(3);
    });

    it('normalizeBigDataCorpProcesses returns NEGATIVE when no lawsuits', () => {
        const result = normalizeBigDataCorpProcesses({ Lawsuits: [], TotalLawsuits: 0 }, '48052053854');
        expect(result.bigdatacorpProcessTotal).toBe(0);
        expect(result.bigdatacorpCriminalFlag).toBe('NEGATIVE');
        expect(result.bigdatacorpLaborFlag).toBe('NEGATIVE');
    });

    it('normalizeBigDataCorpProcesses returns NEGATIVE for criminal/labor without CPF match', () => {
        const processesData = {
            Lawsuits: [
                { CourtType: 'CRIMINAL', Parties: [{ Doc: '12345678901' }] },
                { CourtType: 'TRABALHISTA' },
            ],
            TotalLawsuits: 2,
        };
        const result = normalizeBigDataCorpProcesses(processesData, '48052053854');
        expect(result.bigdatacorpCriminalFlag).toBe('NEGATIVE');
        expect(result.bigdatacorpLaborFlag).toBe('NEGATIVE');
        expect(result.bigdatacorpCriminalCount).toBe(1); // still counts raw criminal
    });

    // ── kyc ─────────────────────────────────────────────────────────────────

    it('normalizeBigDataCorpKyc filters sanctions with MatchRate >= 90', () => {
        const kycData = {
            IsCurrentlyPEP: false,
            SanctionsHistory: [
                { Source: 'CNJ', MatchRate: 100, StandardizedSanctionType: 'ARREST WARRANTS' },
                { Source: 'fbi', MatchRate: 49, StandardizedSanctionType: 'ARREST WARRANTS' },
                { Source: 'OFAC', MatchRate: 95, StandardizedSanctionType: 'FINANCIAL_CRIME', IsCurrentlyPresentOnSource: true },
            ],
        };

        const result = normalizeBigDataCorpKyc(kycData);
        expect(result.bigdatacorpIsPep).toBe(false);
        expect(result.bigdatacorpIsSanctioned).toBe(true);
        expect(result.bigdatacorpSanctionCount).toBe(1);
        expect(result.bigdatacorpActiveWarrants).toHaveLength(1); // CNJ domestic still counted for warrants
        expect(result.bigdatacorpActiveWarrants[0].matchRate).toBe(100);
        expect(result.bigdatacorpDomesticEntryCount).toBe(1);
    });

    it('normalizeBigDataCorpKyc returns negatives when no sanctions pass threshold', () => {
        const kycData = {
            IsCurrentlyPEP: false,
            SanctionsHistory: [
                { Source: 'interpol', MatchRate: 36 },
                { Source: 'ofac', MatchRate: 48 },
            ],
        };

        const result = normalizeBigDataCorpKyc(kycData);
        expect(result.bigdatacorpIsSanctioned).toBe(false);
        expect(result.bigdatacorpSanctionCount).toBe(0);
    });

    it('normalizeBigDataCorpKyc detects PEP', () => {
        const kycData = {
            IsCurrentlyPEP: true,
            PEPHistory: [{ Level: 'MUNICIPAL' }],
            SanctionsHistory: [],
        };

        const result = normalizeBigDataCorpKyc(kycData);
        expect(result.bigdatacorpIsPep).toBe(true);
        expect(result.bigdatacorpPepLevel).toBe('MUNICIPAL');
    });

    // ── profession ──────────────────────────────────────────────────────────

    it('normalizeBigDataCorpProfession extracts current job and employer', () => {
        const professionData = {
            Professions: [
                {
                    CompanyName: 'ACME CORP',
                    Level: 'MANAGER',
                    Income: 5000,
                    Status: 'ACTIVE',
                },
            ],
            TotalProfessions: 1,
            IsEmployed: true,
            TotalIncome: 5000,
        };

        const result = normalizeBigDataCorpProfession(professionData);
        expect(result.bigdatacorpEmployer).toBe('ACME CORP');
        expect(result.bigdatacorpCurrentJob).toBe('ACME CORP');
        expect(result.bigdatacorpTotalIncome).toBe(5000);
        expect(result.bigdatacorpIsEmployed).toBe(true);
    });

    it('normalizeBigDataCorpProfession handles empty profession data', () => {
        const result = normalizeBigDataCorpProfession(null);
        expect(result.bigdatacorpEmployer).toBeNull();
        expect(result.bigdatacorpProfessionHistory).toHaveLength(0);
    });

    // ── financial_risk ──────────────────────────────────────────────────────

    it('normalizeFinancialRisk extracts risk level and score', () => {
        const riskData = {
            FinancialRiskLevel: 'C',
            FinancialRiskScore: 650,
            TotalAssets: 'ABAIXO DE 100K',
            EstimatedIncomeRange: '3 A 5 SM',
            IsCurrentlyEmployed: true,
            IsCurrentlyOnCollection: false,
        };

        const result = normalizeFinancialRisk(riskData);
        expect(result.riskLevel).toBe('C');
        expect(result.riskScore).toBe(650);
        expect(result.totalAssets).toBe('ABAIXO DE 100K');
        expect(result.estimatedIncomeRange).toBe('3 A 5 SM');
        expect(result.isCurrentlyEmployed).toBe(true);
        expect(result.isCurrentlyOnCollection).toBe(false);
    });

    it('normalizeFinancialRisk returns null for null input', () => {
        const result = normalizeFinancialRisk(null);
        expect(result).toBeNull();
    });

    it('buildFinancialRiskEvidence formats evidence string', () => {
        const risk = { riskLevel: 'C', riskScore: 650, totalAssets: 'ABAIXO DE 100K', estimatedIncomeRange: '3 A 5 SM' };
        expect(buildFinancialRiskEvidence(risk)).toContain('Nível: C');
        expect(buildFinancialRiskEvidence(risk)).toContain('Score: 650');
    });

    // ── indebtedness ────────────────────────────────────────────────────────

    it('normalizeIndebtedness extracts likelyInDebt flag', () => {
        const debtData = { LikelyInDebt: true, IndebtednessProbability: 'HIGH' };
        const result = normalizeIndebtedness(debtData);
        expect(result.likelyInDebt).toBe(true);
        expect(result.indebtednessProbability).toBe('HIGH');
    });

    it('buildIndebtednessEvidence returns message when in debt', () => {
        expect(buildIndebtednessEvidence({ likelyInDebt: true })).toContain('inadimplência');
    });

    // ── media_profile_and_exposure ──────────────────────────────────────────

    it('normalizeMediaProfile extracts exposure levels', () => {
        const mediaData = {
            MediaExposureLevel: 'H',
            CelebrityLevel: 'H',
            UnpopularityLevel: 'L',
            TotalPages: 0,
            SearchLabels: { FullName: 'ANDRE SANTOS', FullNameUniquenessScore: 0.125 },
        };

        const result = normalizeMediaProfile(mediaData);
        expect(result.mediaExposureLevel).toBe('H');
        expect(result.celebrityLevel).toBe('H');
        expect(result.unpopularityLevel).toBe('L');
        expect(result.totalPages).toBe(0);
        expect(result.searchLabels.FullName).toBe('ANDRE SANTOS');
    });

    it('buildMediaProfileEvidence formats exposure summary', () => {
        const profile = { mediaExposureLevel: 'H', celebrityLevel: 'M', newsItems: [{ Title: 'Test' }] };
        expect(buildMediaProfileEvidence(profile)).toContain('Exposição Mídia: H');
    });

    // ── lawsuits_distribution_data ──────────────────────────────────────────

    it('normalizeLawsuitsDistribution extracts distributions', () => {
        const distData = {
            TotalLawsuits: 8,
            TypeDistribution: { 'ACAO PENAL': 2, 'TERMO CIRCUNSTANCIADO': 2 },
            StatusDistribution: { ATIVO: 2, ARQUIVADO: 3 },
            CourtTypeDistribution: { CRIMINAL: 4, CIVEL: 2 },
        };

        const result = normalizeLawsuitsDistribution(distData);
        expect(result.totalLawsuits).toBe(8);
        expect(result.typeDistribution['ACAO PENAL']).toBe(2);
        expect(result.statusDistribution.ARQUIVADO).toBe(3);
    });

    it('buildLawsuitsDistributionEvidence formats when there are lawsuits', () => {
        const dist = { totalLawsuits: 5, courtTypeDistribution: { CRIMINAL: 3, CIVEL: 2 } };
        expect(buildLawsuitsDistributionEvidence(dist)).toBe('5 processos | CRIMINAL: 3, CIVEL: 2');
    });

    it('buildLawsuitsDistributionEvidence returns null when no lawsuits', () => {
        expect(buildLawsuitsDistributionEvidence({ totalLawsuits: 0 })).toBeNull();
    });

    // ── historical_basic_data ───────────────────────────────────────────────

    it('normalizeHistoricalBasicData extracts change history', () => {
        const histData = {
            CurrentName: 'JOAO SILVA',
            CurrentStatus: 'REGULAR',
            NameChangesTotal: 2,
            StatusChangesTotal: 1,
            NameChangeHistory: [
                { ChangedDate: '2010-01-01T00:00:00Z', Name: 'JOAO SILVA', Gender: 'M' },
            ],
        };

        const result = normalizeHistoricalBasicData(histData);
        expect(result.currentName).toBe('JOAO SILVA');
        expect(result.nameChangesTotal).toBe(2);
        expect(result.statusChangesTotal).toBe(1);
        expect(result.nameChangeHistory).toHaveLength(1);
    });

    it('buildHistoricalBasicDataEvidence formats name changes', () => {
        expect(buildHistoricalBasicDataEvidence({ nameChangesTotal: 2 })).toContain('2 alteração');
    });

    it('buildHistoricalBasicDataEvidence returns null when no changes', () => {
        expect(buildHistoricalBasicDataEvidence({ nameChangesTotal: 0, statusChangesTotal: 0 })).toBeNull();
    });

    // ── employees_kyc ───────────────────────────────────────────────────────

    it('normalizeEmployeesKyc extracts employee KYC data', () => {
        const data = { TotalEmployees: 50, EmployeesWithSanctions: 2, EmployeesWithPep: 1 };
        const result = normalizeEmployeesKyc(data);
        expect(result.totalEmployees).toBe(50);
        expect(result.employeesWithSanctions).toBe(2);
        expect(result.employeesWithPep).toBe(1);
    });

    it('buildEmployeesKycEvidence formats sanctions and PEP counts', () => {
        expect(buildEmployeesKycEvidence({ employeesWithSanctions: 2, employeesWithPep: 1 })).toContain('2 funcionários sancionados');
    });

    // ── economic_group_kyc ──────────────────────────────────────────────────

    it('normalizeEconomicGroupKyc extracts group KYC data', () => {
        const data = { TotalCompanies: 5, CompaniesWithSanctions: 1, CompaniesWithPep: 0 };
        const result = normalizeEconomicGroupKyc(data);
        expect(result.totalCompanies).toBe(5);
        expect(result.companiesWithSanctions).toBe(1);
        expect(result.companiesWithPep).toBe(0);
    });

    it('buildEconomicGroupKycEvidence formats group sanctions', () => {
        expect(buildEconomicGroupKycEvidence({ companiesWithSanctions: 1 })).toContain('1 empresas do grupo sancionadas');
    });

    // ── dynamic_qsa ─────────────────────────────────────────────────────────

    it('normalizeDynamicQsa extracts QSA data', () => {
        const data = { QSA: [{ Name: 'João' }], TotalPartners: 1, LastUpdateDate: '2024-01-01' };
        const result = normalizeDynamicQsa(data);
        expect(result.totalPartners).toBe(1);
        expect(result.qsa).toHaveLength(1);
    });

    it('buildDynamicQsaEvidence formats partner count', () => {
        expect(buildDynamicQsaEvidence({ totalPartners: 3 })).toBe('3 sócios (QSA dinâmico)');
    });

    // ── owners_lawsuits ─────────────────────────────────────────────────────

    it('normalizeOwnersLawsuits extracts owner lawsuit data', () => {
        const data = { Lawsuits: [{}], TotalLawsuits: 1, OwnersWithLawsuits: 1 };
        const result = normalizeOwnersLawsuits(data);
        expect(result.totalLawsuits).toBe(1);
        expect(result.ownersWithLawsuits).toBe(1);
    });

    it('buildOwnersLawsuitsEvidence formats lawsuit count', () => {
        expect(buildOwnersLawsuitsEvidence({ totalLawsuits: 5 })).toBe('5 processos de sócios');
    });

    // ── history_basic_data ──────────────────────────────────────────────────

    it('normalizeHistoryBasicData extracts PJ history', () => {
        const data = { CurrentName: 'ACME LTDA', NameChangesTotal: 1, StatusChangesTotal: 0 };
        const result = normalizeHistoryBasicData(data);
        expect(result.currentName).toBe('ACME LTDA');
        expect(result.nameChangesTotal).toBe(1);
    });

    it('buildHistoryBasicDataEvidence formats PJ changes', () => {
        expect(buildHistoryBasicDataEvidence({ nameChangesTotal: 2, statusChangesTotal: 1 })).toContain('2 alterações de nome');
    });

    // ── merchant_category ───────────────────────────────────────────────────

    it('normalizeMerchantCategory extracts MCC data', () => {
        const data = { MerchantCategory: 'RESTAURANTES', MCC: '5812' };
        const result = normalizeMerchantCategory(data);
        expect(result.merchantCategory).toBe('RESTAURANTES');
        expect(result.mcc).toBe('5812');
    });

    it('buildMerchantCategoryEvidence formats category', () => {
        expect(buildMerchantCategoryEvidence({ merchantCategory: 'RESTAURANTES' })).toBe('Categoria: RESTAURANTES');
    });

    // ── syndicate_agreements ────────────────────────────────────────────────

    it('normalizeSyndicateAgreements extracts agreements', () => {
        const data = { Agreements: [{}], TotalAgreements: 1 };
        const result = normalizeSyndicateAgreements(data);
        expect(result.totalAgreements).toBe(1);
    });

    it('buildSyndicateAgreementsEvidence formats agreement count', () => {
        expect(buildSyndicateAgreementsEvidence({ totalAgreements: 3 })).toBe('3 acordo(s) sindical');
    });

    // ── social_conscience ───────────────────────────────────────────────────

    it('normalizeSocialConscience extracts ESG score', () => {
        const data = { Score: 75, Level: 'ALTO' };
        const result = normalizeSocialConscience(data);
        expect(result.score).toBe(75);
        expect(result.level).toBe('ALTO');
    });

    it('buildSocialConscienceEvidence formats score', () => {
        expect(buildSocialConscienceEvidence({ score: 75 })).toBe('Consciência Social: 75');
    });

    // ── online_ads ──────────────────────────────────────────────────────────

    it('normalizeOnlineAds extracts ad data', () => {
        const data = { Ads: [{}], Platforms: ['Google'], TotalAds: 1 };
        const result = normalizeOnlineAds(data);
        expect(result.hasAds).toBe(true);
        expect(result.platforms).toContain('Google');
    });

    it('buildOnlineAdsEvidence formats ad summary', () => {
        expect(buildOnlineAdsEvidence({ hasAds: true, adCount: 5, platforms: ['Google', 'Facebook'] })).toContain('5 anúncio(s)');
    });
});
