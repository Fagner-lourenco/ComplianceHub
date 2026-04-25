import { extractErrorMessage } from '../../../core/errorUtils';
import './EnrichmentPipeline.css';

const PROVIDERS = [
    { key: 'judit', label: 'Judit', statusField: 'juditEnrichmentStatus', errorField: 'juditError', costField: null },
    { key: 'escavador', label: 'Escavador', statusField: 'escavadorEnrichmentStatus', errorField: 'escavadorError', costField: null },
    { key: 'autoclass', label: 'Auto-Classificação', statusField: null, errorField: null, costField: null },
    { key: 'ai', label: 'Análise IA', statusField: null, errorField: 'aiError', costField: 'aiCostUsd' },
    { key: 'fontedata', label: 'FonteData', statusField: 'enrichmentStatus', errorField: 'enrichmentError', costField: null, fallback: true },
];

const STATE_CONFIG = {
    PENDING:  { icon: '⏳', label: 'Pendente', cls: 'pending' },
    RUNNING:  { icon: '⚙️', label: 'Em execução', cls: 'running' },
    DONE:     { icon: '✓', label: 'Concluído', cls: 'done' },
    PARTIAL:  { icon: '⚡', label: 'Parcial', cls: 'partial' },
    FAILED:   { icon: '✕', label: 'Falhou', cls: 'failed' },
    SKIPPED:  { icon: '—', label: 'Ignorado', cls: 'skipped' },
    BLOCKED:  { icon: '🚫', label: 'Bloqueado', cls: 'blocked' },
    WAITING:  { icon: '⏳', label: 'Aguardando', cls: 'pending' },
};

function getProviderStatus(caseData, provider) {
    if (provider.key === 'autoclass') {
        if (caseData.autoClassifiedAt) return 'DONE';
        const escDone = ['DONE', 'PARTIAL', 'FAILED', 'SKIPPED'].includes(caseData.escavadorEnrichmentStatus);
        const juditDone = ['DONE', 'PARTIAL', 'FAILED', 'SKIPPED'].includes(caseData.juditEnrichmentStatus);
        if (escDone && juditDone && !caseData.autoClassifiedAt) return 'RUNNING';
        if (juditDone && !escDone) return 'WAITING';
        return 'WAITING';
    }
    if (provider.key === 'ai') {
        const hasGeneralResult = caseData.aiRawResponse || caseData.aiAnalysis || caseData.aiStructured;
        const hasHomonymResult = Boolean(caseData.aiHomonymStructured);
        const hasGeneralError = Boolean(caseData.aiError);
        const hasHomonymError = Boolean(caseData.aiHomonymError);
        // BUG-7 fix: If homonym succeeded but general AI failed (or vice versa), show PARTIAL.
        // Also check aiHomonymError for FAILED status.
        if ((hasGeneralResult || hasHomonymResult) && (hasGeneralError || hasHomonymError)) return 'PARTIAL';
        if (hasGeneralResult || hasHomonymResult) return 'DONE';
        if (hasGeneralError || hasHomonymError) return 'FAILED';
        if (
            caseData.aiHomonymTriggered
            && !hasHomonymResult
            && !hasGeneralResult
            && !hasGeneralError
            && !hasHomonymError
        ) {
            return 'RUNNING';
        }
        if (caseData.autoClassifiedAt && !hasGeneralResult && !hasGeneralError && !hasHomonymError) return 'WAITING';
        return 'PENDING';
    }
    const status = caseData[provider.statusField] || 'PENDING';
    if (
        provider.key === 'judit'
        && Array.isArray(caseData.juditPendingAsyncPhases)
        && caseData.juditPendingAsyncPhases.length > 0
        && status !== 'FAILED'
        && status !== 'BLOCKED'
    ) {
        return 'RUNNING';
    }
    return status;
}

function canRetryProvider(provider, status, error, onRetryPhase) {
    if (!onRetryPhase || !error) return false;
    if (!['fontedata', 'escavador', 'judit', 'ai'].includes(provider.key)) return false;
    return status === 'FAILED' || status === 'PARTIAL';
}

export default function EnrichmentPipeline({ caseData, onRetryPhase, retryingPhase = null }) {
    if (!caseData) return null;

    return (
        <div className="enrichment-pipeline">
            <h4 className="enrichment-pipeline__title">Pipeline de Enriquecimento</h4>
            <div className="enrichment-pipeline__list">
                {PROVIDERS.map((provider) => {
                    const status = getProviderStatus(caseData, provider);
                    const cfg = STATE_CONFIG[status] || STATE_CONFIG.PENDING;
                    const rawError = provider.errorField ? caseData[provider.errorField] : null;
                    const error = rawError ? extractErrorMessage(rawError, 'Erro no provedor.') : null;
                    const cost = provider.costField
                        ? (caseData[provider.costField] || 0) + (provider.key === 'ai' ? (caseData.aiHomonymCostUsd || 0) : 0)
                        : null;
                    const canRetry = canRetryProvider(provider, status, error, onRetryPhase);
                    const isRetrying = retryingPhase === provider.key;

                    // Hide FonteData fallback if it was never used
                    if (provider.fallback && status === 'PENDING' && !error) return null;

                    return (
                        <div key={provider.key} className={`enrichment-pipeline__item enrichment-pipeline__item--${cfg.cls}`}>
                            <span className="enrichment-pipeline__dot">{cfg.icon}</span>
                            <div className="enrichment-pipeline__info">
                                <span className="enrichment-pipeline__label">{provider.label}</span>
                                <span className="enrichment-pipeline__status">{cfg.label}</span>
                                {cost != null && <span className="enrichment-pipeline__cost">${cost.toFixed(4)}</span>}
                            </div>
                            {error && (
                                <span className="enrichment-pipeline__error" title={error}>⚠</span>
                            )}
                            {canRetry && (
                                <button
                                    type="button"
                                    className="enrichment-pipeline__retry"
                                    disabled={isRetrying}
                                    onClick={() => onRetryPhase(provider.key)}
                                    title={error}
                                >
                                    {isRetrying ? 'Reexecutando...' : 'Tentar novamente'}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
