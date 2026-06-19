/**
 * Testes para aiEnabledHelper.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isAiEnabledForTenant } from './aiEnabledHelper.js';

describe('aiEnabledHelper', () => {
  const mockDocGet = vi.fn();
  const ledgerDocGet = vi.fn();
  const ledgerCollection = {
    doc: vi.fn(() => ({ get: ledgerDocGet })),
  };
  const mockDoc = vi.fn(() => ({
    get: mockDocGet,
    collection: vi.fn(() => ledgerCollection),
  }));

  // Cadeia Firestore simulada: collection().where().where().select().get()
  const forEachCases = vi.fn();
  const casesGet = vi.fn(() => ({ forEach: forEachCases }));
  const casesSelect = vi.fn(() => ({ get: casesGet }));
  const casesWhere2 = vi.fn(() => ({ select: casesSelect }));
  const casesWhere1 = vi.fn(() => ({ where: casesWhere2 }));

  const mockDb = {
    collection: vi.fn((name) => {
      if (name === 'tenantSettings') return { doc: mockDoc };
      if (name === 'cases') return { where: casesWhere1 };
      return { doc: vi.fn() };
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    forEachCases.mockClear();
  });

  it('retorna disabled quando tenantId é vazio', async () => {
    const result = await isAiEnabledForTenant('', mockDb);
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe('Tenant ou banco de dados não informado.');
  });

  it('retorna disabled quando db é ausente', async () => {
    const result = await isAiEnabledForTenant('tenant-1', null);
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe('Tenant ou banco de dados não informado.');
  });

  it('retorna disabled quando IA não está habilitada', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ enrichmentConfig: { ai: { enabled: false } } }),
    });
    const result = await isAiEnabledForTenant('tenant-1', mockDb);
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe('IA desabilitada para este tenant.');
  });

  it('retorna enabled quando IA está habilitada sem budget', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ enrichmentConfig: { ai: { enabled: true } } }),
    });
    const result = await isAiEnabledForTenant('tenant-1', mockDb);
    expect(result.enabled).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('retorna enabled quando budget não foi atingido (ledger)', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ enrichmentConfig: { ai: { enabled: true, monthlyBudgetUsd: 10 } } }),
    });
    ledgerDocGet.mockResolvedValue({ exists: true, data: () => ({ totalCostUsd: 5 }) });
    const result = await isAiEnabledForTenant('tenant-1', mockDb);
    expect(result.enabled).toBe(true);
    expect(result.totalCost).toBe(5);
    expect(result.budget).toBe(10);
  });

  it('retorna disabled quando budget foi atingido (ledger)', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ enrichmentConfig: { ai: { enabled: true, monthlyBudgetUsd: 10 } } }),
    });
    ledgerDocGet.mockResolvedValue({ exists: true, data: () => ({ totalCostUsd: 12 }) });
    const result = await isAiEnabledForTenant('tenant-1', mockDb);
    expect(result.enabled).toBe(false);
    expect(result.reason).toMatch(/Budget mensal excedido/);
    expect(result.totalCost).toBe(12);
    expect(result.budget).toBe(10);
  });

  it('fallback para scan de casos quando ledger não existe', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ enrichmentConfig: { ai: { enabled: true, monthlyBudgetUsd: 100 } } }),
    });
    ledgerDocGet.mockResolvedValue({ exists: false });
    forEachCases.mockImplementation((cb) => {
      cb({ data: () => ({ aiCostUsd: 10, aiHomonymCostUsd: 5, aiClassificationReviewCostUsd: 3 }) });
    });
    const result = await isAiEnabledForTenant('tenant-1', mockDb);
    expect(result.enabled).toBe(true);
    expect(result.totalCost).toBe(18);
  });

  it('retorna disabled quando scan de casos excede budget', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ enrichmentConfig: { ai: { enabled: true, monthlyBudgetUsd: 10 } } }),
    });
    ledgerDocGet.mockResolvedValue({ exists: false });
    forEachCases.mockImplementation((cb) => {
      cb({ data: () => ({ aiCostUsd: 8, aiHomonymCostUsd: 2, aiClassificationReviewCostUsd: 1 }) });
    });
    const result = await isAiEnabledForTenant('tenant-1', mockDb);
    expect(result.enabled).toBe(false);
    expect(result.reason).toMatch(/Budget mensal excedido/);
  });

  it('retorna disabled quando leitura do tenant falha', async () => {
    mockDocGet.mockRejectedValue(new Error('firestore error'));
    const result = await isAiEnabledForTenant('tenant-1', mockDb);
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe('Falha ao ler configurações do tenant.');
  });
});
