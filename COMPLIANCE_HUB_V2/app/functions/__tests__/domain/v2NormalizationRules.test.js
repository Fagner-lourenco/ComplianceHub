/**
 * Tests: V2 Normalization Rules
 */

const {
  normalizeProcessStatus,
  normalizePartyType,
  inferProcessArea,
  inferSegment,
  normalizeValue,
  formatValueBrl,
  extractCourtCode,
} = require('../../domain/v2NormalizationRules');

describe('v2NormalizationRules', () => {
  describe('normalizeProcessStatus', () => {
    test('maps ATIVO to Em tramitacao', () => {
      expect(normalizeProcessStatus('ATIVO')).toBe('Em tramitacao');
    });
    test('maps ARQUIVADO to Arquivamento definitivo', () => {
      expect(normalizeProcessStatus('ARQUIVADO')).toBe('Arquivamento definitivo');
    });
    test('returns Outro for unknown', () => {
      expect(normalizeProcessStatus('UNKNOWN')).toBe('Outro');
    });
  });

  describe('normalizePartyType', () => {
    test('maps AUTOR to autor', () => {
      expect(normalizePartyType('AUTOR')).toBe('autor');
    });
    test('maps REU to reu', () => {
      expect(normalizePartyType('REU')).toBe('reu');
    });
  });

  describe('inferProcessArea', () => {
    test('detects criminal from keywords', () => {
      expect(inferProcessArea('Apelacao Criminal', '')).toBe('criminal');
    });
    test('detects trabalhista from keywords', () => {
      expect(inferProcessArea('', 'Reclamacao Trabalhista')).toBe('trabalhista');
    });
    test('defaults to outro', () => {
      expect(inferProcessArea('Something Else', 'Unknown')).toBe('outro');
    });
  });

  describe('inferSegment', () => {
    test('extracts TJ-CE as justica_estadual', () => {
      expect(inferSegment('TJ-CE')).toBe('justica_estadual');
    });
    test('extracts TRT-1 as trt', () => {
      expect(inferSegment('TRT-1')).toBe('trt');
    });
  });

  describe('normalizeValue', () => {
    test('converts number to cents', () => {
      expect(normalizeValue(1234.56)).toBe(123456);
    });
    test('converts formatted string to cents', () => {
      expect(normalizeValue('R$ 1.234,56')).toBe(123456);
    });
  });

  describe('formatValueBrl', () => {
    test('formats cents to BRL', () => {
      expect(formatValueBrl(123456)).toBe('R$ 1.234,56');
    });
  });

  describe('extractCourtCode', () => {
    test('extracts TJ-CE', () => {
      expect(extractCourtCode('TJ-CE')).toBe('TJ-CE');
    });
  });
});
