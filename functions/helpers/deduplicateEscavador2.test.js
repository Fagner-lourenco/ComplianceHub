import { describe, expect, it } from 'vitest';
import deduplicateEscavador2 from './deduplicateEscavador2.js';

const {
  deduplicateEscavador2Findings,
  normalizeCnjDigits,
} = deduplicateEscavador2;

describe('deduplicateEscavador2', () => {
  it('normalizes CNJ by keeping only digits and rejects masked CNJ values', () => {
    expect(normalizeCnjDigits('0001234-56.2024.8.26.0100')).toBe('00012345620248260100');
    expect(normalizeCnjDigits('0001234-XX.2024.8.26.0100')).toBeNull();
    expect(normalizeCnjDigits('0001234-x6.2024.8.26.0100')).toBeNull();
    expect(normalizeCnjDigits('12345')).toBeNull();
  });

  it('marks duplicate by full process number against BigDataCorp', () => {
    const result = deduplicateEscavador2Findings({
      bigdatacorpProcessos: [{ numero: '0001234-56.2024.8.26.0100' }],
      escavador2Processos: [{ numeroCnj: '0001234-56.2024.8.26.0100', isMaterialRisk: true }],
    });

    expect(result.escavador2Processos[0]).toEqual(expect.objectContaining({
      isDuplicate: true,
      isDuplicateEscavador2Finding: true,
      duplicateOfProvider: 'bigdatacorp',
      duplicateOfProcessNumber: '0001234-56.2024.8.26.0100',
      duplicateMatchStrength: 'CNJ_FULL',
      isNewEscavador2Finding: false,
    }));
    expect(result.escavador2DuplicateCount).toBe(1);
    expect(result.escavador2NewFindingCount).toBe(0);
    expect(result.escavador2HasNewMaterialRisk).toBe(false);
  });

  it('marks duplicate by extracted full CNJ against Judit role summary', () => {
    const result = deduplicateEscavador2Findings({
      juditRoleSummary: [{ code: '5009876-10.2023.4.03.6100' }],
      escavador2Processos: [{
        numeroCnj: '5009876-XX.2023.4.03.6100',
        numeroCnjCompletoExtraido: '5009876-10.2023.4.03.6100',
      }],
    });

    expect(result.escavador2Processos[0]).toEqual(expect.objectContaining({
      isDuplicate: true,
      isDuplicateEscavador2Finding: true,
      duplicateOfProvider: 'judit',
      duplicateOfProcessNumber: '5009876-10.2023.4.03.6100',
      duplicateMatchStrength: 'CNJ_FULL',
      isNewEscavador2Finding: false,
    }));
  });

  it('marks duplicate by metadata within 90 days against official Escavador', () => {
    const result = deduplicateEscavador2Findings({
      escavadorProcessos: [{
        area: 'criminal',
        tribunalSigla: 'TJSP',
        processUf: 'SP',
        classe: 'Acao Penal',
        dataInicio: '2024-01-15',
      }],
      escavador2Processos: [{
        numeroCnj: '0001234-XX.2024.8.26.0100',
        area: 'CRIMINAL',
        tribunalSigla: 'TJSP',
        processUf: 'SP',
        classe: 'Ação Penal',
        dataInicio: '2024-03-01',
        isMaterialRisk: true,
      }],
    });

    expect(result.escavador2Processos[0]).toEqual(expect.objectContaining({
      isDuplicate: true,
      isDuplicateEscavador2Finding: true,
      duplicateOfProvider: 'escavador',
      duplicateMatchStrength: 'metadata',
      isNewEscavador2Finding: false,
    }));
    expect(result.escavador2HasNewMaterialRisk).toBe(false);
  });

  it('does not match metadata when tribunal is missing', () => {
    const result = deduplicateEscavador2Findings({
      escavadorProcessos: [{
        area: 'criminal',
        processUf: 'SP',
        classe: 'Acao Penal',
        dataInicio: '2024-01-15',
      }],
      escavador2Processos: [{
        numeroCnj: '0001234-XX.2024.8.26.0100',
        area: 'CRIMINAL',
        tribunalSigla: 'TJSP',
        processUf: 'SP',
        classe: 'Ação Penal',
        dataInicio: '2024-03-01',
        isMaterialRisk: true,
      }],
    });

    expect(result.escavador2Processos[0]).toEqual(expect.objectContaining({
      isDuplicate: false,
      isDuplicateEscavador2Finding: false,
      duplicateOfProvider: null,
      duplicateMatchStrength: null,
      isNewEscavador2Finding: true,
    }));
    expect(result.escavador2HasNewMaterialRisk).toBe(true);
  });

  it('does not match metadata when UF conflicts', () => {
    const result = deduplicateEscavador2Findings({
      escavadorProcessos: [{
        area: 'criminal',
        tribunalSigla: 'TJSP',
        processUf: 'SP',
        classe: 'Acao Penal',
        dataInicio: '2024-01-15',
      }],
      escavador2Processos: [{
        numeroCnj: '0001234-XX.2024.8.26.0100',
        area: 'CRIMINAL',
        tribunalSigla: 'TJSP',
        processUf: 'MG',
        classe: 'Ação Penal',
        dataInicio: '2024-03-01',
        isMaterialRisk: true,
      }],
    });

    expect(result.escavador2Processos[0]).toEqual(expect.objectContaining({
      isDuplicate: false,
      duplicateOfProvider: null,
      duplicateMatchStrength: null,
      isNewEscavador2Finding: true,
    }));
    expect(result.escavador2HasNewMaterialRisk).toBe(true);
  });

  it('keeps new material risk when metadata date is outside tolerance against DJEN', () => {
    const result = deduplicateEscavador2Findings({
      djenComunicacoes: [{
        area: 'criminal',
        tribunal: 'TJMG',
        classe: 'Inquerito Policial',
        dataDisponibilizacao: '2023-01-01',
      }],
      escavador2Processos: [{
        numeroCnj: '0001234-XX.2024.8.13.0000',
        area: 'CRIMINAL',
        tribunalSigla: 'TJMG',
        classe: 'Inquérito Policial',
        dataInicio: '2023-06-01',
        isMaterialRisk: true,
      }],
    });

    expect(result.escavador2Processos[0]).toEqual(expect.objectContaining({
      isDuplicate: false,
      duplicateOfProvider: null,
      duplicateOfProcessNumber: null,
      duplicateMatchStrength: null,
      isNewEscavador2Finding: true,
    }));
    expect(result.escavador2DuplicateCount).toBe(0);
    expect(result.escavador2NewFindingCount).toBe(1);
    expect(result.escavador2HasNewMaterialRisk).toBe(true);
  });

  it('parses CNJ pattern preserving X wildcards', () => {
    const { parseCnjPattern } = deduplicateEscavador2;
    expect(parseCnjPattern('500XXXX-93.2025.8.21.0007')).toBe('500XXXX9320258210007');
    expect(parseCnjPattern('0001234-56.2024.8.26.0100')).toBe('00012345620248260100');
    expect(parseCnjPattern('12345')).toBeNull();
    expect(parseCnjPattern(null)).toBeNull();
  });

  it('matches masked CNJ positionally against full CNJ', () => {
    const { isPositionalMaskedMatch } = deduplicateEscavador2;
    expect(isPositionalMaskedMatch('500XXXX9320258210007', '50067239320258210007')).toBe(true);
    expect(isPositionalMaskedMatch('500XXXX9320258210007', '50067239320258210008')).toBe(false);
    expect(isPositionalMaskedMatch('XXXXXXXXXXXXXXXXXXXX', '50067239320258210007')).toBe(false);
    expect(isPositionalMaskedMatch('500XXXX9320258210007', '500XXXX9320258210007')).toBe(true);
  });
});
