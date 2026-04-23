/**
 * Transforms V2 artifacts (moduleRuns + riskSignals + caseData) into the
 * real-time analysis experience state consumed by AnaliseRapidaPage.
 *
 * Strategy:
 *  - Progress percentage mirrors how many executable moduleRuns reached a
 *    terminal status (completed_*, skipped_*, failed_*, blocked). Pure backend
 *    data — no fake smoothing beyond a floor to avoid 0% flicker while the
 *    first batch lands.
 *  - Risk color derives from the max severity observed in riskSignals so far.
 *  - Status copy is derived from the phase (initializing / running / wrapping).
 */

const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };

const RISK_BUCKETS = [
    { key: 'low', label: 'Risco baixo', colorVar: '--green-600', bg: '--green-50', rank: 1 },
    { key: 'attention', label: 'Pontos de atencao', colorVar: '--yellow-700', bg: '--yellow-50', rank: 2 },
    { key: 'moderate', label: 'Risco moderado', colorVar: '--orange-600', bg: '--orange-50', rank: 3 },
    { key: 'high', label: 'Risco elevado', colorVar: '--red-600', bg: '--red-50', rank: 4 },
];

const TERMINAL_STATUSES = new Set([
    'completed_no_findings',
    'completed_with_findings',
    'skipped_reuse',
    'skipped_policy',
    'failed_retryable',
    'failed_final',
    'blocked',
    'not_entitled',
]);

const RUNNING_STATUSES = new Set(['running', 'pending']);

const MODULE_DISPLAY = {
    identity_pf: { title: 'Cadastral PF', icon: 'ID' },
    identity_pj: { title: 'Cadastral PJ', icon: 'EM' },
    criminal: { title: 'Criminal', icon: 'CR' },
    labor: { title: 'Trabalhista', icon: 'TR' },
    warrants: { title: 'Mandados', icon: 'MD' },
    judicial: { title: 'Judicial', icon: 'JU' },
    kyc: { title: 'PEP e Listas', icon: 'KY' },
    osint: { title: 'OSINT / Midia', icon: 'OS' },
    sanctions: { title: 'Sancoes', icon: 'SC' },
    media: { title: 'Midia Adversa', icon: 'MA' },
    address: { title: 'Enderecos', icon: 'EN' },
    relationship: { title: 'Relacoes societarias', icon: 'RL' },
};

export function moduleDisplay(moduleKey) {
    return MODULE_DISPLAY[moduleKey] || { title: moduleKey, icon: '··' };
}

function severityRank(sev) {
    return SEVERITY_RANK[sev] ?? 0;
}

export function maxSeverity(riskSignals = []) {
    let max = 0;
    for (const signal of riskSignals) {
        const rank = severityRank(signal.severity);
        if (rank > max) max = rank;
    }
    return max;
}

export function resolveRiskBucket({ riskSignals = [], caseData = null } = {}) {
    const rank = Math.max(
        maxSeverity(riskSignals),
        severityRank(caseData?.riskSeverity),
    );
    if (rank >= 4) return RISK_BUCKETS[3];
    if (rank === 3) return RISK_BUCKETS[2];
    if (rank === 2) return RISK_BUCKETS[1];
    return RISK_BUCKETS[0];
}

export function computeProgress({ caseData = null, moduleRuns = [] } = {}) {
    const status = caseData?.status || null;
    if (status === 'DONE') return 100;
    if (!moduleRuns.length) {
        // Before the first moduleRun lands, we show a small baseline so the
        // bar does not stick at 0 — the case doc itself being created is
        // real progress (createClientSolicitation + materialize).
        return status === 'PENDING' ? 6 : 3;
    }
    const executable = moduleRuns.filter((m) => m.status !== 'not_entitled');
    if (executable.length === 0) return 10;
    const terminal = executable.filter((m) => TERMINAL_STATUSES.has(m.status)).length;
    const running = executable.filter((m) => RUNNING_STATUSES.has(m.status)).length;
    // Each running module contributes half of its slot for smoother feel while
    // still reflecting the real "X modules finished" truth.
    const raw = ((terminal + running * 0.5) / executable.length) * 100;
    const clamped = Math.min(99, Math.max(8, Math.round(raw)));
    return status === 'DONE' ? 100 : clamped;
}

