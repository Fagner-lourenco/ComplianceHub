import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const {
    serializeClientCaseDocument,
    matchesClientCaseSearch,
    matchesClientCaseFilters,
    matchesOpsCaseSearch,
    matchesOpsCaseFilters,
    buildOpsCaseStats,
} = require('./caseFilters');

describe('caseFilters', () => {
    describe('serializeClientCaseDocument', () => {
        it('serializa documento com timestamps', () => {
            const mockDoc = {
                id: 'case-1',
                data: () => ({
                    candidateName: 'Joao',
                    createdAt: { toDate: () => new Date('2024-01-15') },
                    updatedAt: { toDate: () => new Date('2024-01-16') },
                }),
            };

            const result = serializeClientCaseDocument(mockDoc);
            expect(result.id).toBe('case-1');
            expect(result.candidateName).toBe('Joao');
            expect(result.createdAt).toBeInstanceOf(Date);
            expect(result.updatedAt).toBeInstanceOf(Date);
        });
    });

    describe('matchesClientCaseSearch', () => {
        it('retorna true sem termo de busca', () => {
            expect(matchesClientCaseSearch({ candidateName: 'Joao' }, '')).toBe(true);
            expect(matchesClientCaseSearch({ candidateName: 'Joao' }, null)).toBe(true);
        });

        it('encontra por nome', () => {
            expect(matchesClientCaseSearch({ candidateName: 'Joao Silva' }, 'joao')).toBe(true);
            expect(matchesClientCaseSearch({ candidateName: 'Joao Silva' }, 'maria')).toBe(false);
        });

        it('encontra por CPF', () => {
            expect(matchesClientCaseSearch({ candidateCpf: '123.456.789-00' }, '123.456')).toBe(true);
        });
    });

    describe('matchesClientCaseFilters', () => {
        it('retorna true sem filtros', () => {
            expect(matchesClientCaseFilters({ status: 'DONE' }, null)).toBe(true);
        });

        it('filtra por status', () => {
            expect(matchesClientCaseFilters({ status: 'DONE' }, { status: 'DONE' })).toBe(true);
            expect(matchesClientCaseFilters({ status: 'PENDING' }, { status: 'DONE' })).toBe(false);
        });

        it('ignora filtros ALL enviados pelo portal cliente', () => {
            expect(matchesClientCaseFilters({ status: 'DONE', finalVerdict: 'FIT' }, { status: 'ALL', verdict: 'ALL', searchTerm: '' })).toBe(true);
        });

        it('filtra por alias verdict e termo de busca do portal cliente', () => {
            const caseData = { candidateName: 'Maria Silva', cpfMasked: '***.***.***-12', finalVerdict: 'FIT' };

            expect(matchesClientCaseFilters(caseData, { verdict: 'FIT', searchTerm: 'maria' })).toBe(true);
            expect(matchesClientCaseFilters(caseData, { verdict: 'NOT_RECOMMENDED' })).toBe(false);
            expect(matchesClientCaseFilters(caseData, { searchTerm: '999' })).toBe(false);
        });

        it('filtra por risco', () => {
            expect(matchesClientCaseFilters({ riskLevel: 'RED' }, { riskLevel: 'RED' })).toBe(true);
            expect(matchesClientCaseFilters({ riskLevel: 'GREEN' }, { riskLevel: 'RED' })).toBe(false);
        });

        it('filtra por data', () => {
            const caseData = {
                createdAt: new Date('2024-01-15'),
            };
            expect(matchesClientCaseFilters(caseData, { dateFrom: '2024-01-01' })).toBe(true);
            expect(matchesClientCaseFilters(caseData, { dateFrom: '2024-02-01' })).toBe(false);
        });
    });

    describe('matchesOpsCaseSearch', () => {
        it('busca por nome do solicitante', () => {
            expect(matchesOpsCaseSearch({ requesterName: 'Maria Souza' }, 'maria')).toBe(true);
            expect(matchesOpsCaseSearch({ requesterName: 'Maria Souza' }, 'joao')).toBe(false);
        });

        it('busca por nome do analista atribuído', () => {
            expect(matchesOpsCaseSearch({ assignedToName: 'Ana Paula' }, 'ana')).toBe(true);
        });
    });

    describe('matchesOpsCaseFilters', () => {
        it('filtra por tenant', () => {
            const options = { showAllTenants: false, currentTenantId: 't1' };
            expect(matchesOpsCaseFilters({ tenantId: 't1' }, {}, options)).toBe(true);
            expect(matchesOpsCaseFilters({ tenantId: 't2' }, {}, options)).toBe(false);
        });

        it('permite todos os tenants para owner', () => {
            const options = { showAllTenants: true, currentTenantId: 't1' };
            expect(matchesOpsCaseFilters({ tenantId: 't2' }, {}, options)).toBe(true);
        });

        it('filtra por analista atribuído', () => {
            expect(matchesOpsCaseFilters({ assignedTo: 'user-1' }, { assignedTo: 'user-1' })).toBe(true);
            expect(matchesOpsCaseFilters({ assignedTo: 'user-2' }, { assignedTo: 'user-1' })).toBe(false);
        });
    });

    describe('buildOpsCaseStats', () => {
        it('calcula estatísticas corretamente', () => {
            const cases = [
                { status: 'DONE', riskLevel: 'GREEN', finalVerdict: 'FIT' },
                { status: 'DONE', riskLevel: 'RED', finalVerdict: 'NOT_RECOMMENDED' },
                { status: 'PENDING', riskLevel: 'YELLOW', finalVerdict: 'ATTENTION' },
            ];

            const stats = buildOpsCaseStats(cases);
            expect(stats.total).toBe(3);
            expect(stats.pending).toBe(1);
            expect(stats.done).toBe(2);
            expect(stats.byRisk.RED).toBe(1);
            expect(stats.byRisk.GREEN).toBe(1);
            expect(stats.byVerdict.FIT).toBe(1);
            expect(stats.byVerdict.NOT_RECOMMENDED).toBe(1);
        });

        it('lida com array vazio', () => {
            const stats = buildOpsCaseStats([]);
            expect(stats.total).toBe(0);
            expect(stats.byRisk.GREEN).toBe(0);
        });
    });
});
