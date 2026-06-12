import { describe, expect, it } from 'vitest';
import { normalizeArea, normalizeEscavador2Response } from './escavador2.js';

const response = {
  consulta: { cpf: '12345678901', nome: 'JOAO TESTE', status: 'PARTIAL' },
  perfil: { nome: 'JOAO TESTE' },
  resumo: {
    total_processos: 2,
    tem_criminal: true,
    total_criminais: 1,
    tem_trabalhista: true,
    total_trabalhistas: 1,
    total_riscos_materiais: 1,
    total_cnj_mascarado: 1,
    total_cnj_completo_extraido: 1,
  },
  processos: [
    {
      status: { detalhes: 'DONE', movimentacoes: 'DONE', documentos: 'DONE' },
      cnj: {
        valor: '000xxxx-00.2024.8.26.0100',
        mascarado: true,
        valor_completo_extraido: '0001234-56.2024.8.26.0100',
        status_resolucao: 'FULL_FROM_RAW',
      },
      classificacao: { area: 'CRIMINAL', risco_material: true },
      papel_candidato: { tipo_principal: 'Reu', polo_principal: 'PASSIVO', categoria: 'DEFENDANT' },
      normalizado: {
        match: { tipo: 'CPF', confirmado_por: 'consulta_cpf', has_exact_cpf_match: true },
        dados: {
          classe: 'Acao Penal',
          assunto: 'Furto',
          tribunal_sigla: 'TJSP',
          uf: 'SP',
          data_inicio: '2024-01-01',
          ultima_movimentacao: '2026-06-01',
        },
      },
      movimentacoes_resumo: { total: 20, coletadas: 20 },
      documentos_resumo: { total: 2, coletados: 2 },
    },
    {
      cnj: { valor: '0009999-00.2023.5.09.0001', mascarado: false, status_resolucao: 'FULL_FROM_LIST' },
      classificacao: { area: 'LABOR', risco_material: false },
      papel_candidato: { tipo_principal: 'Reclamado', polo_principal: 'PASSIVO', categoria: 'DEFENDANT' },
      normalizado: {
        match: { has_exact_cpf_match: true },
        dados: { classe: 'Reclamacao Trabalhista', assunto: 'Verbas Rescisorias', tribunal_sigla: 'TRT9', uf: 'PR', data_inicio: '2023-03-10' },
      },
    },
  ],
  erros_parciais: [{ processo: 'x', erro: 'documento indisponivel' }],
  estatisticas: { elapsed_ms: 1234 },
};

describe('normalizeEscavador2Response', () => {
  it('maps response aggregates and statuses to escavador2 fields', () => {
    const normalized = normalizeEscavador2Response(response);

    expect(normalized.escavador2ApiStatus).toBe('PARTIAL');
    expect(normalized.escavador2ProcessTotal).toBe(2);
    expect(normalized.escavador2CriminalFlag).toBe('POSITIVE');
    expect(normalized.escavador2CriminalCount).toBe(1);
    expect(normalized.escavador2LaborFlag).toBe('POSITIVE');
    expect(normalized.escavador2LaborCount).toBe(1);
    expect(normalized.escavador2MaterialRiskCount).toBe(1);
    expect(normalized.escavador2CnjMaskedCount).toBe(1);
    expect(normalized.escavador2CnjExtractedCount).toBe(1);
    expect(normalized.escavador2CostBRL).toBe(0);
    expect(normalized.escavador2PartialErrors).toEqual(response.erros_parciais);
  });

  it('maps process-level normalized fields and source evidence', () => {
    const normalized = normalizeEscavador2Response(response);
    const first = normalized.escavador2Processos[0];
    const second = normalized.escavador2Processos[1];

    expect(first).toEqual(expect.objectContaining({
      numeroCnj: '0001234-56.2024.8.26.0100',
      numeroCnjMascarado: '000xxxx-00.2024.8.26.0100',
      numeroCnjCompletoExtraido: '0001234-56.2024.8.26.0100',
      cnjResolutionStatus: 'FULL_FROM_RAW',
      area: 'CRIMINAL',
      isCriminal: true,
      isLabor: false,
      isMaterialRisk: true,
      tribunalSigla: 'TJSP',
      processUf: 'SP',
      classe: 'Acao Penal',
      assunto: 'Furto',
      dataInicio: '2024-01-01',
      ultimaMovimentacao: '2026-06-01',
      roleCategory: 'DEFENDANT',
      tipoPrincipal: 'Reu',
      polo: 'PASSIVO',
      hasExactCpfMatch: true,
    }));
    expect(second.numeroCnj).toBe('0009999-00.2023.5.09.0001');
    expect(second.numeroCnjMascarado).toBeNull();
    expect(first._sourceEscavador2).toEqual(expect.objectContaining({ provider: 'escavador2' }));
  });

  it('preserves response source payloads without mutating input', () => {
    const original = structuredClone(response);
    const normalized = normalizeEscavador2Response(response, { consultedAt: '2026-06-12T19:00:00.000Z' });

    expect(response).toEqual(original);
    expect(normalized.escavador2Sources).toEqual(expect.objectContaining({
      consulta: response.consulta,
      perfil: response.perfil,
      resumo: response.resumo,
      consultedAt: '2026-06-12T19:00:00.000Z',
    }));
    expect(normalized.escavador2RawPayloads).toEqual({ response });
  });

  it('does not generate consultedAt when no timestamp is provided', () => {
    const normalized = normalizeEscavador2Response(response);

    expect(normalized.escavador2Sources.consultedAt).toBeNull();
  });

  it('returns negative defaults for empty or missing resumo', () => {
    const normalized = normalizeEscavador2Response({ consulta: { status: 'DONE' }, processos: [] });

    expect(normalized.escavador2ProcessTotal).toBe(0);
    expect(normalized.escavador2CriminalFlag).toBe('NEGATIVE');
    expect(normalized.escavador2LaborFlag).toBe('NEGATIVE');
    expect(normalized.escavador2Processos).toEqual([]);
    expect(normalized.escavador2CostBRL).toBe(0);
  });

  it('returns defaults for null response and maps null process items safely', () => {
    expect(normalizeEscavador2Response(null)).toEqual(expect.objectContaining({
      escavador2ApiStatus: null,
      escavador2ProcessTotal: 0,
      escavador2Processos: [],
      escavador2CriminalFlag: 'NEGATIVE',
      escavador2LaborFlag: 'NEGATIVE',
      escavador2CostBRL: 0,
    }));

    const normalized = normalizeEscavador2Response({ processos: [null] });
    expect(normalized.escavador2Processos).toHaveLength(1);
    expect(normalized.escavador2Processos[0]).toEqual(expect.objectContaining({
      numeroCnj: null,
      area: 'UNKNOWN',
      isCriminal: false,
      isLabor: false,
      roleCategory: 'UNKNOWN',
      _sourceEscavador2: expect.objectContaining({ provider: 'escavador2' }),
    }));
  });
});

describe('normalizeArea', () => {
  it('maps API and Portuguese/domain area values', () => {
    expect(normalizeArea('TRABALHISTA')).toBe('LABOR');
    expect(normalizeArea('Direito do Trabalho')).toBe('LABOR');
    expect(normalizeArea('LABOR')).toBe('LABOR');
    expect(normalizeArea('PENAL')).toBe('CRIMINAL');
    expect(normalizeArea('CRIMINAL')).toBe('CRIMINAL');
    expect(normalizeArea('CIVIL')).toBe('CIVIL');
    expect(normalizeArea('administrativo')).toBe('UNKNOWN');
  });
});
