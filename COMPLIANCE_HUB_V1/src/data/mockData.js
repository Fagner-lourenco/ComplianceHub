import { sanitizeCaseForClient } from '../core/clientPortal';
import { TEN_001_CASES } from './mockCasesTenant1';
import { TEN_002_CASES } from './mockCasesTenant2';

function withPublicResult(caseData) {
    return {
        enabledPhases: caseData.enabledPhases || ['criminal', 'labor', 'warrant', 'osint', 'social', 'digital', 'conflictInterest'],
        reportReady: caseData.reportReady ?? caseData.status === 'DONE',
        hasNotes: caseData.hasNotes ?? Boolean(caseData.analystComment || caseData.executiveSummary || caseData.clientNotes),
        hasEvidence: caseData.hasEvidence ?? Boolean(
            (Array.isArray(caseData.processHighlights) && caseData.processHighlights.length > 0)
            || (Array.isArray(caseData.warrantFindings) && caseData.warrantFindings.length > 0)
            || (Array.isArray(caseData.timelineEvents) && caseData.timelineEvents.some((event) => event.status === 'risk'))
        ),
        exportHistory: caseData.exportHistory || [],
        ...caseData,
        publicResultMock: sanitizeCaseForClient(caseData),
    };
}

export const MOCK_CASES = [...TEN_001_CASES, ...TEN_002_CASES].map(withPublicResult);

export const MOCK_EXPORTS = [
    {
        id: 'EXP-TECH-001',
        tenantId: 'TEN-001',
        type: 'REPORT',
        scope: 'Casos concluidos de marco',
        createdAt: '2026-04-03 09:42',
        status: 'READY',
        records: 4,
        artifactCaseId: 'CASE-002',
        notes: 'Relatorio consolidado compartilhado com diretoria de RH.',
    },
    {
        id: 'EXP-TECH-002',
        tenantId: 'TEN-001',
        type: 'PDF',
        scope: 'Caso CASE-012 - Patricia Vieira Moura',
        createdAt: '2026-04-02 18:15',
        status: 'READY',
        records: 1,
        artifactCaseId: 'CASE-012',
        notes: 'Versao executiva enviada para comite de Compras.',
    },
    {
        id: 'EXP-TECH-003',
        tenantId: 'TEN-001',
        type: 'CSV',
        scope: 'Pipeline completo do tenant demo',
        createdAt: '2026-04-02 08:30',
        status: 'READY',
        records: 8,
        artifactCaseId: null,
        notes: 'Extracao tabular para auditoria interna do cliente.',
    },
    {
        id: 'EXP-TECH-004',
        tenantId: 'TEN-001',
        type: 'PDF',
        scope: 'Caso CASE-004 - Joao Pedro Almeida',
        createdAt: '2026-03-27 10:05',
        status: 'READY',
        records: 1,
        artifactCaseId: 'CASE-004',
        notes: 'Relatorio com ressalva usado na reuniao de calibracao.',
    },
    {
        id: 'EXP-BANCO-001',
        tenantId: 'TEN-002',
        type: 'REPORT',
        scope: 'Casos concluidos do Banco Atlantico',
        createdAt: '2026-04-01 11:20',
        status: 'READY',
        records: 3,
        artifactCaseId: 'CASE-008',
        notes: 'Consolidado de risco para area de Compliance.',
    },
];

MOCK_CASES.forEach((caseData) => {
    caseData.exportHistory = MOCK_EXPORTS
        .filter((item) => item.tenantId === caseData.tenantId && (!item.artifactCaseId || item.artifactCaseId === caseData.id))
        .map((item) => item.id);
});

export const MOCK_CASE_DETAILS = Object.fromEntries(
    MOCK_CASES.map((caseData) => [
        caseData.id,
        {
            executiveSummary: caseData.executiveSummary,
            statusSummary: caseData.statusSummary,
            sourceSummary: caseData.sourceSummary,
            keyFindings: caseData.keyFindings,
            nextSteps: caseData.nextSteps,
            clientNotes: caseData.clientNotes,
            processHighlights: caseData.processHighlights,
            warrantFindings: caseData.warrantFindings,
            timelineEvents: caseData.timelineEvents,
            reportReady: caseData.reportReady,
            reportSlug: caseData.reportSlug,
            analystComment: caseData.analystComment,
            criminalNotes: caseData.criminalNotes,
            laborNotes: caseData.laborNotes,
            warrantNotes: caseData.warrantNotes,
            osintNotes: caseData.osintNotes,
            osintVectors: caseData.osintVectors,
            socialNotes: caseData.socialNotes,
            socialReasons: caseData.socialReasons,
            digitalNotes: caseData.digitalNotes,
            digitalVectors: caseData.digitalVectors,
            conflictNotes: caseData.conflictNotes,
        },
    ]),
);

export function getMockCaseById(caseId) {
    return MOCK_CASES.find((caseData) => caseData.id === caseId) || null;
}

export function getMockExports(tenantId) {
    if (!tenantId) return MOCK_EXPORTS;
    return MOCK_EXPORTS.filter((item) => item.tenantId === tenantId);
}

export function getMockPublicReports(tenantId) {
    const filteredCases = tenantId
        ? MOCK_CASES.filter((caseData) => caseData.tenantId === tenantId)
        : MOCK_CASES;

    return filteredCases
        .filter((caseData) => caseData.status === 'DONE')
        .map((caseData, index) => {
            const createdAt = new Date(Date.now() - (index + 2) * 24 * 60 * 60 * 1000);
            const expiresAt = new Date(createdAt.getTime() + 365 * 24 * 60 * 60 * 1000);
            const revoked = index % 5 === 3;
            const expired = index % 5 === 4;
            return {
                id: caseData.publicReportToken || `mock-report-${caseData.id.toLowerCase()}`,
                token: caseData.publicReportToken || `mock-report-${caseData.id.toLowerCase()}`,
                caseId: caseData.id,
                tenantId: caseData.tenantId,
                candidateName: caseData.candidateName,
                active: !revoked,
                status: revoked ? 'REVOKED' : expired ? 'EXPIRED' : 'ACTIVE',
                createdAt: createdAt.toISOString(),
                expiresAt: expired
                    ? new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
                    : expiresAt.toISOString(),
            };
        });
}
