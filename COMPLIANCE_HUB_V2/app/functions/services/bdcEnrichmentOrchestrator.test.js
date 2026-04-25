import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { enrichFromPreset, enrichDataset, DATASET_NORMALIZERS } = require('./bdcEnrichmentOrchestrator');

describe('bdcEnrichmentOrchestrator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const credentials = { accessToken: 'token_123', tokenId: 'id_456' };

  describe('enrichFromPreset', () => {
    it('returns failed when BDC query throws', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await enrichFromPreset('48052053854', credentials, { presetKey: 'compliance', subjectType: 'pf' });

      expect(result.status).toBe('failed');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('normalizes all datasets from a mock BDC response', async () => {
      const mockEntry = {
        BasicData: { Name: 'Joao Silva', TaxIdStatus: 'REGULAR' },
        Processes: { Lawsuits: [{ Number: '123', ClassName: 'Ação Penal' }] },
        KycData: { IsCurrentlyPEP: false, SanctionsHistory: [] },
        ProfessionData: { IsEmployed: true, Professions: [{ Title: 'Developer' }] },
        ExtendedPhones: { Phones: [{ Phone: '11999999999', Type: 'PERSONAL' }], TotalPhones: 1 },
        OnlinePresence: { InternetUsageLevel: 'HIGH', TotalWebPassages: 42 },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ Result: [mockEntry] }),
      });

      const result = await enrichFromPreset('48052053854', credentials, {
        presetKey: 'dossier_pf_full',
        subjectType: 'pf',
        extraDatasets: ['phones_extended', 'online_presence'],
      });

      expect(result.status).toBe('done');
      expect(result.sections.basic_data).toBeDefined();
      expect(result.sections.basic_data.basicData).toBeDefined();
      expect(result.sections.processes).toBeDefined();
      expect(result.sections.kyc).toBeDefined();
      expect(result.sections.online_presence).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('handles datasets missing from BDC response gracefully', async () => {
      const mockEntry = {
        BasicData: { Name: 'Maria Souza' },
        // Processes, KYC, etc. missing
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ Result: [mockEntry] }),
      });

      const result = await enrichFromPreset('48052053854', credentials, {
        presetKey: 'compliance',
        subjectType: 'pf',
      });

      expect(result.status).toBe('done');
      expect(result.sections.basic_data).toBeDefined();
      expect(result.sections.processes).toBeUndefined();
      expect(result.sections.kyc).toBeUndefined();
    });
  });

  describe('enrichDataset', () => {
    it('calls queryDataset and normalizes result', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          Result: [{ GovernmentDebtors: { IsGovernmentDebtor: true, DebtAmount: '5000' } }],
        }),
      });

      const result = await enrichDataset('48052053854', 'government_debtors', credentials, 'pf');

      expect(result.governmentDebtors).toBeDefined();
      expect(result.governmentDebtors.isGovernmentDebtor).toBe(true);
    });
  });

  describe('DATASET_NORMALIZERS', () => {
    it('has normalizers for all expected datasets', () => {
      const expected = [
        'basic_data', 'kyc', 'processes', 'occupation_data',
        'phones_extended', 'addresses_extended', 'emails_extended',
        'online_presence', 'financial_data', 'class_organization',
        'relationships', 'activity_indicators', 'company_evolution',
        'owners_kyc', 'government_debtors', 'collections',
        'financial_risk', 'indebtedness_question', 'historical_basic_data',
        'media_profile_and_exposure', 'lawsuits_distribution_data', 'profession_data',
        'owners_lawsuits', 'employees_kyc', 'economic_group_kyc',
        'dynamic_qsa_data', 'history_basic_data', 'merchant_category_data',
        'syndicate_agreements', 'social_conscience', 'online_ads',
      ];
      for (const ds of expected) {
        expect(DATASET_NORMALIZERS[ds]).toBeDefined();
        expect(typeof DATASET_NORMALIZERS[ds]).toBe('function');
      }
    });

    it('basic_data normalizer returns structured data for PF', () => {
      const raw = {
        Name: 'Test User',
        TaxIdStatus: 'REGULAR',
        Emails: [{ Email: 'test@example.com', Type: 'PERSONAL' }],
      };
      const result = DATASET_NORMALIZERS.basic_data(raw, 'pf');
      expect(result.basicData).toBeDefined();
      expect(result.contacts.emails).toHaveLength(1);
    });

    it('kyc normalizer returns evidence', () => {
      const raw = { IsCurrentlyPEP: true, PEPHistory: [{ Level: 1 }] };
      const result = DATASET_NORMALIZERS.kyc(raw);
      expect(result.kyc.hasPep).toBe(true);
      expect(result.evidence).toBeDefined();
    });

    it('online_presence normalizer handles empty data', () => {
      const result = DATASET_NORMALIZERS.online_presence(null);
      expect(result.onlinePresence).toBeNull();
      expect(result.evidence.text).toContain('Nenhum');
    });

    it('government_debtors normalizer flags debtor', () => {
      const raw = { IsGovernmentDebtor: true, DebtAmount: '10000', Organ: 'Receita Federal' };
      const result = DATASET_NORMALIZERS.government_debtors(raw);
      expect(result.governmentDebtors.isGovernmentDebtor).toBe(true);
      expect(result.evidence.text).toContain('Receita Federal');
    });

    it('collections normalizer handles multiple companies', () => {
      const raw = {
        IsPresentInCollection: true,
        CollectionCompanies: [
          { Name: 'Cobrança A', CNPJ: '12345678000195' },
          { Name: 'Cobrança B', CNPJ: '98765432000106' },
        ],
      };
      const result = DATASET_NORMALIZERS.collections(raw);
      expect(result.collections.totalCompanies).toBe(2);
      expect(result.collections.activeCompanies).toBe(2);
    });
  });
});
