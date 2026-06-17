import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { normalizeJuditLawsuits } = require('./judit');

describe('normalizeJuditLawsuits side fallback', () => {
    it('classifies unknown role with side Passive as DEFENDANT/HIGH in criminal', () => {
        const result = normalizeJuditLawsuits({
            hasLawsuits: true,
            requestId: 'req-1',
            responseData: [{
                code: '0000000-00.0000.0.00.0000',
                area: 'DIREITO PENAL',
                status: 'ATIVO',
                subjects: [],
                classifications: ['Ação Penal'],
                parties: [{
                    main_document: '12345678900',
                    person_type: 'ENVOLVIDO',
                    side: 'Passive',
                }],
            }],
        }, '12345678900');

        expect(result.juditRoleSummary).toHaveLength(1);
        expect(result.juditRoleSummary[0].roleClassification).toEqual({
            category: 'DEFENDANT',
            riskLevel: 'HIGH',
            reason: expect.stringContaining('lado passivo'),
        });
        expect(result.juditRoleSummary[0].isDefendant).toBe(true);
    });

    it('classifies unknown role with side Active as PLAINTIFF/LOW in criminal', () => {
        const result = normalizeJuditLawsuits({
            hasLawsuits: true,
            requestId: 'req-1',
            responseData: [{
                code: '0000000-00.0000.0.00.0000',
                area: 'DIREITO PENAL',
                status: 'ATIVO',
                subjects: [],
                classifications: ['Ação Penal'],
                parties: [{
                    main_document: '12345678900',
                    person_type: 'ENVOLVIDO',
                    side: 'Active',
                }],
            }],
        }, '12345678900');

        expect(result.juditRoleSummary[0].roleClassification).toEqual({
            category: 'PLAINTIFF',
            riskLevel: 'LOW',
            reason: expect.stringContaining('lado ativo'),
        });
        expect(result.juditRoleSummary[0].isPlaintiff).toBe(true);
    });

    it('normalizes abbreviated side P to Passive', () => {
        const result = normalizeJuditLawsuits({
            hasLawsuits: true,
            requestId: 'req-1',
            responseData: [{
                code: '0000000-00.0000.0.00.0000',
                area: 'DIREITO PENAL',
                status: 'ATIVO',
                subjects: [],
                classifications: ['Ação Penal'],
                parties: [{
                    main_document: '12345678900',
                    person_type: 'ENVOLVIDO',
                    side: 'P',
                }],
            }],
        }, '12345678900');

        expect(result.juditRoleSummary[0].roleClassification.category).toBe('DEFENDANT');
    });
});
