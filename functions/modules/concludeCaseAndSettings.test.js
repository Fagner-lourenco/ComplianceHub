import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
import {
  pickConcludePayload,
  pickDraftPayload,
  validateConcludeFinalFlags,
  normalizeNarrativeValue,
  syncPublicResultLatest,
} from './concludeCaseAndSettings.js';

const require = createRequire(import.meta.url);

const mockFieldValue = {
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  delete: vi.fn(() => 'FIELD_DELETE'),
};

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: mockFieldValue,
}));

vi.mock('./reportEngine', () => ({
  buildSanitizedPublicResultSnapshot: vi.fn(() => ({ candidateName: 'Test' })),
  hasMeaningfulValue: vi.fn((v) => {
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'string') return v.trim().length > 0;
    return v !== undefined && v !== null;
  }),
}));

vi.mock('../helpers/normalize', () => ({
  stripUndefined: vi.fn((obj) => obj),
}));

describe('concludeCaseAndSettings', () => {
  describe('normalizeNarrativeValue', () => {
    it('retorna undefined para undefined', () => {
      expect(normalizeNarrativeValue('any', undefined)).toBeUndefined();
    });

    it('filtra enabledPhases contra config padrão', () => {
      const config = { phaseA: {}, phaseB: {} };
      expect(normalizeNarrativeValue('enabledPhases', ['phaseA', 'invalid'], { defaultAnalysisConfig: config }))
        .toEqual(['phaseA']);
    });

    it('creditRestriction sobrevive ao filtro de enabledPhases com o default global', () => {
      const { DEFAULT_ANALYSIS_CONFIG } = require('./_shared/analysisConfig');
      expect(normalizeNarrativeValue('enabledPhases', ['criminal', 'creditRestriction'], { defaultAnalysisConfig: DEFAULT_ANALYSIS_CONFIG }))
        .toEqual(['criminal', 'creditRestriction']);
    });

    it('normaliza keyFindings', () => {
      const result = normalizeNarrativeValue('keyFindings', ['a', 'b']);
      expect(Array.isArray(result)).toBe(true);
    });

    it('trunca string longa', () => {
      const long = 'a'.repeat(1500);
      const result = normalizeNarrativeValue('executiveSummary', long);
      expect(result.length).toBeLessThanOrEqual(900);
      expect(result.endsWith('...')).toBe(true);
    });
  });

  describe('pickConcludePayload', () => {
    it('filtra apenas ALLOWED_CONCLUDE_FIELDS', () => {
      const payload = { finalVerdict: 'FIT', hackerField: 'x' };
      const result = pickConcludePayload(payload);
      expect(result.finalVerdict).toBe('FIT');
      expect(result.hackerField).toBeUndefined();
      expect(result.status).toBe('DONE');
    });

    it('remove campos de correção', () => {
      const payload = { finalVerdict: 'FIT' };
      const result = pickConcludePayload(payload);
      expect(result.correctionReason).not.toBeUndefined();
      expect(result.reviewDraft).not.toBeUndefined();
    });
  });

  describe('pickDraftPayload', () => {
    it('filtra ALLOWED_DRAFT_FIELDS e preserva reviewDraft existente', () => {
      const existing = { criminalFlag: 'NEGATIVE' };
      const payload = { finalVerdict: 'FIT', hacker: 'x' };
      const result = pickDraftPayload(payload, existing);
      expect(result.reviewDraft.criminalFlag).toBe('NEGATIVE');
      expect(result.reviewDraft.finalVerdict).toBe('FIT');
      expect(result.reviewDraft.hacker).toBeUndefined();
      expect(result.reviewDraft.__source).toBe('analyst');
    });
  });

  describe('validateConcludeFinalFlags', () => {
    it('aceita flags válidas', () => {
      expect(() => validateConcludeFinalFlags({ criminalFlag: 'NEGATIVE' })).not.toThrow();
      expect(() => validateConcludeFinalFlags({ criminalFlag: 'POSITIVE' })).not.toThrow();
      expect(() => validateConcludeFinalFlags({ criminalFlag: 'INCONCLUSIVE' })).not.toThrow();
      expect(() => validateConcludeFinalFlags({ criminalFlag: 'NOT_FOUND' })).not.toThrow();
    });

    it('rejeita flag criminal inválida', () => {
      expect(() => validateConcludeFinalFlags({ criminalFlag: 'INVALID' }))
        .toThrow('Selecione um resultado criminal final');
    });

    it('ignora flag ausente', () => {
      expect(() => validateConcludeFinalFlags({})).not.toThrow();
    });
  });

  describe('syncPublicResultLatest', () => {
    it('grava publicResult no Firestore e retorna snapshot', async () => {
      const setMock = vi.fn(() => Promise.resolve());
      const db = {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              doc: vi.fn(() => ({ set: setMock })),
            })),
          })),
        })),
      };
      const result = await syncPublicResultLatest('case1', { candidateName: 'Test' }, {}, {}, db);
      expect(setMock).toHaveBeenCalled();
      expect(result.candidateName).toBe('Test');
    });
  });
});
