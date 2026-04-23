import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/useAuth';
import {
    callCreateClientSolicitation,
    subscribeToCaseDoc,
    subscribeToModuleRunsForCase,
    subscribeToRiskSignalsForCase,
    subscribeToTimelineEventsForCase,
} from '../../core/firebase/firestoreService';
import { validateCpf, validateCnpj, formatCnpj } from '../../core/validators';
import { getUserFriendlyMessage } from '../../core/errorUtils';
import { getReportAvailability } from '../../core/clientPortal';
import {
    computeProgress,
    resolveRiskBucket,
    buildModuleCards,
    deriveStatusMessage,
    isAnalysisComplete,
} from '../../core/analysisProgress';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
import './AnaliseRapidaPage.css';

function formatCpf(value) {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function detectDocType(rawDigits) {
    if (rawDigits.length > 11) return 'cnpj';
    if (rawDigits.length === 11) return 'cpf';
    return rawDigits.length > 0 ? 'cpf' : null;
}

function formatDoc(value) {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    if (digits.length > 11) return formatCnpj(digits);
    return formatCpf(digits);
}

export default function AnaliseRapidaPage() {
    const navigate = useNavigate();
    const { user, userProfile } = useAuth();
    const isDemoMode = !user || userProfile?.source === 'demo';

    const [docInput, setDocInput] = useState('');
    const [fullName, setFullName] = useState('');
    const [validationError, setValidationError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submissionError, setSubmissionError] = useState(null);
    const [caseId, setCaseId] = useState(null);
    const [caseData, setCaseData] = useState(null);
    const [moduleRuns, setModuleRuns] = useState([]);
    const [riskSignals, setRiskSignals] = useState([]);
    const [timelineEvents, setTimelineEvents] = useState([]);
    const unsubsRef = useRef([]);

    const docDigits = docInput.replace(/\D/g, '');
    const docType = detectDocType(docDigits);
    const isPj = docType === 'cnpj';

    useEffect(() => () => {
        unsubsRef.current.forEach((fn) => { try { fn(); } catch { /* noop */ } });
        unsubsRef.current = [];
    }, []);

    function handleDocChange(event) {
        setDocInput(formatDoc(event.target.value));
        setValidationError(null);
    }

    function validate() {
        if (!fullName || fullName.trim().length < 3) {
            return 'Informe o nome completo do sujeito (minimo 3 caracteres).';
        }
        if (docType === 'cnpj') {
            if (!validateCnpj(docInput)) return 'CNPJ invalido.';
        } else {
            if (!validateCpf(docInput)) return 'CPF invalido.';
        }
        return null;
    }

    async function handleSubmit(event) {
        event.preventDefault();
        const err = validate();
        if (err) {
            setValidationError(err);
            return;
        }
        setSubmitting(true);
        setSubmissionError(null);
        try {
            const productKey = isPj ? 'dossier_pj' : 'dossier_pf_basic';
            const payload = isPj
                ? {
                    productKey,
                    fullName: fullName.trim(),
                    legalName: fullName.trim(),
                    cnpj: docInput,
                }
                : {
                    productKey,
                    fullName: fullName.trim(),
                    cpf: docInput,
                };

            const result = await callCreateClientSolicitation(payload);
            const createdId = result?.caseId || result?.id || null;
            if (!createdId) {
                throw new Error('Backend nao retornou identificador do caso.');
            }
            setCaseId(createdId);
        } catch (e) {
            setSubmissionError(getUserFriendlyMessage(e, 'iniciar a analise'));
            setSubmitting(false);
        }
    }

    useEffect(() => {
        if (!caseId) return undefined;

        const tenantId = userProfile?.tenantId || null;
        const subCase = subscribeToCaseDoc(caseId, (doc, err) => {
            if (err) {
                setSubmissionError('Falha ao sincronizar o caso.');
                return;
            }
            setCaseData(doc);
            if (submitting) setSubmitting(false);
        });
        const subModules = subscribeToModuleRunsForCase(caseId, (runs) => setModuleRuns(runs || []), tenantId);
        const subSignals = subscribeToRiskSignalsForCase(caseId, (signals) => setRiskSignals(signals || []), tenantId);
        const subTimeline = subscribeToTimelineEventsForCase(caseId, (events) => setTimelineEvents(events || []), 20, tenantId);

        unsubsRef.current.push(subCase, subModules, subSignals, subTimeline);
        return () => {
            subCase?.();
            subModules?.();
            subSignals?.();
            subTimeline?.();
        };
    }, [caseId, userProfile?.tenantId, submitting]);

    const progress = useMemo(() => computeProgress({ caseData, moduleRuns }), [caseData, moduleRuns]);
    const riskBucket = useMemo(() => resolveRiskBucket({ riskSignals, caseData }), [riskSignals, caseData]);
    const cards = useMemo(() => buildModuleCards({ moduleRuns, riskSignals }), [moduleRuns, riskSignals]);
    const statusMessage = useMemo(
        () => deriveStatusMessage({ progress, caseData, moduleRuns, riskSignals }),
        [progress, caseData, moduleRuns, riskSignals],
    );
    const done = isAnalysisComplete(caseData);
    const reportAvailability = useMemo(() => getReportAvailability(caseData, null), [caseData]);

    function handleOpenReport() {
        if (!caseData) return;
        const token = reportAvailability?.publicReportToken;
        if (token) {
            window.open(`/r/${token}`, '_blank', 'noopener,noreferrer');
            return;
        }
        navigate(`/client/solicitacoes?case=${encodeURIComponent(caseData.id)}`);
    }

    const phase = caseId ? 'running' : 'entry';

    return (
        <div className={`analise-rapida analise-rapida--${phase}`}>
            {phase === 'entry' && (
                <EntryHero
                    docInput={docInput}
                    docType={docType}
                    isPj={isPj}
                    fullName={fullName}
                    setFullName={setFullName}
                    onDocChange={handleDocChange}
                    onSubmit={handleSubmit}
                    submitting={submitting}
                    error={validationError || submissionError}
                />
            )}

            {phase === 'running' && (
                <>
                    <PageHeader
                        eyebrow={done ? 'Analise concluida' : 'Analisando em tempo real'}
                        title={done ? 'Relatorio pronto' : 'Motor analitico em execucao'}
                        subtitle={statusMessage}
                        metrics={[
                            { label: 'Progresso', value: `${progress}%`, testId: 'analise-progress' },
                            { label: 'Sinais', value: riskSignals.length, testId: 'analise-signals' },
                            { label: 'Modulos', value: cards.length, testId: 'analise-modules' },
                        ]}
                    />

                    <ProgressBar progress={progress} bucket={riskBucket} done={done} />

                    {done && (
                        <FinalCta
                            bucket={riskBucket}
                            reportAvailability={reportAvailability}
                            onOpenReport={handleOpenReport}
                            caseData={caseData}
                        />
                    )}

                    <ModuleCardsGrid cards={cards} />

                    <TimelineFeed events={timelineEvents} riskSignals={riskSignals} />

                    {submissionError && (
                        <div className="analise-rapida__error" role="alert">{submissionError}</div>
                    )}

                    {isDemoMode && (
                        <p className="analise-rapida__demo-note">
                            Em modo demonstracao, a experiencia reflete subscriptions reais do Firestore — o progresso anda conforme o backend entrega moduleRuns e riskSignals.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

function EntryHero({ docInput, docType, isPj, fullName, setFullName, onDocChange, onSubmit, submitting, error }) {
    return (
        <form className="analise-hero" onSubmit={onSubmit} noValidate>
            <div className="analise-hero__copy">
                <span className="analise-hero__eyebrow">Due diligence em tempo real</span>
                <h1 className="analise-hero__title">Analise CPF ou CNPJ com inteligencia, velocidade e rastreabilidade.</h1>
                <p className="analise-hero__subtitle">
                    Uma esteira analitica com cadastral, criminal, trabalhista, listas restritivas e sinais reputacionais —
                    executadas em paralelo e consolidadas em um relatorio auditavel.
                </p>
            </div>

            <div className="analise-hero__form">
                <label className="analise-hero__field">
                    <span className="analise-hero__label">CPF ou CNPJ</span>
                    <div className="analise-hero__input-wrap">
                        <span className="analise-hero__doc-tag" data-testid="analise-doc-tag">
                            {docType === 'cnpj' ? 'PJ' : docType === 'cpf' ? 'PF' : '—'}
                        </span>
                        <input
                            type="text"
                            className="analise-hero__input"
                            placeholder={isPj ? '00.000.000/0000-00' : '000.000.000-00'}
                            value={docInput}
                            onChange={onDocChange}
                            data-testid="analise-doc-input"
                            autoComplete="off"
                            inputMode="numeric"
                        />
                    </div>
                </label>

                <label className="analise-hero__field">
                    <span className="analise-hero__label">
                        {isPj ? 'Razao social ou nome fantasia' : 'Nome completo'}
                    </span>
                    <input
                        type="text"
                        className="analise-hero__input"
                        placeholder={isPj ? 'ACME Industria e Comercio Ltda.' : 'Nome completo do sujeito'}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        data-testid="analise-name-input"
                        autoComplete="off"
                    />
                </label>

                {error && <div className="analise-hero__error" role="alert">{error}</div>}

                <button
                    type="submit"
                    className={`analise-hero__cta ${submitting ? 'analise-hero__cta--loading' : ''}`}
                    disabled={submitting}
                    data-testid="analise-submit"
                >
                    <span className="analise-hero__cta-icon" aria-hidden="true">
                        {submitting ? '~' : 'O'}
                    </span>
                    <span>{submitting ? 'Iniciando analise...' : 'Analisar agora'}</span>
                </button>

                <p className="analise-hero__fineprint">
                    Consultas auditadas com rastreabilidade de provider e evidencia por modulo.
                </p>
            </div>
        </form>
    );
}

function ProgressBar({ progress, bucket, done }) {
    const style = {
        '--risk-color': `var(${bucket.colorVar})`,
        '--risk-bg': `var(${bucket.bg})`,
        width: `${progress}%`,
    };
    return (
        <div className={`analise-progressbar ${done ? 'analise-progressbar--done' : ''}`}>
            <div className="analise-progressbar__track" aria-hidden="true">
                <div className="analise-progressbar__fill" style={style} />
                <div className="analise-progressbar__shine" aria-hidden="true" />
            </div>
            <div className="analise-progressbar__meta">
                <span className="analise-progressbar__percent" data-testid="analise-progress-label">{progress}%</span>
                <span
                    className={`analise-progressbar__bucket analise-progressbar__bucket--${bucket.key}`}
                    data-testid="analise-risk-bucket"
                >
                    {bucket.label}
                </span>
            </div>
        </div>
    );
}

function ModuleCardsGrid({ cards }) {
    if (cards.length === 0) {
        return (
            <div className="analise-cards analise-cards--pending">
                <p>Aguardando a primeira rodada de consultas chegar do motor...</p>
            </div>
        );
    }
    return (
        <ul className="analise-cards" data-testid="analise-cards">
            {cards.map((card, index) => (
                <li
                    key={card.moduleKey}
                    className={`analise-card analise-card--${card.uiState}`}
                    style={{ animationDelay: `${Math.min(index * 80, 600)}ms` }}
                    data-testid={`analise-card-${card.moduleKey}`}
                >
                    <div className="analise-card__head">
                        <span className="analise-card__icon" aria-hidden="true">{card.icon}</span>
                        <strong className="analise-card__title">{card.title}</strong>
                        <span className={`analise-card__status analise-card__status--${card.uiState}`}>
                            {card.stateLabel}
                        </span>
                    </div>
                    {card.topSignalReason && (
                        <p className="analise-card__reason">{card.topSignalReason}</p>
                    )}
                    {card.signalCount > 0 && !card.topSignalReason && (
                        <p className="analise-card__reason">{card.signalCount} sinal(is) agregado(s)</p>
                    )}
                </li>
            ))}
        </ul>
    );
}

function TimelineFeed({ events = [], riskSignals = [] }) {
    if (events.length === 0 && riskSignals.length === 0) return null;
    const items = [
        ...events.slice(0, 10).map((evt) => ({
            key: `evt-${evt.id}`,
            label: evt.title || evt.action || 'Evento de analise',
            detail: evt.summary || evt.description || null,
            kind: 'event',
        })),
        ...riskSignals.slice(0, 5).map((sig) => ({
            key: `sig-${sig.id}`,
            label: sig.reason || sig.kind || 'Sinal de risco',
            detail: `${sig.moduleKey || 'modulo'} · ${sig.severity || 'low'}`,
            kind: `signal-${sig.severity || 'low'}`,
        })),
    ].slice(0, 12);

    return (
        <section className="analise-timeline">
            <header className="analise-timeline__head">
                <h3>Esteira analitica</h3>
                <span>{items.length} evento(s)</span>
            </header>
            <ul className="analise-timeline__list">
                {items.map((item) => (
                    <li key={item.key} className={`analise-timeline__item analise-timeline__item--${item.kind}`}>
                        <span className="analise-timeline__dot" aria-hidden="true" />
                        <div>
                            <strong>{item.label}</strong>
                            {item.detail && <p>{item.detail}</p>}
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}

function FinalCta({ bucket, onOpenReport, caseData }) {
    const tone = bucket.key === 'low' ? 'Nenhum achado critico.' : 'Achados sinalizados para revisao.';
    return (
        <div
            className={`analise-final analise-final--${bucket.key}`}
            data-testid="analise-final"
        >
            <div>
                <span className="analise-final__eyebrow">Analise concluida</span>
                <h2 className="analise-final__title">
                    {bucket.label}
                </h2>
                <p className="analise-final__message">{tone}</p>
            </div>
            <button
                type="button"
                className="analise-final__cta"
                onClick={onOpenReport}
                disabled={!caseData}
                data-testid="analise-open-report"
            >
                Ver relatorio completo
                <span aria-hidden="true"> →</span>
            </button>
        </div>
    );
}
