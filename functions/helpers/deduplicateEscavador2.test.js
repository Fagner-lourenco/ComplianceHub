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

  it('canonicalizes tribunal acronyms', () => {
    const { normalizeTribunal } = deduplicateEscavador2;
    expect(normalizeTribunal('TRT-5')).toBe('TRT5');
    expect(normalizeTribunal('TRT 5ª Região')).toBe('TRT5');
    expect(normalizeTribunal('TJSP')).toBe('TJSP');
    expect(normalizeTribunal('Tribunal Regional do Trabalho da 5ª Região')).toBe('TRT5');
    expect(normalizeTribunal('  ')).toBeNull();
  });

  it('detects token overlap in class/subject fields', () => {
    const { hasSubjectOverlap } = deduplicateEscavador2;
    expect(hasSubjectOverlap(
      { classOrSubject: 'Ação Penal' },
      { classOrSubject: 'Acao Penal - Roubo' },
    )).toBe(true);
    expect(hasSubjectOverlap(
      { classOrSubject: 'Homologação da Transação Extrajudicial' },
      { classOrSubject: 'HTE' },
    )).toBe(false);
    expect(hasSubjectOverlap(
      { classOrSubject: 'A', cnjSubject: 'Roubo Qualificado' },
      { classOrSubject: 'Acao Penal', cnjSubject: 'Roubo' },
    )).toBe(true);
  });

  it('matches metadata when one side lacks class/subject using fallback', () => {
    const result = deduplicateEscavador2Findings({
      bigdatacorpProcessos: [{
        numero: '5006723-93.2025.8.21.0007',
        courtType: 'LABOR',
        courtName: 'TRT5',
        processUf: 'BA',
        lastMovementDate: '2025-03-10',
      }],
      escavador2Processos: [{
        numeroCnj: '500XXXX-93.2025.8.21.0008',
        area: 'LABOR',
        tribunalSigla: 'TRT-5',
        processUf: 'BA',
        dataInicio: '2025-03-12',
      }],
    });

    expect(result.escavador2Processos[0]).toEqual(expect.objectContaining({
      isDuplicate: true,
      duplicateOfProvider: 'bigdatacorp',
      duplicateMatchStrength: 'metadata',
    }));
  });

  it('matches masked Escavador2 CNJ against full BigDataCorp CNJ with CNJ_MASKED strength', () => {
    const result = deduplicateEscavador2Findings({
      bigdatacorpProcessos: [{
        numero: '5006723-93.2025.8.21.0007',
        courtType: 'LABOR',
        courtName: 'TRT5',
        processUf: 'BA',
      }],
      escavador2Processos: [{
        numeroCnj: '500XXXX-93.2025.8.21.0007',
        area: 'LABOR',
        tribunalSigla: 'TRT-5',
        processUf: 'BA',
        isMaterialRisk: true,
      }],
    });

    expect(result.escavador2Processos[0]).toEqual(expect.objectContaining({
      isDuplicate: true,
      isDuplicateEscavador2Finding: true,
      duplicateOfProvider: 'bigdatacorp',
      duplicateOfProcessNumber: '5006723-93.2025.8.21.0007',
      duplicateMatchStrength: 'CNJ_MASKED',
      isNewEscavador2Finding: false,
    }));
    expect(result.escavador2HasNewMaterialRisk).toBe(false);
  });

  it('matches masked Escavador2 CNJ against Judit process summary', () => {
    const result = deduplicateEscavador2Findings({
      juditProcessos: [{
        code: '0001234-56.2024.8.26.0100',
        area: 'criminal',
        tribunalAcronym: 'TJSP',
        processUf: 'SP',
      }],
      escavador2Processos: [{
        numeroCnj: '0001234-XX.2024.8.26.0100',
        area: 'CRIMINAL',
        tribunalSigla: 'TJSP',
        processUf: 'SP',
      }],
    });

    expect(result.escavador2Processos[0]).toEqual(expect.objectContaining({
      isDuplicate: true,
      duplicateMatchStrength: 'CNJ_MASKED',
      isNewEscavador2Finding: false,
    }));
  });

  it('still prefers CNJ_FULL when Escavador2 has extracted full CNJ', () => {
    const result = deduplicateEscavador2Findings({
      bigdatacorpProcessos: [{
        numero: '0001234-56.2024.8.26.0100',
      }],
      escavador2Processos: [{
        numeroCnj: '0001234-XX.2024.8.26.0100',
        numeroCnjCompletoExtraido: '0001234-56.2024.8.26.0100',
      }],
    });

    expect(result.escavador2Processos[0]).toEqual(expect.objectContaining({
      duplicateMatchStrength: 'CNJ_FULL',
      isNewEscavador2Finding: false,
    }));
  });

  it('does not produce false positive on mostly masked CNJ', () => {
    const result = deduplicateEscavador2Findings({
      bigdatacorpProcessos: [{
        numero: '0001234-56.2024.8.26.0100',
      }],
      escavador2Processos: [{
        numeroCnj: 'XXXXXXXXXXXXXXXXX100',
        area: 'CRIMINAL',
        tribunalSigla: 'TJSP',
        processUf: 'SP',
        classe: 'Acao Penal',
        dataInicio: '2024-01-15',
      }],
    });

    expect(result.escavador2Processos[0]).toEqual(expect.objectContaining({
      isDuplicate: false,
      duplicateMatchStrength: null,
      isNewEscavador2Finding: true,
    }));
  });

  it('does not match metadata when tribunal differs', () => {
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
        tribunalSigla: 'TJMG',
        processUf: 'SP',
        classe: 'Ação Penal',
        dataInicio: '2024-03-01',
      }],
    });

    expect(result.escavador2Processos[0]).toEqual(expect.objectContaining({
      isDuplicate: false,
      duplicateMatchStrength: null,
      isNewEscavador2Finding: true,
    }));
  });

  it('does not match unrelated metadata even with rich subject tokens', () => {
    const result = deduplicateEscavador2Findings({
      bigdatacorpProcessos: [{
        numero: '1111111-11.2011.8.11.1111',
        courtType: 'CIVIL',
        courtName: 'TJSP',
        processUf: 'SP',
        assunto: 'Contratos',
        lastMovementDate: '2024-01-01',
      }],
      escavador2Processos: [{
        numeroCnj: '2222222-22.2022.8.22.2222',
        area: 'CIVIL',
        tribunalSigla: 'TJSP',
        processUf: 'SP',
        assunto: 'Obrigações',
        dataInicio: '2024-01-02',
        isMaterialRisk: true,
      }],
    });

    expect(result.escavador2Processos[0]).toEqual(expect.objectContaining({
      isDuplicate: false,
      duplicateMatchStrength: null,
      isNewEscavador2Finding: true,
    }));
  });
});
