import { extractErrorMessage } from '../../../core/errorUtils';
import './EnrichmentPipeline.css';

const PROVIDERS = [
    { key: 'bigdatacorp', label: 'BigDataCorp', statusField: 'bigdatacorpEnrichmentStatus', errorField: 'bigdatacorpError', costField: null },
    // phaseGate: linha so aparece quando a fase de analise esta habilitada no caso (ou ha status gravado)
    { key: 'credit', label: 'Crédito e Restrições (Quod)', statusField: 'creditEnrichmentStatus', errorField: 'creditError', costField: 'creditCostBRL', phaseGate: 'creditRestriction' },
    { key: 'judit', label: 'Judit', statusField: 'juditEnrichmentStatus', errorField: 'juditError', costField: null },
    { key: 'escavador', label: 'Escavador', statusField: 'escavadorEnrichmentStatus', errorField: 'escavadorError', costField: null },
    { key: 'djen', label: 'DJEN', statusField: 'djenEnrichmentStatus', errorField: 'djenError', costField: null, free: true },
    { key: 'escavador2', label: 'Escavador2', statusField: 'escavador2EnrichmentStatus', errorField: 'escavador2Error', costField: 'escavador2CostBRL', free: true },
    { key: 'autoclass', label: 'Auto-classificação', statusField: null, errorField: null, costField: null },
    { key: 'ai', label: 'Análise assistida', statusField: null, errorField: 'aiClassificationReviewError', costField: 'aiClassificationReviewCostUsd' },
    { key: 'fontedata', label: 'FonteData', statusField: 'enrichmentStatus', errorField: 'enrichmentError', costField: null, fallback: true },
];

const STATE_CONFIG = {
    PENDING:  { icon: '⏳', label: 'Pendente', cls: 'pending' },
    RUNNING:  { icon: '⚙️', label: 'Em execução', cls: 'running' },
    DONE:     { icon: '✓', label: 'Concluído', cls: 'done' },
    PARTIAL:  { icon: '⚡', label: 'Parcial', cls: 'partial' },
    FAILED:   { icon: '✕', label: 'Falhou', cls: 'failed' },
    FAILED_SCHEMA: { icon: '⚠️', label: 'Falha de schema', cls: 'failed' },
    SKIPPED:  { icon: '—', label: 'Ignorado', cls: 'skipped' },
    BLOCKED:  { icon: '🚫', label: 'Bloqueado', cls: 'blocked' },
    WAITING:  { icon: '⏳', label: 'Aguardando', cls: 'pending' },
};

