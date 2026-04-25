/**
 * Tests: V2 Score Engine
 */

const { calculateScore, SIGNAL_RULES } = require('../../domain/v2ScoreEngine');

describe('v2ScoreEngine', () => {
  describe('calculateScore', () => {
    test('returns low score for empty evidence', () => {
      const score = calculateScore('case1', [], []);
      expect(score.overall).toBe(0);
      expect(score.category).toBe('low');
      expect(score.signals).toHaveLength(0);
    });

    test('detects PEP level 1 as critical signal', () => {
      const evidence = [{
        sectionKey: 'kyc',
        sourceKey: 'bigdatacorp_kyc',
        content: {
          PEPHistory: [{ Level: '1', JobTitle: 'Presidente', Department: 'Executivo', Source: 'PEP_PORTAL' }],
        },
      }];

      const score = calculateScore('case1', evidence, []);
      expect(score.signals.some(s => s.code === 'PEP_LEVEL_1')).toBe(true);
      expect(score.dimensions.reguladores).toBeGreaterThan(0);
    });

    test('detects current sanction as critical', () => {
      const evidence = [{
        sectionKey: 'kyc',
        sourceKey: 'bigdatacorp_kyc',
        content: {
          IsCurrentlySanctioned: true,
        },
      }];

      const score = calculateScore('case1', evidence, []);
      expect(score.signals.some(s => s.code === 'SANCTION_CURRENT')).toBe(true);
      expect(score.overall).toBeGreaterThanOrEqual(15);
    });

    test('detects criminal process as reu', () => {
      const evidence = [{
        evidenceType: 'process_list',
        sourceKey: 'bigdatacorp_processes',
        content: {
          processes: [{
            area: 'criminal',
            participation: 'reu',
          }],
        },
      }];

      const score = calculateScore('case1', evidence, []);
      expect(score.signals.some(s => s.code === 'PROCESS_CRIMINAL_REU')).toBe(true);
    });

    test('caps score at critical category', () => {
      const evidence = [
        {
          sectionKey: 'kyc',
          sourceKey: 'bigdatacorp_kyc',
          content: { IsCurrentlySanctioned: true },
        },
        {
          evidenceType: 'process_list',
          sourceKey: 'bigdatacorp_processes',
          content: {
            processes: [{
              area: 'criminal',
              participation: 'reu',
              value: 50_000_000,
            }],
          },
        },
      ];

      const score = calculateScore('case1', evidence, []);
      expect(score.category).toBe('critical');
      expect(score.overall).toBeLessThanOrEqual(100);
    });
  });

  describe('SIGNAL_RULES', () => {
    test('all rules have required fields', () => {
      for (const rule of SIGNAL_RULES) {
        expect(rule.code).toBeDefined();
        expect(rule.category).toBeDefined();
        expect(rule.severity).toBeDefined();
        expect(rule.scoreImpact).toBeDefined();
        expect(rule.condition).toBeInstanceOf(Function);
      }
    });
  });
});
