import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
    createConcludeCaseByAnalystHandler,
    createUpdateTenantSettingsByAnalystHandler,
    createSaveCaseDraftByAnalystHandler,
    createSetAiDecisionByAnalystHandler,
} = require('./opsReviewHandlers');

describe('opsReviewHandlers', () => {
    it('createConcludeCaseByAnalystHandler e funcao', () => {
        expect(typeof createConcludeCaseByAnalystHandler).toBe('function');
    });
    it('createUpdateTenantSettingsByAnalystHandler e funcao', () => {
        expect(typeof createUpdateTenantSettingsByAnalystHandler).toBe('function');
    });
    it('createSaveCaseDraftByAnalystHandler e funcao', () => {
        expect(typeof createSaveCaseDraftByAnalystHandler).toBe('function');
    });
    it('createSetAiDecisionByAnalystHandler e funcao', () => {
        expect(typeof createSetAiDecisionByAnalystHandler).toBe('function');
    });
});
