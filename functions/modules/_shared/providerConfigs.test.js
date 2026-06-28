/**
 * Testes para providerConfigs.js — loaders e defaults de provedores
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  DEFAULT_FONTE_DATA_CONFIG,
  DEFAULT_ESCAVADOR_CONFIG,
  DEFAULT_ESCAVADOR2_CONFIG,
  DEFAULT_JUDIT_CONFIG,
  DEFAULT_BIGDATACORP_CONFIG,
  DEFAULT_DJEN_CONFIG,
  loadFonteDataConfig,
  loadEscavadorConfig,
  loadEscavador2Config,
  loadJuditConfig,
  loadBigDataCorpConfig,
  loadDjenConfig,
  _setDb,
} from './providerConfigs.js';

describe('providerConfigs', () => {
  const mockDocGet = vi.fn();
  const mockDoc = vi.fn(() => ({ get: mockDocGet }));
  const mockCollection = vi.fn(() => ({ doc: mockDoc }));
  const mockDb = { collection: mockCollection };

  beforeEach(() => {
    vi.clearAllMocks();
    _setDb(mockDb);
  });

  afterAll(() => {
    _setDb(null);
  });

  describe('DEFAULT_FONTE_DATA_CONFIG', () => {
    it('tem valores default corretos', () => {
      expect(DEFAULT_FONTE_DATA_CONFIG.enabled).toBe(false);
      expect(DEFAULT_FONTE_DATA_CONFIG.phases.identity).toBe(true);
      expect(DEFAULT_FONTE_DATA_CONFIG.phases.criminal).toBe(true);
      expect(DEFAULT_FONTE_DATA_CONFIG.phases.warrant).toBe(true);
      expect(DEFAULT_FONTE_DATA_CONFIG.phases.labor).toBe(true);
      expect(DEFAULT_FONTE_DATA_CONFIG.escalation.enabled).toBe(true);
      expect(DEFAULT_FONTE_DATA_CONFIG.escalation.triggers).toEqual(['criminal', 'warrant', 'highProcessCount']);
      expect(DEFAULT_FONTE_DATA_CONFIG.escalation.processCountThreshold).toBe(5);
      expect(DEFAULT_FONTE_DATA_CONFIG.filters).toEqual({ uf: '' });
      expect(DEFAULT_FONTE_DATA_CONFIG.gate.minNameSimilarity).toBe(0.7);
      expect(DEFAULT_FONTE_DATA_CONFIG.ai.enabled).toBe(false);
    });
  });

  describe('DEFAULT_ESCAVADOR_CONFIG', () => {
    it('tem valores default corretos', () => {
      expect(DEFAULT_ESCAVADOR_CONFIG.enabled).toBe(false);
      expect(DEFAULT_ESCAVADOR_CONFIG.phases.processos).toBe(true);
      expect(DEFAULT_ESCAVADOR_CONFIG.filters.incluirHomonimos).toBe(true);
      expect(DEFAULT_ESCAVADOR_CONFIG.filters.autoTribunais).toBe(false);
      expect(DEFAULT_ESCAVADOR_CONFIG.filters.tribunais).toEqual([]);
      expect(DEFAULT_ESCAVADOR_CONFIG.filters.status).toBeNull();
    });
  });

  describe('DEFAULT_ESCAVADOR2_CONFIG', () => {
    it('tem valores default corretos', () => {
      expect(DEFAULT_ESCAVADOR2_CONFIG.enabled).toBe(false);
      expect(DEFAULT_ESCAVADOR2_CONFIG.phases.processos).toBe(true);
      expect(DEFAULT_ESCAVADOR2_CONFIG.request.detalhar).toBe(true);
      expect(DEFAULT_ESCAVADOR2_CONFIG.request.movimentacoes).toBe('risk_only');
      expect(DEFAULT_ESCAVADOR2_CONFIG.request.documentos).toBe('risk_only');
      expect(DEFAULT_ESCAVADOR2_CONFIG.request.limit_movimentacoes).toBe(20);
      expect(DEFAULT_ESCAVADOR2_CONFIG.request.limit_documentos).toBe(20);
      expect(DEFAULT_ESCAVADOR2_CONFIG.dedupe.dateToleranceDays).toBe(90);
      expect(DEFAULT_ESCAVADOR2_CONFIG.persistence.saveRawPayloads).toBe(true);
    });
  });

  describe('DEFAULT_JUDIT_CONFIG', () => {
    it('tem valores default corretos', () => {
      expect(DEFAULT_JUDIT_CONFIG.enabled).toBe(true);
      expect(DEFAULT_JUDIT_CONFIG.phases.entity).toBe(false);
      expect(DEFAULT_JUDIT_CONFIG.phases.lawsuits).toBe(true);
      expect(DEFAULT_JUDIT_CONFIG.phases.warrant).toBe(true);
      expect(DEFAULT_JUDIT_CONFIG.phases.execution).toBe(false);
      expect(DEFAULT_JUDIT_CONFIG.escalation.triggerEscavador).toEqual(['criminal', 'warrant', 'execution', 'highProcessCount']);
      expect(DEFAULT_JUDIT_CONFIG.filters.autoTribunals).toBe(false);
      expect(DEFAULT_JUDIT_CONFIG.filters.useAsync).toBe(false);
      expect(DEFAULT_JUDIT_CONFIG.filters.useWebhook).toBe(true);
      expect(DEFAULT_JUDIT_CONFIG.filters.cacheTtlDays).toBe(7);
      expect(DEFAULT_JUDIT_CONFIG.gate.minNameSimilarity).toBe(0.7);
      expect(DEFAULT_JUDIT_CONFIG.nameSearchSupplement.enabled).toBe(true);
      expect(DEFAULT_JUDIT_CONFIG.persistence.saveRawPayloads).toBe(true);
    });
  });

  describe('DEFAULT_BIGDATACORP_CONFIG', () => {
    it('tem valores default corretos', () => {
      expect(DEFAULT_BIGDATACORP_CONFIG.enabled).toBe(true);
      expect(DEFAULT_BIGDATACORP_CONFIG.phases.basicData).toBe(true);
      expect(DEFAULT_BIGDATACORP_CONFIG.phases.processes).toBe(true);
      expect(DEFAULT_BIGDATACORP_CONFIG.phases.kyc).toBe(true);
      expect(DEFAULT_BIGDATACORP_CONFIG.phases.occupation).toBe(true);
      expect(DEFAULT_BIGDATACORP_CONFIG.gate.minNameSimilarity).toBe(0.7);
      expect(DEFAULT_BIGDATACORP_CONFIG.processLimit).toBe(100);
    });
  });

  describe('DEFAULT_DJEN_CONFIG', () => {
    it('tem valores default corretos', () => {
      expect(DEFAULT_DJEN_CONFIG.enabled).toBe(false);
      expect(DEFAULT_DJEN_CONFIG.phases.comunicacoes).toBe(true);
      expect(DEFAULT_DJEN_CONFIG.searchStrategy).toBe('hybrid');
      expect(DEFAULT_DJEN_CONFIG.maxPages).toBe(3);
      expect(DEFAULT_DJEN_CONFIG.filters.siglaTribunal).toBeNull();
      expect(DEFAULT_DJEN_CONFIG.nameMatchThreshold).toBe(0.85);
    });
  });

  describe('loadFonteDataConfig', () => {
    it('retorna default quando tenant não existe', async () => {
      mockDocGet.mockResolvedValue({ exists: false });
      const result = await loadFonteDataConfig('tenant-1');
      expect(result.enabled).toBe(false);
      expect(result.phases.identity).toBe(true);
      expect(mockCollection).toHaveBeenCalledWith('tenantSettings');
      expect(mockDoc).toHaveBeenCalledWith('tenant-1');
    });

    it('merge config do tenant corretamente', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          enrichmentConfig: {
            enabled: true,
            phases: { identity: false },
            filters: { uf: 'SP' },
          },
        }),
      });
      const result = await loadFonteDataConfig('tenant-1');
      expect(result.enabled).toBe(true);
      expect(result.phases.identity).toBe(false);
      expect(result.phases.criminal).toBe(true);
      expect(result.filters.uf).toBe('SP');
    });

    it('retorna default quando enrichmentConfig é ausente', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({}),
      });
      const result = await loadFonteDataConfig('tenant-1');
      expect(result.enabled).toBe(false);
    });

    it('retorna default para tenantId vazio', async () => {
      const result = await loadFonteDataConfig('');
      expect(result.enabled).toBe(false);
      expect(mockCollection).not.toHaveBeenCalled();
    });
  });

  describe('loadEscavadorConfig', () => {
    it('retorna default quando não há config', async () => {
      mockDocGet.mockResolvedValue({ exists: false });
      const result = await loadEscavadorConfig('tenant-1');
      expect(result.enabled).toBe(false);
      expect(result.filters.incluirHomonimos).toBe(true);
    });

    it('merge config do tenant', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          enrichmentConfig: {
            escavador: {
              enabled: true,
              filters: { autoTribunais: true },
            },
          },
        }),
      });
      const result = await loadEscavadorConfig('tenant-1');
      expect(result.enabled).toBe(true);
      expect(result.filters.autoTribunais).toBe(true);
      expect(result.filters.incluirHomonimos).toBe(true);
    });
  });

  describe('loadEscavador2Config', () => {
    it('retorna default quando não há config', async () => {
      mockDocGet.mockResolvedValue({ exists: false });
      const result = await loadEscavador2Config('tenant-1');
      expect(result.enabled).toBe(false);
      expect(result.request.detalhar).toBe(true);
      expect(result.dedupe.dateToleranceDays).toBe(90);
    });

    it('merge config do tenant preservando defaults aninhados', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          enrichmentConfig: {
            escavador2: {
              enabled: true,
              request: {
                movimentacoes: 'always',
                limit_documentos: 5,
              },
              dedupe: {
                dateToleranceDays: 30,
              },
            },
          },
        }),
      });
      const result = await loadEscavador2Config('tenant-1');
      expect(result.enabled).toBe(true);
      expect(result.phases.processos).toBe(true);
      expect(result.request.detalhar).toBe(true);
      expect(result.request.movimentacoes).toBe('always');
      expect(result.request.documentos).toBe('risk_only');
      expect(result.request.limit_movimentacoes).toBe(20);
      expect(result.request.limit_documentos).toBe(5);
      expect(result.dedupe.dateToleranceDays).toBe(30);
      expect(result.persistence.saveRawPayloads).toBe(true);
    });

    it('loads Escavador2 async defaults and merges tenant overrides', async () => {
      const {
        loadEscavador2Config,
        _setDb,
      } = await import('./providerConfigs.js');

      _setDb({
        collection: () => ({
          doc: () => ({
            get: async () => ({
              exists: true,
              data: () => ({
                enrichmentConfig: {
                  escavador2: {
                    enabled: true,
                    async: { enabled: false },
                  },
                },
              }),
            }),
          }),
        }),
      });

      const config = await loadEscavador2Config('tenant-1');

      expect(config.enabled).toBe(true);
      expect(config.async).toEqual({
        enabled: false,
        callbackUrlEnv: 'ESCAVADOR2_CALLBACK_URL',
      });
    });
  });

  describe('loadJuditConfig', () => {
    it('retorna default quando não há config', async () => {
      mockDocGet.mockResolvedValue({ exists: false });
      const result = await loadJuditConfig('tenant-1');
      expect(result.enabled).toBe(true);
      expect(result.phases.lawsuits).toBe(true);
    });

    it('merge config do tenant e gate global', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          enrichmentConfig: {
            gate: { minNameSimilarity: 0.9 },
            judit: {
              phases: { execution: true },
              filters: { useAsync: true },
            },
          },
        }),
      });
      const result = await loadJuditConfig('tenant-1');
      expect(result.phases.execution).toBe(true);
      expect(result.filters.useAsync).toBe(true);
      expect(result.gate.minNameSimilarity).toBe(0.9);
    });
  });

  describe('loadBigDataCorpConfig', () => {
    it('retorna default quando não há config', async () => {
      mockDocGet.mockResolvedValue({ exists: false });
      const result = await loadBigDataCorpConfig('tenant-1');
      expect(result.enabled).toBe(true);
      expect(result.phases.basicData).toBe(true);
    });

    it('merge config do tenant e gate global', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          enrichmentConfig: {
            gate: { minNameSimilarity: 0.8 },
            bigdatacorp: {
              enabled: false,
              phases: { kyc: false },
            },
          },
        }),
      });
      const result = await loadBigDataCorpConfig('tenant-1');
      expect(result.enabled).toBe(false);
      expect(result.phases.kyc).toBe(false);
      expect(result.gate.minNameSimilarity).toBe(0.8);
    });
  });

  describe('loadDjenConfig', () => {
    it('retorna default quando não há config', async () => {
      mockDocGet.mockResolvedValue({ exists: false });
      const result = await loadDjenConfig('tenant-1');
      expect(result.enabled).toBe(false);
      expect(result.phases.comunicacoes).toBe(true);
    });

    it('merge config do tenant', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          enrichmentConfig: {
            djen: {
              enabled: true,
              maxPages: 10,
            },
          },
        }),
      });
      const result = await loadDjenConfig('tenant-1');
      expect(result.enabled).toBe(true);
      expect(result.maxPages).toBe(10);
      expect(result.phases.comunicacoes).toBe(true);
    });
  });
});