export function buildModuleCards({ moduleRuns = [], riskSignals = [] } = {}) {
    const signalsByModule = riskSignals.reduce((acc, signal) => {
        const key = signal.moduleKey || 'unknown';
        acc[key] = acc[key] || [];
        acc[key].push(signal);
        return acc;
    }, {});

    return moduleRuns
        .filter((m) => m.status !== 'not_entitled')
        .map((moduleRun) => {
            const display = moduleDisplay(moduleRun.moduleKey);
            const signals = signalsByModule[moduleRun.moduleKey] || [];
            const sevRank = maxSeverity(signals);
            let uiState = 'waiting';
            let stateLabel = 'Na fila';
            if (RUNNING_STATUSES.has(moduleRun.status)) {
                uiState = 'running';
                stateLabel = 'Consultando';
            } else if (TERMINAL_STATUSES.has(moduleRun.status)) {
                if (sevRank >= 3) { uiState = 'alert'; stateLabel = 'Atencao detectada'; }
                else if (sevRank === 2) { uiState = 'watch'; stateLabel = 'Ponto de atencao'; }
                else if (moduleRun.status === 'blocked') { uiState = 'blocked'; stateLabel = 'Bloqueado no gate'; }
                else if (moduleRun.status === 'failed_final' || moduleRun.status === 'failed_retryable') { uiState = 'failed'; stateLabel = 'Falha na consulta'; }
                else if (moduleRun.status === 'skipped_reuse' || moduleRun.status === 'skipped_policy') { uiState = 'reused'; stateLabel = 'Reaproveitado'; }
                else if (moduleRun.status === 'completed_with_findings') { uiState = 'watch'; stateLabel = 'Achados sinalizados'; }
                else { uiState = 'ok'; stateLabel = 'Sem achados relevantes'; }
            }
            const topSignal = signals.sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0] || null;
            return {
                moduleKey: moduleRun.moduleKey,
                title: display.title,
                icon: display.icon,
                uiState,
                stateLabel,
                signalCount: signals.length,
                topSignalReason: topSignal?.reason || null,
                severity: topSignal?.severity || null,
            };
        });
}

export function deriveStatusMessage({ progress, caseData, moduleRuns = [], riskSignals = [] } = {}) {
    if (caseData?.status === 'DONE') {
        const bucket = resolveRiskBucket({ riskSignals, caseData });
        return `Analise concluida — ${bucket.label.toLowerCase()}.`;
    }
    if (caseData?.status === 'CORRECTION_NEEDED') {
        return 'Analise devolvida — revise os dados informados.';
    }
    if (progress < 10) return 'Iniciando analise e abrindo o caso...';
    if (progress < 25) return 'Consultando bases cadastrais oficiais...';
    if (progress < 50) {
        const running = moduleRuns.filter((m) => RUNNING_STATUSES.has(m.status));
        if (running.length > 0) return `Consultando ${running.length} modulo(s) em paralelo...`;
        return 'Executando modulos em paralelo...';
    }
    if (progress < 75) {
        if (riskSignals.length > 0) {
            const count = riskSignals.length;
            return `Compilando ${count} sinal${count === 1 ? '' : 'is'} detectado${count === 1 ? '' : 's'} ate aqui...`;
        }
        return 'Processando achados e cruzando referencias...';
    }
    if (progress < 95) return 'Consolidando evidencias e aplicando classificacao de risco...';
    return 'Finalizando relatorio estruturado...';
}

export function isAnalysisComplete(caseData) {
    return caseData?.status === 'DONE';
}

export { RISK_BUCKETS, TERMINAL_STATUSES, RUNNING_STATUSES, MODULE_DISPLAY };
