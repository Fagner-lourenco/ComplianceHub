import { describe, expect, it } from 'vitest';
import { buildTimelineEventsForCase, buildProviderDivergencesForCase } from './v2Timeline.js';

describe('v2Timeline — buildTimelineEventsForCase', () => {
    it('gera eventos para modulos executados', () => {
        const events = buildTimelineEventsForCase({
            caseId: 'CASE-001',
            tenantId: 'tenant-abc',
            moduleRuns: [
                { moduleKey: 'identity_pf', status: 'completed_with_findings', evidenceIds: ['ev1'] },
                { moduleKey: 'criminal', status: 'completed_with_findings', evidenceIds: ['ev2'] },
            ],
        });
        const types = events.map((e) => e.eventType);
        expect(types).toContain('module_run_completed');
        const mrEvents = events.filter((e) => e.eventType === 'module_run_completed');
        expect(mrEvents).toHaveLength(2);
    });

    it('nao gera evento para modulo nao executado', () => {
        const events = buildTimelineEventsForCase({
            caseId: 'CASE-001',
            moduleRuns: [
                { moduleKey: 'osint', status: 'pending' },
                { moduleKey: 'social', status: 'failed_final' },
            ],
        });
        expect(events.filter((e) => e.eventType === 'module_run_completed')).toHaveLength(0);
    });

    it('gera eventos de evidencias agrupados por modulo', () => {
        const events = buildTimelineEventsForCase({
            caseId: 'CASE-002',
            evidenceItems: [
                { id: 'ev1', moduleKey: 'criminal' },
                { id: 'ev2', moduleKey: 'criminal' },
                { id: 'ev3', moduleKey: 'warrants' },
            ],
        });
        const evEvents = events.filter((e) => e.eventType === 'evidence_created');
        expect(evEvents).toHaveLength(2);
        const criminalEvent = evEvents.find((e) => e.moduleKey === 'criminal');
        expect(criminalEvent).toBeTruthy();
        expect(criminalEvent.linkedIds.evidenceIds).toHaveLength(2);
    });

    it('gera evento apenas para sinais high e critical', () => {
        const events = buildTimelineEventsForCase({
            caseId: 'CASE-003',
            riskSignals: [
                { id: 'rs1', moduleKey: 'warrants', severity: 'critical', reason: 'Mandado ativo', kind: 'warrant_risk' },
                { id: 'rs2', moduleKey: 'criminal', severity: 'high', reason: 'Processo criminal', kind: 'criminal_risk' },
                { id: 'rs3', moduleKey: 'labor', severity: 'low', reason: 'Debito trabalhista', kind: 'labor_risk' },
            ],
        });
        const signalEvents = events.filter((e) => e.eventType === 'risk_signal_raised');
        expect(signalEvents).toHaveLength(2);
        expect(signalEvents[0].severity).toBe('critical');
    });

    it('gera evento de decisao quando fornecida', () => {
        const events = buildTimelineEventsForCase({
            caseId: 'CASE-004',
            decision: { id: 'dec-001', verdict: 'FIT' },
        });
        const decEvent = events.find((e) => e.eventType === 'decision_made');
        expect(decEvent).toBeTruthy();
        expect(decEvent.summary).toContain('FIT');
    });

    it('gera evento de relatorio quando reportSnapshot fornecido', () => {
        const events = buildTimelineEventsForCase({
            caseId: 'CASE-005',
            reportSnapshot: { id: 'snap-001', status: 'ready' },
        });
        const repEvent = events.find((e) => e.eventType === 'report_generated');
        expect(repEvent).toBeTruthy();
        expect(repEvent.linkedIds.reportSnapshotId).toBe('snap-001');
    });

    it('deduplica eventos por id na reexecucao', () => {
        const moduleRuns = [
            { moduleKey: 'criminal', status: 'completed_with_findings' },
        ];
        const events1 = buildTimelineEventsForCase({ caseId: 'CASE-006', moduleRuns });
        const events2 = buildTimelineEventsForCase({ caseId: 'CASE-006', moduleRuns });
        expect(events1.map((e) => e.id)).toEqual(events2.map((e) => e.id));
    });

    it('retorna lista vazia quando caseId e nulo', () => {
        expect(buildTimelineEventsForCase({ caseId: null })).toHaveLength(0);
    });
});

describe('v2Timeline — buildProviderDivergencesForCase', () => {
    it('detecta divergencia a partir de riskSignal com kind=provider_divergence', () => {
        const divergences = buildProviderDivergencesForCase({
            caseId: 'CASE-010',
            riskSignals: [
                {
                    id: 'rs-div-1',
                    moduleKey: 'criminal',
                    kind: 'provider_divergence',
                    severity: 'high',
                    reason: 'Contagens divergentes de processos',
                    supportingEvidenceIds: ['ev1', 'ev2'],
                },
            ],
        });
        expect(divergences).toHaveLength(1);
        expect(divergences[0].moduleKey).toBe('criminal');
        expect(divergences[0].severity).toBe('high');
        expect(divergences[0].conflictingEvidenceIds).toContain('ev1');
    });

    it('divergencia critica seta blocksPublication=true', () => {
        const divergences = buildProviderDivergencesForCase({
            caseId: 'CASE-011',
            riskSignals: [
                {
                    id: 'rs-critical',
                    moduleKey: 'warrants',
                    kind: 'provider_divergence',
                    severity: 'critical',
                    reason: 'Contagem critica divergente',
                    supportingEvidenceIds: [],
                },
            ],
        });
        expect(divergences[0].blocksPublication).toBe(true);
    });

    it('detecta divergencia por evidencias de providers diferentes para mesmo modulo', () => {
        const divergences = buildProviderDivergencesForCase({
            caseId: 'CASE-012',
            evidenceItems: [
                { id: 'ev1', moduleKey: 'criminal', provider: 'judit' },
                { id: 'ev2', moduleKey: 'criminal', provider: 'judit' },
                { id: 'ev3', moduleKey: 'criminal', provider: 'bigdatacorp' },
            ],
        });
        const criminalDiv = divergences.find((d) => d.moduleKey === 'criminal');
        expect(criminalDiv).toBeTruthy();
        expect(criminalDiv.conflictingEvidenceIds.length).toBeGreaterThan(0);
    });

    it('nao gera divergencia quando ha apenas um provider por modulo', () => {
        const divergences = buildProviderDivergencesForCase({
            caseId: 'CASE-013',
            evidenceItems: [
                { id: 'ev1', moduleKey: 'criminal', provider: 'judit' },
                { id: 'ev2', moduleKey: 'criminal', provider: 'judit' },
            ],
        });
        expect(divergences).toHaveLength(0);
    });

    it('retorna lista vazia quando caseId e nulo', () => {
        expect(buildProviderDivergencesForCase({ caseId: null })).toHaveLength(0);
    });
});
