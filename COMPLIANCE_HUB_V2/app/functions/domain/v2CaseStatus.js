'use strict';

const V2_CASE_STATUS_VERSION = 'v2-case-status-2026-04-23';

/**
 * V2 dossier lifecycle without human-review gates.
 *
 * received -> enriching -> ready -> published
 *                    \-> correction_needed
 */
const CASE_STATUS_V2 = {
    RECEIVED: 'received',
    ENRICHING: 'enriching',
    READY: 'ready',
    PUBLISHED: 'published',
    CORRECTION_NEEDED: 'correction_needed',
};

const ALL_STATUSES = Object.values(CASE_STATUS_V2);

const VALID_TRANSITIONS = {
    [CASE_STATUS_V2.RECEIVED]: [
        CASE_STATUS_V2.ENRICHING,
        CASE_STATUS_V2.CORRECTION_NEEDED,
    ],
    [CASE_STATUS_V2.ENRICHING]: [
        CASE_STATUS_V2.READY,
        CASE_STATUS_V2.CORRECTION_NEEDED,
    ],
    [CASE_STATUS_V2.READY]: [
        CASE_STATUS_V2.PUBLISHED,
        CASE_STATUS_V2.ENRICHING,
        CASE_STATUS_V2.CORRECTION_NEEDED,
    ],
    [CASE_STATUS_V2.PUBLISHED]: [
        CASE_STATUS_V2.ENRICHING,
        CASE_STATUS_V2.CORRECTION_NEEDED,
    ],
    [CASE_STATUS_V2.CORRECTION_NEEDED]: [
        CASE_STATUS_V2.ENRICHING,
        CASE_STATUS_V2.RECEIVED,
    ],
};

function hasPublishedArtifacts(caseData = {}) {
    return Boolean(
        caseData.currentDecisionId
        || caseData.currentReportSnapshotId
        || caseData.publicReportToken
        || caseData.reportReady === true
        || (caseData.finalVerdict && caseData.finalVerdict !== 'PENDING')
    );
}

function mapLegacyStatusToV2(legacyStatus, caseData = {}) {
    const s = String(legacyStatus || '').toUpperCase();
    switch (s) {
    case 'PENDING':
        return CASE_STATUS_V2.RECEIVED;
    case 'RUNNING':
    case 'IN_PROGRESS':
        return CASE_STATUS_V2.ENRICHING;
    case 'DONE':
        return hasPublishedArtifacts(caseData)
            ? CASE_STATUS_V2.PUBLISHED
            : CASE_STATUS_V2.READY;
    case 'PARTIAL':
        return CASE_STATUS_V2.READY;
    case 'CORRECTION_NEEDED':
    case 'BLOCKED':
    case 'FAILED':
        return CASE_STATUS_V2.CORRECTION_NEEDED;
    default:
        return CASE_STATUS_V2.RECEIVED;
    }
}

function mapV2StatusToLegacy(v2Status) {
    switch (v2Status) {
    case CASE_STATUS_V2.RECEIVED:
        return 'PENDING';
    case CASE_STATUS_V2.ENRICHING:
        return 'RUNNING';
    case CASE_STATUS_V2.READY:
        return 'PARTIAL';
    case CASE_STATUS_V2.PUBLISHED:
        return 'DONE';
    case CASE_STATUS_V2.CORRECTION_NEEDED:
        return 'CORRECTION_NEEDED';
    default:
        return 'PENDING';
    }
}

function isValidTransition(fromStatus, toStatus) {
    const from = String(fromStatus || '').trim();
    const to = String(toStatus || '').trim();
    if (from === to) return true;
    const allowed = VALID_TRANSITIONS[from] || [];
    return allowed.includes(to);
}

function transitionCaseStatus(currentStatus, event) {
    const from = String(currentStatus || CASE_STATUS_V2.RECEIVED).trim();
    const to = String(event || '').trim();

    if (!ALL_STATUSES.includes(from)) {
        return { status: from, changed: false, error: `Status atual desconhecido: ${from}` };
    }
    if (!ALL_STATUSES.includes(to)) {
        return { status: from, changed: false, error: `Evento/status destino desconhecido: ${to}` };
    }
    if (from === to) {
        return { status: from, changed: false };
    }
    if (!isValidTransition(from, to)) {
        const allowed = (VALID_TRANSITIONS[from] || []).join(', ');
        return {
            status: from,
            changed: false,
            error: `Transicao invalida de ${from} para ${to}. Permitidos: ${allowed || 'nenhum'}.`,
        };
    }

    return { status: to, changed: true };
}

function getInitialV2Status() {
    return CASE_STATUS_V2.RECEIVED;
}

function deriveV2StatusFromEnrichment(enrichmentStatus, caseData = {}) {
    const es = String(enrichmentStatus || '').toUpperCase();
    if (es === 'RUNNING' || es === 'PENDING' || es === 'QUEUED') {
        return CASE_STATUS_V2.ENRICHING;
    }
    if (es === 'DONE' || es === 'PARTIAL' || es === 'COMPLETED') {
        return hasPublishedArtifacts(caseData)
            ? CASE_STATUS_V2.PUBLISHED
            : CASE_STATUS_V2.READY;
    }
    if (es === 'BLOCKED' || es === 'FAILED') {
        return CASE_STATUS_V2.CORRECTION_NEEDED;
    }
    return CASE_STATUS_V2.RECEIVED;
}

module.exports = {
    V2_CASE_STATUS_VERSION,
    CASE_STATUS_V2,
    ALL_STATUSES,
    VALID_TRANSITIONS,
    mapLegacyStatusToV2,
    mapV2StatusToLegacy,
    isValidTransition,
    transitionCaseStatus,
    getInitialV2Status,
    deriveV2StatusFromEnrichment,
};
