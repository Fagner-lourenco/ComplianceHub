'use strict';

const RESOLUTION_STATUSES = new Set([
    'resolved',
    'accepted',
    'false_positive',
    'needs_recheck',
]);

function sanitizeResolutionText(value, maxLength = 600) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function buildProviderDivergenceResolution({
    divergence = {},
    payload = {},
    actor = {},
    resolvedAt = new Date().toISOString(),
} = {}) {
    const status = String(payload.status || 'resolved').trim();
    if (!RESOLUTION_STATUSES.has(status)) {
        throw new Error(`Status de divergencia invalido: ${status}`);
    }

    const resolution = sanitizeResolutionText(payload.resolution || payload.reason || payload.note);
    if (!resolution) {
        throw new Error('Justificativa da resolucao obrigatoria.');
    }

    const wasBlocking = divergence.blocksPublication === true;
    const blocksPublication = status === 'needs_recheck' ? wasBlocking : false;

    return {
        status,
        resolution,
        resolvedBy: actor.uid || null,
        resolvedByEmail: actor.email || null,
        resolvedAt,
        blocksPublication,
        resolutionAudit: {
            previousStatus: divergence.status || 'open',
            previousBlocksPublication: wasBlocking,
            nextStatus: status,
            nextBlocksPublication: blocksPublication,
        },
    };
}

module.exports = {
    RESOLUTION_STATUSES,
    buildProviderDivergenceResolution,
};
