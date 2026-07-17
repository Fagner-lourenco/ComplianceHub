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
      lista: {
        polo_ativo: 'RODRIGO HENRIQUE',
        polo_passivo: 'Madero Industria e Comercio S.A',
      },
      classificacao: { area: 'LABOR', risco_material: false },
      papel_candidato: { tipo_principal: 'Reclamado', polo_principal: 'PASSIVO', categoria: 'DEFENDANT' },
      normalizado: {
        match: { has_exact_cpf_match: true },
        dados: {
          classe: 'Acao Trabalhista - Rito Sumarissimo',
          assunto: 'Acumulo de Funcao',
          tribunal_sigla: 'TRT-1',
          uf: 'RJ',
          cidade: 'Rio de Janeiro',
          orgao_julgador: '62a Vara do Trabalho do Rio de Janeiro',
          status_predito: 'ATIVO',
          data_inicio: '2026-05-25',
        },
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

  it('maps labor parties, predicted status, city and court unit', () => {
    const normalized = normalizeEscavador2Response(response);
    const labor = normalized.escavador2Processos[1];

    expect(labor).toEqual(expect.objectContaining({
      status: 'ATIVO',
      processCity: 'Rio de Janeiro',
      comarca: 'Rio de Janeiro',
      vara: '62a Vara do Trabalho do Rio de Janeiro',
      judgingBody: '62a Vara do Trabalho do Rio de Janeiro',
      parties: [
        { name: 'RODRIGO HENRIQUE', role: 'Polo Ativo', side: 'ACTIVE' },
        { name: 'Madero Industria e Comercio S.A', role: 'Polo Passivo', side: 'PASSIVE' },
      ],
    }));
  });

  it('deduplicates parties collected from list, details and involved people', () => {
    const normalized = normalizeEscavador2Response({
      processos: [{
        lista: { polo_ativo: 'CANDIDATA TESTE', polo_passivo: 'EMPRESA TESTE LTDA' },
        detalhes: {
          processo: { polo_passivo: 'empresa teste ltda' },
          raw: {
            fontes: [{ envolvidos: [
              { nome: 'candidata teste', polo: 'ATIVO' },
              { nome: 'Empresa Teste Ltda', polo: 'PASSIVO' },
            ] }],
          },
        },
        classificacao: { area: 'LABOR' },
        papel_candidato: { tipo_principal: 'Autor', polo_principal: 'ATIVO' },
        normalizado: { dados: {}, match: {} },
      }],
    });

    expect(normalized.escavador2Processos[0].parties).toEqual([
      { name: 'CANDIDATA TESTE', role: 'Polo Ativo', side: 'ACTIVE' },
      { name: 'EMPRESA TESTE LTDA', role: 'Polo Passivo', side: 'PASSIVE' },
    ]);
  });

  it('ignores non-textual party names, city and court unit', () => {
    const normalized = normalizeEscavador2Response({
      processos: [{
        lista: { polo_ativo: { nome: 'NAO COAGIR' }, polo_passivo: ['NAO COAGIR'] },
        detalhes: {
          processo: { polo_ativo: ['NAO COAGIR'] },
          raw: {
            fontes: { envolvidos: { nome: { valor: 'NAO COAGIR' }, polo: 'ATIVO' } },
          },
        },
        normalizado: {
          dados: {
            cidade: { nome: 'NAO COAGIR' },
            orgao_julgador: ['NAO COAGIR'],
          },
          match: {},
        },
      }],
    });

    expect(normalized.escavador2Processos[0]).toEqual(expect.objectContaining({
      processCity: null,
      comarca: null,
      vara: null,
      judgingBody: null,
      parties: [],
    }));
  });

  it('collects involved people when sources and involved values are objects', () => {
    const normalized = normalizeEscavador2Response({
      processos: [{
        detalhes: {
          raw: {
            fontes: {
              envolvidos: { nome: 'Nome Integral Preservado', polo: 'PASSIVO' },
            },
          },
        },
        classificacao: { area: 'CIVIL' },
        normalizado: { dados: {}, match: {} },
      }],
    });

    expect(normalized.escavador2Processos[0].parties).toEqual([
      { name: 'Nome Integral Preservado', role: 'Polo Passivo', side: 'PASSIVE' },
    ]);
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
    expect(normalized.escavador2RawPayloads.response).toEqual(expect.objectContaining({
      consulta: response.consulta,
      perfil: response.perfil,
      resumo: response.resumo,
    }));
    expect(normalized.escavador2RawPayloads.response.processos[0]).toEqual(expect.objectContaining({
      cnj: response.processos[0].cnj,
      classificacao: response.processos[0].classificacao,
      papel_candidato: response.processos[0].papel_candidato,
    }));
    expect(response).toEqual(original);
  });

  it('compacts verbose raw payload below 128 KiB without anonymizing evidence', () => {
    const verbose = 'conteudo processual '.repeat(20000);
    const input = {
      consulta: { cpf: '86730864508', nome: 'RODRIGO HENRIQUE', status: 'DONE' },
      resumo: { total_processos: 1 },
      processos: [{
        lista: {
          polo_ativo: 'RODRIGO HENRIQUE',
          polo_passivo: 'Madero Industria e Comercio S.A',
        },
        cnj: { valor: '010XXXX-48.2026.5.01.0062', mascarado: true },
        classificacao: { area: 'LABOR', risco_material: true },
        papel_candidato: { tipo_principal: 'Autor', polo_principal: 'ATIVO' },
        normalizado: {
          match: { tipo: 'CPF', has_exact_cpf_match: true },
          dados: { classe: 'Acao Trabalhista', cidade: 'Rio de Janeiro' },
          movimentacoes_resumo: [{ conteudo_resumo: verbose }],
        },
        detalhes: {
          processo: { polo_passivo: 'Madero Industria e Comercio S.A' },
          raw: { resumo: verbose, html: verbose },
        },
        movimentacoes: { items: [{ conteudo: verbose }] },
        documentos: [{ conteudo: verbose }],
      }],
    };

    const normalized = normalizeEscavador2Response(input);
    const raw = normalized.escavador2RawPayloads.response;

    expect(Buffer.byteLength(JSON.stringify(raw), 'utf8')).toBeLessThanOrEqual(128 * 1024);
    expect(JSON.stringify(raw)).toContain('86730864508');
    expect(JSON.stringify(raw)).toContain('Madero Industria e Comercio S.A');
    expect(JSON.stringify(raw)).not.toContain(verbose);
    expect(input.processos[0].detalhes.raw.resumo).toBe(verbose);
  });

  it('keeps the compact raw fallback below 128 KiB', () => {
    const oversizedMetadata = 'metadado tecnico '.repeat(20000);
    const normalized = normalizeEscavador2Response({
      consulta: { cpf: oversizedMetadata, nome: oversizedMetadata, status: 'DONE' },
      perfil: { html: oversizedMetadata },
      resumo: { total_processos: 0, detalhes: oversizedMetadata },
      erros_parciais: [{ detalhes: oversizedMetadata }],
      estatisticas: { detalhes: oversizedMetadata },
    });

    const raw = normalized.escavador2RawPayloads.response;

    expect(Buffer.byteLength(JSON.stringify(raw), 'utf8')).toBeLessThanOrEqual(128 * 1024);
    expect(raw).toEqual({ truncado: true, processosOmitidos: 0 });
  });

  it('removes verbose technical metadata before omitting short process evidence', () => {
    const verbose = 'metadado tecnico '.repeat(20000);
    const input = {
      consulta: { cpf: '86730864508', nome: 'RODRIGO HENRIQUE', status: 'DONE' },
      perfil: { nome: 'RODRIGO HENRIQUE', html: verbose },
      resumo: { total_processos: 1 },
      erros_parciais: [{ codigo: 'DETAILS_TIMEOUT', erro: verbose }],
      estatisticas: { elapsed_ms: 1234, debug: verbose },
      processos: [{
        cnj: { valor: '010XXXX-48.2026.5.01.0062', mascarado: true },
        lista: {
          polo_ativo: 'RODRIGO HENRIQUE',
          polo_passivo: 'Madero Industria e Comercio S.A',
        },
        classificacao: { area: 'LABOR', risco_material: true },
        papel_candidato: { tipo_principal: 'Autor', polo_principal: 'ATIVO' },
        normalizado: {
          match: { tipo: 'CPF', has_exact_cpf_match: true },
          dados: {
            classe: 'Acao Trabalhista',
            assunto: 'Horas extras',
            tribunal_sigla: 'TRT1',
            uf: 'RJ',
            cidade: 'Rio de Janeiro',
            orgao_julgador: '62a Vara do Trabalho',
            status_predito: 'ATIVO',
            data_inicio: '2026-05-25',
            ultima_movimentacao: '2026-07-01',
            html: verbose,
            debug: { payload: verbose },
          },
        },
      }],
    };
    const original = structuredClone(input);

    const normalized = normalizeEscavador2Response(input);
    const raw = normalized.escavador2RawPayloads.response;
    const serialized = JSON.stringify(raw);

    expect(Buffer.byteLength(serialized, 'utf8')).toBeLessThanOrEqual(128 * 1024);
    expect(raw.processos).toHaveLength(1);
    expect(raw.processosOmitidos).toBeUndefined();
    expect(serialized).toContain('86730864508');
    expect(serialized).toContain('RODRIGO HENRIQUE');
    expect(serialized).toContain('010XXXX-48.2026.5.01.0062');
    expect(serialized).toContain('Madero Industria e Comercio S.A');
    expect(raw.processos[0].classificacao).toEqual(input.processos[0].classificacao);
    expect(raw.processos[0].normalizado.dados).toEqual({
      classe: 'Acao Trabalhista',
      assunto: 'Horas extras',
      tribunal_sigla: 'TRT1',
      uf: 'RJ',
      cidade: 'Rio de Janeiro',
      orgao_julgador: '62a Vara do Trabalho',
      status_predito: 'ATIVO',
      data_inicio: '2026-05-25',
      ultima_movimentacao: '2026-07-01',
    });
    expect(normalized.escavador2Processos[0]._sourceEscavador2.normalizado.dados).toEqual(
      raw.processos[0].normalizado.dados,
    );
    expect(serialized).not.toContain(verbose);
    expect(input).toEqual(original);
  });

  it('drops aggregate technical blocks before omitting short process evidence', () => {
    const partialErrors = Array.from({ length: 6000 }, (_, index) => ({
      codigo: `ERROR_${index}`,
      erro: 'falha curta',
    }));
    const stats = Object.fromEntries(Array.from(
      { length: 20000 },
      (_, index) => [`metric_${index}`, index],
    ));
    const input = {
      consulta: { cpf: '86730864508', nome: 'RODRIGO HENRIQUE', status: 'DONE' },
      perfil: { nome: 'RODRIGO HENRIQUE' },
      resumo: { total_processos: 1 },
      erros_parciais: partialErrors,
      estatisticas: stats,
      processos: [{
        cnj: { valor: '010XXXX-48.2026.5.01.0062', mascarado: true },
        lista: {
          polo_ativo: 'RODRIGO HENRIQUE',
          polo_passivo: 'Madero Industria e Comercio S.A',
        },
        classificacao: { area: 'LABOR', risco_material: true },
        papel_candidato: { tipo_principal: 'Autor', polo_principal: 'ATIVO' },
        normalizado: {
          match: { tipo: 'CPF', has_exact_cpf_match: true },
          dados: { classe: 'Acao Trabalhista', assunto: 'Horas extras' },
        },
      }],
    };

    const raw = normalizeEscavador2Response(input).escavador2RawPayloads.response;
    const serialized = JSON.stringify(raw);

    expect(Buffer.byteLength(serialized, 'utf8')).toBeLessThanOrEqual(128 * 1024);
    expect(raw.processos).toHaveLength(1);
    expect(raw.processosOmitidos).toBeUndefined();
    expect(raw.erros_parciais).toEqual([]);
    expect(raw.errosParciaisOmitidos).toBe(6000);
    expect(raw.estatisticas).toEqual({});
    expect(raw.estatisticasOmitidas).toBe(20000);
    expect(raw.perfil).toEqual({ nome: 'RODRIGO HENRIQUE' });
    expect(raw.perfilOmitido).toBeUndefined();
    expect(serialized).toContain('86730864508');
    expect(serialized).toContain('010XXXX-48.2026.5.01.0062');
    expect(serialized).toContain('Madero Industria e Comercio S.A');
    expect(raw.processos[0].classificacao).toEqual(input.processos[0].classificacao);
    expect(raw.processos[0].papel_candidato).toEqual(input.processos[0].papel_candidato);
    expect(input.erros_parciais).toHaveLength(6000);
    expect(Object.keys(input.estatisticas)).toHaveLength(20000);
  });

  it('includes truncation markers in each process-removal budget check', () => {
    const maxBytes = 128 * 1024;
    const firstProcess = {
      cnj: { valor: '0000001-11.2026.5.01.0001', mascarado: false },
      lista: { polo_ativo: 'CANDIDATO PRESERVADO', polo_passivo: 'EMPRESA PRESERVADA' },
      classificacao: { area: 'LABOR', risco_material: true },
      papel_candidato: { tipo_principal: 'Autor', polo_principal: 'ATIVO' },
      normalizado: { match: { tipo: 'CPF' }, dados: { classe: 'Acao Trabalhista' } },
    };
    const paddedProcess = {
      cnj: { valor: '0000002-22.2026.5.01.0002', mascarado: false },
      classificacao: { area: 'CIVIL', risco_material: false },
      papel_candidato: { tipo_principal: 'Autor', polo_principal: 'ATIVO' },
      normalizado: { match: { tipo: 'NOME' }, dados: { assunto: '' } },
    };
    const lastProcess = {
      cnj: { valor: '0000003-33.2026.5.01.0003', mascarado: false },
      classificacao: { area: 'CIVIL', risco_material: false },
      papel_candidato: { tipo_principal: 'Autor', polo_principal: 'ATIVO' },
      normalizado: { match: { tipo: 'NOME' }, dados: { assunto: 'Processo removido primeiro' } },
    };
    const baseInput = {
      consulta: { cpf: '86730864508', nome: 'CANDIDATO PRESERVADO', status: 'DONE' },
      resumo: { total_processos: 3 },
      processos: [firstProcess, paddedProcess],
    };
    const baseRaw = normalizeEscavador2Response(baseInput).escavador2RawPayloads.response;
    const paddingLength = maxBytes - Buffer.byteLength(JSON.stringify(baseRaw), 'utf8') - 8;
    paddedProcess.normalizado.dados.assunto = 'A'.repeat(paddingLength);

    const boundaryRaw = normalizeEscavador2Response(baseInput).escavador2RawPayloads.response;
    const boundaryWithMarkers = {
      ...boundaryRaw,
      truncado: true,
      processosOmitidos: 1,
    };
    expect(Buffer.byteLength(JSON.stringify(boundaryRaw), 'utf8')).toBeLessThanOrEqual(maxBytes);
    expect(Buffer.byteLength(JSON.stringify(boundaryWithMarkers), 'utf8')).toBeGreaterThan(maxBytes);

    const input = { ...baseInput, processos: [firstProcess, paddedProcess, lastProcess] };
    const original = structuredClone(input);
    const raw = normalizeEscavador2Response(input).escavador2RawPayloads.response;

    expect(Buffer.byteLength(JSON.stringify(raw), 'utf8')).toBeLessThanOrEqual(maxBytes);
    expect(raw.processos).toHaveLength(1);
    expect(raw.processos[0].cnj).toEqual(firstProcess.cnj);
    expect(raw.processos[0].lista).toEqual(expect.objectContaining({
      polo_ativo: 'CANDIDATO PRESERVADO',
      polo_passivo: 'EMPRESA PRESERVADA',
    }));
    expect(raw.processos[0].classificacao).toEqual(firstProcess.classificacao);
    expect(raw.processos[0].papel_candidato).toEqual(firstProcess.papel_candidato);
    expect(raw.truncado).toBe(true);
    expect(raw.processosOmitidos).toBe(2);
    expect(input).toEqual(original);
  });

  it('keeps only finite non-negative counts in process fetch summaries', () => {
    const normalized = normalizeEscavador2Response({
      processos: [{
        movimentacoes_resumo: {
          total: '20',
          coletadas: [1, 2],
          coletados: { valor: 2 },
        },
        documentos_resumo: {
          total: 5,
          coletadas: 3,
          coletados: Number.POSITIVE_INFINITY,
        },
      }],
    });

    expect(normalized.escavador2Processos[0].movimentacoesResumo).toEqual({
      total: null,
      coletadas: null,
      coletados: null,
    });
    expect(normalized.escavador2Processos[0].documentosResumo).toEqual({
      total: 5,
      coletadas: 3,
      coletados: null,
    });
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

  it('classifies ambiguous roles using central roleClassifier with side fallback', () => {
    const response = {
      consulta: { status: 'DONE' },
      processos: [
        {
          cnj: { valor: '0001111-11.2024.8.26.0100' },
          classificacao: { area: 'CRIMINAL', risco_material: true },
          papel_candidato: { tipo_principal: 'ENVOLVIDO', polo_principal: 'PASSIVO', categoria: 'DEFENDANT' },
          normalizado: {
            match: { has_exact_cpf_match: true },
            dados: { classe: 'Acao Penal', assunto: 'Roubo', tribunal_sigla: 'TJSP', uf: 'SP', data_inicio: '2024-01-01' },
          },
        },
        {
          cnj: { valor: '0002222-22.2024.5.09.0001' },
          classificacao: { area: 'LABOR' },
          papel_candidato: { tipo_principal: 'Reclamante', polo_principal: 'ATIVO', categoria: 'PLAINTIFF' },
          normalizado: {
            match: { has_exact_cpf_match: true },
            dados: { classe: 'Reclamacao Trabalhista', tribunal_sigla: 'TRT9', uf: 'PR', data_inicio: '2023-03-10' },
          },
        },
        {
          cnj: { valor: '0003333-33.2024.8.26.0001' },
          classificacao: { area: 'CRIMINAL' },
          papel_candidato: { tipo_principal: 'Vitima', polo_principal: 'PASSIVO', categoria: 'VICTIM' },
          normalizado: {
            match: { has_exact_cpf_match: true },
            dados: { classe: 'Acao Penal', assunto: 'Lesao Corporal', tribunal_sigla: 'TJSP', uf: 'SP', data_inicio: '2024-02-01' },
          },
        },
      ],
    };

    const normalized = normalizeEscavador2Response(response);
    const [criminalDefendant, laborPlaintiff, criminalVictim] = normalized.escavador2Processos;

    expect(criminalDefendant.isDefendant).toBe(true);
    expect(criminalDefendant.isPlaintiff).toBe(false);
    expect(criminalDefendant.isVictim).toBe(false);
    expect(criminalDefendant.roleCategory).toBe('DEFENDANT');

    expect(laborPlaintiff.isPlaintiff).toBe(true);
    expect(laborPlaintiff.isDefendant).toBe(false);
    expect(laborPlaintiff.roleCategory).toBe('PLAINTIFF');

    expect(criminalVictim.isVictim).toBe(true);
    expect(criminalVictim.isDefendant).toBe(false);
    expect(criminalVictim.roleCategory).toBe('VICTIM');
  });

  it('marks material criminal rogatory letter with defendant role as criminal', () => {
    const normalized = normalizeEscavador2Response({
      resumo: { total_processos: 1, tem_criminal: true, total_criminais: 1, total_riscos_materiais: 1 },
      processos: [{
        cnj: { valor: '000XXXX-16.2013.8.19.0031', mascarado: true },
        classificacao: { area: 'CRIMINAL', risco_material: true },
        papel_candidato: { tipo_principal: 'Réu', polo_principal: 'PASSIVO', categoria: 'DEFENDANT' },
        normalizado: {
          match: { tipo: 'CPF', has_exact_cpf_match: true },
          dados: {
            classe: 'Carta Precatória Criminal',
            assunto: 'Aplicação, Revovação, Cumprimento / Medidas de Segurança',
            tribunal_sigla: 'TJRJ',
          },
        },
      }],
    });

    expect(normalized.escavador2Processos[0]).toEqual(expect.objectContaining({
      area: 'CRIMINAL',
      isCriminal: true,
      isDefendant: true,
      isMaterialRisk: true,
      isExcludedCrimeType: null,
    }));
  });

  it('keeps consumer/civil false positive as non-criminal even when provider area is criminal', () => {
    const normalized = normalizeEscavador2Response({
      resumo: { total_processos: 1, tem_criminal: true, total_criminais: 1 },
      processos: [{
        cnj: { valor: '1003506-56.2025.4.01.3902' },
        classificacao: { area: 'CRIMINAL', risco_material: false },
        papel_candidato: { tipo_principal: 'Autor', polo_principal: 'ATIVO', categoria: 'PLAINTIFF' },
        normalizado: {
          match: { tipo: 'CPF', has_exact_cpf_match: true },
          dados: {
            classe: 'Procedimento do Juizado Especial Cível',
            assunto: 'Pessoa com Deficiência / Direito do Consumidor / Indenização por Dano Moral',
            tribunal_sigla: 'TRF1',
          },
        },
      }],
    });

    expect(normalized.escavador2Processos[0]).toEqual(expect.objectContaining({
      area: 'CRIMINAL',
      isCriminal: false,
      isExcludedCrimeType: 'CONSUMER_CIVIL_NOISE',
    }));
  });

  it('does not mark provider-mislabeled criminal area as criminal without indicator or material risk', () => {
    const normalized = normalizeEscavador2Response({
      resumo: { total_processos: 1, tem_criminal: true, total_criminais: 1 },
      processos: [{
        cnj: { valor: '0800321-44.2024.8.19.0001' },
        classificacao: { area: 'CRIMINAL', risco_material: false },
        papel_candidato: { tipo_principal: 'Réu', polo_principal: 'PASSIVO', categoria: 'DEFENDANT' },
        normalizado: {
          match: { tipo: 'CPF', has_exact_cpf_match: true },
          dados: {
            classe: 'Alvará Judicial - Lei 6858/80',
            assunto: 'Inventário e Partilha / Levantamento de Valor',
            tribunal_sigla: 'TJRJ',
          },
        },
      }],
    });

    expect(normalized.escavador2Processos[0]).toEqual(expect.objectContaining({
      area: 'CRIMINAL',
      isCriminal: false,
    }));
  });

  it('does not turn the scraper task-status object into a fake court status', () => {
    const normalized = normalizeEscavador2Response(response);
    // response.processos[0].status = { detalhes: 'DONE', ... } eh status da
    // coleta, nao do processo — nao pode virar "Status: detalhes: DONE | ..."
    // no relatorio do cliente.
    expect(normalized.escavador2Processos[0].status).toBeNull();
  });

  it('falls back to predicted status when process status is a collection object', () => {
    const normalized = normalizeEscavador2Response({
      processos: [{
        status: { detalhes: 'DONE' },
        normalizado: { dados: { status_predito: 'ATIVO' }, match: {} },
      }],
    });

    expect(normalized.escavador2Processos[0].status).toBe('ATIVO');
  });

  it('prioritizes a court status string over predicted status', () => {
    const normalized = normalizeEscavador2Response({
      processos: [{
        status: 'ARQUIVADO',
        normalizado: { dados: { status_predito: 'ATIVO' }, match: {} },
      }],
    });

    expect(normalized.escavador2Processos[0].status).toBe('ARQUIVADO');
  });

  it('keeps a real court status string untouched', () => {
    const normalized = normalizeEscavador2Response({
      resumo: { total_processos: 1 },
      processos: [{
        status: 'ARQUIVADO',
        cnj: { valor: '0009999-00.2023.5.09.0001' },
        classificacao: { area: 'LABOR' },
        papel_candidato: { tipo_principal: 'Reclamado', polo_principal: 'PASSIVO' },
        normalizado: { match: { has_exact_cpf_match: true }, dados: { classe: 'Reclamacao Trabalhista' } },
      }],
    });
    expect(normalized.escavador2Processos[0].status).toBe('ARQUIVADO');
  });

  it('keeps traffic-crime exclusion (TRANSITO) as isCriminal so it reaches the ATTENTION tier, tagged with the exclusion', () => {
    const normalized = normalizeEscavador2Response({
      resumo: { total_processos: 1, tem_criminal: true, total_criminais: 1 },
      processos: [{
        cnj: { valor: '0900123-45.2024.8.19.0001' },
        classificacao: { area: 'CRIMINAL', risco_material: false },
        papel_candidato: { tipo_principal: 'Réu', polo_principal: 'PASSIVO', categoria: 'DEFENDANT' },
        normalizado: {
          match: { tipo: 'CPF', has_exact_cpf_match: true },
          dados: {
            classe: 'Auto de Prisão em Flagrante',
            assunto: 'Embriaguez ao Volante - Art. 306 do CTB',
            tribunal_sigla: 'TJRJ',
          },
        },
      }],
    });

    expect(normalized.escavador2Processos[0]).toEqual(expect.objectContaining({
      area: 'CRIMINAL',
      isCriminal: true,
      isExcludedCrimeType: 'TRANSITO',
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
