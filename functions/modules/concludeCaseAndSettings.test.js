import { describe, it, expect, vi } from 'vitest';
import {
  ALLOWED_CONCLUDE_FIELDS,
  ALLOWED_DRAFT_FIELDS,
  FINAL_CRIMINAL_FLAGS,
  pickConcludePayload,
  pickDraftPayload,
  validateConcludeFinalFlags,
  normalizeNarrativeValue,
  normalizeKeyFindingsValue,
  validateConcludePayload,
  buildConcludeUpdatePayload,
  syncPublicResultLatest,
  createConcludeCaseByAnalystHandler,
  createUpdateTenantSettingsByAnalystHandler,
  createSaveCaseDraftByAnalystHandler,
  createSetAiDecisionByAnalystHandler,
} from './concludeCaseAndSettings.js';

const mockFieldValue = {
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  delete: vi.fn(() => 'FIELD_DELETE'),
};

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: mockFieldValue,
}));

vi.mock('./reportEngine', () => ({
  buildKeyFindings: vi.fn(() => ['finding1']),
  buildExecutiveSummary: vi.fn(() => 'summary'),
  buildExpandedKeyFindings: vi.fn(() => ['finding1', 'finding2']),
  buildNextSteps: vi.fn(() => ['step1']),
  buildReportSlug: vi.fn(() => 'slug-123'),
  buildTimelineEvents: vi.fn(() => [{ type: 'concluded' }]),
  calculateTurnaroundHours: vi.fn(() => 12.5),
  buildSanitizedPublicResultSnapshot: vi.fn(() => ({ candidateName: 'Test' })),
  hasMeaningfulValue: vi.fn((v) => {
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'string') return v.trim().length > 0;
    return v !== undefined && v !== null;
  }),
  resolveNarrativeField: vi.fn((caseData, payload, field, options) => {
    if (payload?.[field] !== undefined && payload[field] !== null && payload[field] !== '') return payload[field];
    if (options?.fallbackValue) return typeof options.fallbackValue === 'function' ? options.fallbackValue() : options.fallbackValue;
    return options?.defaultValue !== undefined ? options.defaultValue : null;
  }),
  sanitizeNarrativesForFlags: vi.fn(() => ({ narratives: { criminalNotes: '', laborNotes: '', warrantNotes: '' }, warnings: [] })),
  hasPublicReportMinimumContent: vi.fn(() => true),
}));

vi.mock('../helpers/normalize', () => ({
  stripUndefined: vi.fn((obj) => obj),
}));

