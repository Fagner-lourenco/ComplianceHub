import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
    AUDIT_ACTIONS,
    LEVEL,
    CATEGORY,
    ENTITY_TYPE,
    ACTOR_TYPE,
    SOURCE,
} = require('./auditCatalog');

const validLevels = new Set(Object.values(LEVEL));
const validCategories = new Set(Object.values(CATEGORY));
const validEntityTypes = new Set(Object.values(ENTITY_TYPE));

describe('auditCatalog', () => {
    describe('enums', () => {
        it('LEVEL tem 6 valores distintos', () => {
            expect(Object.values(LEVEL)).toHaveLength(6);
            expect(validLevels.size).toBe(6);
        });

        it('CATEGORY tem 12 valores distintos', () => {
            expect(Object.values(CATEGORY)).toHaveLength(12);
            expect(validCategories.size).toBe(12);
        });

        it('ENTITY_TYPE tem valores distintos', () => {
            expect(Object.values(ENTITY_TYPE).length).toBeGreaterThanOrEqual(7);
            expect(validEntityTypes.size).toBeGreaterThanOrEqual(7);
        });

        it('ACTOR_TYPE tem 4 valores distintos', () => {
            const vals = Object.values(ACTOR_TYPE);
            expect(vals).toHaveLength(4);
            expect(new Set(vals).size).toBe(4);
        });

        it('SOURCE tem 5 valores distintos', () => {
            const vals = Object.values(SOURCE);
            expect(vals).toHaveLength(5);
            expect(new Set(vals).size).toBe(5);
        });
    });

    describe('AUDIT_ACTIONS — schema validation', () => {
        const actionEntries = Object.entries(AUDIT_ACTIONS);

        it('tem acoes registradas', () => {
            expect(actionEntries.length).toBeGreaterThanOrEqual(26);
        });

        it.each(actionEntries)('%s tem todos os campos obrigatorios', (_key, action) => {
            expect(action).toHaveProperty('category');
            expect(action).toHaveProperty('level');
            expect(action).toHaveProperty('entityType');
            expect(action).toHaveProperty('clientVisible');
            expect(action).toHaveProperty('summaryTemplate');
            expect(typeof action.clientVisible).toBe('boolean');
            expect(typeof action.summaryTemplate).toBe('string');
            expect(action.summaryTemplate.length).toBeGreaterThan(0);
        });

        it.each(actionEntries)('%s usa valores validos de enum', (_key, action) => {
            expect(validLevels.has(action.level)).toBe(true);
            expect(validCategories.has(action.category)).toBe(true);
            expect(validEntityTypes.has(action.entityType)).toBe(true);
        });

        it('todas as acoes clientVisible tem summaryTemplate (pode nao ter clientSummaryTemplate)', () => {
            for (const [key, action] of actionEntries) {
                if (action.clientVisible) {
                    expect(action.summaryTemplate, `${key} clientVisible mas sem summaryTemplate`).toBeTruthy();
                }
            }
        });
    });

    describe('consistencia com frontend mirror', () => {
        // Import frontend catalog via dynamic import (ESM)
        let frontendActions;

        it('frontend ACTION_LABELS cobre todas as acoes do backend', async () => {
            const frontendCatalog = await import('../../src/core/audit/auditCatalog.js');
            frontendActions = frontendCatalog.ACTION_LABELS;

            const backendKeys = Object.keys(AUDIT_ACTIONS);
            const frontendKeys = Object.keys(frontendActions);

            for (const key of backendKeys) {
                expect(frontendKeys, `Backend action "${key}" nao encontrado no frontend`).toContain(key);
            }
        });

        it('frontend nao tem acoes extras que nao existem no backend', async () => {
            const frontendCatalog = await import('../../src/core/audit/auditCatalog.js');
            const frontendKeys = Object.keys(frontendCatalog.ACTION_LABELS);
            const backendKeys = Object.keys(AUDIT_ACTIONS);

            for (const key of frontendKeys) {
                expect(backendKeys, `Frontend action "${key}" nao encontrado no backend`).toContain(key);
            }
        });

        it('frontend LEVEL enum tem mesmos valores que backend', async () => {
            const { LEVEL: FE_LEVEL } = await import('../../src/core/audit/auditCatalog.js');
            expect(FE_LEVEL).toEqual(LEVEL);
        });

        it('frontend CATEGORY enum tem mesmos valores que backend', async () => {
            const { CATEGORY: FE_CAT } = await import('../../src/core/audit/auditCatalog.js');
            expect(FE_CAT).toEqual(CATEGORY);
        });

        it('frontend ENTITY_TYPE enum tem mesmos valores que backend', async () => {
            const { ENTITY_TYPE: FE_ET } = await import('../../src/core/audit/auditCatalog.js');
            expect(FE_ET).toEqual(ENTITY_TYPE);
        });
    });

    describe('acoes de quota', () => {
        it('tem 4 acoes de quota/limites', () => {
            const quotaActions = ['DAILY_LIMIT_EXCEEDED', 'MONTHLY_LIMIT_EXCEEDED', 'SUBMISSION_BLOCKED_DAILY', 'SUBMISSION_BLOCKED_MONTHLY'];
            for (const key of quotaActions) {
                expect(AUDIT_ACTIONS).toHaveProperty(key);
                expect(AUDIT_ACTIONS[key].clientVisible).toBe(true);
            }
        });

        it('SUBMISSION_BLOCKED tem summaryTemplate com placeholder de limite', () => {
            expect(AUDIT_ACTIONS.SUBMISSION_BLOCKED_DAILY.summaryTemplate).toContain('{dailyLimit}');
            expect(AUDIT_ACTIONS.SUBMISSION_BLOCKED_MONTHLY.summaryTemplate).toContain('{monthlyLimit}');
        });
    });
});
