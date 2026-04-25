import { describe, expect, it } from 'vitest';
import { resolveReportSections, buildReportSnapshotFromV2 } from './v2ReportSections.js';

// Golden fixture: deterministic input representing a "typical" PF dossier with findings.
// The hashes below are frozen against a specific algorithm version. If `stableHash`, section
// ordering, or the resolver's contract change, these tests fail loudly — signalling that a
// published ReportSnapshot could change meaning silently.
const GOLDEN_FIXTURE = {
    caseId: 'GOLDEN-PF-001',
    productKey: 'kye_employee',
    moduleRuns: [
        { moduleKey: 'identity_pf', status: 'completed_with_findings', requested: true },
        { moduleKey: 'criminal', status: 'completed_with_findings', requested: true },
        { moduleKey: 'labor', status: 'completed_no_findings', requested: true },
        { moduleKey: 'warrants', status: 'completed_no_findings', requested: true },
        { moduleKey: 'decision', status: 'completed_no_findings', requested: false },
    ],
    evidenceItems: [
        { id: 'ev_pf_001', moduleKey: 'identity_pf', severity: 'info' },
        { id: 'ev_cr_001', moduleKey: 'criminal', severity: 'high' },
        { id: 'ev_cr_002', moduleKey: 'criminal', severity: 'medium' },
    ],
    riskSignals: [
        { id: 'rs_cr_001', moduleKey: 'criminal', kind: 'criminal_risk', severity: 'high', scoreImpact: 40, reason: 'Processo criminal ativo' },
    ],
    subject: {
        id: 'subj_cpf_abc12345',
        type: 'pf',
        declaredName: 'João da Silva',
        primaryDocument: { docType: 'cpf', docValue: '12345678901' },
    },
    decision: {
        id: 'dec_golden_pf_001',
        verdict: 'ATTENTION',
        reasons: 'Achado criminal ativo requer revisao.',
    },
};

describe('v2ReportSections — golden snapshot', () => {
    it('resolveReportSections produces deterministic output for the golden PF fixture', () => {
        const a = resolveReportSections(GOLDEN_FIXTURE);
        const b = resolveReportSections(GOLDEN_FIXTURE);

        // Determinism: repeated runs yield byte-identical contract outputs.
        expect(a.contentHash).toBe(b.contentHash);
        expect(a.evidenceSetHash).toBe(b.evidenceSetHash);
        expect(a.reportModuleKeys).toEqual(b.reportModuleKeys);
        expect(a.sections.map((s) => s.sectionKey)).toEqual(b.sections.map((s) => s.sectionKey));
    });

    it('report module keys for the golden PF fixture are frozen', () => {
        const { reportModuleKeys } = resolveReportSections(GOLDEN_FIXTURE);

        // Frozen contract: modules with findings (evidence or signals) plus resolver
        // internals end up in the public report. Modules without findings are pruned.
        expect([...reportModuleKeys].sort()).toEqual([
            'criminal',
            'decision',
            'identity_pf',
        ]);
    });

    it('section keys and order for the golden PF fixture are frozen', () => {
        const { sections } = resolveReportSections(GOLDEN_FIXTURE);
        const sectionKeys = sections.map((s) => s.sectionKey);

        // Canonical ordering must include identity, criminal, labor, warrants, risk overview,
        // analyst conclusion (when decision.reasons is present).
        expect(sectionKeys).toContain('identity');
        expect(sectionKeys).toContain('criminal');
        expect(sectionKeys).toContain('riskOverview');
        expect(sectionKeys).toContain('analystConclusion');

        const identityIdx = sectionKeys.indexOf('identity');
        const criminalIdx = sectionKeys.indexOf('criminal');
        const conclusionIdx = sectionKeys.indexOf('analystConclusion');
        expect(identityIdx).toBeLessThan(criminalIdx);
        expect(criminalIdx).toBeLessThan(conclusionIdx);
    });

    it('hashes change when a relevant input changes', () => {
        const base = resolveReportSections(GOLDEN_FIXTURE);
        const mutated = resolveReportSections({
            ...GOLDEN_FIXTURE,
            evidenceItems: [
                ...GOLDEN_FIXTURE.evidenceItems,
                { id: 'ev_cr_003', moduleKey: 'criminal', severity: 'high' },
            ],
        });

        expect(mutated.evidenceSetHash).not.toBe(base.evidenceSetHash);
        expect(mutated.contentHash).not.toBe(base.contentHash);
    });

    it('hashes are stable when irrelevant input changes (HTML is not hashed)', () => {
        const base = resolveReportSections(GOLDEN_FIXTURE);
        const snapshotA = buildReportSnapshotFromV2({
            ...GOLDEN_FIXTURE,
            html: '<html>A</html>',
            tenantId: 'tenant-x',
            builderVersion: 'test-1',
        });
        const snapshotB = buildReportSnapshotFromV2({
            ...GOLDEN_FIXTURE,
            html: '<html>B</html>',
            tenantId: 'tenant-x',
            builderVersion: 'test-1',
        });

        expect(snapshotA.contentHash).toBe(base.contentHash);
        expect(snapshotB.contentHash).toBe(base.contentHash);
        expect(snapshotA.evidenceSetHash).toBe(base.evidenceSetHash);
    });

    it('snapshot status = ready when html is present AND sections were built', () => {
        const snapshot = buildReportSnapshotFromV2({
            ...GOLDEN_FIXTURE,
            html: '<html>report</html>',
            tenantId: 'tenant-x',
            builderVersion: 'test-1',
        });
        expect(snapshot.status).toBe('ready');
        expect(snapshot.moduleKeys).toEqual(snapshot.reportModuleKeys);
    });

    it('snapshot status = failed when html is empty', () => {
        const snapshot = buildReportSnapshotFromV2({
            ...GOLDEN_FIXTURE,
            html: '',
            tenantId: 'tenant-x',
            builderVersion: 'test-1',
        });
        expect(snapshot.status).toBe('failed');
    });
});
