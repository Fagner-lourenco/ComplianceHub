export function getOverallEnrichmentStatus(caseData) {
    const statuses = [
        caseData?.juditEnrichmentStatus,
        caseData?.escavadorEnrichmentStatus,
        caseData?.enrichmentStatus,
        caseData?.bigdatacorpEnrichmentStatus,
        caseData?.djenEnrichmentStatus,
        caseData?.escavador2EnrichmentStatus,
        caseData?.aiStatus,
    ].filter(Boolean);

    if (statuses.includes('RUNNING')) return 'RUNNING';
    if (statuses.includes('BLOCKED')) return 'BLOCKED';
    if (statuses.includes('PARTIAL')) return 'PARTIAL';
    // BUG-6 fix: If any provider DONE + another FAILED, report PARTIAL (not DONE).
    if (statuses.includes('FAILED') && statuses.includes('DONE')) return 'PARTIAL';
    if (statuses.includes('FAILED')) return 'FAILED';
    if (statuses.includes('DONE')) return 'DONE';
    if (statuses.length > 0 && statuses.every((status) => status === 'SKIPPED')) return 'SKIPPED';
    return 'PENDING';
}

// ─────────────────────────────────────────────────────────────────────────────
// Cobertura por fonte (2026-09).
//
// getOverallEnrichmentStatus acima resume o caso em UM status e alimenta o
// filtro da fila (com espelho no backend). Nao mexer nela.
//
// Esta funcao responde outra pergunta: QUAIS fontes ficaram de fora e por que.
// Ate entao o painel do analista so listava provedores com status DONE, entao a
// fonte que falhou simplesmente desaparecia da tela — e 42,6% dos casos limpos
// foram concluidos com alguma fonte em FAILED/SKIPPED/PENDING sem ninguem ver.
// ─────────────────────────────────────────────────────────────────────────────

export const PROVIDER_LABELS = {
    enrichmentStatus: 'FonteData',
    bigdatacorpEnrichmentStatus: 'BigDataCorp',
    juditEnrichmentStatus: 'Judit',
    escavadorEnrichmentStatus: 'Escavador',
    escavador2EnrichmentStatus: 'Escavador2',
    djenEnrichmentStatus: 'DJEN',
    creditEnrichmentStatus: 'Crédito',
    aiStatus: 'IA',
};

const REASON_FIELD = {
    bigdatacorpEnrichmentStatus: 'bigdatacorpSkippedReason',
    juditEnrichmentStatus: 'juditSkippedReason',
    escavadorEnrichmentStatus: 'escavadorSkippedReason',
    escavador2EnrichmentStatus: 'escavador2SkippedReason',
    djenEnrichmentStatus: 'djenSkippedReason',
    creditEnrichmentStatus: 'creditSkippedReason',
};

// Motivos que significam "esta fonte nao se aplica a este caso" — nao sao lacuna
// de cobertura, e o analista nao precisa ser incomodado com eles.
const REASONS_NAO_APLICAVEL = new Set(['disabled_for_tenant', 'phase_not_enabled', 'sub_phase_disabled', 'not_needed']);

// Motivos que significam "deveria ter consultado e nao consultou".
const REASONS_LACUNA = new Set(['circuit_open', 'identity_gate_not_passed']);

export function describeCoverageReason(reason) {
    switch (reason) {
        case 'disabled_for_tenant': return 'não contratada para esta empresa';
        case 'phase_not_enabled': return 'fase não habilitada neste caso';
        case 'sub_phase_disabled': return 'consulta desligada na configuração';
        case 'not_needed': return 'não foi necessária neste caso';
        case 'circuit_open': return 'fornecedor indisponível no momento da consulta';
        case 'identity_gate_not_passed': return 'bloqueada pela conferência de identidade';
        default: return null;
    }
}

/**
 * Lacunas de cobertura do caso, para AVISAR o analista — nunca para bloquear.
 * Retorna [] quando todas as fontes aplicáveis responderam.
 */
export function getCoverageGaps(caseData) {
    if (!caseData) return [];
    const gaps = [];

    for (const [campo, label] of Object.entries(PROVIDER_LABELS)) {
        const status = caseData[campo];
        if (!status || status === 'DONE') continue;

        const reason = REASON_FIELD[campo] ? caseData[REASON_FIELD[campo]] : null;

        // Fonte que a empresa não contratou não é lacuna: é escopo.
        if (status === 'SKIPPED' && reason && REASONS_NAO_APLICAVEL.has(reason)) continue;

        let severity = 'info';
        if (status === 'FAILED' || status === 'BLOCKED') severity = 'alto';
        else if (status === 'PARTIAL') severity = 'medio';
        else if (status === 'RUNNING' || status === 'PENDING') severity = 'medio';
        else if (status === 'SKIPPED') severity = REASONS_LACUNA.has(reason) ? 'alto' : 'medio';

        gaps.push({
            field: campo,
            provider: label,
            status,
            reason: reason || null,
            reasonLabel: describeCoverageReason(reason),
            severity,
        });
    }

    return gaps;
}

/** true quando alguma fonte que deveria ter respondido não respondeu. */
export function hasCoverageGap(caseData) {
    return getCoverageGaps(caseData).some((gap) => gap.severity === 'alto' || gap.severity === 'medio');
}