describe('concludeCaseAndSettings', () => {
  describe('constants', () => {
    it('ALLOWED_CONCLUDE_FIELDS contém campos essenciais', () => {
      expect(ALLOWED_CONCLUDE_FIELDS.has('finalVerdict')).toBe(true);
      expect(ALLOWED_CONCLUDE_FIELDS.has('analystComment')).toBe(true);
      expect(ALLOWED_CONCLUDE_FIELDS.has('criminalFlag')).toBe(true);
    });

    it('ALLOWED_DRAFT_FIELDS contém campos de rascunho', () => {
      expect(ALLOWED_DRAFT_FIELDS.has('finalVerdict')).toBe(true);
      expect(ALLOWED_DRAFT_FIELDS.has('riskScore')).toBe(true);
    });

    it('FINAL_CRIMINAL_FLAGS tem os 3 valores esperados', () => {
      expect(FINAL_CRIMINAL_FLAGS.has('NEGATIVE')).toBe(true);
      expect(FINAL_CRIMINAL_FLAGS.has('POSITIVE')).toBe(true);
      expect(FINAL_CRIMINAL_FLAGS.has('INCONCLUSIVE')).toBe(true);
    });
  });

  describe('normalizeKeyFindingsValue', () => {
    it('normaliza array', () => {
      const result = normalizeKeyFindingsValue(['a', 'b']);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('normaliza string separada por nova linha', () => {
      const result = normalizeKeyFindingsValue('a\nb');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('retorna array vazio para input inválido', () => {
      expect(normalizeKeyFindingsValue(null)).toEqual([]);
      expect(normalizeKeyFindingsValue(123)).toEqual([]);
    });
  });

  describe('normalizeNarrativeValue', () => {
    it('retorna undefined para undefined', () => {
      expect(normalizeNarrativeValue('any', undefined)).toBeUndefined();
    });

    it('filtra enabledPhases contra config padrão', () => {
      const config = { phaseA: {}, phaseB: {} };
      expect(normalizeNarrativeValue('enabledPhases', ['phaseA', 'invalid'], { defaultAnalysisConfig: config }))
        .toEqual(['phaseA']);
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
    });

    it('rejeita flag criminal inválida', () => {
      expect(() => validateConcludeFinalFlags({ criminalFlag: 'INVALID' }))
        .toThrow('Selecione um resultado criminal final');
    });

    it('ignora flag ausente', () => {
      expect(() => validateConcludeFinalFlags({})).not.toThrow();
    });
  });

  describe('validateConcludePayload', () => {
    const baseDeps = {
      canAssignCases: () => false,
      canBypassIdentityGate: () => true,
      isIdentityGateBlocked: () => false,
    };

    it('rejeita se assignee diferente e não gestor', () => {
      const caseData = { assigneeId: 'other', status: 'PENDING', tenantId: 't1' };
      const profile = { uid: 'me' };
      expect(() => validateConcludePayload({ caseData, payload: {}, profile, tenantAnalysisConfig: {}, ...baseDeps }))
        .toThrow('Apenas o analista responsavel');
    });

    it('permite se assignee for o próprio usuário', () => {
      const caseData = { assigneeId: 'me', status: 'PENDING', tenantId: 't1', warrantFlag: 'NEGATIVE', criminalFlag: 'NEGATIVE' };
      const profile = { uid: 'me' };
      const payload = { analystComment: 'ok', finalVerdict: 'FIT' };
      expect(() => validateConcludePayload({ caseData, payload, profile, tenantAnalysisConfig: {}, ...baseDeps })).not.toThrow();
    });

    it('rejeita status inválido', () => {
      const caseData = { assigneeId: 'me', status: 'DONE', tenantId: 't1' };
      const profile = { uid: 'me' };
      expect(() => validateConcludePayload({ caseData, payload: { analystComment: 'ok' }, profile, tenantAnalysisConfig: {}, ...baseDeps }))
        .toThrow('Caso nao pode ser concluido');
    });

    it('rejeita analystComment ausente', () => {
      const caseData = { assigneeId: 'me', status: 'PENDING', tenantId: 't1', warrantFlag: 'NEGATIVE', criminalFlag: 'NEGATIVE' };
      const profile = { uid: 'me' };
      expect(() => validateConcludePayload({ caseData, payload: {}, profile, tenantAnalysisConfig: {}, ...baseDeps }))
        .toThrow('Justificativa final');
    });

    it('rejeita mandado ativo sem flag adequada', () => {
      const caseData = { assigneeId: 'me', status: 'PENDING', tenantId: 't1', juditActiveWarrantCount: 1, criminalFlag: 'NEGATIVE' };
      const profile = { uid: 'me' };
      const payload = { analystComment: 'ok', warrantFlag: 'NEGATIVE' };
      expect(() => validateConcludePayload({ caseData, payload, profile, tenantAnalysisConfig: {}, ...baseDeps }))
        .toThrow('mandado(s) ativo(s)');
    });
  });

  describe('buildConcludeUpdatePayload', () => {
    it('retorna payload com status DONE e concludedAt', () => {
      const caseData = { status: 'PENDING', tenantId: 't1', criminalFlag: 'NEGATIVE', warrantFlag: 'NEGATIVE' };
      const payload = { finalVerdict: 'FIT', analystComment: 'ok' };
      const calculateRiskScore = vi.fn(() => ({ riskScore: 10, riskLevel: 'GREEN', suggestedVerdict: 'FIT' }));
      const result = buildConcludeUpdatePayload({ caseData, payload, conclusionTimestamp: new Date(), calculateRiskScore });
      expect(result.status).toBe('DONE');
      expect(result.riskScore).toBe(10);
      expect(result.reportReady).toBe(true);
    });

    it('aplica identityBypass quando solicitado', () => {
      const caseData = { status: 'PENDING' };
      const payload = { identityBypassed: true, identityBypassJustification: 'Justificativa longa suficiente' };
      const calculateRiskScore = vi.fn(() => ({ riskScore: 0, riskLevel: 'GREEN', suggestedVerdict: 'FIT' }));
      const result = buildConcludeUpdatePayload({ caseData, payload, conclusionTimestamp: new Date(), calculateRiskScore });
      expect(result.identityBypassed).toBe(true);
      expect(result.identityBypassJustification).toBe('Justificativa longa suficiente');
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

  describe('createConcludeCaseByAnalystHandler', () => {
    it('factory retorna função onCall', () => {
      const handler = createConcludeCaseByAnalystHandler({
        db: {},
        getOpsUserProfile: vi.fn(),
        assertOpsCanAccessCase: vi.fn(),
        canAssignCases: () => false,
        canBypassIdentityGate: () => false,
        isIdentityGateBlocked: () => false,
        getTenantSettingsData: vi.fn(),
        calculateRiskScore: vi.fn(),
        createCaseCompletedNotifications: vi.fn(),
        writeAuditEvent: vi.fn(),
        getClientIp: () => '127.0.0.1',
        defaultAnalysisConfig: {},
        ACTOR_TYPE: { OPS_USER: 'ops_user' },
        SOURCE: { PORTAL_OPS: 'portal_ops' },
      });
      expect(typeof handler).toBe('function');
    });
  });

  describe('createUpdateTenantSettingsByAnalystHandler', () => {
    it('factory retorna função onCall', () => {
      const handler = createUpdateTenantSettingsByAnalystHandler({
        db: {},
        getOpsUserProfile: vi.fn(),
        writeAuditEvent: vi.fn(),
        getClientIp: () => '127.0.0.1',
        ACTOR_TYPE: {},
        SOURCE: {},
      });
      expect(typeof handler).toBe('function');
    });
  });

  describe('createSaveCaseDraftByAnalystHandler', () => {
    it('factory retorna função onCall', () => {
      const handler = createSaveCaseDraftByAnalystHandler({
        db: {},
        getOpsUserProfile: vi.fn(),
        assertOpsCanAccessCase: vi.fn(),
        canAssignCases: () => false,
        writeAuditEvent: vi.fn(),
        getClientIp: () => '127.0.0.1',
        ACTOR_TYPE: {},
        SOURCE: {},
      });
      expect(typeof handler).toBe('function');
    });
  });

  describe('createSetAiDecisionByAnalystHandler', () => {
    it('factory retorna função onCall', () => {
      const handler = createSetAiDecisionByAnalystHandler({
        db: {},
        getOpsUserProfile: vi.fn(),
        assertOpsCanAccessCase: vi.fn(),
        writeAuditEvent: vi.fn(),
        getClientIp: () => '127.0.0.1',
        ACTOR_TYPE: {},
        SOURCE: {},
      });
      expect(typeof handler).toBe('function');
    });
  });
});