function getProviderStatus(caseData, provider, aiEnabled) {
    if (provider.key === 'autoclass') {
        if (caseData.autoClassifiedAt) return 'DONE';
        const escDone = ['DONE', 'PARTIAL', 'FAILED', 'SKIPPED'].includes(caseData.escavadorEnrichmentStatus);
        const esc2Done = !caseData.escavador2EnrichmentStatus || ['DONE', 'PARTIAL', 'FAILED', 'SKIPPED'].includes(caseData.escavador2EnrichmentStatus);
        const juditDone = ['DONE', 'PARTIAL', 'FAILED', 'SKIPPED'].includes(caseData.juditEnrichmentStatus);
        if (escDone && esc2Done && juditDone && !caseData.autoClassifiedAt) return 'RUNNING';
        if (juditDone && (!escDone || !esc2Done)) return 'WAITING';
        return 'WAITING';
    }
    if (provider.key === 'ai') {
        if (caseData.aiStatus) return caseData.aiStatus;
        const hasGeneralResult = caseData.aiClassificationReview || caseData.aiClassificationReviewRawResponse;
        const hasHomonymResult = Boolean(caseData.aiHomonymStructured);
        const hasGeneralError = Boolean(caseData.aiClassificationReviewError || caseData.aiError);
        const hasHomonymError = Boolean(caseData.aiHomonymError);
        // Quando IA esta desabilitada no tenant, reflete imediatamente como SKIPPED.
        if (aiEnabled === false && !hasGeneralResult && !hasHomonymResult && !hasGeneralError && !hasHomonymError) {
            return 'SKIPPED';
        }
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

function canRetryProvider(provider, status, error, onRetryPhase, aiEnabled) {
    if (!onRetryPhase) return false;
    if (!['fontedata', 'escavador', 'escavador2', 'judit', 'bigdatacorp', 'credit', 'djen', 'ai'].includes(provider.key)) return false;
    // Nao permite reexecutar IA quando ela esta desabilitada no tenant (SKIPPED por config).
    if (provider.key === 'ai' && aiEnabled === false && status === 'SKIPPED') return false;
    return ['DONE', 'PARTIAL', 'FAILED', 'SKIPPED', 'BLOCKED'].includes(status);
}

function getProviderStatusLabel(provider, caseData, status) {
    if (provider.key === 'escavador2' && caseData?.escavador2CallbackStatus === 'QUEUED') {
        return 'Em fila';
    }
    return (STATE_CONFIG[status] || STATE_CONFIG.PENDING).label;
}

export default function EnrichmentPipeline({ caseData, onRetryPhase, retryingPhase = null, aiEnabled = null }) {
    if (!caseData) return null;

    return (
        <div className="enrichment-pipeline">
            <h4 className="enrichment-pipeline__title">Consulta automática</h4>
            <div className="enrichment-pipeline__list">
                {PROVIDERS.map((provider) => {
                    const status = getProviderStatus(caseData, provider, aiEnabled);
                    const cfg = STATE_CONFIG[status] || STATE_CONFIG.PENDING;
                    const rawError = provider.errorField ? caseData[provider.errorField] : null;
                    const error = rawError ? extractErrorMessage(rawError, 'Erro no provedor.') : null;
                    const cost = provider.costField
                        ? (caseData[provider.costField] || 0) + (provider.key === 'ai' ? (caseData.aiHomonymCostUsd || 0) : 0)
                        : null;
                    const canRetry = canRetryProvider(provider, status, error, onRetryPhase, aiEnabled);
                    const isRetrying = retryingPhase === provider.key;

                    // Hide FonteData fallback if it was never used
                    if (provider.fallback && status === 'PENDING' && !error) return null;

                    // Hide phase-gated providers when the analysis phase is off and nothing ran
                    if (provider.phaseGate) {
                        const phaseOn = Array.isArray(caseData.enabledPhases) && caseData.enabledPhases.includes(provider.phaseGate);
                        if (!phaseOn && !caseData[provider.statusField]) return null;
                    }

                    return (
                        <div key={provider.key} className={`enrichment-pipeline__item enrichment-pipeline__item--${cfg.cls}`}>
                            <span className="enrichment-pipeline__dot">{cfg.icon}</span>
                            <div className="enrichment-pipeline__info">
                                <span className="enrichment-pipeline__label">{provider.label}</span>
                                <span className="enrichment-pipeline__status">{getProviderStatusLabel(provider, caseData, status)}</span>
                                {provider.key === 'judit' && (status === 'RUNNING' || status === 'PARTIAL') && Array.isArray(caseData.juditPendingAsyncPhases) && caseData.juditPendingAsyncPhases.length > 0 && (
                                    <span className="enrichment-pipeline__detail">
                                        Aguardando: {caseData.juditPendingAsyncPhases.map(p => ({ warrant: 'mandados', execution: 'execução penal', lawsuits: 'processos' }[p] || p)).join(', ')}
                                    </span>
                                )}
                                {cost != null && <span className="enrichment-pipeline__cost">${cost.toFixed(4)}</span>}
                            </div>
                            {error && (
                                <span className="enrichment-pipeline__error-msg" title={error}>⚠ {error}</span>
                            )}
                            {status === 'FAILED_SCHEMA' && (caseData.aiClassificationReviewRawResponse || caseData.aiRawResponse) && (
                                <button
                                    type="button"
                                    className="enrichment-pipeline__inspect"
                                    onClick={() => {
                                        const el = document.getElementById('ai-raw-response');
                                        if (el) { el.open = true; el.scrollIntoView({ behavior: 'smooth' }); }
                                    }}
                                >
                                    Inspecionar resposta bruta
                                </button>
                            )}
                            {canRetry && (
                                <button
                                    type="button"
                                    className="enrichment-pipeline__retry"
                                    disabled={isRetrying}
                                    onClick={() => onRetryPhase(provider.key)}
                                    title={error || `Reexecutar ${provider.label}`}
                                >
                                    {isRetrying ? 'Reexecutando...' : (error ? 'Tentar novamente' : 'Reexecutar')}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
